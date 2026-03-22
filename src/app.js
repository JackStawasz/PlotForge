const API = 'http://localhost:5000/api';

// ═══ CATEGORY META ═══════════════════════════════════════════════════════
const CAT_META = {
  trig:   { label:'Trigonometric',    dotClass:'trig'   },
  bell:   { label:'Bell Curves',      dotClass:'bell'   },
  simple: { label:'Simple Functions', dotClass:'simple' },
};

// ═══ STATE ═══════════════════════════════════════════════════════════════
let TEMPLATES    = {};
let plots        = [];
let activePid    = null;
let selTpl       = null;
let renderTimers = {};
let pid_ctr      = 0;

const chartFirstRender = {};
const chartInstances   = {};
// per-plot interaction mode: 'move' | 'select'
const plotModes        = {};

function mkPid(){ return ++pid_ctr; }

function defView(){
  return {
    x_min:null, x_max:null, y_min:null, y_max:null,
    line_color:'#5affce', line_width:2, line_style:'solid',
    marker:'none', marker_size:4, fill_under:false,
    show_grid:true, title_size:13, label_size:10, fill_alpha:.15
  };
}

function mkPlot(){
  return {
    id:mkPid(), template:null, params:{}, view:defView(),
    labels:{title:'', xlabel:'', ylabel:''},
    jsData:null, mplImage:null, mode:'js', equation:'',
    loading:false, converting:false
  };
}

function gp(pid){ return plots.find(p => p.id === pid); }

// ═══ PURE-JS MATH ENGINE ═════════════════════════════════════════════════
// Compute x/y arrays entirely in the browser — no backend round-trip for
// pan / zoom / view config changes.

function evalTemplate(tkey, params, view){
  const tpl = TEMPLATES[tkey];
  if(!tpl) return null;
  const xd  = tpl.x_default;
  const p   = params;
  const N   = 600;

  const xLo = view.x_min != null ? view.x_min : xd[0];
  const xHi = view.x_max != null ? view.x_max : xd[1];

  function linspace(lo, hi, n){
    const a = [];
    for(let i=0;i<n;i++) a.push(lo + (hi-lo)*i/(n-1));
    return a;
  }

  let x, y, discrete = false;

  switch(tkey){
    case 'sin':{
      x = linspace(xLo,xHi,N);
      y = x.map(v => (p.A||1)*Math.sin((p.f||1)*v + (p.phi||0)));
      break;
    }
    case 'cos':{
      x = linspace(xLo,xHi,N);
      y = x.map(v => (p.A||1)*Math.cos((p.f||1)*v + (p.phi||0)));
      break;
    }
    case 'tan':{
      x = linspace(xLo,xHi,800);
      y = x.map(v => {
        const val = (p.A||1)*Math.tan((p.f||1)*v);
        return Math.abs(val) > 50 ? null : val;
      });
      break;
    }
    case 'sec':{
      x = linspace(xLo,xHi,800);
      y = x.map(v => {
        const c = Math.cos((p.f||1)*v);
        if(Math.abs(c) < 0.01) return null;
        const val = (p.A||1)/c;
        return Math.abs(val) > 20 ? null : val;
      });
      break;
    }
    case 'arcsin':{
      const lo2 = Math.max(-0.9999, xLo), hi2 = Math.min(0.9999, xHi);
      x = linspace(lo2,hi2,400);
      y = x.map(v => (p.A||1)*Math.asin(v));
      break;
    }
    case 'arctan':{
      x = linspace(xLo,xHi,N);
      y = x.map(v => (p.A||1)*Math.atan((p.f||1)*v));
      break;
    }
    case 'sinh':{
      x = linspace(xLo,xHi,N);
      y = x.map(v => (p.A||1)*Math.sinh((p.f||1)*v));
      break;
    }
    case 'cosh':{
      x = linspace(xLo,xHi,N);
      y = x.map(v => (p.A||1)*Math.cosh((p.f||1)*v));
      break;
    }
    case 'damped_sin':{
      const lo2 = Math.max(0, xLo);
      x = linspace(lo2,xHi,N);
      y = x.map(v => Math.exp(-(p.d||0.3)*v)*Math.sin((p.f||3)*v));
      break;
    }
    case 'gaussian':{
      x = linspace(xLo,xHi,N);
      const mu=p.mu||0, sig=Math.max(0.001,p.sig||1);
      y = x.map(v => (p.A||1)*Math.exp(-((v-mu)**2)/(2*sig**2)));
      break;
    }
    case 'lorentzian':{
      x = linspace(xLo,xHi,N);
      const g=Math.max(0.001,p.gamma||1), x0=p.x0||0;
      y = x.map(v => (p.A||1)*g**2/((v-x0)**2+g**2));
      break;
    }
    case 'binomial':{
      discrete = true;
      const n=Math.round(p.n||20), pk=Math.max(0.001,Math.min(0.999,p.p||0.5));
      x = []; y = [];
      for(let k=0;k<=n;k++){
        x.push(k);
        y.push(binomPMF(n,k,pk));
      }
      break;
    }
    case 'poisson':{
      discrete = true;
      const lam=Math.max(0.01,p.lam||4);
      const hi2 = Math.max(20, Math.ceil(lam*3));
      x = []; y = [];
      for(let k=0;k<=hi2;k++){
        x.push(k);
        y.push(poissonPMF(lam,k));
      }
      break;
    }
    case 'laplace':{
      x = linspace(xLo,xHi,N);
      const b=Math.max(0.001,p.b||1), mu2=p.mu||0;
      y = x.map(v => (p.A||1)/(2*b)*Math.exp(-Math.abs(v-mu2)/b));
      break;
    }
    case 'linear':{
      x = linspace(xLo,xHi,N);
      y = x.map(v => (p.m||1)*v + (p.b||0));
      break;
    }
    case 'poly_custom':{
      x = linspace(xLo,xHi,N);
      const deg=Math.round(p.degree||4);
      y = x.map(v => {
        let sum=0;
        for(let i=0;i<=deg;i++) sum += (p[`a${i}`]||0)*v**i;
        return sum;
      });
      break;
    }
    case 'logarithmic':{
      const lo2=Math.max(0.001,xLo);
      x = linspace(lo2,xHi,400);
      y = x.map(v => (p.a||1)*Math.log(v) + (p.b||0));
      break;
    }
    case 'exponential':{
      x = linspace(xLo,xHi,N);
      y = x.map(v => (p.a||1)*Math.exp((p.s||0.5)*v));
      break;
    }
    default: return null;
  }

  // Auto y range from computed data if not pinned
  const yVals = y.filter(v => v!=null && isFinite(v));
  const autoYMin = yVals.length ? Math.min(...yVals) : -1;
  const autoYMax = yVals.length ? Math.max(...yVals) :  1;

  return { x, y, discrete, equation: tpl.equation,
           autoXMin:xLo, autoXMax:xHi, autoYMin, autoYMax };
}

// Discrete distribution helpers
function binomPMF(n,k,p){
  return binomCoeff(n,k) * Math.pow(p,k) * Math.pow(1-p,n-k);
}
function binomCoeff(n,k){
  if(k>n) return 0;
  let c=1;
  for(let i=0;i<k;i++) c=c*(n-i)/(i+1);
  return c;
}
function poissonPMF(lam,k){
  // log-space to avoid overflow
  let logP = -lam + k*Math.log(lam) - logFactorial(k);
  return Math.exp(logP);
}
function logFactorial(n){
  let s=0;
  for(let i=2;i<=n;i++) s+=Math.log(i);
  return s;
}

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
  plotModes[p.id] = 'move';
  renderDOM();
  wireAllCfgInputs();
}

function setConn(s, msg){
  document.getElementById('cdot').className = 'cdot'+(s==='ok'?' ok':s==='err'?' err':'');
  document.getElementById('cmsg').textContent = msg;
}

// ═══ SIDEBAR REFRESH ═════════════════════════════════════════════════════
// Shows the correct template selected and params for the currently active plot.
// If no plot is active (or plot has no template), shows empty/placeholder state.
function refreshSidebar(){
  const noPlot=document.getElementById('sidebarNoPlot');
  const plotContent=document.getElementById('sidebarPlotContent');
  const p=activePid!==null?gp(activePid):null;

  if(!p){
    if(noPlot) noPlot.style.display='flex';
    if(plotContent) plotContent.style.display='none';
    return;
  }
  if(noPlot) noPlot.style.display='none';
  if(plotContent) plotContent.style.display='flex';

  // Highlight the correct template in the list
  const tkey=p.template||null;
  document.querySelectorAll('.tpl-item').forEach(b=>b.classList.toggle('sel',b.dataset.key===tkey));

  // Open the correct category accordion
  if(tkey){
    const cat=TEMPLATES[tkey]?.category;
    document.querySelectorAll('.cat-body').forEach(b=>b.classList.remove('open'));
    document.querySelectorAll('.cat-hdr').forEach(h=>h.classList.remove('open'));
    // Find and open the right category
    const catHdrs=document.querySelectorAll('.cat-hdr');
    catHdrs.forEach(hdr=>{
      const body=hdr.nextElementSibling;
      // Check if this category body contains the selected tpl
      const hasTpl=body?.querySelector(`[data-key="${tkey}"]`);
      if(hasTpl){ hdr.classList.add('open'); body.classList.add('open'); }
    });
    // Rebuild params for this plot's template with its current param values
    selTpl=tkey;
    buildParamsForTemplate(tkey, p.params);
  }else{
    selTpl=null;
    const pa=document.getElementById('paramsArea');
    if(pa) pa.innerHTML='<div style="font-size:.65rem;color:var(--muted);font-style:italic">Select a template.</div>';
  }
}
function buildCategories(){
  const container = document.getElementById('catBlocks');
  container.innerHTML = '';
  const grouped = {};
  for(const [key,tpl] of Object.entries(TEMPLATES)){
    if(!grouped[tpl.category]) grouped[tpl.category] = [];
    grouped[tpl.category].push({key,tpl});
  }
  for(const [cat, items] of Object.entries(grouped)){
    const meta = CAT_META[cat]||{label:cat,dotClass:''};
    const wrap = document.createElement('div');
    wrap.className='cat-wrap';

    const hdr = document.createElement('button');
    hdr.className='cat-hdr';
    hdr.innerHTML=`<div class="cat-dot ${meta.dotClass}"></div><span>${meta.label}</span><span class="cat-arrow">›</span>`;

    const body = document.createElement('div');
    body.className='cat-body';

    const list = document.createElement('div');
    list.className='tpl-list';
    items.forEach(({key,tpl}, idx) => {
      const isLast = idx === items.length - 1;
      const btn=document.createElement('button');
      btn.className='tpl-item'; btn.dataset.key=key;
      // Tree connector: ├ for all but last, └ for last
      const connector = isLast ? '└' : '├';
      btn.innerHTML=`<span class="tree-connector">${connector}</span><span class="tpl-label">${tpl.label}</span><span class="tpl-eq">${tpl.equation}</span>`;
      btn.addEventListener('click',()=>selectTemplate(key));
      list.appendChild(btn);
    });

    body.appendChild(list);

    hdr.addEventListener('click',()=>{
      const wasOpen=body.classList.contains('open');
      document.querySelectorAll('.cat-body').forEach(b=>b.classList.remove('open'));
      document.querySelectorAll('.cat-hdr').forEach(h=>h.classList.remove('open'));
      if(!wasOpen){body.classList.add('open');hdr.classList.add('open');}
    });

    wrap.appendChild(hdr);
    wrap.appendChild(body);
    container.appendChild(wrap);
  }
}

// ═══ SELECT TEMPLATE ═════════════════════════════════════════════════════
function selectTemplate(key){
  if(activePid!==null){
    const p=gp(activePid);
    if(p){
      const isNewTemplate = p.template !== key;
      p.template=key;
      selTpl=key;
      document.querySelectorAll('.tpl-item').forEach(b=>b.classList.toggle('sel',b.dataset.key===key));
      buildParamsForTemplate(key);
      // New template: reset view bounds and trigger rise animation
      if(isNewTemplate){
        p.view.x_min=null; p.view.x_max=null; p.view.y_min=null; p.view.y_max=null;
      }
      applyAndRender(activePid, isNewTemplate);
    }
  }
}

function buildParamsForTemplate(key, existingParams){
  const pa=document.getElementById('paramsArea');
  pa.innerHTML='';
  for(const [pk,pd] of Object.entries(TEMPLATES[key].params)){
    const row=document.createElement('div');
    row.className='p-row'; row.dataset.pkey=pk;
    const val = existingParams?.[pk] ?? pd.default;
    // Slider range: stored per-param in sliderRanges, default from template
    if(!sliderRanges[key]) sliderRanges[key]={};
    if(!sliderRanges[key][pk]) sliderRanges[key][pk]={min:pd.min, max:pd.max};
    const {min,max} = sliderRanges[key][pk];
    const fmt=v=>pd.step<1?parseFloat(v).toFixed(2):parseInt(v);
    row.innerHTML=`
      <div class="p-row-top">
        <span class="p-lbl">${pd.label}</span>
        <input class="p-val-inp" id="pv_${pk}" type="text" value="${fmt(val)}"
               data-pk="${pk}" data-step="${pd.step}"/>
      </div>
      <div class="p-slider-wrap">
        <input class="p-range-inp" type="text" value="${fmt(min)}" data-pk="${pk}" data-bound="min"
               title="Slider min"/>
        <input type="range" id="ps_${pk}" min="${min}" max="${max}" step="${pd.step}" value="${val}"
               oninput="onParamSlider('${pk}',this.value)"/>
        <input class="p-range-inp" type="text" value="${fmt(max)}" data-pk="${pk}" data-bound="max"
               title="Slider max"/>
      </div>`;
    pa.appendChild(row);

    // Wire value text input
    const valInp=row.querySelector(`#pv_${pk}`);
    valInp.addEventListener('change', ()=>commitParamValue(pk, valInp.value, pd.step));
    valInp.addEventListener('keydown', e=>{
      if(e.key==='Enter'){commitParamValue(pk, valInp.value, pd.step); valInp.blur();}
    });
    valInp.addEventListener('click', e=>e.stopPropagation());

    // Wire range bound inputs
    row.querySelectorAll('.p-range-inp').forEach(inp=>{
      inp.addEventListener('change', ()=>commitRangeBound(key, pk, inp.dataset.bound, inp.value, pd.step));
      inp.addEventListener('keydown', e=>{
        if(e.key==='Enter'){commitRangeBound(key, pk, inp.dataset.bound, inp.value, pd.step); inp.blur();}
      });
      inp.addEventListener('click', e=>e.stopPropagation());
    });
  }
  if(key==='poly_custom'){
    const deg=existingParams?.degree ?? TEMPLATES.poly_custom.params.degree.default;
    updatePolyCoeffVisibility(deg);
  }
}

// Per-template slider range overrides (survives template switches for same key)
const sliderRanges = {};

function commitParamValue(pk, raw, step){
  const val=parseFloat(raw);
  if(isNaN(val)) { syncParamInputFromSlider(pk); return; }
  const slider=document.getElementById(`ps_${pk}`);
  const valInp=document.getElementById(`pv_${pk}`);
  if(!slider) return;
  const fmt=v=>step<1?parseFloat(v).toFixed(2):parseInt(v);
  // Extend slider range if value is outside it
  if(val < parseFloat(slider.min)){
    slider.min=val;
    if(selTpl) { if(!sliderRanges[selTpl]) sliderRanges[selTpl]={}; if(!sliderRanges[selTpl][pk]) sliderRanges[selTpl][pk]={}; sliderRanges[selTpl][pk].min=val; }
    const minInp=slider.parentElement.querySelector('[data-bound="min"]');
    if(minInp) minInp.value=fmt(val);
  }
  if(val > parseFloat(slider.max)){
    slider.max=val;
    if(selTpl) { if(!sliderRanges[selTpl]) sliderRanges[selTpl]={}; if(!sliderRanges[selTpl][pk]) sliderRanges[selTpl][pk]={}; sliderRanges[selTpl][pk].max=val; }
    const maxInp=slider.parentElement.querySelector('[data-bound="max"]');
    if(maxInp) maxInp.value=fmt(val);
  }
  slider.value=val;
  if(valInp) valInp.value=fmt(val);
  if(selTpl==='poly_custom'&&pk==='degree') updatePolyCoeffVisibility(parseInt(val));
  if(activePid!==null) applyAndRender(activePid, false);
}

function commitRangeBound(key, pk, bound, raw, step){
  const val=parseFloat(raw);
  const slider=document.getElementById(`ps_${pk}`);
  const inp=slider?.parentElement?.querySelector(`[data-bound="${bound}"]`);
  if(isNaN(val)||!slider){ if(inp) inp.value=bound==='min'?slider?.min:slider?.max; return; }
  const fmt=v=>step<1?parseFloat(v).toFixed(2):parseInt(v);
  if(bound==='min') slider.min=val;
  else              slider.max=val;
  if(inp) inp.value=fmt(val);
  if(!sliderRanges[key]) sliderRanges[key]={};
  if(!sliderRanges[key][pk]) sliderRanges[key][pk]={};
  sliderRanges[key][pk][bound]=val;
  // Clamp current slider value
  const cur=parseFloat(slider.value);
  if(bound==='min'&&cur<val){ slider.value=val; const vi=document.getElementById(`pv_${pk}`); if(vi) vi.value=fmt(val); }
  if(bound==='max'&&cur>val){ slider.value=val; const vi=document.getElementById(`pv_${pk}`); if(vi) vi.value=fmt(val); }
}

function syncParamInputFromSlider(pk){
  // Reset text input to match slider
  const slider=document.getElementById(`ps_${pk}`);
  const valInp=document.getElementById(`pv_${pk}`);
  if(slider&&valInp){
    const step=parseFloat(slider.step)||0.1;
    valInp.value=step<1?parseFloat(slider.value).toFixed(2):parseInt(slider.value);
  }
}

function onParamSlider(pk, val){
  const tpl=selTpl?TEMPLATES[selTpl]:null;
  const step=tpl?.params[pk]?.step??0.1;
  const vi=document.getElementById(`pv_${pk}`);
  if(vi) vi.value=step<1?parseFloat(val).toFixed(2):parseInt(val);
  if(selTpl==='poly_custom'&&pk==='degree') updatePolyCoeffVisibility(parseInt(val));
  if(activePid!==null) applyAndRender(activePid, false);
}

function updatePolyCoeffVisibility(deg){
  document.getElementById('paramsArea').querySelectorAll('.p-row').forEach(row=>{
    const pk=row.dataset.pkey;
    if(!pk||pk==='degree') return;
    row.style.display=parseInt(pk.replace('a',''))<=deg?'':'none';
  });
}

function applyAndRender(pid, isNewTemplate=false){
  const p=gp(pid);
  if(!p||!selTpl) return;
  const params={};
  for(const pk of Object.keys(TEMPLATES[selTpl].params)){
    const el=document.getElementById(`ps_${pk}`);
    if(el) params[pk]=parseFloat(el.value);
  }
  p.template=selTpl;
  p.params=params;
  // Don't auto-set title — user edits it inline in the chart (placeholder shows template name)
  if(p.mode==='mpl') return;
  renderJS(pid, isNewTemplate);
}

// Core JS render — compute data, update chart, no network
function renderJS(pid, firstRender=false){
  const p=gp(pid);
  if(!p||!p.template) return;

  const result=evalTemplate(p.template, p.params, p.view);
  if(!result) return;

  p.jsData={x:result.x, y:result.y, discrete:result.discrete};
  p.equation=result.equation;

  // Pin view bounds on new template only; preserve on param updates
  if(firstRender || p.view.x_min==null){
    p.view.x_min = result.autoXMin;
    p.view.x_max = result.autoXMax;
    const yPad = (result.autoYMax - result.autoYMin) * 0.08 || 0.1;
    p.view.y_min = result.autoYMin - yPad;
    p.view.y_max = result.autoYMax + yPad;
    if(firstRender) chartFirstRender[pid]=true; // animation only for new template
  }

  setConn('ok',`${TEMPLATES[p.template].label} · ${result.x.length} pts`);

  const innerEl=document.getElementById(`cinner_${pid}`);
  if(!innerEl) return;

  if(!document.getElementById(`chart_${pid}`)){
    innerEl.innerHTML=buildInnerHTML(p);
    setTimeout(()=>{
      drawChart(p);
      wireInteraction(p);
      wireAxisLabelInputs(p);
      syncCfgDomain();
      updateTopbar(pid); // refresh mpl button enabled state
    },0);
    return;
  }

  drawChart(p);
  syncCfgDomain();
}

// ═══ CONVERT TO MATPLOTLIB ═══════════════════════════════════════════════
async function convertToMpl(pid){
  const p=gp(pid);
  if(!p||!p.template) return;
  p.converting=true; p.loading=true;
  updateSpinner(pid);

  try{
    const r=await fetch(`${API}/plot`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({template:p.template,params:p.params,view:p.view,labels:p.labels}),
    });
    const data=await r.json();
    if(data.error) throw new Error(data.error);
    p.mplImage=data.image; p.mode='mpl'; p.equation=data.equation;
    setConn('ok',`Matplotlib: ${TEMPLATES[p.template].label}`);
  }catch(e){
    setConn('err','Error: '+e.message);
  }finally{
    p.loading=false; p.converting=false;
    updateCardContent(pid);
    updateSpinner(pid);
    updateTopbar(pid);
  }
}

function revertToJS(pid){
  const p=gp(pid);
  if(!p) return;
  p.mode='js'; p.mplImage=null;
  updateCardContent(pid);
  updateTopbar(pid);
  if(p.template) renderJS(pid, false);
}

// ═══ CONTENT HTML BUILDER ════════════════════════════════════════════════
function buildInnerHTML(p){
  const pid=p.id;
  if(!p.template||(!p.jsData&&!p.mplImage)){
    return `<div class="plot-empty"><div class="ei">⊹</div><span>Insert Plot</span></div>`;
  }
  if(p.mode==='mpl'&&p.mplImage){
    return `<div class="mpl-body"><img class="mpl-img" src="data:image/png;base64,${p.mplImage}" alt="plot"/></div>`;
  }
  const titleVal = p.labels.title||'';
  const xlabelVal = p.labels.xlabel||'';
  const ylabelVal = p.labels.ylabel||'';
  return `
    <div class="chart-region" id="cregion_${pid}">
      <input class="chart-title-inp" id="ctitleinp_${pid}" type="text"
             value="${titleVal}" placeholder="Insert title"
             style="font-size:${p.view.title_size||13}px"/>
      <div class="canvas-wrap" id="cwrap_${pid}">
        <canvas id="chart_${pid}" style="display:block;width:100%"></canvas>
        <div class="cursor-coords" id="coords_${pid}">x=— y=—</div>
      </div>
      <div class="ax-xlabel">
        <input class="lbl-inp" id="xlabel_${pid}" type="text"
               value="${xlabelVal}" placeholder="Insert x-label"
               style="font-size:${p.view.label_size||10}px"/>
      </div>
      <div class="ax-ylabel">
        <input class="lbl-inp" id="ylabel_${pid}" type="text"
               value="${ylabelVal}" placeholder="Insert y-label"
               style="font-size:${p.view.label_size||10}px"/>
      </div>
    </div>`;
}

// ═══ SELECTIVE DOM UPDATE ════════════════════════════════════════════════
function updateCardContent(pid){
  const p=gp(pid);
  if(!p) return;
  const innerEl=document.getElementById(`cinner_${pid}`);
  if(!innerEl) return;
  destroyChart(pid);
  innerEl.innerHTML=buildInnerHTML(p);
  if(p.mode==='js'&&p.jsData){
    setTimeout(()=>{ drawChart(p); wireInteraction(p); wireAxisLabelInputs(p); },0);
  }
}

function updateTopbar(pid){
  const p=gp(pid);
  if(!p) return;
  const topEl=document.getElementById(`ctop_${pid}`);
  if(!topEl) return;
  topEl.innerHTML=buildTopbarInner(p, plots.findIndex(q=>q.id===pid));
  wireTopbarTitle(p);
}

function updateSpinner(pid){
  const p=gp(pid); if(!p) return;
  const sp=document.getElementById(`spin_${pid}`);
  const sh=document.getElementById(`shim_${pid}`);
  if(sp){
    sp.classList.toggle('show',p.loading);
    if(p.loading) sp.querySelector('.spin-lbl').textContent=p.converting?'converting to matplotlib…':'rendering…';
  }
  if(sh) sh.classList.toggle('show',p.converting);
}

// ═══ FULL DOM RENDER ═════════════════════════════════════════════════════
function renderDOM(){
  for(const p of plots) destroyChart(p.id);
  const list=document.getElementById('plotList');
  list.innerHTML='';
  plots.forEach((p,i)=>list.appendChild(buildCard(p,i)));

  const ghost=document.createElement('div');
  ghost.className='add-card';
  ghost.innerHTML=`<div class="add-plus">+</div><span>Add new plot</span>`;
  ghost.addEventListener('click',()=>{
    const np=mkPlot(); plots.push(np);
    plotModes[np.id]='move';
    activePid=np.id;
    renderDOM(); refreshCfg(); refreshSidebar();
  });
  list.appendChild(ghost);

  // Click on empty space in the plot list to deselect
  list.addEventListener('click',(e)=>{
    // Deselect if click lands directly on list or add-card or empty padding
    const onCard = e.target.closest('.plot-card');
    const onGhost = e.target.closest('.add-card');
    if(!onCard && !onGhost){
      activePid=null;
      syncActiveHighlight();
      refreshCfg();
      refreshSidebar();
    }
  });

  refreshCfg();
  refreshSidebar();
  setTimeout(()=>{
    for(const p of plots){
      if(p.mode==='js'&&p.jsData){ drawChart(p); wireInteraction(p); wireAxisLabelInputs(p); }
    }
  },0);
}

function buildCard(p, i){
  const card=document.createElement('div');
  card.className='plot-card'+(p.id===activePid?' active':'');
  card.dataset.pid=p.id;
  card.innerHTML=`
    <div class="ctop" id="ctop_${p.id}">
      ${buildTopbarInner(p,i)}
    </div>
    <div class="cbody" id="cbody_${p.id}">
      <div id="cinner_${p.id}">${buildInnerHTML(p)}</div>
      <div class="spin-overlay${p.loading?' show':''}" id="spin_${p.id}">
        <div class="spinner"></div>
        <div class="spin-lbl">${p.converting?'converting to matplotlib…':'rendering…'}</div>
      </div>
      <div class="shimmer-overlay${p.converting?' show':''}" id="shim_${p.id}"></div>
    </div>`;
  card.addEventListener('click',(e)=>{
    const btn=e.target.closest('[data-action]');
    if(btn){handleAction(btn.dataset.action,parseInt(btn.dataset.pid));return;}
    if(e.target.closest('.lbl-inp')||e.target.closest('.ctitle')) return;
    if(activePid!==p.id){activePid=p.id;syncActiveHighlight();refreshCfg();refreshSidebar();}
  });
  setTimeout(()=>wireTopbarTitle(p),0);
  return card;
}

function buildTopbarInner(p, i){
  const tplName=p.template?TEMPLATES[p.template]?.label||p.template:'—';

  const canMpl = !!p.template;
  const mplBtn = p.mode==='js'
    ? `<button class="cbtn mpl-btn${!canMpl?' mpl-disabled':''}" data-pid="${p.id}" data-action="mpl"
              ${!canMpl?'disabled':''}>▨ matplotlib</button>`
    : `<button class="cbtn revert-btn" data-pid="${p.id}" data-action="revert">⟲ interactive</button>`;

  return `
    <span class="cnum">PLOT ${String(i+1).padStart(2,'0')}</span>
    <span class="ctitle readonly" id="ctitle_${p.id}">${tplName}</span>
    <div class="cactions">
      ${mplBtn}
      <button class="cbtn" data-pid="${p.id}" data-action="del">✕</button>
    </div>`;
}

// Title is now edited inline inside the chart — topbar is read-only
function wireTopbarTitle(p){ /* no-op */ }

// ═══ AXIS LABEL INPUTS ═══════════════════════════════════════════════════
function wireAxisLabelInputs(p){
  const xi=document.getElementById(`xlabel_${p.id}`);
  const yi=document.getElementById(`ylabel_${p.id}`);
  const ti=document.getElementById(`ctitleinp_${p.id}`);
  if(xi){
    xi.addEventListener('change',()=>{p.labels.xlabel=xi.value;});
    xi.addEventListener('input', ()=>{p.labels.xlabel=xi.value;});
    xi.addEventListener('click', e=>e.stopPropagation());
  }
  if(yi){
    yi.addEventListener('change',()=>{p.labels.ylabel=yi.value;});
    yi.addEventListener('input', ()=>{p.labels.ylabel=yi.value;});
    yi.addEventListener('click', e=>e.stopPropagation());
  }
  if(ti){
    ti.addEventListener('change',()=>{p.labels.title=ti.value;});
    ti.addEventListener('input', ()=>{p.labels.title=ti.value;});
    ti.addEventListener('click', e=>e.stopPropagation());
    ti.addEventListener('keydown',e=>{if(e.key==='Enter') ti.blur();});
  }
}

// Apply font size updates to live label inputs without full rebuild
function applyLabelFontSizes(pid){
  const p=gp(pid); if(!p) return;
  const v=p.view;
  const ti=document.getElementById(`ctitleinp_${pid}`);
  const xi=document.getElementById(`xlabel_${pid}`);
  const yi=document.getElementById(`ylabel_${pid}`);
  if(ti) ti.style.fontSize=(v.title_size||13)+'px';
  if(xi) xi.style.fontSize=(v.label_size||10)+'px';
  if(yi) yi.style.fontSize=(v.label_size||10)+'px';
}

// ═══ ACTIVE HIGHLIGHT ════════════════════════════════════════════════════
function syncActiveHighlight(){
  document.querySelectorAll('.plot-card').forEach(c=>{
    c.classList.toggle('active',parseInt(c.dataset.pid)===activePid);
  });
}

// ═══ CHART.JS ════════════════════════════════════════════════════════════
function destroyChart(pid){
  if(chartInstances[pid]){chartInstances[pid].destroy();delete chartInstances[pid];}
}

function drawChart(p){
  const canvas=document.getElementById(`chart_${p.id}`);
  if(!canvas||!p.jsData) return;

  const shouldAnimate=!!chartFirstRender[p.id];
  if(shouldAnimate) delete chartFirstRender[p.id];

  const v=p.view, lc=v.line_color||'#5affce', data=p.jsData;

  // Update in-place if chart exists and no first-render animation needed
  if(chartInstances[p.id]&&!shouldAnimate){
    const ch=chartInstances[p.id];
    if(data.discrete){
      ch.data.labels=data.x.map(n=>n);
      ch.data.datasets[0].data=data.y;
    }else{
      ch.data.datasets[0].data=data.x.map((xv,i)=>({x:xv, y:data.y[i]}));
    }
    ch.data.datasets[0].borderColor     =lc;
    ch.data.datasets[0].borderWidth     =v.line_width||2;
    ch.data.datasets[0].fill            =v.fill_under;
    ch.data.datasets[0].backgroundColor =hexAlpha(lc,v.fill_alpha||.15);
    ch.data.datasets[0].borderDash      =dashFor(v.line_style);
    ch.data.datasets[0].pointRadius     =v.marker!=='none'?v.marker_size||4:0;
    if(ch.options.scales.x.grid) ch.options.scales.x.grid.display=v.show_grid;
    if(ch.options.scales.y.grid) ch.options.scales.y.grid.display=v.show_grid;
    // Refresh 1-2-5 tick callbacks (span may have changed)
    ch.options.scales.x.ticks.callback=makeTickCb('x');
    ch.options.scales.y.ticks.callback=makeTickCb('y');
    applyScaleLimits(ch.options.scales,v);
    ch.update('none');
    return;
  }

  destroyChart(p.id);
  const ctx=canvas.getContext('2d');
  const scales=buildScales(v);
  const animOpts=shouldAnimate?{duration:500,easing:'easeOutQuart'}:{duration:0};

  if(data.discrete){
    // Discrete (bar): use category x labels as before
    chartInstances[p.id]=new Chart(ctx,{
      type:'bar',
      data:{
        labels:data.x.map(n=>n),
        datasets:[{data:data.y,backgroundColor:hexAlpha(lc,.7),borderColor:lc,borderWidth:1}]
      },
      options:{responsive:true,maintainAspectRatio:true,animation:animOpts,
        plugins:{legend:{display:false},tooltip:tooltipOpts()},scales}
    });
  }else{
    // Continuous: use {x,y} point objects with a proper linear x-axis
    // so panning into negative x works correctly
    const xyData = data.x.map((xv,i)=>({x:xv, y:data.y[i]}));
    // Override x scale to linear (not category)
    scales.x.type = 'linear';
    chartInstances[p.id]=new Chart(ctx,{
      type:'line',
      data:{
        datasets:[{
          data:xyData, borderColor:lc, borderWidth:v.line_width||2,
          borderDash:dashFor(v.line_style),
          pointRadius:v.marker!=='none'?v.marker_size||4:0,
          pointBackgroundColor:lc,
          fill:v.fill_under, backgroundColor:hexAlpha(lc,v.fill_alpha||.15),
          tension:0.35, spanGaps:true,
          parsing:false,
        }]
      },
      options:{responsive:true,maintainAspectRatio:true,animation:animOpts,
        plugins:{legend:{display:false},tooltip:{
          ...tooltipOpts(),
          callbacks:{
            title:items=>`x = ${Number(items[0].parsed.x).toFixed(4)}`,
            label:item =>`y = ${Number(item.parsed.y)?.toFixed(5)??'—'}`,
          }
        }},scales}
    });
  }
}

function dashFor(ls){return ls==='dashed'?[6,3]:ls==='dotted'?[2,3]:ls==='dashdot'?[6,3,2,3]:[];}

// ── 1-2-5 tick step calculator ─────────────────────────────────────────────
// Given a data span and desired number of ticks, returns a "nice" step that
// is always of the form 1×10^n, 2×10^n, or 5×10^n.
function niceStep(span, targetTicks){
  if(!span||span<=0||!isFinite(span)) return 1;
  const rough=span/targetTicks;
  const mag=Math.pow(10, Math.floor(Math.log10(rough)));
  const norm=rough/mag; // normalised: 1–10
  let nice;
  if(norm < 1.5)      nice=1;
  else if(norm < 3.5) nice=2;
  else if(norm < 7.5) nice=5;
  else                nice=10;
  return nice*mag;
}

// Build a Chart.js ticks callback that only marks multiples of the nice step
function makeTickCb(axisKey){
  return function(val, idx, ticks){
    const span=this.max-this.min;
    const target=axisKey==='x'?8:6;
    const step=niceStep(span,target);
    // Only show labels that are exact multiples of the step (within floating-point tolerance)
    const remainder=Math.abs(val % step);
    const tol=step*1e-6;
    if(remainder>tol && (step-remainder)>tol) return null;
    // Format nicely: avoid trailing zeros for round numbers
    const decimals=step>=1?0:Math.max(0,Math.ceil(-Math.log10(step))+1);
    return parseFloat(val.toFixed(decimals+2)).toFixed(decimals);
  };
}

function buildScales(v){
  const s={
    x:{
      ticks:{
        color:'#b0b0e0',
        font:{family:"'IBM Plex Mono'",size:10},
        maxTicksLimit:12,
        callback: makeTickCb('x'),
      },
      grid:{color:'rgba(60,60,100,.7)',display:v.show_grid}
    },
    y:{
      ticks:{
        color:'#b0b0e0',
        font:{family:"'IBM Plex Mono'",size:10},
        maxTicksLimit:10,
        callback: makeTickCb('y'),
      },
      grid:{color:'rgba(60,60,100,.7)',display:v.show_grid}
    },
  };
  applyScaleLimits(s,v);
  return s;
}
function applyScaleLimits(scales,v){
  if(v.x_min!=null)scales.x.min=v.x_min; else delete scales.x.min;
  if(v.x_max!=null)scales.x.max=v.x_max; else delete scales.x.max;
  if(v.y_min!=null)scales.y.min=v.y_min; else delete scales.y.min;
  if(v.y_max!=null)scales.y.max=v.y_max; else delete scales.y.max;
}
function tooltipOpts(){
  return{
    backgroundColor:'#0c0c18',borderColor:'#252540',borderWidth:1,
    titleColor:'#d4ff5a',bodyColor:'#d0d0ee',
    titleFont:{family:"'IBM Plex Mono'",size:10},
    bodyFont:{family:"'IBM Plex Mono'",size:10},
    callbacks:{
      title:items=>`x = ${items[0].label}`,
      label:item =>`y = ${Number(item.raw)?.toFixed(5)??'—'}`,
    }
  };
}
function hexAlpha(hex,a){
  if(!hex||hex.length<7) return `rgba(90,255,206,${a})`;
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ═══ HELPER: pixel → data coords ═════════════════════════════════════════
// Chart.js scales (sx.left, sx.right, etc.) are in CSS pixel space
// relative to the canvas element. getBoundingClientRect gives us the
// canvas position in viewport space. We combine them correctly here.
function pixelToData(ch, clientX, clientY){
  const canvas=ch.canvas;
  const rect=canvas.getBoundingClientRect();
  // Scale factor: canvas CSS size vs its natural pixel size
  const scaleX=rect.width/canvas.width;
  const scaleY=rect.height/canvas.height;
  // Mouse position relative to canvas in natural (chart) pixels
  const px=(clientX-rect.left)/scaleX;
  const py=(clientY-rect.top)/scaleY;
  const sx=ch.scales.x, sy=ch.scales.y;
  const fx=(px-sx.left)/(sx.right-sx.left);
  const fy=(py-sy.top)/(sy.bottom-sy.top);
  const dataX=sx.min+(sx.max-sx.min)*fx;
  const dataY=sy.max-(sy.max-sy.min)*fy;
  // Also return CSS-space px/py for selection rect positioning
  const cssPx=clientX-rect.left;
  const cssPy=clientY-rect.top;
  return {dataX,dataY,px:cssPx,py:cssPy};
}

// ═══ INTERACTIONS (pan, zoom, cursor) ════════════════════════════════════
function wireInteraction(p){
  const wrap=document.getElementById(`cwrap_${p.id}`);
  if(!wrap) return;

  // ── cursor coordinates ──
  wrap.addEventListener('mousemove',(e)=>{
    const ch=chartInstances[p.id]; if(!ch) return;
    const {dataX,dataY}=pixelToData(ch,e.clientX,e.clientY);
    const coordEl=document.getElementById(`coords_${p.id}`);
    if(coordEl) coordEl.textContent=`x=${dataX.toFixed(3)}  y=${dataY.toFixed(3)}`;
    if(panState[p.id]?.dragging) onPanMove(e,p);
  });
  wrap.addEventListener('mouseleave',()=>{
    const coordEl=document.getElementById(`coords_${p.id}`);
    if(coordEl) coordEl.textContent='x=—  y=—';
  });

  // ── scroll to zoom ──
  wrap.addEventListener('wheel',(e)=>{
    e.preventDefault();
    const ch=chartInstances[p.id]; if(!ch) return;
    const {dataX,dataY}=pixelToData(ch,e.clientX,e.clientY);
    const factor=e.deltaY>0?1.15:1/1.15;

    const xMin=p.view.x_min, xMax=p.view.x_max;
    const yMin=p.view.y_min, yMax=p.view.y_max;

    const newXMin=dataX+(xMin-dataX)*factor;
    const newXMax=dataX+(xMax-dataX)*factor;
    const xSpanOld=xMax-xMin, xSpanNew=newXMax-newXMin;
    const ySpanOld=yMax-yMin;
    const ySpanNew=ySpanOld*(xSpanNew/xSpanOld);
    const newYMin=dataY+(yMin-dataY)*(ySpanNew/ySpanOld);
    const newYMax=dataY+(yMax-dataY)*(ySpanNew/ySpanOld);

    p.view.x_min=newXMin; p.view.x_max=newXMax;
    p.view.y_min=newYMin; p.view.y_max=newYMax;

    applyScaleLimits(ch.options.scales,p.view);
    ch.update('none');
    syncCfgDomain();
    renderJS(p.id,false);
  },{passive:false});

  // ── mousedown: always pan ──
  wrap.addEventListener('mousedown',(e)=>{
    if(e.button!==0) return;
    startPan(e,p);
  });

  window.addEventListener('mouseup',()=>endPan(p));
}

// ─── PAN ─────────────────────────────────────────────────────────────────
const panState={};

function startPan(e,p){
  const wrap=document.getElementById(`cwrap_${p.id}`);
  panState[p.id]={dragging:true,startX:e.clientX,startY:e.clientY};
  if(wrap) wrap.classList.add('panning');
  e.preventDefault();
}

function onPanMove(e,p){
  const st=panState[p.id]; if(!st||!st.dragging) return;
  const ch=chartInstances[p.id]; if(!ch) return;
  const canvas=ch.canvas;
  const rect=canvas.getBoundingClientRect();
  const scaleX=rect.width/canvas.width;
  const scaleY=rect.height/canvas.height;
  const dx=(e.clientX-st.startX)/scaleX;
  const dy=(e.clientY-st.startY)/scaleY;
  st.startX=e.clientX; st.startY=e.clientY;

  const sx=ch.scales.x, sy=ch.scales.y;
  const xPx=sx.right-sx.left, yPx=sy.bottom-sy.top;
  if(xPx===0||yPx===0) return;

  // Use p.view as source of truth for span
  const xSpan=p.view.x_max-p.view.x_min;
  const ySpan=p.view.y_max-p.view.y_min;

  const dxData=(dx/xPx)*xSpan;
  const dyData=(dy/yPx)*ySpan;

  p.view.x_min-=dxData; p.view.x_max-=dxData;
  p.view.y_min+=dyData; p.view.y_max+=dyData;

  applyScaleLimits(ch.options.scales,p.view);
  ch.update('none');
  syncCfgDomain();
  renderJS(p.id,false);
}

function endPan(p){
  if(!panState[p.id]?.dragging) return;
  panState[p.id].dragging=false;
  const wrap=document.getElementById(`cwrap_${p.id}`);
  if(wrap) wrap.classList.remove('panning');
}

// ═══ ACTIONS ═════════════════════════════════════════════════════════════
function handleAction(action,pid){
  if(action==='del'){
    destroyChart(pid);
    plots=plots.filter(p=>p.id!==pid);
    if(activePid===pid) activePid=plots[0]?.id||null;
    if(plots.length===0){const np=mkPlot();plots.push(np);activePid=np.id;}
    renderDOM(); return;
  }
  if(action==='mpl')    {convertToMpl(pid); return;}
  if(action==='revert') {revertToJS(pid);   return;}
}

// ═══ CFG PANEL ═══════════════════════════════════════════════════════════

// Format a domain value for display: up to 4 sig figs, no trailing zeros
function fmtDomain(v){
  if(v==null||!isFinite(v)) return '';
  // Use toPrecision(5) then strip trailing zeros
  return parseFloat(v.toPrecision(5)).toString();
}

// Get the current effective axis limits — p.view is always the source of truth
// (we pin it on first render and on every pan/zoom).
function getEffectiveDomain(pid){
  const p=gp(pid); if(!p) return {xMin:0,xMax:1,yMin:0,yMax:1};
  const v=p.view;
  if(v.x_min!=null && v.x_max!=null && v.y_min!=null && v.y_max!=null){
    return {xMin:v.x_min, xMax:v.x_max, yMin:v.y_min, yMax:v.y_max};
  }
  // Pre-render fallback: compute from template defaults
  if(p.template){
    const res=evalTemplate(p.template, p.params, {});
    if(res){
      const yPad=(res.autoYMax-res.autoYMin)*0.08||0.1;
      return {xMin:res.autoXMin,xMax:res.autoXMax,
              yMin:res.autoYMin-yPad, yMax:res.autoYMax+yPad};
    }
  }
  return {xMin:0,xMax:1,yMin:0,yMax:1};
}

function refreshCfg(){
  const empty=document.getElementById('cfgEmpty');
  const content=document.getElementById('cfgContent');
  const p=activePid!==null?gp(activePid):null;
  if(!p){empty.style.display='flex';content.style.display='none';return;}
  empty.style.display='none'; content.style.display='flex';
  const v=p.view;
  // Always show real current domain values
  syncCfgDomain();
  document.getElementById('c_lc').value=v.line_color;
  document.getElementById('c_lchex').value=v.line_color;
  sv('c_lw',v.line_width);
  document.getElementById('c_lw_val').textContent=parseFloat(v.line_width).toFixed(1);
  sv('c_ls',v.line_style);
  sv('c_mk',v.marker);
  document.getElementById('c_fill').checked=v.fill_under;
  document.getElementById('c_grid').checked=v.show_grid;
  sv('c_ts',v.title_size); sv('c_ls2',v.label_size);
}

function sv(id,val){const el=document.getElementById(id);if(el)el.value=val;}
function pf(id){return parseFloat(document.getElementById(id)?.value);}

function readCfgIntoActive(){
  const p=activePid!==null?gp(activePid):null;
  if(!p) return;
  const v=p.view;
  // Domain is handled separately via commitDomain — skip x/y here
  v.line_color =document.getElementById('c_lc').value;
  v.line_width =parseFloat(document.getElementById('c_lw').value);
  v.line_style =document.getElementById('c_ls').value;
  v.marker     =document.getElementById('c_mk').value;
  v.fill_under =document.getElementById('c_fill').checked;
  v.show_grid  =document.getElementById('c_grid').checked;
  v.title_size =parseInt(document.getElementById('c_ts').value)||13;
  v.label_size =parseInt(document.getElementById('c_ls2').value)||10;
}

// Commit a domain input: apply value or reset to current if empty/invalid
function commitDomainInput(id, axis, minMax){
  const p=activePid!==null?gp(activePid):null; if(!p) return;
  const el=document.getElementById(id); if(!el) return;
  const raw=el.value.trim();
  if(raw===''){
    // Reset to current effective value
    const dom=getEffectiveDomain(activePid);
    const cur=axis==='x'?(minMax==='min'?dom.xMin:dom.xMax):(minMax==='min'?dom.yMin:dom.yMax);
    el.value=fmtDomain(cur);
    // Clear the pinned view value so chart is free
    p.view[axis+'_'+minMax]=null;
    if(p.template) renderJS(activePid,false);
    return;
  }
  const val=parseFloat(raw);
  if(isNaN(val)){
    // Invalid — reset
    const dom=getEffectiveDomain(activePid);
    const cur=axis==='x'?(minMax==='min'?dom.xMin:dom.xMax):(minMax==='min'?dom.yMin:dom.yMax);
    el.value=fmtDomain(cur);
    return;
  }
  p.view[axis+'_'+minMax]=val;
  el.value=fmtDomain(val);
  if(p.template){
    if(p.mode==='js') renderJS(activePid,false);
    else{ clearTimeout(window._cfgDebounce); window._cfgDebounce=setTimeout(()=>convertToMpl(activePid),400); }
  }
}

function triggerCfgRender(){
  if(activePid===null) return;
  readCfgIntoActive();
  const p=gp(activePid);
  if(!p||!p.template) return;
  // Always update label font sizes in JS mode (instant, no redraw needed)
  applyLabelFontSizes(activePid);
  if(p.mode==='js') renderJS(activePid, false);
  else{
    clearTimeout(window._cfgDebounce);
    window._cfgDebounce=setTimeout(()=>convertToMpl(activePid),400);
  }
}

function syncCfgDomain(){
  if(activePid===null) return;
  const p=gp(activePid); if(!p) return;
  const dom=getEffectiveDomain(activePid);
  // Don't clobber an input the user is actively typing in
  const focused=document.activeElement?.id;
  const set=(id,val)=>{
    const el=document.getElementById(id);
    if(el && el.id!==focused) el.value=fmtDomain(val);
  };
  set('c_xn',dom.xMin);
  set('c_xx',dom.xMax);
  set('c_yn',dom.yMin);
  set('c_yx',dom.yMax);
}

function wireAllCfgInputs(){
  // Domain inputs: commit only on Enter or blur
  const domainMap=[
    {id:'c_xn',axis:'x',mm:'min'},{id:'c_xx',axis:'x',mm:'max'},
    {id:'c_yn',axis:'y',mm:'min'},{id:'c_yx',axis:'y',mm:'max'},
  ];
  for(const {id,axis,mm} of domainMap){
    const el=document.getElementById(id);
    if(!el) continue;
    el.addEventListener('keydown',(e)=>{
      if(e.key==='Enter'){ e.preventDefault(); commitDomainInput(id,axis,mm); el.blur(); }
      if(e.key==='Escape'){ syncCfgDomain(); el.blur(); }
    });
    el.addEventListener('blur',()=>commitDomainInput(id,axis,mm));
  }

  // Non-domain inputs: immediate
  const ids=['c_lw','c_ls','c_mk','c_ts','c_ls2'];
  for(const id of ids){
    const el=document.getElementById(id);
    if(el) el.addEventListener('input', triggerCfgRender);
    if(el) el.addEventListener('change',triggerCfgRender);
  }
  document.getElementById('c_lc').addEventListener('input',function(){
    document.getElementById('c_lchex').value=this.value;
    triggerCfgRender();
  });
  document.getElementById('c_lchex').addEventListener('input',function(){
    if(/^#[0-9a-fA-F]{6}$/.test(this.value)){
      document.getElementById('c_lc').value=this.value;
      triggerCfgRender();
    }
  });
  document.getElementById('c_lw').addEventListener('input',function(){
    document.getElementById('c_lw_val').textContent=parseFloat(this.value).toFixed(1);
  });
  document.getElementById('c_fill').addEventListener('change',triggerCfgRender);
  document.getElementById('c_grid').addEventListener('change',triggerCfgRender);
}

// ═══ KICK OFF ════════════════════════════════════════════════════════════
boot();