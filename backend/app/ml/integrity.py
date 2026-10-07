from __future__ import annotations

import hashlib
from pathlib import Path


ALGORITHM = 'SHA-256'


def hash_file(path: str | Path, chunk_size: int = 1024 * 1024) -> str:
    """Return the SHA-256 digest of a file's bytes."""
    digest = hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda: source.read(chunk_size), b''):
            digest.update(chunk)
    return digest.hexdigest()


def verify_file(path: str | Path, expected_hash: str) -> bool:
    """Compare a file's SHA-256 digest with a stored hexadecimal digest."""
    return hash_file(path).casefold() == expected_hash.strip().casefold()
