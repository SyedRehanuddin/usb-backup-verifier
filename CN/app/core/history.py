"""Atomic persistence for completed standard verification runs."""

import json
import os
import tempfile
from datetime import datetime
from pathlib import Path, PurePosixPath
from threading import Lock
from typing import Mapping
from uuid import uuid4

from app.core.manifest import ManifestValidationError, normalize_source_name


HISTORY_VERSION = 1
MAX_HISTORY_RECORDS = 100
STATUS_KEYS = ("verified", "corrupted", "missing", "extra")
RESULT_FIELDS = (
    "status",
    "file",
    "relative_path",
    "source_crc32",
    "backup_crc32",
    "source_size_bytes",
    "backup_size_bytes",
)
_HISTORY_LOCK = Lock()


class HistoryValidationError(ValueError):
    """Raised when stored or proposed history metadata is unusable."""


def empty_history() -> dict[str, object]:
    """Return a new empty history document."""
    return {"history_version": HISTORY_VERSION, "records": []}


def _validate_timestamp(value: object, field_name: str) -> str:
    if not isinstance(value, str) or not value.endswith("Z"):
        raise HistoryValidationError(f"Invalid {field_name}.")
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HistoryValidationError(f"Invalid {field_name}.") from exc
    return value


def _validate_summary(value: object) -> dict[str, int]:
    if not isinstance(value, Mapping):
        raise HistoryValidationError("Invalid history summary.")
    summary: dict[str, int] = {}
    for key in (*STATUS_KEYS, "total_results"):
        count = value.get(key)
        if not isinstance(count, int) or isinstance(count, bool) or count < 0:
            raise HistoryValidationError("Invalid history summary.")
        summary[key] = count
    if sum(summary[key] for key in STATUS_KEYS) != summary["total_results"]:
        raise HistoryValidationError("Invalid history summary.")
    return summary


def _validate_result(value: object) -> dict[str, str | int | None]:
    if not isinstance(value, Mapping):
        raise HistoryValidationError("Invalid history result row.")
    status = value.get("status")
    file_name = value.get("file")
    relative_path = value.get("relative_path")
    if status not in STATUS_KEYS or not isinstance(file_name, str) or not file_name:
        raise HistoryValidationError("Invalid history result row.")
    if (
        not isinstance(relative_path, str)
        or not relative_path
        or relative_path.startswith(("/", "\\"))
        or ":" in relative_path.split("/")[0]
        or any(part in {"", ".", ".."} for part in relative_path.replace("\\", "/").split("/"))
    ):
        raise HistoryValidationError("Invalid history result row.")

    cleaned: dict[str, str | int | None] = {
        "status": status,
        "file": file_name,
        "relative_path": relative_path.replace("\\", "/"),
    }
    for field in ("source_crc32", "backup_crc32"):
        crc = value.get(field)
        if crc is not None and (
            not isinstance(crc, str)
            or len(crc) != 8
            or any(character not in "0123456789ABCDEFabcdef" for character in crc)
        ):
            raise HistoryValidationError("Invalid history result row.")
        cleaned[field] = crc.upper() if isinstance(crc, str) else None
    for field in ("source_size_bytes", "backup_size_bytes"):
        size = value.get(field)
        if size is not None and (
            not isinstance(size, int) or isinstance(size, bool) or size < 0
        ):
            raise HistoryValidationError("Invalid history result row.")
        cleaned[field] = size
    return {field: cleaned[field] for field in RESULT_FIELDS}


def _validate_record(value: object) -> dict[str, object]:
    if not isinstance(value, Mapping):
        raise HistoryValidationError("Invalid history record.")
    record_id = value.get("id")
    reference_source = value.get("reference_source")
    backup_name = value.get("backup_name")
    reference_created_at = value.get("reference_created_at")
    overall_status = value.get("overall_status")
    results = value.get("results")
    if (
        not isinstance(record_id, str)
        or not record_id
        or not isinstance(reference_source, str)
        or not reference_source
        or not isinstance(backup_name, str)
        or not backup_name
        or overall_status not in {"clean", "issues"}
        or not isinstance(results, list)
    ):
        raise HistoryValidationError("Invalid history record.")
    try:
        if (
            normalize_source_name(reference_source) != reference_source
            or normalize_source_name(backup_name) != backup_name
        ):
            raise HistoryValidationError("Invalid history record.")
    except ManifestValidationError as exc:
        raise HistoryValidationError("Invalid history record.") from exc

    summary = _validate_summary(value.get("summary"))
    cleaned_results = [_validate_result(result) for result in results]
    if any(
        result["file"] != PurePosixPath(str(result["relative_path"])).name
        for result in cleaned_results
    ):
        raise HistoryValidationError("Invalid history record.")
    if len(cleaned_results) != summary["total_results"]:
        raise HistoryValidationError("Invalid history record.")
    expected_overall = "clean" if all(summary[key] == 0 for key in ("corrupted", "missing", "extra")) else "issues"
    if overall_status != expected_overall:
        raise HistoryValidationError("Invalid history record.")

    return {
        "id": record_id,
        "checked_at": _validate_timestamp(value.get("checked_at"), "history timestamp"),
        "reference_source": reference_source,
        "backup_name": backup_name,
        "reference_created_at": _validate_timestamp(reference_created_at, "reference timestamp"),
        "summary": summary,
        "overall_status": overall_status,
        "results": cleaned_results,
    }


def validate_history_document(value: object) -> dict[str, object]:
    """Validate and return a clean, whitelisted history document."""
    if not isinstance(value, Mapping) or value.get("history_version") != HISTORY_VERSION:
        raise HistoryValidationError("Stored verification history is invalid.")
    records = value.get("records")
    if not isinstance(records, list) or len(records) > MAX_HISTORY_RECORDS:
        raise HistoryValidationError("Stored verification history is invalid.")
    cleaned_records = [_validate_record(record) for record in records]
    record_ids = [str(record["id"]) for record in cleaned_records]
    if len(record_ids) != len(set(record_ids)):
        raise HistoryValidationError("Stored verification history is invalid.")
    return {"history_version": HISTORY_VERSION, "records": cleaned_records}


def load_history(source: Path) -> dict[str, object]:
    """Load validated history, or return an empty document when absent."""
    if not source.exists():
        return empty_history()
    try:
        with source.open("r", encoding="utf-8") as history_file:
            loaded = json.load(history_file)
    except (OSError, json.JSONDecodeError) as exc:
        raise HistoryValidationError("Stored verification history is unavailable.") from exc
    return validate_history_document(loaded)


def save_history_atomic(history: Mapping[str, object], destination: Path) -> None:
    """Validate and atomically replace the history JSON document."""
    cleaned = validate_history_document(history)
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
            json.dump(cleaned, temporary_file, indent=2, ensure_ascii=False)
            temporary_file.write("\n")
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        os.replace(temporary_path, destination)
    except Exception:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        raise


def create_history_record(
    verification: Mapping[str, object],
    reference_created_at: str,
    *,
    record_id: str | None = None,
) -> dict[str, object]:
    """Create one whitelisted history record from a verifier response."""
    summary = _validate_summary(verification.get("summary"))
    results = verification.get("results")
    if not isinstance(results, list):
        raise HistoryValidationError("Invalid verification results.")
    issues = sum(summary[key] for key in ("corrupted", "missing", "extra"))
    candidate = {
        "id": record_id or str(uuid4()),
        "checked_at": verification.get("checked_at"),
        "reference_source": verification.get("reference_source"),
        "backup_name": verification.get("backup_name"),
        "reference_created_at": reference_created_at,
        "summary": summary,
        "overall_status": "issues" if issues else "clean",
        "results": results,
    }
    return _validate_record(candidate)


def append_history_record(
    destination: Path,
    verification: Mapping[str, object],
    reference_created_at: str,
    *,
    record_id: str | None = None,
) -> dict[str, object]:
    """Prepend one record and retain only the newest configured maximum."""
    record = create_history_record(
        verification,
        reference_created_at,
        record_id=record_id,
    )
    with _HISTORY_LOCK:
        history = load_history(destination)
        existing = list(history["records"])
        updated = {
            "history_version": HISTORY_VERSION,
            "records": [record, *existing][:MAX_HISTORY_RECORDS],
        }
        save_history_atomic(updated, destination)
    return record


def list_history_summaries(source: Path) -> list[dict[str, object]]:
    """Return newest-first records without detailed result rows."""
    history = load_history(source)
    return [
        {key: value for key, value in record.items() if key != "results"}
        for record in history["records"]
    ]


def get_history_record(source: Path, record_id: str) -> dict[str, object] | None:
    """Return one full history record by its stable ID."""
    history = load_history(source)
    return next(
        (record for record in history["records"] if record["id"] == record_id),
        None,
    )


def clear_history(source: Path) -> int:
    """Clear only verification records and return the deleted count."""
    with _HISTORY_LOCK:
        history = load_history(source)
        deleted = len(history["records"])
        save_history_atomic(empty_history(), source)
    return deleted
