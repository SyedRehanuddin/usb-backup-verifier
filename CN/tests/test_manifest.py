import io
import json
import tempfile
import unittest
from copy import deepcopy
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

import web_app
from app.core.crc32 import crc32_bytes
from app.core.manifest import (
    ALGORITHM,
    MANIFEST_VERSION,
    ManifestValidationError,
    build_manifest,
    load_manifest,
    save_manifest_atomic,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def build_sample_manifest(
    entries: list[tuple[str, bytes]],
    source_name: str = "OriginalFiles",
):
    return build_manifest(
        source_name,
        [path for path, _ in entries],
        [io.BytesIO(content) for _, content in entries],
    )


class ManifestCoreTests(unittest.TestCase):
    def test_manifest_generation_with_one_file(self) -> None:
        manifest = build_sample_manifest([("OriginalFiles/notes.txt", b"notes")])

        self.assertEqual(manifest["file_count"], 1)
        self.assertEqual(manifest["files"][0]["relative_path"], "notes.txt")

    def test_manifest_generation_with_multiple_files(self) -> None:
        manifest = build_sample_manifest(
            [
                ("OriginalFiles/notes.txt", b"notes"),
                ("OriginalFiles/attendance.csv", b"name,present\nA,yes\n"),
                ("OriginalFiles/documents/report.txt", b"report"),
            ]
        )

        self.assertEqual(len(manifest["files"]), 3)

    def test_nested_paths_are_preserved(self) -> None:
        manifest = build_sample_manifest(
            [
                ("OriginalFiles/notes.txt", b"notes"),
                ("OriginalFiles/attendance.csv", b"attendance"),
                ("OriginalFiles/documents/report.txt", b"report"),
                ("OriginalFiles/nested/lab_record.bin", b"\x00\x01\xff"),
            ]
        )

        self.assertEqual(
            [record["relative_path"] for record in manifest["files"]],
            [
                "attendance.csv",
                "documents/report.txt",
                "nested/lab_record.bin",
                "notes.txt",
            ],
        )

    def test_top_level_source_folder_is_removed(self) -> None:
        manifest = build_sample_manifest(
            [("OriginalFiles/documents/report.txt", b"report")]
        )

        self.assertEqual(
            manifest["files"][0]["relative_path"],
            "documents/report.txt",
        )

    def test_duplicate_basenames_in_different_folders_remain_distinct(self) -> None:
        manifest = build_sample_manifest(
            [
                ("OriginalFiles/folderA/report.txt", b"A"),
                ("OriginalFiles/folderB/report.txt", b"B"),
            ]
        )

        self.assertEqual(
            [record["relative_path"] for record in manifest["files"]],
            ["folderA/report.txt", "folderB/report.txt"],
        )

    def test_file_records_are_sorted_by_relative_path(self) -> None:
        manifest = build_sample_manifest(
            [
                ("OriginalFiles/z-last.txt", b"z"),
                ("OriginalFiles/a-first.txt", b"a"),
                ("OriginalFiles/m-middle.txt", b"m"),
            ]
        )

        self.assertEqual(
            [record["relative_path"] for record in manifest["files"]],
            ["a-first.txt", "m-middle.txt", "z-last.txt"],
        )

    def test_crc_values_are_uppercase_eight_character_hex(self) -> None:
        manifest = build_sample_manifest([("OriginalFiles/raw.bin", b"\x00\xffraw")])

        self.assertRegex(manifest["files"][0]["crc32"], r"^[0-9A-F]{8}$")

    def test_file_count_matches_records(self) -> None:
        manifest = build_sample_manifest(
            [("OriginalFiles/a.txt", b"a"), ("OriginalFiles/b.txt", b"bb")]
        )

        self.assertEqual(manifest["file_count"], len(manifest["files"]))

    def test_total_size_matches_file_sizes(self) -> None:
        manifest = build_sample_manifest(
            [("OriginalFiles/a.txt", b"a"), ("OriginalFiles/b.txt", b"bb")]
        )

        self.assertEqual(manifest["total_size_bytes"], 3)
        self.assertEqual(
            manifest["total_size_bytes"],
            sum(record["size_bytes"] for record in manifest["files"]),
        )

    def test_algorithm_is_crc32(self) -> None:
        manifest = build_sample_manifest([("OriginalFiles/a.txt", b"a")])

        self.assertEqual(manifest["algorithm"], ALGORITHM)
        self.assertEqual(manifest["algorithm"], "CRC-32")

    def test_manifest_version_is_numeric(self) -> None:
        manifest = build_sample_manifest([("OriginalFiles/a.txt", b"a")])

        self.assertEqual(manifest["manifest_version"], MANIFEST_VERSION)
        self.assertIsInstance(manifest["manifest_version"], int)

    def test_created_at_is_valid_utc_iso8601(self) -> None:
        manifest = build_sample_manifest([("OriginalFiles/a.txt", b"a")])
        created_at = manifest["created_at"]
        parsed = datetime.fromisoformat(created_at.replace("Z", "+00:00"))

        self.assertTrue(created_at.endswith("Z"))
        self.assertEqual(parsed.utcoffset(), timedelta(0))

    def test_manifest_crc_matches_crc_module(self) -> None:
        content = b"known manifest content\x00\xff"
        manifest = build_sample_manifest([("OriginalFiles/known.bin", content)])

        self.assertEqual(manifest["files"][0]["crc32"], crc32_bytes(content))

    def test_atomic_save_replaces_current_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temp_directory:
            destination = Path(temp_directory) / "current_reference.json"
            first = build_sample_manifest([("OriginalFiles/first.txt", b"first")])
            second = build_sample_manifest([("NewSource/second.txt", b"second")], "NewSource")

            save_manifest_atomic(first, destination)
            save_manifest_atomic(second, destination)

            saved = json.loads(destination.read_text(encoding="utf-8"))
            self.assertEqual(saved["source_name"], "NewSource")
            self.assertEqual(saved["files"][0]["relative_path"], "second.txt")
            self.assertEqual(list(destination.parent.glob("*.tmp")), [])

    def test_parent_traversal_paths_are_rejected(self) -> None:
        for unsafe_path in (
            "",
            ".",
            "folder/./file.txt",
            "../secret.txt",
            "folder/../secret.txt",
            "../../outside.bin",
        ):
            with self.subTest(path=unsafe_path):
                with self.assertRaisesRegex(
                    ManifestValidationError,
                    "Invalid relative path",
                ):
                    build_sample_manifest([(unsafe_path, b"unsafe")])

    def test_absolute_paths_are_rejected(self) -> None:
        for unsafe_path in (
            "/absolute/file.txt",
            "C:\\Users\\file.txt",
            "OriginalFiles/C:\\Users\\file.txt",
            "\\\\server\\share\\file.txt",
        ):
            with self.subTest(path=unsafe_path):
                with self.assertRaisesRegex(
                    ManifestValidationError,
                    "Invalid relative path",
                ):
                    build_sample_manifest([(unsafe_path, b"unsafe")])

    def test_duplicate_normalized_paths_are_rejected(self) -> None:
        with self.assertRaisesRegex(
            ManifestValidationError,
            "Duplicate relative path",
        ):
            build_sample_manifest(
                [
                    ("OriginalFiles/folder/report.txt", b"one"),
                    ("OriginalFiles/folder\\report.txt", b"two"),
                ]
            )

    def test_mismatched_stream_and_path_counts_are_rejected(self) -> None:
        with self.assertRaisesRegex(
            ManifestValidationError,
            "counts must match",
        ):
            build_manifest(
                "OriginalFiles",
                ["OriginalFiles/one.txt", "OriginalFiles/two.txt"],
                [io.BytesIO(b"one")],
            )

    def test_stored_manifest_rejects_unsafe_paths_and_inconsistent_totals(self) -> None:
        valid = build_sample_manifest([("OriginalFiles/notes.txt", b"notes")])
        invalid_documents = []

        unsafe_path = deepcopy(valid)
        unsafe_path["files"][0]["relative_path"] = "C:\\Users\\private.txt"
        invalid_documents.append(unsafe_path)

        wrong_count = deepcopy(valid)
        wrong_count["file_count"] = 2
        invalid_documents.append(wrong_count)

        wrong_size = deepcopy(valid)
        wrong_size["total_size_bytes"] = 999
        invalid_documents.append(wrong_size)

        with tempfile.TemporaryDirectory() as temp_directory:
            source = Path(temp_directory) / "current_reference.json"
            for document in invalid_documents:
                with self.subTest(document=document):
                    source.write_text(json.dumps(document), encoding="utf-8")
                    with self.assertRaisesRegex(
                        ManifestValidationError,
                        "Stored reference manifest is invalid",
                    ):
                        load_manifest(source)


class ReferenceAPITests(unittest.TestCase):
    client = TestClient(web_app.app)

    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.manifest_path = (
            Path(self.temporary_directory.name) / "manifests" / "current_reference.json"
        )
        self.path_patch = patch(
            "web_app.CURRENT_REFERENCE_PATH",
            self.manifest_path,
        )
        self.path_patch.start()

    def tearDown(self) -> None:
        self.path_patch.stop()
        self.temporary_directory.cleanup()

    def post_reference(
        self,
        paths: list[str] | None = None,
        source_name: str = "OriginalFiles",
    ):
        relative_paths = paths or [
            "OriginalFiles/notes.txt",
            "OriginalFiles/documents/report.txt",
            "OriginalFiles/nested/lab_record.bin",
        ]
        payloads = [b"notes", b"report", b"\x00\x01\xff"]
        uploads = [
            (
                "files",
                (f"upload_{index}.bin", payload, "application/octet-stream"),
            )
            for index, payload in enumerate(payloads[: len(relative_paths)])
        ]
        return self.client.post(
            "/api/reference/generate",
            files=uploads,
            data={"source_name": source_name, "relative_paths": relative_paths},
        )

    def test_current_reference_before_manifest_returns_exists_false(self) -> None:
        response = self.client.get("/api/reference/current")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"exists": False})

    def test_generate_reference_with_multiple_files(self) -> None:
        unique_names = ["upload_0.bin", "upload_1.bin", "upload_2.bin"]
        self.assertTrue(all(not any(PROJECT_ROOT.rglob(name)) for name in unique_names))

        response = self.post_reference()
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["source_name"], "OriginalFiles")
        self.assertEqual(body["file_count"], 3)
        self.assertEqual(
            body["manifest_path"],
            "data/manifests/current_reference.json",
        )
        self.assertTrue(self.manifest_path.exists())
        self.assertTrue(all(not any(PROJECT_ROOT.rglob(name)) for name in unique_names))

        persisted_files = [
            path
            for path in self.manifest_path.parent.rglob("*")
            if path.is_file()
        ]
        self.assertEqual(persisted_files, [self.manifest_path])

    def test_current_reference_after_generation_returns_manifest(self) -> None:
        generate_response = self.post_reference()
        current_response = self.client.get("/api/reference/current")
        body = current_response.json()

        self.assertEqual(generate_response.status_code, 200)
        self.assertEqual(current_response.status_code, 200)
        self.assertTrue(body["exists"])
        self.assertEqual(body["source_name"], "OriginalFiles")
        self.assertEqual(body["file_count"], 3)
        self.assertEqual(
            [record["relative_path"] for record in body["files"]],
            ["documents/report.txt", "nested/lab_record.bin", "notes.txt"],
        )

    def test_structurally_invalid_saved_reference_returns_safe_500(self) -> None:
        invalid = build_sample_manifest([("OriginalFiles/notes.txt", b"notes")])
        invalid["files"][0]["relative_path"] = "../../private.txt"
        self.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        self.manifest_path.write_text(json.dumps(invalid), encoding="utf-8")

        response = self.client.get("/api/reference/current")

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json()["detail"],
            "The saved reference manifest is unavailable.",
        )
        self.assertNotIn("Traceback", response.text)

    def test_api_rejects_mismatched_file_and_path_counts(self) -> None:
        response = self.client.post(
            "/api/reference/generate",
            files=[
                ("files", ("one.txt", b"one", "text/plain")),
                ("files", ("two.txt", b"two", "text/plain")),
            ],
            data={
                "source_name": "OriginalFiles",
                "relative_paths": ["OriginalFiles/one.txt"],
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertIn("counts must match", response.json()["detail"])
        self.assertFalse(self.manifest_path.exists())

    def test_api_rejects_unsafe_relative_path(self) -> None:
        response = self.client.post(
            "/api/reference/generate",
            files=[("files", ("secret.txt", b"secret", "text/plain"))],
            data={"source_name": "OriginalFiles", "relative_paths": "../secret.txt"},
        )

        self.assertEqual(response.status_code, 422)
        self.assertIn("Invalid relative path", response.json()["detail"])
        self.assertFalse(self.manifest_path.exists())

    def test_api_rejects_duplicate_normalized_relative_paths(self) -> None:
        response = self.client.post(
            "/api/reference/generate",
            files=[
                ("files", ("one.txt", b"one", "text/plain")),
                ("files", ("two.txt", b"two", "text/plain")),
            ],
            data={
                "source_name": "OriginalFiles",
                "relative_paths": [
                    "OriginalFiles/folder/report.txt",
                    "OriginalFiles/folder\\report.txt",
                ],
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertIn("Duplicate relative path", response.json()["detail"])
        self.assertFalse(self.manifest_path.exists())


if __name__ == "__main__":
    unittest.main()
