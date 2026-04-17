// ═══ CARD / PLOT HTML ════════════════════════════════════════════════════
function buildInnerHTML(p){
  const pid = p.id;
  if(p.mplMode && p.mplImage)
    return `<div class="mpl-body"><img class="mpl-img" src="data:image/png;base64,${p.mplImage}" alt="plot"/></div>`;
  const titleVal=p.labels.title||'', xlabelVal=p.labels.xlabel||'', ylabelVal=p.labels.ylabel||'';
  const tpx=Math.max(14,(p.view.title_size||13)+3), lpx=Math.max(12,(p.view.label_size||10)+3);
  return `
    <div class="chart-region" id="cregion_${pid}">
      <input class="chart-title-inp auto-inp" id="ctitleinp_${pid}" type="text"
             value="${titleVal}" placeholder="Title" maxlength="80" style="font-size:${tpx}px"/>
      <div class="canvas-wrap" id="cwrap_${pid}">
        <canvas id="chart_${pid}" style="display:block;width:100%"></canvas>
      </div>
      <div class="ax-xlabel">
        <input class="lbl-inp auto-inp" id="xlabel_${pid}" type="text"
               value="${xlabelVal}" placeholder="x-label" maxlength="40" style="font-size:${lpx}px"/>
      </div>
      <div class="ax-ylabel">
        <input class="lbl-inp auto-inp" id="ylabel_${pid}" type="text"
               value="${ylabelVal}" placeholder="y-label" maxlength="40" style="font-size:${lpx}px"/>
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
  topEl.innerHTML = buildTopbarInner(p, plots.findIndex(q=>q.id===pid));
}

function updateSpinner(pid){
  const p = gp(pid); if(!p) return;
  const sp = document.getElementById(`spin_${pid}`), sh = document.getElementById(`shim_${pid}`);
  if(sp){ sp.classList.toggle('show', p.loading); if(p.loading) sp.querySelector('.spin-lbl').textContent='rendering…'; }
  if(sh) sh.classList.toggle('show', !!p.converting);
}

function renderDOM(){
  for(const p of plots) destroyChart(p.id);
  const list = document.getElementById('plotList'); list.innerHTML = '';
  plots.forEach((p,i) => list.appendChild(buildCard(p,i)));
  const ghost = document.createElement('div'); ghost.className = 'add-card';
  ghost.innerHTML = `<div class="add-plus">+</div><span>Add new plot</span>`;
  ghost.addEventListener('click', ()=>{
    const np = mkPlot(); plots.push(np); activePid=np.id; activeCurveIdx=0;
    renderDOM(); refreshCfg(); refreshSidebar(); snapshotForUndo();
  });
  list.appendChild(ghost);
  list.addEventListener('click', e=>{
    const onCard = e.target.closest('.plot-card');
    const onGhost = e.target.closest('.add-card');
    // Click on the background (not a card or ghost) → deselect active plot
    if(!onCard && !onGhost){ activePid=null; syncActiveHighlight(); refreshCfg(); refreshSidebar(); }
  });
  refreshCfg(); refreshSidebar();
  setTimeout(()=>{
    for(const p of plots){
      drawChart(p); wireInteraction(p); wireAxisLabelInputs(p); wireOverlayLegend(p); renderTextAnnotations(p.id); renderShapeAnnotations(p.id);
    }
  }, 0);
}

function buildCard(p, i){
  const card = document.createElement('div');
  card.className = 'plot-card' + (p.id===activePid ? ' active' : '');
  card.dataset.pid = p.id;
  card.innerHTML = `
    <div class="ctop" id="ctop_${p.id}">${buildTopbarInner(p,i)}</div>
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

function buildTopbarInner(p, i){
  const cc = p.curves.filter(c=>c.template).length, canMpl = true;
  const inFs = !!document.querySelector('.plot-card.plot-fs');
  const mplBtn = p.mplMode
    ? `<button class="cbtn revert-btn" data-pid="${p.id}" data-action="revert">⟲ interactive</button>`
    : `<button class="cbtn mpl-btn${!canMpl?' mpl-disabled':''}" data-pid="${p.id}" data-action="mpl" ${!canMpl?'disabled':''}>▨ matplotlib</button>`;
  const annDisabled = p.mplMode ? 'disabled style="opacity:.3;pointer-events:none"' : '';
  const dupDelDisabled = inFs ? 'disabled style="opacity:.3;pointer-events:none;cursor:not-allowed"' : '';
  return `
    <div class="ctitle-left">
      <span class="ctitle-text">Plot ${i+1}</span>
      <button class="cbtn addcurve-btn" data-pid="${p.id}" data-action="addcurve">⊕ add curve</button>
    </div>
    <div class="cactions-center">
      ${mplBtn}
      <button class="cbtn text-btn" data-pid="${p.id}" data-action="addtext" ${annDisabled}>✎ annotate</button>
      <button class="cbtn shape-btn" data-pid="${p.id}" data-action="addshape" ${annDisabled}>▣ shape</button>
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
  const dims = getCanvasDims(pid);
  const ti=document.getElementById(`ctitleinp_${pid}`), xi=document.getElementById(`xlabel_${pid}`), yi=document.getElementById(`ylabel_${pid}`);
  if(ti){ ti.style.fontSize=tpx+'px'; autoResizeInput(ti, dims.w); }
  if(xi){ xi.style.fontSize=lpx+'px'; autoResizeInput(xi, Math.floor(dims.w * 0.9)); }
  if(yi){ yi.style.fontSize=lpx+'px'; autoResizeInput(yi, Math.floor(dims.h * 0.9)); }
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
    ann.x_frac = Math.max(0, Math.min(1, frac.x));
    ann.y_frac = Math.max(0, Math.min(1, frac.y));
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
        ann.x_frac = Math.max(0, Math.min(1, frac.x));
        ann.y_frac = Math.max(0, Math.min(1, frac.y));
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
      ann.x_frac = Math.max(0,Math.min(1,nx));
      ann.y_frac = Math.max(0,Math.min(1,ny));
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

function showShapePicker(pid, btnEl){
  closeShapePicker(); closeAnnMenu(); closeShapeMenu();
  const p = gp(pid); if(!p || p.mplMode) return;

  const menu = document.createElement('div');
  menu.className = 'shape-picker';
  _shapePickerEl = menu;

  [
    { type:'point',  icon:'●', label:'Point'  },
    { type:'circle', icon:'○', label:'Circle' },
    { type:'square', icon:'□', label:'Square' },
    { type:'arrow',  icon:'→', label:'Arrow'  },
  ].forEach(({type,icon,label})=>{
    const btn = document.createElement('button');
    btn.className = 'shape-pick-btn';
    btn.innerHTML = `<span class="shape-pick-icon">${icon}</span><span class="shape-pick-lbl">${label}</span>`;
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      closeShapePicker();
      addShapeAnnotation(pid, type);
    });
    menu.appendChild(btn);
  });

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
  const sh = {
    id: mkCid(), type,
    x_frac:0.5, y_frac:0.5,
    x2_frac:0.7, y2_frac:0.3,
    color:'#5affce',
    size: type==='point' ? 9 : 30,
    stroke_width: 2,
    fill_color: '#5affce',
    fill_alpha: 0,
    lock:'plot',
    data_x:null, data_y:null,
    data_x2:null, data_y2:null,
  };
  const ch = chartInstances[pid];
  if(ch){
    const d = fracToData(ch, 0.5, 0.5); sh.data_x=d.dataX; sh.data_y=d.dataY;
    if(type==='arrow'){ const d2=fracToData(ch,0.7,0.3); sh.data_x2=d2.dataX; sh.data_y2=d2.dataY; }
  }
  p.shapeAnnotations.push(sh);
  renderShapeAnnotations(pid);
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
      if(sh.data_x!=null){ const f=dataToFrac(ch,sh.data_x,sh.data_y); sh.x_frac=Math.max(0,Math.min(1,f.x)); sh.y_frac=Math.max(0,Math.min(1,f.y)); }
      if(sh.type==='arrow' && sh.data_x2!=null){ const f2=dataToFrac(ch,sh.data_x2,sh.data_y2); sh.x2_frac=Math.max(0,Math.min(1,f2.x)); sh.y2_frac=Math.max(0,Math.min(1,f2.y)); }
    });
  }

  p.shapeAnnotations.forEach(sh=>_renderOneShape(sh,pid,wrap));
}

function _applyVisStyle(vis, sh){
  const s  = sh.size;
  const sw = sh.stroke_width ?? 2;
  const fill = (sh.fill_alpha > 0) ? _hexToRgba(sh.fill_color || sh.color, sh.fill_alpha) : 'transparent';
  if(sh.type==='point'){
    vis.style.cssText = `width:${s}px;height:${s}px;border-radius:50%;background:${sh.color}`;
  } else if(sh.type==='circle'){
    vis.style.cssText = `width:${s}px;height:${s}px;border-radius:50%;border:${sw}px solid ${sh.color};background:${fill};box-sizing:border-box`;
  } else {
    vis.style.cssText = `width:${s}px;height:${s}px;border:${sw}px solid ${sh.color};background:${fill};box-sizing:border-box`;
  }
}

function _renderOneShape(sh, pid, wrap){
  if(sh.type==='arrow'){ _renderArrow(sh,pid,wrap); return; }

  const outer = document.createElement('div');
  outer.className = 'shape-ann';
  outer.dataset.shapeId = sh.id;
  outer.style.cssText = `position:absolute;left:${sh.x_frac*100}%;top:${sh.y_frac*100}%;transform:translate(-50%,-50%);z-index:25;cursor:move;user-select:none`;

  const vis = document.createElement('div');
  vis.className = 'shape-visual';
  _applyVisStyle(vis, sh);
  outer.appendChild(vis);

  const hbg = document.createElement('button');
  hbg.className = 'shape-hamburger';
  hbg.innerHTML = '&#8942;';
  hbg.addEventListener('mousedown', e=>{ e.stopPropagation(); e.preventDefault(); showShapeMenu(sh,pid,hbg); });
  outer.appendChild(hbg);

  outer.addEventListener('mouseenter', ()=>{ vis.style.outline='1px dashed rgba(90,255,206,.4)'; hbg.style.opacity='1'; });
  outer.addEventListener('mouseleave', ()=>{ vis.style.outline=''; hbg.style.opacity='0'; });

  let drag=false, lx=0, ly=0;
  outer.addEventListener('mousedown', e=>{
    if(e.target===hbg) return;
    drag=true; lx=e.clientX; ly=e.clientY;
    e.preventDefault(); e.stopPropagation(); outer.style.cursor='grabbing';
  });
  const onMove = e=>{
    if(!drag) return;
    const rect=wrap.getBoundingClientRect();
    sh.x_frac = Math.max(0,Math.min(1, sh.x_frac+(e.clientX-lx)/rect.width));
    sh.y_frac = Math.max(0,Math.min(1, sh.y_frac+(e.clientY-ly)/rect.height));
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

  // Line
  const lineEl = mkEl('shape-arr-line',
    `position:absolute;left:${x1}px;top:${y1-sw/2}px;width:${len}px;height:${sw}px;background:${sh.color};transform-origin:0 50%;transform:rotate(${ang}deg);z-index:21;pointer-events:none`);

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
  hbg.addEventListener('mousedown', e=>{ e.stopPropagation(); e.preventDefault(); showShapeMenu(sh,pid,hbg); });
  h1el.appendChild(hbg);
  h1el.addEventListener('mouseenter', ()=>hbg.style.opacity='1');
  h1el.addEventListener('mouseleave', ()=>hbg.style.opacity='0');

  // Hitbox drag — moves both endpoints together
  {
    let drag=false, lx=0, ly=0;
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
      sh.x_frac =Math.max(0,Math.min(1,sh.x_frac +dfx)); sh.y_frac =Math.max(0,Math.min(1,sh.y_frac +dfy));
      sh.x2_frac=Math.max(0,Math.min(1,sh.x2_frac+dfx)); sh.y2_frac=Math.max(0,Math.min(1,sh.y2_frac+dfy));
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
      if(isStart){ sh.x_frac=Math.max(0,Math.min(1,sh.x_frac+dfx)); sh.y_frac=Math.max(0,Math.min(1,sh.y_frac+dfy)); }
      else        { sh.x2_frac=Math.max(0,Math.min(1,sh.x2_frac+dfx)); sh.y2_frac=Math.max(0,Math.min(1,sh.y2_frac+dfy)); }
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

function showShapeMenu(sh, pid, triggerEl){
  closeShapeMenu(); closeAnnMenu();
  const p = gp(pid); if(!p) return;

  const menu = document.createElement('div');
  menu.className = 'ann-menu shape-menu';
  _shapeMenuEl = menu;

  // ── Stroke color ─────────────────────────────────────────────────
  const colorRow = document.createElement('div'); colorRow.className='ann-menu-row-inline';
  colorRow.innerHTML = `<label>${sh.type==='point'?'Color':'Stroke color'}</label>
    <div class="ann-menu-color-group">
      <div class="ann-color-swatch"><input type="color" id="shMenuColor" value="${sh.color}"/></div>
      <input class="ann-menu-inp ann-menu-inp-hex" id="shMenuColorHex" type="text" value="${sh.color}" maxlength="7"/>
    </div>`;
  menu.appendChild(colorRow);

  // ── Stroke width (not for point) ─────────────────────────────────
  if(sh.type !== 'point'){
    const swRow = document.createElement('div'); swRow.className='ann-menu-row-inline';
    swRow.innerHTML = `<label>Stroke width</label><input class="ann-menu-inp ann-menu-inp-sm" id="shMenuSW" type="number" value="${sh.stroke_width??2}" min="1" max="20" step="0.5"/>`;
    menu.appendChild(swRow);
  }

  // ── Fill color + alpha (circle / square only) ─────────────────────
  if(sh.type==='circle' || sh.type==='square'){
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
    alphaRow.innerHTML = `<label>Fill opacity — <span id="shMenuAlphaVal" style="color:var(--acc2)">${alphaPct}%</span></label>
      <input type="range" id="shMenuAlpha" min="0" max="1" step="0.05" value="${sh.fill_alpha||0}" style="width:90px"/>`;
    menu.appendChild(alphaRow);
  }

  // ── Size (not for arrow) ──────────────────────────────────────────
  if(sh.type !== 'arrow'){
    const divider = document.createElement('div'); divider.className='ann-menu-divider'; menu.appendChild(divider);
    const sizeRow = document.createElement('div'); sizeRow.className='ann-menu-row-inline';
    sizeRow.innerHTML = `<label>Size (px)</label><input class="ann-menu-inp ann-menu-inp-sm" id="shMenuSize" type="number" value="${sh.size}" min="4" max="200" step="1"/>`;
    menu.appendChild(sizeRow);
  }

  // ── Anchor (lock) ────────────────────────────────────────────────
  {
    const divider = document.createElement('div'); divider.className='ann-menu-divider'; menu.appendChild(divider);
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
    sizeInp.addEventListener('input', ()=>{ sh.size=Math.max(4,parseInt(sizeInp.value)||sh.size); reRender(); });
    sizeInp.addEventListener('change', ()=>snapshotForUndo());
  }

  const lockPlotBtn   = document.getElementById('shLockPlot');
  const lockWindowBtn = document.getElementById('shLockWindow');
  if(lockPlotBtn && lockWindowBtn){
    const setLock = mode=>{
      sh.lock = mode;
      // Seed/clear data coords on switch
      if(mode==='plot'){
        const c=chartInstances[pid]; if(c){
          const d=fracToData(c,sh.x_frac,sh.y_frac); sh.data_x=d.dataX; sh.data_y=d.dataY;
          if(sh.type==='arrow'){ const d2=fracToData(c,sh.x2_frac,sh.y2_frac); sh.data_x2=d2.dataX; sh.data_y2=d2.dataY; }
        }
      } else { sh.data_x=null; sh.data_y=null; sh.data_x2=null; sh.data_y2=null; }
      lockPlotBtn.classList.toggle('active', mode==='plot');
      lockWindowBtn.classList.toggle('active', mode==='window');
      snapshotForUndo();
    };
    lockPlotBtn.addEventListener('mousedown', e=>{ e.preventDefault(); setLock('plot'); });
    lockWindowBtn.addEventListener('mousedown', e=>{ e.preventDefault(); setLock('window'); });
  }

  // Position below trigger, flip up if no room
  const r=triggerEl.getBoundingClientRect();
  menu.style.visibility='hidden'; menu.style.display='flex';
  const mh=menu.offsetHeight, mw=menu.offsetWidth;
  menu.style.visibility=''; menu.style.display='';
  let top=r.bottom+6, left=r.left+r.width/2-mw/2;
  if(top+mh > window.innerHeight-8) top=r.top-mh-6;
  menu.style.top  = Math.max(8,top)+'px';
  menu.style.left = Math.max(8,Math.min(window.innerWidth-mw-8,left))+'px';

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

  if(action==='dup')  { duplicatePlot(pid); return; }
  if(action==='addcurve'){
    // Set this plot active first so the modal adds to the right plot
    activePid = pid; activeCurveIdx = 0;
    syncActiveHighlight(); refreshCfg(); refreshSidebar();
    openTemplateModal(); return;
  }
  if(action==='addtext'){
    // Block annotations in matplotlib mode
    const p = gp(pid); if(p && p.mplMode) return;
    addTextAnnotation(pid); return;
  }
  if(action==='addshape'){
    const p = gp(pid); if(p && p.mplMode) return;
    showShapePicker(pid, triggerEl);
    return;
  }
  if(action==='fullscreen') { toggleFullscreen(pid); return; }
  if(action==='del'){
    destroyChart(pid);
    plots = plots.filter(p=>p.id!==pid);
    if(activePid===pid){ activePid=plots[0]?.id||null; activeCurveIdx=0; }
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