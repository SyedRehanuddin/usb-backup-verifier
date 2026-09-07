(function registerSimulationUtilities(root, factory) {
    const utilities = factory();
    if (typeof module === "object" && module.exports) module.exports = utilities;
    if (root) root.ErrorLabSimulation = utilities;
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
    const APPEND_BYTES = new TextEncoder().encode("CRC_SIMULATION");

    function copyBytes(input) {
        if (!(input instanceof Uint8Array)) {
            throw new TypeError("Simulation input must be a Uint8Array.");
        }
        return new Uint8Array(input);
    }

    function bytesEqual(left, right) {
        if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array)) return false;
        return left.length === right.length && left.every((value, index) => value === right[index]);
    }

    function modifyByte(input) {
        const output = copyBytes(input);
        if (output.length === 0) {
            throw new Error("Modify Byte requires a non-empty file.");
        }
        const index = Math.min(5, output.length - 1);
        output[index] ^= 0x01;
        return output;
    }

    function appendData(input) {
        const source = copyBytes(input);
        const output = new Uint8Array(source.length + APPEND_BYTES.length);
        output.set(source);
        output.set(APPEND_BYTES, source.length);
        return output;
    }

    function truncateFile(input) {
        const source = copyBytes(input);
        if (source.length === 0) {
            throw new Error("Truncate File requires a non-empty file.");
        }
        const removeCount = Math.max(1, Math.min(16, Math.floor(source.length / 4)));
        return source.slice(0, source.length - removeCount);
    }

    function stripRoot(relativePath, rootName) {
        const normalized = String(relativePath).replaceAll("\\", "/");
        const parts = normalized.split("/");
        if (parts[0]?.toLocaleLowerCase() === String(rootName).toLocaleLowerCase()) {
            parts.shift();
        }
        return parts.join("/");
    }

    function chooseExtraPath(existingPaths) {
        const occupied = new Set(
            Array.from(existingPaths, (path) => String(path).replaceAll("\\", "/").toLocaleLowerCase()),
        );
        let candidate = "simulation/extra_file.txt";
        let suffix = 2;
        while (occupied.has(candidate.toLocaleLowerCase())) {
            candidate = `simulation/extra_file_${suffix}.txt`;
            suffix += 1;
        }
        return candidate;
    }

    function simulateBytes(method, input) {
        if (method === "modify-byte") return modifyByte(input);
        if (method === "append-data") return appendData(input);
        if (method === "truncate-file") return truncateFile(input);
        throw new Error("The selected simulation does not mutate file bytes.");
    }

    function runButtonLabel(isRunning, hasCompletedResult) {
        if (isRunning) return "Running Simulation...";
        return hasCompletedResult ? "Run Again" : "Run Simulation";
    }

    return {
        APPEND_BYTES,
        appendData,
        bytesEqual,
        chooseExtraPath,
        copyBytes,
        modifyByte,
        runButtonLabel,
        simulateBytes,
        stripRoot,
        truncateFile,
    };
}));
