# New Laptop Setup Checklist — USB Backup Verifier

Use Windows PowerShell. Commands assume the repository is cloned into the current user’s chosen development folder.

## 1. Install tools

- [ ] Install [Git for Windows](https://git-scm.com/download/win).
- [ ] Install Python 3.12 with Tk/Tcl support and the `py` launcher.
- [ ] Install current Node.js LTS (needed for JavaScript tests).
- [ ] Install current Microsoft Edge and Google Chrome (needed for the full browser audit).
- [ ] Confirm tools:

```powershell
git --version
py -3.12 --version
node --version
npm --version
```

## 2. Clone without overwriting another checkout

- [ ] Choose an empty parent folder.
- [ ] Clone and enter the repository:

```powershell
git clone https://github.com/SyedRehanuddin/usb-backup-verifier.git
cd usb-backup-verifier
```

- [ ] Confirm the repository root contains `render.yaml` and the application is under `CN\`:

```powershell
Get-ChildItem -Force
Get-ChildItem .\CN
```

- [ ] Check branch, remote, synchronization, and working tree before editing:

```powershell
git status --short --branch
git branch --show-current
git remote -v
git fetch origin
git rev-list --left-right --count origin/main...main
git pull --ff-only origin main
```

- [ ] Expected primary branch: `main`.
- [ ] Expected remote: `https://github.com/SyedRehanuddin/usb-backup-verifier.git`.
- [ ] Do not copy an old `.git` directory or overwrite a clone with an older folder.

## 3. Read the handoff before coding

- [ ] Read `PROJECT_HANDOFF_MASTER.md` completely.
- [ ] Read `PROJECT_FILE_MANIFEST.md`.
- [ ] Read `NEW_LAPTOP_CODEX_START_PROMPT.txt` and paste it into the first new Codex chat.
- [ ] Confirm the externally supplied academic identity: Computer Networks; Group 2; Faculty Dr. Aparna Sajeev; five team members/enrollment numbers listed in the master handoff.
- [ ] Confirm whether the four handoff files have been approved/committed. At creation time they were intentionally uncommitted.
- [ ] Obtain the official laboratory guideline separately; no guideline PDF is in the repository.

## 4. Create the Python environment

```powershell
cd .\CN
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

- [ ] If PowerShell activation is blocked, keep machine policy unchanged and call the environment directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

- [ ] Confirm imports:

```powershell
python -c "import fastapi, uvicorn, jinja2, httpx, multipart; print('Python dependencies ready')"
```

## 5. Start and check the local FastAPI application

- [ ] From `CN\`, start:

```powershell
python web_app.py
```

- [ ] Open `http://127.0.0.1:8000/#verification`.
- [ ] Confirm Verification, Error Lab, History, and About navigation.
- [ ] Click Select Source Folder and confirm the Windows/Tkinter native directory chooser opens.
- [ ] Select a five-file source with a nested file, generate a reference, select a backup, and verify.
- [ ] Confirm `nested/lab_record.bin` remains a nested relative path.
- [ ] Do not rely on the committed `CN\data` reference as a match for current compact demo fixtures; generate a fresh reference.
- [ ] Stop the server with `Ctrl+C` when finished.

## 6. Run automated tests

- [ ] Python suite from `CN\`:

```powershell
python -m unittest discover -s tests -p "test_*.py"
```

Expected handoff baseline: `Ran 129 tests ... OK`.

- [ ] JavaScript suite:

```powershell
node --test tests/test_history_ui.js tests/test_select_picker.js tests/test_simulation.js tests/test_static_demo.js tests/test_verification-results.js
```

Expected handoff baseline: `38 passed, 0 failed`.

## 7. Preview and test the hosted static application

- [ ] Start a static server from `CN\`:

```powershell
python -m http.server 8004 --bind 127.0.0.1 --directory static_demo
```

- [ ] Open `http://127.0.0.1:8004/#verification`.
- [ ] In Chrome and Edge, verify `showDirectoryPicker()` opens for source/backup selection.
- [ ] Confirm browser permission wording and that files are not sent to `/api/`.
- [ ] Verify the five scenarios:

| Scenario | Verified | Corrupted | Missing | Extra |
|---|---:|---:|---:|---:|
| Clean | 5 | 0 | 0 | 0 |
| Corrupted | 4 | 1 | 0 | 0 |
| Missing | 4 | 0 | 1 | 0 |
| Extra | 5 | 0 | 0 | 1 |
| Mixed | 3 | 1 | 1 | 1 |

- [ ] Check all five Error Lab methods, History, CSV, refresh behavior, and Clear History preserving the reference.
- [ ] Stop the static server with `Ctrl+C`.

## 8. Optional full Edge/Chrome browser audit

There is no committed `package.json`; install Playwright locally without saving a dependency file:

```powershell
npm install --no-save --package-lock=false playwright
$env:SHOWCASE_PYTHON = (Resolve-Path .\.venv\Scripts\python.exe).Path
node tests/static_demo_audit.cjs
Remove-Item Env:SHOWCASE_PYTHON
```

- [ ] Expected handoff baseline: `Static browser-folder audit: 104 checks passed`.
- [ ] `node_modules\` is ignored; never commit it.
- [ ] The audit expects Edge and Chrome in their normal Program Files paths.

## 9. Confirm GitHub and Render state

- [ ] From the repository root (`cd ..` from `CN\`), inspect:

```powershell
git status --short --branch
git log -10 --oneline --decorate
Get-Content .\render.yaml
```

- [ ] Confirm `render.yaml` is a static service with `rootDir: CN` and `staticPublishPath: static_demo`.
- [ ] Open the GitHub repository and confirm `main` points to the expected latest commit.
- [ ] Open Render dashboard, confirm the connected repository/branch, and confirm the latest deploy succeeded.
- [ ] Externally confirmed hosted Static Site URL: `https://usb-backup-verifier-static.onrender.com` (verify its connected repository/branch in Render; URL is not stored in Git).
- [ ] Confirm the deployed page performs CRC-32 in client-side HTML/CSS/JavaScript and makes no FastAPI/Python runtime requests.
- [ ] Remember the static deployment replaced the earlier free Python Render Web Service specifically to avoid its cold-start delay.
- [ ] Open the deployed URL in Chrome and Edge and repeat a small real-folder smoke test.

## 10. Transfer non-repository materials separately

- [ ] Copy the final external report `USB_Backup_Verifier_Project_Report_Final_Submission.pdf` (approximately 20 pages); it is not in Git.
- [ ] Copy `C:\Users\Ayesha Nishath\Downloads\ScrnShts` with all 15 exact screenshots listed in `PROJECT_FILE_MANIFEST.md`; it is not in Git.
- [ ] Copy the current presentation source/final PPTX separately if available. Its status at handoff is **in progress / external to Git**, so do not mark it final without the actual file.
- [ ] Copy the official lab guideline separately if it exists elsewhere; no guideline is tracked here.
- [ ] Open the transferred report and all 15 screenshots on the new laptop to catch missing fonts, broken files, or cloud-placeholder issues before leaving the old laptop.
- [ ] Do **not** copy `.venv`, `node_modules`, `__pycache__`, `.pytest_cache`, browser profiles/caches, `.git` from an old checkout, or generated QA folders.
- [ ] Never transfer `.env`/tokens through the repository. No product secret is currently required.

## 11. Continue development safely

- [ ] Re-run `git status` before each task.
- [ ] Pull with `git pull --ff-only origin main` only after confirming the worktree is clean.
- [ ] Use a focused branch for non-trivial work unless explicitly directed otherwise:

```powershell
git switch -c codex/<short-topic>
```

- [ ] Inspect relevant actual code before editing.
- [ ] Preserve local (`templates`/`static`/Python) versus hosted (`static_demo`) separation.
- [ ] Run relevant tests and review `git diff`/`git diff --check` before requesting a commit.
- [ ] Do not commit, push, deploy, clear real data, or change architecture without owner authorization.
- [ ] Continue from `PROJECT_HANDOFF_MASTER.md` → “Next recommended work”.

## Ready-to-continue confirmation

- [ ] Git clone is current and branch is correct.
- [ ] Python 129/129 tests pass.
- [ ] JavaScript 38/38 tests pass.
- [ ] Optional static browser audit passes 104/104.
- [ ] Local native selection works.
- [ ] Hosted static preview works with real browser folders.
- [ ] Render/GitHub status is confirmed.
- [ ] Handoff and official rubric have been read.
- [ ] Pending work is understood before any code change.
