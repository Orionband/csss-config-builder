let checks = [];
let fullXmlText = "";

// --- MODAL ---
function toggleHelp() {
    const m = document.getElementById('helpModal');
    m.style.display = (m.style.display === 'flex') ? 'none' : 'flex';
}
window.onload = () => toggleHelp();

// --- RESIZERS ---
setupResizer('resizerH', 'leftPane', 'horizontal');
setupResizer('resizerV', 'outputPane', 'vertical');

function setupResizer(resizerId, targetId, direction) {
    const resizer = document.getElementById(resizerId);
    const target = document.getElementById(targetId);
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
            const containerH = document.querySelector('.pane.right').clientHeight;
            const topOffset = document.querySelector('.pane.right').getBoundingClientRect().top;
            const h = containerH - (e.clientY - topOffset);
            if(h > 50 && h < containerH - 150) target.style.height = `${h}px`;
        }
    });
    document.addEventListener('mouseup', () => {
        if(isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
            resizer.classList.remove('active');
        }
    });
}

// --- TABS ---
function setTab(mode) {
    document.getElementById('view-tree').style.display = mode === 'tree' ? 'block' : 'none';
    document.getElementById('treeToolbar').style.display = mode === 'tree' ? 'flex' : 'none';
    document.getElementById('view-raw').style.display = mode === 'raw' ? 'block' : 'none';
    document.getElementById('tab-tree').className = mode === 'tree' ? 'tab active' : 'tab';
    document.getElementById('tab-raw').className = mode === 'raw' ? 'tab active' : 'tab';
    if(mode === 'tree') document.getElementById('rawBackBtn').style.display = 'none';
}

// --- UPLOAD & DECRYPT ---
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
        document.getElementById('dlBtn').disabled = false;

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(fullXmlText, "text/xml");
        
        const ptBlocks = xmlDoc.querySelectorAll("PACKETTRACER5");
        if(ptBlocks.length === 0) throw new Error("Invalid XML");
        
        const targetBlock = ptBlocks[ptBlocks.length - 1];
        document.getElementById('sourceBadge').className = "badge success";
        document.getElementById('sourceBadge').innerText = "Source: Answer Network";

        parseDevices(targetBlock);
    } catch (err) {
        alert(err.message);
        loader.innerText = "Error loading file.";
    } finally {
        loader.style.display = 'none';
    }
});

// --- PARSING ---
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

        // 1. RUNNING CONFIG
        const runConfig = engine.querySelector("RUNNINGCONFIG");
        if(runConfig) {
            const confFolder = createTreeItem("Running Config", "folder", devNode.childrenContainer);
            addExpandSubtreeBtn(confFolder);
            const lines = runConfig.querySelectorAll("LINE");
            parseIOS(lines, confFolder.childrenContainer, name, "running");
        }

        // 2. STARTUP CONFIG
        const startConfig = engine.querySelector("STARTUPCONFIG");
        if(startConfig) {
            const confFolder = createTreeItem("Startup Config", "folder", devNode.childrenContainer);
            addExpandSubtreeBtn(confFolder);
            const lines = startConfig.querySelectorAll("LINE");
            parseIOS(lines, confFolder.childrenContainer, name, "startup");
        }

        // 3. OTHER ATTRIBUTES
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
                addActions(blockUI, { type:'ConfigMatch', device:devName, context:'global', value:trimmed, source:source });
            } else {
                const cmdUI = createTreeItem(trimmed, "cmd", container);
                addActions(cmdUI, { type:'ConfigMatch', device:devName, context:'global', value:trimmed, source:source });
            }
        } else if (blockUI) {
            const trimmed = txt.trim();
            const cmdUI = createTreeItem(trimmed, "cmd", blockUI.childrenContainer);
            addActions(cmdUI, { type:'ConfigMatch', device:devName, context:blockContext, value:trimmed, source:source });
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
            addActions(item, { type:'XmlMatch', device:devName, path:JSON.stringify(cleanPath), value:attr.value }, attr.value);
        }
    }

    const children = Array.from(node.children);
    
    if(children.length === 0) {
        const val = node.textContent;
        if(val && val.trim()) {
            const item = createTreeItem(`${node.tagName}: ${val}`, "leaf", container);
            const cleanPath = path.filter(p => p !== "ENGINE");
            cleanPath.push(node.tagName, "0");
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
                parseXML(child, branch.childrenContainer, devName, [...path, tag, idx.toString()]);
            });
        }
    }
}

// --- UI HELPERS ---
function createTreeItem(text, type, parent) {
    const div = document.createElement('div');
    div.className = `tree-item type-${type}`;
    div.dataset.searchText = text.toLowerCase();

    const row = document.createElement('div');
    row.className = 'tree-row';
    row.innerHTML = `<span class="indicator"></span><span class="tree-text">${text}</span><div class="actions"></div>`;
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
    revealBtn.innerText = '👁️';
    revealBtn.title = "Reveal in Tree";
    revealBtn.style.display = 'none';
    revealBtn.onclick = () => revealInTree(uiObj);

    const addBtn = document.createElement('span');
    addBtn.className = 'mini-btn';
    addBtn.innerText = 'Add';
    addBtn.onclick = () => addCheck(checkData);
    
    const viewBtn = document.createElement('span');
    viewBtn.className = 'mini-btn';
    viewBtn.innerText = '<>';
    viewBtn.title = "Find in Raw XML";
    viewBtn.onclick = () => jumpToRaw(searchValue);

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

function jumpToRaw(text) {
    setTab('raw');
    const rawDiv = document.getElementById('rawContent');
    const content = rawDiv.innerText;
    const index = content.indexOf(text);
    
    if (index !== -1) {
        const lines = content.substring(0, index).split('\n').length;
        const lineHeight = 17.5; 
        const scrollPos = (lines * lineHeight) - 150; 
        document.getElementById('view-raw').scrollTop = scrollPos > 0 ? scrollPos : 0;
        document.getElementById('rawBackBtn').style.display = 'block';
    } else {
        alert("Exact match not found in Raw view.");
    }
}

function filterTree() {
    const query = document.getElementById('searchBox').value.toLowerCase();
    const items = document.querySelectorAll('.tree-item');
    const clearBtn = document.getElementById('searchClear');
    
    clearBtn.style.display = query ? 'block' : 'none';
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

function clearSearch() {
    document.getElementById('searchBox').value = '';
    filterTree();
}

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

function addCheck(data) {
    checks.push({ ...data, message: `Check ${data.value}`, points: 10, source: 'running' });
    renderChecks();
}

function renderChecks() {
    const list = document.getElementById('checksList');
    list.innerHTML = '';
    document.getElementById('checkCount').innerText = checks.length;

    checks.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = 'check-card';
        const typeColor = c.type === 'XmlMatch' ? '#66d9ef' : '#a6e22e';

        div.innerHTML = `
            <div class="check-header">
                <span>${c.device} <span style="color:${typeColor}; font-weight:normal;">(${c.type})</span></span>
                <span class="remove-x" style="cursor:pointer" onclick="checks.splice(${i},1);renderChecks()">×</span>
            </div>
            <div class="settings-grid">
                <div><label class="field-label">Message</label><input class="field-input" value="${c.message}" oninput="checks[${i}].message=this.value;gen()"></div>
                <div><label class="field-label">Points</label><input type="number" class="field-input" value="${c.points}" oninput="checks[${i}].points=this.value;gen()"></div>
            </div>
            <div><label class="field-label">Value</label><input class="field-input" value="${c.value.replace(/"/g, '&quot;')}" oninput="checks[${i}].value=this.value;gen()"></div>
        `;
        list.appendChild(div);
    });
    gen();
}

function gen() { generateTOML(); }

function generateTOML() {
    const title = document.getElementById('confTitle').value;
    const maxSub = document.getElementById('confMaxSub').value;
    const rateCount = document.getElementById('confRateCount').value;
    const rateWin = document.getElementById('confRateWin').value;
    
    const showMsg = document.getElementById('confShowMsg').checked;
    const showScore = document.getElementById('confShowScore').checked;
    const retainPka = document.getElementById('confRetainPka').checked;
    const retainXml = document.getElementById('confRetainXml').checked;

    let out = `title = "${title}"\n\n`;
    out += `[options]\nshow_check_messages = ${showMsg}\nshow_score = ${showScore}\nretain_pka = ${retainPka}\nretain_xml = ${retainXml}\n`;
    out += `max_submissions = ${maxSub}\nrate_limit_count = ${rateCount}\nrate_limit_window_seconds = ${rateWin}\n\n`;

    checks.forEach(c => {
        out += `[[check]]\nmessage = "${c.message}"\npoints = ${c.points}\ndevice = "${c.device}"\n`;
        out += `    [[check.pass]]\n    type = "${c.type}"\n`;
        if(c.type === 'XmlMatch') {
            const pathArr = JSON.parse(c.path).map(s => `"${s}"`).join(', ');
            out += `    path = [${pathArr}]\n    value = "${c.value}"\n\n`;
        } else {
            out += `    source = "${c.source}"\n    context = "${c.context}"\n    value = "${c.value.replace(/"/g, '\\"')}"\n\n`;
        }
    });

    document.getElementById('tomlOutput').value = out;
}

function copyToClipboard() {
    const copyText = document.getElementById("tomlOutput");
    copyText.select();
    document.execCommand("copy");
    alert("Copied!");
}

gen();
