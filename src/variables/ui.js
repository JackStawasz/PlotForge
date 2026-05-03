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

// ═══ VAR TYPE CONVERT MENU ═══════════════════════════════════════════════
// Triggered by clicking a variable's type badge — lets you swap to a different
// kind while preserving scope and folder assignment.
let _varConvertMenu = null;

function hideVarConvertMenu(){
  if(_varConvertMenu){ _varConvertMenu.remove(); _varConvertMenu = null; }
}

function showVarConvertMenu(anchorEl, v){
  hideVarConvertMenu();
  const menu = document.createElement('div');
  menu.id = 'var-convert-menu';
  menu.style.cssText = [
    'position:fixed','z-index:99999',
    'background:var(--s1)','border:1px solid var(--border2)','border-radius:8px',
    'box-shadow:0 8px 28px rgba(0,0,0,.55)',
    'font-family:var(--mono,monospace)','font-size:.8rem',
    'min-width:178px','overflow:hidden','padding:4px 0',
  ].join(';');
  _varConvertMenu = menu;

  const types = [
    { key:'constant', icon:'α',   label:'Constant', desc:'Number or expression' },
    { key:'equation', icon:'ƒ',   label:'Equation', desc:'Function of x'        },
    { key:'list',     icon:'[ ]', label:'List',     desc:'Fixed-length sequence' },
    { key:'dataset',  icon:'⊞',   label:'Dataset',  desc:'Rows & columns'       },
  ];

  types.forEach(t => {
    const isCurrent = v.kind === t.key;
    const row = document.createElement('button');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;background:transparent;border:none;padding:9px 14px;cursor:pointer;transition:background .08s;text-align:left;';
    if(isCurrent) row.style.opacity = '0.4';
    row.innerHTML = `<span style="font-size:1.05rem;width:22px;text-align:center;flex-shrink:0;color:var(--acc2);opacity:.85">${t.icon}</span>`
      + `<span><span style="color:var(--text);font-size:.8rem;display:block">${t.label}</span>`
      + `<span style="color:var(--muted);font-size:.68rem">${t.desc}</span></span>`;
    if(!isCurrent){
      row.addEventListener('mouseenter', ()=>{ row.style.background='rgba(90,255,206,.07)'; });
      row.addEventListener('mouseleave', ()=>{ row.style.background='transparent'; });
    }
    row.addEventListener('mousedown', e=>{ e.preventDefault(); e.stopPropagation(); });
    row.addEventListener('click', e=>{
      e.stopPropagation();
      hideVarConvertMenu();
      if(isCurrent) return;
      const scope  = v.scope;
      const folder = v.folder;
      removeVariable(v.id);
      addVariable(t.key, { scope, folder });
    });
    menu.appendChild(row);
  });

  document.body.appendChild(menu);
  const rect = anchorEl.getBoundingClientRect();
  menu.style.top  = (rect.bottom + 4) + 'px';
  menu.style.left = rect.left + 'px';
  requestAnimationFrame(()=>{
    const mH = menu.offsetHeight;
    if(rect.bottom + 4 + mH > window.innerHeight - 8)
      menu.style.top = (rect.top - mH - 4) + 'px';
  });
  setTimeout(()=>{
    document.addEventListener('click', hideVarConvertMenu, { once: true });
  }, 0);
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
      badge.style.cursor = 'pointer';
      badge.addEventListener('click', e=>{ e.stopPropagation(); showVarConvertMenu(badge, v); });
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
          wrapMathFieldWithAC(nameMqWrap, nameMf, v);
        }catch(err){}
      });

      buildListBody(inner, v, lenInp);

    } else if(v.kind === 'dataset'){
      const headerTop = document.createElement('div');
      headerTop.className = 'var-item-header';
      const badge = document.createElement('span');
      badge.className = 'var-kind-badge var-kind-dataset';
      badge.textContent = 'Dataset';
      badge.style.cursor = 'pointer';
      badge.addEventListener('click', e=>{ e.stopPropagation(); showVarConvertMenu(badge, v); });
      headerTop.appendChild(badge);
      headerTop.appendChild(delBtn);
      inner.appendChild(headerTop);

      const nameInp = document.createElement('input');
      nameInp.type        = 'text';
      nameInp.id          = `vdataname_${v.id}`;
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
      badge.style.cursor = 'pointer';
      badge.addEventListener('click', e=>{ e.stopPropagation(); showVarConvertMenu(badge, v); });
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

    // Click label → rename folder inline
    labelEl.addEventListener('click', e=>{
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
      if(e.target.closest('.var-folder-label'))       return;
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

// ═══ FOLDER DRAG-TO-REORDER ══════════════════════════════════════════════
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

// ═══ FOLDER BADGE + MENU ═════════════════════════════════════════════════
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
