// ================= DATA STATE =================
let fullXmlText = "";
let currentMode = 'lab';

// Per-Lab defaults
let labs = [{
    id: "lab1",
    title: "Lab 1",
    show_score: true,
    show_msg: true,
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
    toggleHelp();
    renderLabSelector();
    renderChecks();
    initLocks();
    
    setupResizer('resizerH', 'leftPane', 'horizontal');
    setupResizer('resizerV', 'outputPane', 'vertical');
    setupResizer('resizerV2', 'quizOutputPane', 'vertical');
};

function switchMode(mode) {
    currentMode = mode;
    document.getElementById('modeLabBtn').className = mode === 'lab' ? 'btn btn-outline active' : 'btn btn-outline';
    document.getElementById('modeQuizBtn').className = mode === 'quiz' ? 'btn btn-outline active' : 'btn btn-outline';
    document.getElementById('modeSettingsBtn').className = mode === 'settings' ? 'btn btn-outline active' : 'btn btn-outline';
    
    document.getElementById('labSection').style.display = mode === 'lab' ? 'flex' : 'none';
    document.getElementById('quizSection').style.display = mode === 'quiz' ? 'flex' : 'none';
    document.getElementById('settingsSection').style.display = mode === 'settings' ? 'block' : 'none';
    
    document.getElementById('headerLabControls').style.display = mode === 'lab' ? 'flex' : 'none';
    document.getElementById('headerQuizControls').style.display = mode === 'quiz' ? 'flex' : 'none';
    document.getElementById('headerSettingsControls').style.display = mode === 'settings' ? 'flex' : 'none';
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
    
    document.getElementById('labMaxPka').value = l.max_upload_mb !== undefined ? l.max_upload_mb : 2;
    document.getElementById('labMaxXml').value = l.max_xml_output_mb !== undefined ? l.max_xml_output_mb : 25;
    document.getElementById('labMaxSub').value = l.max_submissions !== undefined ? l.max_submissions : 0;
    document.getElementById('labRateCount').value = l.rate_limit_count !== undefined ? l.rate_limit_count : 5;
    document.getElementById('labRateWin').value = l.rate_limit_window !== undefined ? l.rate_limit_window : 60;
    
    document.getElementById('labTime').value = l.time_limit_minutes !== undefined ? l.time_limit_minutes : 0;
    document.getElementById('labPkaFile').value = l.pka_file || "";

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
        show_score: true, show_msg: true, 
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
    
    l.max_upload_mb = parseInt(document.getElementById('labMaxPka').value) || 2;
    l.max_xml_output_mb = parseInt(document.getElementById('labMaxXml').value) || 25;
    l.max_submissions = parseInt(document.getElementById('labMaxSub').value) || 0;
    l.rate_limit_count = parseInt(document.getElementById('labRateCount').value) || 0;
    l.rate_limit_window = parseInt(document.getElementById('labRateWin').value) || 0;

    l.time_limit_minutes = parseInt(document.getElementById('labTime').value) || 0;
    l.pka_file = document.getElementById('labPkaFile').value.trim();

    const sel = document.getElementById('labSelector');
    if(sel.options[currentLabIdx]) sel.options[currentLabIdx].text = l.title;
    genLab();
}

function addCheck(data) {
    let defaultMsg = `Check ${data.value}`;
    if (defaultMsg.length > 40) defaultMsg = defaultMsg.substring(0, 40) + '...';
    labs[currentLabIdx].checks.push({ ...data, message: defaultMsg, points: 10, source: data.source || 'running' });
    renderChecks();
}

function addManualCheck() {
    labs[currentLabIdx].checks.push({
        device: "DeviceName",
        type: "ConfigMatch",
        message: "New Check",
        points: 5,
        value: "command",
        source: "running",
        context: "global"
    });
    renderChecks();
}

function renderChecks() {
    const list = document.getElementById('checksList');
    list.innerHTML = '';
    const currentChecks = labs[currentLabIdx].checks;
    document.getElementById('checkCount').innerText = currentChecks.length;

    currentChecks.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = 'check-card';
        const isXml = c.type.startsWith('Xml');
        const isType5 = c.type.startsWith('Type5Match');
        const typeColor = isXml ? '#66d9ef' : (isType5 ? '#ff66d9' : '#a6e22e');

        const types = [
            "ConfigMatch", "ConfigMatchNot", 
            "ConfigRegex", "ConfigRegexNot",
            "XmlMatch", "XmlMatchNot", 
            "XmlRegex", "XmlRegexNot",
            "Type5Match", "Type5MatchNot"
        ];
        
        let typeOpts = types.map(t => `<option value="${t}" ${c.type===t?'selected':''}>${t}</option>`).join('');
        let typeSelect = `<select class="field-input" style="width:auto; padding:1px;" onchange="updateCheck(${i}, 'type', this.value)">${typeOpts}</select>`;

        const isSourceVisible = !isXml;

        let valueSectionHtml = '';
        if (isType5) {
            valueSectionHtml = `
                <div class="settings-grid">
                    <div><label class="field-label">Mode</label>
                        <select class="field-input" onchange="updateCheck(${i}, 'mode', this.value)">
                            <option value="device" ${c.mode==='device'?'selected':''}>Device (enable secret)</option>
                            <option value="user" ${c.mode==='user'?'selected':''}>User (username secret)</option>
                        </select>
                    </div>
                    <div><label class="field-label">Plaintext Password</label><input class="field-input" value="${(c.password||'').replace(/"/g, '&quot;')}" oninput="updateCheck(${i}, 'password', this.value)"></div>
                </div>
                ${c.mode === 'user' ? `
                <div class="settings-grid">
                    <div><label class="field-label">Username</label><input class="field-input" value="${(c.username||'').replace(/"/g, '&quot;')}" oninput="updateCheck(${i}, 'username', this.value)"></div>
                    <div></div>
                </div>
                ` : ''}
            `;
        } else {
            valueSectionHtml = `
                <div><label class="field-label">Value</label><input class="field-input" value="${(c.value||'').replace(/"/g, '&quot;')}" oninput="updateCheck(${i}, 'value', this.value)"></div>
            `;
        }

        div.innerHTML = `
            <div class="check-header">
                <input class="field-input" style="width:120px; font-weight:bold; color:${typeColor}" value="${c.device}" oninput="updateCheck(${i}, 'device', this.value)">
                ${typeSelect}
                <span class="remove-x" onclick="removeCheck(${i})">×</span>
            </div>
            <div class="settings-grid">
                <div><label class="field-label">Message</label><input class="field-input" value="${c.message}" oninput="updateCheck(${i}, 'message', this.value)"></div>
                <div><label class="field-label">Points</label><input type="number" class="field-input" value="${c.points}" oninput="updateCheck(${i}, 'points', this.value)"></div>
            </div>
            
            ${isSourceVisible ? `
            <div class="settings-grid">
                <div><label class="field-label">Source</label>
                    <select class="field-input" onchange="updateCheck(${i}, 'source', this.value)">
                        <option value="running" ${c.source==='running'?'selected':''}>running</option>
                        <option value="startup" ${c.source==='startup'?'selected':''}>startup</option>
                    </select>
                </div>
                <div><label class="field-label">Context</label><input class="field-input" value="${c.context || 'global'}" oninput="updateCheck(${i}, 'context', this.value)"></div>
            </div>` : ''}

            ${valueSectionHtml}
        `;
        list.appendChild(div);
    });
    genLab();
}

function updateCheck(idx, key, val) {
    const c = labs[currentLabIdx].checks[idx];
    c[key] = val;
    if(key === 'type') {
        if (val.startsWith('Type5Match') && !c.mode) {
            c.mode = 'device';
            c.password = '';
            c.username = '';
        }
        renderChecks(); 
    } 
    else if (key === 'mode') {
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

function genLab() {
    let out = "";
    labs.forEach(l => {
        out += `[[labs]]\n`;
        out += `id = "${l.id}"\n`;
        out += `title = "${l.title}"\n`;
        out += `show_score = ${l.show_score}\n`;
        out += `show_check_messages = ${l.show_msg}\n`;
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
            out += `        [[labs.checks.pass]]\n        type = "${c.type}"\n`;
            
            if(c.type.startsWith('Xml')) {
                const pathArr = c.path ? JSON.parse(c.path).map(s => `"${s}"`).join(', ') : '';
                out += `        path = [${pathArr}]\n        value = "${c.value}"\n\n`;
            } else if (c.type.startsWith('Type5Match')) {
                out += `        source = "${c.source}"\n        context = "${c.context || 'global'}"\n`;
                out += `        mode = "${c.mode || 'device'}"\n`;
                if ((c.mode || 'device') === 'user') {
                    out += `        username = "${c.username || ''}"\n`;
                }
                out += `        password = "${(c.password || '').replace(/"/g, '\\"')}"\n\n`;
            } else {
                out += `        source = "${c.source}"\n        context = "${c.context}"\n        value = "${c.value.replace(/"/g, '\\"')}"\n\n`;
            }
        });
        out += "\n";
    });
    document.getElementById('labOutput').value = out;
}

// ================= QUIZ LOGIC =================
function addQuiz() {
    const newIdx = quizzes.length;
    quizzes.push({ id: `quiz${newIdx + 1}`, title: `Quiz ${newIdx + 1}`, enabled: true, show_score: true, show_correct: true, time: 15, attempts: 3, questions: [] });
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
    document.getElementById('qEnabled').checked = q.enabled;
    document.getElementById('qScore').checked = q.show_score;
    document.getElementById('qCorrect').checked = q.show_correct;
    renderQuestions();
    genQuiz();
}

function updateQuizMeta() {
    const q = quizzes[currentQuizIdx];
    q.id = document.getElementById('qId').value;
    q.title = document.getElementById('qTitle').value;
    q.time = parseInt(document.getElementById('qTime').value);
    q.attempts = parseInt(document.getElementById('qAtt').value);
    q.enabled = document.getElementById('qEnabled').checked;
    q.show_score = document.getElementById('qScore').checked;
    q.show_correct = document.getElementById('qCorrect').checked;
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
                <div><label class="field-label">Question Text</label><input class="field-input" value="${q.text}" oninput="updateQ(${i}, 'text', this.value)"></div>
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

            <div><label class="field-label">Explanation</label><input class="field-input" value="${q.explanation||''}" oninput="updateQ(${i}, 'explanation', this.value)"></div>
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
        container.innerHTML = `<div><label class="field-label">Regex Match</label><input class="field-input" value="${q.regex||''}" oninput="quizzes[currentQuizIdx].questions[${qIdx}].regex=this.value; genQuiz()"></div>`;
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
                <input class="field-input" placeholder="Left" value="${pair.left}" oninput="quizzes[currentQuizIdx].questions[${qIdx}].pairs[${pIdx}].left=this.value; genQuiz()" style="width:45%; margin-right:5px;">
                <span>=</span>
                <input class="field-input" placeholder="Right" value="${pair.right}" oninput="quizzes[currentQuizIdx].questions[${qIdx}].pairs[${pIdx}].right=this.value; genQuiz()" style="width:45%; margin-left:5px;">
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
            <div class="answer-text-col"><input type="text" value="${ans.text}" placeholder="Answer Option..." oninput="quizzes[currentQuizIdx].questions[${qIdx}].answers[${aIdx}].text=this.value; genQuiz()"></div>
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
        out += `[[quizzes]]\nid = "${q.id}"\ntitle = "${q.title}"\nenabled = ${q.enabled}\n`;
        out += `time_limit_minutes = ${q.time}\nmax_attempts = ${q.attempts}\nshow_score = ${q.show_score}\nshow_corrections = ${q.show_correct}\n\n`;
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
    document.getElementById('quizOutput').value = out;
}

// ================= RAW VIEW HIGHLIGHT & LINE NUMBERS =================
function updateLineNumbers(text) {
    const lines = text.split('\n').length;
    document.getElementById('lineNumbers').innerHTML = Array.from({length: lines}, (_, i) => i + 1).join('\n');
}

function jumpToRaw(text) {
    setTab('raw');
    const rawDiv = document.getElementById('rawContent');
    const originalText = fullXmlText;
    
    if (!originalText || !text) return;

    const index = originalText.indexOf(text);
    
    if (index !== -1) {
        const before = originalText.substring(0, index);
        const match = originalText.substring(index, index + text.length);
        const after = originalText.substring(index + text.length);
        
        const escapeHtml = (unsafe) => {
            return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        }

        rawDiv.innerHTML = escapeHtml(before) + 
                           '<span id="jumpTarget" class="highlight-flash">' + escapeHtml(match) + '</span>' + 
                           escapeHtml(after);

        const target = document.getElementById('jumpTarget');
        if(target) {
            target.scrollIntoView({behavior: "smooth", block: "center"});
            document.getElementById('rawBackBtn').style.display = 'block';
        }
    } else {
        alert("Exact match not found in Raw view.");
    }
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

function markEmptyFolders(container) {
    let allUnchanged = true;
    let hasItems = false;
    
    Array.from(container.children).forEach(child => {
        if (child.classList.contains('tree-item')) {
            hasItems = true;
            const isStructural = child.classList.contains('type-folder') || 
                                 child.classList.contains('type-block') || 
                                 child.classList.contains('type-device');
            
            const subC = child.querySelector('.children');
            
            let subUnchanged = true;
            let subHasItems = false;
            
            if (subC) {
                const result = markEmptyFolders(subC);
                subUnchanged = result.allUnchanged;
                subHasItems = result.hasItems;
            }
            
            if (isStructural) {
                // Determine if this structural element has any changes inside it.
                // If it has NO items inside, or ALL items are unchanged -> it is unchanged.
                if (!subHasItems || subUnchanged) {
                    child.classList.add('diff-unchanged');
                } else {
                    child.classList.remove('diff-unchanged');
                    allUnchanged = false;
                }
            } else {
                if (!child.classList.contains('diff-unchanged')) {
                    allUnchanged = false;
                }
            }
        }
    });
    
    return { allUnchanged, hasItems };
}

function getCheckDataForCommand(trimmed, devName, source, context) {
    // Look for: enable secret 5 $1$...
    const enableMatch = trimmed.match(/^enable\s+secret\s+5\s+(?:\$1\$[^\s]+)/i);
    if (enableMatch) {
        return { type:'Type5Match', mode:'device', password:'', device:devName, context:context, source:source, value:trimmed };
    }
    // Look for: username <name> [privilege x] secret 5 $1$...
    const userMatch = trimmed.match(/^username\s+(\S+)(?:\s+privilege\s+\d+)?\s+secret\s+5\s+(?:\$1\$[^\s]+)/i);
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
    document.getElementById('tab-tree').className = mode === 'tree' ? 'tab active' : 'tab';
    document.getElementById('tab-raw').className = mode === 'raw' ? 'tab active' : 'tab';
    if(mode === 'tree') document.getElementById('rawBackBtn').style.display = 'none';
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
        document.getElementById('rawContent').innerText = fullXmlText;
        updateLineNumbers(fullXmlText);
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
        markEmptyFolders(document.getElementById('treeRoot'));
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
        
        const devNode = createTreeItem(name, "device", root);

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
        parseXML(engine, hwFolder.childrenContainer, name, []);
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
                addActions(blockUI, checkData);
            } else {
                const cmdUI = createTreeItem(trimmed, "cmd", container);
                if (initialSet[devName] && initialSet[devName].has(`${source}::${trimmed}`)) {
                    cmdUI.element.classList.add('diff-unchanged');
                }
                
                const checkData = getCheckDataForCommand(trimmed, devName, source, 'global');
                addActions(cmdUI, checkData);
            }
        } else if (blockUI) {
            const trimmed = txt.trim();
            const cmdUI = createTreeItem(trimmed, "cmd", blockUI.childrenContainer);
            if (initialSet[devName] && initialSet[devName].has(`${source}::${trimmed}`)) {
                cmdUI.element.classList.add('diff-unchanged');
            }
            
            const checkData = getCheckDataForCommand(trimmed, devName, source, blockContext);
            addActions(cmdUI, checkData);
        }
    });
}

function parseXML(node, container, devName, path) {
    if(node.tagName === "RUNNINGCONFIG" || node.tagName === "STARTUPCONFIG") return;
    
    if (node.hasAttributes()) {
        for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i];
            const item = createTreeItem(`@${attr.name}: ${attr.value}`, "attr", container);
            const cleanPath = path.filter(p => p !== "ENGINE");
            cleanPath.push("$", attr.name);
            
            const attrKey = `attr::${cleanPath.join('.')}::${attr.name}::${attr.value}`;
            if (initialSet[devName] && initialSet[devName].has(attrKey)) item.element.classList.add('diff-unchanged');

            addActions(item, { type:'XmlMatch', device:devName, path:JSON.stringify(cleanPath), value:attr.value }, attr.value);
        }
    }

    const children = Array.from(node.children);
    if(children.length === 0) {
        const val = node.textContent;
        if(val && val.trim()) {
            const item = createTreeItem(`${node.tagName}: ${val}`, "leaf", container);
            const cleanPath = path.filter(p => p !== "ENGINE");
            
            const valKey = `xml::${cleanPath.join('.')}::${val.trim()}`;
            if (initialSet[devName] && initialSet[devName].has(valKey)) item.element.classList.add('diff-unchanged');

            addActions(item, { type:'XmlMatch', device:devName, path:JSON.stringify(cleanPath), value:val }, val);
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
                
                parseXML(child, branch.childrenContainer, devName, nextPath);
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
    row.innerHTML = `<span class="indicator"></span><span class="tree-text">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span><div class="actions"></div>`;
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

async function exportModifiedPKA() {
    if (!fullXmlText) return alert("Please upload a PKA file first.");
    
    const mode = document.getElementById('pkaTimerMode').value;
    const mins = parseInt(document.getElementById('pkaTimeLimit').value) || 0;
    const locks = Array.from(document.querySelectorAll('.lock-cb:checked')).map(cb => cb.value);

    const payload = {
        xml: fullXmlText,
        timerType: parseInt(mode),
        timeMs: mins * 60 * 1000,
        locks: locks
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
    }
}