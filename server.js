const express = require('express');
const multer = require('multer');
const zlib = require('zlib');
const { decryptPKA, encryptPKA } = require('./src/crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: '100mb' }));
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

// Helper to empty out specific XML tags
function clearTagContents(xml, tagName) {
    const regex = new RegExp(`<${tagName}>[\\s\\S]*?<\\/${tagName}>`, 'g');
    return xml.replace(regex, `<${tagName}></${tagName}>`);
}

app.post('/api/blank-network', (req, res) => {
    try {
        let { xml } = req.body;
        if (!xml) return res.status(400).json({ error: "Missing XML data" });

        const minimalPath = path.join(__dirname, 'minimal.xml');
        if (!fs.existsSync(minimalPath)) {
            return res.status(404).json({ error: "minimal.xml not found on server root." });
        }
        
        const minimalXml = fs.readFileSync(minimalPath, 'utf8');

        // Replace the LAST PACKETTRACER5 block (Answer Network)
        const startIdx = xml.lastIndexOf("<PACKETTRACER5>");
        const endIdx = xml.lastIndexOf("</PACKETTRACER5>");
        
        if (startIdx !== -1 && endIdx !== -1) {
            xml = xml.substring(0, startIdx) + minimalXml + xml.substring(endIdx + 16);
        } else {
            return res.status(400).json({ error: "Could not locate answer network in XML" });
        }

        // Clear contents of grading logic elements
        xml = clearTagContents(xml, 'ANSWER_TREE_CHECK_BOX');
        xml = clearTagContents(xml, 'INITIALSETUP');
        xml = clearTagContents(xml, 'COMPARISONS');

        res.json({ xml: xml });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Processing failed: " + e.message });
    }
});

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function modifyLocks(xml, locks, unlocks) {
    let result = xml;
    for (const feature of locks) {
        const regex = new RegExp(`(<NODE[^>]*on=)"no"([^>]*>\\s*<ID>${escapeRegex(feature)}</ID>)`, 'g');
        result = result.replace(regex, `$1"yes"$2`);
    }
    for (const feature of unlocks) {
        const regex = new RegExp(`(<NODE[^>]*on=)"yes"([^>]*>\\s*<ID>${escapeRegex(feature)}</ID>)`, 'g');
        result = result.replace(regex, `$1"no"$2`);
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
        let { xml, locks, unlocks, timeMs, timerType } = req.body;
        
        if (!xml) return res.status(400).json({ error: "Missing XML data" });

        xml = clearRecentFiles(xml);
        if (locks || unlocks) xml = modifyLocks(xml, locks || [], unlocks || []);
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