// ═══ LEFT SIDEBAR: Files + Variables ════════════════════════════════════
let sbActiveTab = 'files';

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
  const handle = document.createElement('div');
  handle.className = 'resize-handle resize-handle-' + edge;
  el.appendChild(handle);
  let dragging = false, startX = 0, startW = 0;
  handle.addEventListener('mousedown', e=>{
    e.preventDefault(); dragging = true; startX = e.clientX; startW = el.offsetWidth;
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', e=>{
    if(!dragging) return;
    const delta = edge === 'right' ? (e.clientX - startX) : (startX - e.clientX);
    const newW = Math.max(minPx, Math.min(maxPx, startW + delta));
    document.documentElement.style.setProperty(cssVar, newW + 'px');
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
    if(uploadedFiles.find(u=>u.name===f.name && u.size===f.size)) continue;
    uploadedFiles.push(f);
    // .pkl files: send to backend for unpickling, import as variables
    if(f.name.toLowerCase().endsWith('.pkl')){
      uploadPickleFile(f);
    }
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
    const statusBadge = isPkl
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

    // Re-import pkl on click of the badge
    if(isPkl){
      const badge = item.querySelector(`#pkl-badge-${i}`);
      if(badge){
        badge.style.cursor = 'pointer';
        badge.title = 'Click to re-import as variables';
        badge.addEventListener('click', e=>{ e.stopPropagation(); uploadPickleFile(f, badge); });
      }
    }
    list.appendChild(item);
  });
}

// Send .pkl to backend, show confirmation modal, then import
async function uploadPickleFile(f, badgeEl){
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
    });
  }catch(e){
    setBadge('error', 'pkl-error');
    console.warn('Pickle upload failed:', e);
  }
}

// Show a modal previewing what will be imported, then call onConfirm or onCancel
function showPickleConfirmModal(filename, varsData, onConfirm, onCancel){
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

  backdrop.innerHTML = `
    <div class="pkl-modal">
      <div class="pkl-modal-header">
        <div class="pkl-modal-title">Import variables from file?</div>
        <div class="pkl-modal-subtitle">${shortName} · ${varEntries.length} variable${varEntries.length!==1?'s':''}</div>
      </div>
      <div class="pkl-modal-varlist">${varRowsHTML}</div>
      <div class="pkl-modal-footer">
        <button class="pkl-modal-btn cancel" id="pklCancel">Cancel</button>
        <button class="pkl-modal-btn confirm" id="pklConfirm">Import all</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();

  backdrop.querySelector('#pklCancel').addEventListener('click', ()=>{ close(); onCancel?.(); });
  backdrop.querySelector('#pklConfirm').addEventListener('click', ()=>{ close(); onConfirm?.(); });
  // Click outside to cancel
  backdrop.addEventListener('click', e=>{ if(e.target === backdrop){ close(); onCancel?.(); } });
  // Escape to cancel
  const onKey = e=>{ if(e.key==='Escape'){ close(); onCancel?.(); document.removeEventListener('keydown',onKey); } };
  document.addEventListener('keydown', onKey);
}