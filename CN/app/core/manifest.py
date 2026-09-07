"""Trusted-source reference manifest creation and persistence."""

import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import BinaryIO, Mapping, Sequence

from app.core.crc32 import crc32_stream_details


MANIFEST_VERSION = 1
ALGORITHM = "CRC-32"


class ManifestValidationError(ValueError):
    """Raised when untrusted manifest metadata is invalid or ambiguous."""


def normalize_source_name(source_name: str) -> str:
    """Validate and return a single safe top-level folder name."""
    normalized = source_name.strip()
    if (
        not normalized
        or normalized in {".", ".."}
        or "/" in normalized
        or "\\" in normalized
        or "\x00" in normalized
        or re.match(r"^[A-Za-z]:", normalized)
    ):
        raise ManifestValidationError("Invalid source folder name.")
    return normalized


def normalize_relative_path(relative_path: str, source_name: str) -> str:
    """Normalize browser path metadata without allowing traversal or absolutes."""
    if not relative_path or "\x00" in relative_path:
        raise ManifestValidationError("Invalid relative path detected.")

    candidate = relative_path.replace("\\", "/")
    if candidate.startswith("/") or re.match(r"^[A-Za-z]:", candidate):
        raise ManifestValidationError("Invalid relative path detected.")

    parts = candidate.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise ManifestValidationError("Invalid relative path detected.")

    if parts and parts[0].casefold() == source_name.casefold():
        parts = parts[1:]

    if not parts:
        raise ManifestValidationError("Invalid relative path detected.")

    normalized_path = "/".join(parts)
    if re.match(r"^[A-Za-z]:", normalized_path):
        raise ManifestValidationError("Invalid relative path detected.")
    return normalized_path


def build_manifest(
    source_name: str,
    relative_paths: Sequence[str],
    streams: Sequence[BinaryIO],
    *,
    created_at: str | None = None,
) -> dict[str, object]:
    """Build a deterministic CRC-32 manifest from browser-provided streams."""
    normalized_source = normalize_source_name(source_name)
    if len(relative_paths) != len(streams):
        raise ManifestValidationError("File and relative path counts must match.")
    if not streams:
        raise ManifestValidationError("At least one source file is required.")

    records: list[dict[str, str | int]] = []
    seen_paths: set[str] = set()

    for raw_path, stream in zip(relative_paths, streams, strict=True):
        normalized_path = normalize_relative_path(raw_path, normalized_source)
        duplicate_key = normalized_path.casefold()
        if duplicate_key in seen_paths:
            raise ManifestValidationError("Duplicate relative path detected.")
        seen_paths.add(duplicate_key)

        stream.seek(0)
        checksum, size_bytes = crc32_stream_details(stream)
        records.append(
            {
                "relative_path": normalized_path,
                "size_bytes": size_bytes,
                "crc32": checksum,
            }
        )

    records.sort(key=lambda record: str(record["relative_path"]))
    timestamp = created_at or (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )

    return {
        "manifest_version": MANIFEST_VERSION,
        "algorithm": ALGORITHM,
        "source_name": normalized_source,
        "created_at": timestamp,
        "file_count": len(records),
        "total_size_bytes": sum(int(record["size_bytes"]) for record in records),
        "files": records,
    }


def save_manifest_atomic(manifest: dict[str, object], destination: Path) -> None:
    """Atomically replace the current manifest with formatted UTF-8 JSON."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=destination.parent,
            prefix=f".{destination.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            json.dump(manifest, temporary_file, indent=2, ensure_ascii=False)
            temporary_file.write("\n")
            temporary_file.flush()
            os.fsync(temporary_file.fileno())

        os.replace(temporary_path, destination)
    except Exception:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        raise


def validate_manifest_document(value: object) -> dict[str, object]:
    """Validate and return a clean, whitelisted stored manifest."""
    if not isinstance(value, Mapping):
        raise ManifestValidationError("Stored reference manifest is invalid.")

    source_name = value.get("source_name")
    created_at = value.get("created_at")
    file_count = value.get("file_count")
    total_size_bytes = value.get("total_size_bytes")
    files = value.get("files")
    try:
        normalized_source = (
            normalize_source_name(source_name)
            if isinstance(source_name, str)
            else None
        )
    except ManifestValidationError as exc:
        raise ManifestValidationError("Stored reference manifest is invalid.") from exc
    if (
        value.get("manifest_version") != MANIFEST_VERSION
        or value.get("algorithm") != ALGORITHM
        or not isinstance(source_name, str)
        or normalized_source != source_name
        or not isinstance(created_at, str)
        or not created_at.endswith("Z")
        or not isinstance(file_count, int)
        or isinstance(file_count, bool)
        or file_count < 1
        or not isinstance(total_size_bytes, int)
        or isinstance(total_size_bytes, bool)
        or total_size_bytes < 0
        or not isinstance(files, list)
        or len(files) != file_count
    ):
        raise ManifestValidationError("Stored reference manifest is invalid.")

    try:
        datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ManifestValidationError("Stored reference manifest is invalid.") from exc

    cleaned_files: list[dict[str, str | int]] = []
    seen_paths: set[str] = set()
    for record in files:
        if not isinstance(record, Mapping):
            raise ManifestValidationError("Stored reference manifest is invalid.")
        relative_path = record.get("relative_path")
        size_bytes = record.get("size_bytes")
        crc32 = record.get("crc32")
        if not isinstance(relative_path, str):
            raise ManifestValidationError("Stored reference manifest is invalid.")
        try:
            normalized_path = normalize_relative_path(relative_path, "__stored_root__")
        except ManifestValidationError as exc:
            raise ManifestValidationError("Stored reference manifest is invalid.") from exc
        duplicate_key = normalized_path.casefold()
        if (
            normalized_path != relative_path
            or duplicate_key in seen_paths
            or not isinstance(size_bytes, int)
            or isinstance(size_bytes, bool)
            or size_bytes < 0
            or not isinstance(crc32, str)
            or len(crc32) != 8
            or any(character not in "0123456789ABCDEFabcdef" for character in crc32)
        ):
            raise ManifestValidationError("Stored reference manifest is invalid.")
        seen_paths.add(duplicate_key)
        cleaned_files.append(
            {
                "relative_path": normalized_path,
                "size_bytes": size_bytes,
                "crc32": crc32.upper(),
            }
        )

    if sum(record["size_bytes"] for record in cleaned_files) != total_size_bytes:
        raise ManifestValidationError("Stored reference manifest is invalid.")

    cleaned_files.sort(key=lambda record: str(record["relative_path"]))
    return {
        "manifest_version": MANIFEST_VERSION,
        "algorithm": ALGORITHM,
        "source_name": source_name,
        "created_at": created_at,
        "file_count": file_count,
        "total_size_bytes": total_size_bytes,
        "files": cleaned_files,
    }


def load_manifest(source: Path) -> dict[str, object] | None:
    """Load a validated current manifest, or return None when absent."""
    if not source.exists():
        return None
    with source.open("r", encoding="utf-8") as manifest_file:
        loaded = json.load(manifest_file)
    return validate_manifest_document(loaded)
