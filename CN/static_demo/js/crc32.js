(function registerCrc32(root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.StaticCrc32 = api;
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
        }
        table[index] = value >>> 0;
    }

    function crc32(bytes) {
        if (!(bytes instanceof Uint8Array)) throw new TypeError("CRC-32 input must be bytes.");
        let checksum = 0xFFFFFFFF;
        for (const byte of bytes) checksum = table[(checksum ^ byte) & 0xFF] ^ (checksum >>> 8);
        return ((checksum ^ 0xFFFFFFFF) >>> 0).toString(16).toUpperCase().padStart(8, "0");
    }

    return {crc32};
}));
