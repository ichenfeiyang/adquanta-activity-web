#!/usr/bin/env python3
"""Deploy the Vite dist directory to an S3-compatible object store."""

from __future__ import annotations

import hashlib
import mimetypes
import os
from pathlib import Path
from typing import Iterator


ROOT_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT_DIR / "dist"
CONTENT_TYPE_MAP = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".xml": "application/xml",
    ".txt": "text/plain",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
}
VALID_ADDRESSING_STYLES = {"auto", "path", "virtual"}


def get_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def get_addressing_style() -> str:
    value = os.environ.get("STORAGE_ADDRESSING_STYLE", "auto").strip().lower()
    if value not in VALID_ADDRESSING_STYLES:
        allowed = ", ".join(sorted(VALID_ADDRESSING_STYLES))
        raise RuntimeError(
            f"Invalid STORAGE_ADDRESSING_STYLE: {value!r}; expected one of {allowed}"
        )
    return value


def build_client():
    # Imported lazily so the pure deployment helpers can be tested without
    # installing boto3 first.
    import boto3
    from botocore.client import Config

    return boto3.client(
        "s3",
        aws_access_key_id=get_env("STORAGE_ACCESS_KEY_ID"),
        aws_secret_access_key=get_env("STORAGE_SECRET_ACCESS_KEY"),
        endpoint_url=get_env("STORAGE_ENDPOINT"),
        region_name=get_env("STORAGE_REGION"),
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 5, "mode": "standard"},
            s3={"addressing_style": get_addressing_style()},
        ),
    )


def iter_upload_files(dist_dir: Path = DIST_DIR) -> Iterator[tuple[Path, str]]:
    if not dist_dir.is_dir():
        raise RuntimeError("dist/ not found; run `npm run build` before deploying")

    targets = [
        (path, path.relative_to(dist_dir).as_posix())
        for path in dist_dir.rglob("*")
        if path.is_file()
    ]
    # Publish the entry document last. If an asset upload fails, clients keep
    # receiving the previous index instead of a partially published release.
    targets.sort(key=lambda item: (item[1] == "index.html", item[1]))
    yield from targets


def guess_content_type(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in CONTENT_TYPE_MAP:
        return CONTENT_TYPE_MAP[suffix]

    content_type, _ = mimetypes.guess_type(path.name)
    return content_type or "application/octet-stream"


def get_cache_control(path: Path) -> str:
    return (
        "no-cache"
        if path.suffix.lower() == ".html"
        else "public, max-age=31536000, immutable"
    )


def build_object_key(key_prefix: str, relative_key: str) -> str:
    clean_prefix = key_prefix.strip().strip("/")
    clean_relative_key = relative_key.lstrip("/")
    return (
        f"{clean_prefix}/{clean_relative_key}"
        if clean_prefix
        else clean_relative_key
    )


def calc_md5(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as file_obj:
        for chunk in iter(lambda: file_obj.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def upload_file(
    s3_client,
    bucket: str,
    key_prefix: str,
    path: Path,
    relative_key: str,
) -> str:
    object_key = build_object_key(key_prefix, relative_key)
    content_type = guess_content_type(path)
    cache_control = get_cache_control(path)

    with path.open("rb") as file_obj:
        s3_client.put_object(
            Bucket=bucket,
            Key=object_key,
            Body=file_obj,
            ContentType=content_type,
            CacheControl=cache_control,
        )

    print(
        f"uploaded {relative_key} -> {object_key} "
        f"({content_type}, cache={cache_control}, md5={calc_md5(path)})"
    )
    return object_key


def main():
    provider = os.environ.get("STORAGE_PROVIDER", "object storage").strip()
    bucket = get_env("STORAGE_BUCKET")
    key_prefix = os.environ.get("STORAGE_KEY_PREFIX", "").strip().strip("/")
    public_url = os.environ.get("STORAGE_PUBLIC_URL", "").strip().rstrip("/")

    upload_targets = list(iter_upload_files())
    if not upload_targets:
        raise RuntimeError("No deployable files found under dist/")

    s3_client = build_client()
    uploaded_keys = [
        upload_file(s3_client, bucket, key_prefix, path, relative_key)
        for path, relative_key in upload_targets
    ]

    print(
        f"uploaded {len(uploaded_keys)} files from dist/ "
        f"to {provider} bucket {bucket}"
    )
    if public_url:
        index_key = next(
            (key for key in uploaded_keys if key.endswith("/index.html") or key == "index.html"),
            uploaded_keys[-1],
        )
        print(f"entry url: {public_url}/{index_key}")


if __name__ == "__main__":
    main()
