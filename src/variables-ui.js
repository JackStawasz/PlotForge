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
    datasetCols:   opts.datasetCols
      ? opts.datasetCols.map(c => ({ name: c.name, values: [...c.values] }))
      : (kind === 'dataset'
          ? [{ name: 'col1', values: [null, null, null] }, { name: 'col2', values: [null, null, null] }]
          : undefined),
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
    { key:'dataset',  icon:'⊞',   label:'Dataset',  desc:'Rows & columns'       },
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

  // Template row
  const tplRow = document.createElement('button');
  tplRow.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;background:transparent;border:none;padding:9px 14px;cursor:pointer;transition:background .08s;text-align:left;';
  tplRow.innerHTML = `<span style="font-size:1.05rem;width:22px;text-align:center;flex-shrink:0;color:var(--acc2);opacity:.85">▨</span>`
    + `<span><span style="color:var(--text);font-size:.8rem;display:block">Template</span>`
    + `<span style="color:var(--muted);font-size:.68rem">Constants & functions</span></span>`;
  tplRow.addEventListener('mouseenter', ()=>{ tplRow.style.background='rgba(90,255,206,.07)'; });
  tplRow.addEventListener('mouseleave', ()=>{ tplRow.style.background='transparent'; });
  tplRow.addEventListener('mousedown', e=>{ e.preventDefault(); e.stopPropagation(); });
  tplRow.addEventListener('click', e=>{
    e.stopPropagation(); hideVarTypePicker();
    if(typeof openTemplateModal === 'function') openTemplateModal('variable', pickerScope);
  });
  picker.appendChild(tplRow);

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
    // Cursor is directly over a var-item — insert adjacent to it inside
    // whichever container (list or var-folder-group) owns that item.
    const r = target.getBoundingClientRect();
    const targetParent = target.parentNode;
    if(e.clientY < r.top + r.height / 2){
      if(placeholder.nextSibling !== target) targetParent.insertBefore(placeholder, target);
    } else {
      if(target.nextSibling !== placeholder) targetParent.insertBefore(placeholder, target.nextSibling);
    }
  } else {
    // Cursor is not over any var-item (e.g. hovering a folder header, between
    // groups, or in empty list space).  Walk top-level children so the user
    // can escape into the ungrouped area or reorder between groups.
    const topEls = [...list.children].filter(el =>
      (el.classList.contains('var-item') || el.classList.contains('var-folder-group')) &&
      el !== placeholder
    );
    let best = null, insertBefore = true;
    for(const el of topEls){
      const r = el.getBoundingClientRect();
      if(e.clientY < r.top){
        best = el; insertBefore = true; break;
      } else if(e.clientY <= r.bottom){
        best = el; insertBefore = false; break;
      }
    }
    if(best){
      if(insertBefore){
        if(placeholder.nextSibling !== best) list.insertBefore(placeholder, best);
      } else if(best.classList.contains('var-folder-group')){
        // Cursor is inside a folder group — place placeholder inside it
        // (after the folder header) so dropping assigns the var to this folder
        const header = best.querySelector('.var-folder-header');
        const refNode = header ? header.nextSibling : null;
        if(placeholder.parentNode !== best || placeholder !== refNode)
          best.insertBefore(placeholder, refNode || null);
      } else {
        if(best.nextSibling !== placeholder) list.insertBefore(placeholder, best.nextSibling);
      }
    }
  }
}

function _varDragEnd(e){
  if(!_varDrag) return;
  document.removeEventListener('pointermove', _varDragMove);
  document.removeEventListener('pointerup',   _varDragEnd);

  const { srcId, scopeIds, srcItem, clone, placeholder, list } = _varDrag;
  clone.remove();
  // NOTE: srcItem is intentionally left hidden (display:'none') during the
  // DOM walk below.  Restoring it now would make it appear at its original
  // position AND let the placeholder represent it at the new position,
  // causing srcId to be pushed twice into newScopeIds (corrupting the
  // slot-swap and making items bleed into the wrong folder or vanish).

  if(list.contains(placeholder)){
    // Walk the DOM to determine new order AND folder assignments.
    // Top-level children of `list` are ungrouped var-items or var-folder-group
    // containers; the placeholder may live at either level.
    const newScopeIds = [];
    const folderByVid = {};

    const walkContainer = (container, folderName) => {
      for(const child of container.children){
        if(child.classList.contains('var-folder-header')) continue; // metadata — skip
        if(child === placeholder){
          newScopeIds.push(srcId);
          folderByVid[srcId] = folderName;
        } else if(child.classList.contains('var-item') && child !== srcItem){
          // srcItem is display:none — but guard by identity too so collapsed
          // clones can never sneak in.
          const vid = parseInt(child.dataset.vid);
          newScopeIds.push(vid);
          folderByVid[vid] = folderName;
        } else if(child.classList.contains('var-folder-group')){
          // Read folder name from the group's own dataset (set at render time)
          // — more reliable than querying for the header element.
          const gFolder = child.dataset.folder || null;
          walkContainer(child, gFolder);
        }
      }
    };
    walkContainer(list, null);

    if(!newScopeIds.includes(srcId)){ newScopeIds.push(srcId); folderByVid[srcId] = null; }

    // Re-append any collapsed (hidden) vars that were invisible during the walk.
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

      renderVariables(); // re-renders everything — srcItem restoration happens here
      reEvalAllConstants();
      if(typeof snapshotForUndo === 'function') snapshotForUndo();
    } else {
      // No data change — just restore srcItem in place (no full re-render needed).
      srcItem.style.display = '';
    }
  } else {
    // Placeholder was orphaned (drag cancelled or pointer released outside list).
    placeholder.remove();
    srcItem.style.display = '';
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
    const tip = btn._tipEl || btn.querySelector('.var-warn-tip');
    const msg = this._dupMsg || this._invalidMsg; // duplicate takes priority
    if(msg){
      btn.classList.add('var-warn-active');
      btn.innerHTML = '&#9888;'; // ⚠ warning triangle
      btn.setAttribute('aria-label', msg);
      if(tip) tip.textContent = msg;
    } else {
      btn.classList.remove('var-warn-active');
      btn.innerHTML = '&#9881;'; // ⚙ gear
      btn.setAttribute('aria-label', 'Variable settings');
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
    // Dataset-specific: warn about incomplete rows
    if(v.kind === 'dataset' && v.datasetCols && v.datasetCols.length > 0){
      const maxRows = Math.max(0, ...v.datasetCols.map(c => c.values.length));
      const hasEmpty = maxRows > 0 && v.datasetCols.some(col =>
        col.values.length < maxRows ||
        col.values.some(val => val === null || val === undefined || val === '')
      );
      if(hasEmpty) v._warning.setInvalid('Dataset has rows with missing or empty values');
      else v._warning.clearInvalid();
    }
  }
}

// Re-evaluate all constant variables (call after any context-affecting change).
function reEvalAllConstants(){
  for(const v of variables){
    if(v.kind === 'constant') evaluateConstant(v);
  }
}

// ── Reactive curve re-render ──────────────────────────────────────────────
// Re-renders every plot that has at least one equation-variable curve.
// Immediate: used for slider/live-value updates.
// Debounced: used for keyboard edits to avoid redrawing on every keystroke.
function _rerenderVarCurves(){
  if(typeof plots === 'undefined' || typeof renderJS !== 'function') return;
  for(const p of plots){
    if(p.curves.some(c => c.varName)) renderJS(p.id);
  }
}
let _rerenderVarTimer = null;
function _scheduleRerenderVarCurves(){
  clearTimeout(_rerenderVarTimer);
  _rerenderVarTimer = setTimeout(_rerenderVarCurves, 150);
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

  const gHasFolders = [..._persistedFolders].some(k => k.startsWith('global::'));
  const lHasFolders = localTabId != null
    ? [..._persistedFolders].some(k => k.startsWith(`${localTabId}::`)) : false;
  if(gEmpty) gEmpty.style.display = (globalVars.length || gHasFolders) ? 'none' : 'flex';
  if(lEmpty) lEmpty.style.display  = (localVars.length  || lHasFolders)  ? 'none' : 'flex';

  if(gList) _renderVarSubset(gList, globalVars, 'global');
  if(lList) _renderVarSubset(lList, localVars, localTabId ?? 'global');

  requestAnimationFrame(()=> checkAllWarnings());
}

// Renders a scoped subset of variables into listEl, grouped by folder.
// Ungrouped vars appear first; each folder is a collapsible section after them.
function _renderVarSubset(listEl, varSubset, scopeId = 'global'){
  listEl.innerHTML = '';
  const scopeIds = varSubset.map(v => v.id);

  // Persist all currently-used folders so they survive having zero vars
  for(const v of varSubset){
    if(v.folder) _persistedFolders.add(`${scopeId}::${v.folder}`);
  }

  // ── Inner closure: build and append one variable card ──────────────────
  // containerEl defaults to listEl; pass a var-folder-group to nest inside one.
  const appendVarItem = (v, containerEl = listEl) => {
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

    // ── Settings / warning button + tooltip ─────────────────────────────
    // Shows a gear (settings) by default; swaps to ⚠ when a warning is active.
    const warnBtn = document.createElement('div');
    warnBtn.className = 'var-warn-btn';
    warnBtn.dataset.vid = v.id;
    warnBtn.innerHTML   = '&#9881;'; // ⚙ gear — flips to ⚠ via VarWarning._apply()
    warnBtn.setAttribute('aria-label', 'Variable settings');
    const warnTip = document.createElement('div');
    warnTip.className   = 'var-warn-tip';
    warnTip.textContent = 'No errors';
    document.body.appendChild(warnTip);
    const _positionTip = ()=>{ const r=warnBtn.getBoundingClientRect(); warnTip.style.top=(r.bottom+4)+'px'; warnTip.style.left=r.left+'px'; };
    const _showTip = ()=>{ if(!warnBtn.classList.contains('var-warn-active')) return; _positionTip(); warnTip.style.display='block'; };
    const _hideTip = ()=>{ if(!warnBtn.classList.contains('var-warn-pinned')) warnTip.style.display='none'; };
    warnBtn.addEventListener('mouseenter', _showTip);
    warnBtn.addEventListener('mouseleave', _hideTip);
    warnBtn.addEventListener('click', e=>{
      e.stopPropagation();
      if(warnBtn.classList.contains('var-warn-active')){
        const pinned = warnBtn.classList.toggle('var-warn-pinned');
        if(pinned){ _positionTip(); warnTip.style.display='block'; } else { warnTip.style.display='none'; }
      } else {
        _showVarSettingsMenu(v, warnBtn, varSubset);
      }
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

    } else if(v.kind === 'dataset'){
      const headerTop = document.createElement('div');
      headerTop.className = 'var-item-header';
      const badge = document.createElement('span');
      badge.className = 'var-kind-badge var-kind-dataset';
      badge.textContent = 'Dataset';
      headerTop.appendChild(badge);
      headerTop.appendChild(delBtn);
      inner.appendChild(headerTop);

      const nameInp = document.createElement('input');
      nameInp.type        = 'text';
      nameInp.className   = 'var-dataset-name-inp';
      nameInp.placeholder = 'dataset name';
      nameInp.value       = v.name || '';
      nameInp.addEventListener('input', ()=>{
        v.name = nameInp.value.trim();
        checkAllWarnings();
      });
      nameInp.addEventListener('change', ()=>{
        if(typeof snapshotForUndo === 'function') snapshotForUndo();
      });
      nameInp.addEventListener('click', e=>e.stopPropagation());
      inner.appendChild(nameInp);

      buildDatasetBody(inner, v);

    } else {
      const header = document.createElement('div');
      header.className = 'var-item-header';
      const badge = document.createElement('span');
      badge.className = `var-kind-badge var-kind-${v.kind}`;
      badge.textContent = v.kind === 'constant'
        ? 'Const' : v.kind.charAt(0).toUpperCase() + v.kind.slice(1);
      header.appendChild(badge);
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

    containerEl.appendChild(item);
    return item;
  }; // end appendVarItem

  // ── Build / sync the desired folder render order for this scope ─────────
  // _folderRenderOrder is the canonical folder sequence (updated by drags).
  // New folders (from vars or _persistedFolders) are appended at the end.
  // Stale folder names (no longer in _persistedFolders or vars) are pruned.
  const scopeKey = String(scopeId);
  let desiredFolderOrder = _folderRenderOrder.get(scopeKey);
  if(!desiredFolderOrder){ desiredFolderOrder = []; _folderRenderOrder.set(scopeKey, desiredFolderOrder); }

  // Append any new folders not yet tracked
  for(const v of varSubset){
    if(v.folder && !desiredFolderOrder.includes(v.folder)) desiredFolderOrder.push(v.folder);
  }
  for(const key of _persistedFolders){
    const sep = key.indexOf('::');
    if(sep < 0) continue;
    const sid = key.slice(0, sep), fname = key.slice(sep + 2);
    if(sid === scopeKey && !desiredFolderOrder.includes(fname)) desiredFolderOrder.push(fname);
  }
  // Prune folders that are no longer alive in this scope
  const aliveFolders = new Set();
  for(const v of varSubset){ if(v.folder) aliveFolders.add(v.folder); }
  for(const key of _persistedFolders){
    const sep = key.indexOf('::');
    if(sep >= 0 && key.slice(0, sep) === scopeKey) aliveFolders.add(key.slice(sep + 2));
  }
  for(let i = desiredFolderOrder.length - 1; i >= 0; i--){
    if(!aliveFolders.has(desiredFolderOrder[i])) desiredFolderOrder.splice(i, 1);
  }

  // ── Render ungrouped vars and folder groups in variables-array order ─────
  // A non-empty folder group is inserted where its first variable appears in
  // varSubset. Before rendering each non-empty folder, any empty folders that
  // precede it in desiredFolderOrder are rendered first, preserving drag order.
  // Remaining empty folders (those that come after all non-empty ones) follow.
  const renderedFolders = new Set();

  const renderEmptyFoldersBefore = (upToFolderName) => {
    const limit = desiredFolderOrder.indexOf(upToFolderName);
    for(let i = 0; i < limit; i++){
      const fn = desiredFolderOrder[i];
      if(!renderedFolders.has(fn) && varSubset.filter(v => v.folder === fn).length === 0)
        appendFolderGroup(fn);
    }
  };

  const appendFolderGroup = (folderName) => {
    if(renderedFolders.has(folderName)) return;
    renderedFolders.add(folderName);

    const folderVars  = varSubset.filter(v => v.folder === folderName);
    const collapseKey = `${scopeId}::${folderName}`;
    const isCollapsed = _folderCollapsed.has(collapseKey);

    // ── Outer group container ─────────────────────────────────────────────
    const group = document.createElement('div');
    group.className = 'var-folder-group';
    group.dataset.folder = folderName;
    if(isCollapsed) group.dataset.collapsed = '1';

    // ── Folder header ─────────────────────────────────────────────────────
    const fHeader = document.createElement('div');
    fHeader.className = 'var-folder-header';
    fHeader.dataset.folder = folderName;

    // Drag handle — must come first so it's visually leftmost
    const fDragHandle = document.createElement('span');
    fDragHandle.className = 'var-folder-drag-handle';
    fDragHandle.textContent = '⠿';
    fDragHandle.title = 'Drag to reorder folder';
    fHeader.appendChild(fDragHandle);

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
    countEl.textContent = folderVars.length > 0 ? `(${folderVars.length})` : '(empty)';
    fHeader.appendChild(countEl);

    const fDelBtn = document.createElement('button');
    fDelBtn.className = 'var-folder-del';
    fDelBtn.innerHTML = '&times;';
    fDelBtn.title = 'Remove folder — variables stay';
    fDelBtn.addEventListener('click', e=>{
      e.stopPropagation();
      for(const v of folderVars) v.folder = null;
      _folderCollapsed.delete(collapseKey);
      _persistedFolders.delete(collapseKey);
      const _fro = _folderRenderOrder.get(scopeKey);
      if(_fro){ const _fi = _fro.indexOf(folderName); if(_fi >= 0) _fro.splice(_fi, 1); }
      renderVariables();
      if(typeof snapshotForUndo === 'function') snapshotForUndo();
    });
    fHeader.appendChild(fDelBtn);

    // Double-click label → rename folder inline
    labelEl.addEventListener('dblclick', e=>{
      e.stopPropagation();
      _beginFolderRename(fHeader, labelEl, folderName, folderVars, collapseKey);
    });

    // Toggle arrow: primary expand/collapse click target
    const doToggle = () => {
      if(isCollapsed) _folderCollapsed.delete(collapseKey);
      else            _folderCollapsed.add(collapseKey);
      renderVariables();
    };
    toggle.addEventListener('click', e=>{ e.stopPropagation(); doToggle(); });

    // Clicking the rest of the header (but not the del button, drag handle, or rename)
    // also toggles, for convenience.
    fHeader.addEventListener('click', e=>{
      if(e.target.closest('.var-folder-del'))         return;
      if(e.target.closest('.var-folder-toggle'))      return;
      if(e.target.closest('.var-folder-drag-handle')) return;
      doToggle();
    });

    // ── Folder drag handle — wire pointerdown ─────────────────────────────
    fDragHandle.addEventListener('pointerdown', e=>{
      if(e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      _folderDragPending.on           = true;
      _folderDragPending.startX       = e.clientX;
      _folderDragPending.startY       = e.clientY;
      _folderDragPending.group        = group;
      _folderDragPending.folderName   = folderName;
      _folderDragPending.scopeId      = scopeId;
      _folderDragPending.listEl       = listEl;
      _folderDragPending.allScopeIds  = [...scopeIds];
    });

    group.appendChild(fHeader);

    // ── Folder's var items (hidden when collapsed) ────────────────────────
    folderVars.forEach(v => {
      const item = appendVarItem(v, group);
      if(isCollapsed) item.style.display = 'none';
    });

    listEl.appendChild(group);
  };

  // Single pass: bare vars render immediately; on first encounter of a folder's
  // member, render any empty folders that come before it (per desiredFolderOrder),
  // then render the folder group itself.
  for(const v of varSubset){
    if(!v.folder){
      appendVarItem(v);
    } else if(!renderedFolders.has(v.folder)){
      renderEmptyFoldersBefore(v.folder);
      appendFolderGroup(v.folder);
    }
  }

  // Render any remaining folders in desired order (all are empty at this point).
  for(const fn of desiredFolderOrder){
    if(!renderedFolders.has(fn)) appendFolderGroup(fn);
  }
}

// ═══ FOLDER SYSTEM ═══════════════════════════════════════════════════════
// Tracks which folder sections are collapsed. Key = "scopeId::folderName".
const _folderCollapsed = new Set();

// Tracks all ever-created folders so they persist when empty.
// Key = "scopeId::folderName". Cleared only on explicit × delete.
const _persistedFolders = new Set();

// Tracks the intended render order of folder groups per scope (both empty and non-empty).
// Key = scopeId (as string). Value = ordered string[] of folder names.
// Updated by folder-drag-end; new folders are appended automatically during render.
const _folderRenderOrder = new Map();

// ── Folder drag-to-reorder ────────────────────────────────────────────────
const _folderDragPending = {
  on: false, startX: 0, startY: 0,
  group: null, folderName: null, scopeId: null, listEl: null, allScopeIds: null,
};
let _folderDrag = null;

(()=>{
  document.addEventListener('pointermove', e=>{
    if(_folderDragPending.on && !_folderDrag){
      if(Math.abs(e.clientX - _folderDragPending.startX) > 5 ||
         Math.abs(e.clientY - _folderDragPending.startY) > 5){
        const p = _folderDragPending;
        p.on = false;
        _folderDragStart(e, p.group, p.folderName, p.scopeId, p.listEl, p.allScopeIds);
      }
    } else if(_folderDrag){
      _folderDragMove(e);
    }
  });
  const endOrCancel = () => { _folderDragPending.on = false; _folderDragEnd(); };
  document.addEventListener('pointerup',     endOrCancel);
  document.addEventListener('pointercancel', endOrCancel);
})();

function _folderDragStart(e, group, folderName, scopeId, listEl, allScopeIds){
  const rect = group.getBoundingClientRect();

  const ghost = document.createElement('div');
  ghost.className = 'var-folder-ghost';
  ghost.textContent = `📁 ${folderName}`;
  ghost.style.cssText = [
    'position:fixed', 'z-index:99999', 'pointer-events:none',
    `left:${rect.left}px`, `top:${rect.top}px`, `width:${rect.width}px`,
    'opacity:.9', 'box-shadow:0 8px 28px rgba(0,0,0,.55)',
  ].join(';');
  document.body.appendChild(ghost);

  const ph = document.createElement('div');
  ph.className = 'var-drag-placeholder';
  ph.style.height = rect.height + 'px';
  group.before(ph);
  group.style.opacity = '0.25';
  group.style.pointerEvents = 'none';

  _folderDrag = {
    folderName, scopeId, listEl, allScopeIds,
    ghost, placeholder: ph, group,
    offY: e.clientY - rect.top,
  };
}

function _folderDragMove(e){
  if(!_folderDrag) return;
  const { ghost, placeholder, offY, listEl, group } = _folderDrag;

  ghost.style.top = (e.clientY - offY) + 'px';

  const topEls = [...listEl.children].filter(el =>
    (el.classList.contains('var-item') || el.classList.contains('var-folder-group')) &&
    el !== group && el !== placeholder
  );
  let insertBefore = null;
  for(const el of topEls){
    const r = el.getBoundingClientRect();
    if(e.clientY < r.top + r.height / 2){ insertBefore = el; break; }
  }
  if(insertBefore){ if(placeholder.nextSibling !== insertBefore) listEl.insertBefore(placeholder, insertBefore); }
  else             { if(listEl.lastChild !== placeholder)         listEl.appendChild(placeholder); }
}

function _folderDragEnd(){
  if(!_folderDrag) return;
  const { folderName, scopeId, listEl, allScopeIds, ghost, placeholder, group } = _folderDrag;
  _folderDrag = null;
  ghost.remove();

  // Walk the DOM in its current order to determine:
  // 1. New variable sequence (for non-empty folders)
  // 2. New folder render order (for all folders, including empty ones)
  const newOrderedIds  = [];
  const newFolderOrder = [];
  const walkContainer = (container) => {
    for(const child of container.children){
      if(child.classList.contains('var-folder-header')) continue;
      if(child === placeholder){
        variables.filter(v => String(v.scope) === String(scopeId) && v.folder === folderName)
                 .forEach(v => newOrderedIds.push(v.id));
        newFolderOrder.push(folderName);
      } else if(child.classList.contains('var-item') && child !== group){
        const vid = parseInt(child.dataset.vid);
        if(!isNaN(vid)) newOrderedIds.push(vid);
      } else if(child.classList.contains('var-folder-group') && child !== group){
        if(child.dataset.folder && !newFolderOrder.includes(child.dataset.folder))
          newFolderOrder.push(child.dataset.folder);
        walkContainer(child);
      }
    }
  };
  walkContainer(listEl);

  // Persist new folder render order (any unseen folders go to the end)
  const scopeKeyFD = String(scopeId);
  const prevOrder = _folderRenderOrder.get(scopeKeyFD) ?? [];
  for(const fn of prevOrder){ if(!newFolderOrder.includes(fn)) newFolderOrder.push(fn); }
  _folderRenderOrder.set(scopeKeyFD, newFolderOrder);

  // Append any collapsed/hidden vars not visited by the DOM walk
  for(const id of allScopeIds){
    if(!newOrderedIds.includes(id)) newOrderedIds.push(id);
  }

  placeholder.remove();
  group.style.opacity = '';
  group.style.pointerEvents = '';

  // Reorder the variables array to match
  const positions = [];
  for(let i = 0; i < variables.length; i++){
    if(allScopeIds.includes(variables[i].id)) positions.push(i);
  }
  const reordered = newOrderedIds.map(id => variables.find(v => v.id === id)).filter(Boolean);
  let changed = false;
  for(let i = 0; i < positions.length; i++){
    if(variables[positions[i]] !== reordered[i]){ variables[positions[i]] = reordered[i]; changed = true; }
  }

  renderVariables();
  if(changed && typeof snapshotForUndo === 'function') snapshotForUndo();
}

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
  const varScopeName  = String(v.scope ?? 'global');
  const emptyPersistedFolders = [..._persistedFolders]
    .filter(k => { const sep=k.indexOf('::'); return sep>=0 && k.slice(0,sep)===varScopeName; })
    .map(k => k.slice(k.indexOf('::')+2));
  const existingFolders = [...new Set([
    ...allScopeVars.map(sv => sv.folder).filter(Boolean),
    ...emptyPersistedFolders,
  ])].sort();

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
    if(newName !== oldName){
      const scopePart = collapseKey.split('::')[0];
      const newKey = `${scopePart}::${newName}`;
      // Transfer _persistedFolders key
      _persistedFolders.delete(collapseKey);
      _persistedFolders.add(newKey);
      // Transfer collapse state
      if(_folderCollapsed.has(collapseKey)){
        _folderCollapsed.delete(collapseKey);
        _folderCollapsed.add(newKey);
      }
      // Rename in _folderRenderOrder
      const _fro = _folderRenderOrder.get(scopePart);
      if(_fro){ const _fi = _fro.indexOf(oldName); if(_fi >= 0) _fro[_fi] = newName; }
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

// ═══ VARIABLE SETTINGS MENU ══════════════════════════════════════════════
function _showVarSettingsMenu(v, anchorEl, allScopeVars = []){
  document.querySelectorAll('.var-settings-menu').forEach(m => m.remove());

  const menu = document.createElement('div');
  menu.className = 'var-settings-menu';

  // ── Tab bar ───────────────────────────────────────────────────────────
  const tabBar = document.createElement('div');
  tabBar.className = 'var-stab-bar';

  const TAB_NAMES = ['Move', 'Typeset', 'Dependencies'];
  const panelEls  = {};
  const tabBtns   = {};

  TAB_NAMES.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.className   = 'var-stab' + (i === 0 ? ' active' : '');
    btn.textContent = name;

    const panel = document.createElement('div');
    panel.className = 'var-stab-panel' + (i === 0 ? ' active' : '');
    panelEls[name] = panel;
    tabBtns[name]  = btn;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      tabBar.querySelectorAll('.var-stab').forEach(t => t.classList.remove('active'));
      menu.querySelectorAll('.var-stab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      panel.classList.add('active');
    });
    tabBar.appendChild(btn);
  });

  menu.appendChild(tabBar);
  TAB_NAMES.forEach(name => menu.appendChild(panelEls[name]));

  // ── Move panel ────────────────────────────────────────────────────────
  const movePanel = panelEls['Move'];

  // Scope
  const scopeSec = document.createElement('div');
  scopeSec.className = 'var-smove-section';
  const scopeLbl = document.createElement('div');
  scopeLbl.className = 'var-smove-lbl';
  scopeLbl.textContent = 'Scope';
  scopeSec.appendChild(scopeLbl);

  const scopeBtns = document.createElement('div');
  scopeBtns.className = 'var-smove-btns';
  const currentScope = v.scope ?? 'global';
  const scopeOpts = [
    { scope: 'global', label: 'Global' },
    ...((typeof tabs !== 'undefined') ? tabs.map(t => ({ scope: t.id, label: t.name.slice(0, 8) + ' (local)' })) : []),
  ];
  scopeOpts.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'var-smove-btn' + (opt.scope === currentScope ? ' active' : '');
    btn.textContent = opt.label;
    btn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if(opt.scope === currentScope) return;
      v.scope = opt.scope;
      renderVariables();
      if(typeof snapshotForUndo === 'function') snapshotForUndo();
      menu.remove();
    });
    scopeBtns.appendChild(btn);
  });
  scopeSec.appendChild(scopeBtns);
  movePanel.appendChild(scopeSec);

  const moveSep = document.createElement('div');
  moveSep.className = 'var-smove-sep';
  movePanel.appendChild(moveSep);

  // Folder
  const folderSec = document.createElement('div');
  folderSec.className = 'var-smove-section';
  const folderLbl = document.createElement('div');
  folderLbl.className = 'var-smove-lbl';
  folderLbl.textContent = 'Folder';
  folderSec.appendChild(folderLbl);

  const folderBtns = document.createElement('div');
  folderBtns.className = 'var-smove-btns';
  const currentFolder = v.folder ?? null;
  const varScopeName  = String(v.scope ?? 'global');
  const emptyPersisted = [..._persistedFolders]
    .filter(k => { const s = k.indexOf('::'); return s >= 0 && k.slice(0, s) === varScopeName; })
    .map(k => k.slice(k.indexOf('::') + 2));
  const existingFolders = [...new Set([
    ...allScopeVars.map(sv => sv.folder).filter(Boolean),
    ...emptyPersisted,
  ])].sort();

  const addFolderBtn = (label, folderVal) => {
    const btn = document.createElement('button');
    btn.className = 'var-smove-btn' + (folderVal === currentFolder ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if(folderVal === currentFolder) return;
      v.folder = folderVal;
      renderVariables();
      if(typeof snapshotForUndo === 'function') snapshotForUndo();
      menu.remove();
    });
    folderBtns.appendChild(btn);
  };

  addFolderBtn('None', null);
  existingFolders.forEach(f => addFolderBtn(f, f));

  const newFolderBtn = document.createElement('button');
  newFolderBtn.className = 'var-smove-btn var-smove-new';
  newFolderBtn.textContent = '+ New';
  newFolderBtn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
  newFolderBtn.addEventListener('click', e => {
    e.stopPropagation();
    folderBtns.style.display = 'none';
    const inp = document.createElement('input');
    inp.type = 'text'; inp.placeholder = 'Folder name…';
    inp.className = 'var-smove-new-inp';
    folderSec.appendChild(inp);
    inp.focus();
    const commit = () => {
      const name = inp.value.trim();
      if(name){ v.folder = name; renderVariables(); if(typeof snapshotForUndo === 'function') snapshotForUndo(); }
      menu.remove();
    };
    inp.addEventListener('keydown', e => {
      if(e.key === 'Enter') { e.stopPropagation(); commit(); }
      if(e.key === 'Escape'){ e.stopPropagation(); menu.remove(); }
    });
    inp.addEventListener('blur', () => setTimeout(() => { if(document.body.contains(menu)) commit(); }, 120));
  });
  folderBtns.appendChild(newFolderBtn);

  folderSec.appendChild(folderBtns);
  movePanel.appendChild(folderSec);

  // ── Typeset panel ─────────────────────────────────────────────────────
  const typePanel = panelEls['Typeset'];
  const _copyIcon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;

  // LaTeX row
  const latexLbl = document.createElement('div');
  latexLbl.className = 'var-stype-label';
  latexLbl.textContent = 'LaTeX';
  typePanel.appendChild(latexLbl);

  const latexDisplay = document.createElement('div');
  latexDisplay.className  = 'var-stype-latex';
  latexDisplay.textContent = v.fullLatex || v.nameLatex || v.name || '—';
  typePanel.appendChild(latexDisplay);

  const copyBtn = document.createElement('button');
  copyBtn.className = 'var-stype-copy';
  copyBtn.innerHTML = _copyIcon + ' Copy LaTeX';
  copyBtn.addEventListener('click', e => {
    e.stopPropagation();
    const text = v.fullLatex || v.nameLatex || v.name || '';
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = '✓ Copied';
      setTimeout(() => { copyBtn.innerHTML = _copyIcon + ' Copy LaTeX'; }, 1500);
    }).catch(() => { copyBtn.textContent = 'Copy failed'; });
  });
  typePanel.appendChild(copyBtn);

  // Python row (constant, equation, parameter, list)
  const pyCode = (typeof varToPython === 'function') ? varToPython(v) : '';
  if(pyCode){
    const sep = document.createElement('div');
    sep.className = 'var-stype-sep';
    typePanel.appendChild(sep);

    const pyLbl = document.createElement('div');
    pyLbl.className = 'var-stype-label';
    pyLbl.textContent = 'Python';
    typePanel.appendChild(pyLbl);

    const pyDisplay = document.createElement('div');
    pyDisplay.className = 'var-stype-latex';
    pyDisplay.textContent = pyCode;
    typePanel.appendChild(pyDisplay);

    const pyCopyBtn = document.createElement('button');
    pyCopyBtn.className = 'var-stype-copy';
    pyCopyBtn.innerHTML = _copyIcon + ' Copy Python';
    pyCopyBtn.addEventListener('click', e => {
      e.stopPropagation();
      navigator.clipboard.writeText(pyCode).then(() => {
        pyCopyBtn.textContent = '✓ Copied';
        setTimeout(() => { pyCopyBtn.innerHTML = _copyIcon + ' Copy Python'; }, 1500);
      }).catch(() => { pyCopyBtn.textContent = 'Copy failed'; });
    });
    typePanel.appendChild(pyCopyBtn);
  }

  // ── Dependencies panel ────────────────────────────────────────────────
  const depsPanel = panelEls['Dependencies'];
  const soonMsg = document.createElement('div');
  soonMsg.className   = 'var-sdeps-soon';
  soonMsg.textContent = 'Coming soon';
  depsPanel.appendChild(soonMsg);

  // ── Position ──────────────────────────────────────────────────────────
  document.body.appendChild(menu);
  const r = anchorEl.getBoundingClientRect();
  menu.style.top  = (r.bottom + 4) + 'px';
  menu.style.left = r.left + 'px';
  requestAnimationFrame(() => {
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    if(r.left + mw > window.innerWidth - 8)  menu.style.left = Math.max(8, r.right - mw) + 'px';
    if(r.bottom + 4 + mh > window.innerHeight - 8) menu.style.top = Math.max(4, r.top - mh - 4) + 'px';
  });

  const outside = e => {
    if(!menu.contains(e.target)){ menu.remove(); document.removeEventListener('mousedown', outside); }
  };
  setTimeout(() => document.addEventListener('mousedown', outside), 0);
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
          fixDecoratorCursor(_mf, prev, mqWrap);
          checkAllWarnings();
          _scheduleRerenderVarCurves();
          updateLatexDropdown(_mf, mqWrap, mqWrap);
          // Defer updateMode so MQ.StaticMath calls inside evaluateConstant
          // don't steal focus mid-edit and corrupt cursor/command-mode state.
          requestAnimationFrame(()=> updateMode(_mf));
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
      _rerenderVarCurves();
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
          _scheduleRerenderVarCurves();
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
      _rerenderVarCurves();
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
          checkAllWarnings();
          _scheduleRerenderVarCurves();
          // Incomplete-expression check: fires 1 s after typing stops.
          // Only activates when no structural error is already shown.
          clearTimeout(v._incompleteTimer);
          v._incompleteTimer = setTimeout(()=>{
            if(!v._warning || v._warning._invalidMsg !== null) return;
            if(isIncompleteExpr((v.exprLatex || '').trim()))
              v._warning.setInvalid('incomplete expression');
          }, 1000);
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

// ═══ DATASET POPUP MODAL ═════════════════════════════════════════════════
let _datasetPopupVar  = null;
let _datasetPopupPage = 0;
const _DS_POP_PG      = 50;

function _dsEsc(str){ return String(str ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function _syncDatasetSummary(v){
  const el = document.getElementById(`vdssummary_${v.id}`);
  if(!el) return;
  const maxRows = v.datasetCols.length > 0 ? Math.max(0, ...v.datasetCols.map(c => c.values.length)) : 0;
  el.textContent = `${maxRows} rows × ${v.datasetCols.length} cols`;
}

function buildDatasetBody(inner, v){
  const summaryRow = document.createElement('div');
  summaryRow.className = 'var-list-summary';

  const summaryText = document.createElement('span');
  summaryText.className = 'var-list-summary-text';
  summaryText.id = `vdssummary_${v.id}`;
  const maxRows = v.datasetCols.length > 0 ? Math.max(0, ...v.datasetCols.map(c => c.values.length)) : 0;
  summaryText.textContent = `${maxRows} rows × ${v.datasetCols.length} cols`;

  const viewBtn = document.createElement('button');
  viewBtn.className = 'var-list-view-btn';
  viewBtn.textContent = 'View / Edit →';
  viewBtn.addEventListener('click', e=>{ e.stopPropagation(); _openDatasetPopup(v); });

  summaryRow.appendChild(summaryText);
  summaryRow.appendChild(viewBtn);
  inner.appendChild(summaryRow);
}

function _openDatasetPopup(v){
  _datasetPopupVar  = v;
  _datasetPopupPage = 0;

  let overlay = document.getElementById('datasetPopupOverlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id        = 'datasetPopupOverlay';
    overlay.className = 'list-popup-overlay';
    overlay.addEventListener('mousedown', e=>{ if(e.target === overlay) _closeDatasetPopup(); });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="list-popup ds-popup" id="datasetPopupMain">
      <div class="list-popup-header">
        <div class="list-popup-title">
          <span class="list-popup-varname">${_dsEsc(v.name) || `dataset ${v.id}`}</span>
          <span class="list-popup-meta" id="dspopMeta"></span>
        </div>
        <button class="list-popup-close" id="dspopClose">&#10005;</button>
      </div>
      <div class="ds-popup-body" id="dspopBody"></div>
      <div class="list-popup-footer" id="dspopFooter"></div>
    </div>`;

  overlay.style.display = 'flex';
  document.getElementById('dspopClose')?.addEventListener('click', _closeDatasetPopup);
  _renderDatasetPopupPage();
}

function _closeDatasetPopup(){
  const overlay = document.getElementById('datasetPopupOverlay');
  if(overlay) overlay.style.display = 'none';
  if(_datasetPopupVar) _syncDatasetSummary(_datasetPopupVar);
  if(typeof snapshotForUndo === 'function') snapshotForUndo();
  if(typeof checkAllWarnings === 'function') checkAllWarnings();
  _datasetPopupVar = null;
}

function _renderDatasetPopupPage(){
  const v      = _datasetPopupVar;
  const body   = document.getElementById('dspopBody');
  const footer = document.getElementById('dspopFooter');
  const meta   = document.getElementById('dspopMeta');
  if(!v || !body || !footer) return;

  const cols    = v.datasetCols;
  const maxRows = cols.length > 0 ? Math.max(0, ...cols.map(c => c.values.length)) : 0;
  if(meta) meta.textContent = `${maxRows} rows × ${cols.length} cols`;

  const totalPages = Math.ceil(maxRows / _DS_POP_PG) || 1;
  _datasetPopupPage = Math.max(0, Math.min(_datasetPopupPage, totalPages - 1));
  const start = _datasetPopupPage * _DS_POP_PG;
  const end   = Math.min(start + _DS_POP_PG, maxRows);

  const headerCells = cols.map((col, ci) =>
    `<th class="data-th ds-th-edit">
       <input class="ds-col-inp" data-ci="${ci}" value="${_dsEsc(col.name)}" placeholder="col ${ci+1}">
     </th>`
  ).join('');

  const bodyRows = [];
  for(let r = start; r < end; r++){
    const cells = cols.map((col, ci) => {
      const val    = r < col.values.length ? col.values[r] : null;
      const strVal = (val === null || val === undefined) ? '' : String(val);
      return `<td class="data-td"><input class="ds-cell-inp${strVal===''?' ds-cell-empty':''}" data-row="${r}" data-ci="${ci}" value="${_dsEsc(strVal)}" placeholder="—"></td>`;
    }).join('');
    bodyRows.push(`<tr><td class="data-td data-row-num">${r + 1}</td>${cells}</tr>`);
  }

  body.innerHTML = `
    <div class="data-table-wrap ds-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th class="data-th data-th-idx">#</th>
          ${headerCells}
          <th class="data-th ds-th-add"><button class="ds-add-col-btn" id="dspopAddCol">+ col</button></th>
        </tr></thead>
        <tbody>${bodyRows.join('')}</tbody>
      </table>
    </div>`;

  body.querySelectorAll('.ds-col-inp').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const ci = parseInt(inp.dataset.ci);
      if(ci >= 0 && ci < cols.length) cols[ci].name = inp.value;
    });
    inp.addEventListener('click', e=>e.stopPropagation());
  });

  body.querySelectorAll('.ds-cell-inp').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const r  = parseInt(inp.dataset.row);
      const ci = parseInt(inp.dataset.ci);
      if(ci >= 0 && ci < cols.length){
        while(cols[ci].values.length <= r) cols[ci].values.push(null);
        const raw = inp.value.trim();
        const num = Number(raw);
        cols[ci].values[r] = raw === '' ? null : (!isNaN(num) ? num : raw);
        inp.classList.toggle('ds-cell-empty', raw === '');
      }
      _syncDatasetSummary(v);
      if(typeof checkAllWarnings === 'function') checkAllWarnings();
    });
    inp.addEventListener('click', e=>e.stopPropagation());
  });

  document.getElementById('dspopAddCol')?.addEventListener('click', ()=>{
    cols.push({ name: `col${cols.length + 1}`, values: Array(maxRows).fill(null) });
    _renderDatasetPopupPage();
  });

  const paginationHtml = totalPages > 1
    ? `<button class="lp-btn" id="dspop_prev" ${_datasetPopupPage === 0 ? 'disabled' : ''}>&#8592; Prev</button>
       <span class="lp-info">Rows ${start + 1}–${end} of ${maxRows}</span>
       <button class="lp-btn" id="dspop_next" ${_datasetPopupPage >= totalPages - 1 ? 'disabled' : ''}>Next &#8594;</button>`
    : `<span class="lp-info">${maxRows} rows · ${cols.length} col${cols.length !== 1 ? 's' : ''}</span>`;

  const delColBtn = cols.length > 1
    ? `<button class="lp-btn lp-del-btn" id="dspop_delCol">&#8722; Last col</button>` : '';

  footer.innerHTML = `
    <div class="lp-pagination">${paginationHtml}</div>
    <div class="lp-actions">
      <button class="lp-btn lp-add-btn"  id="dspop_addRow">+ Add row</button>
      <button class="lp-btn lp-del-btn"  id="dspop_delRow" ${maxRows <= 0 ? 'disabled' : ''}>&#8722; Last row</button>
      ${delColBtn}
      <button class="lp-btn lp-done-btn" id="dspop_done">Done</button>
    </div>`;

  document.getElementById('dspop_prev')?.addEventListener('click', ()=>{ _datasetPopupPage--; _renderDatasetPopupPage(); });
  document.getElementById('dspop_next')?.addEventListener('click', ()=>{ _datasetPopupPage++; _renderDatasetPopupPage(); });

  document.getElementById('dspop_addRow')?.addEventListener('click', ()=>{
    cols.forEach(col => col.values.push(null));
    const newMax = Math.max(0, ...cols.map(c => c.values.length));
    _datasetPopupPage = Math.floor(Math.max(0, newMax - 1) / _DS_POP_PG);
    _renderDatasetPopupPage();
    _syncDatasetSummary(v);
    if(typeof checkAllWarnings === 'function') checkAllWarnings();
  });

  document.getElementById('dspop_delRow')?.addEventListener('click', ()=>{
    const curMax = cols.length > 0 ? Math.max(0, ...cols.map(c => c.values.length)) : 0;
    if(curMax > 0){
      cols.forEach(col => { if(col.values.length >= curMax) col.values.pop(); });
      const newMax = cols.length > 0 ? Math.max(0, ...cols.map(c => c.values.length)) : 0;
      _datasetPopupPage = Math.min(_datasetPopupPage, Math.max(0, Math.ceil(newMax / _DS_POP_PG) - 1));
      _renderDatasetPopupPage();
      _syncDatasetSummary(v);
      if(typeof checkAllWarnings === 'function') checkAllWarnings();
    }
  });

  document.getElementById('dspop_delCol')?.addEventListener('click', ()=>{
    if(cols.length > 1){
      cols.pop();
      _renderDatasetPopupPage();
      _syncDatasetSummary(v);
      if(typeof checkAllWarnings === 'function') checkAllWarnings();
    }
  });

  document.getElementById('dspop_done')?.addEventListener('click', _closeDatasetPopup);
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
function syncTemplateParamsToVars(tplKey, params, overrideScope){
  if(!TEMPLATES || !TEMPLATES[tplKey]) return;
  const tpl        = TEMPLATES[tplKey];
  const tplParams  = tpl.params;
  const localScope = overrideScope ?? ((typeof activeTabId !== 'undefined' && activeTabId != null) ? activeTabId : 'global');
  const folderName = tpl.label;

  for(const [pk, pd] of Object.entries(tplParams)){
    const currentVal = params[pk] ?? pd.default;
    const existing   = variables.find(v=>v.fromTemplate && v.templateKey===tplKey && v.paramKey===pk && v.scope===localScope);
    if(existing){
      existing.value      = currentVal;
      existing.exprLatex  = String(currentVal);
      existing.fullLatex  = `${pk}=${currentVal}`;
      existing._isNumeric = true;
      existing.folder     = existing.folder ?? folderName;
      if(document.getElementById(`vpslider_${existing.id}`)) syncParamSlider(existing);
    } else {
      addVariable('constant', {
        name: pk, value: currentVal,
        exprLatex: String(currentVal), fullLatex: `${pk}=${currentVal}`,
        paramMin: pd.min, paramMax: pd.max,
        fromTemplate: true, templateKey: tplKey, paramKey: pk,
        silent: true, scope: localScope, folder: folderName,
      });
    }
  }

  // Add formula variable (equation kind) once per template+scope
  const existingFormula = variables.find(v=>v.fromTemplate && v.templateKey===tplKey && v.paramKey==='_formula' && v.scope===localScope);
  if(!existingFormula){
    const eqLatex = tpl.latexEq || tpl.equation;
    addVariable('equation', {
      name: 'f',
      exprLatex: eqLatex,
      fullLatex: eqLatex,
      fromTemplate: true, templateKey: tplKey, paramKey: '_formula',
      silent: true, scope: localScope, folder: folderName,
    });
  }
}

// ═══ PICKLE IMPORT ═══════════════════════════════════════════════════════
// Import variables from a parsed .pickle file (called by sidebars.js).
// Naming: single-char keys are used as-is; multi-char keys are wrapped in \text{}.
function importPickleVars(data, sourceName, scope='global'){
  const entries = Object.entries(data);
  // Auto-folder: when importing multiple variables, group them under the filename (no extension)
  const folderName = entries.length > 1 ? sourceName.replace(/\.[^.]+$/, '') : null;

  for(const [rawKey, info] of entries){
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
        if(folderName && !existing.folder) existing.folder = folderName;
        renderVariables();
      } else {
        addVariable('constant', {
          name: rawKey, value: info.value,
          exprLatex: String(info.value), fullLatex: `${latexName}=${info.value}`,
          pickleSource: sourceName, silent: true, scope, folder: folderName,
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
        if(folderName && !existing.folder) existing.folder = folderName;
        renderVariables();
      } else {
        addVariable('list', {
          name: rawKey, listItems: items, listLength: items.length,
          pickleSource: sourceName, silent: true, scope,
          _categorical: isCat, _labels: labels, folder: folderName,
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
