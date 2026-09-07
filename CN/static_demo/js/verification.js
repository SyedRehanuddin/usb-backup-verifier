(function registerStaticVerification(root, factory) {
    const api = factory(root?.StaticCrc32);
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.StaticVerification = api;
}(typeof globalThis !== "undefined" ? globalThis : this, (crcApi) => {
    const STATUS_KEYS = ["verified", "corrupted", "missing", "extra"];

    function compare(source, backup) {
        const sourceMap = new Map(source.files.map((file) => [file.relative_path, file]));
        const backupMap = new Map(backup.files.map((file) => [file.relative_path, file]));
        const paths = Array.from(new Set([...sourceMap.keys(), ...backupMap.keys()]))
            .sort((left, right) => left.localeCompare(right, undefined, {sensitivity: "base"}));
        const summary = {verified: 0, corrupted: 0, missing: 0, extra: 0, total_results: paths.length};
        const results = paths.map((relativePath) => {
            const reference = sourceMap.get(relativePath);
            const candidate = backupMap.get(relativePath);
            let status;
            if (!candidate) status = "missing";
            else if (!reference) status = "extra";
            else status = reference.crc32 === candidate.crc32 ? "verified" : "corrupted";
            summary[status] += 1;
            return {
                status,
                file: relativePath.split("/").at(-1),
                relative_path: relativePath,
                source_crc32: reference?.crc32 ?? null,
                backup_crc32: candidate?.crc32 ?? null,
                source_size_bytes: reference?.size_bytes ?? null,
                backup_size_bytes: candidate?.size_bytes ?? null,
            };
        });
        return {status: "ok", backup_name: backup.name, summary, results};
    }

    function datasetFromFiles(name, files) {
        return {
            name,
            files: files.map((file) => {
                const bytes = new Uint8Array(file.bytes);
                return {
                    file: file.relative_path.split("/").at(-1),
                    relative_path: file.relative_path,
                    bytes,
                    size_bytes: bytes.length,
                    crc32: crcApi.crc32(bytes),
                };
            }),
        };
    }

    function makeHistoryRecord(result, reference) {
        const checkedAt = new Date().toISOString();
        const id = globalThis.crypto?.randomUUID?.() || `verification-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return {
            id,
            checked_at: checkedAt,
            reference_created_at: reference.created_at,
            reference_source: reference.source_name,
            backup_name: result.backup_name,
            overall_status: ["corrupted", "missing", "extra"].some((key) => result.summary[key] > 0) ? "issues" : "clean",
            summary: {...result.summary},
            results: result.results.map((row) => ({...row})),
        };
    }

    return {STATUS_KEYS, compare, datasetFromFiles, makeHistoryRecord};
}));
