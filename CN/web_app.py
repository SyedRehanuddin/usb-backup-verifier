"""Local web entry point for the USB Backup Verification Utility."""

from contextlib import ExitStack
from io import BytesIO
import os
from pathlib import Path
from typing import Annotated, BinaryIO, Literal, Sequence

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.core.crc32 import crc32_stream_details
from app.core.history import (
    HistoryValidationError,
    append_history_record,
    clear_history,
    get_history_record,
    list_history_summaries,
)
from app.core.manifest import (
    ManifestValidationError,
    build_manifest,
    load_manifest,
    save_manifest_atomic,
)
from app.core.report import (
    ReportGenerationError,
    generate_csv_report,
    safe_report_filename,
)
from app.core.simulation import (
    TARGET_METHODS,
    SimulationValidationError,
    choose_extra_path,
    simulate_bytes,
)
from app.core.verifier import verify_backup
from app.native_folders import (
    FolderSelectionError,
    FolderSelectionRegistry,
    choose_native_directory,
    scan_folder,
)
from app.runtime import demo_dataset_registry, get_verifier_mode


BASE_DIR = Path(__file__).resolve().parent
SERVICE_NAME = "USB Backup Verification Utility"
CURRENT_REFERENCE_PATH = BASE_DIR / "data" / "manifests" / "current_reference.json"
CURRENT_HISTORY_PATH = BASE_DIR / "data" / "history" / "verification_history.json"
PUBLIC_REFERENCE_PATH = "data/manifests/current_reference.json"
APP_MODE = get_verifier_mode()
DEMO_DATASETS = demo_dataset_registry(BASE_DIR)

app = FastAPI(title=SERVICE_NAME)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")
folder_selections = FolderSelectionRegistry()


class FolderSelectionRequest(BaseModel):
    purpose: Literal["source", "backup"]
    dataset_id: str | None = None


class SelectedFolderRequest(BaseModel):
    selection_id: str = Field(min_length=16, max_length=128)


class SelectedVerificationRequest(SelectedFolderRequest):
    record_history: bool = False


class ErrorLabSimulationRequest(SelectedFolderRequest):
    method: Literal[
        "modify-byte",
        "append-data",
        "truncate-file",
        "remove-file",
        "add-extra",
    ]
    target_path: str | None = None


def _generate_reference_from_streams(
    source_name: str,
    relative_paths: Sequence[str],
    streams: Sequence[BinaryIO],
) -> dict[str, str | int]:
    manifest = build_manifest(source_name, relative_paths, streams)
    save_manifest_atomic(manifest, CURRENT_REFERENCE_PATH)
    return {
        "status": "ok",
        "source_name": str(manifest["source_name"]),
        "file_count": int(manifest["file_count"]),
        "total_size_bytes": int(manifest["total_size_bytes"]),
        "created_at": str(manifest["created_at"]),
        "manifest_path": PUBLIC_REFERENCE_PATH,
    }


def _verify_from_streams(
    backup_name: str,
    relative_paths: Sequence[str],
    streams: Sequence[BinaryIO],
    *,
    record_history: bool,
) -> dict[str, object]:
    try:
        manifest = load_manifest(CURRENT_REFERENCE_PATH)
    except (OSError, ValueError) as exc:
        raise HTTPException(
            status_code=500,
            detail="The saved reference manifest is unavailable.",
        ) from exc

    if manifest is None:
        raise HTTPException(
            status_code=409,
            detail="No trusted reference has been generated.",
        )

    result = verify_backup(manifest, backup_name, relative_paths, streams)
    if record_history:
        record = append_history_record(
            CURRENT_HISTORY_PATH,
            result,
            str(manifest["created_at"]),
        )
        result["history_record_id"] = record["id"]
    return result


@app.get("/", response_class=HTMLResponse)
async def index(request: Request) -> HTMLResponse:
    """Render the application shell."""
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"app_mode": APP_MODE},
    )


@app.get("/api/health")
async def health() -> dict[str, object]:
    """Report whether the local web service is available."""
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "mode": APP_MODE,
        "demo_datasets": {
            "source": [
                {"id": item.dataset_id, "label": item.label}
                for item in DEMO_DATASETS.values()
                if item.purpose == "source"
            ],
            "backup": [
                {"id": item.dataset_id, "label": item.label}
                for item in DEMO_DATASETS.values()
                if item.purpose == "backup"
            ],
        } if APP_MODE == "demo" else None,
    }


@app.post("/api/folders/select")
async def select_folder(request: FolderSelectionRequest) -> dict[str, object]:
    """Register a local native selection or an allowlisted hosted demo dataset."""
    try:
        if APP_MODE == "demo":
            dataset = DEMO_DATASETS.get(request.dataset_id or "")
            if dataset is None or dataset.purpose != request.purpose:
                raise FolderSelectionError("Invalid demo dataset selection.")
            selected_path = dataset.path
        else:
            selected_path = await run_in_threadpool(choose_native_directory, request.purpose)
            if selected_path is None:
                return {"selected": False}
        selection = await run_in_threadpool(
            folder_selections.register,
            selected_path,
            request.purpose,
        )
    except FolderSelectionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to read the selected folder.",
        ) from exc

    return {
        "selected": True,
        "name": selection.name,
        "file_count": selection.file_count,
        "relative_paths": list(selection.relative_paths),
        "selection_id": selection.selection_id,
    }


@app.delete("/api/folders/{selection_id}", status_code=204)
async def release_folder(selection_id: str) -> Response:
    """Forget a browser's opaque folder-selection token."""
    folder_selections.release(selection_id)
    return Response(status_code=204)


@app.post("/api/crc32/file")
async def calculate_file_crc32(
    file: Annotated[UploadFile, File(description="File to process as raw bytes")],
) -> dict[str, str | int]:
    """Calculate CRC-32 for one uploaded stream without persisting its contents."""
    filename = file.filename or "unnamed"

    try:
        file.file.seek(0)
        checksum, size_bytes = crc32_stream_details(file.file)
    except (OSError, ValueError) as exc:
        raise HTTPException(
            status_code=422,
            detail="Unable to process the supplied file.",
        ) from exc
    finally:
        await file.close()

    return {
        "filename": filename,
        "size_bytes": size_bytes,
        "crc32": checksum,
    }


@app.post("/api/reference/generate")
async def generate_reference(
    files: Annotated[list[UploadFile], File(description="Trusted source files")],
    relative_paths: Annotated[list[str], Form(description="Browser relative paths")],
    source_name: Annotated[str, Form(description="Selected root folder name")],
) -> dict[str, str | int]:
    """Generate and atomically persist the current trusted reference manifest."""
    try:
        return _generate_reference_from_streams(
            source_name,
            relative_paths,
            [upload.file for upload in files],
        )
    except ManifestValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (OSError, ValueError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to generate the reference manifest.",
        ) from exc
    finally:
        for upload in files:
            await upload.close()



@app.post("/api/reference/generate-selected")
async def generate_reference_from_selection(
    request: SelectedFolderRequest,
) -> dict[str, str | int]:
    """Generate a reference by reading a native server-side folder selection."""
    try:
        selection = folder_selections.resolve(request.selection_id, "source")
        entries = await run_in_threadpool(scan_folder, selection.path)
        with ExitStack() as stack:
            streams = [stack.enter_context(path.open("rb")) for _, path in entries]
            return await run_in_threadpool(
                _generate_reference_from_streams,
                selection.name,
                [relative_path for relative_path, _ in entries],
                streams,
            )
    except FolderSelectionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ManifestValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (OSError, ValueError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to generate the reference manifest.",
        ) from exc


@app.get("/api/reference/current")
async def current_reference() -> dict[str, object]:
    """Return the current saved reference without treating absence as an error."""
    try:
        manifest = load_manifest(CURRENT_REFERENCE_PATH)
    except (OSError, ValueError) as exc:
        raise HTTPException(
            status_code=500,
            detail="The saved reference manifest is unavailable.",
        ) from exc

    if manifest is None:
        return {"exists": False}
    return {"exists": True, **manifest}


@app.post("/api/verification/run")
async def run_verification(
    files: Annotated[list[UploadFile], File(description="Backup files")],
    relative_paths: Annotated[list[str], Form(description="Browser relative paths")],
    backup_name: Annotated[str, Form(description="Selected backup root folder name")],
    record_history: Annotated[
        bool,
        Form(description="Persist this successful verification in local history"),
    ] = False,
) -> dict[str, object]:
    """Compare uploaded backup streams with the current trusted reference."""
    try:
        try:
            return _verify_from_streams(
                backup_name,
                relative_paths,
                [upload.file for upload in files],
                record_history=record_history,
            )
        except ManifestValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except (OSError, ValueError, KeyError, TypeError) as exc:
            raise HTTPException(
                status_code=500,
                detail="Unable to verify the supplied backup.",
            ) from exc

    finally:
        for upload in files:
            await upload.close()


@app.post("/api/verification/run-selected")
async def run_verification_from_selection(
    request: SelectedVerificationRequest,
) -> dict[str, object]:
    """Verify a native server-side folder selection against the saved reference."""
    try:
        selection = folder_selections.resolve(request.selection_id, "backup")
        entries = await run_in_threadpool(scan_folder, selection.path)
        with ExitStack() as stack:
            streams = [stack.enter_context(path.open("rb")) for _, path in entries]
            return await run_in_threadpool(
                _verify_from_streams,
                selection.name,
                [relative_path for relative_path, _ in entries],
                streams,
                record_history=request.record_history,
            )
    except FolderSelectionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ManifestValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except (HistoryValidationError, OSError, ValueError, KeyError, TypeError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to verify the selected backup.",
        ) from exc


@app.post("/api/error-lab/run-selected")
async def run_error_lab_from_selection(
    request: ErrorLabSimulationRequest,
) -> dict[str, object]:
    """Run one non-destructive simulation from a server-held backup selection."""
    try:
        selection = folder_selections.resolve(request.selection_id, "backup")
        entries = await run_in_threadpool(scan_folder, selection.path)
        entry_map = dict(entries)
        target_path = request.target_path or ""
        if request.method in TARGET_METHODS and target_path not in entry_map:
            raise SimulationValidationError("The selected target file is no longer available.")
        if request.method == "add-extra" and target_path:
            raise SimulationValidationError("Add Extra File does not use a target file.")

        manifest = load_manifest(CURRENT_REFERENCE_PATH)
        if manifest is None:
            raise HTTPException(status_code=409, detail="No trusted reference has been generated.")
        reference_paths = [
            str(record["relative_path"])
            for record in manifest.get("files", [])
            if isinstance(record, dict) and isinstance(record.get("relative_path"), str)
        ]

        intended_path = target_path
        sizes: dict[str, int] | None = None
        with ExitStack() as stack:
            relative_paths: list[str] = []
            streams: list[BinaryIO] = []
            for relative_path, path in entries:
                if request.method == "remove-file" and relative_path == target_path:
                    continue
                relative_paths.append(relative_path)
                if request.method in {"modify-byte", "append-data", "truncate-file"} and relative_path == target_path:
                    original = path.read_bytes()
                    simulated = simulate_bytes(request.method, original)
                    sizes = {"original": len(original), "simulated": len(simulated)}
                    streams.append(stack.enter_context(BytesIO(simulated)))
                else:
                    streams.append(stack.enter_context(path.open("rb")))

            if request.method == "add-extra":
                intended_path = choose_extra_path([*entry_map, *reference_paths])
                extra_bytes = b"USB Backup Verification Utility\nControlled Error Simulation\n"
                relative_paths.append(intended_path)
                streams.append(stack.enter_context(BytesIO(extra_bytes)))
                sizes = {"simulated": len(extra_bytes)}

            result = await run_in_threadpool(
                _verify_from_streams,
                selection.name,
                relative_paths,
                streams,
                record_history=False,
            )
        result["simulation"] = {
            "target_path": intended_path,
            "sizes": sizes,
        }
        return result
    except FolderSelectionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except SimulationValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except (ManifestValidationError, OSError, ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=500, detail="Unable to run the simulation.") from exc


@app.get("/api/history")
async def history_list() -> dict[str, object]:
    """Return newest-first verification summaries without result rows."""
    try:
        records = list_history_summaries(CURRENT_HISTORY_PATH)
    except (HistoryValidationError, OSError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Verification history is unavailable.",
        ) from exc
    return {"count": len(records), "records": records}


@app.delete("/api/history")
async def history_clear() -> dict[str, str | int]:
    """Clear verification history while leaving the trusted reference intact."""
    try:
        deleted = clear_history(CURRENT_HISTORY_PATH)
    except (HistoryValidationError, OSError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to clear verification history.",
        ) from exc
    return {"status": "ok", "deleted": deleted}


@app.get("/api/history/{record_id}/csv")
async def history_csv(record_id: str) -> Response:
    """Download one saved verification run as an in-memory CSV report."""
    try:
        record = get_history_record(CURRENT_HISTORY_PATH, record_id)
    except (HistoryValidationError, OSError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Verification history is unavailable.",
        ) from exc

    if record is None:
        raise HTTPException(
            status_code=404,
            detail="Verification history record not found.",
        )

    try:
        content = generate_csv_report(record)
        filename = safe_report_filename(record)
    except (ReportGenerationError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to export the verification report.",
        ) from exc

    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/history/{record_id}")
async def history_detail(record_id: str) -> dict[str, object]:
    """Return one full verification-history record."""
    try:
        record = get_history_record(CURRENT_HISTORY_PATH, record_id)
    except (HistoryValidationError, OSError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Verification history is unavailable.",
        ) from exc

    if record is None:
        raise HTTPException(
            status_code=404,
            detail="Verification history record not found.",
        )
    return record


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = "0.0.0.0" if APP_MODE == "demo" or "PORT" in os.environ else "127.0.0.1"
    uvicorn.run(app, host=host, port=port)
