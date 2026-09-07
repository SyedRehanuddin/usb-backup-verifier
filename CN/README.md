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

## Hosted static application

The independent `static_demo/` application is the Render-hosted presentation
version. It contains only HTML, CSS, and JavaScript:

- CRC-32 and verification run entirely in the browser.
- Chrome and Edge use `showDirectoryPicker()` after a user click; other browsers
  fall back to a directory-capable file input.
- Folders are read recursively as binary data while relative paths are preserved.
- Error Lab mutations use fresh in-memory byte arrays and never change selected files.
- Verification History is stored in the current browser's `localStorage`.
- Trusted references persist only file names, relative paths, sizes, and CRC values;
  file contents and directory handles are not persisted.
- CSV reports are generated on demand with browser `Blob` downloads.
- No FastAPI server, Python process, multipart upload, or remote file processing is used.
- Browser permission is required to read a selected folder; files remain on the device.

Bundled datasets remain in the repository only as automated test fixtures and
are not part of the normal hosted workflow.

The repository-root `render.yaml` declares a Render Static Site with `CN` as its
root and `static_demo` as its publish directory. The local Python application
and its native-folder workflow remain separate and unchanged.

To test the static version without FastAPI:

```powershell
python -m http.server 8004 --directory static_demo
```

Then open [http://127.0.0.1:8004](http://127.0.0.1:8004).

## Test

```powershell
python -m unittest discover -s tests -p "test_*.py"
node --test tests/test_*.js
```

`tests/static_demo_audit.cjs` exercises the static version in Edge and Chrome,
including all verification datasets, all Error Lab methods, History, CSV,
hash-route refreshes, and responsive layouts. It uses a basic static HTTP server
only and does not start FastAPI.

The optional `tests/showcase_audit.cjs` browser audit uses installed Playwright
and Edge, with `SHOWCASE_PYTHON` pointing to the Python executable. It starts an
isolated server on 127.0.0.1:8001 and keeps test data outside application storage.
It never clears the normal localhost application's saved data.
