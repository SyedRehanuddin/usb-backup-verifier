"""In-memory CSV reports for validated verification-history records."""

import csv
import io
import re
from datetime import datetime
from typing import Mapping


REPORT_TITLE = "USB Backup Verification Utility"
STATUS_LABELS = {
    "verified": "Verified",
    "corrupted": "Corrupted",
    "missing": "Missing",
    "extra": "Extra",
}
SUMMARY_KEYS = ("verified", "corrupted", "missing", "extra")
_FORMULA_PREFIX = re.compile(r"^[\s]*[=+\-@]")
_UNSAFE_FILENAME = re.compile(r"[^A-Za-z0-9_-]+")
_MONTH_ABBREVIATIONS = (
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
)


class ReportGenerationError(ValueError):
    """Raised when a history record cannot be safely exported."""


def spreadsheet_safe_text(value: str) -> str:
    """Prevent user-controlled CSV fields from becoming spreadsheet formulas."""
    if not isinstance(value, str):
        raise ReportGenerationError("Invalid report text value.")
    return f"'{value}" if _FORMULA_PREFIX.match(value) else value


def _required_text(record: Mapping[str, object], key: str) -> str:
    value = record.get(key)
    if not isinstance(value, str) or not value:
        raise ReportGenerationError("The history record cannot be exported.")
    return value


def _format_local_timestamp(value: str) -> str:
    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ReportGenerationError("The history record cannot be exported.") from exc

    local_timestamp = timestamp.astimezone()
    hour = local_timestamp.hour % 12 or 12
    meridiem = "AM" if local_timestamp.hour < 12 else "PM"
    return (
        f"{local_timestamp.day:02d} "
        f"{_MONTH_ABBREVIATIONS[local_timestamp.month - 1]} "
        f"{local_timestamp.year} at {hour:02d}:{local_timestamp.minute:02d} {meridiem}"
    )


def _validated_summary(record: Mapping[str, object]) -> dict[str, int]:
    value = record.get("summary")
    if not isinstance(value, Mapping):
        raise ReportGenerationError("The history record cannot be exported.")
    summary: dict[str, int] = {}
    for key in (*SUMMARY_KEYS, "total_results"):
        count = value.get(key)
        if not isinstance(count, int) or isinstance(count, bool) or count < 0:
            raise ReportGenerationError("The history record cannot be exported.")
        summary[key] = count
    if sum(summary[key] for key in SUMMARY_KEYS) != summary["total_results"]:
        raise ReportGenerationError("The history record cannot be exported.")
    return summary


def _validated_results(record: Mapping[str, object]) -> list[Mapping[str, object]]:
    results = record.get("results")
    if not isinstance(results, list):
        raise ReportGenerationError("The history record cannot be exported.")
    validated: list[Mapping[str, object]] = []
    for row in results:
        if not isinstance(row, Mapping) or row.get("status") not in STATUS_LABELS:
            raise ReportGenerationError("The history record cannot be exported.")
        for key in ("file", "relative_path"):
            if not isinstance(row.get(key), str) or not row[key]:
                raise ReportGenerationError("The history record cannot be exported.")
        for key in ("source_crc32", "backup_crc32"):
            if row.get(key) is not None and not isinstance(row[key], str):
                raise ReportGenerationError("The history record cannot be exported.")
        for key in ("source_size_bytes", "backup_size_bytes"):
            size = row.get(key)
            if size is not None and (
                not isinstance(size, int) or isinstance(size, bool) or size < 0
            ):
                raise ReportGenerationError("The history record cannot be exported.")
        validated.append(row)
    return validated


def generate_csv_report(record: Mapping[str, object]) -> bytes:
    """Return an Excel-friendly UTF-8 CSV report without modifying the record."""
    if not isinstance(record, Mapping):
        raise ReportGenerationError("The history record cannot be exported.")

    record_id = _required_text(record, "id")
    checked_at = _required_text(record, "checked_at")
    reference_source = _required_text(record, "reference_source")
    backup_name = _required_text(record, "backup_name")
    overall_status = record.get("overall_status")
    if overall_status not in {"clean", "issues"}:
        raise ReportGenerationError("The history record cannot be exported.")
    summary = _validated_summary(record)
    results = _validated_results(record)
    if len(results) != summary["total_results"]:
        raise ReportGenerationError("The history record cannot be exported.")

    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\r\n")
    writer.writerow([REPORT_TITLE])
    writer.writerow([])
    writer.writerow(["Verification ID", spreadsheet_safe_text(record_id)])
    writer.writerow(["Checked At", _format_local_timestamp(checked_at)])
    writer.writerow(["Reference Source", spreadsheet_safe_text(reference_source)])
    writer.writerow(["Backup Name", spreadsheet_safe_text(backup_name)])
    writer.writerow([
        "Overall Status",
        "Clean - No differences detected" if overall_status == "clean" else "Issues detected",
    ])
    writer.writerow(["Algorithm", "CRC-32"])
    writer.writerow([])
    for key in SUMMARY_KEYS:
        writer.writerow([STATUS_LABELS[key], summary[key]])
    writer.writerow(["Total Results", summary["total_results"]])
    writer.writerow([])
    writer.writerow([
        "Status",
        "File Name",
        "Relative Path",
        "Source CRC-32",
        "Backup CRC-32",
        "Source Size (Bytes)",
        "Backup Size (Bytes)",
    ])

    for row in results:
        writer.writerow([
            STATUS_LABELS[str(row["status"])],
            spreadsheet_safe_text(str(row["file"])),
            spreadsheet_safe_text(str(row["relative_path"])),
            row.get("source_crc32") or "",
            row.get("backup_crc32") or "",
            "" if row.get("source_size_bytes") is None else row["source_size_bytes"],
            "" if row.get("backup_size_bytes") is None else row["backup_size_bytes"],
        ])

    return output.getvalue().encode("utf-8-sig")


def safe_report_filename(record: Mapping[str, object]) -> str:
    """Create a conservative ASCII attachment filename from record metadata."""
    backup_name = _required_text(record, "backup_name")
    checked_at = _required_text(record, "checked_at")
    try:
        timestamp = datetime.fromisoformat(checked_at.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ReportGenerationError("The history record cannot be exported.") from exc

    safe_backup = _UNSAFE_FILENAME.sub("_", backup_name).strip("._-")[:60]
    if not safe_backup:
        safe_backup = "backup"
    stamp = timestamp.strftime("%Y-%m-%d_%H%M%S")
    return f"usb_backup_verification_{safe_backup}_{stamp}.csv"
