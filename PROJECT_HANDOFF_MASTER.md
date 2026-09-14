# USB Backup Verification Utility — Master Project Handoff

> Audit date: 14 September 2026 (Asia/Calcutta)  
> Repository root audited: `C:\Users\Ayesha Nishath\OneDrive\Documents\ChatGPT\CN 2`  
> Application root: `CN\`  
> Scope: documentation/audit only. No application source, behavior, dependency declaration, deployment, or stored data was changed.

## 1. Project identity

| Item | Current source of truth |
|---|---|
| Project name | **USB Backup Verification Utility — CRC-32 Based Backup Integrity Verification** (externally confirmed; UI brand: USB Backup Verifier) |
| Course/subject | **Computer Networks** (externally confirmed; no course file is stored in the repository) |
| Product purpose | Generate a trusted CRC-32 reference for a source folder, compare a backup recursively, and classify files as Verified, Corrupted, Missing, or Extra. |
| Group number | **Group 2** (externally confirmed; not recorded in Git) |
| Faculty | **Dr. Aparna Sajeev** (externally confirmed; not recorded in Git) |
| Team size | **5** (externally confirmed; not recorded in Git) |
| Development status | Core product and presentation UI are implemented and heavily tested. A separate laboratory-style binary/text/manual CRC demonstration is not implemented. |
| Main problem solved | Detect accidental backup differences while preserving relative paths and nested directories. |
| Intended demo use | College demonstration of CRC-32 based integrity checking, controlled error simulation, history, and report export. |
| GitHub remote | `https://github.com/SyedRehanuddin/usb-backup-verifier.git` |
| Active branch | `main` |
| Audited HEAD | `6821b2408227959b72778f6672d3c9b775721378` (`Polish final About page`) |

### Externally confirmed project information

The following academic details were supplied separately from the repository and must be transferred with the report/presentation materials:

| # | Team member | Enrollment number |
|---:|---|---|
| 1 | Syed Rehanuddin | `2503A51037` |
| 2 | P. Nikhil | `2503A51038` |
| 3 | R. Nagavignesh | `2503A51039` |
| 4 | B. Abhinay | `2503A51040` |
| 5 | K. Hasini | `2503A51041` |

### Local application

The local application is the Python/FastAPI implementation under `CN\`. It runs on `127.0.0.1:8000`, opens Windows/Tkinter native directory dialogs, keeps opaque folder-selection tokens in the Python process, calculates CRC-32 with Python `zlib`, persists the trusted reference and verification history as JSON, and generates CSV on the backend.

### Hosted static demonstration

The deployed source is `CN\static_demo\`. It is a backend-independent HTML/CSS/JavaScript application. It uses the browser File System Access API (with a directory-input fallback), calculates CRC-32 in JavaScript, keeps reference/history metadata in browser `localStorage`, and creates CSV with a browser `Blob`. Render serves only static files; Python and the FastAPI APIs are not involved in the hosted request path.

### Deployment status and URL

The repository contains an active Render Static Site Blueprint in `render.yaml`. Git is synchronized with `origin/main`, which is the source Render is expected to deploy. **Externally confirmed current public URL:** `https://usb-backup-verifier-static.onrender.com`. The URL is not stored in repository configuration or README, so confirm the service connection in the Render dashboard after moving laptops. The hosted runtime is client-side HTML/CSS/JavaScript and performs CRC-32 in the browser; it does not use FastAPI or Python at runtime. It was moved from the earlier free Python Render Web Service to a Render Static Site specifically to avoid that service’s cold-start delay. Local browser QA against the exact deployed source directory passed.

### Computer Networks framing (externally confirmed)

CRC is a standard error-detection technique studied in Computer Networks. This project applies the same sender/receiver integrity principle at file level:

```text
Original / Sender Data
  → CRC generation
  → Transmission / Backup Copy
  → Receiver-side CRC calculation
  → Comparison
  → Valid or Error Detected
```

The utility demonstrates the error-detection layer for file transfer/backup integrity. It does **not** implement a complete socket-based network protocol. Socket-based sender/receiver integration is possible future work.

## 2. Current repository state

### State before creating the four handoff documents

```text
$ git status --short --branch
## main...origin/main

$ git branch --show-current
main

$ git remote -v
origin  https://github.com/SyedRehanuddin/usb-backup-verifier.git (fetch)
origin  https://github.com/SyedRehanuddin/usb-backup-verifier.git (push)

$ git rev-parse HEAD
6821b2408227959b72778f6672d3c9b775721378

$ git rev-list --left-right --count origin/main...main
0  0
```

The baseline working tree was clean: no modified, staged, or untracked files. `main` exactly matched `origin/main` (zero commits ahead and zero behind).

### Last ten available decorated commits

The repository currently has eight commits, so `git log -10` returns all eight:

```text
6821b24 (HEAD -> main, origin/main) Polish final About page
b09e854 Polish final Error Lab and History UI
6cec829 Polish page titles and results controls
b9276f9 Polish final Verification page UI
cac3194 Enable real folder selection in hosted static site
d2a0a77 Convert hosted demo to zero-cold-start static site
4d808ba Use free Render service plan
0162ba9 Prepare USB Backup Verifier for Render deployment
```

### State after this documentation task

Only these four requested files should be untracked until the owner approves a commit:

- `PROJECT_HANDOFF_MASTER.md`
- `NEW_LAPTOP_CODEX_START_PROMPT.txt`
- `PROJECT_FILE_MANIFEST.md`
- `NEW_LAPTOP_SETUP_CHECKLIST.md`

No tracked project file is intentionally modified by this audit. Do not commit or push these documents until explicitly approved.

## 3. Complete project tree

There are 119 tracked files. The worktree also contains ignored Python bytecode/cache files and empty visual-QA scratch directories; these are generated and must not be transferred manually.

```text
CN 2/                              Git repository root
├── .gitignore                     Ignore rules for environments, caches, builds, runtime JSON, QA artifacts
├── render.yaml                    Current Render Static Site Blueprint
├── PROJECT_HANDOFF_MASTER.md      This handoff (new, intentionally untracked)
├── PROJECT_FILE_MANIFEST.md       Transfer/file inventory (new, intentionally untracked)
├── NEW_LAPTOP_CODEX_START_PROMPT.txt
├── NEW_LAPTOP_SETUP_CHECKLIST.md
└── CN/                            Actual application root
    ├── README.md                  Run, architecture, hosted/static, and test overview
    ├── requirements.txt           Five direct Python dependencies
    ├── web_app.py                 Local FastAPI entry point and API route orchestration
    ├── app/
    │   ├── runtime.py             `local`/`demo` mode and allowlisted demo datasets
    │   ├── native_folders.py      Tkinter chooser, recursive scan, opaque selection registry
    │   └── core/
    │       ├── crc32.py           Python zlib CRC-32 byte/stream functions
    │       ├── manifest.py        Reference creation, validation, atomic JSON persistence
    │       ├── verifier.py        Backup records, comparison, classification
    │       ├── simulation.py      Deterministic non-destructive Error Lab byte operations
    │       ├── history.py         Validated/atomic local JSON history (max 100)
    │       └── report.py          Safe UTF-8 BOM CSV generation and filenames
    ├── templates/index.html       Local FastAPI/Jinja application shell (four views/dialogs)
    ├── static/
    │   ├── css/styles.css         Local application design system/responsive rules
    │   └── js/
    │       ├── app.js             Local UI state machine; talks to FastAPI
    │       ├── history.js         Search/filter/sort/detail helper functions
    │       ├── simulation.js      Browser presentation helpers for simulations
    │       ├── select-picker.js   Reusable accessible dark select/listbox
    │       ├── target-picker.js   Accessible Error Lab target picker
    │       └── verification-results.js  File-result filtering helper
    ├── static_demo/
    │   ├── index.html             Deployed static four-view application shell
    │   ├── css/styles.css         Hosted design system/responsive rules
    │   ├── js/
    │   │   ├── app.js             Hosted state machine, routing, UI rendering, persistence calls
    │   │   ├── crc32.js           Table-based browser CRC-32
    │   │   ├── folder-selection.js Browser directory picker + fallback recursion
    │   │   ├── verification.js    Browser dataset construction/comparison/history record creation
    │   │   ├── simulation.js      Immutable byte transformations
    │   │   ├── error-lab.js       Fresh-baseline Error Lab orchestration
    │   │   ├── history-store.js   `localStorage` history and Blob CSV export
    │   │   ├── history.js         Search/filter/sort/detail utilities
    │   │   ├── select-picker.js   Reusable accessible dark select/listbox
    │   │   ├── target-picker.js   Error Lab target listbox adapter
    │   │   ├── verification-results.js Result filtering helper
    │   │   └── demo-data.js       Legacy test/demo loader; not loaded by deployed HTML
    │   └── demo_data/             Mirrored fixture folders used by automated tests, not normal hosted UI
    ├── demo_data/                 Local/backend fixture folders (six scenarios)
    ├── data/
    │   ├── manifests/current_reference.json       Committed older sample/runtime manifest
    │   ├── history/verification_history.json      Committed older sample/runtime history (32 records)
    │   └── reports/                              Runtime directory; reports are not persisted
    └── tests/
        ├── test_crc32.py, test_manifest.py, test_verifier.py
        ├── test_native_folders.py, test_demo_mode.py, test_history.py
        ├── test_report.py, test_web_app.py, test_about.py
        ├── test_history_ui.js, test_select_picker.js, test_simulation.js
        ├── test_static_demo.js, test_verification_results.js
        ├── static_demo_audit.cjs                  Current deployed-static Edge/Chrome E2E audit
        ├── showcase_audit.cjs / showcase_server.py
        ├── demo_showcase_audit.cjs / demo_showcase_server.py
        └── target_picker_states.mjs, error_lab_method_states.mjs,
            error_lab_post_run_states.mjs          Reusable browser-audit state checks
```

`CN\.m5-caret-qa`, `CN\.m5-qa`, `CN\.post-run-qa`, `CN\.target-picker-qa`, and `CN\.verification-filter-qa` are ignored QA scratch directories. `__pycache__` and `.pyc` files are ignored generated files.

## 4. Project architecture

### Local runtime

```text
User on Windows
  ↓ opens http://127.0.0.1:8000
Jinja-rendered browser UI (`templates/index.html` + `static/`)
  ↓ POST /api/folders/select
FastAPI (`web_app.py`)
  ↓ Tkinter native directory chooser
FolderSelectionRegistry (opaque purpose-bound token; path remains server-side)
  ↓ `scan_folder()` recursively yields POSIX relative paths + local Paths
Python core
  ├─ `zlib.crc32` → trusted manifest → atomic JSON
  ├─ `zlib.crc32` → backup records → classification
  ├─ fresh BytesIO transformations → Error Lab result
  ├─ validated atomic JSON → History
  └─ validated history record → in-memory UTF-8 CSV response
  ↓
Browser renders workflow, totals, file table, filters, History, and CSV download
```

### Hosted runtime

```text
User on HTTPS Render Static Site
  ↓
`static_demo/index.html` + CSS + vanilla JavaScript (no backend)
  ↓ click folder button
`showDirectoryPicker()` OR hidden `webkitdirectory` fallback
  ↓ recursive File.arrayBuffer() reads → Uint8Array + root-relative path
Browser modules
  ├─ table-based CRC-32 (`0xEDB88320`)
  ├─ reference metadata → localStorage (no file bytes/handle persisted)
  ├─ backup comparison → classifications/results
  ├─ fresh in-memory Error Lab clone → classifications/results
  ├─ History records → localStorage (max 100)
  └─ CSV string → Blob → object URL → download
  ↓
Same four conceptual views and workflow, entirely inside the browser
```

### Responsibility summary

- FastAPI is the local HTTP/API coordinator, not the deployed runtime.
- Python core modules are the local integrity-processing source of truth.
- Hosted JavaScript independently implements equivalent CRC/reference/comparison concepts.
- Local and hosted markup/styles are separate trees and can diverge. A UI change must be deliberately scoped.
- Render publishes `CN/static_demo`; it does not install Python dependencies.

## 5. Local application

### Startup and technology

- Entry point: `CN/web_app.py`.
- Framework: FastAPI, Starlette, Uvicorn, Jinja2, Pydantic.
- Frontend: one server-rendered HTML shell plus vanilla JavaScript and CSS; navigation uses client-side views/hash state.
- Start from `CN\`: `python web_app.py`.
- Default bind: `127.0.0.1:8000`.
- When `USB_VERIFIER_MODE=demo` or `PORT` exists, direct execution binds to `0.0.0.0`; this is historical/demo support, not current Render deployment.
- Local page routes are logical hash routes: `/#verification`, `/#error-lab`, `/#history`, `/#about`.

### Backend endpoint map

| Method | Path | Input | Output | Purpose |
|---|---|---|---|---|
| GET | `/` | Request | Jinja HTML | Render the local application shell with `app_mode`. |
| GET | `/api/health` | None | status/service/mode and optional demo choices | Health and runtime-mode discovery. |
| POST | `/api/folders/select` | JSON `{purpose, dataset_id?}` | safe name/count/relative paths/opaque `selection_id`, or `{selected:false}` | In local mode opens native chooser; in demo mode selects only an allowlisted fixture. |
| DELETE | `/api/folders/{selection_id}` | Token in path | HTTP 204 | Release a short-lived folder token. |
| POST | `/api/crc32/file` | multipart `file` | filename, byte size, uppercase CRC-32 | Calculate one file CRC without persisting content. |
| POST | `/api/reference/generate` | multipart files + relative paths + source name | reference metadata | Compatibility/upload route; builds and saves a trusted manifest. Primary local UI now uses the selected-folder route. |
| POST | `/api/reference/generate-selected` | JSON `{selection_id}` | reference metadata | Resolve a source token, rescan/open files, generate/save manifest. |
| GET | `/api/reference/current` | None | `{exists:false}` or full validated manifest | Restore current saved-reference metadata. |
| POST | `/api/verification/run` | multipart files + paths + backup name + optional record flag | verification response | Compatibility/upload route. Primary local UI uses selected-folder route. |
| POST | `/api/verification/run-selected` | JSON `{selection_id, record_history}` | summary, rows, time, optional history ID | Rescan selected backup and verify against saved manifest. |
| POST | `/api/error-lab/run-selected` | JSON `{selection_id, method, target_path?}` | verification response plus `simulation` | Perform one fresh, non-destructive controlled mutation. |
| GET | `/api/history` | None | newest-first summaries | List local JSON history without result rows. |
| DELETE | `/api/history` | None | deleted count | Atomically clear history only. |
| GET | `/api/history/{record_id}` | History ID | full record | Load one verification detail. |
| GET | `/api/history/{record_id}/csv` | History ID | attachment response | Build and download CSV from the stored record. |

### Folder selection and Windows behavior

`app.native_folders.choose_native_directory()` imports Tkinter, creates a hidden topmost root, and calls `filedialog.askdirectory(..., mustexist=True)`. This requires a desktop-capable Python/Tk installation and a Windows GUI session. It is not suitable for a headless hosted server.

`scan_folder()` resolves the selected directory, recursively walks without following links, removes symlinked directories, skips symlinked/non-file entries, converts paths to `/`-separated root-relative form, and returns a stable case-insensitive ordering. `FolderSelectionRegistry` stores the real path only in memory behind a `secrets.token_urlsafe(32)` token. Tokens are purpose-bound (`source` or `backup`), live four hours by default, and the registry is capped at 64 entries.

The local UI never receives an absolute folder path. It receives only the selected root name, file count, relative paths, and opaque ID. It calls `release_folder` when a selection is discarded.

### Reference, CRC, comparison, History, CSV, and Error Lab

- `web_app._generate_reference_from_streams()` delegates to `build_manifest()` and `save_manifest_atomic()`.
- `web_app._verify_from_streams()` loads the saved manifest, calls `verify_backup()`, and optionally calls `append_history_record()`.
- Python CRC reads streams in 64 KiB chunks using `zlib.crc32`.
- Reference path: `CN/data/manifests/current_reference.json`.
- History path: `CN/data/history/verification_history.json`; max 100 newest records.
- Reports are not persisted. `generate_csv_report()` returns bytes for the HTTP response.
- Error Lab reads the selected clean baseline again for every run, substitutes temporary `BytesIO` streams or omits/adds a path, then invokes the normal verifier with history disabled.

### Validation and security controls

- Folder/root names reject empty, dot, traversal, slash, NUL, and drive-prefix values.
- Relative paths normalize `\` to `/`, reject absolute/traversal/empty segments, and reject duplicate case-folded paths.
- Native scans do not follow symlinks.
- Stored manifests/history are schema-validated and whitelisted before use.
- Manifests and History use temp-file + flush + `fsync` + `os.replace` atomic writes.
- History stores metadata, CRCs, sizes, and relative paths, never file bytes or absolute paths.
- CSV fields beginning with spreadsheet formula characters are prefixed with `'`.
- Errors returned to the browser use restrained messages rather than filesystem internals.

## 6. Hosted static application

### Runtime architecture and modules

`CN/static_demo/index.html` loads a self-contained dark UI and these global/IIFE modules:

| Module | Responsibility |
|---|---|
| `js/crc32.js` | Generate a 256-entry reflected CRC table and calculate uppercase 8-digit CRC-32 from `Uint8Array`. |
| `js/folder-selection.js` | Open `showDirectoryPicker({mode:"read"})`, recurse directory handles, or use a hidden `webkitdirectory` input fallback. |
| `js/verification.js` | Turn selected bytes into CRC datasets, compare source/backup maps, and create history records. |
| `js/simulation.js` | Immutable Modify/Append/Truncate byte helpers, path helpers, Run/Run Again label. |
| `js/error-lab.js` | Clone the backup baseline and run M1–M5 through the same browser comparator. |
| `js/history-store.js` | Read/write/clear max-100 localStorage records and export CSV Blob downloads. |
| `js/history.js` | History metrics, search, status filter, sort, timestamps, and detail filtering. |
| `js/select-picker.js` | Reusable ARIA dark listbox for result, History status/sort, and History detail filters. |
| `js/target-picker.js` | Error Lab target-file custom listbox backed by a hidden select. |
| `js/verification-results.js` | Filter visible result rows without changing totals. |
| `js/app.js` | Own all view state, workflow invalidation, dialogs, rendering, hash routing, and event listeners. |

`js/demo-data.js` can load bundled fixture paths, but the current deployed HTML does not load it. Normal hosted operation uses real user-selected folders. The automated test harness reads mirrored `static_demo/demo_data` files to mock directory handles.

### Browser folder permissions and persistence

- Preferred: `window.showDirectoryPicker()` in supported secure-context Chromium browsers (Chrome/Edge on HTTPS or localhost).
- Fallback: hidden `<input type="file" webkitdirectory>`; the browser may use upload-oriented permission wording even though processing remains local.
- Both paths read each file as an `ArrayBuffer`, copy to `Uint8Array`, preserve nested root-relative paths, and sort them.
- Cancellation leaves the current selection unchanged. Permission denial produces a clear local message.
- Directory handles and selected file bytes are not persisted. Current selections disappear on refresh.
- Saved reference key: `usb-backup-verifier.static-reference.v1`. It contains metadata only: source name, created time, file count, relative path, size, and CRC.
- History key: `usb-backup-verifier.static-history.v1`. It contains at most 100 complete result records.
- Clearing History removes only the history key. The reference key remains.

### Routing and APIs

The hosted views are hash routes: `#verification`, `#error-lab`, `#history`, and `#about`. `showView()` toggles the four view containers and resets page scroll. There is no hosted API, Python process, multipart submission, telemetry, analytics, remote database, or external storage. Browser audit asserts all requests stay on the static origin and none contains `/api/` or `/demo_data/`.

### Local-only, hosted-only, and conceptually shared

| Local only | Hosted only | Shared conceptually |
|---|---|---|
| FastAPI/Uvicorn/Jinja; Tkinter picker; opaque token registry; Python zlib; JSON files; backend CSV route; `local`/`demo` modes | `showDirectoryPicker`; hidden directory input fallback; JS table CRC; browser `localStorage`; Blob download; hash-only static hosting | Four pages; source → reference → backup → verify; same four classifications; nested paths; five non-destructive Error Lab methods; History/filter/export UX |

## 7. CRC implementation

### Algorithms actually present

| Algorithm | Implemented? | Evidence |
|---|---:|---|
| CRC-32 | Yes | Python `app/core/crc32.py`; browser `static_demo/js/crc32.js`; tests in `test_crc32.py` and `test_static_demo.js`. |
| CRC-3 | No | No implementation, polynomial, function, or test exists. |
| CRC-4 | No | No implementation, polynomial, function, or test exists. |
| CRC-8 | No | No implementation, polynomial, function, or test exists. |

### Python CRC-32

- File: `CN/app/core/crc32.py`.
- Functions: `_format_crc32()`, `crc32_bytes()`, `crc32_stream()`, `crc32_stream_details()`.
- Input: exact `bytes` or a binary stream from its current position to EOF.
- Processing: `zlib.crc32`; streams are read in `DEFAULT_CHUNK_SIZE = 64 * 1024` chunks, passing the previous checksum into the next call.
- Output: unsigned (`& 0xFFFFFFFF`), uppercase, zero-padded eight-character hexadecimal string; detail form also returns byte count.
- Standard check value: `crc32_bytes(b"123456789") == "CBF43926"`; empty bytes produce `00000000`.
- Polynomial: Python delegates to zlib’s standard reflected CRC-32 implementation. The usual generator is `0x04C11DB7`; its reflected processing representation is `0xEDB88320`. The Python source does not manually perform polynomial division.

### Browser CRC-32

- File: `CN/static_demo/js/crc32.js`.
- Function: `crc32(bytes)`.
- Input: `Uint8Array` only; other types throw `TypeError`.
- Table generation: for each value 0–255, process eight bits using `(value & 1) ? 0xEDB88320 ^ (value >>> 1) : value >>> 1`.
- Processing: initialize `0xFFFFFFFF`, table-update each byte, final XOR with `0xFFFFFFFF`, convert unsigned to uppercase hex padded to eight characters.
- Output matches Python for the standard vector and every current fixture asserted by tests.

### Manual polynomial CRC versus this project

A manual educational CRC commonly appends zero bits to a binary message, performs modulo-2 long division with a selected generator bit pattern using XOR, produces a short remainder, appends it to a sender codeword, and divides again at the receiver. This repository does **not** implement that sender/codeword/receiver demonstration and has no selectable CRC-3/4/8 polynomial logic. Python delegates to optimized zlib, while JavaScript implements an optimized lookup-table form of the reflected CRC-32 recurrence. Both operate on bytes and produce a fixed 32-bit checksum rather than displaying long-division steps.

## 8. CRC lab / binary / text / file support

| Feature | File/function | Input → process → output | Status |
|---|---|---|---|
| Raw binary bytes | `crc32.py: crc32_bytes`; `crc32.js: crc32` | bytes/Uint8Array → CRC-32 → 8 hex digits | Implemented |
| Binary stream/file | `crc32.py: crc32_stream_details`; API `/api/crc32/file` | stream → chunked zlib CRC + byte count | Implemented locally |
| Folder files | `native_folders.scan_folder`; `folder-selection.enumerateHandle/enumerateFileInput` | recursive files → relative paths + bytes/streams → CRC metadata | Implemented |
| Text files | Same file pipeline | Text is treated as its encoded file bytes; no separate text-entry widget | Partially covered as files |
| Text-to-binary/ASCII visualization | None | No bit-string display or educational conversion | **MISSING / TO BE IMPLEMENTED** |
| Binary bit-string input | None | No validation or polynomial division UI | **MISSING / TO BE IMPLEMENTED** |
| Sender CRC / remainder | None | No sender-specific workflow | **MISSING / TO BE IMPLEMENTED** |
| Codeword generation | None | No message+remainder bit codeword | **MISSING / TO BE IMPLEMENTED** |
| Receiver verification | None | No divide-received-codeword/remainder-zero lab | **MISSING / TO BE IMPLEMENTED** |
| Intentional bit corruption | `simulation.modifyByte` / `simulate_bytes` | XOR one bit (`0x01`) in a copied byte | Implemented as file simulation, not a manual CRC bit lab |
| CRC-3/CRC-4/CRC-8 demo | None | No polynomial or output | **MISSING / TO BE IMPLEMENTED** |
| Dashboard ↔ named Python function demonstration | Local UI calls FastAPI, which calls Python functions; no explicit educational input/output dashboard for arbitrary binary/text | Indirectly present, not a lab-specific demonstration | **MISSING / TO BE IMPLEMENTED if required by rubric** |

## 9. Backup verification engine

### Local algorithm

1. Validate a safe source/backup root name.
2. Normalize every path to root-relative POSIX form and reject traversal, absolutes, NUL, empty segments, or case-insensitive duplicates.
3. Read every file stream, calculate CRC-32 and byte size, and deterministically sort by relative path.
4. Build dictionaries keyed by the complete relative path (not basename).
5. Sort the union of source and backup paths case-insensitively with exact-path tie-breaker.
6. Classify each path:
   - **Extra:** no source record, backup record exists.
   - **Missing:** source record exists, no backup record.
   - **Verified:** both exist **and both CRC-32 and byte size are equal**.
   - **Corrupted:** both exist but CRC or size differs.
7. Return counts and a row with filename, relative path, both CRCs, and both sizes (null where absent).

Files: `app/core/verifier.py`; functions `_index_records()`, `build_backup_records()`, `compare_records()`, `verify_backup()`.

### Hosted algorithm and important difference

`static_demo/js/verification.js` uses `datasetFromFiles()` and `compare()`. It maps by full relative path and uses the same Missing/Extra rules, but marks a common path Verified when CRC values match and Corrupted when CRC values differ. It does **not explicitly include the local comparator’s additional size-equality condition**. Sizes are still stored/displayed. A rare CRC collision combined with a size difference would therefore be Corrupted locally but could appear Verified in the static app. Current fixtures/tests do not exhibit this case.

### Collision limitation

CRC-32 is excellent for accidental-error detection but is not collision-resistant or tamper-proof. Different content can theoretically share a CRC. This utility must not be described as cryptographic authentication, malware detection, or proof against a deliberate attacker.

## 10. Reference / manifest system

### Local manifest

- Creation: `build_manifest()` calculates per-file path, size, and CRC; adds `manifest_version: 1`, `algorithm: "CRC-32"`, source name, UTC `created_at`, file count, and total size.
- Storage: `CN/data/manifests/current_reference.json` via atomic replacement.
- Restore: GET `/api/reference/current` validates the entire document before returning it.
- Replace: selecting a source and confirming the UI replacement calls generation again and atomically replaces the one current file.
- Refresh: saved JSON remains; ephemeral folder-selection tokens/browser selection UI do not represent a reselected source.
- Clear Selection: clears current browser selections/results, not the saved reference.
- Clear History: writes an empty History document only; reference is preserved.
- There is no reference-delete endpoint/UI in current code. Replacing it is supported; manual deletion of the runtime JSON is not an application workflow.

### Hosted reference

- Key: `usb-backup-verifier.static-reference.v1`.
- Builder: `referenceSnapshot()` in `static_demo/js/app.js` after `StaticVerification.datasetFromFiles()`.
- Stored fields: `version`, `exists`, source name/count/size/time and each file’s basename, relative path, size, CRC.
- Explicitly not stored: selected bytes, `FileSystemDirectoryHandle`, absolute paths.
- Refresh: metadata is restored and shown as Ready; current source/backup selections disappear.
- Replace: confirmation replaces the localStorage item and invalidates current verification.
- Clear History: removes only `usb-backup-verifier.static-history.v1`; reference survives.

### Important current checkout caveat

The committed `CN/data/manifests/current_reference.json` describes an older five-file dataset totaling 428 bytes. Current `CN/demo_data/original_files` totals only 68 bytes. The JSON is valid historical/sample runtime state but is stale relative to current compact fixtures. Generate a new local reference before demonstrating the current fixture folders. The hosted static app does not read this Python JSON file.

## 11. Error Simulation Lab

Every simulation starts from a fresh copy/read of the selected backup baseline. Re-running never stacks mutations and real selected files are never written.

| Method | Implementation | Target | Operation | Expected result/count |
|---|---|---|---|---|
| M1 Modify Byte | Python `simulate_bytes`; JS `modifyByte`; hosted `StaticErrorLab.run` | Required, non-empty | Copy bytes; XOR `0x01` at index `min(5, len-1)` | One Corrupted: `4/1/0/0` on clean five-file baseline |
| M2 Append Data | Python/JS append helpers | Required | Append ASCII bytes `CRC_SIMULATION` | One Corrupted: `4/1/0/0` |
| M3 Truncate File | Python/JS truncate helpers | Required, non-empty | Remove `max(1, min(16, floor(len/4)))` trailing bytes | One Corrupted: `4/1/0/0` |
| M4 Remove File | Route/orchestrator omits selected path | Required | Exclude it only from transient comparison | One Missing: `4/0/1/0` |
| M5 Add Extra File | `choose_extra_path()` + orchestrator | Not required | Add copied bytes at `simulation/extra_file.txt` (suffix if occupied) | One Extra: `5/0/0/1` |

Python: `app/core/simulation.py` and `web_app.run_error_lab_from_selection()`. Hosted: `static_demo/js/simulation.js` and `static_demo/js/error-lab.js`.

Displayed output includes expected/detected status badges, target or generated file path, reference and simulated CRC values where applicable, original/simulated size, and Verified/Corrupted/Missing/Extra totals. M5 labels its output `GENERATED FILE`; Step 03 is informational/non-focusable and says the file is automatically generated. A successful first run changes `Run Simulation` to `Run Again`. Changing method/target clears the result and returns Step 04 to Not Run.

## 12. Test datasets

Two byte-identical fixture trees exist: `CN/demo_data` for Python/local tests and `CN/static_demo/demo_data` for static tests. The deployed HTML does not load bundled data during normal use.

### Current original files

| Relative path | Current content/description | Bytes | Current CRC-32 |
|---|---|---:|---|
| `attendance.csv` | `name,present\nAyesha,yes\n` | 24 | `9BF38318` |
| `config.json` | `{"safe":true}\n` | 14 | `6315717E` |
| `image.png` | 11-byte binary PNG-like fixture | 11 | `C46B5B31` |
| `nested/lab_record.bin` | five binary bytes (`00 01 02 FF 03`) | 5 | `7737E8DE` |
| `notes.txt` | `project notes\n` | 14 | `DB5C99B6` |

### Scenario folders

| Dataset | Actual difference | Expected Verified / Corrupted / Missing / Extra |
|---|---|---|
| `original_files` | Trusted baseline, five files including nested binary | Reference source |
| `backup_clean` | Byte-for-byte same paths/content | **5 / 0 / 0 / 0** |
| `backup_corrupted` | `attendance.csv` is `changed attendance\n` (19 bytes, CRC `D6C763EA`) | **4 / 1 / 0 / 0** |
| `backup_missing` | `image.png` omitted | **4 / 0 / 1 / 0** |
| `backup_extra` | Adds `extra_file.txt` containing `extra\n` (6 bytes, CRC `0F42AC49`) | **5 / 0 / 0 / 1** |
| `backup_mixed` | Omits `image.png`; changes `notes.txt` to `changed\n` (8 bytes, CRC `6F1CEEAC`); adds same extra file | **3 / 1 / 1 / 1** |

All five backup tests confirm `nested/lab_record.bin` remains Verified and its nested path is preserved.

Externally confirmed final screenshots demonstrate the same five totals shown above, and all five Error Simulation Lab detection paths were successfully validated for the final presentation set.

## 13. Test suite

### Python tests (129/129 passed)

Command from `CN\`:

```powershell
python -m unittest discover -s tests -p "test_*.py"
```

Audit result: `Ran 129 tests in 10.391s — OK`. The audit used a disposable temp virtual environment populated from the unchanged `requirements.txt`, then removed it. FastAPI emitted a non-failing Starlette deprecation warning about the `httpx` TestClient integration.

| Test file | Main coverage |
|---|---|
| `test_crc32.py` | Standard/empty vectors, chunked streams, file endpoint format/size/no persistence. |
| `test_manifest.py` | Generation, nested/duplicate basenames, sorting, totals, atomic replace, invalid paths/duplicates, API lifecycle. |
| `test_verifier.py` | All four classes, mixed case, nested roots, deterministic order, CRC+size, API failures/no persistence. |
| `test_native_folders.py` | Cancel, opaque safe metadata, recursive scan, all datasets, token purpose, fresh non-destructive lab. |
| `test_demo_mode.py` | Allowlisted historical FastAPI demo mode, all scenarios, Error Lab fresh baseline. |
| `test_history.py` | Validation, UUID, 100 cap, atomic writes, endpoints, opt-in persistence, clear/reference preservation. |
| `test_report.py` | Both clean/mixed live endpoint output, exact presentation schema, local time, BOM, quoting, Unicode, formula safety. |
| `test_web_app.py` | Shell/health, control states, accessible pickers, Error Lab/History markup/state contracts, clear scroll behavior. |
| `test_about.py` | Local About content, concise workflow/status, removed developer details, real client view. |

### JavaScript tests (38/38 passed)

Command used from `CN\`:

```powershell
node --test tests/test_history_ui.js tests/test_select_picker.js tests/test_simulation.js tests/test_static_demo.js tests/test_verification_results.js
```

Coverage: History metrics/search/filter/sort/date/detail filters; select placement; all immutable simulation helpers; CRC standard/current fixture values; all static verification totals; static CSV safety; directory handle/fallback/cancel behavior; absence of hosted backend calls; result filters preserving totals.

### Browser audit (104 checks passed)

`tests/static_demo_audit.cjs` started a local static server and ran installed Playwright against system Edge and Chrome. Audit result: `Static browser-folder audit: 104 checks passed`.

It covers real-folder mocks, all five backup totals, nested paths, all filters, CSV downloads, permission cancel/denial, History/search/sort/detail/clear, all five Error Lab methods, reference refresh behavior, four hash routes, console/network assertions, Edge and Chrome, and no horizontal overflow at 1920×1080, 1600×900, 1366×768 (plus About at 390×844).

### Other browser harnesses

- `showcase_audit.cjs` + `showcase_server.py`: isolated local FastAPI browser audit on port 8001.
- `demo_showcase_audit.cjs` + `demo_showcase_server.py`: historical FastAPI demo-mode audit on port 8002.
- The `.mjs` files provide detailed target picker and Error Lab state checks used by browser harnesses.
- There is no CI workflow or explicit remote deployment smoke-test file. `STATIC_DEMO_BASE` can point `static_demo_audit.cjs` at a deployed origin.

Total during this audit: **167/167 unit/backend tests plus 104/104 browser checks**.

## 14. Known CRC values / demonstration values

### Current repository fixture values

- Standard CRC-32 check string `123456789` → `CBF43926`.
- Empty bytes → `00000000` (Python test).
- `attendance.csv` → `9BF38318`; corrupted counterpart → `D6C763EA`.
- `config.json` → `6315717E`.
- `image.png` → `C46B5B31`.
- `nested/lab_record.bin` → `7737E8DE`.
- `notes.txt` → `DB5C99B6`; mixed counterpart → `6F1CEEAC`.
- `extra_file.txt` → `0F42AC49`.
- Current Error Lab examples measured from current bytes: M1 image → `0F378894`; M2 append to notes → `5C5147B0`; M3 truncate config → `D215355F`.

### Historical/stale committed persistence values

`CN/data/manifests/current_reference.json` and its 32 History records reference an older, larger dataset:

| Path | Historical bytes | Historical CRC |
|---|---:|---|
| `attendance.csv` | 82 | `698D326E` |
| `config.json` | 104 | `6151DE0F` |
| `image.png` | 68 | `04854B63` |
| `nested/lab_record.bin` | 77 | `E5DB1CBA` |
| `notes.txt` | 97 | `628D107E` |

Historical issue rows also contain `26198BC3` for an older corrupted attendance file and `9C4AF12C` for an older mixed notes file. Do not present these as checksums of the current compact fixture files.

## 15. User interface

### Overall design

Both versions use a premium restrained dark navy/graphite theme, fixed desktop sidebar, top page title, card-based workspace, blue primary/action focus, green Verified/selected states, restrained red Corrupted, amber Missing/warnings, and blue Extra. Inline SVG icons avoid external assets. Custom dark listboxes replace native white select popups and provide ARIA/keyboard handling. Desktop/laptop widths are the primary presentation target; responsive rules prevent horizontal overflow and collapse layouts on smaller screens. **Externally confirmed design intent:** laptops or desktop browsers are preferred for demonstrations, and mobile is not the intended presentation environment. The mobile layout remains functional but is not a dedicated mobile product experience.

### Verification

- Inputs: trusted source and backup folder selectors.
- Actions: Select/Change Source, Generate/Replace Reference, Select/Change Backup, Verify/Verify Again, Clear Selection, status filter, Export CSV.
- Workflow: Source, Reference, Backup, Verify with selected/ready/not-run/complete/issues states.
- Output: summary cards, issue-aware action message, filterable detail rows and CRCs. Pre-verification summaries show em dashes, not fake zero results.
- Filters: All Files, Verified, Corrupted, Missing, Extra; filtering never changes summary totals.
- Empty states explain whether a reference or backup is still needed and whether a selected filter has no rows.
- Clean completion says backup verified successfully; issue completion says backup issues detected and visually emphasizes only the mismatching backup CRC.

### Error Lab

- Steps: reference prerequisite, backup selection, method selection, target (or M5 informational state), run.
- M1–M4 require a custom target picker; M5 explicitly requires no target.
- Buttons: Select/Change Backup Folder, Run Simulation/Run Again, Reset Lab, Go to Verification if no reference.
- Outputs: expected result detected, method/target, CRC/size cards, totals.
- Disabled/unselected/selected method cards have distinct semantic visuals and keyboard selection.

### History

- Metrics: total, clean, with issues.
- Toolbar: Search history, custom Status (All/Clean/Issues), custom Sort (Newest/Oldest), result count.
- List: overall badge, backup/reference/time/counts, View Details.
- Details: metadata, totals, file-status filter, rows, CSV export, close with focus/scroll restoration.
- Clear: destructive confirmation dialog, reference-preservation copy, success banner, true scroll-owner reset after success.
- Empty/filter-empty states include Go to Verification where appropriate.

### About

Explains product purpose/privacy, four-step workflow, status meanings, CRC-32 limitations, key features, and Error Lab methods. Hosted About wording says files are processed only in the browser session and not uploaded. Version/mode/deployment badges were intentionally removed from the hosted page.

## 16. Verification History

### Local

- Storage: validated JSON at `CN/data/history/verification_history.json`.
- Maximum: 100 newest records (`MAX_HISTORY_RECORDS`).
- Fields: ID, check time, reference source and creation time, backup name, summary, overall status, and full ordered results containing status/path/CRCs/sizes.
- `append_history_record()` prepends, deduplicated identity is caller-generated UUID, and writes atomically under a process lock.
- List API omits detail rows; detail API fetches one record.
- UI search matches backup/reference names, status filters clean/issues, and sort toggles newest/oldest.
- Clear History preserves the trusted manifest.

### Hosted

- Storage key: `usb-backup-verifier.static-history.v1`.
- `StaticHistoryStore.write()` truncates to 100; `add()` prepends and removes same-ID duplicates.
- Search/filter/sort/detail behavior mirrors local UI concepts.
- Clearing removes the history localStorage key, preserves reference key, updates metrics, and scrolls `document.scrollingElement || document.documentElement` to exactly zero after two animation frames.
- Browser storage is origin/profile-specific. Clearing site data, private browsing, or another browser/device loses hosted History.

Current checkout note: the committed local JSON contains 32 older records. Hosted browser History is not represented by that file and will not migrate through Git.

## 17. CSV export

### Local Python

- File/functions: `app/core/report.py` → `generate_csv_report()`, `_format_local_timestamp()`, `spreadsheet_safe_text()`, `safe_report_filename()`.
- Runtime route: `web_app.history_csv()` at GET `/api/history/{record_id}/csv`.
- Source: a validated stored History record; the current Verification button exports the just-created history record.
- Encoding: UTF-8 with BOM; CRLF; standard `csv.writer` quoting.
- Metadata: Verification ID, Checked At (`DD Mon YYYY at hh:mm AM/PM` in local timezone), Reference Source, Backup Name, Overall Status, Algorithm.
- Summary: Verified, Corrupted, Missing, Extra, Total Results.
- Detail headings: Status, File Name, Relative Path, Source CRC-32, Backup CRC-32, Source Size (Bytes), Backup Size (Bytes).
- Missing/Extra unavailable fields are blank. User-controlled spreadsheet formula prefixes are neutralized.
- Filename: `usb_backup_verification_<safe_backup>_<YYYY-MM-DD_HHMMSS>.csv`.

### Hosted browser

- File/functions: `static_demo/js/history-store.js` → `safeCell()`, `csvCell()`, `formatCheckedAt()`, `buildCsv()`, `download()`.
- Same report sections/headings and BOM. Each cell is explicitly quoted and formula-protected.
- `download()` creates a `Blob`, object URL, temporary anchor, triggers download, then revokes the URL.
- Filename is `usb_backup_verification_<backup_name>_<compact ISO timestamp>.csv`; unlike Python, the hosted filename does not sanitize the backup name as conservatively. Folder names originate from a local folder selection.
- Export is the complete saved verification record, not only the current visual filter.

## 18. Deployment

- Platform: Render.
- Current service type/runtime: Static Site (`runtime: static` in Blueprint).
- Service name: `usb-backup-verifier`.
- Repository sub-root: `CN`.
- Build command: `echo "Static demo ready"`.
- Publish directory: `static_demo`.
- No health check, start command, Python runtime, compute plan, or environment variables are required by the current static Blueprint.
- Render should redeploy from the connected GitHub branch when commits reach the configured branch (normally `main`; verify in Render dashboard because that external setting is not stored here).
- Static hosting was chosen to remove Python-service cold starts and support a zero-cold-start demonstration. Commit `d2a0a77` explicitly records that conversion.
- Historical Git shows the preceding Blueprint was a Python web service using `pip install -r requirements.txt`, `uvicorn web_app:app --host 0.0.0.0 --port $PORT`, `/api/health`, `USB_VERIFIER_MODE=demo`, and later `plan: free`. That is **not** the current Render configuration.
- Externally confirmed public deployment: `https://usb-backup-verifier-static.onrender.com`. The conversion specifically addressed cold-start delay experienced on the earlier free Python Render Web Service.

Current `render.yaml`:

```yaml
services:
  - type: web
    name: usb-backup-verifier
    runtime: static
    rootDir: CN
    buildCommand: echo "Static demo ready"
    staticPublishPath: static_demo
```

## 19. Dependencies

### Python

README expectation: Python 3.12. `requirements.txt` has unpinned direct dependencies:

- `fastapi` — API routing, validation integration, web application.
- `uvicorn` — ASGI development/runtime server.
- `jinja2` — local HTML template rendering.
- `httpx` — FastAPI/Starlette test client dependency.
- `python-multipart` — multipart compatibility endpoints for file/form input.

Important standard-library modules include `zlib`, `pathlib`, `os`, `json`, `tempfile`, `csv`, `io`, `datetime`, `uuid`, `secrets`, `threading`, `tkinter`, `re`, and `contextlib`.

Dependencies are unpinned, so a fresh laptop may install newer versions. The audit installed FastAPI 0.141.1/Starlette 1.6.0 and saw a non-failing TestClient deprecation warning. Re-run all tests before accepting an environment.

### Frontend and browser

- No frontend framework, package manager manifest, CDN stylesheet, remote font, or external runtime service.
- Vanilla HTML5, CSS, and JavaScript.
- Browser APIs: File System Access API, `webkitdirectory` fallback, `File.arrayBuffer`, `Uint8Array`, `TextEncoder`, `localStorage`, `Blob`, object URLs, Web Crypto UUID where available, `Intl.DateTimeFormat`, DOM/ARIA.
- Browser E2E uses Node.js + Playwright, but **no `package.json` or lockfile is committed**. Playwright must be installed separately for full browser auditing.
- The current browser audit expects system Edge at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` and Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`.

## 20. New laptop setup commands

Use PowerShell on Windows:

```powershell
git clone https://github.com/SyedRehanuddin/usb-backup-verifier.git
cd usb-backup-verifier
git switch main
git pull --ff-only origin main
git status

cd CN
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python web_app.py
```

Open `http://127.0.0.1:8000/#verification`. If PowerShell blocks activation, do not change machine-wide policy; use `.\.venv\Scripts\python.exe` in place of `python`.

Run tests:

```powershell
python -m unittest discover -s tests -p "test_*.py"
node --test tests/test_history_ui.js tests/test_select_picker.js tests/test_simulation.js tests/test_static_demo.js tests/test_verification_results.js
```

Preview the deployed source locally in a second PowerShell from `CN\`:

```powershell
python -m http.server 8004 --bind 127.0.0.1 --directory static_demo
```

Open `http://127.0.0.1:8004/#verification`.

Optional full browser audit prerequisites and command:

```powershell
# Install current Node.js LTS, Chrome, and Edge first.
npm install --no-save --package-lock=false playwright
$env:SHOWCASE_PYTHON = (Resolve-Path .\.venv\Scripts\python.exe).Path
node tests/static_demo_audit.cjs
Remove-Item Env:SHOWCASE_PYTHON
```

`node_modules` is ignored. Do not commit it. Full setup and verification are repeated in `NEW_LAPTOP_SETUP_CHECKLIST.md`.

## 21. Environment variables

No `.env` file or secrets were found. Never add actual secrets to handoff documents.

| Variable | Meaning / need |
|---|---|
| `USB_VERIFIER_MODE` | `local` (default) or historical FastAPI `demo`; not used by current static Render deployment. |
| `PORT` | Server port for direct `web_app.py`; presence also changes bind host to `0.0.0.0`. Not needed for default localhost or current static Render. |
| `SHOWCASE_PYTHON` | Python executable used by browser audit scripts to start a local server. Test-only. |
| `SHOWCASE_DATA` | Temporary fixture directory consumed by `tests/showcase_server.py`. Set by its audit harness. Test-only. |
| `DEMO_SHOWCASE_DATA` | Temporary storage directory consumed by `tests/demo_showcase_server.py`. Test-only. |
| `STATIC_DEMO_BASE` | Optional deployed/static base URL for `static_demo_audit.cjs`; when absent it starts localhost port 8004. Test-only. |
| `NODE_PATH` | Not referenced by project source; may be needed only in unusual environments to locate an externally installed Playwright package. |

Format for any future secret: `VARIABLE_NAME = <REDACTED / description>`. None is currently required by the product.

## 22. GitHub workflow

Repository: `https://github.com/SyedRehanuddin/usb-backup-verifier.git`; branch: `main`.

Safe start-of-session workflow:

```powershell
git status
git branch --show-current
git fetch origin
git rev-list --left-right --count origin/main...main
git pull --ff-only origin main
```

Never pull over unexplained local changes. Review `git status` and `git diff` first. Prefer a feature branch (`git switch -c codex/<short-topic>`) for non-trivial changes unless the owner explicitly directs work on `main`.

Normal review/commit/push:

```powershell
git status
git diff --check
git diff
git add <explicit-files>
git diff --cached
git commit -m "Describe the focused change"
git push -u origin <branch>
```

Render redeployment is expected to follow pushes to its connected branch; confirm the Render dashboard’s branch and latest deploy. Never force-push or rewrite history without explicit authorization.

`.gitignore` excludes Python environments/caches/test output, builds/packages, Node dependencies/logs, `.env*` (except an example), OS/editor files, runtime manifest/history JSON patterns, and named local QA artifact directories. Note that `current_reference.json` and `verification_history.json` are already tracked from the initial commit even though their patterns are now ignored; ignore rules do not untrack an existing file.

## 23. Current project completion status

| Feature | Status | Notes |
|---|---|---|
| Python CRC-32 engine | Complete | zlib bytes/stream + size, uppercase hex. |
| Browser CRC-32 engine | Complete | Reflected table using `0xEDB88320`. |
| CRC-3 | Missing | No code/test/UI. |
| CRC-4 | Missing | No code/test/UI. |
| CRC-8 | Missing | No code/test/UI. |
| Recursive folder scan | Complete | Local OS walk and hosted directory-handle/input recursion. |
| Nested directories | Complete | `nested/lab_record.bin` tested end-to-end. |
| Reference generation | Complete | Atomic JSON locally; metadata-only localStorage hosted. |
| Clean/Corrupted/Missing/Extra | Complete | All standard scenarios tested. |
| Size-aware local comparison | Complete | Static comparator does not explicitly apply size condition. |
| Error Lab M1–M5 | Complete | Fresh, in-memory/non-destructive. |
| History | Complete | Local JSON and hosted localStorage, max 100. |
| CSV export | Complete | Local endpoint and hosted Blob; safety tests. |
| Local FastAPI version | Complete | Windows-native picker; 129 tests pass. |
| Hosted static version | Complete/deployed | Externally confirmed at `https://usb-backup-verifier-static.onrender.com`; 104 browser checks pass against the deployed source locally. |
| Responsive UI | Complete for tested sizes | No overflow at three desktop widths; limited mobile audit. |
| Automated unit tests | Complete/current | 129 Python + 38 JS pass. |
| CI workflow | Missing | No GitHub Actions file. |
| Project report | Final external artifact | `USB_Backup_Verifier_Project_Report_Final_Submission.pdf`, approximately 20 pages; not tracked by Git. |
| PowerPoint | In progress / external | No final PPTX is in Git or supplied; transfer separately if available. |
| Lab binary/text/manual CRC dashboard | Missing | Highest likely lab-compliance gap. |

## 24. Project documentation / report / PPT

### Repository-derived status

- Repository documentation consists of `CN/README.md` and these four handoff files.
- No PDF, DOCX, PPT, or PPTX is tracked by Git.
- CSV reports are intentionally generated on demand and are not persisted under `CN/data/reports`.
- The repository contains inline UI content but no report/presentation packaging.

### Externally confirmed final report

- Filename: `USB_Backup_Verifier_Project_Report_Final_Submission.pdf`.
- Status: final project report prepared outside Git.
- Length: approximately 20 PDF pages.
- Transfer requirement: copy the PDF separately; cloning the repository will not restore it.
- Known contents: title/project information; Group 2; team-member and enrollment details; Faculty Dr. Aparna Sajeev; Computer Networks relevance of CRC; sender/receiver error-detection model; problem statement and objectives; requirements; architecture; CRC-32 working principle; implementation details; backup verification workflow; screenshots/results; Error Simulation Lab; History and CSV reporting; testing and validation; discussion; deployment; limitations/future scope; conclusion; team contribution; and appendix/code material.

The report’s conceptual sender/receiver discussion must not be mistaken for a claim that the application implements a complete socket protocol or a manual sender/codeword/receiver module.

### Externally confirmed presentation status

**In progress / external to Git; final presentation file should be transferred separately if available.** Do not label a PPTX final until the actual file is supplied or verified.

The intended presentation covers title/team, problem statement/objectives, Computer Networks relevance, system architecture/workflow, CRC-32 working principle, backup verification, Error Lab, verification results, History/CSV/deployment, and conclusion/future scope.

## 25. Screenshots / demo assets

No screenshot or demo-media image is tracked as a presentation asset. Files named `image.png` inside the six dataset trees are deliberately tiny binary test fixtures, not screenshots.

The application’s icons are inline SVG in HTML/JavaScript/CSS; there is no separate assets directory. The mirrored demo folders are automated-test fixtures.

### Externally confirmed screenshot directory

Directory: `C:\Users\Ayesha Nishath\Downloads\ScrnShts`. It is outside Git and must be copied separately.

| Filename | Demonstration/report use |
|---|---|
| `01_Verification_Main.png` | Verification page/workflow before results |
| `02_Verification_Clean_Result.png` | Clean result: 5 Verified, 0 Corrupted, 0 Missing, 0 Extra |
| `03_Verification_Corrupted_Result.png` | Corrupted result: 4/1/0/0 and CRC mismatch |
| `04_Verification_Missing_Result.png` | Missing result: 4/0/1/0 |
| `05_Verification_Extra_Result.png` | Extra result: 5/0/0/1 |
| `06_Verification_Mixed_Result.png` | Mixed result: 3/1/1/1 |
| `07_Error_Lab_Main.png` | Error Lab main four-step workflow |
| `08_ErrorLab_ModifyByte.png` | M1 Modify Byte detected as Corrupted |
| `09_ErrorLab_AppendData.png` | M2 Append Data detected as Corrupted |
| `10_ErrorLab_TruncateFile.png` | M3 Truncate File detected as Corrupted |
| `11_ErrorLab_RemoveFile.png` | M4 Remove File detected as Missing |
| `12_ErrorLab_AddExtraFile.png` | M5 Add Extra File detected as Extra |
| `13_History_Overview.png` | History metrics, toolbar, and records |
| `14_History_Details.png` | Full saved verification detail and result table |
| `15_About_Page.png` | Project explanation, workflow, CRC information, and features |

These 15 final screenshots and all five Error Lab detection paths are externally confirmed as validated. They are not part of the 119 tracked repository files.

## 26. Latest lab requirements / gap analysis

No laboratory guideline PDF, Word file, or other rubric document is present. The table below compares the explicit handoff checklist with current code; it is not a claim about an unseen official rubric.

| Requirement | Implemented? | Evidence | Action needed |
|---|---:|---|---|
| Binary CRC input | Partial | Binary files and Uint8Array/bytes supported | Add explicit bit-string educational input if rubric requires it. |
| Text CRC input | Partial | Text files processed as bytes | Add direct text-entry and displayed encoding/binary if required. |
| File CRC input | Yes locally | `/api/crc32/file`, stream CRC; folder workflows both runtimes | Expose/document single-file UI only if rubric requires. |
| Dashboard → Python function demo | Partial | Local JS calls FastAPI routes calling Python | Create a dedicated transparent lab flow if screenshots/function mapping are required. |
| Python function → Dashboard result | Partial | API responses render in UI | Same as above. |
| Error-free case | Yes | `backup_clean` = 5/0/0/0 | None. |
| Corrupted case | Yes | Corrupted and mixed fixtures + Error Lab | None. |
| CRC-3 | No | No repository evidence | **Implement first if required.** |
| CRC-4 | No | No repository evidence | Implement if required. |
| CRC-8 | No | No repository evidence | Implement if required. |
| CRC-32 | Yes | Python and JS engines/tests | None for product flow. |
| Sender/remainder/codeword | No | No repository evidence | Add educational modulo-2 workflow if required. |
| Receiver verification | No | No repository evidence | Add error-free and flipped-bit receiver examples if required. |

Obtain the official latest lab guideline before writing new code. Do not retrofit features based only on this inferred list.

## 27. Known issues / limitations

### Bug/risk candidates

- The committed local reference/history describe older bytes than current demo fixtures. They are valid documents but stale as a ready-to-run fixture state; regenerate before local fixture demonstrations.
- Hosted comparison checks CRC equality but not explicit size equality, unlike local Python. This matters only in a CRC collision/size-difference edge case.
- Python dependencies are unpinned; future installs may introduce incompatibilities. Current tests pass with the audit environment.
- No committed Node/Playwright manifest makes full browser-audit setup less reproducible.

### Limitations

- CRC-32 can collide and is not cryptographic authentication.
- Hosted reference/history are browser-origin/profile-local and do not sync across devices.
- Current folder selections cannot persist through refresh due browser security and intentional handle/byte non-persistence.
- `showDirectoryPicker` support is strongest in Chromium. Fallback may show browser “upload” wording.
- Local native selection depends on Windows desktop/Tkinter; it will not work unchanged on a headless server.
- Large hosted folders are fully read into browser memory; there is no streaming/chunked browser CRC.
- No complete socket/network protocol, sender/receiver wire simulation, or distributed service exists.
- Mobile is responsive but desktop demonstration is the main design target.
- No CI or automated Render smoke test is tracked. The final report and in-progress presentation are externally managed and not tracked by Git.

### Intentional design decisions

- Hosted processing is entirely local in the browser; no uploads/backend.
- Local absolute paths remain server-side behind opaque tokens.
- Error Lab never mutates selected files and never writes History.
- CSV is in-memory/on-demand; no report files are persisted.
- Bundled demo data exists for tests but is not loaded by the hosted user workflow.
- Local and hosted implementations remain separate to preserve native local behavior and zero-cold-start hosting.

### Possible future enhancements

- Manual CRC-3/4/8/32 teaching lab with bit-level steps.
- Explicit size equality in hosted comparator.
- Dependency pinning/lock strategy and CI.
- Optional import/export of browser-only History/reference metadata.
- Truly streaming browser CRC for very large folders.

## 28. Important historical decisions

Supported by current files and Git history:

1. `0162ba9` created the complete FastAPI project, native-folder architecture, demo fixtures, tests, and a Render Python web-service Blueprint.
2. `4d808ba` added Render’s free plan to the Python service.
3. `d2a0a77` converted the hosted presentation to a zero-cold-start static site and introduced independent browser CRC, History, Error Lab, data mirror, and static E2E audit. Git history shows the old Uvicorn/health-check/demo-mode Render settings were removed.
4. `cac3194` replaced the hosted bundled-dataset primary UX with real browser folder selection using `showDirectoryPicker` and fallback. Tests assert no hosted API calls or bundled dataset requests.
5. `b9276f9`, `6cec829`, `b09e854`, and `6821b24` made focused presentation polishes to Verification, common controls/page titles, Error Lab/History, and About without changing the static architecture.

The code supports both a Tkinter-native local path and browser-native hosted path because a server-side native dialog is appropriate only on the same Windows machine, while static hosting must request browser permission and cannot access arbitrary local paths.

## 29. Things a new Codex must not break

1. Preserve full root-relative paths; never compare by basename alone.
2. Keep `nested/lab_record.bin` working in selection, reference, comparison, History, and CSV.
3. Preserve classifications: absent source = Extra; absent backup = Missing; mismatched common file = Corrupted; matching = Verified.
4. Preserve deterministic result ordering.
5. Keep Python CRC output uppercase and exactly eight hex digits.
6. Keep Error Lab fresh-baseline and non-destructive; Run Again must not stack mutations.
7. M1–M4 require a valid target; M5 must require none and use generated-file presentation.
8. Do not write Error Lab runs to normal History.
9. Clearing History must preserve the trusted reference in both runtimes.
10. Refresh must not fake/persist current folder selections.
11. Hosted reference persistence must never contain bytes or directory handles.
12. Hosted static code must not acquire `/api/`, Python, multipart, telemetry, or remote-storage dependencies unless architecture is explicitly changed and approved.
13. Local native selection must not expose absolute paths to the browser.
14. Keep path traversal, duplicates, symlinks, malformed stored data, CSV formula injection, Unicode, and quoting protections.
15. Preserve the current Render static Blueprint unless a deployment change is explicitly requested.
16. Run 129 Python tests, 38 JS tests, and the static browser audit after material changes.
17. Do not “synchronize” `static/` and `static_demo/` blindly; understand the local/hosted differences first.
18. Never clear or rewrite user History/reference merely to run tests; use temporary isolated storage.

## 30. Next recommended work

### Immediate — required for laboratory submission

1. Obtain and add/reference the official latest laboratory guideline. Confirm whether CRC-3/4/8 and manual sender/receiver steps are mandatory.
2. If mandatory, design a **separate focused educational CRC lab** for binary/text/file input, selectable CRC-3/4/8/32 polynomials, displayed modulo-2 XOR steps/remainder/codeword, and receiver error-free/corrupted checks. Do not destabilize the finished backup verifier.
3. Transfer and review the externally prepared final report PDF, all 15 screenshots, and any current presentation working file. Confirm remaining institution/course-code/submission-date details outside Git.

### Before presentation

1. Regenerate the local trusted reference from current `demo_data/original_files` or use real selected demo folders; do not rely on the stale committed manifest.
2. Run the complete unit and browser suites on the new laptop.
3. Verify the externally confirmed Render URL in Chrome and Edge, including real folder permission, all five scenarios, Error Lab, History, and CSV.
4. Copy the externally confirmed 15-image screenshot set and final report PDF; confirm every presentation figure resolves on the new laptop.
5. Rehearse the walkthrough below and a concise explanation of CRC limitations.

### Before final submission

1. Decide whether committed runtime JSON should remain as sample data or be deliberately untracked/replaced; do not delete it casually.
2. Consider pinning Python dependencies and adding a Node development manifest only with owner approval.
3. Add CI for Python and Node suites, then optionally a deployed static smoke check.
4. Ensure the external final report, screenshot directory, presentation source, and final exports are backed up appropriately.

### Optional future enhancements

1. Make hosted comparator include explicit byte-size equality.
2. Stream large browser files instead of retaining all bytes.
3. Add opt-in browser metadata import/export.
4. Expand accessibility/mobile audits beyond current tested paths.

## 31. Demo walkthrough

### Existing product demonstration

1. Open the hosted URL (or `http://127.0.0.1:8004/#verification`) in Chrome/Edge.
2. Select `original_files`; point out browser permission, five files, and the nested path.
3. Generate Reference; explain that only path/size/CRC metadata persists.
4. Select `backup_clean`; Verify; show **5/0/0/0**, Complete, equal CRCs, History saved, and CSV.
5. Change to `backup_corrupted`; Verify; show **4/1/0/0**, issue-aware Step 4, red backup CRC mismatch for `attendance.csv`.
6. Select `backup_missing`; show **4/0/1/0** and blank backup CRC/size for `image.png`.
7. Select `backup_extra`; show **5/0/0/1** and blank source fields for `extra_file.txt`.
8. Select `backup_mixed`; show **3/1/1/1**, all filters, and complete export unaffected by visual filtering.
9. Open Error Lab, select clean backup, run M1 through M5; point out target requirements, Expected Result Detected, CRC/size change, Run Again, and non-destructive reset.
10. Open History; demonstrate metrics, search, clean/issues, newest/oldest, View Details, detail filtering, CSV, and Clear History confirmation/reference preservation (avoid clearing real desired browser history during presentation).
11. Open About; explain workflow, classifications, CRC-32 benefits and non-cryptographic limitation.

For local demonstration, first run `python web_app.py`, select directories through the native Windows dialog, and generate a fresh reference. The local version stores JSON under `CN/data` and downloads CSV from a FastAPI endpoint.

### New lab-specific flow still required if rubric confirms it

1. Choose CRC-3/4/8/32 generator.
2. Enter a validated binary message or text/file converted visibly to bytes/bits.
3. Show appended zeros and modulo-2/XOR division.
4. Show remainder and sender codeword.
5. Pass unchanged codeword to receiver and show zero remainder.
6. Flip a selected bit and show non-zero receiver remainder/error.
7. Map the dashboard action to the exact Python function and show its returned result.

No such flow currently exists.

## 32. Viva / technical knowledge

- **CRC:** deterministic remainder/checksum used to detect accidental changes.
- **Generator polynomial:** agreed divisor represented by polynomial coefficients/bits. Standard CRC-32 commonly uses `0x04C11DB7`; reflected implementations use `0xEDB88320`.
- **XOR/modulo-2 division:** binary long division without carries/borrows; subtraction is XOR.
- **Remainder/codeword:** sender appends zeros, divides, and replaces zeros with remainder; message+remainder is the codeword.
- **Receiver:** divides the received codeword by the same generator; a non-zero remainder indicates a detected error. A zero remainder is not cryptographic proof.
- **CRC versus hash:** CRC is fast and designed for accidental errors; cryptographic hashes resist deliberate collisions and support stronger integrity claims.
- **Relative paths:** paths below the selected root allow matching nested files even when source and backup root folder names differ.
- **Recursive traversal:** Python `os.walk` or browser DirectoryHandle recursion enumerates all nested files.
- **ArrayBuffer/Uint8Array:** browser binary containers; the picker reads `File.arrayBuffer()` and CRC consumes `Uint8Array`.
- **FastAPI:** local Python framework exposing typed JSON/multipart routes and serving Jinja/static resources.
- **localStorage:** per-origin browser string storage used only by hosted reference metadata and History.
- **Blob CSV:** hosted code creates a text Blob and temporary object URL; local code returns an HTTP attachment.
- **Static hosting:** Render serves files directly with no running application server, eliminating server cold start but requiring all hosted logic to run in the browser.

## 33. Exact important code map

| Feature | File | Function/class | Responsibility |
|---|---|---|---|
| Local entry/routes | `CN/web_app.py` | `app`; route functions | HTTP orchestration and UI shell. |
| Local reference orchestration | `CN/web_app.py` | `_generate_reference_from_streams`, `generate_reference_from_selection` | Build/save selected source. |
| Local verification orchestration | `CN/web_app.py` | `_verify_from_streams`, `run_verification_from_selection` | Load manifest, verify, optionally save History. |
| Local Error Lab route | `CN/web_app.py` | `run_error_lab_from_selection` | Fresh transient changes and standard comparison. |
| Python CRC | `CN/app/core/crc32.py` | `crc32_bytes`, `crc32_stream`, `crc32_stream_details` | zlib CRC and byte count. |
| Path normalization | `CN/app/core/manifest.py` | `normalize_source_name`, `normalize_relative_path` | Reject unsafe/ambiguous paths. |
| Manifest build/store | same | `build_manifest`, `save_manifest_atomic`, `load_manifest`, `validate_manifest_document` | Trusted reference lifecycle. |
| Local scan/dialog | `CN/app/native_folders.py` | `choose_native_directory`, `scan_folder` | Native selection and recursive safe enumeration. |
| Opaque selection | same | `FolderSelectionRegistry`, `SelectedFolder` | Token-to-server-path lifecycle. |
| Comparison | `CN/app/core/verifier.py` | `build_backup_records`, `compare_records`, `verify_backup` | Calculate and classify all paths. |
| Python simulation | `CN/app/core/simulation.py` | `simulate_bytes`, `choose_extra_path` | Immutable deterministic M1–M3/M5 helper. |
| Local History | `CN/app/core/history.py` | `create_history_record`, `append_history_record`, `list_history_summaries`, `get_history_record`, `clear_history` | Validated max-100 atomic persistence. |
| Local CSV | `CN/app/core/report.py` | `generate_csv_report`, `safe_report_filename`, `spreadsheet_safe_text` | Human-readable secure report bytes. |
| Runtime mode | `CN/app/runtime.py` | `get_verifier_mode`, `demo_dataset_registry` | Local/demo mode and allowlist. |
| Local UI state | `CN/static/js/app.js` | `generateReference`, `verifyBackup`, `selectVerificationFolder`, `runLabSimulation`, History render/load functions, `showView` | FastAPI-backed client workflow. |
| Local markup/style | `CN/templates/index.html`, `CN/static/css/styles.css` | view/card/dialog IDs/classes | Four-page local presentation. |
| Browser CRC | `CN/static_demo/js/crc32.js` | `crc32` | Table-based CRC-32. |
| Browser folders | `CN/static_demo/js/folder-selection.js` | `chooseDirectory`, `enumerateHandle`, `enumerateFileInput`, `makeSelection` | Modern picker/fallback + recursive bytes/paths. |
| Hosted reference state | `CN/static_demo/js/app.js` | `referenceSnapshot`, `validReferenceSnapshot`, `loadCurrentReference`, `generateReference` | Metadata-only localStorage reference. |
| Hosted comparison | `CN/static_demo/js/verification.js` | `datasetFromFiles`, `compare` | CRC datasets and four statuses. |
| Hosted verification workflow | `CN/static_demo/js/app.js` | `verifyBackup`, `resetVerificationResults`, `updateBackupStatus`, `renderResults` | Invalidation, History, totals, rows. |
| Hosted Error Lab | `CN/static_demo/js/error-lab.js` | `run` | Fresh clone and M1–M5 result. |
| Byte transformations | `CN/static_demo/js/simulation.js` | `modifyByte`, `appendData`, `truncateFile`, `simulateBytes`, `chooseExtraPath` | Immutable method behavior. |
| Hosted History/CSV store | `CN/static_demo/js/history-store.js` | `read`, `write`, `add`, `get`, `clear`, `buildCsv`, `download` | localStorage and Blob export. |
| History filtering | `CN/static_demo/js/history.js` | `calculateMetrics`, `filterAndSort`, `filterDetailResults` | Pure History UI logic. |
| Accessible selects | `CN/static_demo/js/select-picker.js` | `DarkSelectPicker`, `calculateSelectMenuPlacement` | Dark ARIA listboxes and viewport placement. |
| Target picker | `CN/static_demo/js/target-picker.js` | `LabTargetPicker` | M1–M4 target selection. |
| Result filter | `CN/static_demo/js/verification-results.js` | `filterResults` | Visual rows only. |
| Hosted router/History UI | `CN/static_demo/js/app.js` | `showView`, `loadHistory`, `renderHistoryList`, `loadHistoryDetail`, `confirmHistoryClear` | Four views and complete History interaction. |
| Hosted markup/style | `CN/static_demo/index.html`, `CN/static_demo/css/styles.css` | static views/classes | Deployed presentation. |
| Render deployment | `render.yaml` | Blueprint fields | Publish `CN/static_demo`. |

## 34. Final source-of-truth summary

### Current project in one paragraph

The USB Backup Verification Utility is a finished, presentation-quality CRC-32 folder integrity checker with source reference generation, recursive/nested backup comparison, four clear result classes, five controlled non-destructive simulations, searchable History, and secure CSV exports. It has a Windows-local FastAPI edition and a separately implemented hosted static browser edition, both validated against clean, corrupted, missing, extra, and mixed datasets.

### Current architecture in one paragraph

Locally, a Jinja/vanilla-JS UI calls FastAPI; FastAPI opens Tkinter folder dialogs, holds absolute paths behind ephemeral opaque tokens, scans files recursively, uses Python zlib and validated atomic JSON for reference/History, and produces CSV HTTP responses. On Render, `static_demo` runs with no backend: browser directory APIs provide bytes/paths, a JavaScript CRC-32 table and comparator process them, localStorage retains metadata/results, and Blob downloads create CSV. The two source trees share concepts and UI language but are independent implementations.

### What is finished

CRC-32 in Python and JavaScript; recursive/nested selection; trusted references; all four classifications; Error Lab M1–M5; History; CSV; dark accessible UI; current static Blueprint and externally confirmed public deployment; 129 Python tests, 38 JavaScript tests, and 104 static browser checks. A final external report PDF and 15-image screenshot set have also been prepared.

### What is not finished

No CRC-3/4/8 or manual modulo-2 sender/codeword/receiver teaching flow exists. No official lab guideline, final PPTX, CI workflow, or committed Node/Playwright manifest exists in Git. The final report PDF and 15 screenshots are externally confirmed but must be transferred separately; the presentation is still in progress outside Git. The public Render URL is externally confirmed, and committed local persistence remains stale relative to current compact fixtures.

### Next single best action

Obtain the official latest laboratory rubric and confirm whether the missing binary/text/manual CRC-3/4/8 sender/receiver demonstration is mandatory; if it is, implement it as a focused additive lab without rebuilding or destabilizing the completed backup verifier.
