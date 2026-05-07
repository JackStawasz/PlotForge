// ═══ TEXT ANNOTATIONS ════════════════════════════════════════════════════
// Annotation font sizes are stored in logical pt to match the right-panel controls.
// JS renders at size * JS_ANN_SCALE px so on-screen size matches the matplotlib export.
const JS_ANN_SCALE = 1.4;

let _annMenu = null;

function closeAnnMenu(){
  if(_annMenu){ _annMenu.remove(); _annMenu=null; }
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
let _shapePickerEl      = null;
let _shapePickerOutside = null;
let _shapeMenuEl        = null;

function closeShapePicker(){
  if(_shapePickerEl){ _shapePickerEl.remove(); _shapePickerEl=null; }
  if(_shapePickerOutside){ document.removeEventListener('mousedown', _shapePickerOutside); _shapePickerOutside=null; }
}
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
    if(!menu.contains(e.target) && e.target!==btnEl) closeShapePicker();
  };
  _shapePickerOutside = outside;
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

  // Hamburger at arrow midpoint
  const hbg=document.createElement('button');
  hbg.className='shape-hamburger'; hbg.innerHTML='&#8942;';
  const _arrowMidPt = ()=>{
    const wr = wrap.getBoundingClientRect();
    return { x: wr.left + (sh.x_frac + sh.x2_frac) / 2 * wr.width,
             y: wr.top  + (sh.y_frac + sh.y2_frac) / 2 * wr.height };
  };
  hbg.addEventListener('mousedown', e=>{ e.stopPropagation(); e.preventDefault(); showShapeMenu(sh,pid,hbg,_arrowMidPt()); });
  const midEl = mkEl('shape-arr-mid',
    `position:absolute;left:${(x1+x2)/2}px;top:${(y1+y2)/2}px;transform:translate(-50%,-50%);z-index:24;opacity:0;transition:opacity .12s;cursor:pointer`);
  midEl.appendChild(hbg);

  // Shared hover-show / hover-hide logic with a settle timer
  let hoverTimer=null, arrowDragging=false;
  const showH = ()=>{ clearTimeout(hoverTimer); h1el.style.opacity='1'; h2el.style.opacity='1'; midEl.style.opacity='1'; };
  const hideH = ()=>{ hoverTimer=setTimeout(()=>{ if(!arrowDragging){ h1el.style.opacity='0'; h2el.style.opacity='0'; midEl.style.opacity='0'; } }, 160); };
  [hitEl, h1el, h2el, midEl].forEach(el=>{ el.addEventListener('mouseenter', showH); el.addEventListener('mouseleave', hideH); });

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
  wrap.appendChild(midEl);
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
