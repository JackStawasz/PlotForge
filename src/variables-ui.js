// ═══ VARIABLE STATE ══════════════════════════════════════════════════════
const variables = [];
let varIdCtr = 0;

function addVariable(kind='constant', opts={}){
  // Determine scope: explicit opt > caller-provided default > infer from active sidebar tab
  const scope = opts.scope != null ? opts.scope
    : (opts._defaultScope != null ? opts._defaultScope
      : ((typeof sbActiveTab !== 'undefined' && sbActiveTab === 'files'
          && typeof activeTabId !== 'undefined' && activeTabId != null)
          ? activeTabId : 'global'));
  const v = {
    id: ++varIdCtr, kind,
    name:      opts.name      || '',
    nameLatex: opts.nameLatex || '',
    fullLatex: opts.fullLatex || '',
    exprLatex: opts.exprLatex || '',
    value:     opts.value     ?? 0,
    paramMin:  opts.paramMin  ?? -10,
    paramMax:  opts.paramMax  ?? 10,
    listLength: opts.listLength ?? 3,
    listItems:  opts.listItems  ? [...opts.listItems] : [0, 0, 0],
    fromTemplate: opts.fromTemplate || false,
    templateKey:  opts.templateKey  || null,
    paramKey:     opts.paramKey     || null,
    pickleSource:  opts.pickleSource  || null,
    _isNumeric:    opts._isNumeric    || false,
    _categorical:  opts._categorical  || false,
    _labels:       opts._labels       ? [...opts._labels] : [],
    scope,
    folder:        opts.folder        ?? null,
  };
  variables.push(v);
  renderVariables();
  if(!opts.silent){
    if(typeof snapshotForUndo === 'function') snapshotForUndo();
    // Focus the new MQ field after DOM settles
    setTimeout(()=>{
      const mq = document.querySelector(`#vmq_${v.id} .mq-editable-field`);
      if(mq) mq.click();
    }, 80);
  }
  return v;
}

function removeVariable(id){
  const idx = variables.findIndex(x=>x.id===id);
  if(idx > -1) variables.splice(idx, 1);
  renderVariables();
  if(typeof snapshotForUndo === 'function') snapshotForUndo();
}

// Remove all variables that were imported from a given file.
function removeVariablesBySource(sourceName){
  let changed = false;
  for(let i = variables.length - 1; i >= 0; i--){
    if(variables[i].pickleSource === sourceName){
      variables.splice(i, 1);
      changed = true;
    }
  }
  if(changed) renderVariables();
}

// ═══ VAR TYPE PICKER ═════════════════════════════════════════════════════
let _varTypePicker = null;

function showVarTypePicker(forceScope){
  hideVarTypePicker();
  // forceScope: 'global', a tabId, or undefined (infer from sidebar state)
  const pickerScope = forceScope != null ? forceScope
    : ((typeof sbActiveTab !== 'undefined' && sbActiveTab === 'files'
        && typeof activeTabId !== 'undefined' && activeTabId != null)
        ? activeTabId : 'global');
  const btnId = (pickerScope !== 'global') ? 'varsAddLocalBtn' : 'varsAddBtn';
  const btn = document.getElementById(btnId) || document.getElementById('varsAddBtn');
  if(!btn) return;
  const picker = document.createElement('div');
  picker.id = 'var-type-picker';
  picker.style.cssText = [
    'position:fixed','z-index:99998',
    'background:var(--s1)','border:1px solid var(--border2)','border-radius:8px',
    'box-shadow:0 8px 28px rgba(0,0,0,.55)',
    'font-family:var(--mono,monospace)','font-size:.8rem',
    'min-width:178px','overflow:hidden','padding:4px 0',
  ].join(';');
  _varTypePicker = picker;

  const types = [
    { key:'constant', icon:'α',   label:'Constant', desc:'Number or expression' },
    { key:'equation', icon:'ƒ',   label:'Equation', desc:'Function of x'        },
    { key:'list',     icon:'[ ]', label:'List',     desc:'Fixed-length sequence' },
  ];
  types.forEach(t=>{
    const row = document.createElement('button');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;background:transparent;border:none;padding:9px 14px;cursor:pointer;transition:background .08s;text-align:left;';
    row.innerHTML = `<span style="font-size:1.05rem;width:22px;text-align:center;flex-shrink:0;color:var(--acc2);opacity:.85">${t.icon}</span>`
      + `<span><span style="color:var(--text);font-size:.8rem;display:block">${t.label}</span>`
      + `<span style="color:var(--muted);font-size:.68rem">${t.desc}</span></span>`;
    row.addEventListener('mouseenter', ()=>{ row.style.background='rgba(90,255,206,.07)'; });
    row.addEventListener('mouseleave', ()=>{ row.style.background='transparent'; });
    row.addEventListener('mousedown', e=>{ e.preventDefault(); e.stopPropagation(); });
    row.addEventListener('click', e=>{ e.stopPropagation(); hideVarTypePicker(); addVariable(t.key, {scope: pickerScope}); });
    picker.appendChild(row);
  });

  // Separator
  const sep = document.createElement('div');
  sep.style.cssText = 'height:1px;background:var(--border2);margin:3px 0;';
  picker.appendChild(sep);

  // "Add File" row — opens a file picker and imports via existing pipeline
  const fileRow = document.createElement('button');
  fileRow.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;background:transparent;border:none;padding:9px 14px;cursor:pointer;transition:background .08s;text-align:left;';
  fileRow.innerHTML = `<span style="font-size:1.05rem;width:22px;text-align:center;flex-shrink:0;color:var(--acc2);opacity:.85">&#128193;</span>`
    + `<span><span style="color:var(--text);font-size:.8rem;display:block">Add File</span>`
    + `<span style="color:var(--muted);font-size:.68rem">.csv, .json, .pkl</span></span>`;
  fileRow.addEventListener('mouseenter', ()=>{ fileRow.style.background='rgba(90,255,206,.07)'; });
  fileRow.addEventListener('mouseleave', ()=>{ fileRow.style.background='transparent'; });
  fileRow.addEventListener('mousedown', e=>{ e.preventDefault(); e.stopPropagation(); });
  fileRow.addEventListener('click', e=>{
    e.stopPropagation();
    hideVarTypePicker();
    const inp = document.createElement('input');
    inp.type = 'file'; inp.multiple = true;
    inp.accept = '.csv,.json,.pkl,.pickle';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', ()=>{
      if(inp.files?.length && typeof handleFilesDrop === 'function') handleFilesDrop(inp.files);
      inp.remove();
    });
    inp.click();
  });
  picker.appendChild(fileRow);

  document.body.appendChild(picker);
  const rect = btn.getBoundingClientRect();
  picker.style.top   = (rect.bottom + 6) + 'px';
  picker.style.right = (window.innerWidth - rect.right) + 'px';
}

function hideVarTypePicker(){
  if(_varTypePicker){ _varTypePicker.remove(); _varTypePicker = null; }
}

// ═══ DRAG-TO-REORDER ═════════════════════════════════════════════════════
// Tracks drag state. srcId = variable's v.id; scopeIds = ordered ids for that list.
let _varDrag = null;

function _varDragStart(e, item, varId, listEl, scopeIds){
  const rect = item.getBoundingClientRect();

  const clone = item.cloneNode(true);
  clone.style.cssText = [
    'position:fixed','z-index:99999','pointer-events:none',
    `width:${rect.width}px`,`left:${rect.left}px`,`top:${rect.top}px`,
    'margin:0','opacity:0.92',
    'box-shadow:0 8px 32px rgba(0,0,0,.55)',
    'border-color:var(--acc2)','transition:none',
  ].join(';');
  document.body.appendChild(clone);

  const ph = document.createElement('div');
  ph.className  = 'var-drag-placeholder';
  ph.style.height = rect.height + 'px';
  item.before(ph);
  item.style.display = 'none';

  _varDrag = { srcId: varId, scopeIds: [...scopeIds], srcItem: item, clone, placeholder: ph,
               offX: e.clientX - rect.left, offY: e.clientY - rect.top, list: listEl };
  document.addEventListener('pointermove', _varDragMove);
  document.addEventListener('pointerup',   _varDragEnd);
}

function _varDragMove(e){
  if(!_varDrag) return;
  const { clone, placeholder, offX, offY, list } = _varDrag;
  clone.style.left = (e.clientX - offX) + 'px';
  clone.style.top  = (e.clientY - offY) + 'px';

  const items = [...list.querySelectorAll('.var-item')].filter(el=>el.style.display !== 'none');
  let target = null;
  for(const el of items){
    const r = el.getBoundingClientRect();
    if(e.clientY >= r.top && e.clientY <= r.bottom){ target = el; break; }
  }
  if(target){
    const r = target.getBoundingClientRect();
    if(e.clientY < r.top + r.height / 2){
      if(placeholder.nextSibling !== target) list.insertBefore(placeholder, target);
    } else {
      if(target.nextSibling !== placeholder) list.insertBefore(placeholder, target.nextSibling);
    }
  }
}

function _varDragEnd(e){
  if(!_varDrag) return;
  document.removeEventListener('pointermove', _varDragMove);
  document.removeEventListener('pointerup',   _varDragEnd);

  const { srcId, scopeIds, srcItem, clone, placeholder, list } = _varDrag;
  clone.remove();
  srcItem.style.display = '';

  if(placeholder.parentNode === list){
    // Walk children to determine new order AND new folder assignments.
    // Folder headers (var-folder-header) set the "current folder" context;
    // var-items that follow inherit that folder.
    const newScopeIds = [];
    const folderByVid = {};
    let currentFolder = null;

    for(const child of list.children){
      if(child.classList.contains('var-folder-header')){
        currentFolder = child.dataset.folder || null;
      } else if(child === placeholder){
        newScopeIds.push(srcId);
        folderByVid[srcId] = currentFolder;
      } else if(child.classList.contains('var-item') && child.style.display !== 'none'){
        const vid = parseInt(child.dataset.vid);
        newScopeIds.push(vid);
        folderByVid[vid] = currentFolder;
      }
    }
    if(!newScopeIds.includes(srcId)){ newScopeIds.push(srcId); folderByVid[srcId] = currentFolder; }

    // Re-append any collapsed (hidden) vars that weren't visible in the DOM walk.
    // They keep their existing folder assignment and go to the end.
    for(const id of scopeIds){
      if(!newScopeIds.includes(id)){
        const hv = variables.find(vv => vv.id === id);
        folderByVid[id] = hv ? (hv.folder ?? null) : null;
        newScopeIds.push(id);
      }
    }

    placeholder.remove();
    _varDrag = null;

    // Apply folder assignment changes
    let folderChanged = false;
    for(const [vidStr, folder] of Object.entries(folderByVid)){
      const vid = parseInt(vidStr);
      const vv = variables.find(x => x.id === vid);
      if(vv && vv.folder !== folder){ vv.folder = folder; folderChanged = true; }
    }

    const orderChanged = newScopeIds.some((id, i) => id !== scopeIds[i]);
    if(orderChanged || folderChanged){
      const positions = [];
      for(let i = 0; i < variables.length; i++){
        if(scopeIds.includes(variables[i].id)) positions.push(i);
      }
      const reordered = newScopeIds.map(id => variables.find(v => v.id === id)).filter(Boolean);
      for(let i = 0; i < positions.length; i++) variables[positions[i]] = reordered[i];

      renderVariables();
      reEvalAllConstants();
      if(typeof snapshotForUndo === 'function') snapshotForUndo();
    }
  } else {
    placeholder.remove();
    _varDrag = null;
  }
}

// ═══ WARNING SYSTEM ══════════════════════════════════════════════════════
// Tracks duplicate-name and invalid-expression warnings for one variable.
// Duplicate-name takes display priority over invalid-expression.
class VarWarning {
  constructor(varId){
    this.varId      = varId;
    this._dupMsg    = null;
    this._invalidMsg = null;
  }
  get active(){ return this._dupMsg !== null; }
  set(msg){         this._dupMsg    = msg;  this._apply(); }
  clear(){          this._dupMsg    = null; this._apply(); }
  setInvalid(msg){  this._invalidMsg = msg; this._apply(); }
  clearInvalid(){   this._invalidMsg = null; this._apply(); }
  _apply(){
    const btn = document.querySelector(`.var-warn-btn[data-vid="${this.varId}"]`);
    if(!btn) return;
    // Tip may be a detached body element — use stored reference if available
    const tip = btn._tipEl || btn.querySelector('.var-warn-tip');
    const msg = this._dupMsg || this._invalidMsg; // duplicate takes priority
    if(msg){
      btn.classList.add('var-warn-active');
      if(tip) tip.textContent = msg;
    } else {
      btn.classList.remove('var-warn-active');
      if(tip) tip.textContent = 'No errors';
    }
  }
}

// Check all variables for duplicate names within the same scope context.
// Local vars may intentionally shadow globals, so duplicates are only flagged
// within the same scope bucket (global vs. a specific tabId).
function checkAllWarnings(){
  // Build first-owner maps per scope bucket
  const scopeOwners = new Map(); // scope → Map(name → first v.id)
  for(const v of variables){
    if(!v.name) continue;
    const sc = v.scope ?? 'global';
    if(!scopeOwners.has(sc)) scopeOwners.set(sc, new Map());
    const m = scopeOwners.get(sc);
    if(!m.has(v.name)) m.set(v.name, v.id);
  }
  for(const v of variables){
    if(!v._warning) v._warning = new VarWarning(v.id);
    const sc = v.scope ?? 'global';
    const firstId = scopeOwners.get(sc)?.get(v.name);
    if(v.name && firstId !== undefined && firstId !== v.id){
      v._warning.set(`"${v.name}" is already defined in this scope`);
    } else {
      v._warning.clear();
    }
  }
}

// Re-evaluate all constant variables (call after any context-affecting change).
function reEvalAllConstants(){
  for(const v of variables){
    if(v.kind === 'constant') evaluateConstant(v);
  }
}

// ═══ RENDER VARIABLES LIST ═══════════════════════════════════════════════
function renderVariables(){
  // Clear body-level warning tooltips from the previous render
  document.querySelectorAll('body > .var-warn-tip').forEach(el => el.remove());

  const localTabId  = (typeof activeTabId !== 'undefined') ? activeTabId : null;
  const globalVars  = variables.filter(v => (v.scope ?? 'global') === 'global');
  const localVars   = localTabId ? variables.filter(v => v.scope === localTabId) : [];

  const gList  = document.getElementById('varsList');
  const lList  = document.getElementById('localVarsList');
  const gEmpty = document.getElementById('varsEmpty');
  const lEmpty = document.getElementById('localVarsEmpty');

  if(gEmpty) gEmpty.style.display = globalVars.length ? 'none' : 'flex';
  if(lEmpty) lEmpty.style.display  = localVars.length  ? 'none' : 'flex';

  if(gList) _renderVarSubset(gList, globalVars);
  if(lList) _renderVarSubset(lList, localVars);

  requestAnimationFrame(()=> checkAllWarnings());
}

// Renders a scoped subset of variables into listEl, grouped by folder.
// Ungrouped vars appear first; each folder is a collapsible section after them.
function _renderVarSubset(listEl, varSubset){
  listEl.innerHTML = '';
  const scopeIds = varSubset.map(v => v.id);
  const scopeId  = varSubset.length > 0 ? (varSubset[0].scope ?? 'global') : 'global';

  // ── Inner closure: build and append one variable card ──────────────────
  const appendVarItem = v => {
    const item = document.createElement('div');
    item.className   = `var-item var-item-${v.kind}`;
    item.dataset.vid = v.id;
    if(v.folder) item.dataset.folder = v.folder;

    const handle = document.createElement('div');
    handle.className  = 'var-drag-handle';
    handle.textContent = '⠿';
    handle.title      = 'Drag to reorder';
    item.appendChild(handle);

    const inner = document.createElement('div');
    inner.className = 'var-item-inner';
    item.appendChild(inner);

    handle.addEventListener('pointerdown', e=>{
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      _varDragStart(e, item, v.id, listEl, scopeIds);
    });

    item.addEventListener('focusin',  ()=> item.classList.add('var-item--focused'));
    item.addEventListener('focusout', ()=> item.classList.remove('var-item--focused'));

    // ── Warning button + tooltip ─────────────────────────────────────────
    const warnBtn = document.createElement('div');
    warnBtn.className = 'var-warn-btn';
    warnBtn.dataset.vid = v.id;
    warnBtn.innerHTML   = '&#9888;';
    warnBtn.setAttribute('aria-label', 'No errors');
    const warnTip = document.createElement('div');
    warnTip.className   = 'var-warn-tip';
    warnTip.textContent = 'No errors';
    document.body.appendChild(warnTip);
    const _positionTip = ()=>{ const r=warnBtn.getBoundingClientRect(); warnTip.style.top=(r.bottom+4)+'px'; warnTip.style.left=r.left+'px'; };
    const _showTip = ()=>{ _positionTip(); warnTip.style.display='block'; };
    const _hideTip = ()=>{ if(!warnBtn.classList.contains('var-warn-pinned')) warnTip.style.display='none'; };
    warnBtn.addEventListener('mouseenter', _showTip);
    warnBtn.addEventListener('mouseleave', _hideTip);
    warnBtn.addEventListener('click', e=>{
      e.stopPropagation();
      const pinned = warnBtn.classList.toggle('var-warn-pinned');
      if(pinned){ _positionTip(); warnTip.style.display='block'; } else { warnTip.style.display='none'; }
    });
    document.addEventListener('click', ()=>{ warnBtn.classList.remove('var-warn-pinned'); warnTip.style.display='none'; });
    warnBtn._tipEl = warnTip;
    item.appendChild(warnBtn);

    item.addEventListener('mousedown', e=>{
      if(e.button !== 0) return;
      const blocked = e.target.closest(
        'input[type="range"], input[type="number"], input[type="text"], ' +
        'button, .var-drag-handle, .var-warn-btn, .var-list-cell, ' +
        '.var-list-leninp, .var-param-bound, .var-scope-badge, .var-folder-badge'
      );
      if(blocked) return;
      if(e.target.closest('.mq-editable-field')) return;
      e.preventDefault();
      const mqField = item.querySelector('.mq-editable-field');
      if(mqField) mqField.click();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'var-item-del';
    delBtn.innerHTML = '✕';
    delBtn.addEventListener('click', e=>{ e.stopPropagation(); removeVariable(v.id); });

    if(v.kind === 'list'){
      const headerTop = document.createElement('div');
      headerTop.className = 'var-item-header';
      const badge = document.createElement('span');
      badge.className = `var-kind-badge var-kind-${v.kind}`;
      badge.textContent = 'List';
      headerTop.appendChild(badge);
      _appendScopeBadge(headerTop, v);
      _appendFolderBadge(headerTop, v, varSubset);
      if(v.pickleSource){
        const srcTag = document.createElement('span');
        srcTag.className = 'var-source-tag';
        srcTag.textContent = v.pickleSource;
        srcTag.title = `Imported from ${v.pickleSource}`;
        headerTop.appendChild(srcTag);
      }
      headerTop.appendChild(delBtn);
      inner.appendChild(headerTop);

      const headerBot = document.createElement('div');
      headerBot.className = 'var-list-subheader';
      const nameMqWrap = document.createElement('div');
      nameMqWrap.className = 'var-list-name-mq';
      nameMqWrap.id = `vnamemq_${v.id}`;
      const lenWrap  = document.createElement('div');
      lenWrap.className = 'var-list-lenrow';
      const lenLabel = document.createElement('span');
      lenLabel.className = 'var-list-lenlabel';
      lenLabel.textContent = 'n =';
      const lenInp = document.createElement('input');
      lenInp.type = 'number'; lenInp.className = 'var-list-leninp';
      lenInp.id = `vlen_${v.id}`; lenInp.value = v.listLength;
      lenInp.min = 1; lenInp.max = 999; lenInp.step = 1;
      headerBot.appendChild(nameMqWrap);
      lenWrap.appendChild(lenLabel); lenWrap.appendChild(lenInp);
      headerBot.appendChild(lenWrap);
      inner.appendChild(headerBot);

      requestAnimationFrame(()=>{
        if(!MQ) return;
        try{
          const nameMf = MQ.MathField(nameMqWrap, {
            spaceBehavesLikeTab: true,
            handlers:{
              edit(){
                const raw = nameMf.latex()
                  .replace(/\\text\{([^}]*)\}/g, '$1')
                  .replace(/[\\{}\s]/g,'').replace(/left|right/g,'').trim();
                if(raw) v.name = raw;
                reEvalAllConstants();
                updateLatexDropdown(nameMf, nameMqWrap, nameMqWrap);
              }
            }
          });
          const _nd = (v.name && v.name.length > 1) ? `\\text{${v.name}}` : (v.name || '');
          nameMf.latex(_nd);
          wrapMathFieldWithAC(nameMqWrap, nameMf);
        }catch(err){}
      });

      buildListBody(inner, v, lenInp);

    } else {
      const header = document.createElement('div');
      header.className = 'var-item-header';
      const badge = document.createElement('span');
      badge.className = `var-kind-badge var-kind-${v.kind}`;
      badge.textContent = v.kind === 'constant'
        ? 'Const' : v.kind.charAt(0).toUpperCase() + v.kind.slice(1);
      header.appendChild(badge);
      _appendScopeBadge(header, v);
      _appendFolderBadge(header, v, varSubset);
      if(v.pickleSource){
        const srcTag = document.createElement('span');
        srcTag.className = 'var-source-tag';
        srcTag.textContent = v.pickleSource;
        srcTag.title = `Imported from ${v.pickleSource}`;
        header.appendChild(srcTag);
      }
      header.appendChild(delBtn);
      inner.appendChild(header);

      if(v.kind === 'constant')       buildConstantBody(inner, v);
      else if(v.kind === 'parameter') buildParameterBody(inner, v);
      else if(v.kind === 'equation')  buildEquationBody(inner, v);
    }

    listEl.appendChild(item);
    return item;
  }; // end appendVarItem

  // ── Ungrouped vars (folder === null) ────────────────────────────────────
  varSubset.filter(v => !v.folder).forEach(appendVarItem);

  // ── Folder sections — in order of first appearance ──────────────────────
  const seenFolders = [];
  for(const v of varSubset){
    if(v.folder && !seenFolders.includes(v.folder)) seenFolders.push(v.folder);
  }

  for(const folderName of seenFolders){
    const folderVars   = varSubset.filter(v => v.folder === folderName);
    const collapseKey  = `${scopeId}::${folderName}`;
    const isCollapsed  = _folderCollapsed.has(collapseKey);

    // ── Folder header ────────────────────────────────────────────────────
    const fHeader = document.createElement('div');
    fHeader.className = 'var-folder-header';
    fHeader.dataset.folder = folderName;

    const toggle = document.createElement('span');
    toggle.className = 'var-folder-toggle' + (isCollapsed ? '' : ' open');
    toggle.textContent = '▶';
    fHeader.appendChild(toggle);

    const labelEl = document.createElement('span');
    labelEl.className = 'var-folder-label';
    labelEl.textContent = folderName;
    fHeader.appendChild(labelEl);

    const countEl = document.createElement('span');
    countEl.className = 'var-folder-count';
    countEl.textContent = `(${folderVars.length})`;
    fHeader.appendChild(countEl);

    const fDelBtn = document.createElement('button');
    fDelBtn.className = 'var-folder-del';
    fDelBtn.innerHTML = '&times;';
    fDelBtn.title = 'Remove folder — variables stay';
    fDelBtn.addEventListener('click', e=>{
      e.stopPropagation();
      for(const v of folderVars) v.folder = null;
      _folderCollapsed.delete(collapseKey);
      renderVariables();
      if(typeof snapshotForUndo === 'function') snapshotForUndo();
    });
    fHeader.appendChild(fDelBtn);

    // Double-click label → rename folder inline
    labelEl.addEventListener('dblclick', e=>{
      e.stopPropagation();
      _beginFolderRename(fHeader, labelEl, folderName, folderVars, collapseKey);
    });

    // Single click → toggle collapse
    fHeader.addEventListener('click', e=>{
      if(e.target.closest('.var-folder-del')) return;
      if(isCollapsed) _folderCollapsed.delete(collapseKey);
      else            _folderCollapsed.add(collapseKey);
      renderVariables();
    });

    listEl.appendChild(fHeader);

    // ── Folder's var items (hidden when collapsed) ───────────────────────
    folderVars.forEach(v => {
      const item = appendVarItem(v);
      if(isCollapsed) item.style.display = 'none';
    });
  }
}

// ═══ FOLDER SYSTEM ═══════════════════════════════════════════════════════
// Tracks which folder sections are collapsed. Key = "scopeId::folderName".
const _folderCollapsed = new Set();

// Appends a small folder badge to a variable card header.
// Clicking it opens a dropdown to assign / move the var to a folder.
function _appendFolderBadge(headerEl, v, allScopeVars){
  const badge = document.createElement('button');
  const hasFolder = !!v.folder;
  badge.className = 'var-folder-badge' + (hasFolder ? ' has-folder' : '');
  badge.title     = hasFolder ? `Folder: ${v.folder} — click to change` : 'No folder — click to organize';
  badge.textContent = hasFolder ? v.folder.slice(0, 8) : '⊞';
  badge.addEventListener('click', e=>{ e.stopPropagation(); _showFolderMenu(v, badge, allScopeVars); });
  badge.addEventListener('mousedown', e=>{ e.stopPropagation(); });
  headerEl.appendChild(badge);
}

let _folderMenuEl = null;

function _showFolderMenu(v, anchorEl, allScopeVars){
  if(_folderMenuEl){ _folderMenuEl.remove(); _folderMenuEl = null; }

  const menu = document.createElement('div');
  menu.className = 'var-folder-menu';
  _folderMenuEl = menu;

  const currentFolder = v.folder ?? null;
  const existingFolders = [...new Set(
    allScopeVars.map(sv => sv.folder).filter(Boolean)
  )].sort();

  const addRow = (label, folderVal, isCurrent, extraCls = '') => {
    const row = document.createElement('button');
    row.className = 'var-folder-menu-row' + (isCurrent ? ' active' : '') + (extraCls ? ' '+extraCls : '');
    row.textContent = label;
    row.addEventListener('mousedown', e=>{ e.preventDefault(); e.stopPropagation(); });
    row.addEventListener('click', e=>{
      e.stopPropagation();
      menu.remove(); _folderMenuEl = null;
      if(folderVal !== currentFolder){
        v.folder = folderVal;
        renderVariables();
        if(typeof snapshotForUndo === 'function') snapshotForUndo();
      }
    });
    menu.appendChild(row);
  };

  addRow('No folder', null, currentFolder === null);

  if(existingFolders.length){
    const sep = document.createElement('div'); sep.className = 'var-folder-menu-sep'; menu.appendChild(sep);
    existingFolders.forEach(f => addRow(f, f, currentFolder === f));
  }

  // "New folder" — replaces itself with an inline text input
  const sep2 = document.createElement('div'); sep2.className = 'var-folder-menu-sep'; menu.appendChild(sep2);
  const newRow = document.createElement('button');
  newRow.className = 'var-folder-menu-row var-folder-menu-new';
  newRow.textContent = '+ New folder';
  newRow.addEventListener('mousedown', e=>{ e.preventDefault(); e.stopPropagation(); });
  newRow.addEventListener('click', e=>{
    e.stopPropagation();
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = 'Folder name…';
    inp.style.cssText = [
      'display:block','width:calc(100% - 24px)','margin:4px 12px',
      'padding:3px 6px','background:var(--s2)','border:1px solid var(--acc2)',
      'border-radius:4px','color:var(--text)','font-family:var(--mono)',
      'font-size:.72rem','outline:none','box-sizing:border-box',
    ].join(';');
    newRow.replaceWith(inp);
    inp.focus();
    const commit = ()=>{
      const name = inp.value.trim();
      if(name){ v.folder = name; renderVariables(); if(typeof snapshotForUndo === 'function') snapshotForUndo(); }
      if(_folderMenuEl){ _folderMenuEl.remove(); _folderMenuEl = null; }
    };
    inp.addEventListener('keydown', e=>{
      if(e.key === 'Enter') { e.stopPropagation(); commit(); }
      if(e.key === 'Escape'){ e.stopPropagation(); menu.remove(); _folderMenuEl = null; }
    });
    // blur fires before the outside-click handler; short delay avoids double-close
    inp.addEventListener('blur', ()=>setTimeout(()=>{ if(_folderMenuEl) commit(); }, 120));
  });
  menu.appendChild(newRow);

  document.body.appendChild(menu);
  const r = anchorEl.getBoundingClientRect();
  menu.style.top  = (r.bottom + 4) + 'px';
  menu.style.left = r.left + 'px';
  requestAnimationFrame(()=>{
    const mw = menu.offsetWidth;
    if(r.left + mw > window.innerWidth - 8) menu.style.left = Math.max(8, r.right - mw) + 'px';
  });

  const outside = e=>{
    if(!menu.contains(e.target)){ menu.remove(); _folderMenuEl = null; document.removeEventListener('mousedown', outside); }
  };
  setTimeout(()=>document.addEventListener('mousedown', outside), 0);
}

// Inline rename: replaces the label span with a text input, commits on blur/Enter.
function _beginFolderRename(headerEl, labelEl, oldName, folderVars, collapseKey){
  const inp = document.createElement('input');
  inp.className = 'var-folder-label-inp';
  inp.value     = oldName;
  inp.maxLength = 40;
  labelEl.replaceWith(inp);
  inp.focus(); inp.select();

  const commit = ()=>{
    const newName = inp.value.trim() || oldName;
    // Rename all vars in this folder
    for(const v of folderVars) v.folder = newName;
    // Transfer collapse state to the new key
    if(newName !== oldName && _folderCollapsed.has(collapseKey)){
      _folderCollapsed.delete(collapseKey);
      const scopePart = collapseKey.split('::')[0];
      _folderCollapsed.add(`${scopePart}::${newName}`);
    }
    renderVariables();
    if(typeof snapshotForUndo === 'function') snapshotForUndo();
  };

  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e=>{
    if(e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    if(e.key === 'Escape'){ inp.value = oldName; inp.blur(); }
    e.stopPropagation();
  });
}

// ═══ SCOPE BADGE + MOVE MENU ═════════════════════════════════════════════
// Appends a small clickable scope badge to a header element.
function _appendScopeBadge(headerEl, v){
  const sc = v.scope ?? 'global';
  const isGlobal = sc === 'global';
  const badge = document.createElement('button');
  badge.className = 'var-scope-badge' + (isGlobal ? '' : ' scope-local');
  badge.title     = isGlobal ? 'Global — click to move' : 'Local — click to move';

  if(isGlobal){
    badge.textContent = 'G';
  } else {
    const tab = (typeof tabs !== 'undefined') ? tabs.find(t => t.id === sc) : null;
    badge.textContent = tab ? tab.name.slice(0, 4) : 'L';
  }

  badge.addEventListener('click', e=>{ e.stopPropagation(); _showScopeMoveMenu(v, badge); });
  badge.addEventListener('mousedown', e=>{ e.stopPropagation(); });
  headerEl.appendChild(badge);
}

let _scopeMenuEl = null;
function _showScopeMoveMenu(v, anchorEl){
  if(_scopeMenuEl){ _scopeMenuEl.remove(); _scopeMenuEl = null; }

  const menu = document.createElement('div');
  menu.className = 'var-scope-menu';
  _scopeMenuEl = menu;

  const currentScope = v.scope ?? 'global';
  const options = [
    { scope: 'global', label: 'Global' },
    ...((typeof tabs !== 'undefined') ? tabs.map(t=>({ scope: t.id, label: `${t.name} (local)` })) : []),
  ];

  options.forEach(opt=>{
    const row = document.createElement('button');
    row.className = 'var-scope-menu-row' + (opt.scope === currentScope ? ' active' : '');
    row.textContent = opt.label;
    row.addEventListener('mousedown', e=>{ e.preventDefault(); e.stopPropagation(); });
    row.addEventListener('click', e=>{
      e.stopPropagation();
      menu.remove(); _scopeMenuEl = null;
      if(opt.scope === currentScope) return;
      v.scope = opt.scope;
      renderVariables();
      if(typeof snapshotForUndo === 'function') snapshotForUndo();
    });
    menu.appendChild(row);
  });

  document.body.appendChild(menu);
  const r = anchorEl.getBoundingClientRect();
  menu.style.top  = (r.bottom + 4) + 'px';
  menu.style.left = r.left + 'px';
  // Flip left if it clips the right edge
  requestAnimationFrame(()=>{
    const mw = menu.offsetWidth;
    if(r.left + mw > window.innerWidth - 8) menu.style.left = Math.max(8, r.right - mw) + 'px';
  });

  const outside = e=>{ if(!menu.contains(e.target)){ menu.remove(); _scopeMenuEl=null; document.removeEventListener('mousedown', outside); } };
  setTimeout(()=>document.addEventListener('mousedown', outside), 0);
}

// ═══ CONSTANT BODY ═══════════════════════════════════════════════════════
// One MathField for "name = expr". Shows a slider when RHS is a plain number,
// or the evaluated result below when RHS is an expression.
function buildConstantBody(item, v){
  const mqWrap = document.createElement('div');
  mqWrap.className = 'var-mq-wrap var-mq-single-line';
  mqWrap.id = `vmq_${v.id}`;
  item.appendChild(mqWrap);

  // Result display — visible only in expression mode
  const resultEl = document.createElement('div');
  resultEl.className = 'var-result';
  resultEl.id = `vres_${v.id}`;
  item.appendChild(resultEl);

  // Slider row — visible only when RHS is a plain number
  const sliderWrap = document.createElement('div');
  sliderWrap.className = 'var-param-sliderrow';
  sliderWrap.id = `vslrow_${v.id}`;

  const minInp = document.createElement('input');
  minInp.type  = 'text'; minInp.className = 'var-param-bound';
  minInp.id    = `vpmin_${v.id}`; minInp.value = v.paramMin;

  const slider = document.createElement('input');
  slider.type  = 'range'; slider.className = 'var-param-slider';
  slider.id    = `vpslider_${v.id}`;
  slider.min   = v.paramMin; slider.max = v.paramMax;
  slider.step  = niceParamStep(v.paramMin, v.paramMax);
  slider.value = v.value;

  const maxInp = document.createElement('input');
  maxInp.type  = 'text'; maxInp.className = 'var-param-bound';
  maxInp.id    = `vpmax_${v.id}`; maxInp.value = v.paramMax;

  sliderWrap.appendChild(minInp);
  sliderWrap.appendChild(slider);
  sliderWrap.appendChild(maxInp);
  item.appendChild(sliderWrap);

  function isNumericRhs(expr){
    if(!expr || !expr.trim()) return false;
    const stripped = expr.replace(/\s+/g,'').replace(/^-/,'');
    return /^\d+\.?\d*$/.test(stripped) || /^\d*\.\d+$/.test(stripped);
  }

  // Switch between slider mode (numeric RHS) and expression mode.
  function updateMode(mf){
    const numericRhs = isNumericRhs(v.exprLatex);
    v._isNumeric = numericRhs;
    if(numericRhs){
      sliderWrap.classList.add('visible');
      resultEl.innerHTML = ''; resultEl.className = 'var-result';
      const num = parseFloat(v.exprLatex.replace(/[^\d.\-]/g,''));
      if(!isNaN(num)){ v.value = num; syncParamSlider(v); }
    } else {
      sliderWrap.classList.remove('visible');
      evaluateConstant(v);
    }
    reEvalAllConstants();
  }

  requestAnimationFrame(()=>{
    let _mf = null;
    let _prevLatex = '';
    _mf = makeMathField(mqWrap, {
      spaceBehavesLikeTab: true,
      handlers:{
        edit(){
          const prev  = _prevLatex;
          _prevLatex  = _mf.latex();
          v.fullLatex = _mf.latex();
          const parsed = parseVarLatex(v.fullLatex);
          v.name      = parsed.name;
          v.nameLatex = parsed.nameLatex;
          v.exprLatex = parsed.exprLatex;
          fixDecoratorCursor(_mf, prev);
          updateMode(_mf);
          checkAllWarnings();
          updateLatexDropdown(_mf, mqWrap, mqWrap);
        }
      }
    });
    if(_mf){
      if(v.fullLatex) _mf.latex(v.fullLatex);
      updateMode(_mf);
      wrapMathFieldWithAC(mqWrap, _mf);
    }

    // Slider moves value and updates the MathField display
    slider.addEventListener('input', ()=>{
      v.value = parseFloat(slider.value);
      if(_mf){
        const lhs      = v.nameLatex || v.name || 'a';
        const newLatex = `${lhs}=${formatParamVal(v.value)}`;
        _mf.latex(newLatex);
        v.fullLatex = _mf.latex();
        v.exprLatex = formatParamVal(v.value);
      }
      reEvalAllConstants();
    });

    minInp.addEventListener('change', ()=>{
      const n = parseFloat(minInp.value);
      if(!isNaN(n)){ v.paramMin = n; rebuildParamSlider(v); }
      else minInp.value = v.paramMin;
    });
    minInp.addEventListener('click', e=>e.stopPropagation());

    maxInp.addEventListener('change', ()=>{
      const n = parseFloat(maxInp.value);
      if(!isNaN(n)){ v.paramMax = n; rebuildParamSlider(v); }
      else maxInp.value = v.paramMax;
    });
    maxInp.addEventListener('click', e=>e.stopPropagation());
  });
}

// ═══ PARAMETER BODY ══════════════════════════════════════════════════════
// Single MathField showing "name = value" (numeric only) with a range slider.
function buildParameterBody(item, v){
  const mqWrap = document.createElement('div');
  mqWrap.className = 'var-mq-wrap var-mq-single-line';
  mqWrap.id = `vmq_${v.id}`;
  item.appendChild(mqWrap);

  const sliderWrap = document.createElement('div');
  sliderWrap.className = 'var-param-sliderrow';

  const minInp = document.createElement('input');
  minInp.type  = 'text'; minInp.className = 'var-param-bound';
  minInp.id    = `vpmin_${v.id}`; minInp.value = v.paramMin;

  const slider = document.createElement('input');
  slider.type  = 'range'; slider.className = 'var-param-slider';
  slider.id    = `vpslider_${v.id}`;
  slider.min   = v.paramMin; slider.max = v.paramMax;
  slider.step  = niceParamStep(v.paramMin, v.paramMax);
  slider.value = v.value;

  const maxInp = document.createElement('input');
  maxInp.type  = 'text'; maxInp.className = 'var-param-bound';
  maxInp.id    = `vpmax_${v.id}`; maxInp.value = v.paramMax;

  sliderWrap.appendChild(minInp);
  sliderWrap.appendChild(slider);
  sliderWrap.appendChild(maxInp);
  item.appendChild(sliderWrap);

  requestAnimationFrame(()=>{
    let _mf = null;

    _mf = makeMathField(mqWrap, {
      spaceBehavesLikeTab: true,
      handlers:{
        edit(){
          const latex  = _mf.latex();
          const eqIdx  = latex.indexOf('=');
          if(eqIdx >= 0){
            const namePart = latex.slice(0, eqIdx).trim().replace(/[\\{}\s]/g,'');
            if(namePart) v.name = namePart;
            const num = parseFloat(latex.slice(eqIdx + 1).replace(/[^\d.\-]/g,''));
            if(!isNaN(num)){
              v.value = num;
              syncParamSlider(v);
              reEvalAllConstants();
            }
          }
          updateLatexDropdown(_mf, mqWrap, mqWrap);
        }
      }
    });
    if(_mf){
      _mf.latex(`${v.name || 'p'}=${formatParamVal(v.value)}`);
      wrapMathFieldWithAC(mqWrap, _mf);
    }

    slider.addEventListener('input', ()=>{
      v.value = parseFloat(slider.value);
      if(_mf) _mf.latex(`${v.name || 'p'}=${formatParamVal(v.value)}`);
      reEvalAllConstants();
    });

    minInp.addEventListener('change', ()=>{
      const n = parseFloat(minInp.value);
      if(!isNaN(n)){ v.paramMin = n; rebuildParamSlider(v); }
      else minInp.value = v.paramMin;
    });
    minInp.addEventListener('click', e=>e.stopPropagation());

    maxInp.addEventListener('change', ()=>{
      const n = parseFloat(maxInp.value);
      if(!isNaN(n)){ v.paramMax = n; rebuildParamSlider(v); }
      else maxInp.value = v.paramMax;
    });
    maxInp.addEventListener('click', e=>e.stopPropagation());
  });
}

// ═══ EQUATION BODY ═══════════════════════════════════════════════════════
// Single MathField for a function definition, e.g. f(x) = 2x + 1.
function buildEquationBody(item, v){
  const mqWrap = document.createElement('div');
  mqWrap.className = 'var-mq-wrap var-mq-single-line';
  mqWrap.id = `vmq_${v.id}`;
  item.appendChild(mqWrap);

  requestAnimationFrame(()=>{
    const mf = makeMathField(mqWrap, {
      spaceBehavesLikeTab: true,
      handlers:{
        edit(){
          v.fullLatex = mf.latex();
          const eqIdx = v.fullLatex.indexOf('=');
          if(eqIdx >= 0){
            const nameMatch = v.fullLatex.slice(0, eqIdx).match(/^([a-zA-Z]+)/);
            if(nameMatch) v.name = nameMatch[1];
            v.exprLatex = v.fullLatex.slice(eqIdx + 1).trim();
          }
          validateEquationLatex(v.fullLatex, v);
          updateLatexDropdown(mf, mqWrap, mqWrap);
        }
      }
    });
    if(mf){
      const fname    = v.name || 'f';
      const initLatex = v.fullLatex || `${fname}\\left(x\\right)=${v.exprLatex || ''}`;
      mf.latex(initLatex);
      validateEquationLatex(mf.latex(), v);
      wrapMathFieldWithAC(mqWrap, mf);
    }
  });
}

// ═══ LIST BODY ═══════════════════════════════════════════════════════════
function buildListBody(item, v, lenInp){
  // Inline grid + edit-by-index row (only for numeric lists, not categorical)
  const cellsWrap = v._categorical ? null : document.createElement('div');
  if(cellsWrap) cellsWrap.className = 'var-list-cells';

  const editRow = v._categorical ? null : document.createElement('div');

  lenInp.addEventListener('input', ()=>{
    const num = parseFloat(lenInp.value);
    if(lenInp.value === '' || isNaN(num)){
      if(v._warning) v._warning.setInvalid('List length must be a positive integer');
    } else if(!Number.isInteger(num)){
      if(v._warning) v._warning.setInvalid('List length must be an integer');
    } else if(num < 1){
      if(v._warning) v._warning.setInvalid('List length must be at least 1');
    } else {
      if(v._warning) v._warning.clearInvalid();
    }
  });

  lenInp.addEventListener('change', ()=>{
    const num = parseFloat(lenInp.value);
    if(isNaN(num) || !Number.isInteger(num) || num < 1){
      lenInp.value = v.listLength;
      if(v._warning) v._warning.clearInvalid();
      return;
    }
    const n = Math.min(999, num);
    lenInp.value = n; v.listLength = n;
    while(v.listItems.length < n) v.listItems.push(0);
    v.listItems = v.listItems.slice(0, n);
    if(v._warning) v._warning.clearInvalid();
    // Update summary count
    const sumEl = document.getElementById(`vlistsummary_${v.id}`);
    if(sumEl) sumEl.textContent = `${v.listItems.length} values`;
    // Rebuild inline grid
    if(cellsWrap) rebuildListCells(v, cellsWrap);
    if(editRow)   rebuildEditIndex(v, editRow);
  });
  lenInp.addEventListener('click', e=>e.stopPropagation());

  // Summary row: count label + "View / Edit →" popup button
  const summaryRow = document.createElement('div');
  summaryRow.className = 'var-list-summary';

  const summaryText = document.createElement('span');
  summaryText.className = 'var-list-summary-text';
  summaryText.id = `vlistsummary_${v.id}`;
  if(v._categorical){
    summaryText.textContent = `${v._labels.length} levels`;
  } else {
    summaryText.textContent = `${v.listItems.length} values`;
    if(v.listItems.length > 0){
      const preview = v.listItems.slice(0, 3).map(x => {
        if(x === null || !isFinite(x)) return '—';
        return parseFloat(x.toPrecision(4)).toString();
      }).join(', ');
      summaryText.title = `[${preview}${v.listItems.length > 3 ? ', …' : ''}]`;
    }
  }

  const viewBtn = document.createElement('button');
  viewBtn.className = 'var-list-view-btn';
  viewBtn.textContent = 'View / Edit →';
  viewBtn.addEventListener('click', e=>{ e.stopPropagation(); _openListPopup(v); });

  summaryRow.appendChild(summaryText);
  summaryRow.appendChild(viewBtn);
  item.appendChild(summaryRow);

  // Inline cell grid (numeric lists only)
  if(cellsWrap){
    item.appendChild(cellsWrap);
    rebuildListCells(v, cellsWrap);
  }

  // "Edit index" row — shown only for long lists (> 8 items)
  if(editRow){
    editRow.className = 'var-list-editrow';
    editRow.id = `veditrow_${v.id}`;
    item.appendChild(editRow);
    rebuildEditIndex(v, editRow);
  }
}

// ═══ LIST POPUP MODAL ═════════════════════════════════════════════════════
let _listPopupVar  = null;
let _listPopupPage = 0;
const _LIST_POP_PG = 50;

function _openListPopup(v){
  _listPopupVar  = v;
  _listPopupPage = 0;

  let overlay = document.getElementById('listPopupOverlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id        = 'listPopupOverlay';
    overlay.className = 'list-popup-overlay';
    overlay.addEventListener('mousedown', e=>{ if(e.target === overlay) _closeListPopup(); });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="list-popup" id="listPopupMain">
      <div class="list-popup-header">
        <div class="list-popup-title">
          <span class="list-popup-varname">${v.name || `v${v.id}`}</span>
          <span class="list-popup-meta" id="listPopupMeta"></span>
        </div>
        <button class="list-popup-close" id="listPopupClose">&#10005;</button>
      </div>
      <div class="list-popup-body" id="listPopupBody"></div>
      <div class="list-popup-footer" id="listPopupFooter"></div>
    </div>`;

  overlay.style.display = 'flex';
  document.getElementById('listPopupClose')?.addEventListener('click', _closeListPopup);
  _renderListPopupPage();
}

function _closeListPopup(){
  const overlay = document.getElementById('listPopupOverlay');
  if(overlay) overlay.style.display = 'none';
  // Sync sidebar summary text, length inputs, and inline grid after any edits
  if(typeof variables !== 'undefined'){
    variables.forEach(v=>{
      if(v.kind !== 'list') return;
      const lenInp = document.getElementById(`vlen_${v.id}`);
      if(lenInp) lenInp.value = v.listLength;
      const sumEl = document.getElementById(`vlistsummary_${v.id}`);
      if(sumEl) sumEl.textContent = v._categorical
        ? `${v._labels.length} levels`
        : `${v.listItems.length} values`;
      // Rebuild inline cell grid so it reflects any popup edits
      if(!v._categorical){
        const cellsWrap = document.querySelector(`.var-item[data-vid="${v.id}"] .var-list-cells`);
        if(cellsWrap) rebuildListCells(v, cellsWrap);
        const editRow = document.getElementById(`veditrow_${v.id}`);
        if(editRow) rebuildEditIndex(v, editRow);
      }
    });
  }
  if(typeof refreshStatsVarSelectors === 'function') refreshStatsVarSelectors();
  _listPopupVar = null;
}

function _renderListPopupPage(){
  const v      = _listPopupVar;
  const body   = document.getElementById('listPopupBody');
  const footer = document.getElementById('listPopupFooter');
  const meta   = document.getElementById('listPopupMeta');
  if(!v || !body || !footer) return;

  const n = v._categorical ? v._labels.length : v.listItems.length;
  if(meta) meta.textContent = v._categorical ? `${n} levels` : `${n} values`;

  if(v._categorical && v._labels.length){
    const rows = v._labels.slice(0, 500).map((lbl, i) =>
      `<tr><td class="lp-td lp-idx">${i}</td>
            <td class="lp-td" style="text-align:left;color:var(--text)">${lbl}</td>
            <td class="lp-td">${v.listItems[i] ?? '—'}</td></tr>`
    ).join('');
    body.innerHTML = `
      <table class="lp-table">
        <thead><tr>
          <th class="lp-th lp-th-idx">#</th>
          <th class="lp-th" style="text-align:left">Label</th>
          <th class="lp-th">Count</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    footer.innerHTML = `
      <span class="lp-info">${n} categories · read-only</span>
      <button class="lp-btn lp-done-btn" id="lp_done">Close</button>`;
    document.getElementById('lp_done')?.addEventListener('click', _closeListPopup);
    return;
  }

  const totalPages = Math.ceil(v.listItems.length / _LIST_POP_PG) || 1;
  _listPopupPage   = Math.max(0, Math.min(_listPopupPage, totalPages - 1));
  const start = _listPopupPage * _LIST_POP_PG;
  const end   = Math.min(start + _LIST_POP_PG, v.listItems.length);

  const rows = [];
  for(let i = start; i < end; i++){
    rows.push(`<tr>
      <td class="lp-td lp-idx">${i}</td>
      <td class="lp-td"><input type="number" class="lp-inp" data-idx="${i}" value="${v.listItems[i]}" step="any"/></td>
    </tr>`);
  }

  body.innerHTML = `
    <table class="lp-table">
      <thead><tr>
        <th class="lp-th lp-th-idx">#</th>
        <th class="lp-th">Value</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;

  body.querySelectorAll('.lp-inp').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const idx = parseInt(inp.dataset.idx);
      const num = parseFloat(inp.value);
      if(!isNaN(num) && idx >= 0 && idx < v.listItems.length) v.listItems[idx] = num;
    });
  });

  footer.innerHTML = `
    <div class="lp-pagination">
      ${totalPages > 1 ? `
        <button class="lp-btn" id="lp_prev" ${_listPopupPage === 0 ? 'disabled' : ''}>&#8592; Prev</button>
        <span class="lp-info">Rows ${start}–${end - 1} of ${v.listItems.length - 1}</span>
        <button class="lp-btn" id="lp_next" ${_listPopupPage >= totalPages - 1 ? 'disabled' : ''}>Next &#8594;</button>
      ` : `<span class="lp-info">${v.listItems.length} values</span>`}
    </div>
    <div class="lp-actions">
      <button class="lp-btn lp-add-btn" id="lp_addRow">+ Add row</button>
      <button class="lp-btn lp-del-btn" id="lp_delRow" ${v.listItems.length <= 1 ? 'disabled' : ''}>&#8722; Last row</button>
      <button class="lp-btn lp-done-btn" id="lp_done">Done</button>
    </div>`;

  document.getElementById('lp_prev')?.addEventListener('click', ()=>{ _listPopupPage--; _renderListPopupPage(); });
  document.getElementById('lp_next')?.addEventListener('click', ()=>{ _listPopupPage++; _renderListPopupPage(); });
  document.getElementById('lp_addRow')?.addEventListener('click', ()=>{
    v.listItems.push(0);
    v.listLength = v.listItems.length;
    _listPopupPage = Math.floor((v.listItems.length - 1) / _LIST_POP_PG);
    _renderListPopupPage();
  });
  document.getElementById('lp_delRow')?.addEventListener('click', ()=>{
    if(v.listItems.length > 1){
      v.listItems.pop();
      v.listLength = v.listItems.length;
      _listPopupPage = Math.min(_listPopupPage, Math.ceil(v.listItems.length / _LIST_POP_PG) - 1);
      _renderListPopupPage();
    }
  });
  document.getElementById('lp_done')?.addEventListener('click', _closeListPopup);
}

// Rebuild the edit-by-index footer for lists longer than the display threshold.
function rebuildEditIndex(v, editRow){
  const THRESH = 8;
  const n = v.listItems.length;
  editRow.innerHTML = '';
  if(n <= THRESH) return;

  editRow.style.cssText = 'display:flex;flex-direction:column;gap:5px';

  const midIdx = Math.floor((n - 1) / 2);
  if(v._editIdx === undefined || v._editIdx >= n) v._editIdx = midIdx;

  const label = document.createElement('span');
  label.className   = 'var-list-editlabel';
  label.textContent = 'Edit index';
  editRow.appendChild(label);

  const controlRow = document.createElement('div');
  controlRow.className = 'var-list-editcontrols';

  const leftBtn = document.createElement('button');
  leftBtn.className   = 'var-list-editarrow';
  leftBtn.textContent = '‹';
  leftBtn.title       = 'Previous index';

  const idxInp = document.createElement('input');
  idxInp.type  = 'number'; idxInp.className = 'var-list-editidx';
  idxInp.min   = 0; idxInp.max = n - 1; idxInp.step = 1;
  idxInp.placeholder = 'idx';
  idxInp.value = v._editIdx;

  const rightBtn = document.createElement('button');
  rightBtn.className   = 'var-list-editarrow';
  rightBtn.textContent = '›';
  rightBtn.title       = 'Next index';

  const valInp = document.createElement('input');
  valInp.type  = 'number'; valInp.className = 'var-list-editval';
  valInp.step  = 'any';
  valInp.value = v.listItems[v._editIdx];
  valInp.placeholder = 'value';

  function setIdx(idx){
    const clamped = Math.max(0, Math.min(n - 1, idx));
    v._editIdx  = clamped;
    idxInp.value = clamped;
    valInp.value = v.listItems[clamped];
  }

  leftBtn.addEventListener('click',  e=>{ e.stopPropagation(); setIdx(v._editIdx - 1); });
  rightBtn.addEventListener('click', e=>{ e.stopPropagation(); setIdx(v._editIdx + 1); });
  idxInp.addEventListener('input',  ()=>{ const raw=parseInt(idxInp.value); if(!isNaN(raw)) setIdx(raw); });
  idxInp.addEventListener('click',  e=>e.stopPropagation());
  valInp.addEventListener('input',  ()=>{
    const num = parseFloat(valInp.value);
    if(!isNaN(num) && v._editIdx >= 0 && v._editIdx < n) v.listItems[v._editIdx] = num;
  });
  valInp.addEventListener('click',  e=>e.stopPropagation());

  controlRow.appendChild(leftBtn);
  controlRow.appendChild(idxInp);
  controlRow.appendChild(rightBtn);
  controlRow.appendChild(valInp);
  editRow.appendChild(controlRow);
}

// Render the cell grid for a list. Lists longer than THRESH show head/tail rows
// with an ellipsis in between.
function rebuildListCells(v, cellsWrap){
  cellsWrap.innerHTML = '';
  const n = v.listItems.length;
  const THRESH = 8, HEAD = 4, TAIL = 4;

  function makeCell(i){
    const cellWrap = document.createElement('div');
    cellWrap.className = 'var-list-cell-wrap';

    const idx = document.createElement('span');
    idx.className   = 'var-list-idx';
    idx.textContent = i;

    const cell = document.createElement('input');
    cell.type  = 'number'; cell.className = 'var-list-cell';
    cell.value = v.listItems[i]; cell.step = 'any';
    cell.addEventListener('input', ()=>{
      const num = parseFloat(cell.value);
      v.listItems[i] = isNaN(num) ? 0 : num;
    });
    cell.addEventListener('click', e=>e.stopPropagation());
    cell.addEventListener('keydown', e=>{
      if(e.key === 'Tab'){
        e.preventDefault();
        const cells = cellsWrap.querySelectorAll('.var-list-cell');
        const pos   = [...cells].indexOf(cell);
        const next  = cells[e.shiftKey ? pos - 1 : pos + 1];
        if(next) next.focus();
      }
    });

    cellWrap.appendChild(idx);
    cellWrap.appendChild(cell);
    return cellWrap;
  }

  if(n <= THRESH){
    const row = document.createElement('div');
    row.className = 'var-list-row';
    for(let i = 0; i < n; i++) row.appendChild(makeCell(i));
    cellsWrap.appendChild(row);
  } else {
    // Head row
    const headRow = document.createElement('div');
    headRow.className = 'var-list-row';
    for(let i = 0; i < HEAD; i++) headRow.appendChild(makeCell(i));
    cellsWrap.appendChild(headRow);

    // Ellipsis
    const ellipsisRow = document.createElement('div');
    ellipsisRow.className = 'var-list-ellipsis-row';
    const ellipsis = document.createElement('span');
    ellipsis.className   = 'var-list-ellipsis';
    ellipsis.textContent = '⋯';
    ellipsis.title = `${n - HEAD - TAIL} hidden item${n - HEAD - TAIL !== 1 ? 's' : ''}`;
    ellipsisRow.appendChild(ellipsis);
    cellsWrap.appendChild(ellipsisRow);

    // Tail row
    const tailRow = document.createElement('div');
    tailRow.className = 'var-list-row';
    for(let i = n - TAIL; i < n; i++) tailRow.appendChild(makeCell(i));
    cellsWrap.appendChild(tailRow);
  }
}

// ═══ TEMPLATE → VARIABLES SYNC ═══════════════════════════════════════════
// Called when a template is applied; syncs its parameters to the variables panel.
function syncTemplateParamsToVars(tplKey, params){
  if(!TEMPLATES || !TEMPLATES[tplKey]) return;
  const tplParams = TEMPLATES[tplKey].params;
  for(const [pk, pd] of Object.entries(tplParams)){
    const currentVal = params[pk] ?? pd.default;
    const existing   = variables.find(v=>v.fromTemplate && v.templateKey===tplKey && v.paramKey===pk);
    if(existing){
      existing.value      = currentVal;
      existing.exprLatex  = String(currentVal);
      existing.fullLatex  = `${pk}=${currentVal}`;
      existing._isNumeric = true;
      if(document.getElementById(`vpslider_${existing.id}`)) syncParamSlider(existing);
    } else {
      addVariable('constant', {
        name: pk, value: currentVal,
        exprLatex: String(currentVal), fullLatex: `${pk}=${currentVal}`,
        paramMin: pd.min, paramMax: pd.max,
        fromTemplate: true, templateKey: tplKey, paramKey: pk,
        silent: true, scope: 'global',
      });
    }
  }
  setSbTab('vars');
}

// ═══ PICKLE IMPORT ═══════════════════════════════════════════════════════
// Import variables from a parsed .pickle file (called by sidebars.js).
// Naming: single-char keys are used as-is; multi-char keys are wrapped in \text{}.
function importPickleVars(data, sourceName, scope='global'){
  for(const [rawKey, info] of Object.entries(data)){
    const isSingleChar = rawKey.length === 1;
    const latexName    = isSingleChar ? rawKey : `\\text{${rawKey}}`;

    if(info.kind === 'constant'){
      const existing = variables.find(v=>v.name===rawKey && v.pickleSource===sourceName);
      if(existing){
        existing.exprLatex  = String(info.value);
        existing.fullLatex  = `${latexName}=${info.value}`;
        existing._isNumeric = true;
        existing.value      = info.value;
        existing.scope      = scope;
        renderVariables();
      } else {
        addVariable('constant', {
          name: rawKey, value: info.value,
          exprLatex: String(info.value), fullLatex: `${latexName}=${info.value}`,
          pickleSource: sourceName, silent: true, scope,
        });
      }
    } else if(info.kind === 'list'){
      const existing  = variables.find(v=>v.name===rawKey && v.pickleSource===sourceName);
      const items     = (info.items || []).map(Number);
      const isCat     = !!info._categorical;
      const labels    = info._labels ? [...info._labels] : [];
      if(existing){
        existing.listItems    = items;
        existing.listLength   = items.length;
        existing._categorical = isCat;
        existing._labels      = labels;
        existing.scope        = scope;
        renderVariables();
      } else {
        addVariable('list', {
          name: rawKey, listItems: items, listLength: items.length,
          pickleSource: sourceName, silent: true, scope,
          _categorical: isCat, _labels: labels,
        });
      }
    }
  }
  // Navigate to the pane that received the import
  if(scope === 'global') setSbTab('vars');
  else setSbTab('files');
  if (typeof refreshStatsVarSelectors === 'function') refreshStatsVarSelectors();
  if (typeof renderDataTable === 'function' && typeof _statsTab !== 'undefined' && _statsTab === 'data') renderDataTable();
}
