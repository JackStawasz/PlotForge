const API = 'http://localhost:5000/api';

// ═══ DISPLAY CONSTANTS ═══════════════════════════════════════════════════
const CAT_META = {
  trig:    { label:'Trigonometric', dotClass:'trig'    },
  bell:    { label:'Bell Curves',   dotClass:'bell'    },
  lines:   { label:'Lines',         dotClass:'lines'   },
  general: { label:'General',       dotClass:'general' },
  other:   { label:'Other',         dotClass:'other'   },
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

// ═══ STATE FACTORIES ═════════════════════════════════════════════════════
function mkPid(){ return ++pid_ctr; }
function mkCid(){ return ++curve_ctr; }

function defView(){
  return {
    x_min:null, x_max:null, y_min:null, y_max:null,
    show_grid:true, grid_alpha:.5,
    show_axis_lines:true, axis_alpha:1.0,
    x_log:false, y_log:false,
    title_size:13, label_size:10, legend_size:9,
    show_legend:true,
    legend_x_frac: 0.98,
    legend_y_frac: 0.02,
  };
}

function pickCurveColor(existingCurves){
  const used = new Set(existingCurves.map(c => c.line_color));
  for(const color of CURVE_COLORS){
    if(!used.has(color)) return color;
  }
  // All colors taken — fall back to cycling
  return CURVE_COLORS[existingCurves.length % CURVE_COLORS.length];
}

function defCurve(existingCurves = []){
  return {
    id: mkCid(),
    template: null, params: {}, equation: '',
    jsData: null,
    line_color: pickCurveColor(existingCurves),
    line_width: 2,
    line_style: 'solid',
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
  return p.curves[activeCurveIdx] || p.curves[0] || null;
}

// ═══ BOOT ════════════════════════════════════════════════════════════════
async function boot(){
  try{
    const r = await fetch(`${API}/templates`);
    TEMPLATES = await r.json();
    buildCategories();
    setConn('ok','Backend connected');
  }catch(e){ setConn('err','Backend unreachable — run app.py'); }
  plots = [];
  const p = mkPlot(); plots.push(p);
  activePid = p.id; activeCurveIdx = 0;
  renderDOM();
  wireAllCfgInputs();
}

function setConn(s, _msg){
  document.getElementById('cdot').className = 'cdot'+(s==='ok'?' ok':s==='err'?' err':'');
}

// ═══ MATPLOTLIB CALLS ════════════════════════════════════════════════════
async function convertToMpl(pid){
  const p = gp(pid); if(!p||!p.curves.some(c=>c.template)) return;
  p.loading = true; p.converting = true; updateSpinner(pid);

  const curvesPayload = p.curves.filter(c=>c.template).map(c=>({
    template:    c.template,
    params:      c.params,
    line_color:  c.line_color,
    line_width:  c.line_width,
    line_style:  c.line_style,
    marker:      c.marker,
    marker_size: c.marker_size,
    fill_under:  c.fill_under,
    fill_alpha:  c.fill_alpha,
    label:       c.name || (TEMPLATES[c.template]?.label || c.template),
    mask_x_min:  c.mask_x_min,
    mask_x_max:  c.mask_x_max,
    mask_y_min:  c.mask_y_min,
    mask_y_max:  c.mask_y_max,
  }));

  try{
    const r = await fetch(`${API}/plot`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({curves:curvesPayload, view:p.view, labels:p.labels}),
    });
    const data = await r.json();
    if(data.error) throw new Error(data.error);
    p.mplImage = data.image; p.mplMode = true;
    setConn('ok', `Matplotlib: ${curvesPayload.map(c=>c.label).join(', ')}`);
  }catch(e){ setConn('err','Error: '+e.message); }
  finally{
    p.loading = false; p.converting = false;
    updateCardContent(pid); updateTopbar(pid); updateSpinner(pid);
  }
}

function revertToJS(pid){
  const p = gp(pid); if(!p) return;
  p.mplMode = false; p.mplImage = null;
  // Keep this plot active
  activePid = pid;
  // Rebuild inner content (mpl→js) and topbar
  updateCardContent(pid);
  updateTopbar(pid);
  syncActiveHighlight();
  // renderJS will handle drawChart; refreshCfg/Sidebar after the chart settles
  if(p.curves.some(c=>c.template)){
    renderJS(pid, false);
  }
  // Defer panel refresh until after renderJS's internal setTimeout completes
  setTimeout(()=>{ refreshCfg(); refreshSidebar(); }, 20);
}