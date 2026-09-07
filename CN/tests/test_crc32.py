import io
import re
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.crc32 import DEFAULT_CHUNK_SIZE, crc32_bytes, crc32_stream
from web_app import app


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class TrackingBytesIO(io.BytesIO):
    """Record read sizes to prove that stream processing is incremental."""

    def __init__(self, data: bytes) -> None:
        super().__init__(data)
        self.read_sizes: list[int] = []

    def read(self, size: int = -1) -> bytes:
        self.read_sizes.append(size)
        return super().read(size)


class CRC32Tests(unittest.TestCase):
    def test_crc32_bytes_known_vector(self) -> None:
        self.assertEqual(crc32_bytes(b"123456789"), "CBF43926")

    def test_crc32_bytes_empty(self) -> None:
        self.assertEqual(crc32_bytes(b""), "00000000")

    def test_stream_crc_matches_bytes_crc(self) -> None:
        payload = b"streamed raw bytes\x00\xff" * 100

        self.assertEqual(crc32_stream(io.BytesIO(payload)), crc32_bytes(payload))

    def test_stream_processing_crosses_multiple_chunks(self) -> None:
        payload = bytes(range(256)) * 700
        stream = TrackingBytesIO(payload)

        result = crc32_stream(stream, chunk_size=1024)

        self.assertEqual(result, crc32_bytes(payload))
        self.assertGreater(len(stream.read_sizes), 2)
        self.assertTrue(all(size == 1024 for size in stream.read_sizes))
        self.assertEqual(DEFAULT_CHUNK_SIZE, 65536)


class CRC32FileEndpointTests(unittest.TestCase):
    client = TestClient(app)
    payload = b"123456789"

    def post_sample(self, filename: str = "example.txt"):
        return self.client.post(
            "/api/crc32/file",
            files={"file": (filename, self.payload, "application/octet-stream")},
        )

    def test_endpoint_returns_200(self) -> None:
        self.assertEqual(self.post_sample().status_code, 200)

    def test_endpoint_returns_uppercase_eight_character_crc(self) -> None:
        checksum = self.post_sample().json()["crc32"]

        self.assertIsNotNone(re.fullmatch(r"[0-9A-F]{8}", checksum))
        self.assertEqual(checksum, "CBF43926")

    def test_endpoint_reports_correct_filename(self) -> None:
        self.assertEqual(self.post_sample("example.txt").json()["filename"], "example.txt")

    def test_endpoint_reports_correct_size(self) -> None:
        self.assertEqual(self.post_sample().json()["size_bytes"], len(self.payload))

    def test_endpoint_accepts_empty_file(self) -> None:
        response = self.client.post(
            "/api/crc32/file",
            files={"file": ("empty.bin", b"", "application/octet-stream")},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["size_bytes"], 0)
        self.assertEqual(response.json()["crc32"], "00000000")

    def test_endpoint_does_not_persist_uploaded_file(self) -> None:
        filename = "crc32_endpoint_must_not_persist.bin"
        self.assertFalse(any(PROJECT_ROOT.rglob(filename)))

        response = self.post_sample(filename)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(any(PROJECT_ROOT.rglob(filename)))


if __name__ == "__main__":
    unittest.main()
