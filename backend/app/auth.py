"""Small, dependency-free authentication and authorization primitives."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from app.config import settings


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt$16384$8$1${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, n, r, p, salt, expected = encoded.split('$')
        if algorithm != 'scrypt':
            return False
        actual = hashlib.scrypt(
            password.encode(), salt=_unb64(salt), n=int(n), r=int(r), p=int(p)
        )
        return hmac.compare_digest(actual, _unb64(expected))
    except (ValueError, TypeError):
        return False


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip('=')


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + '=' * (-len(value) % 4))


def create_access_token(subject: int, role: str) -> tuple[str, int]:
    now = int(time.time())
    expires = now + settings.auth_token_minutes * 60
    header = {'alg': 'HS256', 'typ': 'JWT'}
    payload = {'sub': str(subject), 'role': role, 'iat': now, 'exp': expires}
    encoded = '.'.join(_b64(json.dumps(part, separators=(',', ':')).encode()) for part in (header, payload))
    signature = hmac.new(settings.auth_secret.encode(), encoded.encode(), hashlib.sha256).digest()
    return f'{encoded}.{_b64(signature)}', expires


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        encoded_header, encoded_payload, encoded_signature = token.split('.')
        signed = f'{encoded_header}.{encoded_payload}'
        expected = hmac.new(settings.auth_secret.encode(), signed.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _unb64(encoded_signature)):
            return None
        payload = json.loads(_unb64(encoded_payload))
        if int(payload.get('exp', 0)) <= int(time.time()):
            return None
        return payload
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


PERMISSIONS: dict[str, set[str]] = {
    'MINISTRY': {'projects:read', 'audit:write', 'dataset:upload', 'analysis:read', 'analysis:manage', 'users:manage', 'audit:integrity', 'security:read', 'security:manage'},
    'STATE_NODAL_AUTHORITY': {'projects:read', 'audit:write', 'dataset:upload', 'analysis:read', 'users:manage:lower', 'security:read'},
    'DISTRICT_AUTHORITY': {'projects:read', 'audit:write', 'dataset:upload', 'analysis:read', 'security:read'},
    'MEMBER_OF_PARLIAMENT': {'projects:read', 'analysis:read'},
}


def has_permission(user: dict[str, Any], permission: str) -> bool:
    role = user.get('role')
    if permission == 'users:manage' and role == 'STATE_NODAL_AUTHORITY':
        return bool(settings.state_can_provision_users)
    return permission in PERMISSIONS.get(role, set())
