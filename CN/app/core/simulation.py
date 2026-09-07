"""Deterministic, non-destructive byte transformations for Error Lab."""

from __future__ import annotations

from collections.abc import Iterable


APPEND_BYTES = b"CRC_SIMULATION"
METHODS = {"modify-byte", "append-data", "truncate-file", "remove-file", "add-extra"}
TARGET_METHODS = {"modify-byte", "append-data", "truncate-file", "remove-file"}


class SimulationValidationError(ValueError):
    """Raised when an Error Lab simulation request cannot be performed."""


def simulate_bytes(method: str, source: bytes) -> bytes:
    """Return simulated bytes without changing the supplied baseline."""
    if method == "modify-byte":
        if not source:
            raise SimulationValidationError("Modify Byte requires a non-empty file.")
        output = bytearray(source)
        output[min(5, len(output) - 1)] ^= 0x01
        return bytes(output)
    if method == "append-data":
        return source + APPEND_BYTES
    if method == "truncate-file":
        if not source:
            raise SimulationValidationError("Truncate File requires a non-empty file.")
        remove_count = max(1, min(16, len(source) // 4))
        return source[:-remove_count]
    raise SimulationValidationError("The selected simulation does not mutate file bytes.")


def choose_extra_path(existing_paths: Iterable[str]) -> str:
    """Choose the same deterministic generated path used by the Error Lab UI."""
    occupied = {str(path).replace("\\", "/").casefold() for path in existing_paths}
    candidate = "simulation/extra_file.txt"
    suffix = 2
    while candidate.casefold() in occupied:
        candidate = f"simulation/extra_file_{suffix}.txt"
        suffix += 1
    return candidate

