(function registerBrowserFolderSelection(root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.BrowserFolderSelection = api;
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
    function selectionId() {
        return globalThis.crypto?.randomUUID?.()
            || `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function normalizeRelativePath(value) {
        return String(value || "").replaceAll("\\", "/").replace(/^\/+/, "");
    }

    async function readFile(file, relativePath) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        return {relative_path: normalizeRelativePath(relativePath), bytes};
    }

    async function enumerateHandle(directoryHandle) {
        const files = [];
        async function visit(directory, prefix = "") {
            for await (const [name, entry] of directory.entries()) {
                const relativePath = prefix ? `${prefix}/${name}` : name;
                if (entry.kind === "directory") await visit(entry, relativePath);
                else if (entry.kind === "file") files.push(await readFile(await entry.getFile(), relativePath));
            }
        }
        await visit(directoryHandle);
        files.sort((left, right) => left.relative_path.localeCompare(right.relative_path, undefined, {sensitivity: "base"}));
        return makeSelection(directoryHandle.name, files, "file-system-access");
    }

    function rootNameFromFiles(files) {
        for (const file of files) {
            const path = normalizeRelativePath(file.webkitRelativePath || file.name);
            if (path.includes("/")) return path.split("/")[0];
        }
        return "Selected folder";
    }

    async function enumerateFileInput(fileList) {
        const browserFiles = Array.from(fileList || []);
        const rootName = rootNameFromFiles(browserFiles);
        const files = await Promise.all(browserFiles.map((file) => {
            const path = normalizeRelativePath(file.webkitRelativePath || file.name);
            const prefix = `${rootName}/`;
            const relativePath = path.startsWith(prefix) ? path.slice(prefix.length) : path;
            return readFile(file, relativePath);
        }));
        files.sort((left, right) => left.relative_path.localeCompare(right.relative_path, undefined, {sensitivity: "base"}));
        return makeSelection(rootName, files, "directory-input");
    }

    function makeSelection(name, files, method) {
        if (!String(name || "").trim()) throw new Error("The selected folder name is unavailable.");
        if (!Array.isArray(files) || files.length === 0) throw new Error("The selected folder does not contain any files.");
        if (files.some((file) => !file.relative_path || !(file.bytes instanceof Uint8Array))) {
            throw new Error("The selected folder could not be read.");
        }
        return {
            selection_id: selectionId(),
            name: String(name),
            method,
            files,
            file_count: files.length,
            relative_paths: files.map((file) => file.relative_path),
        };
    }

    function chooseWithInput(input) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const finish = (value, error) => {
                if (settled) return;
                settled = true;
                input.removeEventListener("change", onChange);
                input.removeEventListener("cancel", onCancel);
                if (error) reject(error); else resolve(value);
            };
            const onChange = () => {
                if (!input.files?.length) finish(null);
                else enumerateFileInput(input.files).then((value) => finish(value), (error) => finish(null, error));
            };
            const onCancel = () => finish(null);
            input.value = "";
            input.addEventListener("change", onChange, {once: true});
            input.addEventListener("cancel", onCancel, {once: true});
            input.click();
        });
    }

    async function chooseDirectory(input, picker = globalThis.showDirectoryPicker) {
        try {
            if (typeof picker === "function") {
                const handle = await picker({mode: "read"});
                return await enumerateHandle(handle);
            }
            return await chooseWithInput(input);
        } catch (error) {
            if (["AbortError", "NotAllowedError", "SecurityError"].includes(error?.name)) {
                return {
                    cancelled: true,
                    denied: error.name !== "AbortError",
                    message: error.name === "AbortError"
                        ? ""
                        : "Folder access was not granted. Your current selection was not changed.",
                };
            }
            throw error;
        }
    }

    return {chooseDirectory, enumerateHandle, enumerateFileInput, normalizeRelativePath};
}));
