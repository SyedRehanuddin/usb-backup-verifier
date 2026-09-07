"""Runtime-mode and bundled demo-dataset configuration."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal


VerifierMode = Literal["local", "demo"]


@dataclass(frozen=True)
class DemoDataset:
    dataset_id: str
    label: str
    purpose: Literal["source", "backup"]
    path: Path


def get_verifier_mode() -> VerifierMode:
    """Return the explicit runtime mode, defaulting safely to localhost mode."""
    value = os.getenv("USB_VERIFIER_MODE", "local").strip().lower()
    if value not in {"local", "demo"}:
        raise RuntimeError("USB_VERIFIER_MODE must be either 'local' or 'demo'.")
    return value  # type: ignore[return-value]


def demo_dataset_registry(base_dir: Path) -> dict[str, DemoDataset]:
    """Return the complete allowlist of project-owned demo datasets."""
    root = (base_dir / "demo_data").resolve()
    definitions = (
        ("original_files", "Original Files", "source"),
        ("backup_clean", "Clean Backup", "backup"),
        ("backup_corrupted", "Corrupted Backup", "backup"),
        ("backup_missing", "Missing File Backup", "backup"),
        ("backup_extra", "Extra File Backup", "backup"),
        ("backup_mixed", "Mixed Issues Backup", "backup"),
    )
    return {
        dataset_id: DemoDataset(dataset_id, label, purpose, root / dataset_id)
        for dataset_id, label, purpose in definitions
    }
