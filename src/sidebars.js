// ═══ LEFT SIDEBAR: Files + Variables ════════════════════════════════════
let sbActiveTab = 'vars';

function initLeftSidebar(){
  document.getElementById('sbTabFiles')?.addEventListener('click', ()=>setSbTab('files'));
  document.getElementById('sbTabVars')?.addEventListener('click', ()=>setSbTab('vars'));

  // ── Global data-tip tooltips — delegated so dynamic elements (e.g. plot toolbar buttons) work ──
  const sbTip = document.createElement('div');
  sbTip.id = '_sbTabTip';
  document.body.appendChild(sbTip);
  const _showTip = el=>{
    if(el.dataset.tipHtml) sbTip.innerHTML = el.dataset.tipHtml;
    else sbTip.textContent = el.dataset.tip;
    sbTip.style.opacity = '0';
    sbTip.style.display = 'block';
    const r = el.getBoundingClientRect();
    const tipW = sbTip.offsetWidth, tipH = sbTip.offsetHeight;
    let left = r.left + r.width / 2 - tipW / 2;
    let top  = r.bottom + 6;
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
    if(top + tipH > window.innerHeight - 8) top = r.top - tipH - 6;
    sbTip.style.left = left + 'px';
    sbTip.style.top  = top  + 'px';
    sbTip.style.opacity = '1';
  };
  document.addEventListener('mouseover', e=>{
    const el = e.target.closest('[data-tip],[data-tip-html]');
    if(el) _showTip(el);
  });
  document.addEventListener('mouseout', e=>{
    if(e.target.closest('[data-tip],[data-tip-html]')) sbTip.style.opacity = '0';
  });
  document.getElementById('varsAddBtn')?.addEventListener('click', e=>{ e.stopPropagation(); showVarTypePicker('global'); });
  document.getElementById('varsAddLocalBtn')?.addEventListener('click', e=>{
    e.stopPropagation();
    showVarTypePicker(typeof activeTabId !== 'undefined' ? activeTabId : 'global');
  });
  document.addEventListener('click', ()=>hideVarTypePicker());

  // ── Global drag-and-drop file import ────────────────────────────────────
  const overlay = document.getElementById('globalDropOverlay');
  let _dndDepth = 0; // counter to handle enter/leave on child elements

  document.addEventListener('dragenter', e=>{
    if(!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    _dndDepth++;
    if(overlay && _dndDepth === 1) overlay.style.display = 'flex';
  });
  document.addEventListener('dragleave', ()=>{
    _dndDepth = Math.max(0, _dndDepth - 1);
    if(overlay && _dndDepth === 0) overlay.style.display = 'none';
  });
  document.addEventListener('dragover', e=>{ e.preventDefault(); });
  document.addEventListener('drop', e=>{
    e.preventDefault();
    _dndDepth = 0;
    if(overlay) overlay.style.display = 'none';
    if(e.dataTransfer?.files?.length) handleFilesDrop(e.dataTransfer.files);
  });
}

// ═══ RESIZABLE SIDEBARS ══════════════════════════════════════════════════
function initResizableSidebars(){
  makeResizable('leftSidebar',  260, 208, 520, 'right', '--sidebar');
  makeResizable('cfgPanel',     268, 214, 536, 'left',  '--cfg');
}

function makeResizable(elId, defaultPx, minPx, maxPx, edge, cssVar){
  const el = document.getElementById(elId); if(!el) return;

  // Collapse threshold: if dragged below minPx - 40px, snap to collapsed
  const COLLAPSE_THRESHOLD = minPx - 40;
  let collapsed = false;
  let lastExpandedW = defaultPx;

  // Resize handle
  const handle = document.createElement('div');
  handle.className = 'resize-handle resize-handle-' + edge;
  el.appendChild(handle);

  // Expand button (shown only when collapsed)
  const expandBtn = document.createElement('button');
  expandBtn.className = `sidebar-expand-btn sidebar-expand-${edge}`;
  expandBtn.innerHTML = edge === 'right' ? '&#8250;' : '&#8249;'; // › or ‹
  expandBtn.title = 'Expand sidebar';
  expandBtn.style.display = 'none';
  document.body.appendChild(expandBtn);

  function setCollapsed(val){
    collapsed = val;
    el.classList.toggle('sidebar-collapsed', collapsed);
    expandBtn.style.display = collapsed ? 'flex' : 'none';
    if(collapsed){
      document.documentElement.style.setProperty(cssVar, '0px');
    }
  }

  function expand(){
    setCollapsed(false);
    document.documentElement.style.setProperty(cssVar, lastExpandedW + 'px');
  }

  expandBtn.addEventListener('click', expand);

  let dragging = false, startX = 0, startW = 0;
  handle.addEventListener('mousedown', e=>{
    e.preventDefault(); dragging = true; startX = e.clientX;
    startW = collapsed ? lastExpandedW : el.offsetWidth;
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', e=>{
    if(!dragging) return;
    const delta = edge === 'right' ? (e.clientX - startX) : (startX - e.clientX);
    const raw = startW + delta;
    if(raw < COLLAPSE_THRESHOLD){
      // Snap to collapsed
      if(!collapsed) setCollapsed(true);
    } else {
      if(collapsed) setCollapsed(false);
      const newW = Math.max(minPx, Math.min(maxPx, raw));
      lastExpandedW = newW;
      document.documentElement.style.setProperty(cssVar, newW + 'px');
    }
  });
  window.addEventListener('mouseup', ()=>{
    if(!dragging) return;
    dragging = false; document.body.style.cursor = ''; document.body.style.userSelect = '';
  });
}

function setSbTab(tab){
  sbActiveTab = tab;
  document.getElementById('sbTabFiles')?.classList.toggle('sidebar-tab-active', tab==='files');
  document.getElementById('sbTabVars')?.classList.toggle('sidebar-tab-active', tab==='vars');
  const pf = document.getElementById('sbPaneFiles'); if(pf) pf.style.display = tab==='files' ? 'flex' : 'none';
  const pv = document.getElementById('sbPaneVars');  if(pv) pv.style.display  = tab==='vars'  ? 'flex' : 'none';
  const shown = tab === 'files' ? pf : pv;
  if(shown && typeof MQ !== 'undefined' && MQ) requestAnimationFrame(()=>{
    shown.querySelectorAll('[id^="vmq_"]').forEach(el=>{
      try{ MQ.MathField(el).reflow(); }catch(e){}
    });
  });
}

// ═══ FILES TAB ═══════════════════════════════════════════════════════════
let uploadedFiles = [];

function handleFilesDrop(fileList){
  const files = Array.from(fileList);

  // Workspace files take priority — route to load confirmation, ignore any other
  // files dropped at the same time to avoid partial side-effects.
  const workspaceFile = files.find(f => f.name.toLowerCase().endsWith('.plotforge'));
  if(workspaceFile){ _showWorkspaceConfirm(workspaceFile); return; }

  for(const f of files){
    const ext = f.name.split('.').pop().toLowerCase();
    const isImportable = ext === 'pkl' || ext === 'json' || ext === 'csv';
    const existingIdx = uploadedFiles.findIndex(u => u.name === f.name);
    const isOverwrite = existingIdx !== -1 && isImportable;

    // Exact duplicate (same name + same size, non-importable) — skip silently
    if(existingIdx !== -1 && !isImportable && uploadedFiles[existingIdx].size === f.size) continue;

    if(existingIdx !== -1){
      uploadedFiles[existingIdx] = f; // replace file entry regardless
    } else {
      uploadedFiles.push(f);
    }

    if(ext === 'pkl')        uploadPickleFile(f, null, isOverwrite);
    else if(isImportable && typeof importDataFile === 'function') importDataFile(f, null, isOverwrite);
  }
  renderFilesList();
}

// ─── Workspace load confirmation modal ───────────────────────────────────

function _buildWorkspaceConfirmModal(){
  if(document.getElementById('ws-confirm-modal')) return;
  const el = document.createElement('div');
  el.id = 'ws-confirm-modal';
  el.className = 'ws-modal-backdrop';
  el.innerHTML = `
    <div class="ws-modal">
      <div class="ws-modal-title">Load Workspace</div>
      <div class="ws-modal-body">
        <p class="ws-modal-msg">Replace current workspace with the loaded file?</p>
        <p class="ws-modal-filename" id="wsModalFilename"></p>
      </div>
      <div class="ws-modal-footer">
        <button class="cbtn ws-btn-cancel" id="wsModalCancel">Cancel</button>
        <button class="cbtn ws-btn-confirm" id="wsModalConfirm">Replace</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  document.getElementById('wsModalCancel').addEventListener('click', _closeWorkspaceConfirm);
  el.addEventListener('click', e=>{ if(e.target === el) _closeWorkspaceConfirm(); });
  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape' && document.getElementById('ws-confirm-modal')?.classList.contains('open'))
      _closeWorkspaceConfirm();
  });
}

function _showWorkspaceConfirm(file){
  _buildWorkspaceConfirmModal();
  const filenameEl = document.getElementById('wsModalFilename');
  if(filenameEl) filenameEl.textContent = file.name;
  document.getElementById('ws-confirm-modal').classList.add('open');

  // Re-assign onclick each time so it captures the correct file reference
  document.getElementById('wsModalConfirm').onclick = ()=>{
    _closeWorkspaceConfirm();
    if(typeof loadWorkspace === 'function') loadWorkspace(file);
  };
}

function _closeWorkspaceConfirm(){
  document.getElementById('ws-confirm-modal')?.classList.remove('open');
}

function renderFilesList(){
  const list = document.getElementById('filesList'); if(!list) return;
  list.innerHTML = '';
  uploadedFiles.forEach((f,i)=>{
    const item = document.createElement('div'); item.className = 'file-item';
    const ext = f.name.split('.').pop().toLowerCase();
    const isPkl = ext === 'pkl';
    const icon = isPkl ? '🥒'
      : ext==='csv'?'&#x1F4CA;':ext==='json'?'{}':ext==='txt'?'&#x1F4C4;':ext==='py'?'&#x1F40D;':'&#x1F4C1;';
    const kb = f.size<1024 ? f.size+'B' : f.size<1048576 ? (f.size/1024).toFixed(1)+'KB' : (f.size/1048576).toFixed(1)+'MB';
    const isImportable = isPkl || ext === 'json' || ext === 'csv';
    const statusBadge = isImportable
      ? `<span class="file-pkl-badge" id="pkl-badge-${i}">→ vars</span>`
      : '';
    item.innerHTML = `<span class="file-item-icon">${icon}</span><span class="file-item-name" title="${f.name}">${f.name}</span>${statusBadge}<span class="file-item-size">${kb}</span><button class="file-item-del" data-idx="${i}">&#10005;</button>`;

    // Delete: also remove any variables sourced from this file
    item.querySelector('.file-item-del').addEventListener('click', e=>{
      e.stopPropagation();
      const removed = uploadedFiles.splice(parseInt(e.currentTarget.dataset.idx), 1);
      if(removed.length && typeof removeVariablesBySource === 'function'){
        removeVariablesBySource(removed[0].name);
      }
      renderFilesList();
    });

    // Re-import on badge click for pkl, json, csv
    if(isImportable){
      const badge = item.querySelector(`#pkl-badge-${i}`);
      if(badge){
        badge.style.cursor = 'pointer';
        badge.title = 'Click to re-import as variables';
        badge.addEventListener('click', e=>{
          e.stopPropagation();
          if(isPkl) uploadPickleFile(f, badge);
          else importDataFile(f, badge, true);
        });
      }
    }
    list.appendChild(item);
  });
}

// Send a .pkl file to the backend, parse it, show a confirmation modal, then import.
// badgeEl: the "→ vars" badge element to update; falls back to a DOM query if null.
async function uploadPickleFile(f, badgeEl, isOverwrite=false){
  const badge = badgeEl || document.querySelector(`[title="${f.name}"]`)?.closest('.file-item')?.querySelector('.file-pkl-badge');
  const setBadge = (text, cls) => {
    if(badge){ badge.textContent = text; badge.className = 'file-pkl-badge' + (cls ? ' '+cls : ''); }
  };
  setBadge('loading…', 'pkl-loading');
  try{
    const formData = new FormData();
    formData.append('file', f);
    const res = await fetch(`${API}/unpickle`, { method:'POST', body:formData });
    const data = await res.json();
    if(data.error){
      setBadge('error', 'pkl-error');
      if(badge) badge.title = data.error;
      console.warn('Pickle import error:', data.error);
      return;
    }
    // Show confirmation modal before importing
    showPickleConfirmModal(f.name, data.variables, scope=>{
      importPickleVars(data.variables, f.name, scope);
      const count = Object.keys(data.variables).length;
      setBadge(`✓ ${count} var${count!==1?'s':''}`, 'pkl-ok');
    }, ()=>{
      setBadge('→ vars', ''); // cancelled — reset badge
    }, isOverwrite);
  }catch(e){
    setBadge('error', 'pkl-error');
    console.warn('Pickle upload failed:', e);
  }
}

// Render a preview modal of the variables about to be imported, then call onConfirm(scope) or onCancel.
// isOverwrite=true shows a warning banner when the file was already imported.
function showPickleConfirmModal(filename, varsData, onConfirm, onCancel, isOverwrite=false){
  const backdrop = document.createElement('div');
  backdrop.className = 'pkl-modal-backdrop';

  const shortName = filename.length > 28 ? '…' + filename.slice(-26) : filename;
  const varEntries = Object.entries(varsData);

  let varRowsHTML = '';
  for(const [name, info] of varEntries){
    const kindCls = info.kind === 'constant' ? 'kind-constant' : 'kind-list';
    const kindLabel = info.kind === 'constant' ? 'Const' : 'List';
    let preview = '';
    if(info.kind === 'constant'){
      preview = String(info.value);
    } else if(info.kind === 'list'){
      const items = info.items || [];
      if(items.length <= 4){
        preview = '[' + items.map(x=>parseFloat(x.toPrecision(4))).join(', ') + ']';
      } else {
        preview = `[${parseFloat(items[0].toPrecision(3))}, …, ${parseFloat(items[items.length-1].toPrecision(3))}]  (${items.length})`;
      }
    }
    varRowsHTML += `
      <div class="pkl-modal-var-row">
        <span class="pkl-modal-var-name">${name}</span>
        <span class="pkl-modal-var-type ${kindCls}">${kindLabel}</span>
        <span class="pkl-modal-var-preview">${preview}</span>
      </div>`;
  }

  // Build scope options: Global + one entry per tab (local)
  const scopeTabs = (typeof tabs !== 'undefined') ? tabs : [];
  const scopeOptionsHTML = [
    `<option value="global">Global Vars</option>`,
    ...scopeTabs.map(t => `<option value="${t.id}">${t.name} (Local)</option>`),
  ].join('');

  const overwriteBanner = isOverwrite ? `
    <div class="pkl-overwrite-banner">
      ⚠ <strong>${shortName}</strong> was already imported — confirming will replace its existing variables.
    </div>` : '';

  backdrop.innerHTML = `
    <div class="pkl-modal">
      <div class="pkl-modal-header">
        <div class="pkl-modal-title">${isOverwrite ? 'Re-import variables?' : 'Import variables from file?'}</div>
        <div class="pkl-modal-subtitle">${shortName} · ${varEntries.length} variable${varEntries.length!==1?'s':''}</div>
      </div>
      ${overwriteBanner}
      <div class="pkl-modal-varlist">${varRowsHTML}</div>
      <div class="pkl-modal-scope-row">
        <label class="pkl-scope-label" for="pklScopeSelect">Import into:</label>
        <select class="pkl-scope-select" id="pklScopeSelect">${scopeOptionsHTML}</select>
      </div>
      <div class="pkl-modal-footer">
        <button class="pkl-modal-btn cancel" id="pklCancel">Cancel</button>
        <button class="pkl-modal-btn confirm" id="pklConfirm">${isOverwrite ? 'Overwrite' : 'Import all'}</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  // HTML select always returns strings; tab IDs are numbers — coerce back.
  const getScope = () => {
    const val = backdrop.querySelector('#pklScopeSelect')?.value ?? 'global';
    if(val === 'global') return 'global';
    const num = Number(val);
    return isNaN(num) ? val : num;
  };

  backdrop.querySelector('#pklCancel').addEventListener('click', ()=>{ close(); onCancel?.(); });
  backdrop.querySelector('#pklConfirm').addEventListener('click', ()=>{
    const scope = getScope();
    if(isOverwrite && typeof removeVariablesBySource === 'function'){
      removeVariablesBySource(filename);
    }
    close(); onConfirm?.(scope);
  });
  backdrop.addEventListener('click', e=>{ if(e.target === backdrop){ close(); onCancel?.(); } });
  const onKey = e=>{ if(e.key==='Escape'){ close(); onCancel?.(); document.removeEventListener('keydown',onKey); } };
  document.addEventListener('keydown', onKey);
}
// ═══ JSON / CSV CLIENT-SIDE IMPORT ═══════════════════════════════════════
// Parse JSON text into a variables dict. Accepts an object or an array of objects.
// Numeric values become 'constant'; numeric arrays become 'list'.
function parseJsonVars(text){
  let parsed;
  try{ parsed = JSON.parse(text); }
  catch(e){ return {error: `Invalid JSON: ${e.message}`}; }

  const result = {};

  if(Array.isArray(parsed)){
    if(!parsed.length) return {error: 'JSON array is empty'};
    if(typeof parsed[0] !== 'object' || parsed[0] === null)
      return {error: 'JSON top-level array must contain objects'};
    const keys = Object.keys(parsed[0]);
    for(const k of keys){
      const items = [];
      for(const row of parsed){
        const v = parseFloat(row[k]);
        if(isNaN(v)) break;
        items.push(v);
      }
      if(items.length === parsed.length){
        result[k] = items.length === 1
          ? {kind:'constant', value:items[0]}
          : {kind:'list', items};
      }
    }
  } else if(typeof parsed === 'object' && parsed !== null){
    for(const [k, v] of Object.entries(parsed)){
      if(typeof v === 'number' && isFinite(v)){
        result[k] = {kind:'constant', value:v};
      } else if(Array.isArray(v)){
        try{
          const items = v.map(x=>{ const n=parseFloat(x); if(isNaN(n)) throw 0; return n; });
          result[k] = items.length === 1
            ? {kind:'constant', value:items[0]}
            : {kind:'list', items};
        }catch{ /* skip non-numeric arrays */ }
      }
    }
  } else {
    return {error: 'JSON must be an object or array of objects'};
  }

  if(!Object.keys(result).length) return {error: 'No numeric values found in JSON'};
  return {variables: result};
}

// Parse CSV text into a variables dict. Header row provides names;
// columns with all-numeric values become 'list' (or 'constant' if length 1).
function parseCsvVars(text){
  const lines = text.trim().split(/\r?\n/).filter(l=>l.trim());
  if(lines.length < 2) return {error: 'CSV must have a header row and at least one data row'};

  const splitRow = row => {
    const cells = []; let cur = '', inQ = false;
    for(const ch of row){
      if(ch === '"'){ inQ = !inQ; }
      else if(ch === ',' && !inQ){ cells.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cells.push(cur.trim());
    return cells;
  };

  const headers = splitRow(lines[0]).map(h=>h.replace(/^"|"$/g,'').trim());
  const numCols = headers.map(()=>[]);  // parsed floats (null when non-numeric)
  const rawCols = headers.map(()=>[]);  // raw trimmed strings

  for(let r = 1; r < lines.length; r++){
    const cells = splitRow(lines[r]);
    for(let c = 0; c < headers.length; c++){
      const raw = (cells[c] || '').replace(/^"|"$/g,'').trim();
      rawCols[c].push(raw);
      const num = raw !== '' ? Number(raw) : NaN;   // strict: "21 Savage" → NaN, not 21
      numCols[c].push(isNaN(num) ? null : num);
    }
  }

  const _naLike = s => s==='' || s.toLowerCase()==='null' || s.toLowerCase()==='na' || s.toLowerCase()==='nan';

  const result = {};
  for(let c = 0; c < headers.length; c++){
    const name = headers[c]; if(!name) continue;
    const numItems = numCols[c].filter(v => v !== null);
    const nonEmpty = rawCols[c].filter(s => !_naLike(s));
    const numRatio = nonEmpty.length > 0 ? numItems.length / nonEmpty.length : 0;

    if (numRatio >= 0.9) {
      // Numeric column — ≥90% of non-empty values parsed as pure numbers
      if (!numItems.length) continue;
      result[name] = numItems.length === 1
        ? {kind:'constant', value:numItems[0]}
        : {kind:'list', items:numItems};
    } else {
      // Categorical column — store frequency counts
      if (!nonEmpty.length) continue;
      const counts = {};
      for (const s of nonEmpty) counts[s] = (counts[s]||0) + 1;
      const labels = Object.keys(counts).sort((a,b) => counts[b]-counts[a]);
      result[name] = {kind:'list', items:labels.map(l=>counts[l]), _labels:labels, _categorical:true};
    }
  }

  if(!Object.keys(result).length) return {error: 'No numeric or categorical columns found in CSV'};
  return {variables: result};
}

function importDataFile(f, badgeEl, isOverwrite=false){
  const fileIdx = uploadedFiles.indexOf(f);
  const badge = badgeEl || document.querySelector(`#pkl-badge-${fileIdx}`);
  const setBadge = (text, cls) => {
    if(badge){ badge.textContent = text; badge.className = 'file-pkl-badge' + (cls ? ' '+cls : ''); }
  };
  setBadge('loading…', 'pkl-loading');

  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const ext = f.name.split('.').pop().toLowerCase();
    const parsed = ext === 'json' ? parseJsonVars(text) : parseCsvVars(text);
    if(parsed.error){
      setBadge('error', 'pkl-error');
      if(badge) badge.title = parsed.error;
      console.warn('Import error:', parsed.error);
      return;
    }
    showPickleConfirmModal(f.name, parsed.variables, scope=>{
      importPickleVars(parsed.variables, f.name, scope);
      const count = Object.keys(parsed.variables).length;
      setBadge(`✓ ${count} var${count!==1?'s':''}`, 'pkl-ok');
    }, ()=>{
      setBadge('→ vars', '');
    }, isOverwrite);
  };
  reader.onerror = () => {
    setBadge('error', 'pkl-error');
    console.warn('FileReader error for', f.name);
  };
  reader.readAsText(f);
}

// ═══ RIGHT SIDEBAR: CFG PANEL ════════════════════════════════════════════
let cfgActiveTab = 'plot';

function setCfgTab(tab){
  cfgActiveTab = tab;
  document.getElementById('cfgTabPlot')?.classList.toggle('cfg-tab-active', tab==='plot');
  document.getElementById('cfgTabLine')?.classList.toggle('cfg-tab-active', tab==='line');
  document.getElementById('cfgPanePlot')?.style.setProperty('display', tab==='plot'?'flex':'none');
  document.getElementById('cfgPaneLine')?.style.setProperty('display', tab==='line'?'flex':'none');
}

// Format a domain boundary value for display (5 sig-figs, empty string for null/Infinity).
function fmtDomain(v){ if(v==null||!isFinite(v)) return ''; return parseFloat(v.toPrecision(5)).toString(); }

function getEffectiveDomain(pid){
  const p = gp(pid); if(!p) return {xMin:0,xMax:1,yMin:0,yMax:1};
  const v = p.view;
  if(v.x_min!=null && v.x_max!=null && v.y_min!=null && v.y_max!=null)
    return {xMin:v.x_min, xMax:v.x_max, yMin:v.y_min, yMax:v.y_max};
  if(p.curves[0]?.template){
    const res = evalTemplate(p.curves[0].template, p.curves[0].params, {});
    if(res){ const yp=(res.autoYMax-res.autoYMin)*0.08||0.1; return {xMin:res.autoXMin,xMax:res.autoXMax,yMin:res.autoYMin-yp,yMax:res.autoYMax+yp}; }
  }
  return {xMin:0,xMax:1,yMin:0,yMax:1};
}

function refreshLineCurveSelector(){
  const container = document.getElementById('lineCurveSelector'); if(!container) return;
  const p = activePlot();
  const hasAnyCurve = p && p.curves.some(c=>c.template || c.jsData);
  if(!p || !hasAnyCurve){ container.innerHTML=''; container.style.display='none'; return; }
  container.style.display = 'flex'; container.innerHTML = '';

  let dragSrcIdx = null;

  p.curves.forEach((curve, idx)=>{
    if(!curve.template && !curve.jsData) return;
    const label = curve.name
      || (curve.template ? (TEMPLATES[curve.template]?.label || `Curve ${idx+1}`) : `List ${idx+1}`);

    const pill = document.createElement('div');
    pill.className = 'curve-pill' + (idx===activeCurveIdx ? ' curve-pill-active' : '');
    pill.dataset.idx = idx;
    pill.draggable = true;

    const handle = document.createElement('span');
    handle.className = 'pill-drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Drag to reorder';

    const symWrap = document.createElement('span');
    symWrap.className = 'pill-sym';
    symWrap.innerHTML = makeCurveSymbolSVG(curve, 28, 10);

    const autoName = curve.template
      ? (TEMPLATES[curve.template]?.label || `Curve ${idx+1}`)
      : (curve.name || `${curve.listYName||'y'} vs ${curve.listXName||'x'}`);
    const nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.className = 'pill-name-inp';
    nameInp.value = curve.name || autoName;
    nameInp.maxLength = 40;

    let nameOnFocus = '';
    nameInp.addEventListener('focus', ()=>{ nameOnFocus = nameInp.value; });
    nameInp.addEventListener('click', e=>e.stopPropagation());
    nameInp.addEventListener('input', ()=>{
      curve.name = nameInp.value || autoName;
      refreshOverlayLegend(p.id);
    });
    nameInp.addEventListener('blur', ()=>{
      if(!nameInp.value.trim()){
        const fallback = nameOnFocus.trim() || autoName;
        nameInp.value = fallback; curve.name = fallback;
        refreshOverlayLegend(p.id);
      } else { curve.name = nameInp.value; }
    });
    nameInp.addEventListener('keydown', e=>{ if(e.key==='Enter') nameInp.blur(); e.stopPropagation(); });

    const delBtn = document.createElement('button');
    delBtn.className = 'pill-del-btn';
    delBtn.textContent = '✕';
    delBtn.title = 'Remove curve';
    delBtn.addEventListener('click', e=>{
      e.stopPropagation();
      const ap = activePlot(); if(!ap) return;
      removeCurve(ap.id, idx);
    });

    pill.appendChild(handle);
    pill.appendChild(symWrap);
    pill.appendChild(nameInp);
    pill.appendChild(delBtn);

    pill.addEventListener('click', e=>{
      if(e.target === handle || e.target === nameInp || e.target === delBtn) return;
      activeCurveIdx = idx; refreshLineCurveSelector(); refreshCfg();
    });

    pill.addEventListener('dragstart', e=>{
      dragSrcIdx = idx; e.dataTransfer.effectAllowed = 'move';
      setTimeout(()=>pill.style.opacity='0.4', 0);
    });
    pill.addEventListener('dragend', ()=>{
      pill.style.opacity='';
      container.querySelectorAll('.curve-pill').forEach(p=>p.classList.remove('drag-over'));
    });
    pill.addEventListener('dragover', e=>{
      e.preventDefault(); e.dataTransfer.dropEffect='move';
      pill.classList.add('drag-over');
    });
    pill.addEventListener('dragleave', ()=>pill.classList.remove('drag-over'));
    pill.addEventListener('drop', e=>{
      e.preventDefault();
      pill.classList.remove('drag-over');
      const destIdx = parseInt(pill.dataset.idx);
      if(dragSrcIdx === null || dragSrcIdx === destIdx) return;
      const ap = activePlot(); if(!ap) return;
      const [moved] = ap.curves.splice(dragSrcIdx, 1);
      ap.curves.splice(destIdx, 0, moved);
      if(activeCurveIdx === dragSrcIdx) activeCurveIdx = destIdx;
      else if(activeCurveIdx > dragSrcIdx && activeCurveIdx <= destIdx) activeCurveIdx--;
      else if(activeCurveIdx < dragSrcIdx && activeCurveIdx >= destIdx) activeCurveIdx++;
      dragSrcIdx = null;
      refreshLineCurveSelector();
      if(ap.mplMode){ clearTimeout(window._mplDebounce); window._mplDebounce=setTimeout(()=>convertToMpl(ap.id),350); }
      else if(ap.curves.some(c=>c.jsData)){ destroyChart(ap.id); renderJS(ap.id, false); }
      else { refreshOverlayLegend(ap.id); }
    });

    container.appendChild(pill);
  });
}

function refreshCfg(){
  const empty=document.getElementById('cfgEmpty'), content=document.getElementById('cfgContent');
  const p = activePid!==null ? gp(activePid) : null;
  if(!p){ empty.style.display='flex'; content.style.display='none'; return; }
  empty.style.display='none'; content.style.display='flex';
  setCfgTab(cfgActiveTab);
  syncCfgDomain();
  const v = p.view;
  renderPresetList();
  sv('c_galpha', v.grid_alpha ?? 0.5);
  document.getElementById('c_galpha_val').textContent = Math.round((v.grid_alpha ?? 0.5)*100)+'%';
  const gcEl = document.getElementById('c_grid_color'); if(gcEl) gcEl.value = v.grid_color ?? '#3c3c64';
  const ghEl = document.getElementById('c_grid_hex');  if(ghEl) ghEl.value = v.grid_color ?? '#3c3c64';
  sv('c_aalpha', v.axis_alpha ?? 1.0);
  document.getElementById('c_aalpha_val').textContent = Math.round((v.axis_alpha ?? 1.0)*100)+'%';
  const acEl = document.getElementById('c_axis_color'); if(acEl) acEl.value = v.axis_color ?? '#b4b4dc';
  const ahEl = document.getElementById('c_axis_hex');  if(ahEl) ahEl.value = v.axis_color ?? '#b4b4dc';
  const xlEl = document.getElementById('c_x_log'); if(xlEl) xlEl.checked = v.x_log ?? false;
  const ylEl = document.getElementById('c_y_log'); if(ylEl) ylEl.checked = v.y_log ?? false;
  sv('c_ts', v.title_size); sv('c_ls2', v.label_size);
  sv('c_legend_size', v.legend_size ?? 9);
  const lcEl = document.getElementById('c_legend_color'); if(lcEl) lcEl.value = v.legend_text_color || '#e8e8f0';
  const lchEl = document.getElementById('c_legend_hex');  if(lchEl) lchEl.value = v.legend_text_color || '#e8e8f0';
  const tcEl = document.getElementById('c_title_color'); if(tcEl) tcEl.value = v.title_color || '#e8e8f0';
  const tchEl = document.getElementById('c_title_hex');  if(tchEl) tchEl.value = v.title_color || '#e8e8f0';
  const labcEl = document.getElementById('c_label_color'); if(labcEl) labcEl.value = v.xlabel_color || '#e8e8f0';
  const labchEl = document.getElementById('c_label_hex');  if(labchEl) labchEl.value = v.xlabel_color || '#e8e8f0';
  const slEl = document.getElementById('c_show_legend'); if(slEl) slEl.checked = v.show_legend ?? true;
  const bgEl = document.getElementById('c_bg_color'); if(bgEl) bgEl.value = v.bg_color || '#12121c';
  const bgHexEl = document.getElementById('c_bg_hex'); if(bgHexEl) bgHexEl.value = v.bg_color || '#12121c';
  applyBgColorToCanvas(activePid);
  updateLegendOpacityState(v.show_legend ?? true);
  refreshLineCurveSelector();
  const curve = activeCurve();
  const lineBody = document.getElementById('lineSettingsBody');
  if(lineBody) lineBody.classList.toggle('line-settings-disabled', !curve);
  if(curve){
    document.getElementById('c_lc').value = curve.line_color;
    document.getElementById('c_lchex').value = curve.line_color;
    sv('c_lw', curve.line_width);
    document.getElementById('c_lw_val').textContent = parseFloat(curve.line_width).toFixed(1);
    sv('c_ls', curve.line_style);
    sv('c_lconn', curve.line_connection || 'linear');
    sv('c_mk', curve.marker);
    syncDataMaskInputs();
    const lconn = document.getElementById('c_lconn');
    const lsRow = document.getElementById('row_ls');
    if(lconn && lsRow){
      const disabled = lconn.value === 'none';
      lsRow.style.opacity = disabled ? '0.35' : '1';
      lsRow.style.pointerEvents = disabled ? 'none' : '';
    }
  }
}

function syncDataMaskInputs(){
  const curve=activeCurve(), focused=document.activeElement?.id;
  const set=(id,val)=>{ const el=document.getElementById(id); if(el&&el.id!==focused) el.value=val!=null?fmtDomain(val):''; };
  if(!curve){ ['c_mask_xn','c_mask_xx','c_mask_yn','c_mask_yx'].forEach(id=>{ const el=document.getElementById(id); if(el&&el.id!==focused) el.value=''; }); return; }
  set('c_mask_xn', curve.mask_x_min); set('c_mask_xx', curve.mask_x_max);
  set('c_mask_yn', curve.mask_y_min); set('c_mask_yx', curve.mask_y_max);
}

function commitMaskInput(id, axis, minMax){
  const p = activePlot(); if(!p) return;
  const curve = activeCurve(); if(!curve) return;
  const el = document.getElementById(id); if(!el) return;
  const raw = el.value.trim(), key = `mask_${axis}_${minMax}`;
  if(raw==='') curve[key]=null;
  else{ const val=parseFloat(raw); if(isNaN(val)){ syncDataMaskInputs(); return; } curve[key]=val; el.value=fmtDomain(val); }
  if(p.mplMode){ clearTimeout(window._mplDebounce); window._mplDebounce=setTimeout(()=>convertToMpl(p.id),350); }
  else renderJS(p.id, false);
}

function updateLegendOpacityState(legendOn){
  const row = document.getElementById('row_legend_size');
  if(!row) return;
  row.style.opacity       = legendOn ? '1' : '0.35';
  row.style.pointerEvents = legendOn ? '' : 'none';
}

function sv(id, val){ const el=document.getElementById(id); if(el) el.value=val; }

function commitDomainInput(id, axis, minMax){
  const p = activePid!==null ? gp(activePid) : null; if(!p) return;
  const el = document.getElementById(id); if(!el) return;
  const raw = el.value.trim();
  if(raw===''){
    const dom=getEffectiveDomain(activePid), cur=axis==='x'?(minMax==='min'?dom.xMin:dom.xMax):(minMax==='min'?dom.yMin:dom.yMax);
    el.value=fmtDomain(cur); p.view[axis+'_'+minMax]=null;
    if(p.mplMode){ clearTimeout(window._mplDebounce); window._mplDebounce=setTimeout(()=>convertToMpl(activePid),350); }
    else { _applyDomainToChart(p); if(p.curves.some(c=>c.template)) renderJS(activePid, false); }
    return;
  }
  const val = parseFloat(raw);
  if(isNaN(val)){
    const dom=getEffectiveDomain(activePid), cur=axis==='x'?(minMax==='min'?dom.xMin:dom.xMax):(minMax==='min'?dom.yMin:dom.yMax);
    el.value=fmtDomain(cur); return;
  }
  p.view[axis+'_'+minMax] = val; el.value=fmtDomain(val);
  if(p.mplMode){ clearTimeout(window._mplDebounce); window._mplDebounce=setTimeout(()=>convertToMpl(activePid),350); }
  else { _applyDomainToChart(p); if(p.curves.some(c=>c.template)) renderJS(activePid, false); }
}

// Apply p.view domain limits to an existing Chart.js instance without recomputing curve data.
function _applyDomainToChart(p){
  const ch = chartInstances[p?.id]; if(!ch) return;
  applyScaleLimits(ch.options.scales, p.view);
  ch.update('none');
  syncCfgDomain();
}

// Read all cfg inputs into state, apply font sizes, and re-render or re-export.
// Debounces the undo snapshot to avoid flooding the stack during slider drags.
function triggerCfgRender(){
  if(activePid===null) return;
  readCfgIntoActive();
  const p = gp(activePid); if(!p) return;
  applyLabelFontSizes(activePid);
  if(p.mplMode){ clearTimeout(window._mplDebounce); window._mplDebounce=setTimeout(()=>convertToMpl(activePid),350); }
  else if(p.curves.some(c=>c.jsData)) renderJS(activePid, false);
  else if(chartInstances[activePid]) drawChart(p); // empty plot — still update grid/axis styles
  clearTimeout(window._undoDebounce);
  window._undoDebounce = setTimeout(snapshotForUndo, 600);
}

function readCfgIntoActive(){
  const p = activePid!==null ? gp(activePid) : null; if(!p) return;
  const v = p.view;
  v.grid_alpha       = parseFloat(document.getElementById('c_galpha').value);
  v.grid_color       = document.getElementById('c_grid_color')?.value || '#3c3c64';
  v.axis_alpha       = parseFloat(document.getElementById('c_aalpha')?.value);
  v.axis_color       = document.getElementById('c_axis_color')?.value || '#b4b4dc';
  v.x_log            = document.getElementById('c_x_log')?.checked ?? false;
  v.y_log            = document.getElementById('c_y_log')?.checked ?? false;
  v.title_size       = parseInt(document.getElementById('c_ts').value) || 13;
  v.label_size       = parseInt(document.getElementById('c_ls2').value) || 10;
  v.legend_size       = parseInt(document.getElementById('c_legend_size')?.value) || 9;
  v.legend_text_color = document.getElementById('c_legend_color')?.value || '#e8e8f0';
  v.title_color       = document.getElementById('c_title_color')?.value || '#e8e8f0';
  v.xlabel_color      = document.getElementById('c_label_color')?.value || '#e8e8f0';
  v.ylabel_color      = v.xlabel_color;
  v.show_legend      = document.getElementById('c_show_legend')?.checked ?? true;
  v.bg_color         = document.getElementById('c_bg_color')?.value || '#12121c';
  v.surface_color    = v.bg_color;
  const curve = activeCurve();
  if(curve){
    curve.line_color      = document.getElementById('c_lc').value;
    curve.line_width      = parseFloat(document.getElementById('c_lw').value);
    curve.line_style      = document.getElementById('c_ls').value;
    curve.line_connection = document.getElementById('c_lconn')?.value || 'linear';
    curve.marker          = document.getElementById('c_mk').value;
  }
}

function syncCfgDomain(){
  if(activePid===null) return;
  const p = gp(activePid); if(!p) return;
  const dom=getEffectiveDomain(activePid), focused=document.activeElement?.id;
  const set=(id,val)=>{ const el=document.getElementById(id); if(el&&el.id!==focused) el.value=fmtDomain(val); };
  set('c_xn',dom.xMin); set('c_xx',dom.xMax); set('c_yn',dom.yMin); set('c_yx',dom.yMax);
  const lockBtn=document.getElementById('viewLockBtn');
  if(lockBtn){
    const locked=p.view.locked??false;
    lockBtn.classList.toggle('locked',locked);
    lockBtn.textContent=locked?'🔓 unlock':'🔒 lock';
    lockBtn.dataset.tip=locked?'Unlock viewport domain':'Lock viewport to current range';
  }
}

function resetDomainToDefault(){
  const p = activePid!==null ? gp(activePid) : null; if(!p) return;
  p.view.x_min=null; p.view.x_max=null; p.view.y_min=null; p.view.y_max=null;
  renderJS(p.id, true);
}

// ═══ PRESET LIST UI ══════════════════════════════════════════════════════
function renderPresetList(){
  const container = document.getElementById('presetList'); if(!container) return;
  container.innerHTML = '';

  const all       = typeof getAllPresets       === 'function' ? getAllPresets()       : [];
  const activeId  = typeof getActivePresetId  === 'function' ? getActivePresetId()  : 'dark';
  const defaultId = typeof getDefaultPresetId === 'function' ? getDefaultPresetId() : 'dark';

  all.forEach(preset=>{
    const isActive  = preset.id === activeId;
    const isDefault = preset.id === defaultId;

    const chip = document.createElement('div');
    chip.className = 'preset-chip' + (isActive ? ' active' : '') + (isDefault ? ' default' : '');
    chip.dataset.presetId = preset.id;

    // ── Star: "Set as default for new plots" ──────────────────────────
    const starBtn = document.createElement('button');
    starBtn.className = 'preset-chip-star' + (isDefault ? ' is-default' : '');
    starBtn.innerHTML = '★';
    starBtn.title = isDefault ? 'Default for new plots' : 'Set as default for new plots';
    starBtn.addEventListener('mousedown', e=>{
      e.stopPropagation(); e.preventDefault();
      if(typeof setDefaultPresetId === 'function') setDefaultPresetId(preset.id);
      renderPresetList();
    });
    chip.appendChild(starBtn);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'preset-chip-name';
    nameSpan.textContent = preset.name;
    chip.appendChild(nameSpan);

    if(!preset.builtIn){
      // Double-click name to rename
      nameSpan.title = 'Double-click to rename';
      nameSpan.addEventListener('dblclick', e=>{
        e.stopPropagation();
        _beginPresetRename(chip, nameSpan, preset);
      });

      // Pencil rename button (visible on hover via CSS)
      const editBtn = document.createElement('button');
      editBtn.className = 'preset-chip-edit';
      editBtn.innerHTML = '✎';
      editBtn.title = 'Rename';
      editBtn.addEventListener('mousedown', e=>{
        e.stopPropagation(); e.preventDefault();
        _beginPresetRename(chip, nameSpan, preset);
      });
      chip.appendChild(editBtn);

      // Delete button (visible on hover via CSS)
      const delBtn = document.createElement('button');
      delBtn.className = 'preset-chip-del';
      delBtn.innerHTML = '&times;';
      delBtn.title = 'Delete preset';
      delBtn.addEventListener('mousedown', e=>{
        e.stopPropagation(); e.preventDefault();
        if(typeof deletePreset === 'function') deletePreset(preset.id);
        renderPresetList();
      });
      chip.appendChild(delBtn);
    }

    chip.addEventListener('click', e=>{
      if(e.target.closest('.preset-chip-del'))  return;
      if(e.target.closest('.preset-chip-edit')) return;
      if(e.target.closest('.preset-chip-star')) return;
      if(activePid === null) return;
      if(typeof applyPreset === 'function') applyPreset(preset.id, activePid, true);
      // Re-render chip highlights without a full refreshCfg to avoid loop
      container.querySelectorAll('.preset-chip').forEach(c=>
        c.classList.toggle('active', c.dataset.presetId === preset.id));
    });

    container.appendChild(chip);
  });
}

function _beginPresetRename(chip, nameSpan, preset){
  const inp = document.createElement('input');
  inp.className  = 'preset-chip-inp';
  inp.value      = preset.name;
  inp.maxLength  = 32;
  nameSpan.replaceWith(inp);
  inp.focus(); inp.select();

  const commit = ()=>{
    const newName = inp.value.trim() || preset.name;
    if(typeof renamePreset === 'function') renamePreset(preset.id, newName);
    renderPresetList();
  };
  inp.addEventListener('blur',    commit);
  inp.addEventListener('keydown', e=>{
    if(e.key === 'Enter')  { e.preventDefault(); inp.blur(); }
    if(e.key === 'Escape') { inp.value = preset.name; inp.blur(); }
    e.stopPropagation();
  });
}

function initCfgPanel(){
  // Preset new button — captures current plot state into a named preset
  document.getElementById('presetNewBtn')?.addEventListener('click', ()=>{
    if(activePid === null) return;
    const p = gp(activePid); if(!p) return;
    const allPresets = getAllPresets();
    const userCount  = allPresets.filter(pr => !pr.builtIn).length;
    const preset = createPreset('Preset ' + (userCount + 1), p.view);
    setActivePresetId(preset.id);
    renderPresetList();
    // Enter rename mode immediately on the new chip
    setTimeout(()=>{
      const chip = document.querySelector(`.preset-chip[data-preset-id="${preset.id}"]`);
      if(chip){ const ns = chip.querySelector('.preset-chip-name'); if(ns) _beginPresetRename(chip, ns, preset); }
    }, 0);
  });

  document.getElementById('c_bg_color')?.addEventListener('input', function(){
    document.getElementById('c_bg_hex').value = this.value;
    triggerCfgRender();
    applyBgColorToCanvas(activePid);
  });
  document.getElementById('c_bg_hex')?.addEventListener('input', function(){
    if(/^#[0-9a-fA-F]{6}$/.test(this.value)){
      document.getElementById('c_bg_color').value = this.value;
      triggerCfgRender();
      applyBgColorToCanvas(activePid);
    }
  });

  document.getElementById('c_grid_color')?.addEventListener('input', function(){
    document.getElementById('c_grid_hex').value = this.value;
    triggerCfgRender();
  });
  document.getElementById('c_grid_hex')?.addEventListener('input', function(){
    if(/^#[0-9a-fA-F]{6}$/.test(this.value)){
      document.getElementById('c_grid_color').value = this.value;
      triggerCfgRender();
    }
  });

  document.getElementById('c_axis_color')?.addEventListener('input', function(){
    document.getElementById('c_axis_hex').value = this.value;
    triggerCfgRender();
  });
  document.getElementById('c_axis_hex')?.addEventListener('input', function(){
    if(/^#[0-9a-fA-F]{6}$/.test(this.value)){
      document.getElementById('c_axis_color').value = this.value;
      triggerCfgRender();
    }
  });

  document.getElementById('c_legend_color')?.addEventListener('input', function(){
    document.getElementById('c_legend_hex').value = this.value;
    triggerCfgRender();
  });
  document.getElementById('c_legend_hex')?.addEventListener('input', function(){
    if(/^#[0-9a-fA-F]{6}$/.test(this.value)){
      document.getElementById('c_legend_color').value = this.value;
      triggerCfgRender();
    }
  });

  document.getElementById('c_title_color')?.addEventListener('input', function(){
    document.getElementById('c_title_hex').value = this.value;
    triggerCfgRender();
  });
  document.getElementById('c_title_hex')?.addEventListener('input', function(){
    if(/^#[0-9a-fA-F]{6}$/.test(this.value)){
      document.getElementById('c_title_color').value = this.value;
      triggerCfgRender();
    }
  });

  document.getElementById('c_label_color')?.addEventListener('input', function(){
    document.getElementById('c_label_hex').value = this.value;
    triggerCfgRender();
  });
  document.getElementById('c_label_hex')?.addEventListener('input', function(){
    if(/^#[0-9a-fA-F]{6}$/.test(this.value)){
      document.getElementById('c_label_color').value = this.value;
      triggerCfgRender();
    }
  });

  document.getElementById('cfgTabPlot')?.addEventListener('click', ()=>setCfgTab('plot'));
  document.getElementById('cfgTabLine')?.addEventListener('click', ()=>{ setCfgTab('line'); refreshLineCurveSelector(); });
  document.getElementById('domainHomeBtn')?.addEventListener('click', resetDomainToDefault);
  document.getElementById('viewLockBtn')?.addEventListener('click', ()=>{
    const p=activePid!==null?gp(activePid):null; if(!p) return;
    p.view.locked=!(p.view.locked??false);
    syncCfgDomain();
  });

  [['c_xn','x','min'],['c_xx','x','max'],['c_yn','y','min'],['c_yx','y','max']].forEach(([id,axis,mm])=>{
    const el = document.getElementById(id); if(!el) return;
    el.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();commitDomainInput(id,axis,mm);el.blur();} if(e.key==='Escape'){syncCfgDomain();el.blur();} });
    el.addEventListener('blur', ()=>commitDomainInput(id,axis,mm));
  });

  ['c_ts','c_ls2','c_legend_size'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.addEventListener('input',triggerCfgRender); el.addEventListener('change',triggerCfgRender); } });
  document.getElementById('c_show_legend')?.addEventListener('change', function(){ updateLegendOpacityState(this.checked); triggerCfgRender(); });
  document.getElementById('c_x_log')?.addEventListener('change', triggerCfgRender);
  document.getElementById('c_y_log')?.addEventListener('change', triggerCfgRender);
  document.getElementById('c_galpha').addEventListener('input', function(){ document.getElementById('c_galpha_val').textContent=Math.round(parseFloat(this.value)*100)+'%'; triggerCfgRender(); });
  document.getElementById('c_aalpha')?.addEventListener('input', function(){ document.getElementById('c_aalpha_val').textContent=Math.round(parseFloat(this.value)*100)+'%'; triggerCfgRender(); });

  ['c_lw','c_ls','c_lconn','c_mk'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.addEventListener('input',triggerCfgRender); el.addEventListener('change',triggerCfgRender); } });

  function updateLineStyleRowState(){
    const lconn = document.getElementById('c_lconn');
    const lsRow = document.getElementById('row_ls');
    if(!lconn||!lsRow) return;
    const disabled = lconn.value === 'none';
    lsRow.style.opacity = disabled ? '0.35' : '1';
    lsRow.style.pointerEvents = disabled ? 'none' : '';
  }
  document.getElementById('c_lconn')?.addEventListener('change', updateLineStyleRowState);
  document.getElementById('c_lconn')?.addEventListener('input', updateLineStyleRowState);
  document.getElementById('c_lc').addEventListener('input', function(){ document.getElementById('c_lchex').value=this.value; triggerCfgRender(); refreshOverlayLegend(activePid); refreshLineCurveSelector(); });
  document.getElementById('c_lchex').addEventListener('input', function(){ if(/^#[0-9a-fA-F]{6}$/.test(this.value)){ document.getElementById('c_lc').value=this.value; triggerCfgRender(); refreshOverlayLegend(activePid); refreshLineCurveSelector(); } });
  document.getElementById('c_lw').addEventListener('input', function(){ document.getElementById('c_lw_val').textContent=parseFloat(this.value).toFixed(1); });

  [['c_mask_xn','x','min'],['c_mask_xx','x','max'],['c_mask_yn','y','min'],['c_mask_yx','y','max']].forEach(([id,axis,mm])=>{
    const el = document.getElementById(id); if(!el) return;
    el.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();commitMaskInput(id,axis,mm);el.blur();} if(e.key==='Escape'){syncDataMaskInputs();el.blur();} });
    el.addEventListener('blur', ()=>commitMaskInput(id,axis,mm));
  });

  document.getElementById('maskResetBtn')?.addEventListener('click', ()=>{
    const p = activePlot(); if(!p) return;
    const curve = activeCurve(); if(!curve) return;
    curve.mask_x_min=null; curve.mask_x_max=null; curve.mask_y_min=null; curve.mask_y_max=null;
    syncDataMaskInputs();
    if(p.mplMode){ clearTimeout(window._mplDebounce); window._mplDebounce=setTimeout(()=>convertToMpl(p.id),350); }
    else renderJS(p.id, false);
  });
}