"""Isolated hosted-demo server used by the browser regression audit."""

import os
import sys
from pathlib import Path

os.environ["USB_VERIFIER_MODE"] = "demo"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import uvicorn

import web_app


storage = Path(os.environ["DEMO_SHOWCASE_DATA"])
web_app.CURRENT_REFERENCE_PATH = storage / "reference.json"
web_app.CURRENT_HISTORY_PATH = storage / "history.json"
uvicorn.run(web_app.app, host="127.0.0.1", port=8002)
