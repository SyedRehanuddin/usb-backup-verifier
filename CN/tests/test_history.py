import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import UUID

from fastapi.testclient import TestClient

import web_app
from app.core.history import (
    HISTORY_VERSION,
    MAX_HISTORY_RECORDS,
    HistoryValidationError,
    append_history_record,
    clear_history,
    get_history_record,
    list_history_summaries,
    load_history,
    save_history_atomic,
)
from app.core.manifest import build_manifest, save_manifest_atomic
from app.core.verifier import verify_backup


ENTRIES = [
    ("notes.txt", b"project notes\n"),
    ("attendance.csv", b"name,present\nAyesha,yes\n"),
    ("config.json", b'{"safe": true}\n'),
    ("image.png", b"\x89PNG\r\n\x1a\nraw-image-data"),
    ("nested/lab_record.bin", b"\x00\x01\x02\xfflab-record"),
]
REFERENCE_CREATED_AT = "2026-09-03T10:00:00Z"


def make_manifest():
    return build_manifest(
        "OriginalFiles",
        [f"OriginalFiles/{path}" for path, _ in ENTRIES],
        [io.BytesIO(content) for _, content in ENTRIES],
        created_at=REFERENCE_CREATED_AT,
    )


def make_verification(*, checked_at="2026-09-03T12:34:56Z", entries=ENTRIES):
    return verify_backup(
        make_manifest(),
        "USB_Backup_September",
        [f"USB_Backup_September/{path}" for path, _ in entries],
        [io.BytesIO(content) for _, content in entries],
        checked_at=checked_at,
    )


class HistoryCoreTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.history_path = Path(self.temporary_directory.name) / "history.json"

    def tearDown(self):
        self.temporary_directory.cleanup()

    def test_absent_history_is_empty(self):
        self.assertEqual(
            load_history(self.history_path),
            {"history_version": HISTORY_VERSION, "records": []},
        )

    def test_append_persists_whitelisted_record_and_uuid(self):
        verification = make_verification()
        verification["uploaded_content"] = "must-not-persist"
        record = append_history_record(
            self.history_path, verification, REFERENCE_CREATED_AT
        )

        UUID(str(record["id"]))
        stored = load_history(self.history_path)["records"][0]
        self.assertEqual(stored["overall_status"], "clean")
        self.assertNotIn("uploaded_content", stored)
        self.assertEqual(
            set(stored),
            {
                "id", "checked_at", "reference_source", "backup_name",
                "reference_created_at", "summary", "overall_status", "results",
            },
        )

    def test_history_never_persists_contents_or_absolute_paths(self):
        append_history_record(self.history_path, make_verification(), REFERENCE_CREATED_AT)
        raw = self.history_path.read_text(encoding="utf-8")

        self.assertNotIn("project notes", raw)
        self.assertNotIn("data:image", raw)
        self.assertNotIn("base64", raw.casefold())
        self.assertNotIn("C:\\\\", raw)
        for row in load_history(self.history_path)["records"][0]["results"]:
            self.assertFalse(Path(str(row["relative_path"])).is_absolute())

    def test_newest_first_and_detail_lookup(self):
        first = append_history_record(
            self.history_path,
            make_verification(checked_at="2026-09-03T11:00:00Z"),
            REFERENCE_CREATED_AT,
        )
        second = append_history_record(
            self.history_path,
            make_verification(checked_at="2026-09-03T12:00:00Z"),
            REFERENCE_CREATED_AT,
        )

        summaries = list_history_summaries(self.history_path)
        self.assertEqual([row["id"] for row in summaries], [second["id"], first["id"]])
        self.assertTrue(all("results" not in row for row in summaries))
        self.assertEqual(get_history_record(self.history_path, first["id"])["id"], first["id"])
        self.assertIsNone(get_history_record(self.history_path, "unknown"))

    def test_issue_record_is_classified(self):
        changed = [(path, b"changed" if path == "notes.txt" else content) for path, content in ENTRIES]
        record = append_history_record(
            self.history_path,
            make_verification(entries=changed),
            REFERENCE_CREATED_AT,
        )
        self.assertEqual(record["overall_status"], "issues")
        self.assertEqual(record["summary"]["corrupted"], 1)

    def test_history_is_capped_at_one_hundred_newest_records(self):
        for index in range(MAX_HISTORY_RECORDS + 3):
            append_history_record(
                self.history_path,
                make_verification(checked_at=f"2026-09-03T12:{index % 60:02d}:00Z"),
                REFERENCE_CREATED_AT,
                record_id=f"record-{index}",
            )
        records = load_history(self.history_path)["records"]
        self.assertEqual(len(records), MAX_HISTORY_RECORDS)
        self.assertEqual(records[0]["id"], "record-102")
        self.assertEqual(records[-1]["id"], "record-3")

    def test_malformed_history_raises_safe_validation_error(self):
        self.history_path.write_text("{not json", encoding="utf-8")
        with self.assertRaisesRegex(HistoryValidationError, "unavailable"):
            load_history(self.history_path)

    def test_invalid_absolute_result_path_is_rejected(self):
        verification = make_verification()
        verification["results"][0]["relative_path"] = "C:\\Users\\private.txt"
        with self.assertRaises(HistoryValidationError):
            append_history_record(self.history_path, verification, REFERENCE_CREATED_AT)

    def test_unsafe_folder_names_and_mismatched_filenames_are_rejected(self):
        unsafe_name = make_verification()
        unsafe_name["backup_name"] = "C:\\Users\\private"
        with self.assertRaises(HistoryValidationError):
            append_history_record(self.history_path, unsafe_name, REFERENCE_CREATED_AT)

        mismatched_file = make_verification()
        mismatched_file["results"][0]["file"] = "different.txt"
        with self.assertRaises(HistoryValidationError):
            append_history_record(self.history_path, mismatched_file, REFERENCE_CREATED_AT)

    def test_atomic_write_failure_leaves_no_temporary_file(self):
        history = {"history_version": HISTORY_VERSION, "records": []}
        with patch("app.core.history.os.replace", side_effect=OSError("failure")):
            with self.assertRaises(OSError):
                save_history_atomic(history, self.history_path)
        self.assertFalse(self.history_path.exists())
        self.assertEqual(list(self.history_path.parent.glob("*.tmp")), [])

    def test_clear_returns_count_and_leaves_valid_empty_document(self):
        append_history_record(self.history_path, make_verification(), REFERENCE_CREATED_AT)
        self.assertEqual(clear_history(self.history_path), 1)
        self.assertEqual(load_history(self.history_path)["records"], [])


class HistoryAPITests(unittest.TestCase):
    client = TestClient(web_app.app)

    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        data_root = Path(self.temporary_directory.name) / "data"
        self.manifest_path = data_root / "manifests" / "current_reference.json"
        self.history_path = data_root / "history" / "verification_history.json"
        self.reference_patch = patch("web_app.CURRENT_REFERENCE_PATH", self.manifest_path)
        self.history_patch = patch("web_app.CURRENT_HISTORY_PATH", self.history_path)
        self.reference_patch.start()
        self.history_patch.start()

    def tearDown(self):
        self.history_patch.stop()
        self.reference_patch.stop()
        self.temporary_directory.cleanup()

    def save_reference(self):
        save_manifest_atomic(make_manifest(), self.manifest_path)

    def post_verification(self, entries=ENTRIES, *, record_history=True, paths=None):
        backup_name = "USB_Backup_September"
        uploads = [
            ("files", (Path(path).name, content, "application/octet-stream"))
            for path, content in entries
        ]
        return self.client.post(
            "/api/verification/run",
            files=uploads,
            data={
                "backup_name": backup_name,
                "relative_paths": paths or [f"{backup_name}/{path}" for path, _ in entries],
                "record_history": str(record_history).lower(),
            },
        )

    def test_empty_history_list(self):
        self.assertEqual(self.client.get("/api/history").json(), {"count": 0, "records": []})

    def test_successful_opted_in_verification_creates_summary_and_detail(self):
        self.save_reference()
        response = self.post_verification()
        record_id = response.json()["history_record_id"]

        listing = self.client.get("/api/history").json()
        detail = self.client.get(f"/api/history/{record_id}").json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(listing["count"], 1)
        self.assertNotIn("results", listing["records"][0])
        self.assertEqual(detail["id"], record_id)
        self.assertEqual(len(detail["results"]), 5)

    def test_opted_out_verifications_never_create_history(self):
        self.save_reference()
        for entries in (
            ENTRIES,
            [(path, b"changed" if path == "notes.txt" else content) for path, content in ENTRIES],
            ENTRIES[:-1],
            [*ENTRIES, ("extra.txt", b"extra")],
            [("only.txt", b"only")],
        ):
            self.assertEqual(self.post_verification(entries, record_history=False).status_code, 200)
        self.assertEqual(self.client.get("/api/history").json()["count"], 0)
        self.assertFalse(self.history_path.exists())

    def test_failed_verification_never_creates_history(self):
        self.save_reference()
        response = self.post_verification(
            [("unsafe.txt", b"unsafe")],
            paths=["../unsafe.txt"],
        )
        self.assertEqual(response.status_code, 422)
        self.assertFalse(self.history_path.exists())

    def test_unknown_detail_is_404(self):
        response = self.client.get("/api/history/unknown")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Verification history record not found.")

    def test_malformed_history_returns_safe_500(self):
        self.history_path.parent.mkdir(parents=True)
        self.history_path.write_text(json.dumps({"unexpected": []}), encoding="utf-8")
        response = self.client.get("/api/history")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["detail"], "Verification history is unavailable.")

    def test_clear_history_preserves_reference(self):
        self.save_reference()
        self.post_verification()
        response = self.client.delete("/api/history")

        self.assertEqual(response.json(), {"status": "ok", "deleted": 1})
        self.assertEqual(self.client.get("/api/history").json()["count"], 0)
        self.assertTrue(self.client.get("/api/reference/current").json()["exists"])
        self.assertEqual(self.client.get("/api/history").json(), {"count": 0, "records": []})


if __name__ == "__main__":
    unittest.main()
