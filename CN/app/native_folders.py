"""Native folder selection and short-lived server-side selection storage."""

from __future__ import annotations

import os
import secrets
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Literal


FolderPurpose = Literal["source", "backup"]
_DIALOG_LOCK = threading.Lock()


class FolderSelectionError(ValueError):
    """Raised when a native folder selection is missing or no longer usable."""


@dataclass(frozen=True)
class SelectedFolder:
    selection_id: str
    purpose: FolderPurpose
    path: Path
    name: str
    file_count: int
    relative_paths: tuple[str, ...]
    created_at: float


def choose_native_directory(purpose: FolderPurpose) -> Path | None:
    """Open the operating-system directory chooser and return its selected path."""
    title = "Select Trusted Source Folder" if purpose == "source" else "Select Backup Folder"
    try:
        import tkinter as tk
        from tkinter import filedialog
    except ImportError as exc:  # pragma: no cover - depends on Python installation
        raise FolderSelectionError("The native Windows folder picker is unavailable.") from exc

    with _DIALOG_LOCK:
        try:
            root = tk.Tk()
        except tk.TclError as exc:
            raise FolderSelectionError("The native Windows folder picker could not be opened.") from exc
        root.withdraw()
        try:
            root.attributes("-topmost", True)
            root.update_idletasks()
            selected = filedialog.askdirectory(parent=root, title=title, mustexist=True)
        except tk.TclError as exc:
            raise FolderSelectionError("The native Windows folder picker could not be opened.") from exc
        finally:
            root.destroy()

    return Path(selected) if selected else None


def scan_folder(root: Path) -> list[tuple[str, Path]]:
    """Return stable root-relative file paths without following links."""
    resolved_root = root.resolve(strict=True)
    if not resolved_root.is_dir():
        raise FolderSelectionError("The selected folder is no longer available.")

    entries: list[tuple[str, Path]] = []
    for current, directory_names, file_names in os.walk(resolved_root, followlinks=False):
        current_path = Path(current)
        directory_names[:] = sorted(
            (name for name in directory_names if not (current_path / name).is_symlink()),
            key=str.casefold,
        )
        for name in sorted(file_names, key=str.casefold):
            file_path = current_path / name
            if file_path.is_symlink() or not file_path.is_file():
                continue
            relative_path = file_path.relative_to(resolved_root).as_posix()
            entries.append((relative_path, file_path))

    entries.sort(key=lambda entry: (entry[0].casefold(), entry[0]))
    return entries


class FolderSelectionRegistry:
    """Map unguessable browser tokens to native paths for the local process."""

    def __init__(self, *, ttl_seconds: int = 14_400, maximum_entries: int = 64) -> None:
        self._ttl_seconds = ttl_seconds
        self._maximum_entries = maximum_entries
        self._selections: dict[str, SelectedFolder] = {}
        self._lock = threading.Lock()

    def _prune(self, now: float) -> None:
        expired = [
            key for key, value in self._selections.items()
            if now - value.created_at > self._ttl_seconds
        ]
        for key in expired:
            self._selections.pop(key, None)
        while len(self._selections) >= self._maximum_entries:
            oldest = min(self._selections.values(), key=lambda value: value.created_at)
            self._selections.pop(oldest.selection_id, None)

    def register(self, path: Path, purpose: FolderPurpose) -> SelectedFolder:
        if purpose not in {"source", "backup"}:
            raise FolderSelectionError("Invalid folder-selection purpose.")
        resolved = path.resolve(strict=True)
        entries = scan_folder(resolved)
        if not entries:
            raise FolderSelectionError("The selected folder contains no files.")
        now = time.monotonic()
        selection = SelectedFolder(
            selection_id=secrets.token_urlsafe(32),
            purpose=purpose,
            path=resolved,
            name=resolved.name,
            file_count=len(entries),
            relative_paths=tuple(relative_path for relative_path, _ in entries),
            created_at=now,
        )
        with self._lock:
            self._prune(now)
            self._selections[selection.selection_id] = selection
        return selection

    def resolve(self, selection_id: str, purpose: FolderPurpose) -> SelectedFolder:
        now = time.monotonic()
        with self._lock:
            self._prune(now)
            selection = self._selections.get(selection_id)
        if selection is None or selection.purpose != purpose:
            raise FolderSelectionError("The folder selection is invalid or expired.")
        if not selection.path.is_dir():
            raise FolderSelectionError("The selected folder is no longer available.")
        return selection

    def release(self, selection_id: str) -> None:
        with self._lock:
            self._selections.pop(selection_id, None)
