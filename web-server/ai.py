"""로컬 AI 브리지 — 이 PC의 `claude` CLI를 Bearer 토큰 인증 REST API로 노출한다.

브라우저(bruno-app 웹 셔틀)가 AI 기능(채팅/스크립트 생성)을 쓸 때 호출하는
임시 백엔드다. 나중에 실제 원격 AI 서비스로 교체할 수 있도록 API 형태는
provider 중립적으로 유지한다: status / generate(단발) / stream(SSE).

토큰은 BRUNO_AI_TOKEN 환경변수(.env)에서 읽고, 없으면 최초 기동 시 생성해
web-server/.env에 저장한 뒤 콘솔에 출력한다.
"""

import asyncio
import json
import os
import secrets
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

SERVER_DIR = Path(__file__).resolve().parent
ENV_FILE = SERVER_DIR / ".env"
# CLI를 레포 밖 빈 디렉터리에서 실행 — 프로젝트 설정/CLAUDE.md가 끼어들지 않게
CLI_WORK_DIR = SERVER_DIR / "scratch" / "ai"
CLI_TIMEOUT_SECONDS = 300
# 브리지 호출은 짧은 코드/문서 생성 위주라 빠르고 저렴한 haiku를 기본으로 쓴다
DEFAULT_MODEL = os.environ.get("BRUNO_AI_MODEL", "haiku")


def _ensure_token() -> str:
    token = os.environ.get("BRUNO_AI_TOKEN", "").strip()
    if token:
        return token
    token = secrets.token_urlsafe(24)
    with ENV_FILE.open("a", encoding="utf-8") as handle:
        handle.write(f"\n# 로컬 AI 브리지(/api/ai/*) 인증 토큰 — Preferences > AI에 입력\nBRUNO_AI_TOKEN={token}\n")
    os.environ["BRUNO_AI_TOKEN"] = token
    print(f"[ai] BRUNO_AI_TOKEN 생성됨 (web-server/.env 저장): {token}")
    return token


class GenerateBody(BaseModel):
    prompt: str
    system: Optional[str] = None
    model: Optional[str] = None


def build_router() -> APIRouter:
    router = APIRouter(prefix="/api/ai")
    token = _ensure_token()
    claude_bin = shutil.which("claude")
    CLI_WORK_DIR.mkdir(parents=True, exist_ok=True)

    if not claude_bin:
        print("[ai] claude CLI를 PATH에서 찾지 못했습니다 — /api/ai/* 호출이 실패합니다")

    def check_auth(request: Request) -> None:
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer ") or auth[len("Bearer "):].strip() != token:
            raise HTTPException(status_code=401, detail="유효하지 않은 AI 토큰입니다")

    def cli_args(body: GenerateBody, output_format: str) -> list[str]:
        # --tools "" : 순수 텍스트 생성만 — CLI가 파일/셸에 손대지 못하게 한다
        args = [claude_bin, "-p", "--tools", "", "--output-format", output_format]
        if output_format == "stream-json":
            args += ["--include-partial-messages", "--verbose"]
        if body.system:
            args += ["--system-prompt", body.system]
        args += ["--model", body.model or DEFAULT_MODEL]
        return args

    async def spawn_cli(body: GenerateBody, output_format: str) -> asyncio.subprocess.Process:
        if not claude_bin:
            raise HTTPException(status_code=503, detail="claude CLI를 찾을 수 없습니다 (PATH 확인)")
        return await asyncio.create_subprocess_exec(
            *cli_args(body, output_format),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=CLI_WORK_DIR,
        )

    @router.get("/status")
    async def status(request: Request) -> dict:
        check_auth(request)
        if not claude_bin:
            return {"ok": False, "error": "claude CLI를 찾을 수 없습니다 (PATH 확인)"}
        return {"ok": True, "backend": "claude-cli"}

    @router.post("/generate")
    async def generate(body: GenerateBody, request: Request) -> dict:
        check_auth(request)
        proc = await spawn_cli(body, "text")
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(body.prompt.encode("utf-8")), timeout=CLI_TIMEOUT_SECONDS
            )
        except asyncio.TimeoutError:
            proc.kill()
            raise HTTPException(status_code=504, detail="claude CLI 응답 시간 초과")
        if proc.returncode != 0:
            detail = stderr.decode("utf-8", errors="replace").strip()[:500]
            raise HTTPException(status_code=502, detail=f"claude CLI 실패: {detail or 'unknown error'}")
        return {"text": stdout.decode("utf-8", errors="replace")}

    @router.post("/stream")
    async def stream(body: GenerateBody, request: Request) -> StreamingResponse:
        check_auth(request)
        proc = await spawn_cli(body, "stream-json")

        def sse(payload: dict) -> str:
            return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

        async def event_stream():
            full_text = ""
            result_text = None
            try:
                proc.stdin.write(body.prompt.encode("utf-8"))
                await proc.stdin.drain()
                proc.stdin.close()

                while True:
                    line = await asyncio.wait_for(proc.stdout.readline(), timeout=CLI_TIMEOUT_SECONDS)
                    if not line:
                        break
                    try:
                        entry = json.loads(line)
                    except ValueError:
                        continue
                    if entry.get("type") == "stream_event":
                        delta = entry.get("event", {}).get("delta", {})
                        if delta.get("type") == "text_delta":
                            text = delta.get("text", "")
                            full_text += text
                            yield sse({"type": "chunk", "text": text})
                    elif entry.get("type") == "result":
                        if entry.get("is_error"):
                            yield sse({"type": "error", "error": str(entry.get("result", "claude CLI error"))})
                            return
                        result_text = entry.get("result")

                if proc.returncode not in (None, 0) and not full_text and not result_text:
                    stderr = (await proc.stderr.read()).decode("utf-8", errors="replace").strip()[:500]
                    yield sse({"type": "error", "error": f"claude CLI 실패: {stderr or 'unknown error'}"})
                    return
                yield sse({"type": "done", "fullText": full_text or (result_text or "")})
            except asyncio.TimeoutError:
                yield sse({"type": "error", "error": "claude CLI 응답 시간 초과"})
            finally:
                if proc.returncode is None:
                    proc.kill()

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    return router
