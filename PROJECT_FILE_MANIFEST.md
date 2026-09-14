# USB Backup Verifier — Project File Manifest

Repository root: the directory containing `.git`, `render.yaml`, and `CN\`.  
Audit baseline: 119 tracked files at commit `6821b2408227959b72778f6672d3c9b775721378`.

Legend:

- **Required** — core source/config/test/fixture needed to reproduce the project.
- **Useful** — documentation or a specialized harness worth transferring.
- **Optional/legacy** — retained and tested, but not part of the current primary deployment path.
- **Generated/runtime** — should normally be recreated, not manually transferred.

## Repository-root files

| Path | Type | Purpose | Tracked by Git? | Important for transfer? | Generated/runtime file? | Safe to regenerate? |
|---|---|---|---:|---:|---:|---:|
| `.gitignore` | Git config | Excludes environments, caches, builds, Node modules, `.env`, runtime JSON patterns, and QA artifacts. | Yes | **Required** | No | No—preserve rules |
| `render.yaml` | Deployment config | Publishes `CN/static_demo` as the Render static service `usb-backup-verifier`. | Yes | **Required** | No | No |
| `PROJECT_HANDOFF_MASTER.md` | Documentation | Complete architecture/state/continuation source of truth. | No at creation | **Required for handoff** | No | Re-audit to replace |
| `PROJECT_FILE_MANIFEST.md` | Documentation | This transfer inventory. | No at creation | **Required for handoff** | No | Re-audit to replace |
| `NEW_LAPTOP_CODEX_START_PROMPT.txt` | Documentation | Ready-to-paste continuation prompt. | No at creation | **Required for handoff** | No | Re-audit to replace |
| `NEW_LAPTOP_SETUP_CHECKLIST.md` | Documentation | Beginner-friendly Windows clone/setup/test checklist. | No at creation | **Required for handoff** | No | Re-audit to replace |
| `.git/` | Git metadata | Local object database, index, refs, config. | N/A | **Do not copy manually; clone instead** | Local metadata | Yes, by clone/fetch |

## Externally confirmed transfer artifacts (outside Git)

These entries were supplied separately from the repository audit. Their paths/status are externally confirmed and they will **not** be restored by `git clone`.

| Path/name | Type | Purpose | Tracked by Git? | Important for transfer? | Generated/runtime file? | Safe to regenerate? |
|---|---|---|---:|---:|---:|---:|
| `USB_Backup_Verifier_Project_Report_Final_Submission.pdf` | Final PDF, approximately 20 pages | Final submission report with academic identity, CRC/architecture/implementation/results/testing/deployment/conclusion/appendix content. | No | **Required college artifact** | Final external artifact | Only from its source document; preserve the PDF |
| `C:\Users\Ayesha Nishath\Downloads\ScrnShts\` | External directory | Contains the 15 final screenshots listed below. | No | **Required for report/PPT continuity** | Final external artifacts | Re-capture is possible but avoid unnecessary loss |
| Final presentation file (exact filename not supplied) | PPT/PPTX or presentation source | Intended title/team, problem, networking relevance, architecture, CRC, verification, Error Lab, results, History/CSV/deployment, conclusion/future scope. | No | Transfer if available | Work in progress | Not safely reproducible without its source |

Externally confirmed screenshot files:

1. `01_Verification_Main.png`
2. `02_Verification_Clean_Result.png`
3. `03_Verification_Corrupted_Result.png`
4. `04_Verification_Missing_Result.png`
5. `05_Verification_Extra_Result.png`
6. `06_Verification_Mixed_Result.png`
7. `07_Error_Lab_Main.png`
8. `08_ErrorLab_ModifyByte.png`
9. `09_ErrorLab_AppendData.png`
10. `10_ErrorLab_TruncateFile.png`
11. `11_ErrorLab_RemoveFile.png`
12. `12_ErrorLab_AddExtraFile.png`
13. `13_History_Overview.png`
14. `14_History_Details.png`
15. `15_About_Page.png`

The clean/corrupted/missing/extra/mixed screenshots demonstrate 5/0/0/0, 4/1/0/0, 4/0/1/0, 5/0/0/1, and 3/1/1/1 respectively. All five Error Lab result screenshots are externally confirmed as successfully validated.

## Application-root documentation and configuration

| Path | Type | Purpose | Tracked? | Transfer? | Generated? | Regenerate? |
|---|---|---|---:|---:|---:|---:|
| `CN/README.md` | Markdown | Product purpose, local/static architecture, run/test instructions. | Yes | **Required** | No | No |
| `CN/requirements.txt` | Python dependency declaration | FastAPI, Uvicorn, Jinja2, HTTPX, python-multipart. | Yes | **Required** | No | No |
| `CN/web_app.py` | Python | Local FastAPI entry point, route models/helpers/endpoints, Error Lab orchestration. | Yes | **Required** | No | No |

## Local Python modules

| Path | Type | Purpose | Tracked? | Transfer? | Generated? | Regenerate? |
|---|---|---|---:|---:|---:|---:|
| `CN/app/__init__.py` | Python package marker | Declares application package. | Yes | Required | No | No |
| `CN/app/runtime.py` | Python | Local/demo mode and allowlisted fixture registry. | Yes | Required | No | No |
| `CN/app/native_folders.py` | Python | Tkinter native chooser, symlink-safe recursive scan, opaque token registry. | Yes | **Required** | No | No |
| `CN/app/core/__init__.py` | Python package marker | Declares core package. | Yes | Required | No | No |
| `CN/app/core/crc32.py` | Python core | zlib CRC-32 bytes/stream functions and formatting. | Yes | **Required** | No | No |
| `CN/app/core/manifest.py` | Python core | Path normalization, trusted manifest build/validation/atomic persistence. | Yes | **Required** | No | No |
| `CN/app/core/verifier.py` | Python core | Backup metadata creation, deterministic compare, four classifications. | Yes | **Required** | No | No |
| `CN/app/core/simulation.py` | Python core | Non-destructive Modify/Append/Truncate and deterministic extra path. | Yes | **Required** | No | No |
| `CN/app/core/history.py` | Python core | Validated max-100 History records and atomic JSON operations. | Yes | **Required** | No | No |
| `CN/app/core/report.py` | Python core | Secure in-memory UTF-8 BOM CSV and safe attachment filename. | Yes | **Required** | No | No |

## Local FastAPI frontend

| Path | Type | Purpose | Tracked? | Transfer? | Generated? | Regenerate? |
|---|---|---|---:|---:|---:|---:|
| `CN/templates/index.html` | Jinja/HTML | Local four-view UI, dialogs, controls, hidden selects. | Yes | **Required** | No | No |
| `CN/static/css/styles.css` | CSS | Local dark design system, states, responsive layout. | Yes | **Required** | No | No |
| `CN/static/js/app.js` | JavaScript | Local UI state machine and FastAPI calls. | Yes | **Required** | No | No |
| `CN/static/js/history.js` | JavaScript | Pure History metrics/search/filter/sort/detail functions. | Yes | Required | No | No |
| `CN/static/js/select-picker.js` | JavaScript | Reusable accessible dark select/listbox and placement. | Yes | Required | No | No |
| `CN/static/js/target-picker.js` | JavaScript | Error Lab accessible target-file picker. | Yes | Required | No | No |
| `CN/static/js/simulation.js` | JavaScript | Simulation presentation/helper functions and immutable transforms used in tests/UI. | Yes | Required | No | No |
| `CN/static/js/verification-results.js` | JavaScript | Verification file-row filter helper. | Yes | Required | No | No |

## Hosted static application (current Render source)

| Path | Type | Purpose | Tracked? | Transfer? | Generated? | Regenerate? |
|---|---|---|---:|---:|---:|---:|
| `CN/static_demo/index.html` | Static HTML | Deployed four-view application shell. | Yes | **Required** | No | No |
| `CN/static_demo/css/styles.css` | CSS | Deployed dark design/responsive system. | Yes | **Required** | No | No |
| `CN/static_demo/js/app.js` | JavaScript | Hosted workflow, state invalidation, rendering, dialogs, History, hash routes. | Yes | **Required** | No | No |
| `CN/static_demo/js/crc32.js` | JavaScript core | Table-based reflected CRC-32 over `Uint8Array`. | Yes | **Required** | No | No |
| `CN/static_demo/js/folder-selection.js` | JavaScript core | `showDirectoryPicker`, recursive handles, directory-input fallback. | Yes | **Required** | No | No |
| `CN/static_demo/js/verification.js` | JavaScript core | Byte datasets, browser comparison, History record creation. | Yes | **Required** | No | No |
| `CN/static_demo/js/simulation.js` | JavaScript core | Immutable simulation transformations and path helpers. | Yes | **Required** | No | No |
| `CN/static_demo/js/error-lab.js` | JavaScript core | Fresh-clone M1–M5 orchestration through browser verifier. | Yes | **Required** | No | No |
| `CN/static_demo/js/history-store.js` | JavaScript core | localStorage max-100 store and Blob CSV export. | Yes | **Required** | No | No |
| `CN/static_demo/js/history.js` | JavaScript | History metrics/search/filter/sort/detail helpers. | Yes | Required | No | No |
| `CN/static_demo/js/select-picker.js` | JavaScript | Reusable ARIA dark listbox and viewport placement. | Yes | Required | No | No |
| `CN/static_demo/js/target-picker.js` | JavaScript | Error Lab target picker adapter. | Yes | Required | No | No |
| `CN/static_demo/js/verification-results.js` | JavaScript | Visual result filtering. | Yes | Required | No | No |
| `CN/static_demo/js/demo-data.js` | JavaScript | Legacy/bundled dataset loader retained for older demo tooling; not loaded by current deployed HTML. | Yes | Optional/legacy | No | Yes from history, but preserve unless intentionally removed |

## Demo/test fixture datasets

The local and static trees are intentionally mirrored. Each is required for its automated tests. The hosted page does not normally fetch these files.

| Path | Type | Purpose | Tracked? | Transfer? | Generated? | Regenerate? |
|---|---|---|---:|---:|---:|---:|
| `CN/demo_data/original_files/` | Mixed fixture files | Five-file trusted baseline including `nested/lab_record.bin`. | Yes | **Required** | No | No—test oracle |
| `CN/demo_data/backup_clean/` | Mixed fixture files | Exact clean copy, expected 5/0/0/0. | Yes | **Required** | No | No |
| `CN/demo_data/backup_corrupted/` | Mixed fixture files | Changed `attendance.csv`, expected 4/1/0/0. | Yes | **Required** | No | No |
| `CN/demo_data/backup_missing/` | Mixed fixture files | Omits `image.png`, expected 4/0/1/0. | Yes | **Required** | No | No |
| `CN/demo_data/backup_extra/` | Mixed fixture files | Adds `extra_file.txt`, expected 5/0/0/1. | Yes | **Required** | No | No |
| `CN/demo_data/backup_mixed/` | Mixed fixture files | Changed notes, missing image, extra file, expected 3/1/1/1. | Yes | **Required** | No | No |
| `CN/static_demo/demo_data/original_files/` | Mirrored fixture files | Static test baseline. | Yes | **Required for tests** | No | No |
| `CN/static_demo/demo_data/backup_clean/` | Mirrored fixture files | Static clean case. | Yes | **Required for tests** | No | No |
| `CN/static_demo/demo_data/backup_corrupted/` | Mirrored fixture files | Static corrupted case. | Yes | **Required for tests** | No | No |
| `CN/static_demo/demo_data/backup_missing/` | Mirrored fixture files | Static missing case. | Yes | **Required for tests** | No | No |
| `CN/static_demo/demo_data/backup_extra/` | Mirrored fixture files | Static extra case. | Yes | **Required for tests** | No | No |
| `CN/static_demo/demo_data/backup_mixed/` | Mirrored fixture files | Static mixed case. | Yes | **Required for tests** | No | No |

Each original/clean/corrupted folder contains `attendance.csv`, `config.json`, `image.png`, `nested/lab_record.bin`, and `notes.txt`; Missing omits `image.png`; Extra adds `extra_file.txt`; Mixed omits `image.png` and adds `extra_file.txt`. The complete per-file inventory is tracked by Git and cloned automatically.

## Local persisted/sample state

| Path | Type | Purpose | Tracked? | Transfer? | Generated? | Regenerate? |
|---|---|---|---:|---:|---:|---:|
| `CN/data/manifests/current_reference.json` | JSON | Current checkout’s valid but older sample/reference manifest (five files, 428 bytes). | **Yes, despite ignore pattern** | Not required for clean setup | **Runtime/sample** | Yes—Generate Reference |
| `CN/data/history/verification_history.json` | JSON | Current checkout’s 32 older local History records. | **Yes, despite ignore pattern** | Only if deliberately preserving sample History | **Runtime/sample** | Yes—new checks recreate |
| `CN/data/reports/` | Empty runtime directory | Reports are deliberately not persisted. | No | No | Generated | Yes |

Important: these two tracked JSON files describe old, larger sample bytes and do not match current compact `demo_data`. Cloning will bring them because they are already tracked. Do not manually copy newer private runtime data over them without an explicit data-migration decision.

## Python/backend tests

| Path | Type | Purpose | Tracked? | Transfer? | Generated? | Regenerate? |
|---|---|---|---:|---:|---:|---:|
| `CN/tests/test_crc32.py` | unittest | CRC vectors/streaming/file endpoint/no persistence. | Yes | Required | No | No |
| `CN/tests/test_manifest.py` | unittest | Manifest/path/atomic storage/reference APIs. | Yes | Required | No | No |
| `CN/tests/test_verifier.py` | unittest | All classifications/order/nesting/verification APIs. | Yes | Required | No | No |
| `CN/tests/test_native_folders.py` | unittest | Native selection, token security, recursive scans, full scenarios, Error Lab. | Yes | Required | No | No |
| `CN/tests/test_demo_mode.py` | unittest | Historical FastAPI demo-mode allowlist/scenarios/lab. | Yes | Useful/legacy runtime coverage | No | No |
| `CN/tests/test_history.py` | unittest | History validation/storage/API/clear/reference preservation. | Yes | Required | No | No |
| `CN/tests/test_report.py` | unittest | CSV helper and actual FastAPI CSV endpoint, safety/schema. | Yes | Required | No | No |
| `CN/tests/test_web_app.py` | unittest | Local HTML/state/accessibility contracts. | Yes | Required | No | No |
| `CN/tests/test_about.py` | unittest | Local About page content and structure. | Yes | Required | No | No |

## JavaScript and browser tests

| Path | Type | Purpose | Tracked? | Transfer? | Generated? | Regenerate? |
|---|---|---|---:|---:|---:|---:|
| `CN/tests/test_history_ui.js` | Node test | History pure utilities. | Yes | Required | No | No |
| `CN/tests/test_select_picker.js` | Node test | Dark picker viewport placement. | Yes | Required | No | No |
| `CN/tests/test_simulation.js` | Node test | Immutable simulation methods/fresh reruns. | Yes | Required | No | No |
| `CN/tests/test_static_demo.js` | Node test | Static CRC/scenarios/Error Lab/CSV/folder APIs/no backend. | Yes | **Required** | No | No |
| `CN/tests/test_verification_results.js` | Node test | Five result filters preserve totals. | Yes | Required | No | No |
| `CN/tests/static_demo_audit.cjs` | Playwright E2E | Current Render-source audit in Edge/Chrome, 104 checks. | Yes | **Required** | No | No |
| `CN/tests/showcase_audit.cjs` | Playwright E2E | Local FastAPI showcase audit on isolated port 8001. | Yes | Useful | No | No |
| `CN/tests/showcase_server.py` | Python harness | Isolated FastAPI server and queued folder selection for showcase audit. | Yes | Useful | No | No |
| `CN/tests/demo_showcase_audit.cjs` | Playwright E2E | Historical FastAPI demo-mode audit on port 8002. | Yes | Optional/legacy | No | No |
| `CN/tests/demo_showcase_server.py` | Python harness | Isolated historical demo-mode server/storage. | Yes | Optional/legacy | No | No |
| `CN/tests/target_picker_states.mjs` | Browser helper | Target picker states/layout/placement/keyboard. | Yes | Useful | No | No |
| `CN/tests/error_lab_method_states.mjs` | Browser helper | Method disabled/enabled/selected/reset states. | Yes | Useful | No | No |
| `CN/tests/error_lab_post_run_states.mjs` | Browser helper | Run Again, invalidation, M5 presentation. | Yes | Useful | No | No |

## Generated and ignored worktree files

| Path/pattern | Type | Purpose | Tracked? | Transfer? | Generated? | Regenerate? |
|---|---|---|---:|---:|---:|---:|
| `.venv/`, `.venv-1/`, `venv/`, `env/` | Python environments | Machine-specific installed packages/interpreter links. | No | **No** | Yes | Yes |
| `**/__pycache__/`, `*.pyc`, `*.pyo` | Python cache | Bytecode. | No | **No** | Yes | Yes |
| `.pytest_cache/`, `.coverage*`, `htmlcov/`, `.tox/`, `.nox/` | Test output | Test/cache/coverage artifacts. | No | No | Yes | Yes |
| `node_modules/`, Node log files | Node runtime/cache | Optional Playwright and packages/logs. | No | **No** | Yes | Yes |
| `build/`, `dist/`, `*.egg-info/` | Build output | Packaging artifacts. | No | No | Yes | Yes |
| `.env`, `.env.*` except `.env.example` | Local configuration/secrets | No current product `.env` is required. | No | **Never via Git** | Local | Recreate securely if ever needed |
| `.idea/`, `.vscode/`, `.DS_Store`, `Thumbs.db` | Editor/OS metadata | Machine-local settings. | No | No | Yes | Yes |
| `CN/.m5-caret-qa/` | QA scratch | Old M5 caret visual test output; currently empty structure. | No | No | Yes | Yes |
| `CN/.m5-qa/` | QA scratch | Old M5 test output; currently empty structure. | No | No | Yes | Yes |
| `CN/.post-run-qa/` | QA scratch | Old post-run visual test output. | No | No | Yes | Yes |
| `CN/.target-picker-qa/` | QA scratch | Old target picker layout fixtures/output. | No | No | Yes | Yes |
| `CN/.verification-filter-qa/` | QA scratch | Old result-filter visual fixture/output. | No | No | Yes | Yes |
| Browser profiles/caches/localStorage | External runtime data | Hosted selected reference/history and browser state. | No | No unless separately exported by a future feature | Yes/local | Not from Git |

## Files/folders that must be copied or cloned

Preferred method: **clone the entire Git repository**, which restores all 119 tracked files, then separately bring approved uncommitted handoff files if they have not yet been committed.

Minimum required tracked content:

- `.gitignore`, `render.yaml`
- `CN/README.md`, `CN/requirements.txt`, `CN/web_app.py`
- all of `CN/app/`
- all of `CN/templates/` and `CN/static/`
- all of `CN/static_demo/`, including mirrored test fixtures
- all of `CN/demo_data/`
- all of `CN/tests/`

Handoff content to preserve until approved:

- `PROJECT_HANDOFF_MASTER.md`
- `PROJECT_FILE_MANIFEST.md`
- `NEW_LAPTOP_CODEX_START_PROMPT.txt`
- `NEW_LAPTOP_SETUP_CHECKLIST.md`

Separately copy non-repository college materials:

- final `USB_Backup_Verifier_Project_Report_Final_Submission.pdf`;
- all 15 files in `C:\Users\Ayesha Nishath\Downloads\ScrnShts`;
- the in-progress presentation source/final PPTX if available;
- the official lab guideline if stored elsewhere.

## Files that should not be manually copied

- `.git/` from the old machine (use `git clone`).
- Any virtual environment.
- `node_modules`.
- Python/test/browser caches and QA scratch directories.
- OS/editor metadata.
- Browser profile/localStorage databases.
- `.env` files, tokens, credentials, or private keys.
- `CN/data/reports` contents (reports are designed to be generated on demand).

## Local runtime/generated files

- Native folder-selection tokens live only in Python process memory and cannot/should not transfer.
- Hosted source/backup selections and bytes live only in the current page memory.
- Hosted saved reference and History live in per-origin browser `localStorage`, not Git.
- Local manifest and History are JSON under `CN/data`; current tracked copies are old sample/runtime state. Generate fresh state on the new laptop unless preservation is explicitly desired.
- CSV downloads are output artifacts and are safe to regenerate from a retained History record.
