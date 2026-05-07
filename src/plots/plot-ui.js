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

// ═══ AXIS LABEL INPUTS ═══════════════════════════════════════════════════
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

function applyBgColorToCanvas(pid){
  if(pid == null) return;
  const p = gp(pid); if(!p) return;
  const bg = p.view.bg_color || '#12121c';
  const wrap = document.getElementById(`cwrap_${pid}`); if(wrap) wrap.style.background = bg;
  const region = document.getElementById(`cregion_${pid}`); if(region) region.style.background = bg;
}

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

  document.getElementById('siteMathFontSelect')?.addEventListener('change', function(){
    if(typeof applyMathFont === 'function') applyMathFont(this.value);
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

  document.getElementById('saveWorkspaceBtn')?.addEventListener('click', ()=>{
    saveWorkspace();
    // Close the gear panel after saving
    document.getElementById('gearPanel')?.classList.remove('open');
    document.getElementById('gearBtn')?.classList.remove('open');
  });
}
