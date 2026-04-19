const API = 'http://localhost:5001/api';

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
let tabs           = [];
let activeTabId    = null;
let activePid      = null;
let selTpl         = null;
let activeCurveIdx = 0;
let pid_ctr        = 0;
let curve_ctr      = 0;
let tab_ctr        = 0;
let plot_num_ctr   = 0;

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
      scope: v.scope ?? 'global',
      folder: v.folder ?? null,
    })),
    varIdCtr,
    tabs: tabs.map(t=>({ id:t.id, name:t.name })),
    activeTabId,
    tab_ctr,
    plot_num_ctr,
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

  // Restore tabs state (older snapshots without tabs fall back to a single default tab)
  if(Array.isArray(state.tabs) && state.tabs.length){
    tabs.length = 0;
    for(const t of state.tabs) tabs.push({ id:t.id, name:t.name });
    activeTabId = state.activeTabId ?? tabs[0].id;
    if(typeof state.tab_ctr === 'number')      tab_ctr      = state.tab_ctr;
    if(typeof state.plot_num_ctr === 'number') plot_num_ctr = state.plot_num_ctr;
  } else if(!tabs.length){
    const t = mkTab('Tab 1');
    tabs.push(t);
    activeTabId = t.id;
    for(const p of plots){ if(p.tabId == null) p.tabId = t.id; }
  }

  if(!plots.find(p=>p.id===activePid)) activePid = (plots.find(p=>p.tabId===activeTabId)?.id) ?? null;
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
    // Build the set of valid tab IDs after tab restore, so orphaned local vars
    // (whose tab was deleted) can be promoted to global.
    const validTabIds = new Set(tabs.map(t => t.id));
    variables.length = 0;
    for(const rv of restoredVars){
      const scope = rv.scope ?? 'global';
      // Sanitize: local vars whose tab no longer exists → promote to global
      const safeScope = (scope === 'global' || validTabIds.has(scope)) ? scope : 'global';
      variables.push({ ...rv, scope: safeScope, folder: rv.folder ?? null });
    }
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
function mkTabId(){ return ++tab_ctr; }

function mkTab(name){
  const id = mkTabId();
  const clean = (name||'').trim();
  return { id, name: clean || `Tab ${id}` };
}

function defView(){
  // Pull themed defaults (bg, grid, axes, labels) from the active plot theme.
  // Falls back to dark defaults if theme.js hasn't loaded yet.
  const t = typeof defViewThemeOverrides === 'function'
    ? defViewThemeOverrides()
    : { bg_color:'#12121c', surface_color:'#12121c', chart_theme:'dark',
        show_grid:true, grid_alpha:.5, grid_color:'#3c3c64',
        show_axis_lines:true, axis_alpha:1.0, axis_color:'#b4b4dc',
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

function mkPlot(tabId){
  return {
    id: mkPid(),
    tabId: tabId ?? activeTabId,
    plotNumber: ++plot_num_ctr,
    name: '',
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
  initStats();
  _showReconnectPopup(false);
  const connected = await tryConnect();
  plots = [];
  tabs = [];
  const firstTab = mkTab('Tab 1');
  tabs.push(firstTab);
  activeTabId = firstTab.id;
  const p = mkPlot(firstTab.id); plots.push(p);
  activePid = p.id; activeCurveIdx = 0;
  renderDOM();
  wireAllCfgInputs();
  initCfgPanel();
  snapshotForUndo(); // initial state
  if(!connected) startReconnectPoller(false);
  else startHeartbeat();

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
    _connected = true;
    setConn('ok');
    _hideReconnectPopup();
    return true;
  }catch(e){
    _connected = false;
    setConn('err');
    return false;
  }
}

let _connected = false;
let _reconnectTimer = null;
let _heartbeatTimer = null;

function _showReconnectPopup(isReconnecting){
  const popup = document.getElementById('reconnPopup'); if(!popup) return;
  document.getElementById('reconnPopupMsg').textContent = isReconnecting ? 'Reconnecting...' : 'Connecting...';
  popup.classList.add('visible');
}

function _hideReconnectPopup(){
  const popup = document.getElementById('reconnPopup'); if(!popup) return;
  popup.classList.remove('visible');
}

function startHeartbeat(){
  clearInterval(_heartbeatTimer);
  _heartbeatTimer = setInterval(async ()=>{
    try{
      const r = await fetch(`${API}/templates`, {signal: AbortSignal.timeout(3000)});
      if(!r.ok) throw new Error();
    }catch(e){
      if(_connected){
        _connected = false;
        setConn('err');
        clearInterval(_heartbeatTimer); _heartbeatTimer = null;
        startReconnectPoller(true);
      }
    }
  }, 5000);
}

function startReconnectPoller(isReconnecting){
  if(_reconnectTimer) return;
  _showReconnectPopup(isReconnecting);
  _reconnectTimer = setInterval(async ()=>{
    const ok = await tryConnect();
    if(ok){
      clearInterval(_reconnectTimer); _reconnectTimer = null;
      plots.forEach(p=>updateTopbar(p.id));
      buildModalNavAndGrid?.();
      startHeartbeat();
    }
  }, 3000);
}

function setConn(s){
  document.getElementById('cdot').className = 'cdot'+(s==='ok'?' ok':s==='err'?' err':'');
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
  }catch(e){ console.error('mpl render error:', e.message); }
  finally{
    p.loading = false; p.converting = false;
    // Preserve scroll position — updateCardContent may shift layout
    const plotList = document.getElementById('plotList');
    const savedScroll = plotList ? plotList.scrollTop : 0;
    updateCardContent(pid); updateTopbar(pid); updateSpinner(pid);
    if(plotList) plotList.scrollTop = savedScroll;
  }
}

async function savePlotPdf(pid){
  const p = gp(pid); if(!p) return;
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
  if(!curvesPayload.length){ alert('No curve data to export.'); return; }
  try{
    const r = await fetch(`${API}/plot/pdf`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({curves:curvesPayload, view:{...p.view, bg_color:p.view.bg_color||'#12121c', surface_color:p.view.surface_color||'#12121c'}, labels:p.labels, text_annotations:p.textAnnotations||[]}),
    });
    if(!r.ok) throw new Error(await r.text());
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    const title = (p.labels?.title || '').trim();
    const filename = title ? `${title.replace(/[^a-z0-9_\-]/gi,'_')}.pdf` : 'plot.pdf';
    const a = Object.assign(document.createElement('a'), {href:url, download:filename});
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }catch(e){ console.error('PDF save error:', e.message); }
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