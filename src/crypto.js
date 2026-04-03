const twofish = require('twofish').twofish();
const zlib = require('zlib');

const xor = (a, b) => {
    const len = a.length;
    const res = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) res[i] = a[i] ^ b[i];
    return res;
};

const cmac = (key, type, data) => {
    const tfKey = Array.from(key);
    const L = Buffer.from(twofish.encrypt(tfKey, Array.from(Buffer.alloc(16, 0))));
    
    const dbl = (v) => {
        let res = Buffer.allocUnsafe(16);
        let carry = 0;
        for (let i = 15; i >= 0; i--) {
            let b = (v[i] << 1) | carry;
            res[i] = b & 0xff;
            carry = (v[i] >> 7) & 1;
        }
        if (v[0] >> 7) res[15] ^= 0x87;
        return res;
    };

    const K1 = dbl(L);
    const K2 = dbl(K1);
    const header = Buffer.alloc(16, 0);
    header[15] = type;
    const nBlocks = Math.ceil((16 + data.length) / 16);
    let state = Buffer.alloc(16, 0);

    for (let i = 0; i < nBlocks; i++) {
        let block;
        if (i === 0) block = header;
        else {
            const start = (i - 1) * 16;
            const end = start + 16;
            block = (end > data.length) ? data.subarray(start) : data.subarray(start, end);
        }
        if (block.length === 16) {
            if (i === nBlocks - 1) block = xor(block, K1);
            state = Buffer.from(twofish.encrypt(tfKey, Array.from(xor(state, block))));
        } else {
            const padded = Buffer.alloc(16, 0);
            block.copy(padded);
            padded[block.length] = 0x80;
            state = Buffer.from(twofish.encrypt(tfKey, Array.from(xor(state, xor(padded, K2)))));
        }
    }
    return state;
};

const decryptPKA = (buffer) => {
    const totalBytes = buffer.length;
    const key = Buffer.alloc(16, 137);
    const iv = Buffer.alloc(16, 16);

    const s1 = Buffer.allocUnsafe(totalBytes);
    for (let i = 0; i < totalBytes; i++) {
        s1[i] = (buffer[totalBytes - 1 - i] ^ ((totalBytes - (i * totalBytes)) | 0)) & 0xFF;
    }

    const tag = s1.subarray(totalBytes - 16);
    const ciphertext = s1.subarray(0, totalBytes - 16);
    
    const nTag = cmac(key, 0, iv);
    const hTag = cmac(key, 1, Buffer.alloc(0));
    const cTag = cmac(key, 2, ciphertext);
    if (!xor(xor(nTag, hTag), cTag).equals(tag)) throw new Error("Decryption failed: Invalid PKA file.");

    let decrypted = Buffer.allocUnsafe(ciphertext.length);
    let counter = Buffer.from(nTag);
    
    for (let i = 0; i < ciphertext.length; i += 16) {
        const k = Buffer.from(twofish.encrypt(Array.from(key), Array.from(counter)));
        const lim = Math.min(16, ciphertext.length - i);
        for (let j = 0; j < lim; j++) decrypted[i + j] = ciphertext[i + j] ^ k[j];
        for (let j = 15; j >= 0; j--) { counter[j] = (counter[j] + 1) & 0xFF; if (counter[j] !== 0) break; }
    }

    const s3 = Buffer.allocUnsafe(decrypted.length);
    const dLen = decrypted.length;
    for (let i = 0; i < dLen; i++) s3[i] = (decrypted[i] ^ (dLen - i)) & 0xFF;

    return s3.subarray(4); 
};

const encryptPKA = (xmlString) => {
    const xmlBuffer = Buffer.from(xmlString, 'utf8');
    const compressed = zlib.deflateSync(xmlBuffer);
    
    const s3 = Buffer.alloc(compressed.length + 4);
    s3.writeUInt32BE(xmlBuffer.length, 0); 
    compressed.copy(s3, 4);

    const dLen = s3.length;
    const decrypted = Buffer.alloc(dLen);
    for (let i = 0; i < dLen; i++) {
        decrypted[i] = (s3[i] ^ (dLen - i)) & 0xFF;
    }

    const key = Buffer.alloc(16, 137);
    const iv = Buffer.alloc(16, 16);
    const nTag = cmac(key, 0, iv);
    
    let ciphertext = Buffer.alloc(dLen);
    let counter = Buffer.from(nTag);
    
    for (let i = 0; i < dLen; i += 16) {
        const k = Buffer.from(twofish.encrypt(Array.from(key), Array.from(counter)));
        const lim = Math.min(16, dLen - i);
        for (let j = 0; j < lim; j++) {
            ciphertext[i + j] = decrypted[i + j] ^ k[j];
        }
        for (let j = 15; j >= 0; j--) { 
            counter[j] = (counter[j] + 1) & 0xFF; 
            if (counter[j] !== 0) break; 
        }
    }

    const hTag = cmac(key, 1, Buffer.alloc(0));
    const cTag = cmac(key, 2, ciphertext);
    const tag = xor(xor(nTag, hTag), cTag);

    const s1 = Buffer.concat([ciphertext, tag]);
    const totalBytes = s1.length;
    const finalBuffer = Buffer.alloc(totalBytes);
    
    for (let i = 0; i < totalBytes; i++) {
        finalBuffer[totalBytes - 1 - i] = s1[i] ^ ((totalBytes - (i * totalBytes)) & 0xFF);
    }

    return finalBuffer;
};

module.exports = { decryptPKA, encryptPKA };