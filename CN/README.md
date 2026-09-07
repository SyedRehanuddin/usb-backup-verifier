# USB Backup Verification Utility

## Purpose

CRC-32 based USB backup integrity verification.

## Features

- Generate a trusted CRC-32 reference from a source folder.
- Verify clean, corrupted, missing, and extra backup files by relative path.
- Demonstrate five non-destructive error simulations.
- Keep up to 100 local verification-history records.
- Export current and saved verification results as in-memory CSV reports.

In the default `local` mode, all folder selectors use the native Windows directory chooser. Selected paths
remain in the local FastAPI process on `127.0.0.1`; the browser receives only an
opaque, short-lived selection ID and safe display metadata. File contents are
never sent through a browser folder upload or to an external service. The
application persists only reference and verification metadata in the `data`
directory.

## Requirements

- Python 3.12

## Install

```powershell
python -m pip install -r requirements.txt
```

## Run

```powershell
python web_app.py
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in a browser.

With no environment configuration, the server binds only to `127.0.0.1` and is not exposed publicly.

## Hosted demo mode

Render uses `USB_VERIFIER_MODE=demo`. In this mode the UI offers only the six
small datasets committed under `demo_data/`; the server never initializes
Tkinter and never accepts a browser-supplied filesystem path. The same Python
manifest, CRC-32, verifier, simulation, History, and CSV code paths remain in use.

Render blueprint commands are defined in the repository-root `render.yaml`
(with `CN` configured as the service root):

```text
Build: pip install -r requirements.txt
Start: uvicorn web_app:app --host 0.0.0.0 --port $PORT
```

## Test

```powershell
python -m unittest discover -s tests -p "test_*.py"
node --test tests/test_*.js
```

The optional `tests/showcase_audit.cjs` browser audit uses installed Playwright
and Edge, with `SHOWCASE_PYTHON` pointing to the Python executable. It starts an
isolated server on 127.0.0.1:8001 and keeps test data outside application storage.
It never clears the normal localhost application's saved data.
