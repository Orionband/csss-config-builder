// ================= DATA STATE =================
let fullXmlText = "";
let currentMode = 'lab';

// Per-Lab defaults
let labs = [{
    id: "lab1",
    title: "Lab 1",
    show_score: true,
    show_msg: true,
    show_missed: true,
    live_streaming: false,
    comp_start: "",
    comp_end: "",
    max_submissions: 0,
    max_upload_mb: 2,
    max_xml_output_mb: 25,
    rate_limit_count: 5,
    rate_limit_window: 60,
    time_limit_minutes: 0,
    pka_file: "",
    checks: []
}];
let currentLabIdx = 0;

let quizzes = [];
let currentQuizIdx = -1;

let initialSet = {};

// Competition window times are always UTC in lab.conf / quiz.conf (not server local time).
function formatUtcIso(d) {
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function buildUtcIsoFromInputs(prefix) {
    const dateEl = document.getElementById(prefix + 'Date');
    if (!dateEl || !dateEl.value) return '';
    const timeEl = document.getElementById(prefix + 'Time');
    const time = (timeEl && timeEl.value) ? timeEl.value : '00:00';
    const [y, m, d] = dateEl.value.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    return formatUtcIso(new Date(Date.UTC(y, m - 1, d, hh, mm || 0, 0)));
}

function setUtcInputsFromIso(prefix, iso) {
    const dateEl = document.getElementById(prefix + 'Date');
    const timeEl = document.getElementById(prefix + 'Time');
    const readout = document.getElementById(prefix + 'Readout');
    if (!dateEl || !timeEl) return;

    if (!iso) {
        dateEl.value = '';
        timeEl.value = '';
        if (readout) {
            readout.textContent = 'Not set';
            readout.classList.remove('active');
        }
        return;
    }

    const parsed = new Date(iso);
    if (isNaN(parsed.getTime())) {
        dateEl.value = '';
        timeEl.value = '';
        if (readout) {
            readout.textContent = iso + ' (invalid)';
            readout.classList.remove('active');
        }
        return;
    }

    const pad = (n) => String(n).padStart(2, '0');
    dateEl.value = `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}-${pad(parsed.getUTCDate())}`;
    timeEl.value = `${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}`;
    if (readout) {
        readout.textContent = formatUtcIso(parsed);
        readout.classList.add('active');
    }
}

function updateCompReadouts(scope) {
    const prefix = scope === 'lab' ? 'labComp' : 'qComp';
    ['Start', 'End'].forEach((which) => {
        const iso = buildUtcIsoFromInputs(prefix + which);
        const readout = document.getElementById(prefix + which + 'Readout');
        if (!readout) return;
        if (!iso) {
            readout.textContent = 'Not set';
            readout.classList.remove('active');
        } else {
            readout.textContent = iso;
            readout.classList.add('active');
        }
    });
}

function clearCompUtc(scope, which) {
    const prefix = scope === 'lab' ? 'labComp' : 'qComp';
    const dateEl = document.getElementById(prefix + which + 'Date');
    const timeEl = document.getElementById(prefix + which + 'Time');
    if (dateEl) dateEl.value = '';
    if (timeEl) timeEl.value = '';
    if (scope === 'lab') syncLabCompUtc();
    else syncQuizCompUtc();
}

function syncLabCompUtc() {
    const l = labs[currentLabIdx];
    l.comp_start = buildUtcIsoFromInputs('labCompStart');
    l.comp_end = buildUtcIsoFromInputs('labCompEnd');
    updateCompReadouts('lab');
    genLab();
}

function syncQuizCompUtc() {
    if (currentQuizIdx < 0) return;
    const q = quizzes[currentQuizIdx];
    q.comp_start = buildUtcIsoFromInputs('qCompStart');
    q.comp_end = buildUtcIsoFromInputs('qCompEnd');
    updateCompReadouts('q');
    genQuiz();
}

const lockableFeatures = [
    "Switching to Logical", "Switching to Physical", "Switching to Realtime", "Switching to Simulation", 
    "Hide Event List on Start", "Hide Network Component Box in Wiring Closets", "Hide User Created Packet Window", 
    "Note Tool", "Delete Tool", "Inspection Tool", "Drawing Tool", "Resize Tool", "Edit Environment", 
    "Hide Wireless/Cellular Connection", "Toggling Animation", "Toggling Auto Dock Popup Window", "Toggling Sound", 
    "Toggling Telephony Sound", "Toggling Show Port Information", "Enable Cable Length", "View Assessment Items", 
    "View Connectivity Tests", "Edit Instructions", "Check Results", "Reset Activity", "Multi-user", "Create Devices", 
    "Remove Devices", "Move Devices", "Change Interface", "Remove Interface", "Connect Links", "Disconnect Links", 
    "Manage All Cables in Wiring Closet", "Create Cluster", "Remove Cluster", "Enter Cluster", "Move Cluster", 
    "Create Physical Level", "Remove Physical Level", "Change Physical Level", "Global Tooltip", "Change Label", 
    "Move Label", "Remove Notes/Annotations", "Auto Connect", "Change Display Names", "Change Wireless Coverage Range", 
    "Change Bluetooth Transmit Range", "Use Thing Editor Tab", "Use I/O Devices Tab", "Use Attributes Tab"
];

// ================= INIT & UTILS =================
window.onload = () => {
    if (!localStorage.getItem('csss_help_seen')) {
        toggleHelp();
        localStorage.setItem('csss_help_seen', 'true');
    }
    
    renderLabSelector();
    renderChecks();
    initLocks();
    
    setupResizer('resizerH', 'leftPane', 'horizontal');
    setupResizer('resizerV', 'outputPane', 'vertical');
    setupResizer('resizerV2', 'quizOutputPane', 'vertical');
    
    toggleDiff(true); 
};

function switchMode(mode) {
    currentMode = mode;
    document.getElementById('modeLabBtn').className = mode === 'lab' ? 'btn btn-outline active' : 'btn btn-outline';
    document.getElementById('modeQuizBtn').className = mode === 'quiz' ? 'btn btn-outline active' : 'btn btn-outline';
    
    document.getElementById('labSection').style.display = mode === 'lab' ? 'flex' : 'none';
    document.getElementById('quizSection').style.display = mode === 'quiz' ? 'flex' : 'none';
    
    document.getElementById('headerLabControls').style.display = mode === 'lab' ? 'flex' : 'none';
    document.getElementById('headerQuizControls').style.display = mode === 'quiz' ? 'flex' : 'none';
}

function toggleHelp() {
    const m = document.getElementById('helpModal');
    m.style.display = (m.style.display === 'flex') ? 'none' : 'flex';
}

function setupResizer(resizerId, targetId, direction) {
    const resizer = document.getElementById(resizerId);
    const target = document.getElementById(targetId);
    if(!resizer || !target) return;
    
    let isResizing = false;
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
        resizer.classList.add('active');
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        if (direction === 'horizontal') {
            const w = e.clientX;
            if(w > 200 && w < window.innerWidth - 200) target.style.width = `${w}px`;
        } else {
            const rect = target.getBoundingClientRect();
            target.style.height = `${e.clientY - rect.top}px`;
        }
    });
    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = 'default';
        resizer.classList.remove('active');
    });
}

function copyToClipboard(type) {
    const id = type === 'lab' ? 'labOutput' : 'quizOutput';
    const copyText = document.getElementById(id);
    copyText.select();
    document.execCommand("copy");
    alert("Copied config!");
}

function toggleDiff(checked) {
    const root = document.getElementById('treeRoot');
    if (checked) {
        root.classList.add('diff-mode');
    } else {
        root.classList.remove('diff-mode');
    }
}

// ================= LAB LOGIC =================
function renderLabSelector() {
    const sel = document.getElementById('labSelector');
    sel.innerHTML = '';
    labs.forEach((l, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = l.title;
        if(i === currentLabIdx) opt.selected = true;
        sel.appendChild(opt);
    });
    loadLabToUI();
    genLab();
}

function loadLabToUI() {
    const l = labs[currentLabIdx];
    document.getElementById('labId').value = l.id;
    document.getElementById('labTitle').value = l.title;
    document.getElementById('labShowMsg').checked = l.show_msg;
    document.getElementById('labShowScore').checked = l.show_score;
    document.getElementById('labShowMissed').checked = !!l.show_missed;
    document.getElementById('labLiveStreaming').checked = !!l.live_streaming;
    
    document.getElementById('labMaxPka').value = l.max_upload_mb !== undefined ? l.max_upload_mb : 2;
    document.getElementById('labMaxXml').value = l.max_xml_output_mb !== undefined ? l.max_xml_output_mb : 25;
    document.getElementById('labMaxSub').value = l.max_submissions !== undefined ? l.max_submissions : 0;
    document.getElementById('labRateCount').value = l.rate_limit_count !== undefined ? l.rate_limit_count : 5;
    document.getElementById('labRateWin').value = l.rate_limit_window !== undefined ? l.rate_limit_window : 60;
    
    document.getElementById('labTime').value = l.time_limit_minutes !== undefined ? l.time_limit_minutes : 0;
    document.getElementById('labPkaFile').value = l.pka_file || "";
    setUtcInputsFromIso('labCompStart', l.comp_start || "");
    setUtcInputsFromIso('labCompEnd', l.comp_end || "");

    renderChecks();
}

function selectLab(idx) {
    currentLabIdx = parseInt(idx);
    loadLabToUI();
}

function addLab() {
    const newIdx = labs.length;
    labs.push({ 
        id: `lab${newIdx + 1}`, 
        title: `Lab ${newIdx + 1}`, 
        show_score: true, show_msg: true, show_missed: true, live_streaming: false,
        comp_start: "", comp_end: "",
        max_submissions: 0, max_upload_mb: 2, max_xml_output_mb: 25, rate_limit_count: 5, rate_limit_window: 60,
        time_limit_minutes: 0, pka_file: "",
        checks: [] 
    });
    currentLabIdx = newIdx;
    renderLabSelector();
}

function removeLab() {
    if(labs.length <= 1) return alert("Must have at least one lab.");
    if(!confirm("Delete current lab definition?")) return;
    labs.splice(currentLabIdx, 1);
    currentLabIdx = 0;
    renderLabSelector();
}

function updateLabMeta() {
    const l = labs[currentLabIdx];
    l.id = document.getElementById('labId').value;
    l.title = document.getElementById('labTitle').value;
    l.show_msg = document.getElementById('labShowMsg').checked;
    l.show_score = document.getElementById('labShowScore').checked;
    l.show_missed = document.getElementById('labShowMissed').checked;
    l.live_streaming = document.getElementById('labLiveStreaming').checked;
    
    l.max_upload_mb = parseInt(document.getElementById('labMaxPka').value) || 2;
    l.max_xml_output_mb = parseInt(document.getElementById('labMaxXml').value) || 25;
    l.max_submissions = parseInt(document.getElementById('labMaxSub').value) || 0;
    l.rate_limit_count = parseInt(document.getElementById('labRateCount').value) || 0;
    l.rate_limit_window = parseInt(document.getElementById('labRateWin').value) || 0;

    l.time_limit_minutes = parseInt(document.getElementById('labTime').value) || 0;
    l.pka_file = document.getElementById('labPkaFile').value.trim();
    l.comp_start = buildUtcIsoFromInputs('labCompStart');
    l.comp_end = buildUtcIsoFromInputs('labCompEnd');
    updateCompReadouts('lab');

    const sel = document.getElementById('labSelector');
    if(sel.options[currentLabIdx]) sel.options[currentLabIdx].text = l.title;
    genLab();
}

function addCheck(data) {
    let defaultMsg = `Check ${data.value || 'Configuration'}`;
    if (defaultMsg.length > 40) defaultMsg = defaultMsg.substring(0, 40) + '...';
    
    let condObj = { ...data, target: 'pass', source: data.source || 'running', context: data.context || 'global' };
    
    if (condObj.type === 'Type5Match') {
        condObj.mode = data.mode || 'device';
        condObj.password = data.password || '';
        condObj.username = data.username || '';
    }

    labs[currentLabIdx].checks.push({
        message: defaultMsg,
        points: 10,
        device: data.device || "DeviceName",
        conditions: [condObj]
    });
    renderChecks();
}

function addManualCheck() {
    labs[currentLabIdx].checks.push({
        device: "DeviceName",
        message: "New Check",
        points: 5,
        conditions: [{
            target: 'pass',
            type: 'ConfigMatch',
            source: 'running',
            context: 'global',
            value: 'command'
        }]
    });
    renderChecks();
}

function renderChecks() {
    const list = document.getElementById('checksList');
    list.innerHTML = '';
    const currentChecks = labs[currentLabIdx].checks;
    document.getElementById('checkCount').innerText = currentChecks.length;

    const types = [
        "ConfigMatch", "ConfigMatchNot", 
        "ConfigRegex", "ConfigRegexNot",
        "XmlMatch", "XmlMatchNot", 
        "XmlRegex", "XmlRegexNot",
        "Type5Match", "Type5MatchNot"
    ];

    currentChecks.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = 'check-card';
        
        let html = `
            <div class="check-header">
                <input class="field-input" style="width:150px; font-weight:bold; color:var(--text)" value="${(c.device||'').replace(/"/g, '&quot;')}" oninput="updateCheckMeta(${i}, 'device', this.value)">
                <span class="remove-x" onclick="removeCheck(${i})">×</span>
            </div>
            <div class="settings-grid">
                <div><label class="field-label">Message</label><input class="field-input" value="${(c.message||'').replace(/"/g, '&quot;')}" oninput="updateCheckMeta(${i}, 'message', this.value)"></div>
                <div><label class="field-label">Points</label><input type="number" class="field-input" value="${c.points}" oninput="updateCheckMeta(${i}, 'points', this.value)"></div>
            </div>
            <div class="conditions-list" style="margin-top: 10px; border-top: 1px solid #444; padding-top: 10px;">
        `;

        if (!c.conditions) c.conditions = [];

        c.conditions.forEach((cond, j) => {
            const isXml = cond.type.startsWith('Xml');
            const isType5 = cond.type.startsWith('Type5Match');

            const typeColor = isXml ? '#66d9ef' : (isType5 ? '#ff66d9' : '#a6e22e');
            
            let targetColor = '#a6e22e'; // pass = green
            if (cond.target === 'fail') targetColor = '#f66';
            if (cond.target === 'passoverride') targetColor = '#e6db74';

            let targetOpts = ['pass', 'fail', 'passoverride'].map(t => `<option value="${t}" ${cond.target===t?'selected':''}>${t}</option>`).join('');
            let typeOpts = types.map(t => `<option value="${t}" ${cond.type===t?'selected':''}>${t}</option>`).join('');

            html += `
                <div style="background:#151515; padding:8px; margin-bottom:5px; border-radius:3px; border:1px solid #333; border-left: 3px solid ${targetColor};">
                    <div style="display:flex; gap:10px; margin-bottom:5px; align-items:center;">
                        <select class="field-input" style="width:auto; padding:2px; font-weight:bold; color:${targetColor}" onchange="updateCondition(${i}, ${j}, 'target', this.value)">${targetOpts}</select>
                        <select class="field-input" style="width:auto; padding:2px; color:${typeColor}" onchange="updateCondition(${i}, ${j}, 'type', this.value)">${typeOpts}</select>
                        <span class="remove-x" style="margin-left:auto; font-size:1.2rem; cursor:pointer; color:#888;" onclick="removeCondition(${i}, ${j})">×</span>
                    </div>
            `;

            if (!isXml) {
                html += `
                    <div class="settings-grid compact-grid">
                        <div>
                            <select class="field-input" onchange="updateCondition(${i}, ${j}, 'source', this.value)">
                                <option value="running" ${cond.source==='running'?'selected':''}>running</option>
                                <option value="startup" ${cond.source==='startup'?'selected':''}>startup</option>
                            </select>
                        </div>
                        <div><input class="field-input" placeholder="Context" value="${(cond.context || 'global').replace(/"/g, '&quot;')}" oninput="updateCondition(${i}, ${j}, 'context', this.value)"></div>
                    </div>
                `;
            }

            if (isType5) {
                html += `
                    <div class="settings-grid compact-grid" style="margin-top:5px;">
                        <select class="field-input" onchange="updateCondition(${i}, ${j}, 'mode', this.value)">
                            <option value="device" ${cond.mode==='device'?'selected':''}>Device (enable)</option>
                            <option value="user" ${cond.mode==='user'?'selected':''}>User (username)</option>
                        </select>
                        <input class="field-input" placeholder="Plaintext Password" value="${(cond.password||'').replace(/"/g, '&quot;')}" oninput="updateCondition(${i}, ${j}, 'password', this.value)">
                    </div>
                `;
                if (cond.mode === 'user') {
                    html += `<input class="field-input" style="margin-top:5px;" placeholder="Username" value="${(cond.username||'').replace(/"/g, '&quot;')}" oninput="updateCondition(${i}, ${j}, 'username', this.value)">`;
                }
            } else if (isXml) {
                let pathStr = "[]";
                if (cond.path) {
                    try { pathStr = JSON.stringify(JSON.parse(cond.path)); } 
                    catch(e) { pathStr = cond.path; }
                }
                html += `
                    <div class="settings-grid compact-grid" style="margin-top:5px;">
                        <input class="field-input" placeholder='Path (JSON Array e.g. ["GATEWAY"])' value='${pathStr.replace(/'/g, "&apos;")}' oninput="updateCondition(${i}, ${j}, 'path', this.value)">
                        <input class="field-input" placeholder="Value" value="${(cond.value||'').replace(/"/g, '&quot;')}" oninput="updateCondition(${i}, ${j}, 'value', this.value)">
                    </div>
                `;
            } else {
                html += `<input class="field-input" style="margin-top:5px;" placeholder="Value" value="${(cond.value||'').replace(/"/g, '&quot;')}" oninput="updateCondition(${i}, ${j}, 'value', this.value)">`;
            }

            html += `</div>`;
        });

        html += `
            </div>
            <button class="mini-btn" style="margin-top:5px;" onclick="addCondition(${i})">+ Add Condition</button>
        `;

        div.innerHTML = html;
        list.appendChild(div);
    });
    
    genLab();
}

function updateCheckMeta(idx, key, val) {
    labs[currentLabIdx].checks[idx][key] = val;
    genLab();
}

function updateCondition(cIdx, condIdx, key, val) {
    const cond = labs[currentLabIdx].checks[cIdx].conditions[condIdx];
    cond[key] = val;
    
    if (key === 'type') {
        if (val.startsWith('Type5Match') && !cond.mode) {
            cond.mode = 'device';
            cond.password = '';
            cond.username = '';
        }
        renderChecks(); 
    } 
    else if (key === 'mode' || key === 'target') {
        renderChecks();
    }
    else {
        genLab();
    }
}

function removeCheck(idx) {
    labs[currentLabIdx].checks.splice(idx, 1);
    renderChecks();
}

function addCondition(cIdx) {
    labs[currentLabIdx].checks[cIdx].conditions.push({
        target: 'pass',
        type: 'ConfigMatch',
        source: 'running',
        context: 'global',
        value: 'command'
    });
    renderChecks();
}

function removeCondition(cIdx, condIdx) {
    labs[currentLabIdx].checks[cIdx].conditions.splice(condIdx, 1);
    if (labs[currentLabIdx].checks[cIdx].conditions.length === 0) {
        labs[currentLabIdx].checks.splice(cIdx, 1);
    }
    renderChecks();
}

function genLab() {
    let out = "";
    labs.forEach(l => {
        out += `[[labs]]\n`;
        out += `id = "${l.id}"\n`;
        out += `title = "${l.title}"\n`;
        out += `show_score = ${l.show_score}\n`;
        out += `live_streaming = ${!!l.live_streaming}\n`;
        out += `show_check_messages = ${l.show_msg}\n`;
        if (l.show_missed) out += `show_missed_points = true\n`;
        
        if (l.comp_start) out += `comp_start = "${l.comp_start}"\n`;
        if (l.comp_end) out += `comp_end = "${l.comp_end}"\n`;

        out += `max_submissions = ${l.max_submissions}\n`;
        out += `max_upload_mb = ${l.max_upload_mb}\n`;
        out += `max_xml_output_mb = ${l.max_xml_output_mb}\n`;
        out += `rate_limit_count = ${l.rate_limit_count}\n`;
        out += `rate_limit_window_seconds = ${l.rate_limit_window}\n`;
        
        if (l.pka_file && l.pka_file !== "") {
            out += `pka_file = "${l.pka_file}"\n`;
        }
        out += `time_limit_minutes = ${l.time_limit_minutes}\n\n`;
        
        l.checks.forEach(c => {
            out += `    [[labs.checks]]\n    message = "${c.message}"\n    points = ${c.points}\n    device = "${c.device}"\n`;
            
            c.conditions.forEach(cond => {
                out += `        [[labs.checks.${cond.target}]]\n        type = "${cond.type}"\n`;
                
                if (cond.type.startsWith('Xml')) {
                    let pathArrStr = '';
                    try {
                        const parsed = JSON.parse(cond.path || '[]');
                        pathArrStr = parsed.map(s => `"${s}"`).join(', ');
                    } catch (e) {
                        pathArrStr = `"${cond.path}"`;
                    }
                    out += `        path = [${pathArrStr}]\n        value = "${cond.value}"\n`;
                } 
                else if (cond.type.startsWith('Type5Match')) {
                    out += `        source = "${cond.source}"\n        context = "${cond.context || 'global'}"\n`;
                    out += `        mode = "${cond.mode || 'device'}"\n`;
                    if ((cond.mode || 'device') === 'user') {
                        out += `        username = "${cond.username || ''}"\n`;
                    }
                    out += `        password = "${(cond.password || '').replace(/"/g, '\\"')}"\n`;
                } 
                else {
                    out += `        source = "${cond.source}"\n        context = "${cond.context}"\n        value = "${(cond.value||'').replace(/"/g, '\\"')}"\n`;
                }
            });
            out += "\n";
        });
        out += "\n";
    });
    
    const labOutput = document.getElementById('labOutput');
    if(labOutput) labOutput.value = out;
}

// ================= QUIZ LOGIC =================
function addQuiz() {
    const newIdx = quizzes.length;
    quizzes.push({ 
        id: `quiz${newIdx + 1}`, 
        title: `Quiz ${newIdx + 1}`, 
        show_score: true, show_correct: true, show_missed: true, 
        comp_start: "", comp_end: "", 
        time: 15, attempts: 3, 
        rate_limit_count: 5, rate_limit_window: 60,
        questions: [] 
    });
    renderQuizList();
    selectQuiz(newIdx);
}

function renderQuizList() {
    const list = document.getElementById('quizList');
    list.innerHTML = '';
    quizzes.forEach((q, i) => {
        const div = document.createElement('div');
        div.className = `quiz-item-row ${i === currentQuizIdx ? 'selected' : ''}`;
        div.innerHTML = `<span>${q.title}</span>`;
        div.onclick = () => selectQuiz(i);
        list.appendChild(div);
    });
}

function selectQuiz(idx) {
    currentQuizIdx = idx;
    renderQuizList();
    document.getElementById('quizEditor').style.display = 'flex';
    document.getElementById('quizEmptyState').style.display = 'none';
    loadQuizToUI();
}

function loadQuizToUI() {
    const q = quizzes[currentQuizIdx];
    document.getElementById('qId').value = q.id;
    document.getElementById('qTitle').value = q.title;
    document.getElementById('qTime').value = q.time;
    document.getElementById('qAtt').value = q.attempts;
    
    document.getElementById('qScore').checked = q.show_score;
    document.getElementById('qCorrect').checked = q.show_correct;
    document.getElementById('qMissed').checked = !!q.show_missed;
    setUtcInputsFromIso('qCompStart', q.comp_start || "");
    setUtcInputsFromIso('qCompEnd', q.comp_end || "");
    document.getElementById('qRateCount').value = q.rate_limit_count !== undefined ? q.rate_limit_count : 5;
    document.getElementById('qRateWin').value = q.rate_limit_window !== undefined ? q.rate_limit_window : 60;
    
    renderQuestions();
    genQuiz();
}

function updateQuizMeta() {
    const q = quizzes[currentQuizIdx];
    q.id = document.getElementById('qId').value;
    q.title = document.getElementById('qTitle').value;
    q.time = parseInt(document.getElementById('qTime').value);
    q.attempts = parseInt(document.getElementById('qAtt').value);
    
    q.show_score = document.getElementById('qScore').checked;
    q.show_correct = document.getElementById('qCorrect').checked;
    q.show_missed = document.getElementById('qMissed').checked;
    q.comp_start = buildUtcIsoFromInputs('qCompStart');
    q.comp_end = buildUtcIsoFromInputs('qCompEnd');
    updateCompReadouts('q');
    q.rate_limit_count = parseInt(document.getElementById('qRateCount').value) || 0;
    q.rate_limit_window = parseInt(document.getElementById('qRateWin').value) || 0;
    
    renderQuizList();
    genQuiz();
}

function deleteQuiz() {
    if(!confirm("Delete this quiz?")) return;
    quizzes.splice(currentQuizIdx, 1);
    currentQuizIdx = -1;
    renderQuizList();
    document.getElementById('quizEditor').style.display = 'none';
    document.getElementById('quizEmptyState').style.display = 'block';
    genQuiz();
}

function addQuestion() {
    quizzes[currentQuizIdx].questions.push({ 
        text: "New Question", type: "radio", explanation: "", points: 1, image: "", pka: "", 
        answers: [{text:"Option 1", correct:true}, {text:"Option 2", correct:false}], pairs: [] 
    });
    renderQuestions();
}

function renderQuestions() {
    const list = document.getElementById('questionListContainer');
    list.innerHTML = '';
    const qs = quizzes[currentQuizIdx].questions;
    document.getElementById('qCount').innerText = qs.length;

    qs.forEach((q, i) => {
        const div = document.createElement('div');
        div.className = 'q-card';
        div.innerHTML = `
            <div class="q-header"><span>Q${i+1}</span><span class="remove-x" onclick="removeQuestion(${i})">×</span></div>
            <div class="settings-grid">
                <div><label class="field-label">Question Text</label><input class="field-input" value="${(q.text||'').replace(/"/g, '&quot;')}" oninput="updateQ(${i}, 'text', this.value)"></div>
                <div><label class="field-label">Type</label>
                    <select class="field-input" onchange="updateQ(${i}, 'type', this.value)">
                        <option value="radio" ${q.type=='radio'?'selected':''}>Radio (Single)</option>
                        <option value="checkbox" ${q.type=='checkbox'?'selected':''}>Checkbox (Multi)</option>
                        <option value="text" ${q.type=='text'?'selected':''}>Text (Regex)</option>
                        <option value="matching" ${q.type=='matching'?'selected':''}>Matching</option>
                    </select>
                </div>
            </div>
            
            <div class="settings-grid" style="grid-template-columns: repeat(3, 1fr);">
                <div><label class="field-label">Points</label><input type="number" class="field-input" value="${q.points !== undefined ? q.points : 1}" oninput="updateQ(${i}, 'points', parseInt(this.value)||0)"></div>
                <div><label class="field-label">Image File (Opt)</label><input class="field-input" placeholder="e.g. topo.png" value="${q.image||''}" oninput="updateQ(${i}, 'image', this.value)"></div>
                <div><label class="field-label">PKA Exhibit (Opt)</label><input class="field-input" placeholder="e.g. lab.pka" value="${q.pka||''}" oninput="updateQ(${i}, 'pka', this.value)"></div>
            </div>

            <div><label class="field-label">Explanation</label><input class="field-input" value="${(q.explanation||'').replace(/"/g, '&quot;')}" oninput="updateQ(${i}, 'explanation', this.value)"></div>
            <div class="answer-list" id="q-answers-${i}"></div>
        `;
        list.appendChild(div);
        renderAnswers(i, q);
    });
    genQuiz();
}

function updateQ(qIdx, key, val) {
    quizzes[currentQuizIdx].questions[qIdx][key] = val;
    if(key === 'type') {
        const q = quizzes[currentQuizIdx].questions[qIdx];
        if(val === 'matching') q.pairs = [{left:'A', right:'1'}];
        else if(val === 'text') q.regex = "^answer$";
        else { q.answers = [{text:"Option A", correct:true}]; }
        renderQuestions();
    } else { genQuiz(); }
}

function removeQuestion(i) { quizzes[currentQuizIdx].questions.splice(i, 1); renderQuestions(); }

function renderAnswers(qIdx, q) {
    const container = document.getElementById(`q-answers-${qIdx}`);
    container.innerHTML = '';
    
    if (q.type === 'text') {
        container.innerHTML = `<div><label class="field-label">Regex Match</label><input class="field-input" value="${(q.regex||'').replace(/"/g, '&quot;')}" oninput="quizzes[currentQuizIdx].questions[${qIdx}].regex=this.value; genQuiz()"></div>`;
        return;
    }

    if (q.type === 'matching') {
        if(!q.pairs) q.pairs = [];
        q.pairs.forEach((pair, pIdx) => {
            const row = document.createElement('div');
            row.className = 'answer-row';
            row.style.background = 'transparent';
            row.style.border = 'none';
            row.innerHTML = `
                <input class="field-input" placeholder="Left" value="${(pair.left||'').replace(/"/g, '&quot;')}" oninput="quizzes[currentQuizIdx].questions[${qIdx}].pairs[${pIdx}].left=this.value; genQuiz()" style="width:45%; margin-right:5px;">
                <span>=</span>
                <input class="field-input" placeholder="Right" value="${(pair.right||'').replace(/"/g, '&quot;')}" oninput="quizzes[currentQuizIdx].questions[${qIdx}].pairs[${pIdx}].right=this.value; genQuiz()" style="width:45%; margin-left:5px;">
                <button class="mini-btn" style="color:#f66; margin-left:5px;" onclick="removePair(${qIdx}, ${pIdx})">✖</button>
            `;
            container.appendChild(row);
        });
        const addBtn = document.createElement('button');
        addBtn.className = 'mini-btn';
        addBtn.innerText = "+ Add Pair";
        addBtn.onclick = () => { q.pairs.push({left:'', right:''}); renderQuestions(); };
        container.appendChild(addBtn);
        return;
    }

    if(!q.answers) q.answers = [];
    const isRadio = q.type === 'radio';
    q.answers.forEach((ans, aIdx) => {
        const row = document.createElement('div');
        row.className = 'answer-row';
        const checkHandler = isRadio ? `setRadioCorrect(${qIdx}, ${aIdx})` : `quizzes[currentQuizIdx].questions[${qIdx}].answers[${aIdx}].correct=this.checked; genQuiz()`;
        row.innerHTML = `
            <div class="answer-check-col"><label class="custom-label ${isRadio ? 'radio' : ''}"><input type="checkbox" ${ans.correct ? 'checked' : ''} onchange="${checkHandler}"><span class="checkmark"></span></label></div>
            <div class="answer-text-col"><input type="text" value="${(ans.text||'').replace(/"/g, '&quot;')}" placeholder="Answer Option..." oninput="quizzes[currentQuizIdx].questions[${qIdx}].answers[${aIdx}].text=this.value; genQuiz()"></div>
            <button class="mini-btn" style="color:#f66; border:none; background:transparent;" onclick="removeAns(${qIdx}, ${aIdx})">✖</button>
        `;
        container.appendChild(row);
    });
    const addBtn = document.createElement('button');
    addBtn.className = 'mini-btn';
    addBtn.innerText = "+ Add Option";
    addBtn.style.marginTop = "5px";
    addBtn.onclick = () => { q.answers.push({text:"", correct:false}); renderQuestions(); };
    container.appendChild(addBtn);
}

function setRadioCorrect(qIdx, targetAIdx) {
    const q = quizzes[currentQuizIdx].questions[qIdx];
    q.answers.forEach((a, idx) => { a.correct = (idx === targetAIdx); });
    renderQuestions(); 
}

function removeAns(qIdx, aIdx) { quizzes[currentQuizIdx].questions[qIdx].answers.splice(aIdx, 1); renderQuestions(); }
function removePair(qIdx, pIdx) { quizzes[currentQuizIdx].questions[qIdx].pairs.splice(pIdx, 1); renderQuestions(); }

function genQuiz() {
    let out = "";
    quizzes.forEach(q => {
        out += `[[quizzes]]\nid = "${q.id}"\ntitle = "${q.title}"\n`;
        out += `time_limit_minutes = ${q.time}\nmax_attempts = ${q.attempts}\nshow_score = ${q.show_score}\nshow_corrections = ${q.show_correct}\n`;
        if (q.show_missed) out += `show_missed_points = true\n`;
        if (q.comp_start) out += `comp_start = "${q.comp_start}"\n`;
        if (q.comp_end) out += `comp_end = "${q.comp_end}"\n`;
        out += `rate_limit_count = ${q.rate_limit_count}\nrate_limit_window_seconds = ${q.rate_limit_window}\n\n`;
        q.questions.forEach(qs => {
            out += `    [[quizzes.questions]]\n    text = "${qs.text}"\n    type = "${qs.type}"\n    points = ${qs.points !== undefined ? qs.points : 1}\n`;
            if (qs.image && qs.image.trim() !== '') out += `    image = "${qs.image}"\n`;
            if (qs.pka && qs.pka.trim() !== '') out += `    pka = "${qs.pka}"\n`;
            out += `    explanation = "${qs.explanation || ''}"\n`;
            
            if(qs.type === 'text') { out += `    regex = "${(qs.regex||'').replace(/\\/g, '\\\\')}"\n`; }
            else if (qs.type === 'matching') { if(qs.pairs) { qs.pairs.forEach(p => { out += `        [[quizzes.questions.pairs]]\n        left = "${p.left}"\n        right = "${p.right}"\n`; }); } }
            else { if(qs.answers) { qs.answers.forEach(a => { out += `        [[quizzes.questions.answers]]\n        text = "${a.text}"\n        correct = ${a.correct}\n`; }); } }
            out += "\n";
        });
        out += "\n";
    });
    
    const quizOutput = document.getElementById('quizOutput');
    if(quizOutput) quizOutput.value = out;
}

// ================= RAW VIEW — VIRTUALIZED =================
let rawLines = [];
let rawLineHeight = 18;
let rawLineHeightMeasured = false;
let rawVisiblePool = null;
let rawHighlightLine = -1;
let rawHighlightStart = -1;
let rawHighlightLen = 0;
let rawScrollRaf = 0;

function rebuildRawLines() {
    rawLines = fullXmlText ? fullXmlText.split('\n') : [];
    rawHighlightLine = -1;
}

function updateLineNumbers() {
    rebuildRawLines();
    if (rawVisiblePool) renderRawViewport();
}

function ensureRawDom() {
    const scrollArea = document.getElementById('view-raw');
    if (!scrollArea) return false;

    let spacer = document.getElementById('rawSpacer');
    if (!spacer) {
        spacer = document.createElement('div');
        spacer.id = 'rawSpacer';
        spacer.style.cssText = 'position:relative;width:100%;';
        const backBtn = document.getElementById('rawBackBtn');
        if (backBtn && backBtn.parentElement === scrollArea) {
            scrollArea.insertBefore(spacer, backBtn);
        } else {
            scrollArea.appendChild(spacer);
        }
    }

    if (!rawVisiblePool || !spacer.contains(rawVisiblePool)) {
        rawVisiblePool = document.createElement('div');
        rawVisiblePool.className = 'code-wrapper';
        rawVisiblePool.style.position = 'absolute';
        rawVisiblePool.style.left = '0';
        rawVisiblePool.style.right = '0';
        spacer.appendChild(rawVisiblePool);
    }

    return true;
}

function measureRawLineHeight() {
    if (rawLineHeightMeasured) return;
    rawLineHeightMeasured = true;
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-family:"Roboto Mono",monospace;font-size:0.8rem;line-height:1.4;';
    probe.textContent = 'X';
    document.body.appendChild(probe);
    rawLineHeight = probe.getBoundingClientRect().height || 18;
    document.body.removeChild(probe);
}

function populateRawView() {
    if (!ensureRawDom()) return;
    if (!rawLines.length && fullXmlText) rebuildRawLines();

    const spacer = document.getElementById('rawSpacer');
    if (!spacer) return;

    measureRawLineHeight();
    spacer.style.height = (rawLines.length * rawLineHeight + 20) + 'px';
    renderRawViewport();
}

function onRawScroll() {
    if (rawScrollRaf) return;
    rawScrollRaf = requestAnimationFrame(() => {
        rawScrollRaf = 0;
        renderRawViewport();
    });
}

function renderRawViewport() {
    const scrollArea = document.getElementById('view-raw');
    if (!scrollArea || !rawVisiblePool) return;
    if (rawLines.length === 0) {
        rawVisiblePool.innerHTML = '<div class="raw-content" style="padding:10px;color:#666;">Upload a PKA file to view raw XML.</div>';
        return;
    }

    const scrollTop = scrollArea.scrollTop;
    const viewH = scrollArea.clientHeight;
    const overscan = 20;
    const startLine = Math.max(0, Math.floor(scrollTop / rawLineHeight) - overscan);
    const endLine = Math.min(rawLines.length, Math.ceil((scrollTop + viewH) / rawLineHeight) + overscan);

    const gutterWidth = String(rawLines.length).length;

    let gutterHtml = '';
    let contentHtml = '';
    for (let i = startLine; i < endLine; i++) {
        const numStr = String(i + 1).padStart(gutterWidth, ' ');
        gutterHtml += numStr + '\n';

        if (i === rawHighlightLine) {
            const line = rawLines[i];
            const before = escapeHtmlRaw(line.slice(0, rawHighlightStart));
            const match = escapeHtmlRaw(line.slice(rawHighlightStart, rawHighlightStart + rawHighlightLen));
            const after = escapeHtmlRaw(line.slice(rawHighlightStart + rawHighlightLen));
            contentHtml += before + '<mark class="highlight-flash" id="jumpTarget">' + match + '</mark>' + after + '\n';
        } else {
            contentHtml += escapeHtmlRaw(rawLines[i]) + '\n';
        }
    }

    const topOffset = startLine * rawLineHeight;
    rawVisiblePool.style.top = topOffset + 'px';
    rawVisiblePool.innerHTML =
        '<div class="line-numbers">' + gutterHtml + '</div>' +
        '<div class="raw-content">' + contentHtml + '</div>';
}

function escapeHtmlRaw(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function clearRawHighlight() {
    rawHighlightLine = -1;
}

function jumpToRaw(text) {
    if (!fullXmlText || !text) return;

    const index = fullXmlText.indexOf(text);
    if (index === -1) {
        alert("Exact match not found in Raw view.");
        return;
    }

    const before = fullXmlText.slice(0, index);
    const targetLine = before.split('\n').length - 1;
    const lastNl = before.lastIndexOf('\n');
    const colStart = lastNl === -1 ? index : index - lastNl - 1;

    rawHighlightLine = targetLine;
    rawHighlightStart = colStart;
    const lineLen = rawLines[targetLine] ? rawLines[targetLine].length : 0;
    rawHighlightLen = Math.min(text.length, lineLen - colStart);

    setTab('raw');

    const scrollArea = document.getElementById('view-raw');
    const targetScroll = Math.max(0, targetLine * rawLineHeight - scrollArea.clientHeight / 2);
    scrollArea.scrollTop = targetScroll;

    renderRawViewport();

    requestAnimationFrame(() => {
        const target = document.getElementById('jumpTarget');
        if (target) target.scrollIntoView({ block: 'center' });
        document.getElementById('rawBackBtn').style.display = 'block';
    });
}

// ================= INITIAL NETWORK DIFFERENCE LOGIC =================
function buildInitialSet(initialBlock) {
    initialSet = {};
    if (!initialBlock) return;
    
    const devices = initialBlock.querySelectorAll("NETWORK > DEVICES > DEVICE");
    devices.forEach(dev => {
        const engine = dev.querySelector("ENGINE");
        if (!engine) return;
        const name = engine.querySelector("NAME")?.textContent || "Unknown";
        const set = new Set();
        initialSet[name] = set;

        const rc = engine.querySelector("RUNNINGCONFIG");
        if(rc) rc.querySelectorAll("LINE").forEach(l => set.add(`running::${l.textContent.trim()}`));

        const sc = engine.querySelector("STARTUPCONFIG");
        if(sc) sc.querySelectorAll("LINE").forEach(l => set.add(`startup::${l.textContent.trim()}`));

        function traverse(n, path) {
            if(n.tagName === "RUNNINGCONFIG" || n.tagName === "STARTUPCONFIG") return;
            
            const cleanPath = path.filter(p => p !== "ENGINE");
            
            if(n.hasAttributes()) {
                for(let i=0; i<n.attributes.length; i++) {
                    const attrPath = [...cleanPath, "$", n.attributes[i].name];
                    set.add(`attr::${attrPath.join('.')}::${n.attributes[i].name}::${n.attributes[i].value}`);
                }
            }
            const children = Array.from(n.children);
            if(children.length === 0) {
                if(n.textContent.trim()) set.add(`xml::${cleanPath.join('.')}::${n.textContent.trim()}`);
            } else {
                const groups = {};
                children.forEach(c => { if(!groups[c.tagName]) groups[c.tagName]=[]; groups[c.tagName].push(c); });
                for(const [tag, nodes] of Object.entries(groups)) {
                    nodes.forEach((child, idx) => {
                        const nextPath = [...path, tag];
                        if(nodes.length > 1) nextPath.push(idx.toString());
                        traverse(child, nextPath);
                    });
                }
            }
        }
        traverse(engine, []);
    });
}

function applyDiffVisibility(node) {
    let allChildrenUnchanged = true;
    let hasVisibleChildren = false;

    const childrenContainer = node.querySelector(':scope > .children');
    if (childrenContainer && childrenContainer.children.length > 0) {
        Array.from(childrenContainer.children).forEach(child => {
            if (child.classList.contains('tree-item')) {
                const childUnchanged = applyDiffVisibility(child);
                if (!childUnchanged) {
                    allChildrenUnchanged = false;
                    hasVisibleChildren = true;
                }
            }
        });
    }

    const isContainerOnly = node.classList.contains('type-folder') || node.classList.contains('type-device');
    const isBlock = node.classList.contains('type-block');
    const isSelfUnchanged = node.classList.contains('diff-unchanged');

    if (isContainerOnly) {
        if (allChildrenUnchanged && !hasVisibleChildren) {
            node.classList.add('diff-unchanged');
            return true;
        } else {
            node.classList.remove('diff-unchanged');
            return false;
        }
    } else if (isBlock) {
        if (allChildrenUnchanged && !hasVisibleChildren && isSelfUnchanged) {
            node.classList.add('diff-unchanged');
            return true;
        } else {
            node.classList.remove('diff-unchanged');
            return false;
        }
    } else {
        return isSelfUnchanged;
    }
}

function getCheckDataForCommand(trimmed, devName, source, context) {
    const enableMatch = trimmed.match(/^enable\s+secret\s+5\s+(?:\$1\$[^\s]+)/i);
    if (enableMatch) {
        return { type:'Type5Match', mode:'device', password:'', device:devName, context:context, source:source, value:trimmed };
    }
    const userMatch = trimmed.match(/^username\s+([^\s]+).*secret\s+5\s+(?:\$1\$[^\s]+)/i);
    if (userMatch) {
        return { type:'Type5Match', mode:'user', username: userMatch[1], password:'', device:devName, context:context, source:source, value:trimmed };
    }
    return { type:'ConfigMatch', device:devName, context:context, value:trimmed, source:source };
}

// ================= FILE & PARSING =================
function setTab(mode) {
    document.getElementById('view-tree').style.display = mode === 'tree' ? 'block' : 'none';
    document.getElementById('treeToolbar').style.display = mode === 'tree' ? 'flex' : 'none';
    document.getElementById('view-raw').style.display = mode === 'raw' ? 'block' : 'none';
    document.getElementById('view-settings').style.display = mode === 'settings' ? 'block' : 'none';
    
    document.getElementById('tab-tree').className = mode === 'tree' ? 'tab active' : 'tab';
    document.getElementById('tab-raw').className = mode === 'raw' ? 'tab active' : 'tab';
    document.getElementById('tab-settings').className = mode === 'settings' ? 'tab active' : 'tab';
    
    if (mode === 'raw') {
        populateRawView();
    }
    if (mode === 'tree') {
        rawHighlightLine = -1;
        document.getElementById('rawBackBtn').style.display = 'none';
    }
}

document.getElementById('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const loader = document.getElementById('loadingText');
    loader.style.display = 'block';
    loader.innerText = "Decrypting...";
    document.getElementById('treeRoot').innerHTML = '';

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/decrypt', { method: 'POST', body: formData });
        if(!res.ok) throw new Error(await res.text());
        
        fullXmlText = await res.text();
        updateLineNumbers();
        document.getElementById('dlBtn').disabled = false;

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(fullXmlText, "text/xml");
        const ptBlocks = xmlDoc.querySelectorAll("PACKETTRACER5");
        if(ptBlocks.length === 0) throw new Error("Invalid XML");
        
        const targetBlock = ptBlocks[ptBlocks.length - 1]; // Answer Network
        const initialBlock = ptBlocks.length > 1 ? ptBlocks[0] : null; // Initial Network
        
        buildInitialSet(initialBlock);

        document.getElementById('sourceBadge').className = "badge success";
        document.getElementById('sourceBadge').innerText = file.name;

        parseDevices(targetBlock);
        readPKASettings(fullXmlText);
        
        const root = document.getElementById('treeRoot');
        Array.from(root.children).forEach(devNode => applyDiffVisibility(devNode));
        
    } catch (err) {
        alert(err.message);
        loader.innerText = "Error loading file.";
    } finally {
        loader.style.display = 'none';
    }
});

function parseDevices(rootNode) {
    const root = document.getElementById('treeRoot');
    root.innerHTML = '';
    const devices = rootNode.querySelectorAll("NETWORK > DEVICES > DEVICE");
    
    devices.forEach((dev, index) => {
        const engine = dev.querySelector("ENGINE");
        if(!engine) return;
        const nameTag = engine.querySelector("NAME");
        const name = nameTag ? nameTag.textContent : `Device ${index}`;
        
        const typeTag = engine.querySelector("TYPE");
        const devType = typeTag ? typeTag.textContent.toLowerCase() : "";
        const isHost = ["pc", "laptop", "server"].includes(devType);
        
        const devNode = createTreeItem(name, "device", root);

        let commonFolders = null;
        if (isHost) {
            const mainFolder = createTreeItem("Common Attributes", "folder", devNode.childrenContainer);
            addExpandSubtreeBtn(mainFolder);
            
            const globalFolder = createTreeItem("Global", "folder", mainFolder.childrenContainer);
            addExpandSubtreeBtn(globalFolder);
            
            commonFolders = {
                main: mainFolder,
                global: globalFolder,
                ports: {}
            };
        }

        const runConfig = engine.querySelector("RUNNINGCONFIG");
        if(runConfig) {
            const confFolder = createTreeItem("Running Config", "folder", devNode.childrenContainer);
            addExpandSubtreeBtn(confFolder);
            parseIOS(runConfig.querySelectorAll("LINE"), confFolder.childrenContainer, name, "running");
        }
        
        const startConfig = engine.querySelector("STARTUPCONFIG");
        if(startConfig) {
            const confFolder = createTreeItem("Startup Config", "folder", devNode.childrenContainer);
            addExpandSubtreeBtn(confFolder);
            parseIOS(startConfig.querySelectorAll("LINE"), confFolder.childrenContainer, name, "startup");
        }

        const hwFolder = createTreeItem("Other Attributes", "folder", devNode.childrenContainer);
        addExpandSubtreeBtn(hwFolder);
        parseXML(engine, hwFolder.childrenContainer, name, [], commonFolders);
    });
}

function parseIOS(lines, container, devName, source) {
    let blockUI = null;
    let blockContext = null;

    lines.forEach(l => {
        const txt = l.textContent;
        if(!txt || txt.trim() === '!' || txt.trim() === '') return;
        
        if(!txt.startsWith(' ')) {
            const trimmed = txt.trim();
            if(trimmed.startsWith('interface') || trimmed.startsWith('router') || trimmed.startsWith('line')) {
                blockContext = trimmed;
                blockUI = createTreeItem(trimmed, "block", container);
                if (initialSet[devName] && initialSet[devName].has(`${source}::${trimmed}`)) {
                    blockUI.element.classList.add('diff-unchanged');
                }
                const checkData = getCheckDataForCommand(trimmed, devName, source, 'global');
                addActions(blockUI, checkData, trimmed);
            } else {
                const cmdUI = createTreeItem(trimmed, "cmd", container);
                if (initialSet[devName] && initialSet[devName].has(`${source}::${trimmed}`)) {
                    cmdUI.element.classList.add('diff-unchanged');
                }
                
                const checkData = getCheckDataForCommand(trimmed, devName, source, 'global');
                addActions(cmdUI, checkData, trimmed);
            }
        } else if (blockUI) {
            const trimmed = txt.trim();
            const cmdUI = createTreeItem(trimmed, "cmd", blockUI.childrenContainer);
            if (initialSet[devName] && initialSet[devName].has(`${source}::${trimmed}`)) {
                cmdUI.element.classList.add('diff-unchanged');
            }
            
            const checkData = getCheckDataForCommand(trimmed, devName, source, blockContext);
            addActions(cmdUI, checkData, trimmed);
        }
    });
}

function parseXML(node, container, devName, path, commonFolders) {
    if(node.tagName === "RUNNINGCONFIG" || node.tagName === "STARTUPCONFIG") return;
    
    const cleanPath = path.filter(p => p !== "ENGINE");

    if (node.hasAttributes()) {
        for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i];
            const item = createTreeItem(`@${attr.name}: ${attr.value}`, "attr", container);
            
            const currentPath = [...cleanPath, "$", attr.name];
            const attrKey = `attr::${currentPath.join('.')}::${attr.name}::${attr.value}`;
            if (initialSet[devName] && initialSet[devName].has(attrKey)) item.element.classList.add('diff-unchanged');

            addActions(item, { type:'XmlMatch', device:devName, path:JSON.stringify(currentPath), value:attr.value }, attr.value);
        }
    }

    const children = Array.from(node.children);
    if(children.length === 0) {
        const val = node.textContent;
        // Don't add blank xml nodes
        if(val && val.trim()) {
            const item = createTreeItem(`${node.tagName}: ${val}`, "leaf", container);
            
            const valKey = `xml::${cleanPath.join('.')}::${val.trim()}`;
            if (initialSet[devName] && initialSet[devName].has(valKey)) item.element.classList.add('diff-unchanged');

            addActions(item, { type:'XmlMatch', device:devName, path:JSON.stringify(cleanPath), value:val }, val);

            if (commonFolders) {
                const portTags = ["IP", "SUBNET", "PORT_GATEWAY", "PORT_DHCP_ENABLE", "IPV6_ENABLED", "IPV6_LINK_LOCAL", "IPV6_PORT_DHCP_ENABLED", "PORT_DNS", "DHCP_SERVER_IP", "IPV6_PORT_GATEWAY", "IPV6_PORT_DNS", "IPV6_ADDRESS_AUTOCONFIG", "ACL_IN_ID", "ACL_OUT_ID", "ACLv6_IN_ID", "ACLv6_OUT_ID", "VLAN"];
                let isCommon = false;
                let isGlobal = false;
                let label = `${node.tagName}: ${val}`;
                let portNode = null;
                
                if (["NAME", "GATEWAY"].includes(node.tagName) && node.parentElement && node.parentElement.tagName === "ENGINE") {
                    isCommon = true; isGlobal = true;
                }
                else if (["SERVER_IP", "SERVER_IPV6"].includes(node.tagName) && node.parentElement && node.parentElement.tagName === "DNS_CLIENT") {
                    isCommon = true; isGlobal = true;
                }
                else if (portTags.includes(node.tagName) && node.parentElement && node.parentElement.tagName === "PORT") {
                    isCommon = true;
                    portNode = node.parentElement;
                }
                else if ((node.tagName === "ADDRESS" || node.tagName === "PREFIX") && node.parentElement && node.parentElement.tagName === "IPV6_ADDRESS") {
                    isCommon = true;
                    label = `IPV6_${node.tagName}: ${val}`;
                    if (node.parentElement.parentElement && node.parentElement.parentElement.parentElement && node.parentElement.parentElement.parentElement.tagName === "PORT") {
                        portNode = node.parentElement.parentElement.parentElement;
                    }
                }

                if (isCommon) {
                    let targetContainer = commonFolders.global.childrenContainer;
                    
                    if (!isGlobal && portNode) {
                        const portTypeRaw = portNode.querySelector(":scope > TYPE");
                        const portType = portTypeRaw ? portTypeRaw.textContent.replace(/^e/, '') : "Port";
                        
                        const portPathIdx = path.lastIndexOf("PORT");
                        let portIndex = "0";
                        if (portPathIdx !== -1 && portPathIdx + 1 < path.length) {
                            if (!isNaN(parseInt(path[portPathIdx + 1]))) {
                                portIndex = path[portPathIdx + 1];
                            }
                        }
                        
                        const portKey = `${portType} [${portIndex}]`;
                        
                        if (!commonFolders.ports[portKey]) {
                            const f = createTreeItem(portKey, "folder", commonFolders.main.childrenContainer);
                            addExpandSubtreeBtn(f);
                            commonFolders.ports[portKey] = f;
                        }
                        targetContainer = commonFolders.ports[portKey].childrenContainer;
                    }

                    const cItem = createTreeItem(label, "leaf", targetContainer);
                    if (initialSet[devName] && initialSet[devName].has(valKey)) cItem.element.classList.add('diff-unchanged');
                    addActions(cItem, { type:'XmlMatch', device:devName, path:JSON.stringify(cleanPath), value:val }, val);
                }
            }
        }
    } else {
        const groups = {};
        children.forEach(c => { if(!groups[c.tagName]) groups[c.tagName]=[]; groups[c.tagName].push(c); });
        
        for(const [tag, nodes] of Object.entries(groups)) {
            nodes.forEach((child, idx) => {
                const label = nodes.length > 1 ? `${tag} [${idx}]` : tag;
                const branch = createTreeItem(label, "folder", container);
                if(nodes.length > 0 || child.children.length > 0 || child.hasAttributes()) addExpandSubtreeBtn(branch);
                
                const nextPath = [...path, tag];
                if (nodes.length > 1) {
                    nextPath.push(idx.toString());
                }
                
                parseXML(child, branch.childrenContainer, devName, nextPath, commonFolders);
            });
        }
    }
}

function createTreeItem(text, type, parent) {
    const div = document.createElement('div');
    div.className = `tree-item type-${type}`;
    div.dataset.searchText = text.toLowerCase();

    const row = document.createElement('div');
    row.className = 'tree-row';
    
    const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    row.innerHTML = `<span class="indicator"></span><span class="tree-text">${safeText}</span><div class="actions"></div>`;
    div.appendChild(row);

    const children = document.createElement('div');
    children.className = 'children';
    children.style.display = 'none';
    div.appendChild(children);

    row.onclick = (e) => {
        if(e.target.closest('.actions')) return; 
        if(children.hasChildNodes()) {
            const isHidden = children.style.display === 'none';
            children.style.display = isHidden ? 'block' : 'none';
            div.classList.toggle('expanded', isHidden);
        }
    };

    parent.appendChild(div);
    if(parent.classList.contains('children')) parent.parentElement.classList.add('has-children');
    return { element: div, childrenContainer: children, row: row };
}

function addExpandSubtreeBtn(uiObj) {
    const actionsDiv = uiObj.row.querySelector('.actions');
    const btn = document.createElement('span');
    btn.className = 'mini-btn';
    btn.innerText = '+';
    btn.title = "Expand Subtree";
    btn.onclick = () => {
        const expand = uiObj.childrenContainer.style.display === 'none';
        const toggle = (el, state) => {
            el.style.display = state ? 'block' : 'none';
            Array.from(el.children).forEach(child => {
                if(child.classList.contains('tree-item')) {
                    child.classList.toggle('expanded', state);
                    const subC = child.querySelector('.children');
                    if(subC) toggle(subC, state);
                }
            });
        };
        toggle(uiObj.childrenContainer, expand);
        uiObj.element.classList.toggle('expanded', expand);
        btn.innerText = expand ? '-' : '+';
    };
    actionsDiv.appendChild(btn);
}

function addActions(uiObj, checkData, rawValueForSearch) {
    const actionsDiv = uiObj.row.querySelector('.actions');
    const searchValue = rawValueForSearch || checkData.value;

    const revealBtn = document.createElement('span');
    revealBtn.className = 'mini-btn reveal-btn';
    revealBtn.innerText = '⌖';
    revealBtn.title = "Jump to location";
    revealBtn.style.display = 'none'; 
    revealBtn.onclick = () => revealInTree(uiObj);

    const viewBtn = document.createElement('span');
    viewBtn.className = 'mini-btn';
    viewBtn.innerText = '<>';
    viewBtn.title = "Find in Raw XML";
    viewBtn.onclick = () => jumpToRaw(searchValue);

    const addBtn = document.createElement('span');
    addBtn.className = 'mini-btn';
    addBtn.innerText = 'Add';
    addBtn.onclick = () => addCheck(checkData);
    
    actionsDiv.appendChild(revealBtn);
    actionsDiv.appendChild(viewBtn);
    actionsDiv.appendChild(addBtn);
}

function revealInTree(uiObj) {
    clearSearch();
    let par = uiObj.element.parentElement;
    while(par && par.id !== 'treeRoot') {
        if(par.classList.contains('children')) {
            par.style.display = 'block';
            par.parentElement.classList.add('expanded');
        }
        par = par.parentElement;
    }
    setTimeout(() => {
        uiObj.row.scrollIntoView({behavior: "smooth", block: "center"});
        uiObj.row.style.background = '#444';
        setTimeout(() => uiObj.row.style.background = '', 1500);
    }, 100);
}

function filterTree() {
    const query = document.getElementById('searchBox').value.toLowerCase();
    const items = document.querySelectorAll('.tree-item');
    document.getElementById('searchClear').style.display = query ? 'block' : 'none';
    const revealBtns = document.querySelectorAll('.reveal-btn');
    revealBtns.forEach(b => b.style.display = query ? 'inline-block' : 'none');

    if(!query) {
        items.forEach(el => {
            el.style.display = 'block';
            el.querySelector('.tree-row').classList.remove('search-match');
        });
        return;
    }

    items.forEach(el => {
        const text = el.dataset.searchText || "";
        const row = el.querySelector('.tree-row');
        el.style.display = 'none';
        row.classList.remove('search-match');

        if(text.includes(query)) {
            row.classList.add('search-match');
            el.style.display = 'block';
            let par = el.parentElement;
            while(par && par.id !== 'treeRoot') {
                if(par.classList.contains('tree-item')) par.style.display = 'block';
                if(par.classList.contains('children')) {
                    par.style.display = 'block';
                    par.parentElement.classList.add('expanded');
                }
                par = par.parentElement;
            }
        }
    });
}
function clearSearch() { document.getElementById('searchBox').value = ''; filterTree(); }
function expandAll(expand) {
    document.querySelectorAll('.children').forEach(el => el.style.display = expand ? 'block' : 'none');
    document.querySelectorAll('.tree-item').forEach(el => el.classList.toggle('expanded', expand));
}
function downloadXML() {
    const blob = new Blob([fullXmlText], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "decrypted_lab.xml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ================= SETTINGS EXPORT =================
function initLocks() {
    const grid = document.getElementById('lockGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    lockableFeatures.forEach(feat => {
        const lbl = document.createElement('label');
        lbl.className = 'custom-label';
        lbl.style.marginBottom = "5px";
        
        lbl.innerHTML = `<input type="checkbox" value="${feat}" class="lock-cb"><span class="checkmark"></span> <span style="margin-left: 5px">${feat}</span>`;
        grid.appendChild(lbl);
    });
}

function toggleAllLocks(check) {
    document.querySelectorAll('.lock-cb').forEach(cb => cb.checked = check);
}

function togglePkaTimerInput() {
    const mode = document.getElementById('pkaTimerMode').value;
    document.getElementById('pkaTimeLimitContainer').style.display = mode === "1" ? 'block' : 'none';
}

function readPKASettings(xml) {
    // Read Locks
    const lockRegex = /<NODE[^>]*on="(yes|no)"[^>]*>\s*<ID>([^<]+)<\/ID>/g;
    let match;
    const currentLocks = {};
    while ((match = lockRegex.exec(xml)) !== null) {
        currentLocks[match[2]] = (match[1] === "yes");
    }
    document.querySelectorAll('.lock-cb').forEach(cb => {
        if (currentLocks[cb.value] !== undefined) {
            cb.checked = currentLocks[cb.value];
        } else {
            cb.checked = false;
        }
    });

    // Read Timer settings
    const typeMatch = xml.match(/TIMERTYPE="([^"]*)"/);
    const timeMatch = xml.match(/COUNTDOWNMS="([^"]*)"/);
    
    const tMode = document.getElementById('pkaTimerMode');
    const tLimit = document.getElementById('pkaTimeLimit');
    
    if (typeMatch && typeMatch[1] === "1") {
        tMode.value = "1";
        if (timeMatch && !isNaN(timeMatch[1])) {
            tLimit.value = Math.floor(parseInt(timeMatch[1]) / 60000);
        }
    } else {
        tMode.value = "0";
        tLimit.value = "0";
    }
    togglePkaTimerInput();
}

async function replaceAnswerNetwork() {
    if (!fullXmlText) return alert("Please upload a PKA file first.");
    if (!confirm("Are you sure you want to replace the answer network with a blank network? This will remove all grading targets from the PKA file itself.")) return;
    
    const btn = document.getElementById('btnReplaceNetwork');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Processing... Please Wait";
    btn.disabled = true;

    try {
        const res = await fetch('/api/blank-network', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xml: fullXmlText })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed to process blank network");
        }
        
        const data = await res.json();
        fullXmlText = data.xml;
        
        updateLineNumbers();
        alert("Answer network successfully replaced with a blank network.");
        
        // Reparse tree
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(fullXmlText, "text/xml");
        const ptBlocks = xmlDoc.querySelectorAll("PACKETTRACER5");
        if(ptBlocks.length > 0) {
            parseDevices(ptBlocks[ptBlocks.length - 1]);
            const root = document.getElementById('treeRoot');
            Array.from(root.children).forEach(devNode => applyDiffVisibility(devNode));
        }
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function exportModifiedPKA() {
    if (!fullXmlText) return alert("Please upload a PKA file first.");
    
    const btn = document.getElementById('btnExportPka');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Encrypting... Please Wait";
    btn.disabled = true;

    const mode = document.getElementById('pkaTimerMode').value;
    const mins = parseInt(document.getElementById('pkaTimeLimit').value) || 0;
    const clearRecent = document.getElementById('pkaClearRecent').checked;
    const forceCompat = document.getElementById('pkaForceCompat').checked;
    
    const locks = [];
    const unlocks = [];
    document.querySelectorAll('.lock-cb').forEach(cb => {
        if (cb.checked) locks.push(cb.value);
        else unlocks.push(cb.value);
    });

    const payload = {
        xml: fullXmlText,
        timerType: parseInt(mode),
        timeMs: mins * 60 * 1000,
        locks: locks,
        unlocks: unlocks,
        clearRecent: clearRecent,
        forceCompat: forceCompat
    };

    try {
        const res = await fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            return alert("Export failed: " + err.error);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "configured_lab.pka";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (e) {
        alert("Export failed: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}