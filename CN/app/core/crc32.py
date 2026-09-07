"""Reusable CRC-32 calculations for raw bytes and binary streams."""

from typing import BinaryIO
import zlib


DEFAULT_CHUNK_SIZE = 64 * 1024


def _format_crc32(value: int) -> str:
    """Format a CRC value as unsigned, uppercase, eight-digit hexadecimal."""
    return f"{value & 0xFFFFFFFF:08X}"


def crc32_bytes(data: bytes) -> str:
    """Calculate CRC-32 over an exact byte sequence."""
    return _format_crc32(zlib.crc32(data))


def crc32_stream(stream: BinaryIO, chunk_size: int = DEFAULT_CHUNK_SIZE) -> str:
    """Calculate CRC-32 incrementally from a binary stream.

    The stream is consumed from its current position through end-of-file.
    """
    checksum, _ = crc32_stream_details(stream, chunk_size)
    return checksum


def crc32_stream_details(
    stream: BinaryIO,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
) -> tuple[str, int]:
    """Return CRC-32 and byte count while consuming a binary stream in chunks."""
    if chunk_size <= 0:
        raise ValueError("chunk_size must be greater than zero")

    checksum = 0
    size_bytes = 0
    while chunk := stream.read(chunk_size):
        checksum = zlib.crc32(chunk, checksum)
        size_bytes += len(chunk)

    return _format_crc32(checksum), size_bytes
