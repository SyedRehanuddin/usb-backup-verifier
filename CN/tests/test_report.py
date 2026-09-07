import copy
import csv
import io
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

import web_app
from app.core.history import append_history_record
from app.core.manifest import build_manifest
from app.core.report import (
    ReportGenerationError,
    generate_csv_report,
    safe_report_filename,
    spreadsheet_safe_text,
)
from app.core.verifier import verify_backup


def result_row(
    status,
    path,
    source_crc="AABBCCDD",
    backup_crc="AABBCCDD",
    source_size=120,
    backup_size=120,
):
    return {
        "status": status,
        "file": path.split("/")[-1],
        "relative_path": path,
        "source_crc32": source_crc,
        "backup_crc32": backup_crc,
        "source_size_bytes": source_size,
        "backup_size_bytes": backup_size,
    }


def clean_record():
    paths = [
        "attendance.csv",
        "config.json",
        "image.png",
        "nested/lab_record.bin",
        "notes.txt",
    ]
    return {
        "id": "b2f4f53e-41f0-4a9d-b17d-7115833f4487",
        "checked_at": "2026-09-03T10:35:00Z",
        "reference_source": "OriginalFiles",
        "backup_name": "BackupClean",
        "reference_created_at": "2026-09-03T10:00:00Z",
        "summary": {
            "verified": 5,
            "corrupted": 0,
            "missing": 0,
            "extra": 0,
            "total_results": 5,
        },
        "overall_status": "clean",
        "results": [result_row("verified", path) for path in paths],
    }


def mixed_record():
    record = clean_record()
    record["backup_name"] = "BackupMixed"
    record["overall_status"] = "issues"
    record["summary"] = {
        "verified": 3,
        "corrupted": 1,
        "missing": 1,
        "extra": 1,
        "total_results": 6,
    }
    record["results"] = [
        result_row("verified", "a.txt"),
        result_row("corrupted", "b.txt", backup_crc="11223344"),
        result_row("missing", "c.txt", backup_crc=None, backup_size=None),
        result_row("extra", "d.txt", source_crc=None, source_size=None),
        result_row("verified", "nested/lab_record.bin"),
        result_row("verified", "z.txt"),
    ]
    return record


def parse_report(record):
    text = generate_csv_report(record).decode("utf-8-sig")
    return list(csv.reader(io.StringIO(text)))


def expected_local_report_time(value):
    timestamp = datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone()
    hour = timestamp.hour % 12 or 12
    meridiem = "AM" if timestamp.hour < 12 else "PM"
    months = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    return f"{timestamp.day:02d} {months[timestamp.month - 1]} {timestamp.year} at {hour:02d}:{timestamp.minute:02d} {meridiem}"


class ReportCoreTests(unittest.TestCase):
    def test_all_real_verification_scenarios_export_the_complete_result(self):
        source_entries = [
            ("notes.txt", b"project notes\n"),
            ("attendance.csv", b"name,present\nAyesha,yes\n"),
            ("config.json", b'{"safe": true}\n'),
            ("image.png", b"\x89PNG\r\n\x1a\nraw-image-data"),
            ("nested/lab_record.bin", b"\x00\x01\x02\xfflab-record"),
        ]
        manifest = build_manifest(
            "OriginalFiles",
            [f"OriginalFiles/{path}" for path, _ in source_entries],
            [io.BytesIO(content) for _, content in source_entries],
            created_at="2026-09-03T10:00:00Z",
        )
        scenarios = {
            "clean": source_entries,
            "corrupted": [
                (path, b"changed" if path == "attendance.csv" else content)
                for path, content in source_entries
            ],
            "missing": [
                (path, content) for path, content in source_entries if path != "image.png"
            ],
            "extra": [*source_entries, ("extra_file.txt", b"extra")],
            "mixed": [
                *[
                    (path, b"changed notes" if path == "notes.txt" else content)
                    for path, content in source_entries
                    if path != "image.png"
                ],
                ("extra_file.txt", b"extra"),
            ],
        }
        expected = {
            "clean": (5, 0, 0, 0, 5),
            "corrupted": (4, 1, 0, 0, 5),
            "missing": (4, 0, 1, 0, 5),
            "extra": (5, 0, 0, 1, 6),
            "mixed": (3, 1, 1, 1, 6),
        }

        for name, entries in scenarios.items():
            with self.subTest(scenario=name):
                result = verify_backup(
                    manifest,
                    f"Backup_{name}",
                    [f"Backup_{name}/{path}" for path, _ in entries],
                    [io.BytesIO(content) for _, content in entries],
                    checked_at="2026-09-03T12:34:56Z",
                )
                record = {
                    **result,
                    "id": f"verification-{name}",
                    "reference_created_at": manifest["created_at"],
                    "overall_status": "clean" if name == "clean" else "issues",
                }
                rows = parse_report(record)
                detail_header = [
                    "Status", "File Name", "Relative Path", "Source CRC-32", "Backup CRC-32",
                    "Source Size (Bytes)", "Backup Size (Bytes)",
                ]
                header_index = rows.index(detail_header)
                detail_rows = rows[header_index + 1:]
                verified, corrupted, missing, extra, total = expected[name]

                self.assertEqual(len(detail_rows), total)
                self.assertIn(["Verified", str(verified)], rows)
                self.assertIn(["Corrupted", str(corrupted)], rows)
                self.assertIn(["Missing", str(missing)], rows)
                self.assertIn(["Extra", str(extra)], rows)
                self.assertIn(["Total Results", str(total)], rows)
                self.assertTrue(any(row[2] == "nested/lab_record.bin" for row in detail_rows))

    def test_clean_csv_generation_has_five_detail_rows(self):
        rows = parse_report(clean_record())
        header_index = rows.index([
            "Status", "File Name", "Relative Path", "Source CRC-32", "Backup CRC-32",
            "Source Size (Bytes)", "Backup Size (Bytes)",
        ])
        self.assertEqual(rows[header_index + 1 :], [
            ["Verified", row["file"], row["relative_path"], "AABBCCDD", "AABBCCDD", "120", "120"]
            for row in clean_record()["results"]
        ])

    def test_mixed_csv_summary_and_six_results(self):
        rows = parse_report(mixed_record())
        self.assertIn(["Verified", "3"], rows)
        self.assertIn(["Corrupted", "1"], rows)
        self.assertIn(["Missing", "1"], rows)
        self.assertIn(["Extra", "1"], rows)
        self.assertIn(["Total Results", "6"], rows)
        header_index = next(index for index, row in enumerate(rows) if row and row[0] == "Status")
        self.assertEqual(len(rows[header_index + 1 :]), 6)

    def test_metadata_rows_are_present_and_human_readable(self):
        rows = parse_report(clean_record())
        self.assertEqual(rows[0], ["USB Backup Verification Utility"])
        self.assertIn(["Verification ID", clean_record()["id"]], rows)
        self.assertIn(["Reference Source", "OriginalFiles"], rows)
        self.assertIn(["Backup Name", "BackupClean"], rows)
        self.assertIn(["Overall Status", "Clean - No differences detected"], rows)
        self.assertIn(["Algorithm", "CRC-32"], rows)

    def test_checked_at_uses_unambiguous_local_display_format(self):
        record = clean_record()
        rows = parse_report(record)
        self.assertIn(["Checked At", expected_local_report_time(record["checked_at"])], rows)
        self.assertNotIn(["Checked At", record["checked_at"]], rows)

    def test_issues_overall_status_is_human_readable(self):
        self.assertIn(["Overall Status", "Issues detected"], parse_report(mixed_record()))

    def test_verified_row_is_human_readable(self):
        self.assertTrue(any(row[:3] == ["Verified", "a.txt", "a.txt"] for row in parse_report(mixed_record())))

    def test_corrupted_row_contains_both_different_crc_values(self):
        row = next(row for row in parse_report(mixed_record()) if row[:2] == ["Corrupted", "b.txt"])
        self.assertEqual(row[3:5], ["AABBCCDD", "11223344"])

    def test_missing_row_has_blank_backup_fields(self):
        row = next(row for row in parse_report(mixed_record()) if row[:2] == ["Missing", "c.txt"])
        self.assertEqual(row[3:], ["AABBCCDD", "", "120", ""])
        self.assertNotIn("None", row)

    def test_extra_row_has_blank_source_fields(self):
        row = next(row for row in parse_report(mixed_record()) if row[:2] == ["Extra", "d.txt"])
        self.assertEqual(row[3:], ["", "AABBCCDD", "", "120"])
        self.assertNotIn("None", row)

    def test_result_order_is_preserved(self):
        record = mixed_record()
        exported_paths = [
            row[2] for row in parse_report(record)
            if row and row[0] in {"Verified", "Corrupted", "Missing", "Extra"} and len(row) == 7
        ]
        self.assertEqual(exported_paths, [row["relative_path"] for row in record["results"]])

    def test_nested_paths_are_not_flattened(self):
        record = clean_record()
        record["results"][3]["relative_path"] = "documents/reports/september/final.csv"
        record["results"][3]["file"] = "final.csv"
        self.assertTrue(any("documents/reports/september/final.csv" in row for row in parse_report(record)))

    def test_unicode_filename_round_trips(self):
        record = clean_record()
        record["results"][0]["file"] = "प्रयोग.txt"
        record["results"][0]["relative_path"] = "reports/प्रयोग.txt"
        rows = parse_report(record)
        self.assertTrue(any("reports/प्रयोग.txt" in row for row in rows))

    def test_commas_quotes_and_newlines_use_csv_quoting(self):
        record = clean_record()
        record["results"][0]["file"] = 'report,"final".txt'
        record["results"][0]["relative_path"] = 'reports/line\nreport,"final".txt'
        data = generate_csv_report(record).decode("utf-8-sig")
        self.assertIn('"report,""final"".txt"', data)
        self.assertTrue(any(row[2] == 'reports/line\nreport,"final".txt' for row in parse_report(record) if len(row) == 7))

    def test_formula_injection_is_escaped_in_all_user_text_fields(self):
        record = clean_record()
        record["reference_source"] = "=SUM(A1:A2)"
        record["backup_name"] = "+danger.csv"
        record["results"][0]["file"] = "@command.txt"
        record["results"][0]["relative_path"] = "-1+2.txt"
        rows = parse_report(record)
        self.assertIn(["Reference Source", "'=SUM(A1:A2)"], rows)
        self.assertIn(["Backup Name", "'+danger.csv"], rows)
        exported = next(row for row in rows if len(row) == 7 and row[1] == "'@command.txt")
        self.assertEqual(exported[2], "'-1+2.txt")

    def test_formula_detection_handles_leading_whitespace(self):
        self.assertEqual(spreadsheet_safe_text("  =danger"), "'  =danger")
        self.assertEqual(spreadsheet_safe_text("ordinary.txt"), "ordinary.txt")

    def test_utf8_bom_is_present(self):
        report = generate_csv_report(clean_record())
        self.assertTrue(report.startswith(b"\xef\xbb\xbf"))

    def test_generation_does_not_alter_input_record(self):
        record = mixed_record()
        original = copy.deepcopy(record)
        generate_csv_report(record)
        self.assertEqual(record, original)

    def test_download_filename_is_sanitized(self):
        record = clean_record()
        record["backup_name"] = "C:\\unsafe/name?* +backup"
        filename = safe_report_filename(record)
        self.assertEqual(filename, "usb_backup_verification_C_unsafe_name_backup_2026-09-03_103500.csv")
        self.assertNotRegex(filename, r"[\\/:?*\x00-\x1f]")

    def test_invalid_record_is_rejected(self):
        record = clean_record()
        record["summary"]["verified"] = -1
        with self.assertRaises(ReportGenerationError):
            generate_csv_report(record)


class ReportAPITests(unittest.TestCase):
    client = TestClient(web_app.app)

    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.history_path = Path(self.temporary_directory.name) / "history.json"
        self.reports_path = Path(self.temporary_directory.name) / "reports"
        self.path_patch = patch("web_app.CURRENT_HISTORY_PATH", self.history_path)
        self.path_patch.start()

    def tearDown(self):
        self.path_patch.stop()
        self.temporary_directory.cleanup()

    def save_record(self, record=None):
        source = record or clean_record()
        verification = {
            "checked_at": source["checked_at"],
            "reference_source": source["reference_source"],
            "backup_name": source["backup_name"],
            "summary": source["summary"],
            "results": source["results"],
        }
        return append_history_record(
            self.history_path,
            verification,
            source["reference_created_at"],
            record_id=source["id"],
        )

    def test_csv_endpoint_returns_attachment_and_correct_body(self):
        record = self.save_record()
        response = self.client.get(f"/api/history/{record['id']}/csv")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.headers["content-type"].startswith("text/csv"))
        self.assertEqual(
            response.headers["content-disposition"],
            'attachment; filename="usb_backup_verification_BackupClean_2026-09-03_103500.csv"',
        )
        text = response.content.decode("utf-8-sig")
        rows = list(csv.reader(io.StringIO(text)))
        self.assertIn(["Verification ID", record["id"]], rows)
        self.assertIn(["Checked At", expected_local_report_time(record["checked_at"])], rows)
        self.assertIn(["Overall Status", "Clean - No differences detected"], rows)
        self.assertIn([
            "Status", "File Name", "Relative Path", "Source CRC-32", "Backup CRC-32",
            "Source Size (Bytes)", "Backup Size (Bytes)",
        ], rows)
        self.assertNotIn(["Report ID", record["id"]], rows)
        self.assertNotIn(["Checked At", record["checked_at"]], rows)
        self.assertNotIn("\r\nStatus,File,Relative Path,", text)
        self.assertIn(["Verified", "5"], rows)
        self.assertEqual(sum(1 for row in rows if len(row) == 7 and row[0] == "Verified"), 5)
        self.assertFalse(self.reports_path.exists())

    def test_csv_endpoint_returns_mixed_issue_wording_and_blank_fields(self):
        record = self.save_record(mixed_record())
        response = self.client.get(f"/api/history/{record['id']}/csv")

        self.assertEqual(response.status_code, 200)
        rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))
        self.assertIn(["Verification ID", record["id"]], rows)
        self.assertIn(["Overall Status", "Issues detected"], rows)
        self.assertIn(["Verified", "3"], rows)
        self.assertIn(["Corrupted", "1"], rows)
        self.assertIn(["Missing", "1"], rows)
        self.assertIn(["Extra", "1"], rows)
        missing = next(row for row in rows if row[:2] == ["Missing", "c.txt"])
        extra = next(row for row in rows if row[:2] == ["Extra", "d.txt"])
        self.assertEqual(missing[3:], ["AABBCCDD", "", "120", ""])
        self.assertEqual(extra[3:], ["", "AABBCCDD", "", "120"])

    def test_unknown_csv_record_returns_404(self):
        response = self.client.get("/api/history/unknown/csv")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Verification history record not found.")

    def test_malformed_history_returns_clean_500(self):
        self.history_path.write_text("{bad json", encoding="utf-8")
        response = self.client.get("/api/history/record/csv")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["detail"], "Verification history is unavailable.")


if __name__ == "__main__":
    unittest.main()
