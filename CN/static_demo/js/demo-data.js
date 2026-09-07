(function registerDemoData(root, factory) {
    const api = factory(root?.StaticCrc32);
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.StaticDemoData = api;
}(typeof globalThis !== "undefined" ? globalThis : this, (crcApi) => {
    const DATASETS = Object.freeze({
        original_files: ["attendance.csv", "config.json", "image.png", "nested/lab_record.bin", "notes.txt"],
        backup_clean: ["attendance.csv", "config.json", "image.png", "nested/lab_record.bin", "notes.txt"],
        backup_corrupted: ["attendance.csv", "config.json", "image.png", "nested/lab_record.bin", "notes.txt"],
        backup_missing: ["attendance.csv", "config.json", "nested/lab_record.bin", "notes.txt"],
        backup_extra: ["attendance.csv", "config.json", "extra_file.txt", "image.png", "nested/lab_record.bin", "notes.txt"],
        backup_mixed: ["attendance.csv", "config.json", "extra_file.txt", "nested/lab_record.bin", "notes.txt"],
    });
    const cache = new Map();

    function cloneDataset(dataset) {
        return {
            selection_id: dataset.name,
            name: dataset.name,
            file_count: dataset.files.length,
            relative_paths: dataset.files.map((file) => file.relative_path),
            files: dataset.files.map((file) => ({...file, bytes: new Uint8Array(file.bytes)})),
        };
    }

    async function loadDataset(datasetId) {
        const paths = DATASETS[datasetId];
        if (!paths) throw new Error("Unknown demonstration dataset.");
        if (!cache.has(datasetId)) {
            cache.set(datasetId, Promise.all(paths.map(async (relativePath) => {
                const segments = relativePath.split("/").map(encodeURIComponent).join("/");
                const response = await fetch(`demo_data/${encodeURIComponent(datasetId)}/${segments}`);
                if (!response.ok) throw new Error(`Unable to load demo file: ${relativePath}`);
                const bytes = new Uint8Array(await response.arrayBuffer());
                return {
                    file: relativePath.split("/").at(-1),
                    relative_path: relativePath,
                    bytes,
                    size_bytes: bytes.length,
                    crc32: crcApi.crc32(bytes),
                };
            })).then((files) => ({name: datasetId, files})));
        }
        return cloneDataset(await cache.get(datasetId));
    }

    return {DATASETS, loadDataset};
}));
