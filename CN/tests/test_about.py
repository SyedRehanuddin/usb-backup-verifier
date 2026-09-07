import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from web_app import app


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class AboutPageTests(unittest.TestCase):
    client = TestClient(app)

    @classmethod
    def setUpClass(cls) -> None:
        response = cls.client.get("/")
        cls.status_code = response.status_code
        cls.html = response.text
        cls.javascript = (PROJECT_ROOT / "static" / "js" / "app.js").read_text(
            encoding="utf-8"
        )

    def test_about_header_and_compact_information_sections_are_rendered(self) -> None:
        self.assertEqual(self.status_code, 200)
        required_copy = (
            "Project Information",
            "About USB Backup Verifier",
            "A local CRC-32 based utility that compares a trusted source with a backup and detects changed, missing, or unexpected files.",
            "Version 1.0",
            "Backup integrity verification",
            "Four-step workflow",
            "Understand each result",
            "CRC-32 Integrity Check",
            "Key features",
            "Error Simulation Lab",
        )
        for copy in required_copy:
            self.assertIn(copy, self.html)

    def test_workflow_and_status_copy_are_concise(self) -> None:
        for copy in (
            "Select the original folder.",
            "Create trusted CRC-32 values.",
            "Choose the backup to inspect.",
            "Compare the backup with the reference.",
            "Source and backup match.",
            "The file exists but its CRC-32 differs.",
            "The source file is absent from the backup.",
            "The backup contains an unexpected file.",
        ):
            self.assertIn(copy, self.html)

    def test_crc_features_and_error_lab_are_presentation_ready(self) -> None:
        for copy in (
            "CRC-32 creates a checksum from file data.",
            "CRC-32 is designed for error detection, not cryptographic security.",
            "Recursive folder verification",
            "CRC-32 reference generation",
            "Verified / Corrupted / Missing / Extra detection",
            "Non-destructive Error Simulation Lab",
            "Verification History",
            "CSV report export",
            "Nested folder support",
            "Local-only processing",
            "Demonstrates controlled file changes so CRC-32 detection can be tested without modifying the original files.",
            "Modify Byte",
            "Append Data",
            "Truncate File",
            "Remove File",
            "Add Extra File",
        ):
            self.assertIn(copy, self.html)

    def test_developer_facing_sections_and_internal_details_are_removed(self) -> None:
        removed_copy = (
            "Technology stack",
            "Implementation",
            "What is persisted",
            "Application data",
            "FastAPI",
            "Uvicorn",
            "Jinja2",
            "Python zlib.crc32",
            "64 KiB chunks",
            "8-character uppercase hexadecimal",
            "CBF43926",
            "data/manifests/current_reference.json",
            "data/history/verification_history.json",
            "Files never leave this device.",
        )
        for copy in removed_copy:
            self.assertNotIn(copy, self.html)

    def test_about_remains_a_real_client_side_view(self) -> None:
        self.assertNotIn("C:\\Users\\", self.html)
        self.assertIn('data-view-link="about"', self.html)
        self.assertIn('data-view="about"', self.html)
        self.assertNotIn("About is coming in a later step", self.html)
        self.assertIn(
            '["verification", "error-lab", "history", "about"]',
            self.javascript,
        )
        self.assertNotIn('viewName = isPlaceholder ? "placeholder"', self.javascript)


if __name__ == "__main__":
    unittest.main()
