"""flowwork 워크플로우 편집 git 연산 — "변경"과 "운영 반영" 두 개념만 노출한다.

운영 트리(REPO_DIR = main 체크아웃)는 읽기 전용이고, 편집은 공용 편집
브랜치(EDIT_BASE_BRANCH, 기본 develop)의 전용 worktree에서 이뤄진다:

    {EDIT_DIR}/develop  ← 편집 worktree (저장 = 즉시 커밋 + 원격 push)

  - 저장/삭제 = 편집 worktree 쓰기 + autocommit (사용자에게 git 단계를 묻지 않는다)
  - 변경 목록 = main과 편집 브랜치의 tip 간 파일 diff (pending_for_prod)
  - 운영 반영 = 선택한 파일만 main에 반영(체리픽) + push (release_paths)
    — tip 간 비교라 반영된 파일은 변경 목록에서 자연히 사라진다
  - 되돌리기 = 편집 worktree의 파일을 main 버전으로 복원 + autocommit (revert_paths)
  - 문서(Docs)만은 예외로 운영 트리에서 바로 쓰고 기록한다 (commit_prod_path)

원격 push는 오프라인에서도 동작하도록 best-effort로 처리하고,
BRUNO_WEB_GIT_PUSH=0 이면 원격 반영을 모두 생략한다.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any, Optional

SERVER_DIR = Path(__file__).resolve().parent
REPO_DIR = Path(os.environ.get("BRUNO_WEB_REPO_DIR", SERVER_DIR / "repo")).resolve()
EDIT_DIR = Path(os.environ.get("BRUNO_WEB_EDIT_DIR", SERVER_DIR / "edit-worktrees")).resolve()
EDIT_BASE_BRANCH = os.environ.get("BRUNO_WEB_EDIT_BASE_BRANCH", "develop")
GIT_PUSH = os.environ.get("BRUNO_WEB_GIT_PUSH", "1") == "1"

# 편집/운영 반영 대상 경로 — 이 밖의 파일은 이 흐름으로 손대지 않는다
EDITABLE_TOP_PATHS = ("workflows",)
EDITABLE_FILES = ("domains.json",)

# 빈 업무(폴더)를 남기기 위한 표식 — git이 빈 디렉토리를 기록하지 않는다.
# 확장자를 붙이지 않아 워크플로우를 찾는 `*.json` 조회에 걸리지 않는다.
FOLDER_MARKER = ".folder"

# 브랜치명: 영문/숫자/한글/-/_/./ 만 허용, '..'과 선행 '-' 금지 (git 옵션/경로 주입 방지)
BRANCH_NAME_RE = re.compile(r"^[\w가-힣][\w가-힣./-]*$", re.UNICODE)


class GitError(Exception):
    """git 명령 실패 (메시지는 사용자에게 그대로 노출 가능한 수준으로)."""


def check_branch_name(name: str) -> str:
    if not BRANCH_NAME_RE.match(name) or ".." in name:
        raise GitError(f"허용되지 않는 브랜치 이름입니다: {name!r}")
    return name


def edit_worktree_path(branch: Optional[str]) -> Path:
    """브랜치 → 편집 worktree 경로. 브랜치명 검증 포함 ('/'는 '__'로 치환)."""
    b = check_branch_name(branch or EDIT_BASE_BRANCH)
    return EDIT_DIR / b.replace("/", "__")


def _run(*args: str, cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=str(cwd), capture_output=True, text=True)


def _git(*args: str, cwd: Path) -> str:
    proc = _run(*args, cwd=cwd)
    if proc.returncode != 0:
        raise GitError((proc.stderr or proc.stdout).strip() or f"git {' '.join(args)} 실패")
    return proc.stdout


_prod_branch: Optional[str] = None


def prod_branch() -> str:
    """운영 브랜치 = REPO_DIR(운영 트리)에 체크아웃된 브랜치 (보통 main)."""
    global _prod_branch
    if _prod_branch is None:
        _prod_branch = _git("rev-parse", "--abbrev-ref", "HEAD", cwd=REPO_DIR).strip() or "main"
    return _prod_branch


def branch_exists(branch: str) -> bool:
    return _run("rev-parse", "-q", "--verify", f"refs/heads/{branch}", cwd=REPO_DIR).returncode == 0


def ensure_base() -> None:
    """저장소/편집 브랜치/편집 worktree 기본 구성을 보장한다."""
    if not (REPO_DIR / ".git").exists():
        raise GitError(f"데이터 디렉토리가 git 저장소가 아닙니다: {REPO_DIR}")
    if not branch_exists(EDIT_BASE_BRANCH):
        _git("branch", EDIT_BASE_BRANCH, prod_branch(), cwd=REPO_DIR)
    ensure_worktree(EDIT_BASE_BRANCH)


def ensure_worktree(branch: Optional[str] = None) -> Path:
    """브랜치 전용 worktree 경로 (없으면 생성)."""
    b = check_branch_name(branch or EDIT_BASE_BRANCH)
    path = edit_worktree_path(b)
    if (path / ".git").is_file():
        return path
    if not (REPO_DIR / ".git").exists():
        raise GitError(f"데이터 디렉토리가 git 저장소가 아닙니다: {REPO_DIR}")
    if b == EDIT_BASE_BRANCH and not branch_exists(b):
        _git("branch", EDIT_BASE_BRANCH, prod_branch(), cwd=REPO_DIR)
    if not branch_exists(b):
        raise GitError(f"브랜치가 없습니다: {b}")
    path.parent.mkdir(parents=True, exist_ok=True)
    _run("worktree", "prune", cwd=REPO_DIR)  # 지워진 worktree 등록 정리
    _git("worktree", "add", str(path), b, cwd=REPO_DIR)
    return path


def _push_best_effort(branch: str, cwd: Path) -> bool:
    if not GIT_PUSH:
        return False
    return _run("push", "-u", "origin", branch, cwd=cwd).returncode == 0


def commit_prod_path(path: str, message: str) -> bool:
    """운영 트리의 파일 하나를 그 자리에서 기록(커밋 + push)한다.

    운영은 읽기 전용이지만 문서(Docs)만은 예외로 여기서 직접 쓴다 — 워크플로우의
    동작이 아니라 설명이라 운영 반영 절차를 거칠 이유가 없다. 경로 하나만 stage·커밋
    하므로 운영 트리에 다른 작업이 걸려 있어도 그것까지 딸려 들어가지 않는다.
    """
    _check_editable_path(path)
    if not (REPO_DIR / ".git").exists():
        raise GitError(f"데이터 디렉토리가 git 저장소가 아닙니다: {REPO_DIR}")
    _git("add", "--", path, cwd=REPO_DIR)
    if not _git("diff", "--cached", "--name-only", "--", path, cwd=REPO_DIR).strip():
        return False
    _git("commit", "-m", message, "--", path, cwd=REPO_DIR)
    if GIT_PUSH:
        _run("push", "origin", prod_branch(), cwd=REPO_DIR)
    return True


def autocommit(message: str, branch: Optional[str] = None) -> bool:
    """저장/삭제 직후 호출 — 변경이 있으면 커밋 + 원격 push(best-effort).

    사용자에게 stage/commit 단계를 노출하지 않기 위한 것으로, 편집 worktree의
    모든 변경을 한 커밋으로 기록한다. 변경이 없으면 False.
    """
    b = check_branch_name(branch or EDIT_BASE_BRANCH)
    wt = ensure_worktree(b)
    _git("add", "-A", cwd=wt)
    if not _git("diff", "--cached", "--name-only", cwd=wt).strip():
        return False
    _git("commit", "-m", message, cwd=wt)
    _push_best_effort(b, wt)
    return True


# ---------------------------------------------------------------------------
# 변경 목록 / 파일 요약
# ---------------------------------------------------------------------------
def _diff_names(*args: str, cwd: Path) -> dict[str, str]:
    """`diff --name-status -z <args>` → {path: A|M|D}."""
    raw = _git("diff", "--name-status", "-z", *args, cwd=cwd)
    fields = raw.split("\0")
    out: dict[str, str] = {}
    i = 0
    while i + 1 < len(fields):
        code = fields[i]
        if not code:
            i += 1
            continue
        if code[0] in "RC":  # R100 old new
            out[fields[i + 2]] = "M"
            i += 3
        else:
            out[fields[i + 1]] = code[0]
            i += 2
    return out


def _read_blob(ref: str, path: str, cwd: Path) -> Optional[str]:
    proc = _run("show", f"{ref}:{path}", cwd=cwd)
    return proc.stdout if proc.returncode == 0 else None


def _summarize(path: str, content: Optional[str]) -> dict[str, Any]:
    """데이터 파일 경로 → 표시용 요약. 워크플로우 파일이면 도메인/업무/이름 포함."""
    entry: dict[str, Any] = {"path": path, "kind": "file"}
    parts = Path(path).parts
    data: dict[str, Any] = {}
    if content:
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            data = {}
    # 빈 업무 표식은 파일이 아니라 "업무" 자체가 생기고 없어진 것으로 보여준다
    if parts[0] == "workflows" and parts[-1] == FOLDER_MARKER and len(parts) >= 3:
        entry.update(kind="task", domain=parts[1], task="/".join(parts[2:-1]))
        entry.update(name=f"{entry['domain']} / {entry['task']} (업무)")
    # workflows/<도메인>/<업무…>/<id>.json — 업무는 하위 업무를 가질 수 있어 깊이가 열려 있다
    elif parts[0] == "workflows" and len(parts) >= 4:
        entry.update(
            kind="workflow", domain=parts[1], task="/".join(parts[2:-1]), id=Path(path).stem
        )
        entry.update(
            id=data.get("id", entry["id"]),
            domain=data.get("domain", entry["domain"]),
            task=data.get("task", entry["task"]),
            name=data.get("name", entry["id"]),
        )
    elif path == "domains.json":
        entry.update(name="도메인 색상")
    return entry


def pending_for_prod() -> dict[str, Any]:
    """편집 브랜치에는 있지만 운영(main)에 아직 반영되지 않은 변경 목록.

    tip 간 비교라, 파일 단위 운영 반영(release_paths)으로 내용이 같아진 파일은
    목록에서 자연히 사라진다.
    """
    ensure_base()
    changed = _diff_names(prod_branch(), EDIT_BASE_BRANCH, cwd=REPO_DIR)
    files = []
    for path, change in sorted(changed.items()):
        # 컬렉션 쪽 변경(bruno 워크스페이스가 main에 반영한 .yml 등)은 이 흐름의
        # 대상이 아니다 — 목록에 두면 운영 반영을 눌러도 거부당한다
        if not _is_editable_path(path):
            continue
        content = _read_blob(EDIT_BASE_BRANCH, path, cwd=REPO_DIR)
        if content is None:  # 편집 브랜치에서 삭제된 파일은 main 기준으로 요약
            content = _read_blob(prod_branch(), path, cwd=REPO_DIR)
        entry = _summarize(path, content)
        entry["change"] = change
        files.append(entry)
    return {"prod_branch": prod_branch(), "base_branch": EDIT_BASE_BRANCH, "files": files}


def _is_editable_path(path: str) -> bool:
    """이 흐름이 다루는 워크플로우 데이터인지 (컬렉션 파일 등은 대상 밖)."""
    parts = Path(path).parts
    if ".." in parts:
        return False
    return path in EDITABLE_FILES or bool(parts) and parts[0] in EDITABLE_TOP_PATHS


def _check_editable_path(path: str) -> str:
    if not _is_editable_path(path):
        raise GitError(f"API Chain 데이터 밖의 경로는 처리할 수 없습니다: {path!r}")
    return path


# ---------------------------------------------------------------------------
# 운영 반영 / 되돌리기 — 작업(파일) 단위
# ---------------------------------------------------------------------------
def release_paths(paths: list[str]) -> dict[str, Any]:
    """선택한 파일들만 운영(main 트리)에 반영(체리픽)하고 push한다."""
    ensure_base()
    if not paths:
        raise GitError("운영에 반영할 항목을 선택하세요.")
    for p in paths:
        _check_editable_path(p)
    if _git("status", "--porcelain", cwd=REPO_DIR).strip():
        raise GitError("운영 트리에 커밋되지 않은 변경이 있습니다. 잠시 후 다시 시도하세요.")

    for p in paths:
        if _run("cat-file", "-e", f"{EDIT_BASE_BRANCH}:{p}", cwd=REPO_DIR).returncode == 0:
            _git("checkout", EDIT_BASE_BRANCH, "--", p, cwd=REPO_DIR)  # 편집 내용으로 stage+반영
        else:
            _git("rm", "--ignore-unmatch", "-q", "--", p, cwd=REPO_DIR)  # 편집에서 삭제된 파일
    if not _git("diff", "--cached", "--name-only", cwd=REPO_DIR).strip():
        raise GitError("선택한 항목이 운영과 차이가 없습니다.")
    _git("commit", "-m", f"flowwork: 운영 반영 ({len(paths)}건)", cwd=REPO_DIR)
    commit = _git("rev-parse", "--short", prod_branch(), cwd=REPO_DIR).strip()
    pushed = GIT_PUSH and _run("push", "origin", prod_branch(), cwd=REPO_DIR).returncode == 0
    return {"status": "released", "commit": commit, "pushed": pushed, "files": paths}


def revert_paths(paths: list[str]) -> dict[str, Any]:
    """편집 worktree의 파일들을 운영(main) 버전으로 복원하고 autocommit한다."""
    ensure_base()
    if not paths:
        raise GitError("되돌릴 항목을 선택하세요.")
    wt = ensure_worktree(None)
    for p in paths:
        _check_editable_path(p)
        if _run("cat-file", "-e", f"{prod_branch()}:{p}", cwd=wt).returncode == 0:
            _git("checkout", prod_branch(), "--", p, cwd=wt)  # 운영 버전으로 복원
        else:
            target = wt / p
            if target.exists():
                target.unlink()  # 운영에 없는(새로 추가한) 파일은 삭제
    autocommit(f"flowwork: 변경 되돌리기 ({len(paths)}건)")
    return {"status": "reverted", "files": paths}
