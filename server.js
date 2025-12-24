const express = require('express');
const multer = require('multer');
const zlib = require('zlib');
const { decryptPKA } = require('./src/crypto');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static('public'));

app.post('/api/decrypt', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
        const buffer = req.file.buffer;
        
        // Check if already XML
        if (buffer.subarray(0, 5).toString() === "<?xml") {
            return res.send(buffer.toString());
        }

        // Decrypt
        const zlibStream = decryptPKA(buffer);
        
        // Decompress
        let xmlString;
        try {
            xmlString = zlib.inflateSync(zlibStream).toString();
        } catch (e) {
            xmlString = zlib.inflateRawSync(zlibStream).toString();
        }

        res.set('Content-Type', 'text/xml');
        res.send(xmlString);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Processing failed: " + err.message });
    }
});

const PORT = 10000;
app.listen(PORT, () => console.log(`🛠️  Config Builder running at http://localhost:${PORT}`));

