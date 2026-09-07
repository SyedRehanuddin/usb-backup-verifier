const sourceCard = document.querySelector("#source-card");
const backupCard = document.querySelector("#backup-card");
const selectSourceButton = document.querySelector("#select-source-button");
const selectBackupButton = document.querySelector("#select-backup-button");
const selectSourceLabel = document.querySelector("#select-source-label");
const selectBackupLabel = document.querySelector("#select-backup-label");
const clearSelectionButton = document.querySelector("#clear-selection-button");
const generateReferenceButton = document.querySelector("#generate-reference-button");
const generateReferenceLabel = document.querySelector("#generate-reference-label");
const generateReferenceSpinner = document.querySelector("#generate-reference-spinner");
const verifyBackupButton = document.querySelector("#verify-backup-button");
const verifyBackupLabel = document.querySelector("#verify-backup-label");
const verifyBackupSpinner = document.querySelector("#verify-backup-spinner");
const referenceFeedback = document.querySelector("#reference-feedback");
const resultsFilter = document.querySelector("#results-filter");
const resultsBody = document.querySelector("#verification-results-body");
const exportCsvButton = document.querySelector("#export-csv-button");
const historyList = document.querySelector("#history-list");
const historyEmpty = document.querySelector("#history-empty");
const historyFilterEmpty = document.querySelector("#history-filter-empty");
const historyToolbar = document.querySelector("#history-toolbar");
const historySearchInput = document.querySelector("#history-search-input");
const historyStatusFilter = document.querySelector("#history-status-filter");
const historySortOrder = document.querySelector("#history-sort-order");
const historyResultCount = document.querySelector("#history-result-count");
const historyFeedback = document.querySelector("#history-feedback");
const historyClearButton = document.querySelector("#history-clear-button");
const historyDetailPanel = document.querySelector("#history-detail-panel");
const historyResultsFilter = document.querySelector("#history-results-filter");
const historyResultsCount = document.querySelector("#history-results-count");
const historyResultsBody = document.querySelector("#history-results-body");
const historyExportCsvButton = document.querySelector("#history-export-csv-button");
const referenceReplaceDialog = document.querySelector("#reference-replace-dialog");
const historyClearDialog = document.querySelector("#history-clear-dialog");
const historyUtilities = globalThis.HistoryUI;
const verificationResultsUtilities = globalThis.VerificationResultsUI;
const browserFolderSelection = globalThis.BrowserFolderSelection;
const staticVerification = globalThis.StaticVerification;
const staticErrorLab = globalThis.StaticErrorLab;
const staticHistoryStore = globalThis.StaticHistoryStore;
const resultsPicker = new globalThis.DarkSelectPicker(
    resultsFilter,
    document.querySelector("#results-filter-picker"),
);
const historyStatusPicker = new globalThis.DarkSelectPicker(
    historyStatusFilter,
    document.querySelector("#history-status-picker"),
);
const historySortPicker = new globalThis.DarkSelectPicker(
    historySortOrder,
    document.querySelector("#history-sort-picker"),
);
const historyResultsPicker = new globalThis.DarkSelectPicker(
    historyResultsFilter,
    document.querySelector("#history-results-picker"),
);
const sourceFolderInput = document.querySelector("#source-folder-input");
const backupFolderInput = document.querySelector("#backup-folder-input");
const labFolderInput = document.querySelector("#lab-folder-input");
const REFERENCE_STORAGE_KEY = "usb-backup-verifier.static-reference.v1";

const STATUS_KEYS = ["verified", "corrupted", "missing", "extra"];
const STATUS_LABELS = {
    verified: "Verified",
    corrupted: "Corrupted",
    missing: "Missing",
    extra: "Extra",
};

let sourceSelection = null;
let backupSelection = null;
let referenceDataset = null;
let savedReference = null;
let referenceSourceSelectionId = null;
let referenceGenerating = false;
let verificationRunning = false;
let folderSelecting = false;
let currentVerificationComplete = false;
let verificationResults = [];
let verificationSummary = null;
let currentVerificationHistoryId = null;
let historyRecords = [];
let selectedHistoryRecord = null;
let referenceReplaceReturnFocus = null;
let historyDialogReturnFocus = null;
let historyDetailReturnFocus = null;
let historyDetailReturnScrollY = null;

function setWorkflowState(id, state, label) {
    const step = document.querySelector(id);
    const labels = {
        waiting: "Not selected",
        ready: "Selected",
        complete: "Complete",
        "not-created": "Not created",
        "not-run": "Not run",
    };
    step.dataset.state = state;
    step.querySelector(".workflow-state").textContent = label || labels[state] || "Not selected";
}

function updateGenerateButton() {
    const replacingReference = Boolean(savedReference);
    generateReferenceButton.disabled =
        referenceGenerating || verificationRunning || folderSelecting || !sourceSelection;
    generateReferenceLabel.textContent = referenceGenerating
        ? (replacingReference ? "Replacing Reference..." : "Generating Reference...")
        : (replacingReference ? "Replace Reference" : "Generate Reference");
}

function updateVerifyButton() {
    verifyBackupButton.disabled =
        verificationRunning
        || referenceGenerating
        || folderSelecting
        || !savedReference
        || !backupSelection;
}

function updateVerifyLabel() {
    verifyBackupLabel.textContent = verificationRunning
        ? "Verifying Backup..."
        : (currentVerificationComplete ? "Verify Again" : "Verify Backup");
}

function updateBackupStatus() {
    const backupStatus = document.querySelector("#backup-status");
    if (!backupSelection) {
        backupStatus.textContent = "Not selected";
        return;
    }
    if (!currentVerificationComplete || !verificationSummary) {
        backupStatus.textContent = "Ready to verify";
        return;
    }

    const issueCount = verificationSummary.corrupted
        + verificationSummary.missing
        + verificationSummary.extra;
    backupStatus.textContent = issueCount === 0 ? "Verified" : "Issues detected";
}

function updateVerificationAuxiliaryControls() {
    const busy = referenceGenerating || verificationRunning || folderSelecting;
    const hasClearableState = Boolean(
        sourceSelection || backupSelection || verificationSummary,
    );
    selectSourceButton.disabled = busy;
    selectBackupButton.disabled = busy;
    clearSelectionButton.disabled = busy || !hasClearableState;
    resultsFilter.disabled = verificationRunning || !verificationSummary;
    resultsPicker.sync();
}

function selectedSourceMatchesSavedReference() {
    return Boolean(
        savedReference
        && sourceSelection
        && sourceSelection.selection_id === referenceSourceSelectionId
    );
}

function updateSourceReferenceStatus() {
    const status = document.querySelector("#source-reference-status");
    const hasSelectedSource = Boolean(sourceSelection);
    const matchesSavedReference = selectedSourceMatchesSavedReference();

    status.textContent = hasSelectedSource
        ? (matchesSavedReference ? "Ready" : "Not created")
        : (savedReference ? "Ready" : "Not created");
}

function setReferenceDisplay(reference) {
    const note = document.querySelector("#saved-reference-note");
    const summary = document.querySelector("#saved-reference-summary");

    savedReference = reference && reference.exists ? reference : null;
    updateSourceReferenceStatus();
    note.hidden = !savedReference;
    summary.textContent = savedReference
        ? `${savedReference.source_name} • ${savedReference.file_count} ${savedReference.file_count === 1 ? "file" : "files"}`
        : "";
    setWorkflowState(
        "#workflow-reference",
        savedReference ? "ready" : "not-created",
        savedReference ? "Ready" : "Not created",
    );
    renderResults();
    updateGenerateButton();
    updateVerifyButton();
    updateLabReferenceState();
}

function issueResultDetail(summary) {
    const issueTypes = ["corrupted", "missing", "extra"]
        .filter((status) => summary[status] > 0);
    if (issueTypes.length !== 1) {
        return "Corrupted, missing, or extra files were detected in the backup.";
    }

    if (issueTypes[0] === "corrupted") {
        const count = summary.corrupted;
        return `${count} corrupted ${count === 1 ? "file was" : "files were"} detected in the backup.`;
    }
    if (issueTypes[0] === "missing") {
        const count = summary.missing;
        return `${count} ${count === 1 ? "file is" : "files are"} missing from the backup.`;
    }

    const count = summary.extra;
    return `${count} extra ${count === 1 ? "file was" : "files were"} found in the backup.`;
}

function updateActionMessage() {
    const title = document.querySelector("#actions-title");
    const helper = document.querySelector("#actions-helper");
    const panel = title.closest(".action-panel");

    panel.classList.remove("issue-state");

    if (verificationSummary) {
        const issueCount = verificationSummary.corrupted
            + verificationSummary.missing
            + verificationSummary.extra;
        if (issueCount === 0) {
            title.textContent = "Backup verified successfully.";
            helper.textContent = "No integrity differences detected.";
        } else {
            panel.classList.add("issue-state");
            title.textContent = "Backup issues detected.";
            helper.textContent = issueResultDetail(verificationSummary);
        }
        return;
    }

    if (sourceSelection && !selectedSourceMatchesSavedReference()) {
        title.textContent = "Source selected";
        helper.textContent = savedReference
            ? "Replace the trusted reference to continue."
            : "Generate the trusted reference to continue.";
        return;
    }

    if (savedReference) {
        title.textContent = backupSelection
            ? "Ready to verify backup"
            : "Reference ready.";
        helper.textContent = backupSelection
            ? "Click Verify Backup to compare the selected backup with the saved reference."
            : "Select a backup folder to verify, or select a new source to replace it.";
        return;
    }

    title.textContent = "Ready to begin";
    helper.textContent = "Select a trusted source folder to create the reference.";
}

function showFeedback(type, message) {
    referenceFeedback.className = `reference-feedback ${type}`;
    referenceFeedback.textContent = message;
    referenceFeedback.hidden = false;
}

function clearFeedback() {
    referenceFeedback.hidden = true;
    referenceFeedback.textContent = "";
    referenceFeedback.className = "reference-feedback";
}

function setCurrentVerificationExport(recordId) {
    currentVerificationHistoryId = typeof recordId === "string" && recordId ? recordId : null;
    exportCsvButton.disabled = !currentVerificationHistoryId;
    if (currentVerificationHistoryId) {
        exportCsvButton.dataset.historyRecordId = currentVerificationHistoryId;
    } else {
        delete exportCsvButton.dataset.historyRecordId;
    }
}

async function downloadHistoryCsv(recordId, button, spinner, label, showError) {
    if (typeof recordId !== "string" || !recordId) return;
    const originalLabel = label.textContent;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    spinner.hidden = false;
    label.textContent = "Preparing CSV...";
    try {
        const record = staticHistoryStore.get(recordId);
        if (!record) throw new Error("The selected verification record is unavailable.");
        staticHistoryStore.download(record);
    } catch (error) {
        showError(error instanceof Error ? error.message : "Unable to export the CSV report.");
    } finally {
        button.removeAttribute("aria-busy");
        spinner.hidden = true;
        label.textContent = originalLabel;
        button.disabled = false;
    }
}

function updateFolderSelection(kind, selection) {
    const isSource = kind === "source";
    const card = isSource ? sourceCard : backupCard;
    const fileLabel = `${selection.file_count} ${selection.file_count === 1 ? "file" : "files"} selected`;

    card.classList.add("selected");
    document.querySelector(`#${kind}-folder-name`).textContent = selection.name;
    document.querySelector(`#${kind}-selection-detail`).textContent = fileLabel;
    document.querySelector(`#${kind}-file-count`).textContent = selection.file_count;
    (isSource ? selectSourceLabel : selectBackupLabel).textContent = isSource
        ? "Change Trusted Source Folder"
        : "Change Backup Folder";
    setWorkflowState(isSource ? "#workflow-source" : "#workflow-backup", "ready");
    if (isSource) {
        updateSourceReferenceStatus();
    } else {
        updateBackupStatus();
    }
}

function resetFolderSelection(kind) {
    const isSource = kind === "source";
    const card = isSource ? sourceCard : backupCard;

    card.classList.remove("selected");
    document.querySelector(`#${kind}-folder-name`).textContent = isSource
        ? "No source folder selected"
        : "No backup folder selected";
    document.querySelector(`#${kind}-selection-detail`).textContent = isSource
        ? "Choose a folder to create the reference."
        : "Choose a backup folder to check.";
    document.querySelector(`#${kind}-file-count`).textContent = "—";
    (isSource ? selectSourceLabel : selectBackupLabel).textContent = isSource
        ? "Select Trusted Source Folder"
        : "Select Backup Folder";
    setWorkflowState(isSource ? "#workflow-source" : "#workflow-backup", "waiting");
    if (isSource) {
        updateSourceReferenceStatus();
    } else {
        updateBackupStatus();
    }
}

function setGenerating(isGenerating) {
    referenceGenerating = isGenerating;
    generateReferenceButton.setAttribute("aria-busy", String(isGenerating));
    generateReferenceSpinner.hidden = !isGenerating;
    updateGenerateButton();
    updateVerifyButton();
    updateVerificationAuxiliaryControls();
}

function setVerifying(isVerifying) {
    verificationRunning = isVerifying;
    verifyBackupButton.setAttribute("aria-busy", String(isVerifying));
    updateVerifyLabel();
    verifyBackupSpinner.hidden = !isVerifying;
    updateGenerateButton();
    updateVerifyButton();
    updateVerificationAuxiliaryControls();
}

function updateSummary(summary) {
    STATUS_KEYS.forEach((status) => {
        document.querySelector(`#summary-${status}-count`).textContent = summary
            ? String(summary[status])
            : "—";
    });
}

function updateSummaryStateLabel() {
    document.querySelector("#summary-state-label").textContent =
        currentVerificationComplete && verificationSummary ? "Current result" : "No current result";
}

function appendEmptyResults(title, detail) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    const icon = document.createElement("div");
    const strong = document.createElement("strong");
    const span = document.createElement("span");

    cell.className = "empty-results";
    cell.colSpan = 5;
    icon.className = "empty-results-icon";
    icon.setAttribute("aria-hidden", "true");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const documentPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const foldPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.setAttribute("viewBox", "0 0 24 24");
    documentPath.setAttribute("d", "M5 3h10l4 4v14H5V3Z");
    foldPath.setAttribute("d", "M15 3v5h5M9 13h6m-6 4h4");
    svg.append(documentPath, foldPath);
    icon.append(svg);
    strong.textContent = title;
    span.textContent = detail;
    cell.append(icon, strong, span);
    row.append(cell);
    resultsBody.append(row);
}

function renderResults() {
    resultsBody.replaceChildren();
    const selectedStatus = resultsFilter.value;
    const visibleResults = verificationResultsUtilities.filterResults(
        verificationResults,
        selectedStatus,
    );

    if (visibleResults.length === 0) {
        if (!verificationSummary) {
            appendEmptyResults(
                "No verification results yet.",
                savedReference
                    ? (backupSelection
                        ? "Verification results will appear here after you click Verify Backup."
                        : "Select a backup folder and run verification against the saved reference.")
                    : "Create a trusted reference, then select a backup folder to run verification.",
            );
        } else if (verificationResults.length === 0) {
            appendEmptyResults("No files were returned.", "The verification completed with no result rows.");
        } else {
            appendEmptyResults(
                "No matching files",
                "No files in this verification have this status.",
            );
        }
        return;
    }

    visibleResults.forEach((result) => {
        const row = document.createElement("tr");
        const statusCell = document.createElement("td");
        const statusBadge = document.createElement("span");
        const fileCell = document.createElement("td");
        const pathCell = document.createElement("td");
        const sourceCrcCell = document.createElement("td");
        const backupCrcCell = document.createElement("td");

        statusBadge.className = `result-badge result-${result.status}`;
        statusBadge.textContent = STATUS_LABELS[result.status];
        statusCell.append(statusBadge);
        fileCell.className = "result-file";
        fileCell.textContent = result.file;
        fileCell.title = result.file;
        pathCell.className = "result-path";
        pathCell.textContent = result.relative_path;
        pathCell.title = result.relative_path;
        sourceCrcCell.className = "result-crc";
        sourceCrcCell.textContent = result.source_crc32 ?? "—";
        backupCrcCell.className = "result-crc";
        backupCrcCell.textContent = result.backup_crc32 ?? "—";
        if (
            result.status === "corrupted"
            && result.source_crc32
            && result.backup_crc32
            && result.source_crc32 !== result.backup_crc32
        ) {
            backupCrcCell.classList.add("result-crc-mismatch");
        }

        row.append(statusCell, fileCell, pathCell, sourceCrcCell, backupCrcCell);
        resultsBody.append(row);
    });
}

function resetVerificationResults() {
    currentVerificationComplete = false;
    verificationResults = [];
    verificationSummary = null;
    setCurrentVerificationExport(null);
    resultsFilter.value = "all";
    updateSummary(null);
    updateSummaryStateLabel();
    renderResults();
    setWorkflowState("#workflow-verify", "not-run");
    updateVerifyLabel();
    updateBackupStatus();
    updateVerifyButton();
    updateVerificationAuxiliaryControls();
}

function isValidVerificationResponse(result) {
    if (!result || result.status !== "ok" || !Array.isArray(result.results)) return false;
    if (!result.summary || typeof result.summary !== "object") return false;
    if (!STATUS_KEYS.every((status) => Number.isInteger(result.summary[status]) && result.summary[status] >= 0)) {
        return false;
    }
    if (result.summary.total_results !== result.results.length) return false;
    if (STATUS_KEYS.reduce((total, status) => total + result.summary[status], 0) !== result.results.length) {
        return false;
    }

    return result.results.every((row) => (
        row
        && STATUS_KEYS.includes(row.status)
        && typeof row.file === "string"
        && typeof row.relative_path === "string"
        && (row.source_crc32 === null || typeof row.source_crc32 === "string")
        && (row.backup_crc32 === null || typeof row.backup_crc32 === "string")
        && (row.source_size_bytes === null || Number.isInteger(row.source_size_bytes))
        && (row.backup_size_bytes === null || Number.isInteger(row.backup_size_bytes))
    ));
}

function referenceSnapshot(dataset, createdAt = new Date().toISOString()) {
    return {
        version: 1,
        exists: true,
        source_name: dataset.name,
        file_count: dataset.files.length,
        total_size_bytes: dataset.files.reduce((total, file) => total + file.size_bytes, 0),
        created_at: createdAt,
        files: dataset.files.map((file) => ({
            file: file.file,
            relative_path: file.relative_path,
            size_bytes: file.size_bytes,
            crc32: file.crc32,
        })),
    };
}

function validReferenceSnapshot(value) {
    return Boolean(
        value
        && value.version === 1
        && value.exists === true
        && typeof value.source_name === "string"
        && typeof value.created_at === "string"
        && Number.isInteger(value.file_count)
        && value.file_count > 0
        && Array.isArray(value.files)
        && value.files.length === value.file_count
        && value.files.every((file) => (
            typeof file.file === "string"
            && typeof file.relative_path === "string"
            && Number.isInteger(file.size_bytes)
            && /^[0-9A-F]{8}$/.test(file.crc32)
        ))
    );
}

function restoreReferenceDataset(snapshot) {
    return {
        name: snapshot.source_name,
        file_count: snapshot.file_count,
        relative_paths: snapshot.files.map((file) => file.relative_path),
        files: snapshot.files.map((file) => ({...file})),
    };
}

function loadCurrentReference() {
    try {
        const parsed = JSON.parse(localStorage.getItem(REFERENCE_STORAGE_KEY) || "null");
        if (!validReferenceSnapshot(parsed)) {
            if (parsed !== null) localStorage.removeItem(REFERENCE_STORAGE_KEY);
            referenceDataset = null;
            setReferenceDisplay(null);
            updateActionMessage();
            return;
        }
        referenceDataset = restoreReferenceDataset(parsed);
        setReferenceDisplay(parsed);
        updateActionMessage();
    } catch {
        referenceDataset = null;
        setReferenceDisplay(null);
        updateActionMessage();
        localStorage.removeItem(REFERENCE_STORAGE_KEY);
    }
}

async function generateReference() {
    if (!sourceSelection) {
        showFeedback("error", "No source files selected.");
        return;
    }

    clearFeedback();
    setGenerating(true);

    try {
        const generatedDataset = staticVerification.datasetFromFiles(
            sourceSelection.name,
            sourceSelection.files,
        );
        const snapshot = referenceSnapshot(generatedDataset);
        referenceDataset = restoreReferenceDataset(snapshot);
        referenceSourceSelectionId = sourceSelection.selection_id;
        resetVerificationResults();
        localStorage.setItem(REFERENCE_STORAGE_KEY, JSON.stringify(snapshot));
        setReferenceDisplay(snapshot);
        updateActionMessage();
        showFeedback(
            "success",
            `Reference created • ${sourceSelection.file_count} ${sourceSelection.file_count === 1 ? "file" : "files"} processed with CRC-32`,
        );
    } catch (error) {
        showFeedback(
            "error",
            error instanceof Error ? error.message : "Unable to generate reference.",
        );
    } finally {
        setGenerating(false);
    }
}

async function verifyBackup() {
    if (!savedReference) {
        showFeedback("error", "No trusted reference has been generated.");
        return;
    }
    if (!backupSelection) {
        showFeedback("error", "No backup files selected.");
        return;
    }

    const title = document.querySelector("#actions-title");
    const helper = document.querySelector("#actions-helper");
    const previousTitle = title.textContent;
    const previousHelper = helper.textContent;
    clearFeedback();
    setCurrentVerificationExport(null);
    title.textContent = "Verification in progress";
    helper.textContent = "Calculating CRC-32 and comparing backup files...";
    setVerifying(true);

    try {
        const result = staticVerification.compare(referenceDataset, backupSelection);
        if (!isValidVerificationResponse(result)) {
            throw new Error("The verification service returned an invalid response.");
        }
        const record = staticVerification.makeHistoryRecord(result, savedReference);
        staticHistoryStore.add(record);
        result.history_record_id = record.id;

        verificationResults = result.results;
        verificationSummary = result.summary;
        resultsFilter.value = "all";
        updateSummary(verificationSummary);
        renderResults();
        setWorkflowState("#workflow-reference", "ready", "Ready");
        setWorkflowState("#workflow-backup", "ready");
        const issueCount = verificationSummary.corrupted
            + verificationSummary.missing
            + verificationSummary.extra;
        setWorkflowState(
            "#workflow-verify",
            issueCount === 0 ? "complete" : "issues",
            issueCount === 0 ? undefined : "Complete • issues found",
        );
        currentVerificationComplete = true;
        updateSummaryStateLabel();
        updateBackupStatus();
        updateActionMessage();
        if (typeof result.history_record_id === "string") {
            setCurrentVerificationExport(result.history_record_id);
            showFeedback("success", "Result saved to History");
        }
    } catch (error) {
        title.textContent = previousTitle;
        helper.textContent = previousHelper;
        showFeedback(
            "error",
            error instanceof Error ? error.message : "Unable to verify the backup.",
        );
    } finally {
        setVerifying(false);
    }
}

async function requestBrowserFolder(purpose) {
    const input = purpose === "source"
        ? sourceFolderInput
        : (purpose === "lab-backup" ? labFolderInput : backupFolderInput);
    const picked = await browserFolderSelection.chooseDirectory(input);
    if (!picked || picked.cancelled) return picked;
    const selection = purpose === "source"
        ? picked
        : staticVerification.datasetFromFiles(picked.name, picked.files);
    selection.selection_id = picked.selection_id;
    selection.method = picked.method;
    if (
        typeof selection.selection_id !== "string"
        || typeof selection.name !== "string"
        || !Number.isInteger(selection.file_count)
        || selection.file_count < 1
        || !Array.isArray(selection.relative_paths)
        || selection.relative_paths.length !== selection.file_count
        || !selection.relative_paths.every((path) => typeof path === "string" && path.length > 0)
    ) {
        throw new Error("The folder picker returned an invalid selection.");
    }
    return selection;
}

function releaseBrowserFolder(selection) {
    void selection;
}

async function selectVerificationFolder(kind) {
    folderSelecting = true;
    selectSourceButton.setAttribute("aria-busy", String(kind === "source"));
    selectBackupButton.setAttribute("aria-busy", String(kind === "backup"));
    updateGenerateButton();
    updateVerifyButton();
    updateVerificationAuxiliaryControls();
    try {
        const selection = await requestBrowserFolder(kind);
        if (!selection || selection.cancelled) {
            if (selection?.message) showFeedback("error", selection.message);
            return;
        }

        clearFeedback();
        resetVerificationResults();
        if (kind === "source") {
            const previousSelection = sourceSelection;
            sourceSelection = selection;
            updateFolderSelection("source", sourceSelection);
            releaseBrowserFolder(previousSelection);
        } else {
            const previousSelection = backupSelection;
            backupSelection = selection;
            updateFolderSelection("backup", backupSelection);
            releaseBrowserFolder(previousSelection);
        }
        updateActionMessage();
    } catch (error) {
        showFeedback(
            "error",
            error instanceof Error ? error.message : "Unable to open the folder picker.",
        );
    } finally {
        folderSelecting = false;
        selectSourceButton.removeAttribute("aria-busy");
        selectBackupButton.removeAttribute("aria-busy");
        updateGenerateButton();
        updateVerifyButton();
        updateVerificationAuxiliaryControls();
    }
}

selectSourceButton.addEventListener("click", () => selectVerificationFolder("source"));
selectBackupButton.addEventListener("click", () => selectVerificationFolder("backup"));
generateReferenceButton.addEventListener("click", () => {
    if (savedReference && sourceSelection) {
        referenceReplaceReturnFocus = document.activeElement;
        referenceReplaceDialog.hidden = false;
        document.querySelector("#reference-replace-cancel").focus();
        return;
    }
    generateReference();
});
verifyBackupButton.addEventListener("click", verifyBackup);
resultsFilter.addEventListener("change", renderResults);

clearSelectionButton.addEventListener("click", () => {
    for (const selection of [sourceSelection, backupSelection]) {
        releaseBrowserFolder(selection);
    }
    sourceSelection = null;
    backupSelection = null;
    referenceSourceSelectionId = null;
    resetFolderSelection("source");
    resetFolderSelection("backup");
    resetVerificationResults();
    setReferenceDisplay(savedReference);
    clearFeedback();
    updateGenerateButton();
    updateActionMessage();
});

function closeReferenceReplaceDialog() {
    referenceReplaceDialog.hidden = true;
    if (referenceReplaceReturnFocus instanceof HTMLElement) {
        referenceReplaceReturnFocus.focus({ preventScroll: true });
    }
    referenceReplaceReturnFocus = null;
}

document.querySelector("#reference-replace-cancel").addEventListener("click", closeReferenceReplaceDialog);
document.querySelector("#reference-replace-confirm").addEventListener("click", async () => {
    closeReferenceReplaceDialog();
    await generateReference();
});
referenceReplaceDialog.addEventListener("click", (event) => {
    if (event.target === referenceReplaceDialog) closeReferenceReplaceDialog();
});
document.addEventListener("keydown", (event) => {
    if (referenceReplaceDialog.hidden) return;
    if (event.key === "Escape") {
        closeReferenceReplaceDialog();
        return;
    }
    if (event.key === "Tab") {
        const dialogButtons = Array.from(referenceReplaceDialog.querySelectorAll("button:not(:disabled)"));
        const firstButton = dialogButtons[0];
        const lastButton = dialogButtons.at(-1);
        if (event.shiftKey && document.activeElement === firstButton) {
            event.preventDefault();
            lastButton.focus();
        } else if (!event.shiftKey && document.activeElement === lastButton) {
            event.preventDefault();
            firstButton.focus();
        }
    }
});

resetVerificationResults();

const simulationUtilities = globalThis.ErrorLabSimulation;
const labBackupCard = document.querySelector("#lab-backup-card");
const labTargetSelect = document.querySelector("#lab-target-select");
const labTargetPicker = new globalThis.LabTargetPicker(labTargetSelect);
const labRunButton = document.querySelector("#lab-run-button");
const labRunLabel = document.querySelector("#lab-run-label");
const labRunSpinner = document.querySelector("#lab-run-spinner");
const labFeedback = document.querySelector("#lab-feedback");
const labResultPanel = document.querySelector("#lab-result-panel");
const labSelectBackupButton = document.querySelector("#lab-select-backup-button");
const labSelectBackupLabel = document.querySelector("#lab-select-backup-label");
const labResetButton = document.querySelector("#lab-reset-button");
const labBackupStatus = document.querySelector("#lab-backup-status");
const labTargetStatus = document.querySelector("#lab-target-status");
const labTargetTitle = document.querySelector("#lab-target-title");
const labTargetHelp = document.querySelector("#lab-target-help");
const labTargetNote = document.querySelector("#lab-target-note");
const labTargetControl = document.querySelector("#lab-target-control");
const labTargetInfo = document.querySelector("#lab-target-info");
const labActionStatus = document.querySelector("#lab-action-status");

const SIMULATION_DEFINITIONS = {
    "modify-byte": { label: "Modify Byte", expected: "corrupted", requiresTarget: true, mutatesBytes: true },
    "append-data": { label: "Append Data", expected: "corrupted", requiresTarget: true, mutatesBytes: true },
    "truncate-file": { label: "Truncate File", expected: "corrupted", requiresTarget: true, mutatesBytes: true },
    "remove-file": { label: "Remove File", expected: "missing", requiresTarget: true, mutatesBytes: false },
    "add-extra": { label: "Add Extra File", expected: "extra", requiresTarget: false, mutatesBytes: false },
};

let labBackupSelection = null;
let labSimulationMethod = "";
let labRunning = false;

function updateLabReferenceState() {
    const detail = document.querySelector("#lab-reference-detail");
    const badge = document.querySelector("#lab-reference-badge");
    const goButton = document.querySelector("#lab-go-verification-button");

    if (savedReference) {
        detail.textContent = `${savedReference.source_name} • ${savedReference.file_count} ${savedReference.file_count === 1 ? "file" : "files"} ready for simulation`;
        badge.textContent = "Ready";
        badge.className = "reference-status-badge ready";
        goButton.hidden = true;
    } else {
        detail.textContent = "No trusted reference available. Generate a reference from the Verification page before running simulations.";
        badge.textContent = "Reference required";
        badge.className = "reference-status-badge missing";
        goButton.hidden = false;
    }
    updateLabMethodAvailability();
    updateLabTargetControl();
    updateLabRunButton();
}

function clearLabFeedback() {
    labFeedback.hidden = true;
    labFeedback.textContent = "";
    labFeedback.className = "reference-feedback";
    updateLabResetButton();
}

function showLabFeedback(type, message) {
    labFeedback.className = `reference-feedback ${type}`;
    labFeedback.textContent = message;
    labFeedback.hidden = false;
    updateLabResetButton();
}

function resetLabResult() {
    labResultPanel.hidden = true;
    document.querySelector("#lab-result-target-label").textContent = "Target";
    document.querySelector("#lab-result-target").textContent = "—";
    labActionStatus.textContent = "Not run";
    labActionStatus.className = "lab-step-status";
    labRunLabel.textContent = simulationUtilities.runButtonLabel(labRunning, false);
    updateLabResetButton();
}

function updateLabResetButton() {
    const hasState = Boolean(
        labBackupSelection
        || labSimulationMethod
        || !labFeedback.hidden
        || !labResultPanel.hidden,
    );
    labResetButton.disabled = labRunning || !hasState;
}

function updateLabRunButton() {
    const definition = SIMULATION_DEFINITIONS[labSimulationMethod];
    const hasTarget = !definition?.requiresTarget || Boolean(labTargetSelect.value);
    labRunButton.disabled =
        labRunning
        || !savedReference
        || !labBackupSelection
        || !definition
        || !hasTarget;
}

function updateLabMethodAvailability() {
    const canChooseMethod = Boolean(savedReference && labBackupSelection && !labRunning);
    document.querySelectorAll('input[name="lab-simulation"]').forEach((input) => {
        input.disabled = !canChooseMethod;
    });
}

function populateLabTargetFiles() {
    labTargetSelect.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a target file";
    labTargetSelect.append(placeholder);

    if (!labBackupSelection) return;
    labBackupSelection.relative_paths
        .forEach((relativePath) => {
            const option = document.createElement("option");
            option.value = relativePath;
            option.textContent = relativePath;
            labTargetSelect.append(option);
        });
}

function updateLabTargetControl() {
    const definition = SIMULATION_DEFINITIONS[labSimulationMethod];
    const hasBackup = Boolean(labBackupSelection);
    const placeholder = labTargetSelect.options[0];

    labTargetStatus.className = "lab-step-status";
    labTargetTitle.textContent = "Choose target file";
    labTargetControl.hidden = false;
    labTargetInfo.hidden = true;
    labTargetNote.textContent = "Full relative paths keep duplicate filenames distinct.";
    if (placeholder) placeholder.textContent = "Select a target file";

    if (!definition) {
        labTargetHelp.textContent = hasBackup
            ? "Choose a simulation method in Step 02."
            : "Complete the reference setup, Step 01, and Step 02 first.";
        labTargetStatus.textContent = "Not ready";
        labTargetSelect.disabled = true;
    } else if (definition.requiresTarget) {
        if (!hasBackup) {
            labTargetHelp.textContent = "Select a backup folder in Step 01.";
            labTargetStatus.textContent = "Not ready";
        } else if (labTargetSelect.value) {
            labTargetHelp.textContent = `Selected target: ${labTargetSelect.value}`;
            labTargetStatus.textContent = "Selected";
            labTargetStatus.classList.add("ready");
        } else {
            labTargetHelp.textContent = "Choose the backup file to simulate.";
            labTargetStatus.textContent = "Required";
        }
        labTargetSelect.disabled = labRunning || !hasBackup;
    } else {
        labTargetSelect.value = "";
        labTargetSelect.disabled = true;
        if (placeholder) placeholder.textContent = "No target file required";
        labTargetTitle.textContent = "Target file";
        labTargetHelp.textContent = "No target file is required for Add Extra File.";
        labTargetControl.hidden = true;
        labTargetInfo.hidden = false;
        labTargetNote.textContent = "This simulation creates a temporary extra file in the backup.";
        labTargetStatus.textContent = "Not required";
        labTargetStatus.classList.add("ready");
    }
    labTargetPicker.sync();
    updateLabRunButton();
}

function setLabRunning(isRunning) {
    labRunning = isRunning;
    labRunButton.setAttribute("aria-busy", String(isRunning));
    labRunLabel.textContent = simulationUtilities.runButtonLabel(
        isRunning,
        !labResultPanel.hidden,
    );
    labRunSpinner.hidden = !isRunning;
    labSelectBackupButton.disabled = isRunning;
    if (isRunning) {
        labActionStatus.textContent = "Running";
        labActionStatus.className = "lab-step-status running";
    } else if (!labResultPanel.hidden) {
        labActionStatus.textContent = "Complete";
        labActionStatus.className = "lab-step-status complete";
    } else {
        labActionStatus.textContent = "Not run";
        labActionStatus.className = "lab-step-status";
    }
    updateLabMethodAvailability();
    updateLabTargetControl();
    updateLabResetButton();
}

function resetLab() {
    releaseBrowserFolder(labBackupSelection);
    labBackupSelection = null;
    updateLabBackupButtonLabel();
    labSimulationMethod = "";
    labBackupCard.classList.remove("selected");
    labBackupStatus.textContent = "Not selected";
    labBackupStatus.className = "lab-step-status";
    document.querySelector("#lab-backup-name").textContent = "No backup folder selected";
    document.querySelector("#lab-backup-detail").textContent = "Choose a backup folder to begin.";
    document.querySelectorAll('input[name="lab-simulation"]').forEach((input) => {
        input.checked = false;
    });
    populateLabTargetFiles();
    clearLabFeedback();
    resetLabResult();
    updateLabMethodAvailability();
    updateLabTargetControl();
    updateLabRunButton();
}

function updateLabBackupButtonLabel() {
    labSelectBackupLabel.textContent = labBackupSelection
        ? "Change Backup Folder"
        : "Select Backup Folder";
}

function formatByteCount(size) {
    return `${new Intl.NumberFormat().format(size)} ${size === 1 ? "byte" : "bytes"}`;
}

function renderLabResult(definition, targetPath, resultRow, response, sizes) {
    const passed = Boolean(resultRow && resultRow.status === definition.expected);
    const badge = document.querySelector("#lab-result-badge");
    badge.textContent = passed ? "Expected result detected" : "Expected result not detected";
    badge.className = `simulation-pass-badge ${passed ? "passed" : "failed"}`;
    document.querySelector("#lab-result-simulation").textContent = definition.label;
    document.querySelector("#lab-result-target-label").textContent = definition.requiresTarget
        ? "Target"
        : "Generated File";
    document.querySelector("#lab-result-target").textContent = targetPath;
    const expected = document.querySelector("#lab-result-expected");
    const actual = document.querySelector("#lab-result-actual");
    expected.textContent = STATUS_LABELS[definition.expected];
    expected.className = `lab-detection lab-detection-${definition.expected}`;
    actual.textContent = resultRow ? STATUS_LABELS[resultRow.status] : "Not found";
    actual.className = resultRow
        ? `lab-detection lab-detection-${resultRow.status}`
        : "";
    const successfulOutcomes = {
        corrupted: "CRC-32 successfully detected the simulated change.",
        missing: "Verification correctly detected the simulated missing file.",
        extra: "Verification correctly detected the simulated extra file.",
    };
    document.querySelector("#lab-result-outcome").textContent = passed
        ? successfulOutcomes[definition.expected]
        : "The expected classification was not observed.";
    document.querySelector("#lab-source-crc").textContent = resultRow?.source_crc32 ?? "—";
    document.querySelector("#lab-backup-crc").textContent = resultRow?.backup_crc32 ?? "—";

    const sizeCard = document.querySelector("#lab-size-card");
    const originalSize = sizes?.original ?? resultRow?.source_size_bytes;
    const simulatedSize = sizes?.simulated ?? resultRow?.backup_size_bytes;
    sizeCard.hidden = !Number.isInteger(originalSize) && !Number.isInteger(simulatedSize);
    document.querySelector("#lab-original-size").textContent = Number.isInteger(originalSize)
        ? formatByteCount(originalSize)
        : "—";
    document.querySelector("#lab-simulated-size").textContent = Number.isInteger(simulatedSize)
        ? formatByteCount(simulatedSize)
        : "—";

    STATUS_KEYS.forEach((status) => {
        document.querySelector(`#lab-summary-${status}`).textContent = String(response.summary[status]);
    });
    labResultPanel.hidden = false;
    labActionStatus.textContent = "Complete";
    labActionStatus.className = "lab-step-status complete";
    updateLabResetButton();
    labResultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function runLabSimulation() {
    if (labRunning) return;
    const definition = SIMULATION_DEFINITIONS[labSimulationMethod];
    if (!savedReference) {
        showLabFeedback("error", "No trusted reference available. Generate one from Verification first.");
        return;
    }
    if (!labBackupSelection) {
        showLabFeedback("error", "Select a backup folder before running a simulation.");
        return;
    }
    if (!definition) {
        showLabFeedback("error", "Choose a simulation method.");
        return;
    }
    if (definition.requiresTarget && !labTargetSelect.value) {
        showLabFeedback("error", "Choose a target file for this simulation.");
        return;
    }

    clearLabFeedback();
    resetLabResult();
    setLabRunning(true);

    try {
        const targetPath = labTargetSelect.value;
        const result = staticErrorLab.run(
            referenceDataset,
            labBackupSelection,
            labSimulationMethod,
            definition.requiresTarget ? targetPath : null,
        );
        if (!isValidVerificationResponse(result)) {
            throw new Error("The verification service returned an invalid response.");
        }
        const intendedPath = result.simulation?.target_path;
        if (typeof intendedPath !== "string" || !intendedPath) {
            throw new Error("The simulation service returned an invalid target.");
        }
        const resultRow = result.results.find((row) => row.relative_path === intendedPath);
        renderLabResult(definition, intendedPath, resultRow, result, result.simulation?.sizes);
    } catch (error) {
        showLabFeedback(
            "error",
            error instanceof Error ? error.message : "Unable to run the simulation.",
        );
    } finally {
        setLabRunning(false);
    }
}

function formatHistoryDate(value) {
    return historyUtilities.formatTimestamp(value);
}

function setHistoryFeedback(type, message) {
    historyFeedback.className = `history-feedback ${type}`;
    historyFeedback.textContent = message;
    historyFeedback.hidden = !message;
}

function isHistorySummaryRecord(record) {
    return Boolean(
        record
        && typeof record.id === "string"
        && typeof record.checked_at === "string"
        && typeof record.reference_source === "string"
        && typeof record.backup_name === "string"
        && ["clean", "issues"].includes(record.overall_status)
        && record.summary
        && STATUS_KEYS.every((status) => Number.isInteger(record.summary[status]))
        && Number.isInteger(record.summary.total_results)
        && !Object.hasOwn(record, "results"),
    );
}

function renderHistoryMetrics() {
    const metrics = historyUtilities.calculateMetrics(historyRecords);
    document.querySelector("#history-total-count").textContent = String(metrics.total);
    document.querySelector("#history-clean-count").textContent = String(metrics.clean);
    document.querySelector("#history-issues-count").textContent = String(metrics.issues);
}

function appendHistoryMeta(container, label, value) {
    const item = document.createElement("span");
    const term = document.createElement("strong");
    term.textContent = `${label}: `;
    item.append(term, document.createTextNode(value));
    container.append(item);
}

function renderHistoryList() {
    historyList.replaceChildren();
    const total = historyRecords.length;
    const visibleRecords = historyUtilities.filterAndSort(historyRecords, {
        query: historySearchInput.value,
        status: historyStatusFilter.value,
        sort: historySortOrder.value,
    });
    const filtering = Boolean(historySearchInput.value.trim()) || historyStatusFilter.value !== "all";
    historyEmpty.hidden = total !== 0;
    historyToolbar.hidden = total === 0;
    historyFilterEmpty.hidden = total === 0 || visibleRecords.length !== 0;
    historyList.hidden = total === 0 || visibleRecords.length === 0;
    historyClearButton.disabled = total === 0;
    historyResultCount.textContent = filtering
        ? `${visibleRecords.length} of ${total} checks`
        : `${total} ${total === 1 ? "check" : "checks"}`;
    renderHistoryMetrics();

    visibleRecords.forEach((record) => {
        const item = document.createElement("article");
        const identity = document.createElement("div");
        const header = document.createElement("div");
        const badge = document.createElement("span");
        const title = document.createElement("h4");
        const date = document.createElement("time");
        const metadata = document.createElement("div");
        const counts = document.createElement("div");
        const button = document.createElement("button");

        item.className = "history-item";
        identity.className = "history-item-identity";
        header.className = "history-item-title-row";
        badge.className = `history-status history-status-${record.overall_status}`;
        badge.textContent = record.overall_status === "clean" ? "Clean" : "Issues detected";
        title.textContent = record.backup_name;
        date.dateTime = record.checked_at;
        date.textContent = formatHistoryDate(record.checked_at);
        metadata.className = "history-item-meta";
        appendHistoryMeta(metadata, "Reference", record.reference_source);
        appendHistoryMeta(metadata, "Files", String(record.summary.total_results));
        counts.className = "history-item-counts";
        STATUS_KEYS.forEach((status) => {
            const count = document.createElement("span");
            count.className = `history-count history-count-${status}`;
            count.textContent = `${record.summary[status]} ${STATUS_LABELS[status]}`;
            counts.append(count);
        });
        button.className = "button button-secondary button-small";
        button.type = "button";
        button.textContent = "View Details";
        button.addEventListener("click", () => loadHistoryDetail(record.id, button));

        header.append(title, badge);
        identity.append(header, date, metadata);
        item.append(identity, counts, button);
        historyList.append(item);
    });
}

async function loadHistory() {
    setHistoryFeedback("", "");
    try {
        const records = staticHistoryStore.read().map((record) => {
            const summary = {...record};
            delete summary.results;
            return summary;
        });
        if (!records.every(isHistorySummaryRecord)) {
            throw new Error("The history service returned an invalid response.");
        }
        historyRecords = records;
        renderHistoryList();
        if (
            selectedHistoryRecord
            && !historyRecords.some((record) => record.id === selectedHistoryRecord.id)
        ) {
            closeHistoryDetail();
        }
    } catch (error) {
        historyRecords = [];
        renderHistoryList();
        setHistoryFeedback(
            "error",
            error instanceof Error ? error.message : "Unable to load verification history.",
        );
    }
}

function renderHistoryResultRows() {
    historyResultsBody.replaceChildren();
    if (!selectedHistoryRecord) {
        historyResultsCount.textContent = "";
        return;
    }
    const filter = historyResultsFilter.value;
    const total = selectedHistoryRecord.results.length;
    const rows = historyUtilities.filterDetailResults(selectedHistoryRecord.results, filter);
    historyResultsCount.textContent = historyUtilities.formatDetailResultCount(
        rows.length,
        total,
        filter,
    );

    if (!rows.length) {
        const tableRow = document.createElement("tr");
        const cell = document.createElement("td");
        cell.className = "history-detail-empty";
        cell.colSpan = 5;
        const strong = document.createElement("strong");
        const detail = document.createElement("span");
        strong.textContent = filter === "all" ? "No file results" : "No matching files";
        detail.textContent = filter === "all"
            ? "This check contains no file results."
            : "No files in this check have this status.";
        cell.append(strong, detail);
        tableRow.append(cell);
        historyResultsBody.append(tableRow);
        return;
    }

    rows.forEach((result) => {
        const row = document.createElement("tr");
        const statusCell = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = `result-badge result-${result.status}`;
        badge.textContent = STATUS_LABELS[result.status];
        statusCell.append(badge);

        const values = [
            [result.file, "result-file"],
            [result.relative_path, "result-path"],
            [result.source_crc32 ?? "—", "result-crc"],
            [result.backup_crc32 ?? "—", "result-crc"],
        ];
        const cells = values.map(([value, className]) => {
            const cell = document.createElement("td");
            cell.className = className;
            cell.textContent = value;
            cell.title = value;
            return cell;
        });
        row.append(statusCell, ...cells);
        historyResultsBody.append(row);
    });
}

function closeHistoryDetail() {
    const returnFocus = historyDetailReturnFocus;
    const returnScrollY = historyDetailReturnScrollY;
    selectedHistoryRecord = null;
    historyExportCsvButton.disabled = true;
    delete historyExportCsvButton.dataset.historyRecordId;
    historyDetailPanel.hidden = true;
    historyResultsBody.replaceChildren();
    historyResultsCount.textContent = "";
    historyResultsPicker.close();
    if (returnFocus instanceof HTMLElement && returnFocus.isConnected) {
        returnFocus.focus({preventScroll: true});
    }
    if (Number.isFinite(returnScrollY)) window.scrollTo({top: returnScrollY, behavior: "instant"});
    historyDetailReturnFocus = null;
    historyDetailReturnScrollY = null;
}

async function loadHistoryDetail(recordId, trigger) {
    const returnScrollY = window.scrollY;
    trigger.disabled = true;
    historyExportCsvButton.disabled = true;
    delete historyExportCsvButton.dataset.historyRecordId;
    setHistoryFeedback("", "");
    try {
        const record = staticHistoryStore.get(recordId);
        if (!record) throw new Error("Unable to load verification details.");
        const summaryRecord = { ...record };
        delete summaryRecord.results;
        if (!isHistorySummaryRecord(summaryRecord) || !isValidVerificationResponse({
            status: "ok",
            summary: record.summary,
            results: record.results,
        })) {
            throw new Error("The history service returned invalid verification details.");
        }

        selectedHistoryRecord = record;
        historyDetailReturnFocus = trigger;
        historyDetailReturnScrollY = returnScrollY;
        historyExportCsvButton.disabled = false;
        historyExportCsvButton.dataset.historyRecordId = record.id;
        historyResultsFilter.value = "all";
        historyResultsPicker.sync();
        document.querySelector("#history-detail-checked").textContent = formatHistoryDate(record.checked_at);
        document.querySelector("#history-detail-reference").textContent = record.reference_source;
        document.querySelector("#history-detail-backup").textContent = record.backup_name;
        const overall = document.querySelector("#history-detail-overall");
        overall.textContent = record.overall_status === "clean" ? "Clean" : "Issues detected";
        overall.className = `history-status history-status-${record.overall_status}`;
        document.querySelector("#history-detail-reference-date").textContent = formatHistoryDate(record.reference_created_at);
        STATUS_KEYS.forEach((status) => {
            document.querySelector(`#history-detail-${status}`).textContent = String(record.summary[status]);
        });
        renderHistoryResultRows();
        historyDetailPanel.hidden = false;
        historyDetailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        setHistoryFeedback(
            "error",
            error instanceof Error ? error.message : "Unable to load verification details.",
        );
    } finally {
        trigger.disabled = false;
    }
}

function openHistoryClearDialog() {
    if (!historyRecords.length) return;
    historyDialogReturnFocus = document.activeElement;
    historyClearDialog.hidden = false;
    document.querySelector("#history-clear-cancel").focus();
}

function closeHistoryClearDialog() {
    historyClearDialog.hidden = true;
    if (historyDialogReturnFocus instanceof HTMLElement) historyDialogReturnFocus.focus({preventScroll: true});
    historyDialogReturnFocus = null;
}

async function resetHistoryScrollAfterClear() {
    await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    const scrollOwner = document.scrollingElement || document.documentElement;
    scrollOwner.scrollTop = 0;
    return scrollOwner.scrollTop === 0;
}

async function confirmHistoryClear() {
    const confirmButton = document.querySelector("#history-clear-confirm");
    confirmButton.disabled = true;
    try {
        const deleted = staticHistoryStore.clear();
        closeHistoryDetail();
        closeHistoryClearDialog();
        await loadHistory();
        setHistoryFeedback("success", `${deleted} ${deleted === 1 ? "record" : "records"} cleared. Trusted reference preserved.`);
        await resetHistoryScrollAfterClear();
    } catch (error) {
        closeHistoryClearDialog();
        setHistoryFeedback("error", error instanceof Error ? error.message : "Unable to clear verification history.");
    } finally {
        confirmButton.disabled = false;
    }
}

function showView(requestedView, updateHash = true) {
    const validView = ["verification", "error-lab", "history", "about"].includes(requestedView)
        ? requestedView
        : "verification";

    document.querySelectorAll("[data-view]").forEach((view) => {
        view.hidden = view.dataset.view !== validView;
    });
    document.querySelectorAll("[data-view-link]").forEach((link) => {
        const active = link.dataset.viewLink === validView;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
    });

    const titles = {
        verification: "Verification",
        "error-lab": "Error Lab",
        history: "History",
        about: "About",
    };
    document.querySelector("#topbar-page-title").textContent = titles[validView];

    if (validView === "history") loadHistory();

    if (updateHash) window.history.replaceState(null, "", `#${validView}`);
    window.scrollTo({ top: 0, behavior: "instant" });
}

async function selectLabBackup() {
    labSelectBackupButton.disabled = true;
    labSelectBackupButton.setAttribute("aria-busy", "true");
    try {
        const selection = await requestBrowserFolder("lab-backup");
        if (!selection || selection.cancelled) {
            if (selection?.message) showLabFeedback("error", selection.message);
            return;
        }
        const previousSelection = labBackupSelection;
        labBackupSelection = selection;
        releaseBrowserFolder(previousSelection);
        updateLabBackupButtonLabel();
        clearLabFeedback();
        resetLabResult();
        labBackupCard.classList.add("selected");
        labBackupStatus.textContent = "Selected";
        labBackupStatus.className = "lab-step-status ready";
        document.querySelector("#lab-backup-name").textContent = selection.name;
        document.querySelector("#lab-backup-detail").textContent = `${selection.file_count} ${selection.file_count === 1 ? "file" : "files"}`;
        populateLabTargetFiles();
        updateLabMethodAvailability();
        updateLabTargetControl();
    } catch (error) {
        showLabFeedback(
            "error",
            error instanceof Error ? error.message : "Unable to open the folder picker.",
        );
    } finally {
        labSelectBackupButton.removeAttribute("aria-busy");
        labSelectBackupButton.disabled = labRunning;
    }
}

labSelectBackupButton.addEventListener("click", () => selectLabBackup());

document.querySelectorAll('input[name="lab-simulation"]').forEach((input) => {
    input.addEventListener("change", () => {
        labSimulationMethod = input.value;
        labTargetSelect.value = "";
        clearLabFeedback();
        resetLabResult();
        updateLabTargetControl();
    });
});

labTargetSelect.addEventListener("change", () => {
    clearLabFeedback();
    resetLabResult();
    updateLabTargetControl();
});
labRunButton.addEventListener("click", runLabSimulation);
labResetButton.addEventListener("click", resetLab);
exportCsvButton.addEventListener("click", async () => {
    await downloadHistoryCsv(
        currentVerificationHistoryId,
        exportCsvButton,
        document.querySelector("#export-csv-spinner"),
        document.querySelector("#export-csv-label"),
        (message) => showFeedback("error", message),
    );
    exportCsvButton.disabled = !currentVerificationHistoryId;
});
historyResultsFilter.addEventListener("change", renderHistoryResultRows);
historySearchInput.addEventListener("input", renderHistoryList);
historyStatusFilter.addEventListener("change", renderHistoryList);
historySortOrder.addEventListener("change", renderHistoryList);
historyExportCsvButton.addEventListener("click", async () => {
    await downloadHistoryCsv(
        selectedHistoryRecord?.id,
        historyExportCsvButton,
        document.querySelector("#history-export-csv-spinner"),
        document.querySelector("#history-export-csv-label"),
        (message) => setHistoryFeedback("error", message),
    );
    historyExportCsvButton.disabled = !selectedHistoryRecord;
});
document.querySelector("#history-detail-close").addEventListener("click", closeHistoryDetail);
historyClearButton.addEventListener("click", openHistoryClearDialog);
document.querySelector("#history-clear-cancel").addEventListener("click", closeHistoryClearDialog);
document.querySelector("#history-clear-confirm").addEventListener("click", confirmHistoryClear);
historyClearDialog.addEventListener("click", (event) => {
    if (event.target === historyClearDialog) closeHistoryClearDialog();
});
document.addEventListener("keydown", (event) => {
    if (historyClearDialog.hidden) return;
    if (event.key === "Escape") {
        closeHistoryClearDialog();
        return;
    }
    if (event.key === "Tab") {
        const dialogButtons = Array.from(historyClearDialog.querySelectorAll("button:not(:disabled)"));
        const firstButton = dialogButtons[0];
        const lastButton = dialogButtons.at(-1);
        if (event.shiftKey && document.activeElement === firstButton) {
            event.preventDefault();
            lastButton.focus();
        } else if (!event.shiftKey && document.activeElement === lastButton) {
            event.preventDefault();
            firstButton.focus();
        }
    }
});

document.querySelectorAll("[data-view-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
        event.preventDefault();
        showView(link.dataset.viewLink);
    });
});
document.querySelectorAll("[data-go-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.goView));
});
window.addEventListener("hashchange", () => {
    const requested = window.location.hash.slice(1) || "verification";
    showView(requested, false);
});

const initialView = ["verification", "error-lab", "history", "about"].includes(window.location.hash.slice(1))
    ? window.location.hash.slice(1)
    : "verification";
showView(initialView, false);
resetLab();
loadCurrentReference();
