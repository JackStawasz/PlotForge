// ═══ LEFT SIDEBAR: Files + Variables ════════════════════════════════════
let sbActiveTab = 'vars';

function initLeftSidebar(){
  document.getElementById('sbTabFiles')?.addEventListener('click', ()=>setSbTab('files'));
  document.getElementById('sbTabVars')?.addEventListener('click', ()=>setSbTab('vars'));
  const dz = document.getElementById('filesDropZone');
  const fi = document.getElementById('filesInput');
  if(dz){
    dz.addEventListener('click', ()=>fi?.click());
    dz.addEventListener('dragover', e=>{ e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', ()=>dz.classList.remove('dragover'));
    dz.addEventListener('drop', e=>{ e.preventDefault(); dz.classList.remove('dragover'); handleFilesDrop(e.dataTransfer.files); });
  }
  fi?.addEventListener('change', ()=>handleFilesDrop(fi.files));
  document.getElementById('varsAddBtn')?.addEventListener('click', e=>{ e.stopPropagation(); showVarTypePicker(); });
  document.addEventListener('click', ()=>hideVarTypePicker());
}

// ═══ RESIZABLE SIDEBARS ══════════════════════════════════════════════════
function initResizableSidebars(){
  makeResizable('leftSidebar',  260, 208, 520, 'right', '--sidebar');
  makeResizable('cfgPanel',     268, 214, 536, 'left',  '--cfg');
}

function makeResizable(elId, defaultPx, minPx, maxPx, edge, cssVar){
  const el = document.getElementById(elId); if(!el) return;

  // Collapse threshold: if dragged below minPx - 40px, collapse
  const COLLAPSE_THRESHOLD = minPx - 40;
  const COLLAPSED_PX = 0;
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
      document.documentElement.style.setProperty(cssVar, COLLAPSED_PX + 'px');
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
}

// ═══ FILES TAB ═══════════════════════════════════════════════════════════
let uploadedFiles = [];

function handleFilesDrop(fileList){
  for(const f of fileList){
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

// Send .pkl to backend, show confirmation modal, then import
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
    showPickleConfirmModal(f.name, data.variables, ()=>{
      importPickleVars(data.variables, f.name);
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

// Show a modal previewing what will be imported, then call onConfirm or onCancel.
// Pass isOverwrite=true to show an overwrite-warning banner above the variable list.
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
      <div class="pkl-modal-footer">
        <button class="pkl-modal-btn cancel" id="pklCancel">Cancel</button>
        <button class="pkl-modal-btn confirm" id="pklConfirm">${isOverwrite ? 'Overwrite' : 'Import all'}</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();

  backdrop.querySelector('#pklCancel').addEventListener('click', ()=>{ close(); onCancel?.(); });
  backdrop.querySelector('#pklConfirm').addEventListener('click', ()=>{
    if(isOverwrite && typeof removeVariablesBySource === 'function'){
      removeVariablesBySource(filename);
    }
    close(); onConfirm?.();
  });
  backdrop.addEventListener('click', e=>{ if(e.target === backdrop){ close(); onCancel?.(); } });
  const onKey = e=>{ if(e.key==='Escape'){ close(); onCancel?.(); document.removeEventListener('keydown',onKey); } };
  document.addEventListener('keydown', onKey);
}
// ─── JSON / CSV client-side import ──────────────────────────────────────────

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
  const columns = headers.map(()=>[]);

  for(let r = 1; r < lines.length; r++){
    const cells = splitRow(lines[r]);
    for(let c = 0; c < headers.length; c++){
      const v = parseFloat(cells[c]);
      columns[c].push(isNaN(v) ? null : v);
    }
  }

  const result = {};
  for(let c = 0; c < headers.length; c++){
    const name = headers[c]; if(!name) continue;
    const items = columns[c].filter(v=>v !== null);
    if(!items.length) continue;
    result[name] = items.length === 1
      ? {kind:'constant', value:items[0]}
      : {kind:'list', items};
  }

  if(!Object.keys(result).length) return {error: 'No numeric columns found in CSV'};
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
    showPickleConfirmModal(f.name, parsed.variables, ()=>{
      if(isOverwrite && typeof removeVariablesBySource === 'function'){
        removeVariablesBySource(f.name);
      }
      importPickleVars(parsed.variables, f.name);
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
      ? (TEMPLATES[curve.template]?.equation || `Curve ${idx+1}`)
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
      refreshLineCurveSelector(); refreshOverlayLegend(ap.id);
      if(ap.mplMode){ clearTimeout(window._mplDebounce); window._mplDebounce=setTimeout(()=>convertToMpl(ap.id),350); }
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
  document.getElementById('c_grid').checked = v.show_grid;
  sv('c_galpha', v.grid_alpha ?? 0.5);
  document.getElementById('c_galpha_val').textContent = Math.round((v.grid_alpha ?? 0.5)*100)+'%';
  const axEl = document.getElementById('c_axis_lines'); if(axEl) axEl.checked = v.show_axis_lines ?? true;
  sv('c_aalpha', v.axis_alpha ?? 1.0);
  document.getElementById('c_aalpha_val').textContent = Math.round((v.axis_alpha ?? 1.0)*100)+'%';
  const xlEl = document.getElementById('c_x_log'); if(xlEl) xlEl.checked = v.x_log ?? false;
  const ylEl = document.getElementById('c_y_log'); if(ylEl) ylEl.checked = v.y_log ?? false;
  sv('c_ts', v.title_size); sv('c_ls2', v.label_size);
  sv('c_legend_size', v.legend_size ?? 9);
  const slEl = document.getElementById('c_show_legend'); if(slEl) slEl.checked = v.show_legend ?? true;
  const bgEl = document.getElementById('c_bg_color'); if(bgEl) bgEl.value = v.bg_color || '#12121c';
  const bgHexEl = document.getElementById('c_bg_hex'); if(bgHexEl) bgHexEl.value = v.bg_color || '#12121c';
  applyBgColorToCanvas(activePid);
  updateGridOpacityState(v.show_grid);
  updateAxisOpacityState(v.show_axis_lines ?? true);
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

function updateGridOpacityState(gridOn){
  const row = document.getElementById('row_galpha');
  if(!row) return;
  row.style.opacity = gridOn ? '1' : '0.35';
  row.style.pointerEvents = gridOn ? '' : 'none';
}

function updateAxisOpacityState(axisOn){
  const row = document.getElementById('row_aalpha');
  if(!row) return;
  row.style.opacity = axisOn ? '1' : '0.35';
  row.style.pointerEvents = axisOn ? '' : 'none';
}

function updateLegendOpacityState(legendOn){
  const row = document.getElementById('row_legend_size');
  if(!row) return;
  row.style.opacity = legendOn ? '1' : '0.35';
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

// Immediately apply p.view domain to an existing Chart.js instance without re-rendering curves.
function _applyDomainToChart(p){
  const ch = chartInstances[p?.id]; if(!ch) return;
  applyScaleLimits(ch.options.scales, p.view);
  ch.update('none');
  syncCfgDomain();
}

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
  v.show_grid        = document.getElementById('c_grid').checked;
  v.grid_alpha       = parseFloat(document.getElementById('c_galpha').value) || 0.5;
  v.show_axis_lines  = document.getElementById('c_axis_lines')?.checked ?? true;
  v.axis_alpha       = parseFloat(document.getElementById('c_aalpha')?.value) || 1.0;
  v.x_log            = document.getElementById('c_x_log')?.checked ?? false;
  v.y_log            = document.getElementById('c_y_log')?.checked ?? false;
  v.title_size       = parseInt(document.getElementById('c_ts').value) || 13;
  v.label_size       = parseInt(document.getElementById('c_ls2').value) || 10;
  v.legend_size      = parseInt(document.getElementById('c_legend_size')?.value) || 9;
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
}

function resetDomainToDefault(){
  const p = activePid!==null ? gp(activePid) : null; if(!p) return;
  p.view.x_min=null; p.view.x_max=null; p.view.y_min=null; p.view.y_max=null;
  renderJS(p.id, true);
}

function initCfgPanel(){
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

  document.getElementById('cfgTabPlot')?.addEventListener('click', ()=>setCfgTab('plot'));
  document.getElementById('cfgTabLine')?.addEventListener('click', ()=>{ setCfgTab('line'); refreshLineCurveSelector(); });
  document.getElementById('domainHomeBtn')?.addEventListener('click', resetDomainToDefault);

  [['c_xn','x','min'],['c_xx','x','max'],['c_yn','y','min'],['c_yx','y','max']].forEach(([id,axis,mm])=>{
    const el = document.getElementById(id); if(!el) return;
    el.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();commitDomainInput(id,axis,mm);el.blur();} if(e.key==='Escape'){syncCfgDomain();el.blur();} });
    el.addEventListener('blur', ()=>commitDomainInput(id,axis,mm));
  });

  ['c_ts','c_ls2','c_legend_size'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.addEventListener('input',triggerCfgRender); el.addEventListener('change',triggerCfgRender); } });
  document.getElementById('c_grid').addEventListener('change', function(){ updateGridOpacityState(this.checked); triggerCfgRender(); });
  document.getElementById('c_axis_lines')?.addEventListener('change', function(){ updateAxisOpacityState(this.checked); triggerCfgRender(); });
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