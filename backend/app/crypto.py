"""Application-level authenticated encryption for future sensitive values."""
from __future__ import annotations

import base64
import binascii
import json
import os
from dataclasses import dataclass
from typing import Mapping

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


ALGORITHM = 'AES-256-GCM'
NONCE_BYTES = 12
KEY_BYTES = 32
ENVELOPE_VERSION = 1


class EncryptionConfigurationError(ValueError):
    """Raised when encryption configuration is absent or invalid."""


class EncryptedValueError(ValueError):
    """Raised when an encrypted value cannot be safely decrypted."""


@dataclass(frozen=True)
class EncryptionKey:
    version: str
    material: bytes


def _decode_key(value: str, version: str) -> bytes:
    try:
        material = base64.urlsafe_b64decode(value.strip() + '=' * (-len(value.strip()) % 4))
    except (binascii.Error, ValueError) as exc:
        raise EncryptionConfigurationError(f'Invalid encryption key configuration for version {version}.') from exc
    if len(material) != KEY_BYTES:
        raise EncryptionConfigurationError(f'Invalid encryption key length for version {version}.')
    return material


def _configured_keys(environ: Mapping[str, str]) -> dict[str, EncryptionKey]:
    active_version = environ.get('APP_ENCRYPTION_KEY_VERSION', '').strip()
    if not active_version:
        raise EncryptionConfigurationError('APP_ENCRYPTION_KEY_VERSION is required.')

    configured: dict[str, str] = {}
    key_set = environ.get('APP_ENCRYPTION_KEYS', '').strip()
    if key_set:
        for entry in key_set.split(','):
            version, separator, encoded_key = entry.partition(':')
            version = version.strip()
            if not separator or not version or not encoded_key.strip() or version in configured:
                raise EncryptionConfigurationError('Invalid APP_ENCRYPTION_KEYS configuration.')
            configured[version] = encoded_key.strip()
    elif environ.get('APP_ENCRYPTION_KEY', '').strip():
        configured[active_version] = environ['APP_ENCRYPTION_KEY'].strip()
    else:
        raise EncryptionConfigurationError('APP_ENCRYPTION_KEY or APP_ENCRYPTION_KEYS is required.')

    keys = {version: EncryptionKey(version, _decode_key(value, version)) for version, value in configured.items()}
    if active_version not in keys:
        raise EncryptionConfigurationError('The active encryption key version is not configured.')
    return keys


def _active_key(environ: Mapping[str, str]) -> EncryptionKey:
    active_version = environ.get('APP_ENCRYPTION_KEY_VERSION', '').strip()
    return _configured_keys(environ)[active_version]


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode('ascii').rstrip('=')


def _decode(value: object, field: str) -> bytes:
    if not isinstance(value, str) or not value:
        raise EncryptedValueError(f'Encrypted envelope has an invalid {field}.')
    try:
        normalized = value + '=' * (-len(value) % 4)
        decoded = base64.urlsafe_b64decode(normalized)
        if _encode(decoded) != value.rstrip('='):
            raise ValueError('non-canonical base64')
        return decoded
    except (binascii.Error, ValueError) as exc:
        raise EncryptedValueError(f'Encrypted envelope has an invalid {field}.') from exc


def encrypt_value(value: str | bytes, environ: Mapping[str, str] | None = None) -> str:
    """Encrypt a string or byte value and return a stable JSON envelope."""
    if not isinstance(value, (str, bytes)):
        raise TypeError('Encrypted values must be strings or bytes.')
    environment = environ if environ is not None else os.environ
    key = _active_key(environment)
    plaintext = value.encode('utf-8') if isinstance(value, str) else value
    nonce = os.urandom(NONCE_BYTES)
    ciphertext = AESGCM(key.material).encrypt(nonce, plaintext, None)
    return json.dumps({
        'version': key.version,
        'algorithm': ALGORITHM,
        'nonce': _encode(nonce),
        'ciphertext': _encode(ciphertext),
    }, sort_keys=True, separators=(',', ':'))


def decrypt_value(envelope: str, environ: Mapping[str, str] | None = None) -> bytes:
    """Authenticate and decrypt an encrypted JSON envelope."""
    if not isinstance(envelope, str):
        raise EncryptedValueError('Encrypted envelope must be a string.')
    try:
        payload = json.loads(envelope)
    except (json.JSONDecodeError, TypeError) as exc:
        raise EncryptedValueError('Encrypted envelope is malformed.') from exc
    if (
        not isinstance(payload, dict)
        or not isinstance(payload.get('version'), str)
        or payload.get('algorithm') != ALGORITHM
    ):
        raise EncryptedValueError('Encrypted envelope is unsupported.')
    environment = environ if environ is not None else os.environ
    keys = _configured_keys(environment)
    key = keys.get(payload['version'])
    if key is None:
        raise EncryptedValueError('Encrypted envelope key version is unavailable.')
    nonce = _decode(payload.get('nonce'), 'nonce')
    if len(nonce) != NONCE_BYTES:
        raise EncryptedValueError('Encrypted envelope has an invalid nonce.')
    ciphertext = _decode(payload.get('ciphertext'), 'ciphertext')
    try:
        return AESGCM(key.material).decrypt(nonce, ciphertext, None)
    except InvalidTag as exc:
        raise EncryptedValueError('Encrypted value authentication failed.') from exc