"""Bruno web-mode backend.

Serves three things:
  1. A filesystem API scoped to a collections root directory — the browser
     shim parses/serializes .bru/.yml itself and only needs raw file CRUD.
  2. An HTTP execution endpoint that performs the actual API request
     (HAR-shaped input) so the browser is not blocked by CORS.
  3. The built bruno-app web bundle as static files (when present).

Run:  uvicorn main:app --port 8008   (or: python main.py)
"""

import base64
import json
import os
import re
import shutil
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Optional

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

SERVER_DIR = Path(__file__).resolve().parent


def _load_dotenv(path: Path) -> None:
    """web-server/.env의 KEY=VALUE 줄을 환경에 로드 (이미 설정된 키는 유지)."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv(SERVER_DIR / ".env")
DATA_DIR = Path(os.environ.get("BRUNO_WEB_DATA_DIR", SERVER_DIR / "collections")).resolve()
REPO_DIR = Path(os.environ.get("BRUNO_WEB_REPO_DIR", SERVER_DIR / "repo")).resolve()
WORKTREES_DIR = Path(os.environ.get("BRUNO_WEB_WORKTREES_DIR", SERVER_DIR / "worktrees")).resolve()
SCRATCH_DIR = Path(os.environ.get("BRUNO_WEB_SCRATCH_DIR", SERVER_DIR / "scratch")).resolve()
GIT_PUSH = os.environ.get("BRUNO_WEB_GIT_PUSH", "1") == "1"
WORKSPACE_BRANCH_PREFIX = "workspace/"
APP_DIST = Path(
    os.environ.get("BRUNO_WEB_APP_DIST", SERVER_DIR.parent / "packages" / "bruno-app" / "dist")
).resolve()
PORT = int(os.environ.get("BRUNO_WEB_PORT", "8008"))
MOCK_ENABLED = os.environ.get("BRUNO_WEB_MOCK", "1") == "1"
MOCK_PORT = int(os.environ.get("BRUNO_WEB_MOCK_PORT", "9100"))

DATA_DIR.mkdir(parents=True, exist_ok=True)
SCRATCH_DIR.mkdir(parents=True, exist_ok=True)

IGNORED_DIRS = {"node_modules", ".git"}

app = FastAPI(title="Bruno Web Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Git workspaces — one worktree per workspace/* branch
# ---------------------------------------------------------------------------

def run_git(args: list[str], cwd: Path, input: Optional[str] = None) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, input=input)


def add_worktree(branch: str) -> Optional[dict]:
    """Ensure a worktree exists for the branch; return its workspace record."""
    name = branch[len(WORKSPACE_BRANCH_PREFIX):]
    worktree = WORKTREES_DIR / name
    if not (worktree / ".git").exists():
        worktree.parent.mkdir(parents=True, exist_ok=True)
        has_local = run_git(["show-ref", "--verify", "--quiet", f"refs/heads/{branch}"], REPO_DIR).returncode == 0
        if has_local:
            result = run_git(["worktree", "add", str(worktree), branch], REPO_DIR)
        else:
            result = run_git(["worktree", "add", "--track", "-b", branch, str(worktree), f"origin/{branch}"], REPO_DIR)
        if result.returncode != 0:
            print(f"[git] failed to add worktree for {branch}: {result.stderr.strip()}")
            return None
    return {"name": name, "branch": branch, "pathname": str(worktree)}


def detect_parent_branch(branch: str, candidate_branches: list[str]) -> Optional[str]:
    """어느 브랜치에서 분기했는지 추정 — 가장 최근(깊은) merge-base를 가진 후보가 부모.

    빈(orphan) 브랜치는 어떤 후보와도 공통 조상이 없어 None(독립)이 된다.
    동률이면 후보 순서(먼저 온 것 = main)가 이긴다.
    """
    best: Optional[str] = None
    best_depth = -1
    for candidate in candidate_branches:
        if candidate == branch:
            continue
        mb = run_git(["merge-base", branch, candidate], REPO_DIR)
        if mb.returncode != 0:
            continue
        depth_result = run_git(["rev-list", "--count", mb.stdout.strip()], REPO_DIR)
        depth = int(depth_result.stdout.strip() or 0)
        if depth > best_depth:
            best, best_depth = candidate, depth
    return best


def setup_workspaces() -> list[dict]:
    """The repo checkout (main) plus one worktree per workspace/* branch. Empty list = legacy mode."""
    if not (REPO_DIR / ".git").exists():
        return []

    run_git(["fetch", "origin"], REPO_DIR)
    run_git(["worktree", "prune"], REPO_DIR)

    branches: set[str] = set()
    for pattern in (f"refs/heads/{WORKSPACE_BRANCH_PREFIX}*", f"refs/remotes/origin/{WORKSPACE_BRANCH_PREFIX}*"):
        result = run_git(["for-each-ref", "--format=%(refname:short)", pattern], REPO_DIR)
        for line in result.stdout.splitlines():
            branch = line.strip().removeprefix("origin/")
            if branch.startswith(WORKSPACE_BRANCH_PREFIX):
                branches.add(branch)

    # The main checkout is the default workspace — the client treats the first entry as default.
    main_branch = run_git(["rev-parse", "--abbrev-ref", "HEAD"], REPO_DIR).stdout.strip() or "main"
    workspaces = [{"name": main_branch, "branch": main_branch, "pathname": str(REPO_DIR), "parent": None}]
    for branch in sorted(branches):
        workspace = add_worktree(branch)
        if workspace:
            workspaces.append(workspace)

    # 후보를 "앞서 처리된 브랜치"로 제한해 상호 부모(사이클)를 원천 차단한다 —
    # 공통 이력이 깊은 형제 브랜치끼리 서로를 부모로 고르는 것을 막는다.
    processed = [workspaces[0]["branch"]]
    for workspace in workspaces[1:]:
        workspace["parent"] = detect_parent_branch(workspace["branch"], processed)
        processed.append(workspace["branch"])
    return workspaces


WORKSPACES = setup_workspaces()

_commit_timers: dict[str, threading.Timer] = {}
_commit_lock = threading.Lock()


def find_worktree(path: Path) -> Optional[dict]:
    for workspace in WORKSPACES:
        root = Path(workspace["pathname"])
        if path == root or root in path.parents:
            return workspace
    return None


def _commit_worktree(workspace: dict):
    cwd = Path(workspace["pathname"])
    run_git(["add", "-A"], cwd)
    if run_git(["diff", "--cached", "--quiet"], cwd).returncode == 0:
        return
    result = run_git(["commit", "-m", "bruno-web: auto-save"], cwd)
    if result.returncode != 0:
        print(f"[git] commit failed on {workspace['branch']}: {result.stderr.strip()}")
        return
    print(f"[git] committed changes on {workspace['branch']}")
    if GIT_PUSH:
        push = run_git(["push", "origin", workspace["branch"]], cwd)
        if push.returncode != 0:
            print(f"[git] push failed on {workspace['branch']}: {push.stderr.strip()[:200]}")


def schedule_commit(path: Path):
    workspace = find_worktree(path)
    if not workspace:
        return
    with _commit_lock:
        timer = _commit_timers.get(workspace["branch"])
        if timer:
            timer.cancel()
        timer = threading.Timer(2.0, _commit_worktree, args=(workspace,))
        timer.daemon = True
        _commit_timers[workspace["branch"]] = timer
        timer.start()


def allowed_roots() -> list[Path]:
    roots = [Path(w["pathname"]) for w in WORKSPACES]
    roots.append(SCRATCH_DIR)
    roots.append(DATA_DIR)
    return roots


def safe_path(raw: str) -> Path:
    """Resolve a client-supplied path and refuse anything outside the allowed roots."""
    if not raw:
        raise HTTPException(status_code=400, detail="path is required")
    path = Path(raw)
    if not path.is_absolute():
        path = DATA_DIR / path
    resolved = path.resolve()
    for root in allowed_roots():
        if resolved == root or root in resolved.parents:
            return resolved
    raise HTTPException(status_code=400, detail=f"path is outside the allowed roots: {raw}")


# ---------------------------------------------------------------------------
# flowwork — 워크플로우 기능 (카탈로그는 main 체크아웃의 .bru 기준)
# ---------------------------------------------------------------------------

import flowwork

app.include_router(flowwork.build_router(REPO_DIR, SERVER_DIR / "executions", schedule_commit))


# ---------------------------------------------------------------------------
# Filesystem API
# ---------------------------------------------------------------------------

class WriteBody(BaseModel):
    path: str
    content: str


class PathBody(BaseModel):
    path: str


class RenameBody(BaseModel):
    oldPath: str
    newPath: str


@app.get("/api/health")
def health():
    return {"status": "ok", "root": str(DATA_DIR)}


@app.get("/api/fs/root")
def fs_root():
    return {"root": str(DATA_DIR)}


@app.get("/api/workspaces")
def list_workspaces():
    """One workspace per workspace/* branch (empty in legacy directory mode)."""
    return {"workspaces": WORKSPACES, "scratchRoot": str(SCRATCH_DIR)}


WORKSPACE_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


class CreateWorkspaceBody(BaseModel):
    name: str


class CloneWorkspaceBody(BaseModel):
    source: str
    name: str


def validate_new_workspace_name(name: str) -> str:
    name = name.strip()
    if not WORKSPACE_NAME_RE.match(name):
        raise HTTPException(
            status_code=400,
            detail="workspace name may only contain letters, digits, '.', '_' and '-', and must not start with a punctuation character",
        )
    if any(w["name"].lower() == name.lower() for w in WORKSPACES):
        raise HTTPException(status_code=409, detail=f"a workspace named '{name}' already exists")
    branch = f"{WORKSPACE_BRANCH_PREFIX}{name}"
    for ref in (f"refs/heads/{branch}", f"refs/remotes/origin/{branch}"):
        if run_git(["show-ref", "--verify", "--quiet", ref], REPO_DIR).returncode == 0:
            raise HTTPException(status_code=409, detail=f"branch '{branch}' already exists")
    return name


def create_workspace_branch(name: str, start_point: Optional[str]) -> dict:
    """Create workspace/<name> (from start_point, or as an empty history) plus its worktree."""
    if not (REPO_DIR / ".git").exists():
        raise HTTPException(status_code=400, detail="git workspace mode is not enabled")

    branch = f"{WORKSPACE_BRANCH_PREFIX}{name}"
    parent = start_point
    if start_point is None:
        # No files at all: an empty tree committed with no parent.
        empty_tree = run_git(["mktree"], REPO_DIR, input="").stdout.strip()
        commit = run_git(["commit-tree", empty_tree, "-m", f"bruno-web: create workspace {name}"], REPO_DIR)
        if commit.returncode != 0:
            raise HTTPException(status_code=500, detail=f"git commit-tree failed: {commit.stderr.strip()}")
        start_point = commit.stdout.strip()

    result = run_git(["branch", branch, start_point], REPO_DIR)
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=f"git branch failed: {result.stderr.strip()}")

    workspace = add_worktree(branch)
    if not workspace:
        run_git(["branch", "-D", branch], REPO_DIR)
        raise HTTPException(status_code=500, detail=f"failed to create a worktree for '{branch}'")
    workspace["parent"] = parent

    if GIT_PUSH:
        push = run_git(["push", "-u", "origin", branch], REPO_DIR)
        if push.returncode != 0:
            print(f"[git] push failed on {branch}: {push.stderr.strip()[:200]}")

    WORKSPACES.append(workspace)
    return workspace


@app.post("/api/workspaces")
def create_workspace(body: CreateWorkspaceBody):
    """New workspace/<name> branch with no collections, plus its worktree."""
    name = validate_new_workspace_name(body.name)
    return {"workspace": create_workspace_branch(name, start_point=None)}


@app.post("/api/workspaces/clone")
def clone_workspace(body: CloneWorkspaceBody):
    """Duplicate an existing workspace's branch into workspace/<name>."""
    name = validate_new_workspace_name(body.name)
    source = next((w for w in WORKSPACES if w["name"] == body.source), None)
    if not source:
        raise HTTPException(status_code=404, detail=f"source workspace not found: {body.source}")
    return {"workspace": create_workspace_branch(name, start_point=source["branch"])}


@app.delete("/api/workspaces/{name}")
def delete_workspace(name: str):
    """워크스페이스 삭제 — worktree, 로컬 브랜치, (push 모드면) 원격 브랜치까지 지운다."""
    workspace = next((w for w in WORKSPACES if w["name"] == name), None)
    if not workspace:
        raise HTTPException(status_code=404, detail=f"workspace not found: {name}")
    if workspace is WORKSPACES[0]:
        raise HTTPException(status_code=400, detail="기본 워크스페이스(main)는 삭제할 수 없습니다")

    branch = workspace["branch"]

    # 삭제될 worktree에 예약된 auto-commit이 뒤늦게 실행되지 않도록 취소
    with _commit_lock:
        timer = _commit_timers.pop(branch, None)
        if timer:
            timer.cancel()

    result = run_git(["worktree", "remove", "--force", workspace["pathname"]], REPO_DIR)
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=f"git worktree remove failed: {result.stderr.strip()}")

    branch_result = run_git(["branch", "-D", branch], REPO_DIR)
    if branch_result.returncode != 0:
        raise HTTPException(status_code=500, detail=f"git branch -D failed: {branch_result.stderr.strip()}")

    if GIT_PUSH:
        push = run_git(["push", "origin", "--delete", branch], REPO_DIR)
        if push.returncode != 0:
            print(f"[git] remote branch delete failed for {branch}: {push.stderr.strip()[:200]}")

    # 워크스페이스 전용 scratch(임시 요청)도 함께 정리
    scratch = SCRATCH_DIR / workspace["name"]
    if scratch.is_dir():
        shutil.rmtree(scratch, ignore_errors=True)

    WORKSPACES.remove(workspace)
    return {"status": "deleted", "branch": branch}


def collection_record(directory: Path) -> Optional[dict]:
    for config_name, fmt in (("bruno.json", "bru"), ("opencollection.yml", "yml")):
        config_path = directory / config_name
        if config_path.is_file():
            return {
                "pathname": str(directory),
                "configFile": config_name,
                "format": fmt,
                "content": config_path.read_text(encoding="utf-8", errors="replace"),
            }
    return None


@app.get("/api/collections")
def list_collections(root: Optional[str] = None):
    """Collections in the root: the root itself if it holds a collection config, else its direct subdirectories."""
    base = safe_path(root) if root else DATA_DIR
    if not base.is_dir():
        raise HTTPException(status_code=404, detail=f"root not found: {root}")

    root_collection = collection_record(base)
    if root_collection:
        return {"root": str(base), "collections": [root_collection]}

    collections = []
    for child in sorted(base.iterdir()):
        if not child.is_dir() or child.name in IGNORED_DIRS:
            continue
        record = collection_record(child)
        if record:
            collections.append(record)
    return {"root": str(base), "collections": collections}


def build_tree(path: Path) -> dict:
    node: dict[str, Any] = {"name": path.name, "pathname": str(path)}
    if path.is_dir():
        node["type"] = "dir"
        children = []
        for child in sorted(path.iterdir()):
            if child.name in IGNORED_DIRS:
                continue
            children.append(build_tree(child))
        node["children"] = children
    else:
        node["type"] = "file"
        node["size"] = path.stat().st_size
    return node


@app.get("/api/fs/tree")
def fs_tree(path: str = Query(...)):
    target = safe_path(path)
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"not found: {path}")
    return build_tree(target)


@app.get("/api/fs/read")
def fs_read(path: str = Query(...)):
    target = safe_path(path)
    if not target.is_file():
        raise HTTPException(status_code=404, detail=f"not a file: {path}")
    return {
        "pathname": str(target),
        "size": target.stat().st_size,
        "content": target.read_text(encoding="utf-8", errors="replace"),
    }


@app.get("/api/fs/exists")
def fs_exists(path: str = Query(...)):
    target = safe_path(path)
    return {"exists": target.exists(), "isDirectory": target.is_dir()}


@app.post("/api/fs/write")
def fs_write(body: WriteBody):
    target = safe_path(body.path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body.content, encoding="utf-8")
    schedule_commit(target)
    return {"pathname": str(target)}


@app.post("/api/fs/mkdir")
def fs_mkdir(body: PathBody):
    target = safe_path(body.path)
    target.mkdir(parents=True, exist_ok=True)
    return {"pathname": str(target)}


@app.post("/api/fs/rename")
def fs_rename(body: RenameBody):
    source = safe_path(body.oldPath)
    dest = safe_path(body.newPath)
    if not source.exists():
        raise HTTPException(status_code=404, detail=f"not found: {body.oldPath}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    source.rename(dest)
    schedule_commit(dest)
    return {"pathname": str(dest)}


@app.post("/api/fs/delete")
def fs_delete(body: PathBody):
    target = safe_path(body.path)
    if target in allowed_roots():
        raise HTTPException(status_code=400, detail="refusing to delete a workspace root")
    if target.is_dir():
        shutil.rmtree(target)
    elif target.exists():
        target.unlink()
    schedule_commit(target)
    return {"deleted": str(target)}


# ---------------------------------------------------------------------------
# HTTP execution (HAR-shaped request in, response with base64 body out)
# ---------------------------------------------------------------------------

class HarHeader(BaseModel):
    name: str
    value: str = ""


class HarPostParam(BaseModel):
    name: str
    value: str = ""
    fileName: Optional[str] = None
    contentType: Optional[str] = None


class HarPostData(BaseModel):
    mimeType: str = ""
    text: Optional[str] = None
    params: Optional[list[HarPostParam]] = None


class ExecuteBody(BaseModel):
    method: str
    url: str
    headers: list[HarHeader] = []
    postData: Optional[HarPostData] = None
    timeoutMs: Optional[int] = None
    followRedirects: bool = True
    maxRedirects: int = 5
    verifyTls: bool = True
    # execution-history context — which collection/request this run belongs to
    collectionPath: Optional[str] = None
    requestName: Optional[str] = None


# Headers httpx must compute itself; forwarding stale values corrupts the request.
STRIPPED_REQUEST_HEADERS = {"content-length", "transfer-encoding"}

HISTORY_DIR_NAME = ".bruno-history"


def now_ms() -> int:
    return int(time.time() * 1000)


def record_timeline(body: ExecuteBody, result: dict):
    """Append the run's timeline to <worktree>/.bruno-history/timeline.jsonl.

    Only runs whose collection lives inside a git worktree are recorded; the
    file rides the same auto-commit/push flow as collection saves. Response
    bodies are deliberately not persisted — only the timeline and metadata.
    """
    if not body.collectionPath:
        return
    workspace = find_worktree(Path(body.collectionPath).resolve())
    if not workspace:
        return
    record = {
        "executedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "collection": Path(body.collectionPath).name,
        "request": body.requestName,
        "method": body.method.upper(),
        "url": body.url,
        "status": result.get("status"),
        "statusText": result.get("statusText"),
        "durationMs": result.get("durationMs"),
        "size": result.get("size"),
        "error": result.get("error"),
        "timeline": result.get("timeline") or [],
    }
    history_file = Path(workspace["pathname"]) / HISTORY_DIR_NAME / "timeline.jsonl"
    try:
        history_file.parent.mkdir(exist_ok=True)
        with history_file.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    except OSError as error:
        print(f"[history] failed to write {history_file}: {error}")
        return
    schedule_commit(history_file)


def build_request_kwargs(body: ExecuteBody, headers: list[tuple[str, str]]) -> dict:
    kwargs: dict[str, Any] = {}
    post = body.postData
    if post is None:
        return kwargs

    mime = (post.mimeType or "").lower()
    if mime.startswith("application/x-www-form-urlencoded") and post.params is not None:
        kwargs["data"] = [(p.name, p.value) for p in post.params]
        # httpx sets the urlencoded content-type itself
        headers[:] = [(k, v) for k, v in headers if k.lower() != "content-type"]
    elif mime.startswith("multipart/form-data") and post.params is not None:
        files = []
        for p in post.params:
            filename = p.fileName or None
            content_type = p.contentType or None
            files.append((p.name, (filename, p.value.encode("utf-8"), content_type)))
        kwargs["files"] = files
        # boundary must come from httpx, not the client
        headers[:] = [(k, v) for k, v in headers if k.lower() != "content-type"]
    elif post.text is not None:
        kwargs["content"] = post.text.encode("utf-8")
        if post.mimeType and not any(k.lower() == "content-type" for k, v in headers):
            headers.append(("content-type", post.mimeType))
    return kwargs


@app.post("/api/http/execute")
async def http_execute(body: ExecuteBody):
    timeline: list[dict] = []

    def log(entry_type: str, message: str):
        timeline.append({"timestamp": now_ms(), "type": entry_type, "message": message})

    def finish(payload: dict) -> dict:
        record_timeline(body, payload)
        return payload

    if "{{" in body.url:
        message = (
            f"URL contains unresolved variables: {body.url} — "
            "select an environment (top-right dropdown) that defines them, "
            "and reload the page if the environment file changed on disk."
        )
        log("error", message)
        return finish({"error": message, "timeline": timeline})

    headers = [
        (h.name, h.value) for h in body.headers if h.name.strip() and h.name.lower() not in STRIPPED_REQUEST_HEADERS
    ]

    try:
        request_kwargs = build_request_kwargs(body, headers)
    except Exception as error:
        return finish({"error": f"Failed to build request body: {error}", "timeline": timeline})

    timeout_seconds = (body.timeoutMs / 1000) if body.timeoutMs else None
    log("info", f"Preparing request to {body.url}")
    log("request", f"{body.method.upper()} {body.url}")
    for name, value in headers:
        log("requestHeader", f"{name}: {value}")

    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(
            follow_redirects=body.followRedirects,
            max_redirects=body.maxRedirects,
            verify=body.verifyTls,
            timeout=httpx.Timeout(timeout_seconds),
        ) as client:
            response = await client.request(
                body.method.upper(), body.url, headers=headers, **request_kwargs
            )
            content = response.content
    except httpx.TimeoutException:
        log("error", "Request timed out")
        return finish({"error": "Request timed out", "timeline": timeline})
    except httpx.HTTPError as error:
        message = str(error) or error.__class__.__name__
        log("error", message)
        return finish({"error": message, "timeline": timeline})
    except Exception as error:  # noqa: BLE001 — surface anything to the client
        message = str(error) or error.__class__.__name__
        log("error", message)
        return finish({"error": message, "timeline": timeline})

    duration_ms = int((time.perf_counter() - started) * 1000)
    status_text = response.reason_phrase or ""
    log("response", f"HTTP/{response.http_version.removeprefix('HTTP/')} {response.status_code} {status_text}")
    for name, value in response.headers.multi_items():
        log("responseHeader", f"{name}: {value}")
    log("info", f"Received {len(content)} bytes in {duration_ms} ms")

    return finish({
        "status": response.status_code,
        "statusText": status_text,
        "headers": list(response.headers.multi_items()),
        "dataBase64": base64.b64encode(content).decode("ascii"),
        "size": len(content),
        "durationMs": duration_ms,
        "finalUrl": str(response.url),
        "timeline": timeline,
        "error": None,
    })


# ---------------------------------------------------------------------------
# Built-in mock API — lets the sample collections run without internet access
# ---------------------------------------------------------------------------

import asyncio

from fastapi import Body, Header, Request, Response

MOCK_USERS: dict[int, dict] = {
    1: {"id": 1, "name": "Ada Lovelace", "email": "ada@example.com", "role": "admin"},
    2: {"id": 2, "name": "Grace Hopper", "email": "grace@example.com", "role": "engineer"},
    3: {"id": 3, "name": "Alan Turing", "email": "alan@example.com", "role": "engineer"},
}
MOCK_PRODUCTS = [
    {"id": 101, "name": "Keyboard", "category": "electronics", "price": 49.9},
    {"id": 102, "name": "Monitor", "category": "electronics", "price": 199.0},
    {"id": 103, "name": "Notebook", "category": "stationery", "price": 3.5},
    {"id": 104, "name": "Pen", "category": "stationery", "price": 1.2},
]
MOCK_TOKEN = "mock-token-12345"


@app.get("/mock/users")
def mock_list_users():
    return {"users": list(MOCK_USERS.values()), "total": len(MOCK_USERS)}


@app.get("/mock/users/{user_id}")
def mock_get_user(user_id: int):
    user = MOCK_USERS.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"user {user_id} not found")
    return user


@app.post("/mock/users", status_code=201)
def mock_create_user(payload: dict = Body(...)):
    new_id = max(MOCK_USERS) + 1
    user = {"id": new_id, **payload}
    MOCK_USERS[new_id] = user
    return user


@app.put("/mock/users/{user_id}")
def mock_update_user(user_id: int, payload: dict = Body(...)):
    if user_id not in MOCK_USERS:
        raise HTTPException(status_code=404, detail=f"user {user_id} not found")
    MOCK_USERS[user_id] = {**MOCK_USERS[user_id], **payload, "id": user_id}
    return MOCK_USERS[user_id]


@app.delete("/mock/users/{user_id}", status_code=204)
def mock_delete_user(user_id: int):
    MOCK_USERS.pop(user_id, None)
    return Response(status_code=204)


@app.get("/mock/products")
def mock_list_products(category: Optional[str] = None):
    products = [p for p in MOCK_PRODUCTS if category is None or p["category"] == category]
    return {"products": products, "total": len(products)}


@app.post("/mock/auth/login")
def mock_login(payload: dict = Body(...)):
    if payload.get("username") == "bruno" and payload.get("password") == "secret":
        return {"token": MOCK_TOKEN, "tokenType": "Bearer", "expiresIn": 3600}
    raise HTTPException(status_code=401, detail="invalid credentials — try bruno / secret")


@app.get("/mock/auth/me")
def mock_me(authorization: Optional[str] = Header(None)):
    if authorization != f"Bearer {MOCK_TOKEN}":
        raise HTTPException(status_code=401, detail="missing or invalid bearer token — login first")
    return {"id": 1, "name": "Ada Lovelace", "email": "ada@example.com", "role": "admin"}


@app.api_route("/mock/echo", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def mock_echo(request: Request):
    body = await request.body()
    try:
        parsed_body: Any = json.loads(body) if body else None
    except ValueError:
        parsed_body = body.decode("utf-8", errors="replace")
    return {
        "method": request.method,
        "url": str(request.url),
        "headers": dict(request.headers),
        "query": dict(request.query_params),
        "body": parsed_body,
    }


@app.get("/mock/status/{code}")
def mock_status(code: int):
    return Response(
        status_code=code,
        content=json.dumps({"requestedStatus": code}),
        media_type="application/json",
    )


@app.get("/mock/delay/{seconds}")
async def mock_delay(seconds: float):
    seconds = min(seconds, 10)
    await asyncio.sleep(seconds)
    return {"delayed": seconds}


# ---------------------------------------------------------------------------
# flowwork mock upstream — serves the collections' localhost:9100 base URLs
# ---------------------------------------------------------------------------

import socket


def _port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex(("127.0.0.1", port)) == 0


@app.on_event("startup")
def start_mock_upstream():
    if not MOCK_ENABLED:
        return
    if _port_in_use(MOCK_PORT):
        print(f"[mock] port {MOCK_PORT} already in use — assuming an external mock upstream is running")
        return

    import uvicorn

    from mock_upstream import app as mock_app

    config = uvicorn.Config(mock_app, host="127.0.0.1", port=MOCK_PORT, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, name="mock-upstream", daemon=True)
    thread.start()
    print(f"[mock] flowwork mock upstream listening on http://127.0.0.1:{MOCK_PORT}")


# ---------------------------------------------------------------------------
# Static bruno-app bundle (mounted last so /api keeps priority)
# ---------------------------------------------------------------------------

if APP_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(APP_DIST), html=True), name="app")
else:
    @app.get("/")
    def missing_bundle():
        return {
            "message": "bruno-app web bundle not found — run `npm run build:web` first, "
            "or use the rsbuild dev server (npm run dev:web) which proxies /api here.",
            "expected": str(APP_DIST),
        }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=PORT)
