"""워크스페이스 → main 반영 — 작업한 내용을 파일 단위로 운영에 체리픽한다.

워크스페이스(workspace/* 브랜치)에서 저장한 내용은 브랜치에만 기록된다.
이 모듈은 main과의 차이를 파일 단위로 보여주고(pending), 선택한 것만
main 체크아웃에 반영(checkout + commit + push)한다 — flowwork
워크플로우의 "운영 반영"(gitops.release_paths)과 같은 개념이다.

  - 반영 단위 = 파일 1개. 종류(kind)는 요청(request)·폴더(folder)·
    컬렉션(collection)·환경(environment) 넷이다. 요청 파일에는 그 요청의
    docs가 함께 들어 있고, 폴더/컬렉션 문서는 각각의 메타 파일에 들어 있다.
  - 변경 목록 = main과 워크스페이스 브랜치 tip 간 diff. main에는 있지만
    이 워크스페이스 이력에 등장한 적 없는 파일(다른 워크스페이스가 반영한 것)은
    "삭제"로 오인되므로 목록에서 제외한다.
  - 중복 = 수정(M)으로 보이지만 main의 현재 내용이 이 워크스페이스 이력에
    없는 경우 — 같은 위치·이름의 것을 서로 독립적으로 만든 것이라
    반영을 막고 이름/위치 변경을 안내한다.
  - 무시 = 작업은 워크스페이스에 그대로 두되 목록에서만 감춘다. git에 남기면
    그 자체가 또 하나의 변경이 되므로 서버 로컬 JSON에 보관한다(executions/와 같은 결).
  - main 원복 = 워크스페이스의 파일을 main 버전으로 되돌린다(main에 없으면 삭제).

워크스페이스 메타(workspace.yml)와 flowwork 워크플로우 데이터(workflows/,
domains.json)는 대상이 아니다 — 전자는 워크스페이스마다 다른 것이 정상이고,
후자는 flowwork의 자체 운영 반영 흐름(gitops.py)이 담당한다.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any, Callable, Optional

import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from flowwork import parse_bru_request

# 요청/폴더/환경 파일 확장자 — 컬렉션은 yml(OpenCollection)이나 bru 형식으로 저장된다
API_SUFFIXES = (".yml", ".bru")
# 컬렉션 루트 설정 파일 (컬렉션 문서·헤더·인증이 여기 들어간다)
COLLECTION_FILES = {"opencollection.yml", "collection.bru", "bruno.json"}
# 폴더 메타 파일 (폴더 문서·헤더가 여기 들어간다)
FOLDER_FILES = {"folder.yml", "folder.bru"}
# 워크스페이스 메타 — 워크스페이스마다 다른 것이 정상이라 반영 대상이 아니다
WORKSPACE_FILES = {"workspace.yml"}


class PathsBody(BaseModel):
    paths: list[str]


class IgnoreBody(PathsBody):
    ignored: bool = True


def _run(args: list[str], cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=str(cwd), capture_output=True, text=True)


def _git(args: list[str], cwd: Path) -> str:
    proc = _run(args, cwd)
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout).strip() or f"git {' '.join(args)} 실패"
        raise HTTPException(status_code=409, detail=detail)
    return proc.stdout


def classify_path(path: str) -> Optional[str]:
    """반영 대상이면 종류(request|folder|collection|environment), 아니면 None.

    컬렉션이 워크트리 루트에 있든 하위 폴더에 있든 같은 규칙으로 판별한다.
    """
    parts = Path(path).parts
    if ".." in parts or any(p.startswith(".") for p in parts):
        return None
    name = parts[-1]
    if name in WORKSPACE_FILES:
        return None
    if name in COLLECTION_FILES:
        return "collection"
    if name in FOLDER_FILES:
        return "folder"
    if not path.endswith(API_SUFFIXES):
        return None  # workflows/*.json, domains.json 등 — flowwork가 따로 다룬다
    # environments/ 아래는 환경 파일 — 컬렉션 위치에 따라 깊이가 달라 전 구간을 본다
    return "environment" if "environments" in parts[:-1] else "request"


def _diff_paths(repo_dir: Path, main_branch: str, branch: str) -> dict[str, tuple[str, str]]:
    """{path: (A|M|D, kind)} — rename 감지를 꺼서 이동은 D(옛 경로)+A(새 경로)로 다룬다."""
    raw = _git(["diff", "--name-status", "--no-renames", "-z", main_branch, branch], repo_dir)
    fields = raw.split("\0")
    out: dict[str, tuple[str, str]] = {}
    for code, path in zip(fields[::2], fields[1::2]):
        kind = classify_path(path) if code else None
        if kind:
            out[path] = (code[0], kind)
    return out


def _read_blob(repo_dir: Path, ref: str, path: str) -> Optional[str]:
    proc = _run(["show", f"{ref}:{path}"], repo_dir)
    return proc.stdout if proc.returncode == 0 else None


def _blob_oid(repo_dir: Path, ref: str, path: str) -> Optional[str]:
    proc = _run(["rev-parse", f"{ref}:{path}"], repo_dir)
    return proc.stdout.strip() if proc.returncode == 0 else None


def _path_in_branch_history(repo_dir: Path, branch: str, path: str) -> bool:
    proc = _run(["rev-list", "-1", branch, "--", path], repo_dir)
    return bool(proc.stdout.strip())


def _blob_in_branch_history(repo_dir: Path, branch: str, oid: str, path: str) -> bool:
    """main의 현재 내용(blob)이 이 브랜치 이력에 등장한 적이 있는지 —
    있으면 같은 API의 계보(내가 반영했던 버전을 다시 수정한 것)다.
    (rev-list는 --find-object에 pathspec을 못 붙여 log를 쓴다)"""
    proc = _run(["log", "--format=%H", f"--find-object={oid}", branch, "--", path], repo_dir)
    return bool(proc.stdout.strip())


def _parsed_name_and_method(path: str, content: str) -> tuple[Optional[str], Optional[str]]:
    """파일 내용에서 표시 이름과(요청이면) 메서드를 뽑는다."""
    if path.endswith(".json"):  # bruno.json — 컬렉션 설정
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            return None, None
        return (data.get("name") if isinstance(data, dict) else None), None
    if path.endswith(".bru"):
        parsed = parse_bru_request(content)  # meta 블록은 요청·폴더·컬렉션이 같은 모양이다
        return parsed["name"], parsed["request"]["method"]
    try:
        data = yaml.safe_load(content)
    except yaml.YAMLError:
        return None, None
    if not isinstance(data, dict):
        return None, None
    info = data.get("info") or {}
    return (info.get("name") or data.get("name")), (data.get("http") or {}).get("method")


def _summarize(path: str, kind: str, content: Optional[str]) -> dict[str, Any]:
    """표시용 요약 — 이름은 파일 내용에서, 위치는 경로에서.

    폴더/컬렉션은 파일명(folder.yml 등)이 아니라 담고 있는 폴더·컬렉션이
    이름이므로, 파일명 대신 그 디렉토리 이름을 기본값으로 쓴다.
    """
    parts = Path(path).parts
    directory = "/".join(parts[:-1])
    if kind not in ("folder", "collection"):
        fallback = Path(path).stem
    elif len(parts) > 1:
        fallback = parts[-2]
    else:
        fallback = "컬렉션 설정"  # 컬렉션이 워크트리 루트라 이름을 딸 상위 폴더가 없다
    entry: dict[str, Any] = {
        "path": path,
        "kind": kind,
        "directory": directory,
        "name": fallback,
        "method": None,
    }
    if not content:
        return entry

    name, method = _parsed_name_and_method(path, content)
    entry["name"] = name or fallback
    if kind == "request":
        entry["method"] = (method or "").upper() or None
    return entry


class IgnoreStore:
    """워크스페이스별 무시 목록 — 서버 로컬 JSON (git에 남기지 않는다)."""

    def __init__(self, directory: Path) -> None:
        self._directory = directory

    def _file(self, workspace: str) -> Path:
        # 워크스페이스 이름은 서버가 검증한 것만 들어오지만, 경로 조립이므로 한 번 더 막는다
        if "/" in workspace or workspace in ("", ".", ".."):
            raise HTTPException(status_code=400, detail=f"허용되지 않는 워크스페이스 이름입니다: {workspace!r}")
        return self._directory / f"{workspace}.json"

    def read(self, workspace: str) -> set[str]:
        try:
            data = json.loads(self._file(workspace).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return set()
        return {str(p) for p in data} if isinstance(data, list) else set()

    def update(self, workspace: str, paths: list[str], ignored: bool) -> set[str]:
        current = self.read(workspace)
        current = current | set(paths) if ignored else current - set(paths)
        path = self._file(workspace)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(sorted(current), ensure_ascii=False, indent=2), encoding="utf-8")
        return current


def pending_changes_for(repo_dir: Path, main_branch: str, branch: str) -> list[dict[str, Any]]:
    files: list[dict[str, Any]] = []
    for path, (change, kind) in sorted(_diff_paths(repo_dir, main_branch, branch).items()):
        if change == "D" and not _path_in_branch_history(repo_dir, branch, path):
            # 이 워크스페이스가 가진 적 없는 파일 — 다른 워크스페이스가 main에
            # 반영한 것이라 "삭제할 변경"이 아니다
            continue
        content = _read_blob(repo_dir, branch, path)
        if content is None:  # 삭제된 항목은 main 기준으로 요약
            content = _read_blob(repo_dir, main_branch, path)
        entry = _summarize(path, kind, content)
        entry["change"] = change
        entry["status"] = "ok"
        if change == "M":
            main_oid = _blob_oid(repo_dir, main_branch, path)
            if main_oid and not _blob_in_branch_history(repo_dir, branch, main_oid, path):
                # main의 현재 내용이 이 워크스페이스 이력에 없다 — 같은
                # 위치·이름의 것이 독립적으로 두 번 만들어진 중복이다
                entry["status"] = "duplicate"
        files.append(entry)
    return files


def build_router(
    repo_dir: Path,
    ignore_dir: Path,
    find_workspace: Callable[[str], Optional[dict]],
    flush_workspace: Callable[[dict], None],
    git_push: bool,
) -> APIRouter:
    router = APIRouter(prefix="/api/workspaces")
    ignores = IgnoreStore(ignore_dir)

    def _main_branch() -> str:
        return _git(["rev-parse", "--abbrev-ref", "HEAD"], repo_dir).strip() or "main"

    def _workspace_or_404(name: str) -> dict:
        workspace = find_workspace(name)
        if not workspace:
            raise HTTPException(status_code=404, detail=f"workspace not found: {name}")
        return workspace

    def _pending(branch: str, main_branch: str, name: str) -> list[dict[str, Any]]:
        """변경 목록에 무시 여부를 표시한다 — 무시한 항목도 반영/원복 대상은 될 수 있다."""
        ignored = ignores.read(name)
        files = pending_changes_for(repo_dir, main_branch, branch)
        for entry in files:
            entry["ignored"] = entry["path"] in ignored
        return files

    @router.get("/{name}/pending-changes")
    def pending_changes(name: str) -> dict:
        """main에 아직 반영되지 않은 이 워크스페이스의 변경 목록."""
        workspace = _workspace_or_404(name)
        flush_workspace(workspace)  # 방금 저장한 변경이 커밋 대기 중이면 먼저 기록
        main_branch = _main_branch()
        return {
            "main_branch": main_branch,
            "branch": workspace["branch"],
            "files": _pending(workspace["branch"], main_branch, name),
        }

    @router.get("/{name}/change-diff")
    def change_diff(name: str, path: str) -> dict:
        """변경 한 건의 main 대비 차이 — unified diff 텍스트."""
        workspace = _workspace_or_404(name)
        if not classify_path(path):
            raise HTTPException(status_code=400, detail=f"반영 대상 파일이 아닙니다: {path}")
        flush_workspace(workspace)
        main_branch = _main_branch()
        diff = _git(
            ["diff", "--no-renames", "--no-color", main_branch, workspace["branch"], "--", path],
            repo_dir,
        )
        return {"path": path, "main_branch": main_branch, "diff": diff}

    @router.post("/{name}/ignore-changes")
    def ignore_changes(name: str, body: IgnoreBody) -> dict:
        """선택한 항목을 목록에서 감춘다(작업 내용은 그대로 둔다) / 다시 표시한다."""
        _workspace_or_404(name)
        if not body.paths:
            raise HTTPException(status_code=400, detail="무시할 항목을 선택하세요.")
        return {"status": "saved", "ignored": sorted(ignores.update(name, body.paths, body.ignored))}

    @router.post("/{name}/revert-changes")
    def revert_changes(name: str, body: PathsBody) -> dict:
        """선택한 항목을 워크스페이스에서 main 버전으로 되돌린다(main에 없으면 삭제)."""
        workspace = _workspace_or_404(name)
        if not body.paths:
            raise HTTPException(status_code=400, detail="원복할 항목을 선택하세요.")
        flush_workspace(workspace)
        main_branch = _main_branch()
        worktree = Path(workspace["pathname"])

        pending = {f["path"] for f in _pending(workspace["branch"], main_branch, name)}
        for path in body.paths:
            if path not in pending:
                raise HTTPException(status_code=409, detail=f"main과 차이가 없는 항목입니다: {path}")

        for path in body.paths:
            if _run(["cat-file", "-e", f"{main_branch}:{path}"], worktree).returncode == 0:
                _git(["checkout", main_branch, "--", path], worktree)
            else:
                (worktree / path).unlink(missing_ok=True)  # main에 없는(새로 만든) 파일은 삭제
        # 원복도 하나의 변경이므로 다른 저장과 같은 방식으로 기록된다
        flush_workspace(workspace)
        # 되돌린 파일은 더 이상 변경이 아니므로 무시 표시도 함께 지운다
        ignores.update(name, body.paths, ignored=False)
        return {"status": "reverted", "files": body.paths}

    @router.post("/{name}/release-changes")
    def release_changes(name: str, body: PathsBody) -> dict:
        """선택한 항목만 main에 반영(체리픽)하고 push한다."""
        workspace = _workspace_or_404(name)
        if not body.paths:
            raise HTTPException(status_code=400, detail="main에 반영할 항목을 선택하세요.")
        flush_workspace(workspace)
        main_branch = _main_branch()
        branch = workspace["branch"]

        pending = {f["path"]: f for f in _pending(branch, main_branch, name)}
        for path in body.paths:
            entry = pending.get(path)
            if entry is None:
                raise HTTPException(status_code=409, detail=f"main과 차이가 없는 항목입니다: {path}")
            if entry["status"] == "duplicate":
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"중복: main에 같은 위치·이름의 항목이 이미 있습니다 — '{path}'. "
                        "이름을 바꾸거나 위치를 옮긴 뒤 다시 반영하세요."
                    ),
                )

        if _git(["status", "--porcelain"], repo_dir).strip():
            raise HTTPException(status_code=409, detail="main 트리에 커밋되지 않은 변경이 있습니다. 잠시 후 다시 시도하세요.")

        for path in body.paths:
            if _run(["cat-file", "-e", f"{branch}:{path}"], repo_dir).returncode == 0:
                _git(["checkout", branch, "--", path], repo_dir)
            else:
                _git(["rm", "--ignore-unmatch", "-q", "--", path], repo_dir)
        if not _git(["diff", "--cached", "--name-only"], repo_dir).strip():
            raise HTTPException(status_code=409, detail="선택한 항목이 main과 차이가 없습니다.")

        _git(["commit", "-m", f"bruno-web: {name} → main 반영 ({len(body.paths)}건)"], repo_dir)
        # 반영된 파일은 더 이상 변경이 아니므로 무시 표시도 함께 지운다
        ignores.update(name, body.paths, ignored=False)
        commit = _git(["rev-parse", "--short", main_branch], repo_dir).strip()
        pushed = git_push and _run(["push", "origin", main_branch], repo_dir).returncode == 0
        return {"status": "released", "commit": commit, "pushed": pushed, "files": body.paths}

    return router
