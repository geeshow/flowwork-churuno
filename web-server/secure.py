"""값 단위 암호화(enc:v1:...) — 키는 서버에만 있고, git에는 암호문만 남는다.

계좌번호처럼 자주 바뀌지만 민감한 값을 .bru/워크플로우 파일에 넣을 때 쓴다.
vault://가 서버 보관 정적 시크릿의 "참조"라면, enc:는 값 자체가 파일과 함께
git으로 이동하되 내용만 암호문으로 숨긴다. 복호화는 실제 호출 직전에만
서버가 수행하므로 원격 저장소·실행 기록에는 암호문이 그대로 남는다.

키 우선순위: BRUNO_WEB_ENC_KEY 환경변수 > <server>/.enc-key 파일(없으면 생성).
"""

import os
import re
from pathlib import Path
from typing import Any, Optional

from cryptography.fernet import Fernet, InvalidToken

ENC_PREFIX = "enc:v1:"
# Fernet 토큰은 urlsafe base64 — '=' 패딩까지 포함해 잡는다
ENC_TOKEN_PATTERN = re.compile(r"enc:v1:([A-Za-z0-9_\-]+=*)")


class EncryptionError(Exception):
    pass


_fernet: Optional[Fernet] = None


def _load_key(server_dir: Path) -> bytes:
    env_key = os.environ.get("BRUNO_WEB_ENC_KEY")
    if env_key:
        return env_key.strip().encode()
    key_file = server_dir / ".enc-key"
    if key_file.exists():
        return key_file.read_text(encoding="utf-8").strip().encode()
    key = Fernet.generate_key()
    key_file.write_text(key.decode(), encoding="utf-8")
    key_file.chmod(0o600)
    return key


def init(server_dir: Path) -> None:
    global _fernet
    try:
        _fernet = Fernet(_load_key(server_dir))
    except ValueError as e:
        raise RuntimeError(f"BRUNO_WEB_ENC_KEY가 올바른 Fernet 키가 아닙니다: {e}") from e


def _require_fernet() -> Fernet:
    if _fernet is None:
        raise EncryptionError("암호화 키가 초기화되지 않았습니다")
    return _fernet


def encrypt_value(plain: str) -> str:
    return ENC_PREFIX + _require_fernet().encrypt(plain.encode("utf-8")).decode("ascii")


def _decrypt_token(token: str) -> str:
    try:
        return _require_fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken as e:
        raise EncryptionError("암호화된 값을 복호화할 수 없습니다 (키 불일치 또는 손상된 값)") from e


def decrypt_enc_deep(obj: Any) -> Any:
    """문자열 안의 enc:v1: 토큰을 재귀적으로 평문 치환. 토큰이 없으면 그대로."""
    if isinstance(obj, str):
        return ENC_TOKEN_PATTERN.sub(lambda m: _decrypt_token(m.group(1)), obj)
    if isinstance(obj, dict):
        return {k: decrypt_enc_deep(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [decrypt_enc_deep(v) for v in obj]
    return obj


def decrypt_bytes(data: bytes) -> bytes:
    """UTF-8 본문 안의 enc 토큰 치환 — 토큰이 없거나 텍스트가 아니면 그대로."""
    if b"enc:v1:" not in data:
        return data
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return data
    return decrypt_enc_deep(text).encode("utf-8")
