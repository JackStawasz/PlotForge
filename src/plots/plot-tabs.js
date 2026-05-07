// ═══ PLOT TABS ═══════════════════════════════════════════════════════════
function buildTabTip(t){
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const tabPlots = plots.filter(p => p.tabId === t.id);
  if(!tabPlots.length) return esc(t.name);
  const listed = tabPlots.slice(0, 5);
  const rows = listed.map(p => {
    const name = p.name || `Plot ${p.plotNumber}`;
    const n = p.curves.filter(c => c.template || c.jsData).length;
    const label = `${n} curve${n !== 1 ? 's' : ''}`;
    return `<div class="tip-row"><span class="tip-name">${esc(name)}</span><span class="tip-count">${label}</span></div>`;
  });
  if(tabPlots.length > 5) rows.push('<div class="tip-row"><span class="tip-name">...</span></div>');
  return `${esc(t.name)}<div class="tip-rows">${rows.join('')}</div>`;
}

function renderTabBar(){
  const bar = document.getElementById('plotTabs'); if(!bar) return;
  bar.innerHTML = '';
  for(const t of tabs){
    const el = document.createElement('button');
    el.className = 'plot-tab' + (t.id===activeTabId ? ' plot-tab-active' : '');
    el.dataset.tid = t.id;
    el.dataset.tipHtml = buildTabTip(t);
    el.addEventListener('click', ()=>{ if(!_tabDrag.active) switchTab(t.id); });
    el.addEventListener('pointerdown', e=>{
      if(e.button !== 0 || e.target.closest('.plot-tab-del') || e.target.closest('.plot-tab-rename-input')) return;
      const idx = tabs.indexOf(t);
      if(idx < 0) return;
      _tabDrag.pending = true;
      _tabDrag.active  = false;
      _tabDrag.fromIdx = idx;
      _tabDrag.overIdx = idx;
      _tabDrag.startX  = e.clientX;
    });

    const nameSpan = document.createElement('span');
    nameSpan.className = 'plot-tab-name';
    nameSpan.textContent = t.name;
    nameSpan.addEventListener('dblclick', e=>{ e.stopPropagation(); _beginTabRename(el, nameSpan, t); });
    el.appendChild(nameSpan);

    const delBtn = document.createElement('button');
    delBtn.className = 'plot-tab-del';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', e=>{ e.stopPropagation(); deleteTab(t.id); });
    el.appendChild(delBtn);

    bar.appendChild(el);
  }
  const add = document.createElement('button');
  add.className = 'plot-tab plot-tab-add';
  add.textContent = '+ add tab';
  add.addEventListener('click', addTab);
  bar.appendChild(add);
}

function _beginTabRename(tabEl, nameSpan, t){
  const inp = document.createElement('input');
  inp.className = 'plot-tab-rename-input';
  inp.value = t.name;
  nameSpan.replaceWith(inp);
  inp.focus();
  inp.select();

  const commit = ()=>{
    const val = inp.value.trim();
    if(val && val.toLowerCase() !== t.name.toLowerCase()){
      const isDupe = tabs.some(other => other.id !== t.id && other.name.toLowerCase() === val.toLowerCase());
      if(isDupe){
        renderTabBar(); // revert the input
        _showTabNameToast(`"${val}" is already in use — tab names must be unique.`);
        return;
      }
      t.name = val;
    } else if(val){
      t.name = val; // same name (case change only is fine)
    }
    renderTabBar();
    snapshotForUndo();
  };
  const cancel = ()=>{ renderTabBar(); };

  inp.addEventListener('keydown', e=>{
    if(e.key === 'Enter'){ e.preventDefault(); commit(); }
    else if(e.key === 'Escape'){ e.preventDefault(); cancel(); }
  });
  inp.addEventListener('blur', commit);
}

function _showTabNameToast(msg){
  document.getElementById('_tabNameToast')?.remove();
  const toast = document.createElement('div');
  toast.id = '_tabNameToast';
  toast.textContent = msg;
  Object.assign(toast.style, {
    position:'fixed', bottom:'22px', left:'50%', transform:'translateX(-50%)',
    background:'var(--s1)', border:'1px solid var(--acc)',
    borderRadius:'6px', padding:'7px 16px',
    fontFamily:'var(--mono)', fontSize:'.73rem', color:'var(--acc)',
    boxShadow:'0 4px 18px rgba(0,0,0,.5)', zIndex:'99999',
    whiteSpace:'nowrap', pointerEvents:'none',
    opacity:'1', transition:'opacity .3s',
  });
  document.body.appendChild(toast);
  setTimeout(()=>{ toast.style.opacity='0'; setTimeout(()=>toast.remove(), 320); }, 2800);
}

function _beginPlotRename(pid, titleSpan){
  const p = gp(pid); if(!p || !titleSpan) return;
  const inp = document.createElement('input');
  inp.className = 'plot-title-rename-input';
  inp.value = p.name || `Plot ${p.plotNumber}`;
  inp.style.width = Math.max(80, titleSpan.offsetWidth) + 'px';
  titleSpan.replaceWith(inp);
  inp.focus(); inp.select();

  let committed = false;
  const commit = ()=>{
    if(committed) return; committed = true;
    const val = inp.value.trim();
    // Empty or matches default → clear custom name (revert to "Plot N")
    p.name = (val && val !== `Plot ${p.plotNumber}`) ? val : '';
    updateTopbar(pid);
    snapshotForUndo();
  };
  const cancel = ()=>{
    if(committed) return; committed = true;
    updateTopbar(pid);
  };

  inp.addEventListener('keydown', e=>{
    if(e.key === 'Enter'){ e.preventDefault(); commit(); }
    else if(e.key === 'Escape'){ e.preventDefault(); cancel(); }
  });
  inp.addEventListener('blur', commit);
}

function switchTab(tabId){
  if(tabId === activeTabId) return;
  activeTabId = tabId;
  const firstInTab = plots.find(p => p.tabId === tabId);
  activePid = firstInTab ? firstInTab.id : null;
  activeCurveIdx = 0;
  renderDOM();
  refreshCfg(); refreshSidebar();
  if(typeof renderVariables === 'function') renderVariables();
}

function _nextTabName(){
  const existing = new Set(tabs.map(t => t.name.toLowerCase()));
  let n = 1;
  while(existing.has(`tab ${n}`)) n++;
  return `Tab ${n}`;
}

function addTab(){
  const suggested = _nextTabName();
  _showTabNamePopup(suggested, name => {
    const t = mkTab(name);
    tabs.push(t);
    activeTabId = t.id;
    activePid = null;
    activeCurveIdx = 0;
    renderDOM();
    refreshCfg(); refreshSidebar();
    if(typeof renderVariables === 'function') renderVariables();
    snapshotForUndo();
  });
}

function deleteTab(tabId){
  const t = tabs.find(tt => tt.id === tabId);
  if(!t) return;
  const localVars = (typeof variables !== 'undefined') ? variables.filter(v => v.scope === tabId) : [];
  if(localVars.length > 0){
    _showTabDeleteConfirm(t.name, localVars.length, () => _doDeleteTab(tabId));
  } else {
    _doDeleteTab(tabId);
  }
}

function _showTabDeleteConfirm(tabName, varCount, onConfirm){
  document.getElementById('_tabDeletePopup')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_tabDeletePopup';
  Object.assign(overlay.style, {
    position:'fixed', inset:'0', zIndex:'9999',
    display:'flex', alignItems:'center', justifyContent:'center',
    background:'rgba(4,4,12,.72)', backdropFilter:'blur(3px)',
  });
  overlay.addEventListener('mousedown', e=>{ if(e.target === overlay) overlay.remove(); });

  const box = document.createElement('div');
  Object.assign(box.style, {
    background:'var(--s1)', border:'1px solid var(--border)',
    borderRadius:'8px', padding:'16px 18px', display:'flex',
    flexDirection:'column', gap:'10px', minWidth:'260px', maxWidth:'320px',
    boxShadow:'0 8px 32px rgba(0,0,0,.45)',
    fontFamily:'var(--mono)', fontSize:'.78rem', color:'var(--text)',
  });

  const label = document.createElement('div');
  label.innerHTML = `Delete <strong style="color:var(--acc2)">${tabName}</strong>?`;
  Object.assign(label.style, { fontWeight:'600', fontSize:'.8rem' });

  const warn = document.createElement('div');
  warn.textContent = `This tab has ${varCount} local variable${varCount !== 1 ? 's' : ''} that will also be deleted.`;
  Object.assign(warn.style, { color:'var(--acc4)', fontSize:'.72rem', lineHeight:'1.5' });

  const row = document.createElement('div');
  Object.assign(row.style, { display:'flex', gap:'7px', justifyContent:'flex-end', marginTop:'4px' });

  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'Cancel';
  Object.assign(btnCancel.style, {
    background:'var(--s2)', border:'1px solid var(--border2)',
    borderRadius:'5px', padding:'4px 12px', cursor:'pointer',
    fontFamily:'var(--mono)', fontSize:'.75rem', color:'var(--muted)',
  });
  btnCancel.addEventListener('click', ()=>overlay.remove());

  const btnDel = document.createElement('button');
  btnDel.textContent = 'Delete tab';
  Object.assign(btnDel.style, {
    background:'rgba(255,80,80,.1)', border:'1px solid rgba(255,80,80,.4)',
    borderRadius:'5px', padding:'4px 14px', cursor:'pointer',
    fontFamily:'var(--mono)', fontSize:'.75rem', color:'rgb(255,100,100)', fontWeight:'600',
  });
  btnDel.addEventListener('click', ()=>{ overlay.remove(); onConfirm(); });

  const onKey = e=>{
    if(e.key==='Escape'){ overlay.remove(); document.removeEventListener('keydown', onKey); }
    e.stopPropagation();
  };
  document.addEventListener('keydown', onKey);

  row.append(btnCancel, btnDel);
  box.append(label, warn, row);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function _doDeleteTab(tabId){
  // Remove local vars scoped to this tab
  if(typeof variables !== 'undefined'){
    for(let i = variables.length - 1; i >= 0; i--){
      if(variables[i].scope === tabId) variables.splice(i, 1);
    }
  }
  // Destroy charts and remove plots belonging to this tab
  for(let i = plots.length - 1; i >= 0; i--){
    if(plots[i].tabId === tabId){
      if(typeof destroyChart === 'function') destroyChart(plots[i].id);
      plots.splice(i, 1);
    }
  }
  // Remove the tab itself
  const tabIdx = tabs.findIndex(tt => tt.id === tabId);
  if(tabIdx === -1) return;
  tabs.splice(tabIdx, 1);

  // If we just deleted the active tab, switch to an adjacent one
  if(activeTabId === tabId){
    activeTabId = tabs.length > 0 ? tabs[Math.min(tabIdx, tabs.length - 1)].id : null;
    activePid = null;
    activeCurveIdx = 0;
  }

  renderDOM();
  if(typeof renderVariables === 'function') renderVariables();
  snapshotForUndo();
}

function _showTabNamePopup(defaultName, onConfirm){
  // Remove any existing popup
  document.getElementById('_tabNamePopup')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_tabNamePopup';
  Object.assign(overlay.style, {
    position:'fixed', inset:'0', zIndex:'9999',
    display:'flex', alignItems:'center', justifyContent:'center',
  });

  // Clicking the backdrop cancels
  overlay.addEventListener('mousedown', e => {
    if(e.target === overlay) overlay.remove();
  });

  const box = document.createElement('div');
  Object.assign(box.style, {
    background:'var(--s1)', border:'1px solid var(--border)',
    borderRadius:'8px', padding:'16px 18px', display:'flex',
    flexDirection:'column', gap:'10px', minWidth:'240px',
    boxShadow:'0 8px 32px rgba(0,0,0,.45)',
    fontFamily:'var(--mono)', fontSize:'.78rem', color:'var(--text)',
  });

  const label = document.createElement('div');
  label.textContent = 'Name this tab';
  Object.assign(label.style, { fontWeight:'600', color:'var(--acc2)', fontSize:'.75rem', letterSpacing:'.04em' });

  const input = document.createElement('input');
  input.type = 'text';
  input.value = defaultName;
  Object.assign(input.style, {
    background:'var(--s0)', border:'1px solid var(--border2)',
    borderRadius:'5px', padding:'5px 9px', color:'var(--text)',
    fontFamily:'var(--mono)', fontSize:'.78rem', outline:'none',
    width:'100%', boxSizing:'border-box', transition:'border-color .15s',
  });

  const errMsg = document.createElement('div');
  Object.assign(errMsg.style, {
    fontSize:'.7rem', color:'var(--acc)', display:'none',
    marginTop:'-4px',
  });

  const _clearErr = ()=>{ errMsg.style.display='none'; input.style.borderColor=''; };
  input.addEventListener('input', _clearErr);
  input.addEventListener('focus', () => input.select());
  input.addEventListener('keydown', e => {
    if(e.key === 'Enter'){ confirm(); }
    if(e.key === 'Escape'){ overlay.remove(); }
    e.stopPropagation();
  });

  const row = document.createElement('div');
  Object.assign(row.style, { display:'flex', gap:'7px', justifyContent:'flex-end' });

  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'Cancel';
  Object.assign(btnCancel.style, {
    background:'var(--s2)', border:'1px solid var(--border2)',
    borderRadius:'5px', padding:'4px 12px', cursor:'pointer',
    fontFamily:'var(--mono)', fontSize:'.75rem', color:'var(--muted)',
  });
  btnCancel.addEventListener('click', () => overlay.remove());

  const btnOk = document.createElement('button');
  btnOk.textContent = 'Create';
  Object.assign(btnOk.style, {
    background:'var(--acc2)', border:'none',
    borderRadius:'5px', padding:'4px 14px', cursor:'pointer',
    fontFamily:'var(--mono)', fontSize:'.75rem', color:'#fff', fontWeight:'600',
  });
  btnOk.addEventListener('click', confirm);

  function confirm(){
    const name = input.value.trim() || defaultName;
    const isDupe = tabs.some(t => t.name.toLowerCase() === name.toLowerCase());
    if(isDupe){
      errMsg.textContent = `"${name}" is already in use — tab names must be unique.`;
      errMsg.style.display = 'block';
      input.style.borderColor = 'var(--acc)';
      input.focus();
      return;
    }
    overlay.remove();
    onConfirm(name);
  }

  row.append(btnCancel, btnOk);
  box.append(label, input, errMsg, row);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  // Focus after a tick so the overlay is in the DOM
  setTimeout(() => input.focus(), 0);
}

// ═══ TAB DRAG-TO-REORDER ══════════════════════════════════════════════════
const _tabDrag = {
  active: false, pending: false,
  fromIdx: -1, overIdx: -1,
  startX: 0, ghost: null, ghostOffsetX: 0,
};

// Wire document-level listeners once so they survive renderTabBar() rebuilds
(()=>{
  document.addEventListener('pointermove', e=>{
    if(_tabDrag.pending && !_tabDrag.active && Math.abs(e.clientX - _tabDrag.startX) > 5){
      _startTabDrag(e);
    } else if(_tabDrag.active){
      _moveTabDrag(e);
    }
  });
  const _endOrCancel = e=>{ _endTabDrag(e); };
  document.addEventListener('pointerup',     _endOrCancel);
  document.addEventListener('pointercancel', _endOrCancel);
})();

function _startTabDrag(e){
  const bar = document.getElementById('plotTabs'); if(!bar) return;
  const allTabEls = [...bar.querySelectorAll('.plot-tab:not(.plot-tab-add)')];
  const fromEl = allTabEls[_tabDrag.fromIdx]; if(!fromEl) return;
  const rect = fromEl.getBoundingClientRect();

  const ghost = document.createElement('button');
  ghost.className = 'plot-tab plot-tab-ghost';
  ghost.textContent = tabs[_tabDrag.fromIdx]?.name ?? '';
  ghost.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none;z-index:9100;`;
  document.body.appendChild(ghost);

  fromEl.classList.add('plot-tab-dragging');

  _tabDrag.active = true;
  _tabDrag.pending = false;
  _tabDrag.ghost = ghost;
  _tabDrag.ghostOffsetX = e.clientX - rect.left;
  _tabDrag.overIdx = _tabDrag.fromIdx;
}

function _computeTabInsertIdx(cursorX){
  const bar = document.getElementById('plotTabs'); if(!bar) return _tabDrag.fromIdx;
  const allTabEls = [...bar.querySelectorAll('.plot-tab:not(.plot-tab-add)')];
  let leftCount = 0;
  for(let i = 0; i < allTabEls.length; i++){
    if(i === _tabDrag.fromIdx) continue;
    const r = allTabEls[i].getBoundingClientRect();
    if(r.left + r.width / 2 < cursorX) leftCount++;
  }
  return leftCount;
}

function _moveTabDrag(e){
  const { ghost, ghostOffsetX } = _tabDrag;
  if(!ghost) return;
  const bar = document.getElementById('plotTabs');
  const barRect = bar?.getBoundingClientRect();
  if(barRect){
    const ghostW = ghost.offsetWidth || 80;
    const left = Math.max(barRect.left, Math.min(barRect.right - ghostW, e.clientX - ghostOffsetX));
    ghost.style.left = left + 'px';
  }

  const newIdx = _computeTabInsertIdx(e.clientX);
  if(newIdx !== _tabDrag.overIdx){
    _tabDrag.overIdx = newIdx;
    // Update drop indicator
    const allTabEls = bar ? [...bar.querySelectorAll('.plot-tab:not(.plot-tab-add)')] : [];
    allTabEls.forEach(t=>t.classList.remove('plot-tab-drop-before', 'plot-tab-drop-after'));
    const nonDragged = allTabEls.filter((_, i)=> i !== _tabDrag.fromIdx);
    if(newIdx < nonDragged.length) nonDragged[newIdx]?.classList.add('plot-tab-drop-before');
    else if(nonDragged.length)    nonDragged[nonDragged.length-1]?.classList.add('plot-tab-drop-after');
  }
}

function _endTabDrag(e){
  if(!_tabDrag.active && !_tabDrag.pending){ return; }
  _tabDrag.pending = false;
  if(!_tabDrag.active){ return; }
  _tabDrag.active = false;

  _tabDrag.ghost?.remove();
  _tabDrag.ghost = null;
  document.querySelectorAll('.plot-tab-dragging').forEach(t=>t.classList.remove('plot-tab-dragging'));
  document.querySelectorAll('.plot-tab-drop-before,.plot-tab-drop-after').forEach(t=>{
    t.classList.remove('plot-tab-drop-before'); t.classList.remove('plot-tab-drop-after');
  });

  const { fromIdx, overIdx } = _tabDrag;
  if(fromIdx === overIdx || fromIdx < 0) return;

  const moved = tabs.splice(fromIdx, 1)[0];
  tabs.splice(overIdx, 0, moved);
  renderTabBar();
  snapshotForUndo();
}
