const API = 'http://localhost:5000/api';

// ═══ DISPLAY CONSTANTS ═══════════════════════════════════════════════════
const CAT_META = {
  trig:     { label:'Trigonometric', dotClass:'trig'     },
  bell:     { label:'Bell Curves',   dotClass:'bell'     },
  lines:    { label:'Lines',         dotClass:'lines'    },
  general:  { label:'General',       dotClass:'general'  },
  other:    { label:'Other',         dotClass:'other'    },
  advanced: { label:'Advanced',      dotClass:'advanced' },
};

const CURVE_COLORS = [
  '#5affce','#d4ff5a','#ff6faa','#ffb347','#a78bfa',
  '#38bdf8','#f472b6','#fb923c','#86efac','#fde68a'
];

// ═══ SHARED STATE ════════════════════════════════════════════════════════
let TEMPLATES      = {};
let plots          = [];
let activePid      = null;
let selTpl         = null;
let activeCurveIdx = 0;
let pid_ctr        = 0;
let curve_ctr      = 0;

const chartFirstRender = {};
const chartInstances   = {};
const panState         = {};

// ═══ UNDO / REDO ═════════════════════════════════════════════════════════
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 60;

function snapshotForUndo(){
  const snap = JSON.stringify({
    plots: plots.map(p=>({
      ...p,
      curves: p.curves.map(c=>({
        ...c,
        jsData: c.template ? null : (c.jsData ? { x:[...c.jsData.x], y:[...c.jsData.y], discrete: c.jsData.discrete } : null),
      }))
    })),
    variables: variables.map(v=>({
      id: v.id, kind: v.kind,
      name: v.name, nameLatex: v.nameLatex || '',
      fullLatex: v.fullLatex || '', exprLatex: v.exprLatex || '',
      value: v.value, paramMin: v.paramMin, paramMax: v.paramMax,
      listLength: v.listLength, listItems: [...(v.listItems||[])],
      fromTemplate: v.fromTemplate, templateKey: v.templateKey,
      paramKey: v.paramKey, pickleSource: v.pickleSource,
      _isNumeric: v._isNumeric || false,
    })),
    varIdCtr,
  });
  if(undoStack.length && undoStack[undoStack.length-1]===snap) return;
  undoStack.push(snap);
  if(undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
  updateUndoRedoBtns();
}

function performUndo(){
  if(undoStack.length < 2) return;
  const current = undoStack.pop();
  redoStack.push(current);
  restoreSnapshot(undoStack[undoStack.length-1]);
  updateUndoRedoBtns();
}

function performRedo(){
  if(!redoStack.length) return;
  const snap = redoStack.pop();
  undoStack.push(snap);
  restoreSnapshot(snap);
  updateUndoRedoBtns();
}

function restoreSnapshot(snap){
  const state = JSON.parse(snap);
  const restoredPlots = Array.isArray(state) ? state : state.plots;
  const restoredVars  = Array.isArray(state) ? null  : state.variables;

  plots.length = 0;
  for(const rp of restoredPlots) plots.push(rp);
  if(!plots.find(p=>p.id===activePid)) activePid = plots[0]?.id ?? null;
  const ap = plots.find(p=>p.id===activePid);
  if(ap && activeCurveIdx >= ap.curves.length) activeCurveIdx = 0;
  renderDOM();
  for(const p of plots){
    // Re-render template curves; list curves already have jsData from snapshot
    if(p.curves.some(c=>c.template)){
      renderJS(p.id, false);
    } else if(p.curves.some(c=>c.jsData)){
      // List-only plot: draw directly with restored jsData
      drawChart(p);
    }
  }
  refreshCfg();

  if(restoredVars && typeof renderVariables === 'function'){
    variables.length = 0;
    for(const rv of restoredVars) variables.push(rv);
    if(state.varIdCtr !== undefined) varIdCtr = state.varIdCtr;
    renderVariables();
    if(typeof reEvalAllConstants === 'function') reEvalAllConstants();
  }
}

function updateUndoRedoBtns(){
  const ub = document.getElementById('undoBtn'), rb = document.getElementById('redoBtn');
  if(ub) ub.disabled = undoStack.length < 2;
  if(rb) rb.disabled = redoStack.length === 0;
}

// ═══ STATE FACTORIES ═════════════════════════════════════════════════════
function mkPid(){ return ++pid_ctr; }
function mkCid(){ return ++curve_ctr; }

function defView(){
  // Pull themed defaults (bg, grid, axes, labels) from the active plot theme.
  // Falls back to dark defaults if theme.js hasn't loaded yet.
  const t = typeof defViewThemeOverrides === 'function'
    ? defViewThemeOverrides()
    : { bg_color:'#12121c', surface_color:'#12121c', chart_theme:'dark',
        show_grid:true, grid_alpha:.5, show_axis_lines:true, axis_alpha:1.0,
        show_legend:true, title_size:13, label_size:10, legend_size:9 };
  return {
    x_min:null, x_max:null, y_min:null, y_max:null,
    x_log:false, y_log:false,
    legend_x_frac: 0.98,
    legend_y_frac: 0.02,
    ...t,
  };
}

function pickCurveColor(existingCurves){
  // Only count curves that are actually rendered; blank placeholder curves don't consume a color slot.
  const realCurves = existingCurves.filter(c => c.template || c.jsData);
  const used = new Set(realCurves.map(c => c.line_color));
  for(const color of CURVE_COLORS){
    if(!used.has(color)) return color;
  }
  return CURVE_COLORS[realCurves.length % CURVE_COLORS.length];
}

function defCurve(existingCurves = []){
  return {
    id: mkCid(),
    template: null, params: {}, equation: '',
    jsData: null,
    line_color: pickCurveColor(existingCurves),
    line_width: 2,
    line_style: 'solid',
    line_connection: 'linear',
    marker: 'none',
    marker_size: 4,
    fill_under: false,
    fill_alpha: .15,
    name: '',
    mask_x_min: null, mask_x_max: null,
    mask_y_min: null, mask_y_max: null,
  };
}

function mkPlot(){
  return {
    id: mkPid(),
    curves: [ defCurve([]) ],
    view: defView(),
    labels: { title:'', xlabel:'', ylabel:'' },
    loading: false,
    converting: false,
    mplMode: false,
    mplImage: null,
  };
}

// ═══ STATE ACCESSORS ═════════════════════════════════════════════════════
function gp(pid){ return plots.find(p => p.id === pid); }
function activePlot(){ return activePid !== null ? gp(activePid) : null; }
function activeCurve(){
  const p = activePlot(); if(!p) return null;
  const real = p.curves.filter(c => c.template || c.jsData);
  if(!real.length) return null;
  const c = p.curves[activeCurveIdx];
  if(c && (c.template || c.jsData)) return c;
  return real[0];
}

// ═══ BOOT ════════════════════════════════════════════════════════════════
async function boot(){
  initTheme();       // restore saved site theme before any DOM rendering
  initMathQuill();
  initLeftSidebar();
  initResizableSidebars();
  wireTemplateModal();
  const connected = await tryConnect();
  plots = [];
  const p = mkPlot(); plots.push(p);
  activePid = p.id; activeCurveIdx = 0;
  renderDOM();
  wireAllCfgInputs();
  initCfgPanel();
  snapshotForUndo(); // initial state
  if(!connected) startReconnectPoller();

  // Resize all JS charts when the main plot column changes size (fixes vertical expansion).
  const plotListEl = document.getElementById('plotList');
  if(plotListEl){
    new ResizeObserver(()=>{
      for(const p of (typeof plots !== 'undefined' ? plots : [])){
        if(!p.mplMode && chartInstances[p.id]){
          chartInstances[p.id].resize();
          renderTextAnnotations(p.id);
          renderShapeAnnotations(p.id);
          refreshOverlayLegend(p.id);
        }
      }
    }).observe(plotListEl);
  }
}

async function tryConnect(){
  try{
    const r = await fetch(`${API}/templates`);
    if(!r.ok) throw new Error('not ok');
    TEMPLATES = await r.json();
    buildCategories();
    setConn('ok','Backend connected');
    return true;
  }catch(e){
    setConn('err','Backend unreachable — run app.py');
    return false;
  }
}

let _reconnectTimer = null;
let _countdownTimer = null;
const _reconnectIntervalSec = 3;

function startReconnectPoller(){
  if(_reconnectTimer) return;
  _showConnBanner('Connecting to backend…', false);
  _startCountdown(_reconnectIntervalSec);
  _reconnectTimer = setInterval(async ()=>{
    const ok = await tryConnect();
    if(ok){
      clearInterval(_reconnectTimer); _reconnectTimer = null;
      clearInterval(_countdownTimer); _countdownTimer = null;
      plots.forEach((p, i)=>updateTopbar(p.id));
      buildModalNavAndGrid?.();
    } else {
      _startCountdown(_reconnectIntervalSec);
    }
  }, _reconnectIntervalSec * 1000);
}

function setConn(s, _msg){
  document.getElementById('cdot').className = 'cdot'+(s==='ok'?' ok':s==='err'?' err':'');
  if(s === 'ok'){
    clearInterval(_countdownTimer); _countdownTimer = null;
    _showConnBanner('Backend connected', true);
    setTimeout(_hideConnBanner, 2200);
  } else if(s === 'err' && !_reconnectTimer){
    _showConnBanner('Connecting to backend…', false);
    _startCountdown(_reconnectIntervalSec);
  }
}

function _showConnBanner(msg, isOk){
  const banner = document.getElementById('connBanner'); if(!banner) return;
  document.getElementById('connBannerMsg').textContent = msg;
  banner.classList.toggle('conn-banner-ok', isOk);
  banner.classList.add('visible');
}

function _hideConnBanner(){
  const banner = document.getElementById('connBanner'); if(!banner) return;
  banner.classList.remove('visible');
}

function _startCountdown(seconds){
  clearInterval(_countdownTimer);
  const cd = document.getElementById('connBannerCountdown'); if(!cd) return;
  let remaining = seconds;
  cd.textContent = `retry in ${remaining}s`;
  _countdownTimer = setInterval(()=>{
    remaining--;
    if(remaining <= 0){ cd.textContent = 'retrying…'; clearInterval(_countdownTimer); _countdownTimer = null; }
    else { cd.textContent = `retry in ${remaining}s`; }
  }, 1000);
}

// ═══ MATPLOTLIB CALLS ════════════════════════════════════════════════════
async function convertToMpl(pid){
  const p = gp(pid); if(!p) return;
  // Allow rendering even with no template curves (list-only or empty)
  p.loading = true; p.converting = true; updateSpinner(pid);

  const curvesPayload = p.curves
    .filter(c => c.jsData && c.jsData.x && c.jsData.x.length)
    .map(c => ({
      x:            c.jsData.x,
      y:            c.jsData.y,
      is_discrete:  c.jsData.discrete || false,
      line_color:   c.line_color,
      line_width:   c.line_width,
      line_style:   c.line_style,
      line_connection: c.line_connection || 'linear',
      marker:       c.marker,
      marker_size:  c.marker_size,
      fill_under:   c.fill_under,
      fill_alpha:   c.fill_alpha,
      label:        c.name || (c.template ? (TEMPLATES[c.template]?.equation || c.template) : 'List curve'),
    }));

  try{
    const r = await fetch(`${API}/plot`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({curves:curvesPayload, view:{...p.view, bg_color:p.view.bg_color||'#12121c', surface_color:p.view.surface_color||'#12121c'}, labels:p.labels, text_annotations: p.textAnnotations||[]}),
    });
    const data = await r.json();
    if(data.error) throw new Error(data.error);
    p.mplImage = data.image; p.mplMode = true;
    setConn('ok', `Matplotlib: ${curvesPayload.map(c=>c.label).join(', ')}`);
  }catch(e){ setConn('err','Error: '+e.message); }
  finally{
    p.loading = false; p.converting = false;
    // Preserve scroll position — updateCardContent may shift layout
    const plotList = document.getElementById('plotList');
    const savedScroll = plotList ? plotList.scrollTop : 0;
    updateCardContent(pid); updateTopbar(pid); updateSpinner(pid);
    if(plotList) plotList.scrollTop = savedScroll;
  }
}

function revertToJS(pid){
  const p = gp(pid); if(!p) return;
  p.mplMode = false; p.mplImage = null;
  // Keep this plot active — set before any DOM changes
  activePid = pid;
  syncActiveHighlight();
  // Rebuild inner content (mpl→js) and topbar
  updateCardContent(pid);
  updateTopbar(pid);
  // Re-sync highlight after content replacement (DOM may have shifted)
  syncActiveHighlight();
  // renderJS will handle drawChart; refreshCfg/Sidebar after the chart settles
  if(p.curves.some(c=>c.template)){
    renderJS(pid, false);
  }
  // Defer panel refresh until after renderJS's internal setTimeout completes
  setTimeout(()=>{ refreshCfg(); refreshSidebar(); syncActiveHighlight(); }, 20);
}