(function registerHistoryUtilities(root, factory) {
    const utilities = factory();
    if (typeof module === "object" && module.exports) module.exports = utilities;
    if (root) root.HistoryUI = utilities;
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
    function isClean(record) {
        return ["corrupted", "missing", "extra"]
            .every((status) => record.summary[status] === 0);
    }

    function calculateMetrics(records) {
        const clean = records.filter(isClean).length;
        return { total: records.length, clean, issues: records.length - clean };
    }

    function filterAndSort(records, { query = "", status = "all", sort = "newest" } = {}) {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        const filtered = records.filter((record) => {
            const matchesQuery = !normalizedQuery
                || record.backup_name.toLocaleLowerCase().includes(normalizedQuery)
                || record.reference_source.toLocaleLowerCase().includes(normalizedQuery);
            const clean = isClean(record);
            const matchesStatus = status === "all"
                || (status === "clean" && clean)
                || (status === "issues" && !clean);
            return matchesQuery && matchesStatus;
        });
        const direction = sort === "oldest" ? 1 : -1;
        return filtered
            .map((record, index) => ({record, index}))
            .sort((left, right) => {
                const dateDifference = Date.parse(left.record.checked_at) - Date.parse(right.record.checked_at);
                return dateDifference ? dateDifference * direction : left.index - right.index;
            })
            .map(({record}) => record);
    }

    function formatTimestamp(value, timeZone) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Unknown date";
        const formatter = new Intl.DateTimeFormat("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            ...(timeZone ? {timeZone} : {}),
        });
        const parts = Object.fromEntries(
            formatter.formatToParts(date)
                .filter((part) => part.type !== "literal")
                .map((part) => [part.type, part.value]),
        );
        return `${parts.day} ${parts.month} ${parts.year} · ${parts.hour}:${parts.minute} ${parts.dayPeriod.toUpperCase()}`;
    }

    function filterDetailResults(results, status = "all") {
        return status === "all"
            ? Array.from(results)
            : results.filter((result) => result.status === status);
    }

    function formatDetailResultCount(visibleCount, totalCount, status = "all") {
        const noun = totalCount === 1 ? "file" : "files";
        return status === "all"
            ? `${totalCount} ${noun}`
            : `${visibleCount} of ${totalCount} ${noun}`;
    }

    return {
        calculateMetrics,
        filterAndSort,
        filterDetailResults,
        formatDetailResultCount,
        formatTimestamp,
        isClean,
    };
}));
