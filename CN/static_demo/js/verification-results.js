(() => {
    "use strict";

    function filterResults(results, selectedStatus) {
        return selectedStatus === "all"
            ? results
            : results.filter((result) => result.status === selectedStatus);
    }

    globalThis.VerificationResultsUI = { filterResults };
})();
