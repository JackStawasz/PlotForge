// ═══ PLOT LIST / DOM ═════════════════════════════════════════════════════
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
  const inFs = !!document.querySelector('.plot-card.plot-fs');
  const dupDelDisabled = inFs ? 'disabled style="opacity:.3;pointer-events:none;cursor:not-allowed"' : '';
  return `
    <div class="ctitle-left">
      <span class="plot-drag-handle" data-tip="Drag to reorder">⠿</span>
      <span class="ctitle-text" data-pid="${p.id}" data-action="rename" data-tip="Click to rename">${p.name || `Plot ${p.plotNumber}`}</span>
      <button class="cbtn addcurve-btn" data-pid="${p.id}" data-action="addcurve">⊕ add curve</button>
    </div>
    <div class="cactions-center">
    </div>
    <div class="cactions-right">
      <span class="ctop-coords" id="ctop_coords_${p.id}"></span>
      <button class="cbtn text-btn" data-pid="${p.id}" data-action="addannotation">✎</button>
      <button class="cbtn dl-topbar-btn" data-pid="${p.id}" data-action="download">⤓</button>
      <button class="cbtn dup-btn" data-pid="${p.id}" data-action="dup" ${dupDelDisabled}>⧉</button>
      <button class="cbtn fs-btn" data-pid="${p.id}" data-action="fullscreen">⛶</button>
      <button class="cbtn del-btn" data-pid="${p.id}" data-action="del" ${dupDelDisabled}>🗑</button>
    </div>`;
}

function getCanvasDims(pid){
  const wrap = document.getElementById(`cwrap_${pid}`);
  return wrap ? {w:wrap.offsetWidth, h:wrap.offsetHeight} : {w:300, h:200};
}

function syncActiveHighlight(){
  document.querySelectorAll('.plot-card').forEach(c=>c.classList.toggle('active', parseInt(c.dataset.pid)===activePid));
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
    openAddCurveModal(); return;
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
  if(action==='download') { showDownloadModal(pid); return; }
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
