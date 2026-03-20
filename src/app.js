const API = 'http://localhost:5000/api';

// ═══ CATEGORY META ═══════════════════════════════════════════════════════
const CAT_META = {
  trig:   { label:'Trigonometric',   dotClass:'trig'   },
  bell:   { label:'Bell Curves',     dotClass:'bell'   },
  simple: { label:'Simple Functions',dotClass:'simple' },
};

// ═══ STATE ═══════════════════════════════════════════════════════════════
let TEMPLATES    = {};
let plots        = [];
let activePid    = null;
let selTpl       = null;
let renderTimers = {};
let cfgDebounce  = null;
let pid_ctr      = 0;

// per-chart: true only on the very first fresh render (to animate once)
const chartFirstRender = {};
const chartInstances   = {};

function mkPid(){ return ++pid_ctr; }

function defView(){
  return {
    x_min:null,x_max:null,y_min:null,y_max:null,
    line_color:'#5affce',line_width:2,line_style:'solid',
    marker:'none',marker_size:4,fill_under:false,
    show_grid:true,title_size:13,label_size:10,fill_alpha:.15
  };
}

function mkPlot(){
  return {
    id:mkPid(), template:null, params:{}, view:defView(),
    labels:{title:'',xlabel:'x',ylabel:'y'},
    jsData:null, mplImage:null, mode:'js', equation:'',
    loading:false, converting:false
  };
}

function gp(pid){ return plots.find(p=>p.id===pid); }

// ═══ BOOT ════════════════════════════════════════════════════════════════
async function boot(){
  try{
    const r = await fetch(`${API}/templates`);
    TEMPLATES = await r.json();
    buildCategories();
    setConn('ok','Backend connected');
  }catch(e){
    setConn('err','Backend unreachable — run app.py');
  }
  plots = [];
  const p = mkPlot();
  plots.push(p);
  activePid = p.id;
  renderDOM();
  wireAllCfgInputs();
}

function setConn(s, msg){
  document.getElementById('cdot').className = 'cdot' + (s==='ok'?' ok':s==='err'?' err':'');
  document.getElementById('cmsg').textContent = msg;
}

// ═══ CATEGORIES ══════════════════════════════════════════════════════════
function buildCategories(){
  const container = document.getElementById('catBlocks');
  container.innerHTML = '';
  const grouped = {};
  for(const [key,tpl] of Object.entries(TEMPLATES)){
    if(!grouped[tpl.category]) grouped[tpl.category] = [];
    grouped[tpl.category].push({key, tpl});
  }
  for(const [cat, items] of Object.entries(grouped)){
    const meta = CAT_META[cat] || {label:cat, dotClass:''};
    const wrap = document.createElement('div');
    wrap.style.marginBottom = '4px';
    const hdr = document.createElement('button');
    hdr.className = 'cat-hdr';
    hdr.innerHTML = `<div class="cat-dot ${meta.dotClass}"></div><span>${meta.label}</span><span class="cat-arrow">›</span>`;
    const body = document.createElement('div');
    body.className = 'cat-body';
    const list = document.createElement('div');
    list.className = 'tpl-list';
    for(const {key, tpl} of items){
      const btn = document.createElement('button');
      btn.className = 'tpl-item';
      btn.dataset.key = key;
      btn.innerHTML = `<span>${tpl.label}</span><span class="tpl-eq">${tpl.equation}</span>`;
      btn.addEventListener('click', () => selectTemplate(key));
      list.appendChild(btn);
    }
    body.appendChild(list);
    hdr.addEventListener('click', () => {
      const wasOpen = body.classList.contains('open');
      document.querySelectorAll('.cat-body').forEach(b => b.classList.remove('open'));
      document.querySelectorAll('.cat-hdr').forEach(h => h.classList.remove('open'));
      if(!wasOpen){ body.classList.add('open'); hdr.classList.add('open'); }
    });
    wrap.appendChild(hdr);
    wrap.appendChild(body);
    container.appendChild(wrap);
  }
}

// ═══ SELECT TEMPLATE ═════════════════════════════════════════════════════
function selectTemplate(key){
  selTpl = key;
  document.querySelectorAll('.tpl-item').forEach(b => b.classList.toggle('sel', b.dataset.key===key));
  const pa = document.getElementById('paramsArea');
  pa.innerHTML = '';
  for(const [pk, p] of Object.entries(TEMPLATES[key].params)){
    const row = document.createElement('div');
    row.className = 'p-row';
    row.dataset.pkey = pk;
    const fmt = v => p.step < 1 ? parseFloat(v).toFixed(2) : parseInt(v);
    row.innerHTML = `
      <label><span>${p.label}</span><span class="pval" id="pv_${pk}">${fmt(p.default)}</span></label>
      <input type="range" id="ps_${pk}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.default}"
        oninput="onParamChange('${pk}', this.value)"/>`;
    pa.appendChild(row);
  }
  if(key === 'poly_custom') updatePolyCoeffVisibility(TEMPLATES.poly_custom.params.degree.default);
  triggerAutoRender();
}

function onParamChange(pk, val){
  const tpl = selTpl ? TEMPLATES[selTpl] : null;
  if(tpl && tpl.params[pk]){
    const el = document.getElementById(`pv_${pk}`);
    if(el) el.textContent = tpl.params[pk].step < 1 ? parseFloat(val).toFixed(2) : parseInt(val);
  }
  if(selTpl === 'poly_custom' && pk === 'degree') updatePolyCoeffVisibility(parseInt(val));
  triggerAutoRender();
}

function updatePolyCoeffVisibility(deg){
  document.getElementById('paramsArea').querySelectorAll('.p-row').forEach(row => {
    const pk = row.dataset.pkey;
    if(!pk || pk === 'degree') return;
    row.style.display = parseInt(pk.replace('a','')) <= deg ? '' : 'none';
  });
}

// ═══ AUTO-RENDER ═════════════════════════════════════════════════════════
function triggerAutoRender(){
  if(activePid === null || !selTpl) return;
  clearTimeout(renderTimers[activePid]);
  renderTimers[activePid] = setTimeout(() => applyAndRender(activePid), 320);
}

function applyAndRender(pid){
  const p = gp(pid);
  if(!p || !selTpl) return;
  const params = {};
  for(const pk of Object.keys(TEMPLATES[selTpl].params)){
    const el = document.getElementById(`ps_${pk}`);
    if(el) params[pk] = parseFloat(el.value);
  }
  p.template = selTpl;
  p.params   = params;
  if(!p.labels.title) p.labels.title = TEMPLATES[selTpl].label;
  if(p.mode === 'mpl'){ p.mode = 'js'; p.mplImage = null; }
  fetchJSData(pid, /*isFirstRender=*/true);
}

// ═══ FETCH JS DATA ════════════════════════════════════════════════════════
async function fetchJSData(pid, isFirstRender=false){
  const p = gp(pid);
  if(!p || !p.template) return;
  p.loading = true;
  updateSpinner(pid);

  try{
    const r = await fetch(`${API}/data`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({template:p.template, params:p.params, view:p.view}),
    });
    const data = await r.json();
    if(data.error) throw new Error(data.error);
    p.jsData   = {x:data.x, y:data.y, discrete:data.discrete};
    p.equation = data.equation;
    p.mode     = 'js';
    p.mplImage = null;
    if(isFirstRender) chartFirstRender[pid] = true;
    setConn('ok', `${TEMPLATES[p.template].label} · ${data.x.length} pts`);
  }catch(e){
    setConn('err', 'Error: ' + e.message);
  }finally{
    p.loading = false;
    updateCardContent(pid);
    updateSpinner(pid);
  }
}

// ═══ CONVERT TO MATPLOTLIB ═══════════════════════════════════════════════
async function convertToMpl(pid){
  const p = gp(pid);
  if(!p || !p.template) return;
  p.converting = true;
  p.loading    = true;
  updateSpinner(pid);

  try{
    const r = await fetch(`${API}/plot`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({template:p.template, params:p.params, view:p.view, labels:p.labels}),
    });
    const data = await r.json();
    if(data.error) throw new Error(data.error);
    p.mplImage = data.image;
    p.mode     = 'mpl';
    p.equation = data.equation;
    setConn('ok', `Matplotlib: ${TEMPLATES[p.template].label}`);
  }catch(e){
    setConn('err', 'Error: ' + e.message);
  }finally{
    p.loading    = false;
    p.converting = false;
    updateCardContent(pid);
    updateSpinner(pid);
    updateTopbar(pid);
  }
}

function revertToJS(pid){
  const p = gp(pid);
  if(!p) return;
  p.mode     = 'js';
  p.mplImage = null;
  updateCardContent(pid);
  updateTopbar(pid);
  if(p.template) fetchJSData(pid, false);
}

// ═══ CONTENT HTML BUILDER ════════════════════════════════════════════════
function buildInnerHTML(p){
  const pid = p.id;
  if(!p.template || (!p.jsData && !p.mplImage)){
    return `<div class="plot-empty"><div class="ei">⌁</div><span>Choose a template — auto-renders</span></div>`;
  }
  if(p.mode === 'mpl' && p.mplImage){
    return `<div class="mpl-body"><img class="mpl-img" src="data:image/png;base64,${p.mplImage}" alt="plot"/></div>`;
  }
  // JS mode: chart-region wraps canvas-wrap + positioned axis labels
  return `
    <div class="chart-region" id="cregion_${pid}">
      <div class="canvas-wrap" id="cwrap_${pid}">
        <canvas id="chart_${pid}" style="display:block;width:100%"></canvas>
      </div>
      <!-- X label centered at the bottom of chart-region -->
      <div class="ax-xlabel">
        <input class="lbl-inp" id="xlabel_${pid}" type="text"
               value="${p.labels.xlabel}" placeholder="x label"
               title="Click to edit x-axis label"/>
      </div>
      <!-- Y label centered vertically on the left, rotated -->
      <div class="ax-ylabel">
        <input class="lbl-inp" id="ylabel_${pid}" type="text"
               value="${p.labels.ylabel}" placeholder="y label"
               title="Click to edit y-axis label"/>
      </div>
    </div>`;
}

// ═══ SELECTIVE DOM UPDATE ════════════════════════════════════════════════
function updateCardContent(pid){
  const p = gp(pid);
  if(!p) return;
  const innerEl = document.getElementById(`cinner_${pid}`);
  if(!innerEl) return; // not in DOM yet

  destroyChart(pid);
  innerEl.innerHTML = buildInnerHTML(p);

  if(p.mode === 'js' && p.jsData){
    setTimeout(() => {
      drawChart(p);
      wirePan(p);
      wireAxisLabelInputs(p);
    }, 0);
  }
}

function updateTopbar(pid){
  const p = gp(pid);
  if(!p) return;
  const topEl = document.getElementById(`ctop_${pid}`);
  if(!topEl) return;
  topEl.innerHTML = buildTopbarInner(p, plots.findIndex(q => q.id===pid));
  wireTopbarTitle(p);
}

function updateSpinner(pid){
  const p  = gp(pid);
  if(!p) return;
  const sp = document.getElementById(`spin_${pid}`);
  const sh = document.getElementById(`shim_${pid}`);
  if(sp){
    sp.classList.toggle('show', p.loading);
    if(p.loading) sp.querySelector('.spin-lbl').textContent = p.converting ? 'converting to matplotlib…' : 'rendering…';
  }
  if(sh) sh.classList.toggle('show', p.converting);
}

// ═══ FULL DOM RENDER ═════════════════════════════════════════════════════
function renderDOM(){
  for(const p of plots) destroyChart(p.id);

  const list = document.getElementById('plotList');
  list.innerHTML = '';
  plots.forEach((p, i) => list.appendChild(buildCard(p, i)));

  const ghost = document.createElement('div');
  ghost.className = 'add-card';
  ghost.innerHTML = `<div class="add-plus">+</div><span>Add new plot</span>`;
  ghost.addEventListener('click', () => {
    const np = mkPlot();
    plots.push(np);
    activePid = np.id;
    renderDOM();
    refreshCfg();
  });
  list.appendChild(ghost);

  refreshCfg();
  setTimeout(() => {
    for(const p of plots){
      if(p.mode === 'js' && p.jsData){
        drawChart(p);
        wirePan(p);
        wireAxisLabelInputs(p);
      }
    }
  }, 0);
}

function buildCard(p, i){
  const card = document.createElement('div');
  card.className = 'plot-card' + (p.id===activePid ? ' active' : '');
  card.dataset.pid = p.id;

  card.innerHTML = `
    <div class="ctop" id="ctop_${p.id}">
      ${buildTopbarInner(p, i)}
    </div>
    <div class="cbody" id="cbody_${p.id}">
      <div id="cinner_${p.id}">${buildInnerHTML(p)}</div>
      <div class="spin-overlay${p.loading?' show':''}" id="spin_${p.id}">
        <div class="spinner"></div>
        <div class="spin-lbl">${p.converting?'converting to matplotlib…':'rendering…'}</div>
      </div>
      <div class="shimmer-overlay${p.converting?' show':''}" id="shim_${p.id}"></div>
    </div>`;

  card.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if(btn){ handleAction(btn.dataset.action, parseInt(btn.dataset.pid)); return; }
    if(e.target.closest('.lbl-inp') || e.target.closest('.ctitle')) return;
    // Just toggle active class — no renderDOM, prevents jitter
    if(activePid !== p.id){
      activePid = p.id;
      syncActiveHighlight();
      refreshCfg();
    }
  });

  setTimeout(() => wireTopbarTitle(p), 0);
  return card;
}

function buildTopbarInner(p, i){
  const tplName = p.template ? TEMPLATES[p.template]?.label || p.template : '—';
  const eq      = p.equation || (p.template ? TEMPLATES[p.template]?.equation : '');
  const editable = p.mode === 'js';
  let modeBtn = '';
  if(p.template){
    modeBtn = p.mode === 'js'
      ? `<button class="cbtn mpl-btn" data-pid="${p.id}" data-action="mpl">⚗ matplotlib</button>`
      : `<button class="cbtn revert-btn" data-pid="${p.id}" data-action="revert">⟲ interactive</button>`;
  }
  return `
    <span class="cnum">PLOT ${String(i+1).padStart(2,'0')}</span>
    <span class="ctitle ${editable?'editable':'readonly'}" id="ctitle_${p.id}"
          title="${editable?'Click to edit title':''}">${p.labels.title || tplName}</span>
    ${eq ? `<span class="ceq">${eq}</span>` : ''}
    <div class="cactions">
      ${modeBtn}
      <button class="cbtn" data-pid="${p.id}" data-action="del">✕</button>
    </div>`;
}

// ═══ TITLE EDITING ═══════════════════════════════════════════════════════
function wireTopbarTitle(p){
  const el = document.getElementById(`ctitle_${p.id}`);
  if(!el || !el.classList.contains('editable')) return;
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if(document.querySelector('.title-inp')) return;
    const inp = document.createElement('input');
    inp.className = 'title-inp';
    inp.type = 'text';
    inp.value = p.labels.title;
    const rect = el.getBoundingClientRect();
    inp.style.left  = rect.left + 'px';
    inp.style.top   = rect.top  + 'px';
    inp.style.width = Math.max(140, rect.width + 20) + 'px';
    document.body.appendChild(inp);
    inp.focus(); inp.select();
    function commit(){
      p.labels.title = inp.value.trim() || TEMPLATES[p.template]?.label || '';
      el.textContent = p.labels.title;
      inp.remove();
    }
    inp.addEventListener('keydown', (e) => {
      if(e.key === 'Enter') commit();
      else if(e.key === 'Escape') inp.remove();
    });
    inp.addEventListener('blur', commit);
  });
}

// ═══ AXIS LABEL INPUTS ═══════════════════════════════════════════════════
function wireAxisLabelInputs(p){
  const xi = document.getElementById(`xlabel_${p.id}`);
  const yi = document.getElementById(`ylabel_${p.id}`);
  if(xi){
    xi.value = p.labels.xlabel;
    xi.addEventListener('change', () => { p.labels.xlabel = xi.value; });
    xi.addEventListener('input',  () => { p.labels.xlabel = xi.value; });
    // prevent card click from propagating while editing
    xi.addEventListener('click', e => e.stopPropagation());
  }
  if(yi){
    yi.value = p.labels.ylabel;
    yi.addEventListener('change', () => { p.labels.ylabel = yi.value; });
    yi.addEventListener('input',  () => { p.labels.ylabel = yi.value; });
    yi.addEventListener('click',  e => e.stopPropagation());
  }
}

// ═══ ACTIVE HIGHLIGHT (no renderDOM — just toggle class) ═════════════════
function syncActiveHighlight(){
  document.querySelectorAll('.plot-card').forEach(c => {
    c.classList.toggle('active', parseInt(c.dataset.pid) === activePid);
  });
}

// ═══ CHART.JS ════════════════════════════════════════════════════════════
function destroyChart(pid){
  if(chartInstances[pid]){ chartInstances[pid].destroy(); delete chartInstances[pid]; }
}

function drawChart(p){
  const canvas = document.getElementById(`chart_${p.id}`);
  if(!canvas || !p.jsData) return;

  const shouldAnimate = !!chartFirstRender[p.id];
  if(shouldAnimate) delete chartFirstRender[p.id];

  const v    = p.view;
  const lc   = v.line_color || '#5affce';
  const data = p.jsData;

  // If chart already exists and this is NOT a first render, update in-place
  if(chartInstances[p.id] && !shouldAnimate){
    const ch = chartInstances[p.id];
    ch.data.labels = data.x.map(n => parseFloat(n.toFixed(3)));
    ch.data.datasets[0].data             = data.y;
    ch.data.datasets[0].borderColor      = lc;
    ch.data.datasets[0].borderWidth      = v.line_width || 2;
    ch.data.datasets[0].fill             = v.fill_under;
    ch.data.datasets[0].backgroundColor  = hexAlpha(lc, v.fill_alpha || .15);
    ch.data.datasets[0].borderDash       = dashFor(v.line_style);
    ch.data.datasets[0].pointRadius      = v.marker !== 'none' ? v.marker_size || 4 : 0;
    ch.options.scales.x.grid.display     = v.show_grid;
    ch.options.scales.y.grid.display     = v.show_grid;
    applyScaleLimits(ch.options.scales, v);
    ch.update('none');
    return;
  }

  destroyChart(p.id);
  const ctx    = canvas.getContext('2d');
  const scales = buildScales(v);
  const animOpts = shouldAnimate ? {duration:500, easing:'easeOutQuart'} : {duration:0};

  if(data.discrete){
    chartInstances[p.id] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.x.map(n => n),
        datasets: [{
          data: data.y,
          backgroundColor: hexAlpha(lc, .7),
          borderColor: lc, borderWidth: 1,
        }]
      },
      options: {
        responsive:true, maintainAspectRatio:true,
        animation: animOpts,
        plugins: {legend:{display:false}, tooltip:tooltipOpts()},
        scales
      }
    });
  }else{
    chartInstances[p.id] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.x.map(n => parseFloat(n.toFixed(3))),
        datasets: [{
          data: data.y,
          borderColor: lc, borderWidth: v.line_width || 2,
          borderDash: dashFor(v.line_style),
          pointRadius: v.marker !== 'none' ? v.marker_size || 4 : 0,
          pointBackgroundColor: lc,
          fill: v.fill_under,
          backgroundColor: hexAlpha(lc, v.fill_alpha || .15),
          tension: 0.35, spanGaps: true,
        }]
      },
      options: {
        responsive:true, maintainAspectRatio:true,
        animation: animOpts,
        plugins: {legend:{display:false}, tooltip:tooltipOpts()},
        scales
      }
    });
  }
}

function dashFor(ls){
  return ls==='dashed'?[6,3]:ls==='dotted'?[2,3]:ls==='dashdot'?[6,3,2,3]:[];
}

function buildScales(v){
  const s = {
    x: {
      ticks: {color:'#6060a0', font:{family:"'IBM Plex Mono'",size:9}, maxTicksLimit:10},
      grid:  {color:'rgba(37,37,64,.8)', display:v.show_grid},
    },
    y: {
      ticks: {color:'#6060a0', font:{family:"'IBM Plex Mono'",size:9}, maxTicksLimit:8},
      grid:  {color:'rgba(37,37,64,.8)', display:v.show_grid},
    },
  };
  applyScaleLimits(s, v);
  return s;
}

function applyScaleLimits(scales, v){
  if(v.x_min != null) scales.x.min = v.x_min; else delete scales.x.min;
  if(v.x_max != null) scales.x.max = v.x_max; else delete scales.x.max;
  if(v.y_min != null) scales.y.min = v.y_min; else delete scales.y.min;
  if(v.y_max != null) scales.y.max = v.y_max; else delete scales.y.max;
}

function tooltipOpts(){
  return {
    backgroundColor:'#0c0c18', borderColor:'#252540', borderWidth:1,
    titleColor:'#d4ff5a', bodyColor:'#d0d0ee',
    titleFont:{family:"'IBM Plex Mono'",size:10},
    bodyFont: {family:"'IBM Plex Mono'",size:10},
    callbacks:{
      title: items => `x = ${items[0].label}`,
      label: item  => `y = ${Number(item.raw)?.toFixed(5) ?? '—'}`,
    }
  };
}

function hexAlpha(hex, a){
  if(!hex || hex.length < 7) return `rgba(90,255,206,${a})`;
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ═══ PAN (click-drag) ════════════════════════════════════════════════════
function wirePan(p){
  const wrap = document.getElementById(`cwrap_${p.id}`);
  if(!wrap) return;

  let dragging = false, startX = 0, startY = 0;
  let panDebounce = null;

  function getRange(){
    const ch = chartInstances[p.id];
    if(!ch) return null;
    return {
      xMin: ch.scales.x.min,
      xMax: ch.scales.x.max,
      yMin: ch.scales.y.min,
      yMax: ch.scales.y.max,
      xPx:  ch.scales.x.right - ch.scales.x.left,
      yPx:  ch.scales.y.top   - ch.scales.y.bottom,  // top > bottom in canvas coords
    };
  }

  function onDown(e){
    if(e.button !== 0) return;
    dragging = true;
    startX   = e.clientX;
    startY   = e.clientY;
    wrap.classList.add('panning');
    e.preventDefault();
  }

  function onMove(e){
    if(!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    startX = e.clientX;
    startY = e.clientY;

    const r = getRange();
    if(!r || r.xPx === 0 || r.yPx === 0) return;

    const xSpan = r.xMax - r.xMin;
    const ySpan = r.yMax - r.yMin;

    // Dragging RIGHT → view shifts RIGHT (data scrolls left) → subtract dx
    // Dragging DOWN  → view shifts DOWN  (data scrolls up)  → add dy
    // In canvas coords, Y increases downward, so dragging down means
    // we want to see LOWER y values — i.e. shift yMin/yMax downward.
    const dxData =  (dx / r.xPx) * xSpan;   // positive drag = pan right = higher x visible
    const dyData =  (dy / r.yPx) * ySpan;   // positive drag = pan down  = lower  y visible

    // Shift the view window — span stays constant
    p.view.x_min = r.xMin - dxData;
    p.view.x_max = r.xMax - dxData;
    p.view.y_min = r.yMin + dyData;  // yPx is inverted (top > bottom px), so + here = pan down
    p.view.y_max = r.yMax + dyData;

    // Immediate visual update — no server round-trip
    const ch = chartInstances[p.id];
    if(ch){
      applyScaleLimits(ch.options.scales, p.view);
      ch.update('none');
    }

    // Sync the cfg domain inputs
    syncCfgDomain();

    // Fetch fresh data for new domain after drag settles
    clearTimeout(panDebounce);
    panDebounce = setTimeout(() => {
      if(p.template) fetchJSData(p.id, false);
    }, 400);
  }

  function onUp(){
    if(!dragging) return;
    dragging = false;
    wrap.classList.remove('panning');
  }

  wrap.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup',   onUp);
}

function syncCfgDomain(){
  if(activePid === null) return;
  const p = gp(activePid);
  if(!p) return;
  const v = p.view;
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val ?? ''; };
  set('c_xn', v.x_min != null ? v.x_min.toFixed(3) : '');
  set('c_xx', v.x_max != null ? v.x_max.toFixed(3) : '');
  set('c_yn', v.y_min != null ? v.y_min.toFixed(3) : '');
  set('c_yx', v.y_max != null ? v.y_max.toFixed(3) : '');
}

// ═══ ACTIONS ═════════════════════════════════════════════════════════════
function handleAction(action, pid){
  if(action === 'del'){
    destroyChart(pid);
    plots = plots.filter(p => p.id !== pid);
    if(activePid === pid) activePid = plots[0]?.id || null;
    if(plots.length === 0){ const np = mkPlot(); plots.push(np); activePid = np.id; }
    renderDOM();
    return;
  }
  if(action === 'mpl')    { convertToMpl(pid); return; }
  if(action === 'revert') { revertToJS(pid);   return; }
}

// ═══ CFG PANEL ═══════════════════════════════════════════════════════════
function refreshCfg(){
  const empty   = document.getElementById('cfgEmpty');
  const content = document.getElementById('cfgContent');
  const p = activePid !== null ? gp(activePid) : null;
  if(!p){ empty.style.display='flex'; content.style.display='none'; return; }
  empty.style.display = 'none';
  content.style.display = 'flex';
  const v = p.view;
  sv('c_xn', v.x_min ?? ''); sv('c_xx', v.x_max ?? '');
  sv('c_yn', v.y_min ?? ''); sv('c_yx', v.y_max ?? '');
  document.getElementById('c_lc').value = v.line_color;
  document.getElementById('c_lchex').value = v.line_color;
  sv('c_lw', v.line_width);
  document.getElementById('c_lw_val').textContent = parseFloat(v.line_width).toFixed(1);
  sv('c_ls', v.line_style);
  sv('c_mk', v.marker);
  document.getElementById('c_fill').checked = v.fill_under;
  document.getElementById('c_grid').checked = v.show_grid;
  sv('c_ts', v.title_size);
  sv('c_ls2', v.label_size);
}

function sv(id, val){ const el = document.getElementById(id); if(el) el.value = val; }
function pf(id){ return parseFloat(document.getElementById(id)?.value); }

function readCfgIntoActive(){
  const p = activePid !== null ? gp(activePid) : null;
  if(!p) return;
  const v = p.view;
  const xn=pf('c_xn'), xx=pf('c_xx'), yn=pf('c_yn'), yx=pf('c_yx');
  v.x_min = isNaN(xn) ? null : xn;
  v.x_max = isNaN(xx) ? null : xx;
  v.y_min = isNaN(yn) ? null : yn;
  v.y_max = isNaN(yx) ? null : yx;
  v.line_color  = document.getElementById('c_lc').value;
  v.line_width  = parseFloat(document.getElementById('c_lw').value);
  v.line_style  = document.getElementById('c_ls').value;
  v.marker      = document.getElementById('c_mk').value;
  v.fill_under  = document.getElementById('c_fill').checked;
  v.show_grid   = document.getElementById('c_grid').checked;
  v.title_size  = parseInt(document.getElementById('c_ts').value) || 13;
  v.label_size  = parseInt(document.getElementById('c_ls2').value) || 10;
}

function triggerCfgRender(){
  if(activePid === null) return;
  readCfgIntoActive();
  const p = gp(activePid);
  if(!p || !p.template) return;
  clearTimeout(cfgDebounce);
  cfgDebounce = setTimeout(() => {
    if(p.mode === 'mpl') convertToMpl(activePid);
    else fetchJSData(activePid, false);
  }, 350);
}

function wireAllCfgInputs(){
  const ids = ['c_xn','c_xx','c_yn','c_yx','c_lw','c_ls','c_mk','c_ts','c_ls2'];
  for(const id of ids){
    const el = document.getElementById(id);
    if(el) el.addEventListener('input',  triggerCfgRender);
    if(el) el.addEventListener('change', triggerCfgRender);
  }
  const lc = document.getElementById('c_lc');
  lc.addEventListener('input', function(){
    document.getElementById('c_lchex').value = this.value;
    triggerCfgRender();
  });
  document.getElementById('c_lchex').addEventListener('input', function(){
    if(/^#[0-9a-fA-F]{6}$/.test(this.value)){
      document.getElementById('c_lc').value = this.value;
      triggerCfgRender();
    }
  });
  document.getElementById('c_lw').addEventListener('input', function(){
    document.getElementById('c_lw_val').textContent = parseFloat(this.value).toFixed(1);
  });
  document.getElementById('c_fill').addEventListener('change', triggerCfgRender);
  document.getElementById('c_grid').addEventListener('change', triggerCfgRender);
}

// ═══ KICK OFF ════════════════════════════════════════════════════════════
boot();
