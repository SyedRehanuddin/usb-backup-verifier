"""Isolated localhost server used by the showcase browser audit."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import web_app
import uvicorn
from fastapi import HTTPException

root = Path(os.environ["SHOWCASE_DATA"])
web_app.CURRENT_REFERENCE_PATH = root / "reference.json"
web_app.CURRENT_HISTORY_PATH = root / "history.json"
next_selection: Path | None = None


@web_app.app.post("/__test/folder/{folder_name}")
async def prepare_folder_selection(folder_name: str) -> dict[str, bool]:
    """Queue a test fixture for the otherwise-native chooser."""
    global next_selection
    if folder_name == "__cancel__":
        next_selection = None
        return {"ok": True}
    candidate = (root / folder_name).resolve()
    if candidate.parent != root.resolve() or not candidate.is_dir():
        raise HTTPException(status_code=404)
    next_selection = candidate
    return {"ok": True}


def choose_test_directory(_purpose: str) -> Path | None:
    global next_selection
    selected = next_selection
    next_selection = None
    return selected


web_app.choose_native_directory = choose_test_directory
uvicorn.run(web_app.app, host="127.0.0.1", port=8001)
