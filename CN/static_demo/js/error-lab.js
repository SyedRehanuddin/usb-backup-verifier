(function registerStaticErrorLab(root, factory) {
    const api = factory(root?.ErrorLabSimulation, root?.StaticVerification);
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.StaticErrorLab = api;
}(typeof globalThis !== "undefined" ? globalThis : this, (simulation, verification) => {
    const EXTRA_BYTES = new TextEncoder().encode("USB Backup Verification Utility\nControlled Error Simulation\n");

    function run(source, baseline, method, targetPath) {
        const files = baseline.files.map((file) => ({relative_path: file.relative_path, bytes: new Uint8Array(file.bytes)}));
        let intendedPath = targetPath || "";
        let sizes = null;
        if (["modify-byte", "append-data", "truncate-file"].includes(method)) {
            const target = files.find((file) => file.relative_path === targetPath);
            if (!target) throw new Error("The selected target file is unavailable.");
            const original = new Uint8Array(target.bytes);
            target.bytes = simulation.simulateBytes(method, original);
            sizes = {original: original.length, simulated: target.bytes.length};
        } else if (method === "remove-file") {
            const index = files.findIndex((file) => file.relative_path === targetPath);
            if (index < 0) throw new Error("The selected target file is unavailable.");
            files.splice(index, 1);
        } else if (method === "add-extra") {
            intendedPath = simulation.chooseExtraPath([...files.map((file) => file.relative_path), ...source.relative_paths]);
            files.push({relative_path: intendedPath, bytes: new Uint8Array(EXTRA_BYTES)});
            sizes = {simulated: EXTRA_BYTES.length};
        } else {
            throw new Error("Choose a simulation method.");
        }
        const simulated = verification.datasetFromFiles(baseline.name, files);
        return {...verification.compare(source, simulated), simulation: {target_path: intendedPath, sizes}};
    }

    return {run};
}));
