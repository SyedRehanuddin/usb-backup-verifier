(function registerStaticHistoryStore(root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.StaticHistoryStore = api;
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
    const STORAGE_KEY = "usb-backup-verifier.static-history.v1";
    const STATUS_LABELS = {verified: "Verified", corrupted: "Corrupted", missing: "Missing", extra: "Extra"};

    function read() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function write(records) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 100)));
    }

    function add(record) {
        const records = read();
        write([record, ...records.filter((item) => item.id !== record.id)]);
        return record;
    }

    function get(recordId) {
        return read().find((record) => record.id === recordId) || null;
    }

    function clear() {
        const count = read().length;
        localStorage.removeItem(STORAGE_KEY);
        return count;
    }

    function safeCell(value) {
        const text = value == null ? "" : String(value);
        return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    }

    function csvCell(value) {
        const text = safeCell(value).replaceAll('"', '""');
        return `"${text}"`;
    }

    function formatCheckedAt(value) {
        const parts = new Intl.DateTimeFormat("en-GB", {day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true}).formatToParts(new Date(value));
        const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
        return `${values.day} ${values.month} ${values.year} at ${values.hour}:${values.minute} ${values.dayPeriod.toUpperCase()}`;
    }

    function buildCsv(record) {
        const rows = [
            ["USB Backup Verification Utility"], [],
            ["Verification ID", record.id],
            ["Checked At", formatCheckedAt(record.checked_at)],
            ["Reference Source", record.reference_source],
            ["Backup Name", record.backup_name],
            ["Overall Status", record.overall_status === "clean" ? "Clean - No differences detected" : "Issues detected"],
            ["Algorithm", "CRC-32"], [],
            ["Verified", record.summary.verified], ["Corrupted", record.summary.corrupted],
            ["Missing", record.summary.missing], ["Extra", record.summary.extra],
            ["Total Results", record.summary.total_results], [],
            ["Status", "File Name", "Relative Path", "Source CRC-32", "Backup CRC-32", "Source Size (Bytes)", "Backup Size (Bytes)"],
            ...record.results.map((row) => [STATUS_LABELS[row.status], row.file, row.relative_path, row.source_crc32, row.backup_crc32, row.source_size_bytes, row.backup_size_bytes]),
        ];
        return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
    }

    function download(record) {
        const blob = new Blob([buildCsv(record)], {type: "text/csv;charset=utf-8"});
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `usb_backup_verification_${record.backup_name}_${record.checked_at.slice(0, 19).replaceAll(/[-:T]/g, "")}.csv`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    return {STORAGE_KEY, add, buildCsv, clear, download, get, read};
}));
