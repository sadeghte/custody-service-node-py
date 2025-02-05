

const POLYNOMIAL = -306674912;

let crc32_table: Int32Array; // CRC32 table cache

function crc32(str: string, crc = 0xFFFFFFFF) {
    let bytes = Buffer.from(str, 'utf8'); // Convert string to byte array
    if (crc32_table === undefined) {
        calcTable(); // Generate the CRC32 table if not cached
    }
    for (let i = 0; i < bytes.length; ++i) {
        crc = crc32_table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ -1) >>> 0; // Invert the CRC value and ensure it's unsigned
}

function calcTable() {
    crc32_table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
        let r = i;
        for (let bit = 8; bit > 0; --bit) {
            r = ((r & 1) ? ((r >>> 1) ^ POLYNOMIAL) : (r >>> 1));
        }
        crc32_table[i] = r;
    }
}

export function opcodeTohex(num: number): string {
	let buff = Buffer.alloc(4);
	buff.writeUInt32BE(num);
	return buff.toString('hex');
}

export function str2opcode(str: string): number {
	return crc32(str)
}