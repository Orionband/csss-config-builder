const express = require('express');
const multer = require('multer');
const zlib = require('zlib');
const { decryptPKA, encryptPKA } = require('./src/crypto');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Increase JSON limit to handle large XML strings payload
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

app.post('/api/decrypt', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
        const buffer = req.file.buffer;
        
        if (buffer.subarray(0, 5).toString() === "<?xml") {
            return res.send(buffer.toString());
        }

        const zlibStream = decryptPKA(buffer);
        
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

// Ported C++ Logic for PKA Modding
function lockFeatures(xml, featuresToLock) {
    let result = xml;
    for (const feature of featuresToLock) {
        const idTag = `<ID>${feature}</ID>`;
        let pos = 0;
        while ((pos = result.indexOf(idTag, pos)) !== -1) {
            const searchStart = Math.max(0, pos - 150);
            const slice = result.substring(searchStart, pos);
            const lastNodeIndex = slice.lastIndexOf("<NODE ");
            
            if (lastNodeIndex !== -1) {
                const trueNodePos = searchStart + lastNodeIndex;
                const closeBracket = result.indexOf(">", trueNodePos);
                
                if (closeBracket !== -1 && closeBracket < pos) {
                    const nodeTag = result.substring(trueNodePos, closeBracket + 1);
                    if (nodeTag.includes('on="no"')) {
                        const onPos = result.indexOf('on="no"', trueNodePos);
                        if (onPos !== -1 && onPos < closeBracket) {
                            result = result.substring(0, onPos + 4) + "yes" + result.substring(onPos + 6);
                        }
                    }
                }
            }
            pos += idTag.length;
        }
    }
    return result;
}

function clearRecentFiles(xml) {
    return xml.replace(/<RECENT_FILES>[\s\S]*?<\/RECENT_FILES>/g, '<RECENT_FILES></RECENT_FILES>');
}

function setTimeLimit(xml, time_ms, timer_type) {
    let result = xml.replace(/TIMERTYPE="[^"]*"/g, `TIMERTYPE="${timer_type}"`);
    if (timer_type === 1) { // Countdown
        result = result.replace(/COUNTDOWNMS="[^"]*"/g, `COUNTDOWNMS="${time_ms}"`);
        result = result.replace(/COUNTDOWNLEFT="[^"]*"/g, `COUNTDOWNLEFT="${time_ms}"`);
        result = result.replace(/COUNTDOWN_EXPIRED="[^"]*"/g, `COUNTDOWN_EXPIRED="0"`);
    } else { // Elapsed
        result = result.replace(/ELAPSED="[^"]*"/g, `ELAPSED="0"`);
    }
    return result;
}

app.post('/api/export', (req, res) => {
    try {
        let { xml, locks, timeMs, timerType } = req.body;
        
        if (!xml) return res.status(400).json({ error: "Missing XML data" });

        xml = clearRecentFiles(xml);
        if (locks && locks.length > 0) xml = lockFeatures(xml, locks);
        if (timerType !== undefined) xml = setTimeLimit(xml, timeMs || 0, timerType);
        
        const pkaBuffer = encryptPKA(xml);
        
        res.set('Content-Type', 'application/octet-stream');
        res.set('Content-Disposition', 'attachment; filename="configured_lab.pka"');
        res.send(pkaBuffer);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Export failed: " + e.message });
    }
});

const PORT = 10000;
app.listen(PORT, () => console.log(`🚀 Config Builder running at http://localhost:${PORT}`));