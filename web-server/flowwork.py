"""flowwork — 워크플로우 기능 백엔드 (/api/flowwork/*).

flowwork 프로젝트(github.com/…/flowwork)의 서버를 bruno 웹 서버에 맞게 이식한 것.
원본과 달리 API 카탈로그를 별도의 콜렉션 저장소가 아니라 **bruno repo(main 체크아웃)의
.bru 파일**에서 직접 만든다 — 워크플로우가 참조하는 API 목록이 곧 main 브랜치의 API다.

  - 카탈로그: {repo}/<부서 폴더>/**/*.bru 를 평탄화 (department = 최상위 폴더)
  - 환경변수: {repo}/environments/*.bru 의 vars 병합
  - 워크플로우: {repo}/workflows/{domain}/{task}/{id}.json — 저장 시 main에 자동 커밋/푸시
  - 도메인 색상: {repo}/domains.json
  - 실행 이력: 서버 로컬 executions/*.jsonl (git에 남기지 않는다)
  - 프록시: SSRF allowlist + vault:// 시크릿 리졸브 + 이력 리댁션

실행 로직(값 리졸브·분기·스텝 순회)은 프론트(bruno-app components/Flowwork)가 담당한다.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
from pathlib import Path
from typing import Any, Callable, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

PROXY_TIMEOUT_SECONDS = float(os.environ.get("BRUNO_WEB_FLOWWORK_PROXY_TIMEOUT", "15.0"))

_ALLOWED_HOST_PREFIXES = [
    p.strip()
    for p in os.environ.get(
        "BRUNO_WEB_FLOWWORK_ALLOWED_HOSTS", "http://localhost,http://127.0.0.1"
    ).split(",")
    if p.strip()
]

# 카탈로그 대상에서 제외되는 최상위 디렉토리 (환경/워크플로우/저장소 메타)
_NON_DEPARTMENT_DIRS = {"environments", "workflows", "node_modules", ".git", ".bruno-history", ".transient"}

_HEX_COLOR = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
# 경로 traversal 방지: 단어문자(한글 포함) + 하이픈만
_SAFE_SEGMENT = re.compile(r"^[-\w]+$", re.UNICODE)
_TEMPLATE_VAR = re.compile(r"\{\{(\w+)\}\}")


def _safe(segment: str) -> str:
    if not segment or not _SAFE_SEGMENT.match(segment):
        raise HTTPException(status_code=400, detail=f"허용되지 않는 이름입니다: {segment!r}")
    return segment


# ---------------------------------------------------------------------------
# .bru 파서 (flowwork server/app/bruno.py 이식)
# ---------------------------------------------------------------------------
_HTTP_METHODS = {"get", "post", "put", "delete", "patch", "head", "options"}
_HEADER_RE = re.compile(r"([A-Za-z][\w:]*)\s*\{")
_DESCRIPTION_RE = re.compile(r"""^@description\(\s*(['"])(.*)\1\s*\)$""")


def _split_blocks(text: str) -> list[tuple[str, str]]:
    """최상위 `header { ... }` 블록들을 (header, inner) 목록으로. 중괄호 균형 매칭."""
    blocks: list[tuple[str, str]] = []
    pos = 0
    while True:
        m = _HEADER_RE.search(text, pos)
        if not m:
            break
        header = m.group(1)
        depth = 0
        i = m.end() - 1
        start = i + 1
        while i < len(text):
            c = text[i]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    break
            i += 1
        blocks.append((header, text[start:i]))
        pos = i + 1
    return blocks


def _dict_lines_annotated(inner: str) -> list[tuple[str, str, Optional[str]]]:
    """`key: value` 줄들을 (key, value, description) 목록으로 (순서 보존)."""
    out: list[tuple[str, str, Optional[str]]] = []
    pending_desc: Optional[str] = None
    for line in inner.splitlines():
        line = line.strip()
        if not line:
            continue
        m = _DESCRIPTION_RE.match(line)
        if m:
            pending_desc = m.group(2)
            continue
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        out.append((k.strip(), v.strip(), pending_desc))
        pending_desc = None
    return out


def _dict_lines(inner: str) -> list[tuple[str, str]]:
    return [(k, v) for k, v, _ in _dict_lines_annotated(inner)]


def parse_bru_request(text: str) -> dict[str, Any]:
    """.bru 요청 텍스트 → {name, seq, request(Postman형), output}."""
    name = ""
    seq = 0
    method = "GET"
    url = ""
    headers: list[dict[str, Any]] = []
    body_raw: Optional[str] = None
    output: list[Any] = []

    for header, inner in _split_blocks(text):
        if header == "meta":
            for k, v in _dict_lines(inner):
                if k == "name":
                    name = v
                elif k == "seq" and v.isdigit():
                    seq = int(v)
        elif header in _HTTP_METHODS:
            method = header.upper()
            for k, v in _dict_lines(inner):
                if k == "url":
                    url = v
        elif header == "headers":
            headers = [{"key": k, "value": v} for k, v, _ in _dict_lines_annotated(inner)]
        elif header == "body" or header.startswith("body:"):
            body_raw = inner.strip()
        elif header == "docs":
            for k, v in _dict_lines(inner):
                if k == "output":
                    output = []
                    for field in v.split(","):
                        field = field.strip()
                        if not field:
                            continue
                        if "=" in field:  # `이름=라벨` — 한글 설명 포함
                            fname, label = field.split("=", 1)
                            output.append({"name": fname.strip(), "label": label.strip()})
                        else:
                            output.append(field)

    request: dict[str, Any] = {"method": method, "header": headers, "url": {"raw": url}}
    if body_raw:
        request["body"] = {"mode": "raw", "raw": body_raw}
    return {"name": name, "seq": seq, "request": request, "output": output}


def parse_bru_environment(text: str) -> dict[str, str]:
    """.bru 환경 텍스트의 vars 블록 → key→value 맵."""
    values: dict[str, str] = {}
    for header, inner in _split_blocks(text):
        if header == "vars" or header.startswith("vars:"):
            for k, v in _dict_lines(inner):
                values[k] = v
    return values


# ---------------------------------------------------------------------------
# 리댁션 (flowwork server/app/redaction.py 이식)
# ---------------------------------------------------------------------------
REDACT_HEADER_KEYS = {"authorization", "x-api-key", "cookie"}
REDACT_RESPONSE_HEADER_KEYS = {"set-cookie", "authorization"}
REDACTED = "***REDACTED***"
_SENSITIVE_FIELD_PARTS = {
    "password", "token", "secret", "apikey", "accesstoken", "refreshtoken",
    "authorization", "credential", "privatekey", "clientsecret",
}


def _is_sensitive_field(key: str) -> bool:
    norm = key.lower().replace("-", "").replace("_", "")
    return any(part in norm for part in _SENSITIVE_FIELD_PARTS)


def redact_body(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: (REDACTED if _is_sensitive_field(k) else redact_body(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact_body(v) for v in obj]
    return obj


def redact_for_logging(request: dict[str, Any]) -> dict[str, Any]:
    redacted = {**request}
    headers = redacted.get("headers")
    if isinstance(headers, dict):
        redacted["headers"] = {
            k: (REDACTED if k.lower() in REDACT_HEADER_KEYS else v) for k, v in headers.items()
        }
    if "body" in redacted:
        redacted["body"] = redact_body(redacted["body"])
    return redacted


def redact_response(response: dict[str, Any]) -> dict[str, Any]:
    redacted = {**response, "body": redact_body(response.get("body"))}
    headers = redacted.get("headers")
    if isinstance(headers, dict):
        redacted["headers"] = {
            k: (REDACTED if k.lower() in REDACT_RESPONSE_HEADER_KEYS else v)
            for k, v in headers.items()
        }
    return redacted


# ---------------------------------------------------------------------------
# 시크릿 (flowwork server/app/secrets.py 이식) — vault://scope/key → 환경변수
# ---------------------------------------------------------------------------
VAULT_TOKEN_PATTERN = re.compile(r"vault://([^/\s]+)/([^\s\"']+)")


class SecretNotFoundError(Exception):
    def __init__(self, env_key: str) -> None:
        super().__init__(f"시크릿을 찾을 수 없습니다: {env_key}")


def _resolve_secret(scope: str, key: str) -> str:
    env_key = f"SECRET_{scope.upper()}_{key.upper().replace('-', '_')}"
    value = os.environ.get(env_key)
    if value is None:
        raise SecretNotFoundError(env_key)
    return value


def resolve_vault_deep(obj: Any) -> Any:
    """문자열 내 vault:// 참조를 재귀적으로 실값으로 치환."""
    if isinstance(obj, str):
        return VAULT_TOKEN_PATTERN.sub(lambda m: _resolve_secret(m.group(1), m.group(2)), obj)
    if isinstance(obj, dict):
        return {k: resolve_vault_deep(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [resolve_vault_deep(v) for v in obj]
    return obj


# ---------------------------------------------------------------------------
# 요청/응답 스키마
# ---------------------------------------------------------------------------
class ProxyRequest(BaseModel):
    execution_id: Optional[str] = None
    step_id: Optional[str] = None
    workflow_id: Optional[str] = None
    method: str
    url: str
    headers: dict[str, str] = Field(default_factory=dict)
    body: Any = None


class WorkflowStepModel(BaseModel):
    id: str
    order: int
    name: str
    apiBinding: Optional[dict[str, Any]] = None
    workflowBinding: Optional[dict[str, Any]] = None
    branchCondition: Optional[dict[str, Any]] = None
    stopOnFailure: bool = False
    resultView: Optional[dict[str, Any]] = None
    midInputs: Optional[list[dict[str, Any]]] = None


class WorkflowFileModel(BaseModel):
    id: str
    domain: str
    task: str
    name: str
    description: Optional[str] = None
    baseInputs: list[dict[str, Any]] = Field(default_factory=list)
    steps: list[WorkflowStepModel] = Field(default_factory=list)
    version: Optional[str] = None  # 낙관적 잠금 — 파일에는 저장하지 않는다


class DomainColorBody(BaseModel):
    color: str


class ExecutionInputsBody(BaseModel):
    values: dict[str, Any] = Field(default_factory=dict)
    workflow_id: Optional[str] = None


def catalog_entry_id(department: str, collection_file: str, item_path: list[str], name: str) -> str:
    key = "/".join([department, collection_file, *item_path, name])
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]


def build_router(repo_dir: Path, executions_dir: Path, schedule_commit: Callable[[Path], None]) -> APIRouter:
    router = APIRouter(prefix="/api/flowwork")

    workflows_dir = repo_dir / "workflows"
    domains_file = repo_dir / "domains.json"

    # -- 카탈로그 ------------------------------------------------------------
    def build_catalog() -> list[dict[str, Any]]:
        entries: list[dict[str, Any]] = []
        if not repo_dir.is_dir():
            return entries
        for department_dir in sorted(repo_dir.iterdir()):
            if not department_dir.is_dir() or department_dir.name in _NON_DEPARTMENT_DIRS:
                continue
            if department_dir.name.startswith("."):
                continue
            department = department_dir.name
            for bru_path in sorted(department_dir.rglob("*.bru")):
                # folder.bru는 폴더 메타데이터라 API가 아니다
                if bru_path.name == "folder.bru":
                    continue
                try:
                    parsed = parse_bru_request(bru_path.read_text(encoding="utf-8"))
                except OSError:
                    continue
                name = parsed["name"] or bru_path.stem
                template = parsed["request"]
                item_path = list(bru_path.parent.relative_to(department_dir).parts)
                raw = json.dumps(template, ensure_ascii=False)
                seen: dict[str, None] = {}
                for m in _TEMPLATE_VAR.finditer(raw):
                    seen.setdefault(m.group(1), None)
                output_fields: list[str] = []
                output_labels: dict[str, str] = {}
                for f in parsed["output"]:
                    if isinstance(f, dict) and f.get("name"):
                        output_fields.append(str(f["name"]))
                        if f.get("label"):
                            output_labels[str(f["name"])] = str(f["label"])
                    elif isinstance(f, str):
                        output_fields.append(f)
                entries.append(
                    {
                        "id": catalog_entry_id(department, department, item_path, name),
                        "department": department,
                        "collectionFile": department,
                        "collectionName": department,
                        "itemPath": item_path,
                        "name": name,
                        "method": template["method"],
                        "url": template["url"]["raw"],
                        "variables": list(seen.keys()),
                        "outputFields": output_fields,
                        "outputLabels": output_labels,
                        "requestTemplate": template,
                    }
                )
        return entries

    @router.get("/catalog/search")
    def search_catalog(q: str = "", limit: int = 500) -> dict:
        entries = build_catalog()
        if q:
            needle = q.lower()
            entries = [
                e
                for e in entries
                if needle in e["name"].lower()
                or needle in e["url"].lower()
                or needle in e["department"].lower()
                or any(needle in p.lower() for p in e["itemPath"])
            ]
        return {"results": entries[:limit], "catalog_version": None}

    @router.get("/catalog/environments")
    def get_environments() -> dict:
        merged: dict[str, str] = {}
        env_dir = repo_dir / "environments"
        if env_dir.is_dir():
            for path in sorted(env_dir.glob("*.bru")):
                try:
                    merged.update(parse_bru_environment(path.read_text(encoding="utf-8")))
                except OSError:
                    continue
        return {"values": merged}

    # -- 도메인 색상 ---------------------------------------------------------
    def load_domain_colors() -> dict[str, str]:
        if not domains_file.exists():
            return {}
        try:
            data = json.loads(domains_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
        if not isinstance(data, dict):
            return {}
        return {str(k): str(v) for k, v in data.items() if _HEX_COLOR.match(str(v))}

    @router.get("/domains")
    def list_domain_colors() -> dict:
        return {"colors": load_domain_colors()}

    @router.put("/domains/{domain}")
    def set_domain_color(domain: str, body: DomainColorBody) -> dict:
        _safe(domain)
        if not _HEX_COLOR.match(body.color):
            raise HTTPException(status_code=400, detail=f"허용되지 않는 색상입니다(#rgb/#rrggbb): {body.color!r}")
        colors = load_domain_colors()
        colors[domain] = body.color
        tmp = domains_file.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(colors, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        tmp.replace(domains_file)
        schedule_commit(domains_file)
        return {"status": "saved"}

    # -- 워크플로우 CRUD -----------------------------------------------------
    def _file_version(path: Path) -> str:
        return hashlib.sha256(path.read_bytes()).hexdigest()[:12]

    def _workflow_path(domain: str, task: str, workflow_id: str) -> Path:
        return workflows_dir / _safe(domain) / _safe(task) / f"{_safe(workflow_id)}.json"

    def _find_path_by_id(workflow_id: str) -> Optional[Path]:
        if not workflows_dir.exists():
            return None
        return next(workflows_dir.glob(f"*/*/{_safe(workflow_id)}.json"), None)

    @router.get("/workflows")
    def list_workflows() -> dict:
        out = []
        if workflows_dir.exists():
            for path in sorted(workflows_dir.glob("*/*/*.json")):
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, OSError):
                    continue
                out.append(
                    {
                        "id": data.get("id", path.stem),
                        "domain": data.get("domain", ""),
                        "task": data.get("task", ""),
                        "name": data.get("name", ""),
                        "description": data.get("description"),
                    }
                )
        return {"workflows": out}

    @router.get("/workflows/{workflow_id}")
    def get_workflow(workflow_id: str) -> dict:
        path = _find_path_by_id(workflow_id)
        if path is None:
            raise HTTPException(status_code=404, detail=f"워크플로우를 찾을 수 없습니다: {workflow_id}")
        data = json.loads(path.read_text(encoding="utf-8"))
        data["version"] = _file_version(path)
        return data

    @router.put("/workflows/{workflow_id}")
    def save_workflow(workflow_id: str, wf: WorkflowFileModel, force: bool = False) -> dict:
        if wf.id != workflow_id:
            raise HTTPException(status_code=400, detail="본문 id와 경로 id가 다릅니다")

        # (도메인, 업무) 내 이름 중복 검사
        folder = workflows_dir / _safe(wf.domain) / _safe(wf.task)
        if folder.exists():
            for path in folder.glob("*.json"):
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, OSError):
                    continue
                if data.get("name") == wf.name and data.get("id") != wf.id:
                    raise HTTPException(
                        status_code=409,
                        detail=f"'{wf.domain}/{wf.task}'에 이미 '{wf.name}' 이름이 있습니다.",
                    )

        new_path = _workflow_path(wf.domain, wf.task, wf.id)
        old_path = _find_path_by_id(wf.id)

        # 낙관적 잠금 — 조회 이후 다른 사용자가 저장/삭제했으면 409
        if not force and wf.version is not None:
            if old_path is None:
                raise HTTPException(
                    status_code=409,
                    detail={"code": "version_conflict", "message": "다른 사용자가 이 워크플로우를 삭제했습니다.", "current_version": None},
                )
            current = _file_version(old_path)
            if current != wf.version:
                raise HTTPException(
                    status_code=409,
                    detail={"code": "version_conflict", "message": "다른 사용자가 이 워크플로우를 먼저 저장했습니다.", "current_version": current},
                )

        new_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = new_path.with_suffix(".json.tmp")
        tmp_path.write_text(
            wf.model_dump_json(indent=2, exclude={"version"}, exclude_none=True), encoding="utf-8"
        )
        tmp_path.replace(new_path)

        # 도메인/업무 변경으로 경로가 달라졌으면 기존 파일 제거 (이동)
        if old_path is not None and old_path.resolve() != new_path.resolve():
            old_path.unlink(missing_ok=True)

        schedule_commit(new_path)
        return {"status": "saved", "version": _file_version(new_path)}

    @router.delete("/workflows/{workflow_id}")
    def delete_workflow(workflow_id: str) -> dict:
        path = _find_path_by_id(workflow_id)
        if path is None:
            raise HTTPException(status_code=404, detail=f"워크플로우를 찾을 수 없습니다: {workflow_id}")
        path.unlink()
        schedule_commit(workflows_dir)
        return {"status": "deleted"}

    # -- 실행 이력 ------------------------------------------------------------
    def _execution_path(execution_id: str) -> Path:
        return executions_dir / f"{_safe(execution_id)}.jsonl"

    def _append_execution(execution_id: str, entry: dict[str, Any]) -> None:
        path = _execution_path(execution_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    @router.get("/executions")
    def list_executions() -> dict:
        out: list[dict[str, Any]] = []
        if executions_dir.exists():
            for path in executions_dir.glob("*.jsonl"):
                try:
                    lines = [
                        json.loads(l)
                        for l in path.read_text(encoding="utf-8").splitlines()
                        if l.strip()
                    ]
                except (json.JSONDecodeError, OSError):
                    continue
                step_lines = [l for l in lines if l.get("step_id")]
                if not step_lines:
                    continue
                statuses = [s.get("response", {}).get("status") for s in step_lines]
                overall = "SUCCESS" if all(s and 200 <= s < 300 for s in statuses) else "FAILED"
                inputs_line = next((l for l in lines if l.get("kind") == "inputs"), None)
                top_wf = (inputs_line and inputs_line.get("workflow_id")) or step_lines[0].get("workflow_id")
                out.append(
                    {
                        "execution_id": path.stem,
                        "step_count": len(step_lines),
                        "overall_status": overall,
                        "started_at": step_lines[0].get("timestamp"),
                        "workflow_id": top_wf,
                    }
                )
        out.sort(key=lambda e: e.get("started_at") or 0, reverse=True)
        return {"executions": out}

    @router.get("/executions/{execution_id}")
    def get_execution(execution_id: str) -> dict:
        path = _execution_path(execution_id)
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"실행 이력을 찾을 수 없습니다: {execution_id}")
        lines = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
        return {"execution_id": execution_id, "steps": lines}

    @router.post("/executions/{execution_id}/inputs")
    def record_execution_inputs(execution_id: str, body: ExecutionInputsBody) -> dict:
        _append_execution(
            execution_id,
            {
                "kind": "inputs",
                "values": redact_body(body.values),
                "workflow_id": body.workflow_id,
                "timestamp": time.time(),
            },
        )
        return {"status": "saved"}

    # -- 프록시 ---------------------------------------------------------------
    @router.post("/proxy")
    async def proxy_call(req: ProxyRequest) -> dict:
        if not any(req.url.startswith(p) for p in _ALLOWED_HOST_PREFIXES):
            raise HTTPException(status_code=403, detail="허용되지 않은 API 호스트입니다")

        # 시크릿(vault:// 참조)은 실제 호출 직전에만 리졸브 — 로그에는 원본이 남는다
        try:
            out_headers = resolve_vault_deep(req.headers)
            out_body = resolve_vault_deep(req.body)
        except SecretNotFoundError as e:
            raise HTTPException(status_code=502, detail=str(e)) from e

        start = time.time()
        status: Optional[int]
        resp_body: Any
        resp_headers: dict[str, str] = {}
        resp_size = 0
        async with httpx.AsyncClient(timeout=PROXY_TIMEOUT_SECONDS) as client:
            try:
                resp = await client.request(req.method, req.url, headers=out_headers, json=out_body)
                status = resp.status_code
                try:
                    resp_body = resp.json()
                except ValueError:
                    resp_body = {"_raw": resp.text}
                resp_headers = dict(resp.headers)
                resp_size = len(resp.content)
            except httpx.RequestError as e:
                status, resp_body = None, {"error": str(e)}

        full_response = {"status": status, "headers": resp_headers, "size_bytes": resp_size, "body": resp_body}
        result = {
            "step_id": req.step_id,
            "request": redact_for_logging(req.model_dump()),
            "response": full_response,  # 프론트로는 전체 응답 (PREV_RESPONSE 체이닝용)
            "elapsed_ms": int((time.time() - start) * 1000),
            "timestamp": time.time(),
        }
        # execution_id가 있을 때만 이력 append (콤보/의존조회 보조 호출은 로깅 생략)
        if req.execution_id:
            _append_execution(
                req.execution_id,
                {**result, "response": redact_response(full_response), "workflow_id": req.workflow_id},
            )
        return result

    return router
