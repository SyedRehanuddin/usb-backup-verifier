"""Backup verification against a trusted CRC-32 reference manifest."""

from datetime import datetime, timezone
from pathlib import PurePosixPath
from typing import BinaryIO, Mapping, Sequence

from app.core.crc32 import crc32_stream_details
from app.core.manifest import (
    ManifestValidationError,
    normalize_relative_path,
    normalize_source_name,
)


STATUS_KEYS = ("verified", "corrupted", "missing", "extra")


def _path_sort_key(relative_path: str) -> tuple[str, str]:
    """Sort paths case-insensitively with their exact value as a stable fallback."""
    return relative_path.casefold(), relative_path


def _index_records(
    records: Sequence[Mapping[str, object]],
    *,
    record_kind: str,
) -> dict[str, dict[str, str | int]]:
    """Validate and index normalized records by their full relative path."""
    indexed: dict[str, dict[str, str | int]] = {}
    seen_paths: set[str] = set()

    for record in records:
        try:
            raw_path = record["relative_path"]
            raw_crc32 = record["crc32"]
            raw_size = record["size_bytes"]
        except KeyError as exc:
            raise ValueError(f"Invalid {record_kind} record.") from exc

        if not isinstance(raw_path, str):
            raise ValueError(f"Invalid {record_kind} record.")
        # Stored records are already root-relative. A sentinel ensures validation
        # cannot accidentally strip a content folder that matches a root name.
        relative_path = normalize_relative_path(raw_path, "__stored_root__")
        duplicate_key = relative_path.casefold()
        if duplicate_key in seen_paths:
            raise ManifestValidationError("Duplicate relative path detected.")
        seen_paths.add(duplicate_key)

        if (
            not isinstance(raw_crc32, str)
            or len(raw_crc32) != 8
            or any(character not in "0123456789ABCDEFabcdef" for character in raw_crc32)
            or not isinstance(raw_size, int)
            or isinstance(raw_size, bool)
            or raw_size < 0
        ):
            raise ValueError(f"Invalid {record_kind} record.")

        indexed[relative_path] = {
            "relative_path": relative_path,
            "crc32": raw_crc32.upper(),
            "size_bytes": raw_size,
        }

    return indexed


def build_backup_records(
    backup_name: str,
    relative_paths: Sequence[str],
    streams: Sequence[BinaryIO],
) -> list[dict[str, str | int]]:
    """Calculate transient CRC-32 metadata for uploaded backup streams."""
    normalized_backup_name = normalize_source_name(backup_name)
    if len(relative_paths) != len(streams):
        raise ManifestValidationError("File and relative path counts must match.")
    if not streams:
        raise ManifestValidationError("At least one backup file is required.")

    records: list[dict[str, str | int]] = []
    seen_paths: set[str] = set()

    for raw_path, stream in zip(relative_paths, streams, strict=True):
        relative_path = normalize_relative_path(raw_path, normalized_backup_name)
        duplicate_key = relative_path.casefold()
        if duplicate_key in seen_paths:
            raise ManifestValidationError("Duplicate relative path detected.")
        seen_paths.add(duplicate_key)

        stream.seek(0)
        checksum, size_bytes = crc32_stream_details(stream)
        records.append(
            {
                "relative_path": relative_path,
                "crc32": checksum,
                "size_bytes": size_bytes,
            }
        )

    records.sort(key=lambda record: _path_sort_key(str(record["relative_path"])))
    return records


def compare_records(
    reference_records: Sequence[Mapping[str, object]],
    backup_records: Sequence[Mapping[str, object]],
) -> dict[str, object]:
    """Compare clean reference and backup records and classify every path."""
    reference_index = _index_records(reference_records, record_kind="reference")
    backup_index = _index_records(backup_records, record_kind="backup")
    all_paths = sorted(
        reference_index.keys() | backup_index.keys(),
        key=_path_sort_key,
    )

    summary = {status: 0 for status in STATUS_KEYS}
    results: list[dict[str, str | int | None]] = []

    for relative_path in all_paths:
        source = reference_index.get(relative_path)
        backup = backup_index.get(relative_path)

        if source is None:
            status = "extra"
        elif backup is None:
            status = "missing"
        elif (
            source["crc32"] == backup["crc32"]
            and source["size_bytes"] == backup["size_bytes"]
        ):
            status = "verified"
        else:
            status = "corrupted"

        summary[status] += 1
        results.append(
            {
                "status": status,
                "file": PurePosixPath(relative_path).name,
                "relative_path": relative_path,
                "source_crc32": source["crc32"] if source else None,
                "backup_crc32": backup["crc32"] if backup else None,
                "source_size_bytes": source["size_bytes"] if source else None,
                "backup_size_bytes": backup["size_bytes"] if backup else None,
            }
        )

    summary["total_results"] = len(results)
    return {"summary": summary, "results": results}


def verify_backup(
    reference_manifest: Mapping[str, object],
    backup_name: str,
    relative_paths: Sequence[str],
    streams: Sequence[BinaryIO],
    *,
    checked_at: str | None = None,
) -> dict[str, object]:
    """Calculate backup records and return a complete verification response."""
    source_name = reference_manifest.get("source_name")
    reference_files = reference_manifest.get("files")
    if not isinstance(source_name, str) or not isinstance(reference_files, list):
        raise ValueError("Invalid reference manifest.")

    normalized_backup_name = normalize_source_name(backup_name)
    backup_records = build_backup_records(
        normalized_backup_name,
        relative_paths,
        streams,
    )
    comparison = compare_records(reference_files, backup_records)
    timestamp = checked_at or (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )

    return {
        "status": "ok",
        "reference_source": source_name,
        "backup_name": normalized_backup_name,
        "checked_at": timestamp,
        **comparison,
    }
