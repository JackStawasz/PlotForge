// ═══ CARD / PLOT HTML ════════════════════════════════════════════════════
function buildInnerHTML(p){
  const pid = p.id;
  if(p.mplMode && p.mplImage)
    return `<div class="mpl-body"><img class="mpl-img" src="data:image/png;base64,${p.mplImage}" alt="plot"/></div>`;
  const titleVal=p.labels.title||'', xlabelVal=p.labels.xlabel||'', ylabelVal=p.labels.ylabel||'';
  const tpx=Math.max(14,(p.view.title_size||13)+3), lpx=Math.max(12,(p.view.label_size||10)+3);
  const tcol=p.view.title_color||'#e8e8f0', xcol=p.view.xlabel_color||'#e8e8f0', ycol=p.view.ylabel_color||'#e8e8f0';
  return `
    <div class="chart-region" id="cregion_${pid}">
      <input class="chart-title-inp auto-inp" id="ctitleinp_${pid}" type="text"
             value="${titleVal}" placeholder="Title" maxlength="80" style="font-size:${tpx}px;color:${tcol}"/>
      <div class="canvas-wrap" id="cwrap_${pid}">
        <canvas id="chart_${pid}" style="display:block;width:100%"></canvas>
      </div>
      <div class="ax-xlabel">
        <input class="lbl-inp auto-inp" id="xlabel_${pid}" type="text"
               value="${xlabelVal}" placeholder="x-label" maxlength="40" style="font-size:${lpx}px;color:${xcol}"/>
      </div>
      <div class="ax-ylabel">
        <input class="lbl-inp auto-inp" id="ylabel_${pid}" type="text"
               value="${ylabelVal}" placeholder="y-label" maxlength="40" style="font-size:${lpx}px;color:${ycol}"/>
      </div>
    </div>`;
}

function updateCardContent(pid){
  const p = gp(pid); if(!p) return;
  const innerEl = document.getElementById(`cinner_${pid}`); if(!innerEl) return;
  destroyChart(pid); innerEl.innerHTML = buildInnerHTML(p);
  if(!p.mplMode){
    setTimeout(()=>{
      drawChart(p); wireInteraction(p); wireAxisLabelInputs(p); wireOverlayLegend(p); renderTextAnnotations(p.id); renderShapeAnnotations(p.id);
    }, 0);
  }
}

function updateTopbar(pid){
  const p = gp(pid); if(!p) return;
  const topEl = document.getElementById(`ctop_${pid}`); if(!topEl) return;
  topEl.innerHTML = buildTopbarInner(p);
}

function updateSpinner(pid){
  const p = gp(pid); if(!p) return;
  const sp = document.getElementById(`spin_${pid}`), sh = document.getElementById(`shim_${pid}`);
  if(sp){ sp.classList.toggle('show', p.loading); if(p.loading) sp.querySelector('.spin-lbl').textContent='rendering…'; }
  if(sh) sh.classList.toggle('show', !!p.converting);
}

let _plotDragListenersWired = false;

function renderDOM(){
  renderTabBar();
  for(const p of plots) destroyChart(p.id);
  const list = document.getElementById('plotList'); list.innerHTML = '';
  const visible = plots.filter(p => p.tabId === activeTabId);
  if(tabs.length === 0){
    const msg = document.createElement('div');
    msg.className = 'no-tab-msg';
    msg.innerHTML = `<span>Create a tab first to start adding plots.</span>`;
    list.appendChild(msg);
  } else {
    visible.forEach(p => list.appendChild(buildCard(p)));
    const ghost = document.createElement('div'); ghost.className = 'add-card';
    ghost.innerHTML = `<div class="add-plus">+</div><span>Add new plot</span>`;
    ghost.addEventListener('click', ()=>{
      const np = mkPlot(activeTabId); plots.push(np); activePid=np.id; activeCurveIdx=0;
      renderDOM(); refreshCfg(); refreshSidebar(); snapshotForUndo();
    });
    list.appendChild(ghost);
  }
  list.addEventListener('click', e=>{
    const onCard = e.target.closest('.plot-card');
    const onGhost = e.target.closest('.add-card');
    // Click on the background (not a card or ghost) → deselect active plot
    if(!onCard && !onGhost){ activePid=null; syncActiveHighlight(); refreshCfg(); refreshSidebar(); }
  });
  // Wire drag listeners once (they live on document so survive innerHTML clears)
  if(!_plotDragListenersWired){
    _plotDragListenersWired = true;
    list.addEventListener('pointerdown', e=>{
      if(_plotDrag.active) return;
      const handle = e.target.closest('.plot-drag-handle');
      if(!handle) return;
      const card = handle.closest('.plot-card');
      if(!card) return;
      const pid = parseInt(card.dataset.pid);
      e.preventDefault();
      _plotDragStart(e, pid);
    });
    document.addEventListener('pointermove', e=>{ if(_plotDrag.active) _plotDragMove(e); });
    document.addEventListener('pointerup',   e=>{ if(_plotDrag.active) _plotDragEnd(e); });
    document.addEventListener('pointercancel', e=>{ if(_plotDrag.active) _plotDragEnd(e); });
  }
  refreshCfg(); refreshSidebar();
  setTimeout(()=>{
    for(const p of visible){
      drawChart(p); wireInteraction(p); wireAxisLabelInputs(p); wireOverlayLegend(p); renderTextAnnotations(p.id); renderShapeAnnotations(p.id);
    }
  }, 0);
}

// ═══ PLOT TABS ═══════════════════════════════════════════════════════════
function renderTabBar(){
  const bar = document.getElementById('plotTabs'); if(!bar) return;
  bar.innerHTML = '';
  for(const t of tabs){
    const el = document.createElement('button');
    el.className = 'plot-tab' + (t.id===activeTabId ? ' plot-tab-active' : '');
    el.dataset.tid = t.id;
    el.title = t.name;
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
    delBtn.title = `Delete "${t.name}"`;
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

// ═══ PLOT DRAG ════════════════════════════════════════════════════════════
const _plotDrag = {
  active: false, pid: null,
  clone: null, placeholder: null,
  offsetX: 0, offsetY: 0,
  scrollRaf: null, scrollSpeed: 0,
  dropTabId: null, didMove: false,
};

function _plotAutoScrollLoop(list){
  if(!_plotDrag.active){ _plotDrag.scrollRaf = null; return; }
  if(_plotDrag.scrollSpeed !== 0) list.scrollTop += _plotDrag.scrollSpeed;
  _plotDrag.scrollRaf = requestAnimationFrame(()=>_plotAutoScrollLoop(list));
}

function _plotDragStart(e, pid){
  const card = document.querySelector(`.plot-card[data-pid="${pid}"]`);
  if(!card) return;
  const rect = card.getBoundingClientRect();

  // Floating clone that follows the pointer
  const clone = card.cloneNode(true);
  clone.style.cssText = [
    'position:fixed',
    `left:${rect.left}px`, `top:${rect.top}px`,
    `width:${rect.width}px`, `height:${rect.height}px`,
    'pointer-events:none', 'z-index:9000', 'opacity:.85',
    'transform-origin:top left',
    'transform:rotate(.4deg) scale(0.6)',
    'box-shadow:0 8px 32px rgba(0,0,0,.55)',
    'transition:box-shadow .1s',
  ].join(';');
  document.body.appendChild(clone);

  // Dashed placeholder in the card's original position
  const ph = document.createElement('div');
  ph.className = 'plot-drag-placeholder';
  ph.style.height = rect.height + 'px';
  card.parentNode.insertBefore(ph, card);
  card.classList.add('plot-dragging');

  _plotDrag.active = true;
  _plotDrag.pid = pid;
  _plotDrag.clone = clone;
  _plotDrag.placeholder = ph;
  _plotDrag.offsetX = e.clientX - rect.left;
  _plotDrag.offsetY = e.clientY - rect.top;
  _plotDrag.dropTabId = null;
  _plotDrag.didMove = false;
  _plotDrag.scrollSpeed = 0;

  e.target.setPointerCapture(e.pointerId);

  // Start auto-scroll RAF
  const list = document.getElementById('plotList');
  if(list) _plotDrag.scrollRaf = requestAnimationFrame(()=>_plotAutoScrollLoop(list));
}

function _plotDragMove(e){
  if(!_plotDrag.active) return;
  _plotDrag.didMove = true;

  const { clone, placeholder, offsetX, offsetY, pid } = _plotDrag;
  clone.style.left = (e.clientX - offsetX * 0.6) + 'px';
  clone.style.top  = (e.clientY - offsetY * 0.6) + 'px';

  // Auto-scroll speed (px/frame) based on distance from list edges
  const list = document.getElementById('plotList');
  if(list){
    const ZONE = 60;
    const lr = list.getBoundingClientRect();
    const topDist = e.clientY - lr.top;
    const botDist = lr.bottom - e.clientY;
    if(topDist < ZONE)      _plotDrag.scrollSpeed = -Math.ceil((ZONE - topDist) / 8);
    else if(botDist < ZONE) _plotDrag.scrollSpeed =  Math.ceil((ZONE - botDist) / 8);
    else                    _plotDrag.scrollSpeed = 0;
  }

  // Detect tab hover (pointer element under clone = already none on events)
  let hoveredTabId = null;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if(el){
    const tabEl = el.closest('.plot-tab');
    if(tabEl && tabEl.dataset.tid){
      const tid = parseInt(tabEl.dataset.tid);
      if(tid !== activeTabId) hoveredTabId = tid;
    }
  }

  // Update tab drop-target highlight
  if(hoveredTabId !== _plotDrag.dropTabId){
    document.querySelectorAll('.plot-tab.plot-tab-drop-target').forEach(t=>t.classList.remove('plot-tab-drop-target'));
    _plotDrag.dropTabId = hoveredTabId;
    if(hoveredTabId !== null){
      document.querySelector(`.plot-tab[data-tid="${hoveredTabId}"]`)?.classList.add('plot-tab-drop-target');
    }
  }

  // Reposition placeholder among same-tab cards (only when not dropping on another tab)
  if(hoveredTabId === null && list){
    const cards = [...list.querySelectorAll('.plot-card:not(.plot-dragging)')];
    let inserted = false;
    for(const card of cards){
      const r = card.getBoundingClientRect();
      if(e.clientY < r.top + r.height / 2){
        list.insertBefore(placeholder, card);
        inserted = true;
        break;
      }
    }
    if(!inserted){
      const ghost = list.querySelector('.add-card');
      if(ghost) list.insertBefore(placeholder, ghost);
      else      list.appendChild(placeholder);
    }
  }
}

function _plotDragEnd(e){
  if(!_plotDrag.active) return;
  _plotDrag.active = false;
  cancelAnimationFrame(_plotDrag.scrollRaf);
  _plotDrag.scrollRaf = null;
  _plotDrag.scrollSpeed = 0;

  const { pid, clone, placeholder, dropTabId, didMove } = _plotDrag;

  // Capture DOM order BEFORE cleanup (placeholder still in list)
  let newOrder = null;
  const list = document.getElementById('plotList');
  if(didMove && dropTabId === null && list){
    newOrder = [];
    for(const el of list.children){
      if(el === placeholder){
        newOrder.push(pid);
      } else if(el.classList.contains('plot-card') && !el.classList.contains('plot-dragging')){
        newOrder.push(parseInt(el.dataset.pid));
      }
      // skip .plot-dragging (it's replaced by placeholder in newOrder)
    }
  }

  // Cleanup
  clone.remove();
  placeholder.remove();
  document.querySelectorAll('.plot-card.plot-dragging').forEach(c=>c.classList.remove('plot-dragging'));
  document.querySelectorAll('.plot-tab.plot-tab-drop-target').forEach(t=>t.classList.remove('plot-tab-drop-target'));

  if(!didMove) return;

  // Suppress the synthetic click that follows pointerup so the card doesn't
  // inadvertently activate/deactivate after a drag gesture.
  // Allow clicks on .plot-tab so tab switching works after a cross-tab drop.
  document.addEventListener('click', e=>{
    if(!e.target.closest('.plot-tab')) e.stopPropagation();
  }, { capture:true, once:true });

  if(dropTabId !== null){
    // ── Cross-tab drop: move plot to target tab, stay in current tab ─
    const p = gp(pid); if(!p) return;
    p.tabId = dropTabId;

    const idx = plots.findIndex(pl=>pl.id===pid);
    plots.splice(idx, 1);

    // Insert after the last plot already in dropTabId (or at end of array)
    let insertIdx = plots.length;
    for(let i = plots.length - 1; i >= 0; i--){
      if(plots[i].tabId === dropTabId){ insertIdx = i + 1; break; }
    }
    plots.splice(insertIdx, 0, p);

    // Stay in the current tab. If the moved plot was active, pick another.
    if(activePid === pid){
      const remaining = plots.filter(pl => pl.tabId === activeTabId);
      activePid = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
    }

    renderDOM();
    snapshotForUndo();

  } else if(newOrder && newOrder.length > 0){
    // ── Same-tab reorder: remap flat plots array ───────────────────
    // Collect plots for other tabs (preserve their relative order/position)
    const firstIdx = plots.findIndex(p=>p.tabId===activeTabId);
    const lastIdx  = plots.reduce((acc,p,i)=>p.tabId===activeTabId?i:acc, -1);
    if(firstIdx === -1) return;

    const plotMap = {};
    for(const p of plots) plotMap[p.id] = p;
    const reordered = newOrder.map(id=>plotMap[id]).filter(Boolean);

    const before = plots.slice(0, firstIdx);
    const after  = plots.slice(lastIdx + 1);
    plots.length = 0;
    for(const p of [...before, ...reordered, ...after]) plots.push(p);

    renderDOM();
    snapshotForUndo();
  }
}

function buildCard(p){
  const card = document.createElement('div');
  card.className = 'plot-card' + (p.id===activePid ? ' active' : '');
  card.dataset.pid = p.id;
  card.innerHTML = `
    <div class="ctop" id="ctop_${p.id}">${buildTopbarInner(p)}</div>
    <div class="cbody" id="cbody_${p.id}">
      <div id="cinner_${p.id}">${buildInnerHTML(p)}</div>
      <div class="spin-overlay${p.loading?' show':''}" id="spin_${p.id}">
        <div class="spinner"></div><div class="spin-lbl">rendering…</div>
      </div>
      <div class="shimmer-overlay${p.converting?' show':''}" id="shim_${p.id}"></div>
    </div>`;
  // Capture phase: activate card first, then dispatch button actions.
  card.addEventListener('click', e=>{
    if(activePid !== p.id){ activePid=p.id; activeCurveIdx=0; syncActiveHighlight(); refreshCfg(); refreshSidebar(); }
    const btn = e.target.closest('[data-action]');
    if(btn) handleAction(btn.dataset.action, parseInt(btn.dataset.pid), btn);
  }, true);
  return card;
}

function buildTopbarInner(p){
  const cc = p.curves.filter(c=>c.template).length, canMpl = true;
  const inFs = !!document.querySelector('.plot-card.plot-fs');
  const mplBtn = p.mplMode
    ? `<button class="cbtn revert-btn" data-pid="${p.id}" data-action="revert">⟲</button>`
    : `<button class="cbtn mpl-btn${!canMpl?' mpl-disabled':''}" data-pid="${p.id}" data-action="mpl" ${!canMpl?'disabled':''}>▨</button>`;
  const annDisabled = p.mplMode ? 'disabled style="opacity:.3;pointer-events:none"' : '';
  const dupDelDisabled = inFs ? 'disabled style="opacity:.3;pointer-events:none;cursor:not-allowed"' : '';
  return `
    <div class="ctitle-left">
      <span class="plot-drag-handle" title="Drag to reorder">⠿</span>
      <span class="ctitle-text" data-pid="${p.id}" data-action="rename" title="Click to rename">${p.name || `Plot ${p.plotNumber}`}</span>
      <button class="cbtn addcurve-btn" data-pid="${p.id}" data-action="addcurve">⊕ add curve</button>
    </div>
    <div class="cactions-center">
      ${mplBtn}
      <button class="cbtn text-btn" data-pid="${p.id}" data-action="addannotation" data-tip="Add text/shape overlay" ${annDisabled}>✎</button>
    </div>
    <div class="cactions-right">
      <span class="ctop-coords" id="ctop_coords_${p.id}"></span>
      <button class="cbtn pdf-btn" data-pid="${p.id}" data-action="savepdf">⤓ PDF</button>
      <button class="cbtn dup-btn" data-pid="${p.id}" data-action="dup" ${dupDelDisabled}>⧉</button>
      <button class="cbtn fs-btn" data-pid="${p.id}" data-action="fullscreen">⛶</button>
      <button class="cbtn del-btn" data-pid="${p.id}" data-action="del" ${dupDelDisabled}>🗑</button>
    </div>`;
}

const _measureSpan = document.createElement('span');
_measureSpan.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;pointer-events:none;top:-9999px;left:-9999px';
document.addEventListener('DOMContentLoaded', ()=>document.body.appendChild(_measureSpan));

function autoResizeInput(inp, maxPx){
  if(!inp) return;
  const cs = window.getComputedStyle(inp);
  _measureSpan.style.font = cs.font; _measureSpan.style.letterSpacing = cs.letterSpacing;
  _measureSpan.textContent = inp.value || inp.placeholder || '';
  inp.style.width = Math.min(maxPx||9999, Math.max(30, _measureSpan.offsetWidth+16)) + 'px';
}

function getCanvasDims(pid){
  const wrap = document.getElementById(`cwrap_${pid}`);
  return wrap ? {w:wrap.offsetWidth, h:wrap.offsetHeight} : {w:300, h:200};
}

function wireAxisLabelInputs(p){
  const xi=document.getElementById(`xlabel_${p.id}`), yi=document.getElementById(`ylabel_${p.id}`), ti=document.getElementById(`ctitleinp_${p.id}`);
  const wrap = document.getElementById(`cwrap_${p.id}`);

  function updateLabelMaxWidths(){
    const dims = getCanvasDims(p.id);
    const maxX = Math.max(60, Math.floor(dims.w * 0.9));
    const maxY = Math.max(60, Math.floor(dims.h * 0.9));
    if(xi){ xi.style.maxWidth = maxX+'px'; autoResizeInput(xi, maxX); }
    if(yi){ yi.style.maxWidth = maxY+'px'; autoResizeInput(yi, maxY); }
    if(ti){ ti.style.maxWidth = Math.floor(dims.w * 0.95)+'px'; autoResizeInput(ti, dims.w); }
  }

  function wire(el, setter, getMaxPx){
    if(!el) return;
    el.addEventListener('input',   ()=>{ setter(el.value); autoResizeInput(el, getMaxPx()); });
    el.addEventListener('change',  ()=>{ setter(el.value); autoResizeInput(el, getMaxPx()); });
    el.addEventListener('click',   e=>e.stopPropagation());
    el.addEventListener('keydown', e=>{ if(e.key==='Enter') el.blur(); });
  }

  wire(xi, v=>{ p.labels.xlabel=v; }, ()=>Math.max(60,Math.floor(getCanvasDims(p.id).w*0.9)));
  wire(yi, v=>{ p.labels.ylabel=v; }, ()=>Math.max(60,Math.floor(getCanvasDims(p.id).h*0.9)));

  if(ti){
    ti.addEventListener('input',   ()=>{ p.labels.title=ti.value; autoResizeInput(ti, getCanvasDims(p.id).w); });
    ti.addEventListener('change',  ()=>{ p.labels.title=ti.value; autoResizeInput(ti, getCanvasDims(p.id).w); });
    ti.addEventListener('click',   e=>e.stopPropagation());
    ti.addEventListener('keydown', e=>{ if(e.key==='Enter') ti.blur(); });
  }

  // Set immediately, then update when canvas resizes
  updateLabelMaxWidths();
  if(wrap){
    new ResizeObserver(updateLabelMaxWidths).observe(wrap);
  }
}

function applyLabelFontSizes(pid){
  const p = gp(pid); if(!p) return;
  const tpx=Math.max(14,(p.view.title_size||13)+3), lpx=Math.max(12,(p.view.label_size||10)+3);
  const tcol=p.view.title_color||'#e8e8f0', xcol=p.view.xlabel_color||'#e8e8f0', ycol=p.view.ylabel_color||'#e8e8f0';
  const dims = getCanvasDims(pid);
  const ti=document.getElementById(`ctitleinp_${pid}`), xi=document.getElementById(`xlabel_${pid}`), yi=document.getElementById(`ylabel_${pid}`);
  if(ti){ ti.style.fontSize=tpx+'px'; ti.style.color=tcol; autoResizeInput(ti, dims.w); }
  if(xi){ xi.style.fontSize=lpx+'px'; xi.style.color=xcol; autoResizeInput(xi, Math.floor(dims.w * 0.9)); }
  if(yi){ yi.style.fontSize=lpx+'px'; yi.style.color=ycol; autoResizeInput(yi, Math.floor(dims.h * 0.9)); }
}

function syncActiveHighlight(){
  document.querySelectorAll('.plot-card').forEach(c=>c.classList.toggle('active', parseInt(c.dataset.pid)===activePid));
}

function applyBgColorToCanvas(pid){
  if(pid == null) return;
  const p = gp(pid); if(!p) return;
  const bg = p.view.bg_color || '#12121c';
  const wrap = document.getElementById(`cwrap_${pid}`); if(wrap) wrap.style.background = bg;
  const region = document.getElementById(`cregion_${pid}`); if(region) region.style.background = bg;
}

// ═══ TEXT ANNOTATIONS ════════════════════════════════════════════════════
// Annotation font sizes are stored in logical pt to match the right-panel controls.
// JS renders at size * JS_ANN_SCALE px so on-screen size matches the matplotlib export.
const JS_ANN_SCALE = 1.4;

let _annMenu = null;

function closeAnnMenu(){
  if(_annMenu){ _annMenu.remove(); _annMenu=null; }
}

// Convert plot-data coords → canvas fraction for a given chart instance
function dataToFrac(ch, dataX, dataY){
  const sx=ch.scales.x, sy=ch.scales.y;
  const cw=ch.canvas.width, ch_=ch.canvas.height;
  const pxX = sx.left + (dataX - sx.min) / (sx.max - sx.min) * (sx.right - sx.left);
  const pxY = sy.top  + (1 - (dataY - sy.min) / (sy.max - sy.min)) * (sy.bottom - sy.top);
  return { x: pxX/cw, y: pxY/ch_ };
}

// Convert a size in plot-data units (x-axis) → CSS pixels for a given plot
function _plotSizeToPx(pid, plotSize){
  const ch = chartInstances[pid]; if(!ch) return plotSize;
  const wrap = document.getElementById(`cwrap_${pid}`); if(!wrap) return plotSize;
  const sx = ch.scales.x;
  const dataRange = sx.max - sx.min; if(!dataRange) return plotSize;
  const canvasPx = sx.right - sx.left; if(!canvasPx) return plotSize;
  const cssScale = wrap.offsetWidth / ch.canvas.width;
  if(!cssScale || !isFinite(cssScale)) return plotSize;
  return plotSize * canvasPx * cssScale / dataRange;
}

// Convert CSS pixels → plot-data units (x-axis) for a given plot
function _pxToPlotSize(pid, cssPx){
  const ch = chartInstances[pid]; if(!ch) return cssPx;
  const wrap = document.getElementById(`cwrap_${pid}`); if(!wrap) return cssPx;
  const sx = ch.scales.x;
  const canvasPx = sx.right - sx.left; if(!canvasPx) return cssPx;
  const cssScale = wrap.offsetWidth / ch.canvas.width;
  return cssPx / (canvasPx * cssScale) * (sx.max - sx.min);
}

// Convert canvas fraction → plot-data coords
function fracToData(ch, fracX, fracY){
  const sx=ch.scales.x, sy=ch.scales.y;
  const cw=ch.canvas.width, ch_=ch.canvas.height;
  const pxX = fracX*cw, pxY = fracY*ch_;
  const dataX = sx.min + (pxX - sx.left)/(sx.right - sx.left) * (sx.max-sx.min);
  const dataY = sy.min + (1 - (pxY - sy.top)/(sy.bottom - sy.top)) * (sy.max-sy.min);
  return { dataX, dataY };
}

// Recalculate x_frac/y_frac for plot-locked annotations after zoom/pan
function updatePlotLockedAnnotations(pid){
  const p = gp(pid); if(!p||!p.textAnnotations) return;
  const ch = chartInstances[pid]; if(!ch) return;
  const wrap = document.getElementById(`cwrap_${pid}`); if(!wrap) return;
  p.textAnnotations.forEach(ann=>{
    if(ann.lock!=='plot' || ann.data_x==null) return;
    const frac = dataToFrac(ch, ann.data_x, ann.data_y);
    ann.x_frac = frac.x;
    ann.y_frac = frac.y;
    const outer = wrap.querySelector(`.text-annotation[data-ann-id="${ann.id}"]`);
    if(outer){
      outer.style.left = (ann.x_frac*100)+'%';
      outer.style.top  = (ann.y_frac*100)+'%';
    }
  });
}

function showAnnMenu(ann, pid, menuBtnEl){
  closeAnnMenu();
  const p = gp(pid); if(!p) return;
  const menu = document.createElement('div');
  menu.className = 'ann-menu';
  _annMenu = menu;

  // ── Edit text ──────────────────────────────────────────────────
  const editRow = document.createElement('div'); editRow.className='ann-menu-sub';
  editRow.innerHTML = `<label>Text content</label><input class="ann-menu-inp" id="annMenuText" type="text" value="${ann.text.replace(/"/g,'&quot;')}" maxlength="120"/>`;
  menu.appendChild(editRow);

  // ── Font size — inline label left / number right (no separator) ──
  const sizeRow = document.createElement('div'); sizeRow.className='ann-menu-row-inline';
  sizeRow.innerHTML = `<label>Font size (pt)</label><input class="ann-menu-inp ann-menu-inp-sm" id="annMenuSize" type="number" value="${ann.size}" min="6" max="52" step="1"/>`;
  menu.appendChild(sizeRow);

  // ── Text color — label left / swatch+hex right ──────────────────
  const colorRow = document.createElement('div'); colorRow.className='ann-menu-row-inline';
  colorRow.innerHTML = `<label>Text color</label>
    <div class="ann-menu-color-group">
      <div class="ann-color-swatch"><input type="color" id="annMenuColor" value="${ann.color}"/></div>
      <input class="ann-menu-inp ann-menu-inp-hex" id="annMenuColorHex" type="text" value="${ann.color}" maxlength="7"/>
    </div>`;
  menu.appendChild(colorRow);

  // ── Lock mode — label left / buttons right ────────────────────
  const isPlot = ann.lock==='plot';
  const lockRow = document.createElement('div'); lockRow.className='ann-menu-row-inline';
  lockRow.innerHTML = `<label>Anchor</label>
    <div class="ann-lock-group">
      <button class="ann-lock-btn${isPlot?' active':''}" id="annLockPlot">Plot</button>
      <button class="ann-lock-btn${!isPlot?' active':''}" id="annLockWindow">Window</button>
    </div>`;
  menu.appendChild(lockRow);

  // ── Delete ────────────────────────────────────────────────────
  const delBtn = document.createElement('button'); delBtn.className='ann-menu-item danger';
  delBtn.innerHTML='<span class="ann-menu-icon">✕</span>Delete annotation';
  delBtn.addEventListener('mousedown', e=>{
    e.preventDefault(); e.stopPropagation();
    closeAnnMenu();
    if(!p.textAnnotations) return;
    p.textAnnotations = p.textAnnotations.filter(a=>a.id!==ann.id);
    document.querySelector(`.text-annotation[data-ann-id="${ann.id}"]`)?.remove();
    scheduleMplDebounce(pid);
    snapshotForUndo();
  });
  menu.appendChild(delBtn);

  document.body.appendChild(menu);

  const textInp      = document.getElementById('annMenuText');
  const sizeInp      = document.getElementById('annMenuSize');
  const colorInp     = document.getElementById('annMenuColor');
  const colorHexInp  = document.getElementById('annMenuColorHex');
  const lockPlotBtn  = document.getElementById('annLockPlot');
  const lockWindowBtn= document.getElementById('annLockWindow');

  // Snapshot text on open — revert if user clears the field
  let textOnOpen = ann.text;
  if(textInp){
    textInp.focus(); textInp.select();
    textInp.addEventListener('input', ()=>{
      const val = textInp.value;
      const el = document.querySelector(`.text-annotation[data-ann-id="${ann.id}"] .ann-text-content`);
      if(el) el.textContent = val || textOnOpen;
      ann.text = val || textOnOpen;
      scheduleMplDebounce(pid);
      clearTimeout(window._annUndoDebounce); window._annUndoDebounce=setTimeout(snapshotForUndo,600);
    });
    textInp.addEventListener('blur', ()=>{
      if(!textInp.value.trim()){
        textInp.value = textOnOpen;
        ann.text = textOnOpen;
        const el = document.querySelector(`.text-annotation[data-ann-id="${ann.id}"] .ann-text-content`);
        if(el) el.textContent = textOnOpen;
        scheduleMplDebounce(pid);
      } else {
        textOnOpen = textInp.value;
        snapshotForUndo();
      }
    });
    textInp.addEventListener('keydown', e=>{ if(e.key==='Enter') textInp.blur(); });
  }

  if(sizeInp){
    sizeInp.addEventListener('input', ()=>{
      const v = Math.max(6, parseInt(sizeInp.value)||13);
      ann.size = v;
      const el = document.querySelector(`.text-annotation[data-ann-id="${ann.id}"] .ann-text-content`);
      if(el) el.style.fontSize = (v * JS_ANN_SCALE)+'px';
      scheduleMplDebounce(pid);
      clearTimeout(window._annUndoDebounce); window._annUndoDebounce=setTimeout(snapshotForUndo,600);
    });
  }

  function applyColor(hex){
    if(!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    ann.color = hex;
    const el = document.querySelector(`.text-annotation[data-ann-id="${ann.id}"] .ann-text-content`);
    if(el) el.style.color = hex;
    scheduleMplDebounce(pid);
    clearTimeout(window._annUndoDebounce); window._annUndoDebounce=setTimeout(snapshotForUndo,600);
  }
  if(colorInp)    colorInp.addEventListener('input',    ()=>{ colorHexInp.value=colorInp.value; applyColor(colorInp.value); });
  if(colorHexInp) colorHexInp.addEventListener('input', ()=>{ if(/^#[0-9a-fA-F]{6}$/.test(colorHexInp.value)){ colorInp.value=colorHexInp.value; applyColor(colorHexInp.value); } });

  if(lockPlotBtn){
    lockPlotBtn.addEventListener('click', ()=>{
      ann.lock='plot';
      const ch=chartInstances[pid];
      if(ch){ const d=fracToData(ch,ann.x_frac,ann.y_frac); ann.data_x=d.dataX; ann.data_y=d.dataY; }
      lockPlotBtn.classList.add('active'); lockWindowBtn.classList.remove('active');
      snapshotForUndo();
    });
  }
  if(lockWindowBtn){
    lockWindowBtn.addEventListener('click', ()=>{
      ann.lock='window'; ann.data_x=null; ann.data_y=null;
      lockWindowBtn.classList.add('active'); lockPlotBtn.classList.remove('active');
      snapshotForUndo();
    });
  }

  // Position to the right of the circle button
  const rect = menuBtnEl.getBoundingClientRect();
  const mw = 220;
  menu.style.visibility='hidden'; menu.style.display='block';
  const mh = menu.scrollHeight || 240;
  menu.style.visibility='';
  let left = rect.right + 8;
  let top  = rect.top;
  if(left + mw > window.innerWidth - 8) left = rect.left - mw - 8;
  if(top  + mh > window.innerHeight - 8) top = window.innerHeight - mh - 8;
  menu.style.left = Math.max(4,left)+'px';
  menu.style.top  = Math.max(4,top)+'px';

  const onOutside = e=>{
    if(!menu.contains(e.target) && e.target!==menuBtnEl){ closeAnnMenu(); document.removeEventListener('mousedown',onOutside); }
  };
  setTimeout(()=>document.addEventListener('mousedown',onOutside), 10);
}

function scheduleMplDebounce(pid){
  const p=gp(pid); if(!p) return;
  if(p.mplMode){clearTimeout(window._mplDebounce);window._mplDebounce=setTimeout(()=>convertToMpl(pid),350);}
}

function addTextAnnotation(pid){
  const p = gp(pid); if(!p) return;
  if(!p.textAnnotations) p.textAnnotations = [];
  // Default size=13 pt; JS renders at 13*1.4=18.2px to match matplotlib output
  // data_x/data_y stores plot coords when lock='plot'
  const ann = {
    id: mkCid(), text:'Label',
    x_frac:0.5, y_frac:0.5,
    color:'#eeeeff', size:13, bold:false,
    lock:'plot',
    data_x: null, data_y: null,
  };
  // Seed data coords from current chart view so annotation starts at center of plot
  const ch = chartInstances[pid];
  if(ch){
    const d = fracToData(ch, 0.5, 0.5);
    ann.data_x = d.dataX; ann.data_y = d.dataY;
  }
  p.textAnnotations.push(ann);
  renderTextAnnotations(pid);
  if(p.mplMode){ clearTimeout(window._mplDebounce); window._mplDebounce=setTimeout(()=>convertToMpl(pid),350); }
  snapshotForUndo();
}

function renderTextAnnotations(pid){
  const p = gp(pid); if(!p) return;
  const wrap = document.getElementById(`cwrap_${pid}`); if(!wrap) return;
  wrap.querySelectorAll('.text-annotation').forEach(el=>el.remove());
  if(!p.textAnnotations) return;
  // Update plot-locked positions before rendering
  const ch = chartInstances[pid];
  if(ch){
    p.textAnnotations.forEach(ann=>{
      if(ann.lock==='plot' && ann.data_x!=null){
        const frac = dataToFrac(ch, ann.data_x, ann.data_y);
        ann.x_frac = frac.x;
        ann.y_frac = frac.y;
      }
    });
  }
  p.textAnnotations.forEach(ann=>{
    const outer = document.createElement('div');
    outer.className = 'text-annotation';
    outer.dataset.annId = ann.id;
    outer.style.cssText = [
      `position:absolute`,
      `left:${ann.x_frac*100}%`,
      `top:${ann.y_frac*100}%`,
      `transform:translate(-50%,-50%)`,
      `z-index:25`,
      `display:inline-block`,
      `cursor:move`,
      `user-select:none`,
      `border:1px dashed transparent`,
      `border-radius:4px`,
      `padding:3px 5px`,
      `transition:border-color .12s`,
    ].join(';');

    // Text span — the main visible content
    const textSpan = document.createElement('span');
    textSpan.className = 'ann-text-content';
    textSpan.textContent = ann.text;
    textSpan.style.cssText = [
      `color:${ann.color}`,
      `font-size:${Math.round(ann.size * JS_ANN_SCALE)}px`,
      `font-family:var(--mono)`,
      `font-weight:${ann.bold?'600':'400'}`,
      `white-space:nowrap`,
      `display:block`,
    ].join(';');

    // Circle menu button — top-right corner, shown on hover
    const menuBtn = document.createElement('button');
    menuBtn.className = 'ann-hamburger';
    menuBtn.innerHTML = '&#8942;'; // vertical ellipsis ⋮
    menuBtn.addEventListener('mousedown', e=>{
      e.stopPropagation(); e.preventDefault();
      showAnnMenu(ann, pid, menuBtn);
    });

    outer.appendChild(textSpan);
    outer.appendChild(menuBtn);

    // Show/hide border and menu button on hover
    outer.addEventListener('mouseenter', ()=>{ outer.style.borderColor='rgba(90,255,206,.35)'; });
    outer.addEventListener('mouseleave', ()=>{ outer.style.borderColor='transparent'; });

    // Double-click opens menu
    outer.addEventListener('dblclick', e=>{ e.stopPropagation(); showAnnMenu(ann, pid, menuBtn); });

    // Drag
    let dragging=false, sx=0, sy=0;
    outer.addEventListener('mousedown', e=>{
      if(e.target===menuBtn) return;
      dragging=true; sx=e.clientX; sy=e.clientY;
      e.preventDefault(); e.stopPropagation();
      outer.style.cursor='grabbing';
    });
    window.addEventListener('mousemove', e=>{
      if(!dragging) return;
      const rect=wrap.getBoundingClientRect();
      const nx = ((parseFloat(outer.style.left)/100)*rect.width  + (e.clientX-sx)) / rect.width;
      const ny = ((parseFloat(outer.style.top) /100)*rect.height + (e.clientY-sy)) / rect.height;
      ann.x_frac = (ann.lock==='plot') ? nx : Math.max(0,Math.min(1,nx));
      ann.y_frac = (ann.lock==='plot') ? ny : Math.max(0,Math.min(1,ny));
      outer.style.left = (ann.x_frac*100)+'%';
      outer.style.top  = (ann.y_frac*100)+'%';
      // Update stored data coords if plot-locked
      if(ann.lock==='plot'){
        const ch2 = chartInstances[pid];
        if(ch2){ const d=fracToData(ch2, ann.x_frac, ann.y_frac); ann.data_x=d.dataX; ann.data_y=d.dataY; }
      }
      sx=e.clientX; sy=e.clientY;
    });
    window.addEventListener('mouseup', ()=>{
      if(dragging){ dragging=false; outer.style.cursor='move'; scheduleMplDebounce(pid); snapshotForUndo(); }
    });

    wrap.appendChild(outer);
  });
}

// ═══ SHAPE ANNOTATIONS ═══════════════════════════════════════════════════
let _shapePickerEl = null;
let _shapeMenuEl   = null;

function closeShapePicker(){ if(_shapePickerEl){ _shapePickerEl.remove(); _shapePickerEl=null; } }
function closeShapeMenu(){   if(_shapeMenuEl){  _shapeMenuEl.remove();  _shapeMenuEl=null;  } }

function _hexToRgba(hex, alpha){
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function showAnnotationPicker(pid, btnEl){
  closeShapePicker(); closeAnnMenu(); closeShapeMenu();
  const p = gp(pid); if(!p || p.mplMode) return;

  const menu = document.createElement('div');
  menu.className = 'shape-picker';
  _shapePickerEl = menu;

  const btnsRow = document.createElement('div');
  btnsRow.className = 'shape-pick-btns';
  [
    { type:'text',   icon:'✎', label:'Text'   },
    { type:'circle', icon:'○', label:'Circle' },
    { type:'square', icon:'□', label:'Square' },
    { type:'cross',  icon:'✕', label:'Cross'  },
    { type:'star',   icon:'★', label:'Star'   },
    { type:'arrow',  icon:'→', label:'Arrow'  },
  ].forEach(({type,icon,label})=>{
    const btn = document.createElement('button');
    btn.className = 'shape-pick-btn';
    btn.innerHTML = `<span class="shape-pick-icon">${icon}</span><span class="shape-pick-lbl">${label}</span>`;
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      closeShapePicker();
      if(type === 'text') addTextAnnotation(pid);
      else addShapeAnnotation(pid, type);
    });
    btnsRow.appendChild(btn);
  });
  menu.appendChild(btnsRow);

  const sep = document.createElement('div');
  sep.className = 'shape-pick-sep';
  menu.appendChild(sep);

  const delAll = document.createElement('button');
  delAll.className = 'shape-pick-del';
  delAll.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>Delete All Annotations`;
  delAll.addEventListener('click', e=>{
    e.stopPropagation();
    closeShapePicker();
    const p = gp(pid); if(!p) return;
    p.shapeAnnotations = [];
    p.textAnnotations = [];
    renderShapeAnnotations(pid);
    renderTextAnnotations(pid);
    snapshotForUndo();
  });
  menu.appendChild(delAll);

  document.body.appendChild(menu);
  const r = btnEl.getBoundingClientRect();
  const mw = menu.offsetWidth || 130;
  menu.style.top  = (r.bottom + 6)+'px';
  menu.style.left = Math.max(8, r.left + r.width/2 - mw/2)+'px';

  const outside = e=>{
    if(!menu.contains(e.target) && e.target!==btnEl){ closeShapePicker(); document.removeEventListener('mousedown', outside); }
  };
  setTimeout(()=>document.addEventListener('mousedown', outside), 0);
}

function addShapeAnnotation(pid, type){
  const p = gp(pid); if(!p) return;
  if(!p.shapeAnnotations) p.shapeAnnotations = [];
  // Default size in px; will be converted to plot units below since default lock='plot'
  const defaultPx = type==='point' ? 9 : 30;
  const sh = {
    id: mkCid(), type,
    x_frac:0.5, y_frac:0.5,
    x2_frac:0.7, y2_frac:0.3,
    color:'#5affce',
    size: defaultPx,
    stroke_width: 2,
    stroke_style: 'solid',
    fill_color: '#5affce',
    fill_alpha: 0,
    lock:'plot',
    rotation: 0,
    data_x:null, data_y:null,
    data_x2:null, data_y2:null,
  };
  const ch = chartInstances[pid];
  if(ch){
    const d = fracToData(ch, 0.5, 0.5); sh.data_x=d.dataX; sh.data_y=d.dataY;
    if(type==='arrow'){ const d2=fracToData(ch,0.7,0.3); sh.data_x2=d2.dataX; sh.data_y2=d2.dataY; }
    // Convert default px size to plot units to match the default lock='plot' mode
    if(type !== 'arrow') sh.size = _pxToPlotSize(pid, defaultPx);
  }
  p.shapeAnnotations.push(sh);
  const wrap = document.getElementById(`cwrap_${pid}`);
  if(wrap) _renderOneShape(sh, pid, wrap);
  snapshotForUndo();
}

function renderShapeAnnotations(pid){
  const p = gp(pid); if(!p) return;
  const wrap = document.getElementById(`cwrap_${pid}`); if(!wrap) return;

  wrap.querySelectorAll('.shape-ann,.shape-arr-el').forEach(el=>el.remove());
  if(!p.shapeAnnotations || !p.shapeAnnotations.length) return;

  const ch = chartInstances[pid];
  if(ch){
    p.shapeAnnotations.forEach(sh=>{
      if(sh.lock!=='plot') return;
      if(sh.data_x!=null){ const f=dataToFrac(ch,sh.data_x,sh.data_y); sh.x_frac=f.x; sh.y_frac=f.y; }
      if(sh.type==='arrow' && sh.data_x2!=null){ const f2=dataToFrac(ch,sh.data_x2,sh.data_y2); sh.x2_frac=f2.x; sh.y2_frac=f2.y; }
    });
  }

  p.shapeAnnotations.forEach(sh=>_renderOneShape(sh,pid,wrap));
}

function _applyVisStyle(vis, sh, pid){
  // If anchored to the plot, sh.size is in plot-data units and must be converted to CSS px.
  const s  = (sh.lock === 'plot') ? _plotSizeToPx(pid, sh.size) : sh.size;
  const sw = sh.stroke_width ?? 2;
  const st = sh.stroke_style || 'solid';
  const fill = (sh.fill_alpha > 0) ? _hexToRgba(sh.fill_color || sh.color, sh.fill_alpha) : 'transparent';
  if(sh.type==='point'){
    vis.style.cssText = `width:${s}px;height:${s}px;border-radius:50%;background:${sh.color}`;
  } else if(sh.type==='circle'){
    vis.style.cssText = `width:${s}px;height:${s}px;border-radius:50%;border:${sw}px ${st} ${sh.color};background:${fill};box-sizing:border-box`;
  } else if(sh.type==='cross'){
    // X shape via two diagonal gradient stripes
    const h = sw / 2;
    vis.style.cssText = [
      `width:${s}px;height:${s}px`,
      `background:
        linear-gradient(45deg,  transparent calc(50% - ${h}px), ${sh.color} calc(50% - ${h}px), ${sh.color} calc(50% + ${h}px), transparent calc(50% + ${h}px)),
        linear-gradient(-45deg, transparent calc(50% - ${h}px), ${sh.color} calc(50% - ${h}px), ${sh.color} calc(50% + ${h}px), transparent calc(50% + ${h}px))`,
    ].join(';');
  } else if(sh.type==='star'){
    const starFill = (sh.fill_alpha > 0) ? _hexToRgba(sh.fill_color || sh.color, sh.fill_alpha) : 'none';
    const swSvg = s > 0 ? ((sh.stroke_width ?? 2) * 100 / s).toFixed(2) : '6.67';
    const dash = st==='dashed' ? `stroke-dasharray="12 6"` : st==='dotted' ? `stroke-dasharray="3 6"` : '';
    vis.style.cssText = `width:${s}px;height:${s}px`;
    vis.innerHTML = `<svg width="${s}" height="${s}" viewBox="0 0 100 100" style="display:block" xmlns="http://www.w3.org/2000/svg"><polygon points="50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35" stroke="${sh.color}" stroke-width="${swSvg}" stroke-linejoin="round" fill="${starFill}" ${dash}/></svg>`;
  } else {
    vis.style.cssText = `width:${s}px;height:${s}px;border:${sw}px ${st} ${sh.color};background:${fill};box-sizing:border-box`;
  }
  if(sh.rotation) vis.style.transform = `rotate(${sh.rotation}deg)`;
}

function _renderOneShape(sh, pid, wrap){
  if(sh.type==='arrow'){ _renderArrow(sh,pid,wrap); return; }

  const outer = document.createElement('div');
  outer.className = 'shape-ann';
  outer.dataset.shapeId = sh.id;
  outer.style.cssText = `position:absolute;left:${sh.x_frac*100}%;top:${sh.y_frac*100}%;transform:translate(-50%,-50%);z-index:25;cursor:move;user-select:none`;

  const vis = document.createElement('div');
  vis.className = 'shape-visual';
  _applyVisStyle(vis, sh, pid);
  outer.appendChild(vis);

  const hbg = document.createElement('button');
  hbg.className = 'shape-hamburger';
  hbg.innerHTML = '&#8942;';
  hbg.addEventListener('mousedown', e=>{ e.stopPropagation(); e.preventDefault(); showShapeMenu(sh,pid,hbg); });
  outer.appendChild(hbg);

  outer.addEventListener('mouseenter', ()=>{ vis.style.outline='1px dashed rgba(90,255,206,.4)'; hbg.style.opacity='1'; });
  outer.addEventListener('mouseleave', ()=>{ vis.style.outline=''; hbg.style.opacity='0'; });

  // Double-click opens menu
  outer.addEventListener('dblclick', e=>{ e.stopPropagation(); showShapeMenu(sh, pid, hbg); });

  let drag=false, lx=0, ly=0;
  outer.addEventListener('mousedown', e=>{
    if(e.target===hbg) return;
    drag=true; lx=e.clientX; ly=e.clientY;
    e.preventDefault(); e.stopPropagation(); outer.style.cursor='grabbing';
  });
  const onMove = e=>{
    if(!drag) return;
    const rect=wrap.getBoundingClientRect();
    const nx = sh.x_frac + (e.clientX-lx)/rect.width;
    const ny = sh.y_frac + (e.clientY-ly)/rect.height;
    sh.x_frac = (sh.lock==='plot') ? nx : Math.max(0,Math.min(1,nx));
    sh.y_frac = (sh.lock==='plot') ? ny : Math.max(0,Math.min(1,ny));
    lx=e.clientX; ly=e.clientY;
    outer.style.left=(sh.x_frac*100)+'%'; outer.style.top=(sh.y_frac*100)+'%';
    if(sh.lock==='plot'){ const c=chartInstances[pid]; if(c){ const d=fracToData(c,sh.x_frac,sh.y_frac); sh.data_x=d.dataX; sh.data_y=d.dataY; } }
  };
  const onUp = ()=>{ if(drag){ drag=false; outer.style.cursor='move'; snapshotForUndo(); } };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  wrap.appendChild(outer);
}

function _renderArrow(sh, pid, wrap){
  const ww=wrap.offsetWidth||300, wh=wrap.offsetHeight||200;
  const x1=sh.x_frac*ww, y1=sh.y_frac*wh, x2=sh.x2_frac*ww, y2=sh.y2_frac*wh;
  const dx=x2-x1, dy=y2-y1;
  const len=Math.sqrt(dx*dx+dy*dy)||1;
  const ang=Math.atan2(dy,dx)*180/Math.PI;
  const sw = sh.stroke_width ?? 2;
  const hw = Math.max(8, sw*4.5), hh = Math.max(4, sw*2.2);

  const mkEl = (cls, css)=>{
    const d=document.createElement('div'); d.className='shape-arr-el '+cls;
    d.dataset.shapeId=sh.id; d.style.cssText=css; return d;
  };

  // Line — use border-top so solid/dashed/dotted stroke styles work natively
  const st = sh.stroke_style || 'solid';
  const lineEl = mkEl('shape-arr-line',
    `position:absolute;left:${x1}px;top:${y1-sw/2}px;width:${len}px;height:0;border-top:${sw}px ${st} ${sh.color};transform-origin:0 50%;transform:rotate(${ang}deg);z-index:21;pointer-events:none`);

  // Arrowhead
  const headEl = mkEl('shape-arr-head',
    `position:absolute;left:${x2}px;top:${y2}px;width:0;height:0;border-left:${hw}px solid ${sh.color};border-top:${hh}px solid transparent;border-bottom:${hh}px solid transparent;transform:translate(0,-50%) rotate(${ang}deg);transform-origin:0 50%;z-index:21;pointer-events:none`);

  // Wide transparent hitbox (same rotation center as the line, but taller for easy hover)
  const hitH = Math.max(20, sw + 16);
  const hitEl = mkEl('shape-arr-hit',
    `position:absolute;left:${x1}px;top:${y1+sw/2-hitH/2}px;width:${len}px;height:${hitH}px;background:transparent;transform-origin:0 50%;transform:rotate(${ang}deg);z-index:22;cursor:move`);

  // Handles — hidden by default, shown on arrow hover
  const mkHandle = (hx,hy,role)=>{
    const h=mkEl('shape-arr-handle',
      `position:absolute;left:${hx}px;top:${hy}px;transform:translate(-50%,-50%);width:11px;height:11px;border-radius:50%;background:${sh.color};border:1.5px solid rgba(255,255,255,.35);cursor:move;z-index:24;opacity:0;transition:opacity .12s`);
    h.dataset.role=role; return h;
  };

  const h1el = mkHandle(x1,y1,'start');
  const h2el = mkHandle(x2,y2,'end');

  // Shared hover-show / hover-hide logic with a settle timer
  let hoverTimer=null, arrowDragging=false;
  const showH = ()=>{ clearTimeout(hoverTimer); h1el.style.opacity='1'; h2el.style.opacity='1'; };
  const hideH = ()=>{ hoverTimer=setTimeout(()=>{ if(!arrowDragging){ h1el.style.opacity='0'; h2el.style.opacity='0'; } }, 160); };
  [hitEl, h1el, h2el].forEach(el=>{ el.addEventListener('mouseenter', showH); el.addEventListener('mouseleave', hideH); });

  // Hamburger on start handle
  const hbg=document.createElement('button');
  hbg.className='shape-hamburger'; hbg.innerHTML='&#8942;'; hbg.style.opacity='0';
  const _arrowMidPt = ()=>{
    const wr = wrap.getBoundingClientRect();
    return { x: wr.left + (sh.x_frac + sh.x2_frac) / 2 * wr.width,
             y: wr.top  + (sh.y_frac + sh.y2_frac) / 2 * wr.height };
  };
  hbg.addEventListener('mousedown', e=>{ e.stopPropagation(); e.preventDefault(); showShapeMenu(sh,pid,hbg,_arrowMidPt()); });
  h1el.appendChild(hbg);
  h1el.addEventListener('mouseenter', ()=>hbg.style.opacity='1');
  h1el.addEventListener('mouseleave', ()=>hbg.style.opacity='0');

  // Hitbox drag — moves both endpoints together
  {
    let drag=false, lx=0, ly=0;
    // Double-click on the arrow body opens menu at the line midpoint
    hitEl.addEventListener('dblclick', e=>{ e.stopPropagation(); showShapeMenu(sh, pid, hbg, _arrowMidPt()); });
    hitEl.addEventListener('mousedown', e=>{
      if(e.target===hbg) return;
      drag=true; arrowDragging=true; lx=e.clientX; ly=e.clientY;
      e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener('mousemove', e=>{
      if(!drag) return;
      const rect=wrap.getBoundingClientRect();
      const dfx=(e.clientX-lx)/rect.width, dfy=(e.clientY-ly)/rect.height;
      lx=e.clientX; ly=e.clientY;
      if(sh.lock==='plot'){
        sh.x_frac +=dfx; sh.y_frac +=dfy;
        sh.x2_frac+=dfx; sh.y2_frac+=dfy;
      } else {
        sh.x_frac =Math.max(0,Math.min(1,sh.x_frac +dfx)); sh.y_frac =Math.max(0,Math.min(1,sh.y_frac +dfy));
        sh.x2_frac=Math.max(0,Math.min(1,sh.x2_frac+dfx)); sh.y2_frac=Math.max(0,Math.min(1,sh.y2_frac+dfy));
      }
      if(sh.lock==='plot'){
        const c=chartInstances[pid]; if(c){
          const d=fracToData(c,sh.x_frac,sh.y_frac); sh.data_x=d.dataX; sh.data_y=d.dataY;
          const d2=fracToData(c,sh.x2_frac,sh.y2_frac); sh.data_x2=d2.dataX; sh.data_y2=d2.dataY;
        }
      }
      wrap.querySelectorAll(`.shape-arr-el[data-shape-id="${sh.id}"]`).forEach(el=>el.remove());
      _renderArrow(sh,pid,wrap);
    });
    window.addEventListener('mouseup', ()=>{ if(drag){ drag=false; arrowDragging=false; snapshotForUndo(); } });
  }

  // Endpoint handle drag factory
  const makeDrag=(handleEl, isStart)=>{
    let drag=false, lx=0, ly=0;
    handleEl.addEventListener('mousedown', e=>{
      if(e.target===hbg) return;
      drag=true; arrowDragging=true; lx=e.clientX; ly=e.clientY;
      e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener('mousemove', e=>{
      if(!drag) return;
      const rect=wrap.getBoundingClientRect();
      const dfx=(e.clientX-lx)/rect.width, dfy=(e.clientY-ly)/rect.height;
      lx=e.clientX; ly=e.clientY;
      if(sh.lock==='plot'){
        if(isStart){ sh.x_frac +=dfx; sh.y_frac +=dfy; }
        else        { sh.x2_frac+=dfx; sh.y2_frac+=dfy; }
      } else {
        if(isStart){ sh.x_frac=Math.max(0,Math.min(1,sh.x_frac+dfx)); sh.y_frac=Math.max(0,Math.min(1,sh.y_frac+dfy)); }
        else        { sh.x2_frac=Math.max(0,Math.min(1,sh.x2_frac+dfx)); sh.y2_frac=Math.max(0,Math.min(1,sh.y2_frac+dfy)); }
      }
      if(sh.lock==='plot'){
        const c=chartInstances[pid]; if(c){
          if(isStart){ const d=fracToData(c,sh.x_frac,sh.y_frac); sh.data_x=d.dataX; sh.data_y=d.dataY; }
          else        { const d=fracToData(c,sh.x2_frac,sh.y2_frac); sh.data_x2=d.dataX; sh.data_y2=d.dataY; }
        }
      }
      wrap.querySelectorAll(`.shape-arr-el[data-shape-id="${sh.id}"]`).forEach(el=>el.remove());
      _renderArrow(sh,pid,wrap);
    });
    window.addEventListener('mouseup', ()=>{ if(drag){ drag=false; arrowDragging=false; snapshotForUndo(); } });
  };

  makeDrag(h1el, true);
  makeDrag(h2el, false);
  wrap.appendChild(lineEl);
  wrap.appendChild(headEl);
  wrap.appendChild(hitEl);
  wrap.appendChild(h1el);
  wrap.appendChild(h2el);
}

function showShapeMenu(sh, pid, triggerEl, anchorPt=null){
  closeShapeMenu(); closeAnnMenu();
  const p = gp(pid); if(!p) return;

  const menu = document.createElement('div');
  menu.className = 'ann-menu shape-menu';
  _shapeMenuEl = menu;

  // ── Stroke color ─────────────────────────────────────────────────
  const colorRow = document.createElement('div'); colorRow.className='ann-menu-row-inline';
  colorRow.innerHTML = `<label>Stroke color</label>
    <div class="ann-menu-color-group">
      <div class="ann-color-swatch"><input type="color" id="shMenuColor" value="${sh.color}"/></div>
      <input class="ann-menu-inp ann-menu-inp-hex" id="shMenuColorHex" type="text" value="${sh.color}" maxlength="7"/>
    </div>`;
  menu.appendChild(colorRow);

  // ── Stroke width ─────────────────────────────────────────────────
  {
    const swRow = document.createElement('div'); swRow.className='ann-menu-row-inline';
    swRow.innerHTML = `<label>Stroke width</label><input class="ann-menu-inp ann-menu-inp-sm" id="shMenuSW" type="number" value="${sh.stroke_width??2}" min="0.5" max="20" step="0.5"/>`;
    menu.appendChild(swRow);
  }

  // ── Stroke style ─────────────────────────────────────────────────
  {
    const stRow = document.createElement('div'); stRow.className='ann-menu-row-inline';
    const cur = sh.stroke_style || 'solid';
    stRow.innerHTML = `<label>Stroke style</label>
      <div class="ann-lock-group">
        <button class="ann-lock-btn${cur==='solid' ?' active':''}" id="shMenuStSolid" title="Solid">—</button>
        <button class="ann-lock-btn${cur==='dashed'?' active':''}" id="shMenuStDashed" title="Dashed">╌</button>
        <button class="ann-lock-btn${cur==='dotted'?' active':''}" id="shMenuStDotted" title="Dotted">···</button>
      </div>`;
    menu.appendChild(stRow);
  }

  // ── Fill color + alpha (circle / square / star) ───────────────────
  if(sh.type==='circle' || sh.type==='square' || sh.type==='star'){
    const divider = document.createElement('div'); divider.className='ann-menu-divider'; menu.appendChild(divider);

    const fillColorRow = document.createElement('div'); fillColorRow.className='ann-menu-row-inline';
    fillColorRow.innerHTML = `<label>Fill color</label>
      <div class="ann-menu-color-group">
        <div class="ann-color-swatch"><input type="color" id="shMenuFill" value="${sh.fill_color||sh.color}"/></div>
        <input class="ann-menu-inp ann-menu-inp-hex" id="shMenuFillHex" type="text" value="${sh.fill_color||sh.color}" maxlength="7"/>
      </div>`;
    menu.appendChild(fillColorRow);

    const alphaRow = document.createElement('div'); alphaRow.className='ann-menu-row-inline';
    const alphaPct = Math.round((sh.fill_alpha||0)*100);
    alphaRow.innerHTML = `<label>Fill opacity</label>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <input type="range" id="shMenuAlpha" min="0" max="1" step="0.05" value="${sh.fill_alpha||0}" style="width:80px"/>
        <span id="shMenuAlphaVal" style="color:var(--acc2);font-family:var(--mono);font-size:.7rem;min-width:28px;text-align:right">${alphaPct}%</span>
      </div>`;
    menu.appendChild(alphaRow);
  }

  // ── Size (not for arrow) ──────────────────────────────────────────
  if(sh.type !== 'arrow'){
    const sizeRow = document.createElement('div'); sizeRow.className='ann-menu-row-inline';
    const _sizeLabelText = sh.type==='circle' ? 'Diameter' : sh.type==='square' ? 'Side length' : sh.type==='star' ? 'Size' : 'Size';
    const _sizeIsPlot    = sh.lock === 'plot';
    const _sizeUnit      = _sizeIsPlot ? 'plot units' : 'px';
    const _sizeVal       = parseFloat(sh.size.toPrecision(5));
    const _sizeMinMax    = _sizeIsPlot ? '' : 'min="1" max="2000"';
    const _sizeStep      = _sizeIsPlot ? 'any' : '1';
    sizeRow.id = 'shMenuSizeRow';
    sizeRow.innerHTML = `<label id="shMenuSizeLbl">${_sizeLabelText} (${_sizeUnit})</label>
      <input class="ann-menu-inp ann-menu-inp-sm" id="shMenuSize" type="number" value="${_sizeVal}" ${_sizeMinMax} step="${_sizeStep}"/>`;
    menu.appendChild(sizeRow);
  }

  // ── Rotation (not for arrow) ─────────────────────────────────────
  if(sh.type !== 'arrow'){
    const rotDeg = Math.round(sh.rotation || 0);
    const rotRow = document.createElement('div'); rotRow.className='ann-menu-row-inline';
    rotRow.innerHTML = `<label>Rotation</label>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <input type="range" id="shMenuRot" min="0" max="360" step="1" value="${rotDeg}" style="width:80px"/>
        <span id="shMenuRotVal" style="color:var(--acc2);font-family:var(--mono);font-size:.7rem;min-width:32px;text-align:right">${rotDeg}°</span>
      </div>`;
    menu.appendChild(rotRow);
  }

  // ── Anchor (lock) ────────────────────────────────────────────────
  {
    const isPlot = sh.lock==='plot';
    const lockRow = document.createElement('div'); lockRow.className='ann-menu-row-inline';
    lockRow.innerHTML = `<label>Anchor</label>
      <div class="ann-lock-group">
        <button class="ann-lock-btn${isPlot?' active':''}" id="shLockPlot">Plot</button>
        <button class="ann-lock-btn${!isPlot?' active':''}" id="shLockWindow">Window</button>
      </div>`;
    menu.appendChild(lockRow);
  }

  // ── Delete ────────────────────────────────────────────────────────
  {
    const divider = document.createElement('div'); divider.className='ann-menu-divider'; menu.appendChild(divider);
    const delBtn = document.createElement('button'); delBtn.className='ann-menu-item danger';
    delBtn.innerHTML='<span class="ann-menu-icon">✕</span>Delete shape';
    delBtn.addEventListener('mousedown', e=>{
      e.preventDefault(); e.stopPropagation();
      closeShapeMenu();
      p.shapeAnnotations = (p.shapeAnnotations||[]).filter(s=>s.id!==sh.id);
      renderShapeAnnotations(pid);
      snapshotForUndo();
    });
    menu.appendChild(delBtn);
  }

  document.body.appendChild(menu);

  // ── Wire inputs ───────────────────────────────────────────────────
  const reRender = ()=>renderShapeAnnotations(pid);

  const colorInp = document.getElementById('shMenuColor');
  const hexInp   = document.getElementById('shMenuColorHex');
  if(colorInp && hexInp){
    colorInp.addEventListener('input', ()=>{ sh.color=colorInp.value; hexInp.value=colorInp.value; reRender(); });
    hexInp.addEventListener('input', ()=>{ if(/^#[0-9a-fA-F]{6}$/.test(hexInp.value)){ sh.color=hexInp.value; colorInp.value=hexInp.value; reRender(); } });
    colorInp.addEventListener('change', ()=>snapshotForUndo());
    hexInp.addEventListener('change', ()=>snapshotForUndo());
  }

  const swInp = document.getElementById('shMenuSW');
  if(swInp){
    swInp.addEventListener('input', ()=>{ sh.stroke_width=Math.max(0.5,parseFloat(swInp.value)||2); reRender(); });
    swInp.addEventListener('change', ()=>snapshotForUndo());
  }

  // ── Stroke style buttons ──────────────────────────────────────────
  ['solid','dashed','dotted'].forEach(style=>{
    const id = `shMenuSt${style.charAt(0).toUpperCase()+style.slice(1)}`;
    const btn = document.getElementById(id);
    if(!btn) return;
    btn.addEventListener('mousedown', e=>{
      e.preventDefault();
      sh.stroke_style = style;
      document.querySelectorAll('#shMenuStSolid,#shMenuStDashed,#shMenuStDotted')
        .forEach(b=>b.classList.toggle('active', b===btn));
      reRender();
      snapshotForUndo();
    });
  });

  const fillInp = document.getElementById('shMenuFill');
  const fillHex = document.getElementById('shMenuFillHex');
  if(fillInp && fillHex){
    fillInp.addEventListener('input', ()=>{ sh.fill_color=fillInp.value; fillHex.value=fillInp.value; reRender(); });
    fillHex.addEventListener('input', ()=>{ if(/^#[0-9a-fA-F]{6}$/.test(fillHex.value)){ sh.fill_color=fillHex.value; fillInp.value=fillHex.value; reRender(); } });
    fillInp.addEventListener('change', ()=>snapshotForUndo());
    fillHex.addEventListener('change', ()=>snapshotForUndo());
  }

  const alphaInp = document.getElementById('shMenuAlpha');
  const alphaVal = document.getElementById('shMenuAlphaVal');
  if(alphaInp && alphaVal){
    alphaInp.addEventListener('input', ()=>{
      sh.fill_alpha=parseFloat(alphaInp.value);
      alphaVal.textContent=Math.round(sh.fill_alpha*100)+'%';
      reRender();
    });
    alphaInp.addEventListener('change', ()=>snapshotForUndo());
  }

  const sizeInp = document.getElementById('shMenuSize');
  if(sizeInp){
    sizeInp.addEventListener('input', ()=>{
      const v = parseFloat(sizeInp.value);
      if(!isNaN(v) && v > 0){ sh.size = v; reRender(); }
    });
    sizeInp.addEventListener('change', ()=>snapshotForUndo());
  }

  const rotInp = document.getElementById('shMenuRot');
  const rotVal = document.getElementById('shMenuRotVal');
  if(rotInp && rotVal){
    rotInp.addEventListener('input', ()=>{
      sh.rotation = parseInt(rotInp.value) || 0;
      rotVal.textContent = sh.rotation + '°';
      reRender();
    });
    rotInp.addEventListener('change', ()=>snapshotForUndo());
  }

  const lockPlotBtn   = document.getElementById('shLockPlot');
  const lockWindowBtn = document.getElementById('shLockWindow');
  if(lockPlotBtn && lockWindowBtn){
    const setLock = mode=>{
      const prevMode = sh.lock;
      sh.lock = mode;
      // Convert stored size between unit systems so the visual size stays the same
      if(sh.type !== 'arrow'){
        if(prevMode === 'window' && mode === 'plot'){
          sh.size = _pxToPlotSize(pid, sh.size);
        } else if(prevMode === 'plot' && mode === 'window'){
          sh.size = _plotSizeToPx(pid, sh.size);
        }
        // Refresh size input: label, units, value, step/constraints
        const sizeInpEl = document.getElementById('shMenuSize');
        const sizeLblEl = document.getElementById('shMenuSizeLbl');
        if(sizeInpEl && sizeLblEl){
          const lbl = sh.type==='circle' ? 'Diameter' : sh.type==='square' ? 'Side length' : 'Size';
          sizeLblEl.textContent = `${lbl} (${mode==='plot' ? 'plot units' : 'px'})`;
          sizeInpEl.value = parseFloat(sh.size.toPrecision(5));
          sizeInpEl.step  = mode==='plot' ? 'any' : '1';
          if(mode==='plot'){ sizeInpEl.removeAttribute('min'); sizeInpEl.removeAttribute('max'); }
          else { sizeInpEl.min='1'; sizeInpEl.max='2000'; }
        }
      }
      // Seed/clear data coords on switch
      if(mode==='plot'){
        const c=chartInstances[pid]; if(c){
          const d=fracToData(c,sh.x_frac,sh.y_frac); sh.data_x=d.dataX; sh.data_y=d.dataY;
          if(sh.type==='arrow'){ const d2=fracToData(c,sh.x2_frac,sh.y2_frac); sh.data_x2=d2.dataX; sh.data_y2=d2.dataY; }
        }
      } else { sh.data_x=null; sh.data_y=null; sh.data_x2=null; sh.data_y2=null; }
      lockPlotBtn.classList.toggle('active', mode==='plot');
      lockWindowBtn.classList.toggle('active', mode==='window');
      reRender();
      snapshotForUndo();
    };
    lockPlotBtn.addEventListener('mousedown', e=>{ e.preventDefault(); setLock('plot'); });
    lockWindowBtn.addEventListener('mousedown', e=>{ e.preventDefault(); setLock('window'); });
  }

  // For arrows (anchorPt = line midpoint): center the menu below the midpoint so it
  // doesn't cover either endpoint handle. For other shapes: open right of trigger, flip left.
  menu.style.visibility='hidden'; menu.style.display='block';
  const mh=menu.offsetHeight||240, mw=menu.offsetWidth||200;
  menu.style.visibility='';
  let left, top;
  if(anchorPt){
    left = anchorPt.x - mw/2;
    top  = anchorPt.y + 10;
    left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
    if(top + mh > window.innerHeight - 8) top = anchorPt.y - mh - 10;
  } else {
    const r = triggerEl.getBoundingClientRect();
    left = r.right + 8;
    top  = r.top;
    if(left + mw > window.innerWidth - 8) left = r.left - mw - 8;
    if(top  + mh > window.innerHeight - 8) top  = window.innerHeight - mh - 8;
  }
  menu.style.top  = Math.max(4, top) +'px';
  menu.style.left = Math.max(4, left)+'px';

  setTimeout(()=>{
    const outside=e=>{ if(!menu.contains(e.target)){ closeShapeMenu(); document.removeEventListener('mousedown',outside); } };
    document.addEventListener('mousedown', outside);
  }, 0);
}


// ═══ ACTIONS ═════════════════════════════════════════════════════════════
function duplicatePlot(pid){
  const src = gp(pid); if(!src) return;
  // Deep-clone via JSON (all view/curve data is plain serialisable objects)
  const clone = JSON.parse(JSON.stringify(src));
  // Assign fresh ids
  clone.id = mkPid();
  clone.plotNumber = ++plot_num_ctr;
  clone.tabId = src.tabId;
  clone.curves = clone.curves.map(c=>({ ...c, id:mkCid(), jsData:null }));
  // Reset ephemeral state
  clone.loading = false; clone.converting = false;
  clone.mplMode = false; clone.mplImage = null;
  // Insert immediately after the source plot
  const srcIdx = plots.findIndex(p=>p.id===pid);
  plots.splice(srcIdx+1, 0, clone);
  activePid = clone.id; activeCurveIdx = 0;
  renderDOM();
  // Re-render all curves in the new plot
  if(clone.curves.some(c=>c.template)) renderJS(clone.id, false);
}

function handleAction(action, pid, triggerEl){
  // Block dup and del while in fullscreen mode (any plot)
  const anyFs = !!document.querySelector('.plot-card.plot-fs');
  if(anyFs && (action==='dup' || action==='del')) return;

  if(action==='rename'){ _beginPlotRename(pid, triggerEl); return; }
  if(action==='dup')  { duplicatePlot(pid); return; }
  if(action==='addcurve'){
    // Set this plot active first so the modal adds to the right plot
    activePid = pid; activeCurveIdx = 0;
    syncActiveHighlight(); refreshCfg(); refreshSidebar();
    openTemplateModal(); return;
  }
  if(action==='addannotation'){
    const p = gp(pid); if(p && p.mplMode) return;
    showAnnotationPicker(pid, triggerEl);
    return;
  }
  if(action==='fullscreen') { toggleFullscreen(pid); return; }
  if(action==='del'){
    const removed = gp(pid);
    destroyChart(pid);
    plots = plots.filter(p=>p.id!==pid);
    if(activePid===pid){
      const tabId = removed?.tabId ?? activeTabId;
      activePid = plots.find(p=>p.tabId===tabId)?.id ?? null;
      activeCurveIdx=0;
    }
    // Allow zero plots — don't auto-create a new one
    renderDOM(); snapshotForUndo(); return;
  }
  if(action==='mpl')     { convertToMpl(pid);  return; }
  if(action==='revert')  { revertToJS(pid);    return; }
  if(action==='savepdf') { savePlotPdf(pid);   return; }
}

let _fullscreenPid = null;

function toggleFullscreen(pid){
  const card = document.querySelector(`.plot-card[data-pid="${pid}"]`);
  if(!card) return;
  const isFs = card.classList.contains('plot-fs');
  if(isFs){
    exitFullscreen(pid);
  } else {
    card.classList.add('plot-fs');
    document.getElementById('plotList')?.classList.add('has-fullscreen');
    _fullscreenPid = pid;
    // Inject floating exit button (replaces hidden topbar)
    let exitBtn = document.getElementById('fsExitBtn');
    if(!exitBtn){
      exitBtn = document.createElement('button');
      exitBtn.id = 'fsExitBtn';
      exitBtn.className = 'fs-exit-btn';
      exitBtn.innerHTML = '&#x26F6; exit full screen';
      exitBtn.addEventListener('click', ()=>exitFullscreen(_fullscreenPid));
      document.body.appendChild(exitBtn);
    }
    exitBtn.style.display = 'flex';
    setTimeout(()=>{ resizeAndRefresh(pid); }, 30);
  }
}

function exitFullscreen(pid){
  const fpid = pid ?? _fullscreenPid; if(fpid==null) return;
  const card = document.querySelector(`.plot-card[data-pid="${fpid}"]`); if(!card) return;
  if(!card.classList.contains('plot-fs')) return;
  // Hide floating exit button
  const exitBtn = document.getElementById('fsExitBtn');
  if(exitBtn) exitBtn.style.display = 'none';
  card.classList.add('plot-fs-exit');
  card.addEventListener('animationend', ()=>{
    card.classList.remove('plot-fs','plot-fs-exit');
    document.getElementById('plotList')?.classList.remove('has-fullscreen');
    _fullscreenPid = null;
    setTimeout(()=>{ resizeAndRefresh(fpid); }, 0);
  }, {once:true});
}

function resizeAndRefresh(pid){
  const p = gp(pid); if(!p) return;
  if(!p.mplMode && chartInstances[pid]){
    chartInstances[pid].resize();
  }
  renderTextAnnotations(pid);
  renderShapeAnnotations(pid);
  refreshOverlayLegend(pid);
}

// When the browser itself enters/exits F11 fullscreen, resize all chart instances
// so that the x-axis ticks and labels remain fully visible.
document.addEventListener('fullscreenchange', ()=>{
  setTimeout(()=>{
    for(const p of (typeof plots !== 'undefined' ? plots : [])){
      if(!p.mplMode && chartInstances[p.id]){
        chartInstances[p.id].resize();
        renderTextAnnotations(p.id);
        renderShapeAnnotations(p.id);
        refreshOverlayLegend(p.id);
      }
    }
  }, 60);
});

// ═══ CUSTOM TOPBAR TOOLTIPS ══════════════════════════════════════════════
(function initTopbarTooltips(){
  const tip = document.createElement('div');
  tip.id = 'ctop-tip';
  tip.style.cssText = [
    'position:fixed',
    'background:var(--s1)',
    'border:1px solid var(--border2)',
    'border-radius:5px',
    'padding:4px 10px',
    'font-family:var(--mono,monospace)',
    'font-size:.68rem',
    'color:var(--text)',
    'pointer-events:none',
    'z-index:9999',
    'opacity:0',
    'transition:opacity .12s',
    'white-space:nowrap',
    'box-shadow:0 4px 16px rgba(0,0,0,.4)',
    'letter-spacing:.03em',
  ].join(';');
  document.body.appendChild(tip);

  let showTimer = null;

  // Tooltip labels for each data-action value
  const LABELS = {
    addcurve:   '⊕  Add a curve to this plot',
    mpl:        '▨  Render with Matplotlib',
    revert:     '⟲  Switch back to interactive',
    addtext:    '✎  Add text annotation',
    addshape:   '▣  Insert a shape overlay',
    dup:        '⧉  Duplicate this plot',
    fullscreen: '⛶  Toggle full screen',
    del:        '🗑  Delete this plot',
  };

  document.addEventListener('mouseover', e=>{
    const btn = e.target.closest('[data-action]');
    if(!btn) return;
    const action = btn.dataset.action;
    const label = LABELS[action];
    if(!label) return;
    clearTimeout(showTimer);
    showTimer = setTimeout(()=>{
      tip.textContent = label;
      tip.style.opacity = '1';
      positionTip(btn);
    }, 380);
  });

  document.addEventListener('mouseout', e=>{
    const btn = e.target.closest('[data-action]');
    if(!btn) return;
    clearTimeout(showTimer);
    tip.style.opacity = '0';
  });

  document.addEventListener('mousedown', ()=>{
    clearTimeout(showTimer);
    tip.style.opacity = '0';
  });

  function positionTip(btn){
    const r = btn.getBoundingClientRect();
    const tw = tip.offsetWidth || 160, th = tip.offsetHeight || 26;
    // Prefer below the button; flip above if no room
    let top = r.bottom + 7;
    let left = r.left + r.width/2 - tw/2;
    if(top + th > window.innerHeight - 8) top = r.top - th - 7;
    left = Math.max(8, Math.min(window.innerWidth - tw - 8, left));
    tip.style.top  = top  + 'px';
    tip.style.left = left + 'px';
  }
})();

function wireAllCfgInputs(){
  // Site theme toggle (gear panel)
  document.getElementById('siteThemeToggle')?.addEventListener('change', function(){
    if(typeof applySiteTheme === 'function') applySiteTheme(this.checked ? 'light' : 'dark', true);
  });

  // Escape: exit plot fullscreen. If browser is also in F11 fullscreen,
  // first Escape exits plot-fs; browser handles its own Escape separately.
  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape' && _fullscreenPid !== null){
      exitFullscreen(_fullscreenPid);
    }
    // Undo: Ctrl+Z (Win/Linux) or Cmd+Z (Mac)
    const mod = e.ctrlKey || e.metaKey;
    if(mod && e.key === 'z' && !e.shiftKey){
      const tag = document.activeElement?.tagName;
      if(tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault(); performUndo();
    }
    // Redo: Ctrl+Y (Win/Linux) or Cmd+Shift+Z (Mac) or Ctrl+Shift+Z
    if(mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))){
      const tag = document.activeElement?.tagName;
      if(tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault(); performRedo();
    }
  });

  // Gear button: toggle settings panel
  const gearBtn = document.getElementById('gearBtn');
  const gearPanel = document.getElementById('gearPanel');
  if(gearBtn && gearPanel){
    gearBtn.addEventListener('click', e=>{
      e.stopPropagation();
      const open = gearPanel.classList.toggle('open');
      gearBtn.classList.toggle('open', open);
    });
    document.addEventListener('click', e=>{
      if(!gearPanel.contains(e.target) && e.target !== gearBtn){
        gearPanel.classList.remove('open'); gearBtn.classList.remove('open');
      }
    });
  }
  document.getElementById('undoBtn')?.addEventListener('click', performUndo);
  document.getElementById('redoBtn')?.addEventListener('click', performRedo);
  updateUndoRedoBtns();
}