import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

import web_app
from app.core.crc32 import crc32_bytes
from app.core.manifest import ManifestValidationError, build_manifest, save_manifest_atomic
from app.core.verifier import build_backup_records, compare_records, verify_backup


REFERENCE_ENTRIES = [
    ("notes.txt", b"project notes\n"),
    ("attendance.csv", b"name,present\nAyesha,yes\n"),
    ("config.json", b'{"safe": true}\n'),
    ("image.png", b"\x89PNG\r\n\x1a\nraw-image-data"),
    ("nested/lab_record.bin", b"\x00\x01\x02\xfflab-record"),
]


def make_manifest(entries=REFERENCE_ENTRIES):
    return build_manifest(
        "OriginalFiles",
        [f"OriginalFiles/{path}" for path, _ in entries],
        [io.BytesIO(content) for _, content in entries],
        created_at="2026-09-03T10:00:00Z",
    )


def verify_entries(entries, manifest=None):
    return verify_backup(
        manifest or make_manifest(),
        "USB_Backup_September",
        [f"USB_Backup_September/{path}" for path, _ in entries],
        [io.BytesIO(content) for _, content in entries],
        checked_at="2026-09-03T12:34:56Z",
    )


class VerifierCoreTests(unittest.TestCase):
    def assert_summary(self, result, verified, corrupted, missing, extra):
        self.assertEqual(
            result["summary"],
            {
                "verified": verified,
                "corrupted": corrupted,
                "missing": missing,
                "extra": extra,
                "total_results": verified + corrupted + missing + extra,
            },
        )

    def test_clean_backup_has_five_verified_files(self) -> None:
        result = verify_entries(REFERENCE_ENTRIES)

        self.assert_summary(result, 5, 0, 0, 0)
        self.assertEqual({row["status"] for row in result["results"]}, {"verified"})
        self.assertEqual(result["reference_source"], "OriginalFiles")
        self.assertEqual(result["backup_name"], "USB_Backup_September")
        self.assertEqual(result["checked_at"], "2026-09-03T12:34:56Z")

    def test_modified_file_is_corrupted(self) -> None:
        backup = [
            (path, b"modified attendance\n" if path == "attendance.csv" else content)
            for path, content in REFERENCE_ENTRIES
        ]
        result = verify_entries(backup)

        self.assert_summary(result, 4, 1, 0, 0)
        row = next(row for row in result["results"] if row["relative_path"] == "attendance.csv")
        self.assertEqual(row["status"], "corrupted")
        self.assertNotEqual(row["source_crc32"], row["backup_crc32"])

    def test_removed_file_is_missing(self) -> None:
        result = verify_entries(
            [(path, content) for path, content in REFERENCE_ENTRIES if path != "image.png"]
        )

        self.assert_summary(result, 4, 0, 1, 0)
        row = next(row for row in result["results"] if row["relative_path"] == "image.png")
        self.assertEqual(row["status"], "missing")
        self.assertIsNotNone(row["source_crc32"])
        self.assertIsNone(row["backup_crc32"])
        self.assertIsNone(row["backup_size_bytes"])

    def test_added_file_is_extra(self) -> None:
        result = verify_entries([*REFERENCE_ENTRIES, ("extra_file.txt", b"extra")])

        self.assert_summary(result, 5, 0, 0, 1)
        row = next(row for row in result["results"] if row["relative_path"] == "extra_file.txt")
        self.assertEqual(row["status"], "extra")
        self.assertIsNone(row["source_crc32"])
        self.assertIsNotNone(row["backup_crc32"])
        self.assertIsNone(row["source_size_bytes"])

    def test_mixed_backup_has_all_four_statuses(self) -> None:
        backup = [
            (path, b"changed notes" if path == "notes.txt" else content)
            for path, content in REFERENCE_ENTRIES
            if path != "image.png"
        ]
        backup.append(("extra_file.txt", b"extra"))

        result = verify_entries(backup)

        self.assert_summary(result, 3, 1, 1, 1)
        self.assertEqual(len(result["results"]), 6)

    def test_nested_paths_and_different_root_names_match(self) -> None:
        result = verify_entries(REFERENCE_ENTRIES)
        nested = next(
            row for row in result["results"] if row["relative_path"] == "nested/lab_record.bin"
        )

        self.assertEqual(nested["status"], "verified")
        self.assertEqual(nested["file"], "lab_record.bin")

    def test_same_basename_in_different_folders_remains_distinct(self) -> None:
        entries = [("folderA/data.txt", b"A"), ("folderB/data.txt", b"B")]
        result = verify_entries(entries, make_manifest(entries))

        self.assert_summary(result, 2, 0, 0, 0)
        self.assertEqual(
            [row["relative_path"] for row in result["results"]],
            ["folderA/data.txt", "folderB/data.txt"],
        )
        self.assertEqual([row["file"] for row in result["results"]], ["data.txt", "data.txt"])

    def test_equal_crc_but_different_size_is_corrupted(self) -> None:
        comparison = compare_records(
            [{"relative_path": "same.bin", "crc32": "AABBCCDD", "size_bytes": 10}],
            [{"relative_path": "same.bin", "crc32": "AABBCCDD", "size_bytes": 11}],
        )

        self.assertEqual(comparison["summary"]["corrupted"], 1)
        self.assertEqual(comparison["results"][0]["status"], "corrupted")

    def test_backup_records_reject_mismatched_counts(self) -> None:
        with self.assertRaisesRegex(ManifestValidationError, "counts must match"):
            build_backup_records(
                "BackupCopy",
                ["BackupCopy/one.txt", "BackupCopy/two.txt"],
                [io.BytesIO(b"one")],
            )

    def test_results_use_case_insensitive_deterministic_order(self) -> None:
        entries = [("zeta.txt", b"z"), ("Alpha.txt", b"A"), ("beta.txt", b"b")]
        result = verify_entries(list(reversed(entries)), make_manifest(entries))

        self.assertEqual(
            [row["relative_path"] for row in result["results"]],
            ["Alpha.txt", "beta.txt", "zeta.txt"],
        )


class VerificationAPITests(unittest.TestCase):
    client = TestClient(web_app.app)

    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.data_root = Path(self.temporary_directory.name) / "data"
        self.manifest_path = self.data_root / "manifests" / "current_reference.json"
        self.path_patch = patch("web_app.CURRENT_REFERENCE_PATH", self.manifest_path)
        self.path_patch.start()

    def tearDown(self) -> None:
        self.path_patch.stop()
        self.temporary_directory.cleanup()

    def save_reference(self) -> None:
        save_manifest_atomic(make_manifest(), self.manifest_path)

    def post_verification(self, entries, *, paths=None, backup_name="BackupCopy"):
        relative_paths = paths or [f"{backup_name}/{path}" for path, _ in entries]
        uploads = [
            ("files", (Path(path).name, content, "application/octet-stream"))
            for path, content in entries
        ]
        return self.client.post(
            "/api/verification/run",
            files=uploads,
            data={"backup_name": backup_name, "relative_paths": relative_paths},
        )

    def test_api_clean_verification(self) -> None:
        self.save_reference()
        response = self.post_verification(REFERENCE_ENTRIES)
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["summary"], {
            "verified": 5, "corrupted": 0, "missing": 0, "extra": 0, "total_results": 5,
        })
        attendance = next(row for row in body["results"] if row["relative_path"] == "attendance.csv")
        self.assertEqual(attendance["source_crc32"], crc32_bytes(REFERENCE_ENTRIES[1][1]))
        self.assertEqual(attendance["backup_crc32"], attendance["source_crc32"])

    def test_api_corrupted_verification(self) -> None:
        self.save_reference()
        entries = [
            (path, b"changed" if path == "attendance.csv" else content)
            for path, content in REFERENCE_ENTRIES
        ]
        body = self.post_verification(entries).json()

        self.assertEqual(body["summary"]["verified"], 4)
        self.assertEqual(body["summary"]["corrupted"], 1)

    def test_api_missing_verification_has_null_backup_fields(self) -> None:
        self.save_reference()
        entries = [(path, content) for path, content in REFERENCE_ENTRIES if path != "image.png"]
        body = self.post_verification(entries).json()
        missing = next(row for row in body["results"] if row["status"] == "missing")

        self.assertEqual(body["summary"]["missing"], 1)
        self.assertIsNone(missing["backup_crc32"])
        self.assertIsNone(missing["backup_size_bytes"])

    def test_api_extra_verification_has_null_source_fields(self) -> None:
        self.save_reference()
        body = self.post_verification([*REFERENCE_ENTRIES, ("extra_file.txt", b"extra")]).json()
        extra = next(row for row in body["results"] if row["status"] == "extra")

        self.assertEqual(body["summary"]["extra"], 1)
        self.assertIsNone(extra["source_crc32"])
        self.assertIsNone(extra["source_size_bytes"])

    def test_api_mixed_verification_and_order(self) -> None:
        self.save_reference()
        entries = [
            (path, b"changed notes" if path == "notes.txt" else content)
            for path, content in REFERENCE_ENTRIES
            if path != "image.png"
        ]
        entries.append(("extra_file.txt", b"extra"))
        body = self.post_verification(list(reversed(entries))).json()

        self.assertEqual(body["summary"], {
            "verified": 3, "corrupted": 1, "missing": 1, "extra": 1, "total_results": 6,
        })
        paths = [row["relative_path"] for row in body["results"]]
        self.assertEqual(paths, sorted(paths, key=lambda value: (value.casefold(), value)))

    def test_api_without_reference_returns_409(self) -> None:
        response = self.post_verification([("notes.txt", b"notes")])

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json(), {"detail": "No trusted reference has been generated."})

    def test_api_rejects_unsafe_backup_paths(self) -> None:
        self.save_reference()
        for unsafe_path in (
            "../secret.txt",
            "/absolute/file.txt",
            "C:\\unsafe.txt",
            "\\\\server\\share\\file.txt",
        ):
            with self.subTest(path=unsafe_path):
                response = self.post_verification(
                    [("unsafe.txt", b"unsafe")],
                    paths=[unsafe_path],
                )
                self.assertEqual(response.status_code, 422)
                self.assertIn("Invalid relative path", response.json()["detail"])

    def test_api_rejects_duplicate_normalized_paths(self) -> None:
        self.save_reference()
        response = self.post_verification(
            [("one.txt", b"one"), ("two.txt", b"two")],
            paths=["BackupCopy/folder/report.txt", "BackupCopy/folder\\report.txt"],
        )

        self.assertEqual(response.status_code, 422)
        self.assertIn("Duplicate relative path", response.json()["detail"])

    def test_api_rejects_mismatched_file_and_path_counts(self) -> None:
        self.save_reference()
        response = self.post_verification(
            [("one.txt", b"one"), ("two.txt", b"two")],
            paths=["BackupCopy/one.txt"],
        )

        self.assertEqual(response.status_code, 422)
        self.assertIn("counts must match", response.json()["detail"])

    def test_api_does_not_persist_backup_files_or_history(self) -> None:
        self.save_reference()
        response = self.post_verification(REFERENCE_ENTRIES)

        self.assertEqual(response.status_code, 200)
        persisted = sorted(path for path in self.data_root.rglob("*") if path.is_file())
        self.assertEqual(persisted, [self.manifest_path])
        self.assertFalse((self.data_root / "history").exists())


if __name__ == "__main__":
    unittest.main()
