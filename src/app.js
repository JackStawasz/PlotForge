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
    labels:{title:'', xlabel:'x', ylabel:'y'},
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

// ═══ CATEGORIES ══════════════════════════════════════════════════════════
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
    wrap.style.marginBottom='4px';
    const hdr = document.createElement('button');
    hdr.className='cat-hdr';
    hdr.innerHTML=`<div class="cat-dot ${meta.dotClass}"></div><span>${meta.label}</span><span class="cat-arrow">›</span>`;
    const body = document.createElement('div');
    body.className='cat-body';
    const list = document.createElement('div');
    list.className='tpl-list';
    for(const {key,tpl} of items){
      const btn=document.createElement('button');
      btn.className='tpl-item'; btn.dataset.key=key;
      btn.innerHTML=`<span>${tpl.label}</span><span class="tpl-eq">${tpl.equation}</span>`;
      btn.addEventListener('click',()=>selectTemplate(key));
      list.appendChild(btn);
    }
    body.appendChild(list);
    hdr.addEventListener('click',()=>{
      const wasOpen=body.classList.contains('open');
      document.querySelectorAll('.cat-body').forEach(b=>b.classList.remove('open'));
      document.querySelectorAll('.cat-hdr').forEach(h=>h.classList.remove('open'));
      if(!wasOpen){body.classList.add('open');hdr.classList.add('open');}
    });
    wrap.appendChild(hdr); wrap.appendChild(body);
    container.appendChild(wrap);
  }
}

// ═══ SELECT TEMPLATE ═════════════════════════════════════════════════════
function selectTemplate(key){
  selTpl=key;
  document.querySelectorAll('.tpl-item').forEach(b=>b.classList.toggle('sel',b.dataset.key===key));
  const pa=document.getElementById('paramsArea');
  pa.innerHTML='';
  for(const [pk,p] of Object.entries(TEMPLATES[key].params)){
    const row=document.createElement('div');
    row.className='p-row'; row.dataset.pkey=pk;
    const fmt=v=>p.step<1?parseFloat(v).toFixed(2):parseInt(v);
    row.innerHTML=`
      <label><span>${p.label}</span><span class="pval" id="pv_${pk}">${fmt(p.default)}</span></label>
      <input type="range" id="ps_${pk}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.default}"
        oninput="onParamChange('${pk}',this.value)"/>`;
    pa.appendChild(row);
  }
  if(key==='poly_custom') updatePolyCoeffVisibility(TEMPLATES.poly_custom.params.degree.default);
  triggerAutoRender();
}

function onParamChange(pk, val){
  const tpl=selTpl?TEMPLATES[selTpl]:null;
  if(tpl&&tpl.params[pk]){
    const el=document.getElementById(`pv_${pk}`);
    if(el) el.textContent=tpl.params[pk].step<1?parseFloat(val).toFixed(2):parseInt(val);
  }
  if(selTpl==='poly_custom'&&pk==='degree') updatePolyCoeffVisibility(parseInt(val));
  triggerAutoRender();
}

function updatePolyCoeffVisibility(deg){
  document.getElementById('paramsArea').querySelectorAll('.p-row').forEach(row=>{
    const pk=row.dataset.pkey;
    if(!pk||pk==='degree') return;
    row.style.display=parseInt(pk.replace('a',''))<=deg?'':'none';
  });
}

// ═══ AUTO-RENDER (pure JS, no backend) ═══════════════════════════════════
function triggerAutoRender(){
  if(activePid===null||!selTpl) return;
  clearTimeout(renderTimers[activePid]);
  renderTimers[activePid]=setTimeout(()=>applyAndRender(activePid),180);
}

function applyAndRender(pid){
  const p=gp(pid);
  if(!p||!selTpl) return;
  const params={};
  for(const pk of Object.keys(TEMPLATES[selTpl].params)){
    const el=document.getElementById(`ps_${pk}`);
    if(el) params[pk]=parseFloat(el.value);
  }
  p.template=selTpl;
  p.params=params;
  if(!p.labels.title) p.labels.title=TEMPLATES[selTpl].label;
  // If in matplotlib mode, stay in mpl mode but flag that params changed
  // so next convertToMpl call is fresh. Don't auto-revert here — user chose mpl.
  if(p.mode==='mpl'){
    // just update params so next mpl render uses new values
    // do nothing else — mpl image stays until user explicitly re-renders
    return;
  }
  renderJS(pid, true);
}

// Core JS render — compute data, update chart, no network
function renderJS(pid, firstRender=false){
  const p=gp(pid);
  if(!p||!p.template) return;

  const result=evalTemplate(p.template, p.params, p.view);
  if(!result) return;

  p.jsData={x:result.x, y:result.y, discrete:result.discrete};
  p.equation=result.equation;

  if(firstRender) chartFirstRender[pid]=true;

  setConn('ok',`${TEMPLATES[p.template].label} · ${result.x.length} pts`);

  const innerEl=document.getElementById(`cinner_${pid}`);
  if(!innerEl){
    // Card not in DOM yet — will be drawn by renderDOM
    return;
  }

  // If no canvas exists yet, build the content
  if(!document.getElementById(`chart_${pid}`)){
    innerEl.innerHTML=buildInnerHTML(p);
    setTimeout(()=>{
      drawChart(p);
      wireInteraction(p);
      wireAxisLabelInputs(p);
    },0);
    return;
  }

  // Canvas exists — update chart in-place
  drawChart(p);
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
  return `
    <div class="chart-region" id="cregion_${pid}">
      <div class="canvas-wrap" id="cwrap_${pid}" data-mode="${plotModes[pid]||'move'}">
        <canvas id="chart_${pid}" style="display:block;width:100%"></canvas>
        <div class="cursor-coords" id="coords_${pid}">x=— y=—</div>
        <div class="sel-rect" id="selrect_${pid}"></div>
      </div>
      <div class="ax-xlabel">
        <input class="lbl-inp" id="xlabel_${pid}" type="text"
               value="${p.labels.xlabel}" placeholder="x label"/>
      </div>
      <div class="ax-ylabel">
        <input class="lbl-inp" id="ylabel_${pid}" type="text"
               value="${p.labels.ylabel}" placeholder="y label"/>
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
    renderDOM(); refreshCfg();
  });
  list.appendChild(ghost);

  refreshCfg();
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
    if(e.target.closest('.lbl-inp')||e.target.closest('.ctitle')||e.target.closest('.mode-btn')) return;
    if(activePid!==p.id){activePid=p.id;syncActiveHighlight();refreshCfg();}
  });
  setTimeout(()=>wireTopbarTitle(p),0);
  return card;
}

function buildTopbarInner(p, i){
  const tplName=p.template?TEMPLATES[p.template]?.label||p.template:'—';
  const editable=p.mode==='js';
  const mode=plotModes[p.id]||'move';

  // Mode toolbar — always shown (move / select)
  const modeToolbar = `
    <div class="mode-toolbar">
      <button class="mode-btn${mode==='move'?' active':''}" data-pid="${p.id}" data-action="mode-move"
              title="Pan &amp; zoom">⤢</button>
      <button class="mode-btn${mode==='select'?' active':''}" data-pid="${p.id}" data-action="mode-select"
              title="Select region to zoom">⬚</button>
    </div>`;

  // mpl button shown when template is set
  let modeBtn='';
  if(p.template){
    modeBtn = p.mode==='js'
      ? `<button class="cbtn mpl-btn" data-pid="${p.id}" data-action="mpl">⚗ mpl</button>`
      : `<button class="cbtn revert-btn" data-pid="${p.id}" data-action="revert">⟲ js</button>`;
  }

  return `
    <span class="cnum">PLOT ${String(i+1).padStart(2,'0')}</span>
    <span class="ctitle ${editable?'editable':'readonly'}" id="ctitle_${p.id}"
          title="${editable?'Click to edit title':''}">${p.labels.title||tplName}</span>
    <div class="cactions">
      ${modeToolbar}
      ${modeBtn}
      <button class="cbtn" data-pid="${p.id}" data-action="del">✕</button>
    </div>`;
}

// ═══ TITLE EDITING ═══════════════════════════════════════════════════════
function wireTopbarTitle(p){
  const el=document.getElementById(`ctitle_${p.id}`);
  if(!el||!el.classList.contains('editable')) return;
  el.addEventListener('click',(e)=>{
    e.stopPropagation();
    if(document.querySelector('.title-inp')) return;
    const inp=document.createElement('input');
    inp.className='title-inp'; inp.type='text'; inp.value=p.labels.title;
    const rect=el.getBoundingClientRect();
    inp.style.left=rect.left+'px'; inp.style.top=rect.top+'px';
    inp.style.width=Math.max(140,rect.width+20)+'px';
    document.body.appendChild(inp); inp.focus(); inp.select();
    function commit(){
      p.labels.title=inp.value.trim()||TEMPLATES[p.template]?.label||'';
      el.textContent=p.labels.title; inp.remove();
    }
    inp.addEventListener('keydown',(e)=>{if(e.key==='Enter')commit();else if(e.key==='Escape')inp.remove();});
    inp.addEventListener('blur',commit);
  });
}

// ═══ AXIS LABEL INPUTS ═══════════════════════════════════════════════════
function wireAxisLabelInputs(p){
  const xi=document.getElementById(`xlabel_${p.id}`);
  const yi=document.getElementById(`ylabel_${p.id}`);
  if(xi){
    xi.value=p.labels.xlabel;
    xi.addEventListener('change',()=>{p.labels.xlabel=xi.value;});
    xi.addEventListener('input', ()=>{p.labels.xlabel=xi.value;});
    xi.addEventListener('click', e=>e.stopPropagation());
  }
  if(yi){
    yi.value=p.labels.ylabel;
    yi.addEventListener('change',()=>{p.labels.ylabel=yi.value;});
    yi.addEventListener('input', ()=>{p.labels.ylabel=yi.value;});
    yi.addEventListener('click', e=>e.stopPropagation());
  }
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
    ch.data.labels=data.x.map(n=>+(n.toFixed ? n.toFixed(3) : n));
    ch.data.datasets[0].data            =data.y;
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
    chartInstances[p.id]=new Chart(ctx,{
      type:'line',
      data:{
        labels:data.x.map(n=>parseFloat(n.toFixed(3))),
        datasets:[{
          data:data.y, borderColor:lc, borderWidth:v.line_width||2,
          borderDash:dashFor(v.line_style),
          pointRadius:v.marker!=='none'?v.marker_size||4:0,
          pointBackgroundColor:lc,
          fill:v.fill_under, backgroundColor:hexAlpha(lc,v.fill_alpha||.15),
          tension:0.35, spanGaps:true,
        }]
      },
      options:{responsive:true,maintainAspectRatio:true,animation:animOpts,
        plugins:{legend:{display:false},tooltip:tooltipOpts()},scales}
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
        color:'#6060a0',
        font:{family:"'IBM Plex Mono'",size:9},
        maxTicksLimit:12,
        callback: makeTickCb('x'),
      },
      grid:{color:'rgba(37,37,64,.8)',display:v.show_grid}
    },
    y:{
      ticks:{
        color:'#6060a0',
        font:{family:"'IBM Plex Mono'",size:9},
        maxTicksLimit:10,
        callback: makeTickCb('y'),
      },
      grid:{color:'rgba(37,37,64,.8)',display:v.show_grid}
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

// ═══ INTERACTIONS (pan, zoom, select, cursor) ════════════════════════════
function wireInteraction(p){
  const wrap=document.getElementById(`cwrap_${p.id}`);
  if(!wrap) return;

  // ── cursor coordinates ──
  wrap.addEventListener('mousemove',(e)=>{
    const ch=chartInstances[p.id]; if(!ch) return;
    const {dataX,dataY}=pixelToData(ch,e.clientX,e.clientY);
    const coordEl=document.getElementById(`coords_${p.id}`);
    if(coordEl) coordEl.textContent=`x=${dataX.toFixed(3)}  y=${dataY.toFixed(3)}`;
    // also drive selection drag
    if(selState[p.id]?.dragging) onSelMove(e,p);
    // drive pan
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
    const factor=e.deltaY>0?1.15:1/1.15; // scroll down = zoom out

    const sx=ch.scales.x, sy=ch.scales.y;
    const xMin=sx.min, xMax=sx.max, yMin=sy.min, yMax=sy.max;

    // Zoom keeping the data-point under cursor fixed
    // newMin = cursor + (oldMin - cursor)*factor
    const newXMin=dataX+(xMin-dataX)*factor;
    const newXMax=dataX+(xMax-dataX)*factor;
    // For y we want to maintain the same y aspect ratio (same span ratio as x)
    const xSpanOld=xMax-xMin, xSpanNew=newXMax-newXMin;
    const ySpanOld=yMax-yMin;
    const ySpanNew=ySpanOld*(xSpanNew/xSpanOld); // keep aspect ratio
    const newYMin=dataY+(yMin-dataY)*(ySpanNew/ySpanOld);
    const newYMax=dataY+(yMax-dataY)*(ySpanNew/ySpanOld);

    p.view.x_min=newXMin; p.view.x_max=newXMax;
    p.view.y_min=newYMin; p.view.y_max=newYMax;

    applyScaleLimits(ch.options.scales,p.view);
    ch.update('none');
    syncCfgDomain();
    // Recompute data for new domain
    renderJS(p.id,false);
  },{passive:false});

  // ── mousedown: route to move or select ──
  wrap.addEventListener('mousedown',(e)=>{
    if(e.button!==0) return;
    const mode=plotModes[p.id]||'move';
    if(mode==='move') startPan(e,p);
    else              startSelect(e,p);
  });

  window.addEventListener('mouseup',()=>{
    endPan(p);
    endSelect(p);
  });
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
  // Convert mouse delta from CSS pixels to chart natural pixels
  const scaleX=rect.width/canvas.width;
  const scaleY=rect.height/canvas.height;
  const dx=(e.clientX-st.startX)/scaleX;
  const dy=(e.clientY-st.startY)/scaleY;
  st.startX=e.clientX; st.startY=e.clientY;

  const sx=ch.scales.x, sy=ch.scales.y;
  const xSpan=sx.max-sx.min, ySpan=sy.max-sy.min;
  const xPx=sx.right-sx.left, yPx=sy.bottom-sy.top;
  if(xPx===0||yPx===0) return;

  const dxData=(dx/xPx)*xSpan;
  const dyData=(dy/yPx)*ySpan;

  p.view.x_min=sx.min-dxData; p.view.x_max=sx.max-dxData;
  p.view.y_min=sy.min+dyData; p.view.y_max=sy.max+dyData;

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

// ─── SELECT ───────────────────────────────────────────────────────────────
const selState={};

function startSelect(e,p){
  const wrap=document.getElementById(`cwrap_${p.id}`);
  const ch=chartInstances[p.id]; if(!ch||!wrap) return;
  const wrapRect=wrap.getBoundingClientRect();
  const cssPx=e.clientX-wrapRect.left;
  const cssPy=e.clientY-wrapRect.top;
  const {dataX,dataY}=pixelToData(ch,e.clientX,e.clientY);
  selState[p.id]={dragging:true,
    startPx:cssPx,startPy:cssPy,
    startDataX:dataX,startDataY:dataY,
    curPx:cssPx,curPy:cssPy};
  const rect=document.getElementById(`selrect_${p.id}`);
  if(rect){
    rect.style.display='block';
    rect.style.left=cssPx+'px'; rect.style.top=cssPy+'px';
    rect.style.width='0'; rect.style.height='0';
  }
  e.preventDefault();
}

function onSelMove(e,p){
  const st=selState[p.id]; if(!st?.dragging) return;
  const ch=chartInstances[p.id]; if(!ch) return;
  const wrap=document.getElementById(`cwrap_${p.id}`);
  if(!wrap) return;
  const wrapRect=wrap.getBoundingClientRect();
  const px=e.clientX-wrapRect.left;
  const py=e.clientY-wrapRect.top;
  st.curPx=px; st.curPy=py;

  const x0=Math.min(st.startPx,px), y0=Math.min(st.startPy,py);
  const w=Math.abs(px-st.startPx), h=Math.abs(py-st.startPy);
  const rect=document.getElementById(`selrect_${p.id}`);
  if(rect){
    rect.style.left=x0+'px'; rect.style.top=y0+'px';
    rect.style.width=w+'px'; rect.style.height=h+'px';
  }
}

function endSelect(p){
  const st=selState[p.id]; if(!st?.dragging) return;
  st.dragging=false;
  const rect=document.getElementById(`selrect_${p.id}`);
  if(rect) rect.style.display='none';

  const ch=chartInstances[p.id]; if(!ch) return;
  const wrap=document.getElementById(`cwrap_${p.id}`);
  if(!wrap) return;
  const wrapRect=wrap.getBoundingClientRect();

  // Convert both corners (in client coords) to data coords
  const {dataX:x0d,dataY:y0d}=pixelToData(ch,
    wrapRect.left+st.startPx, wrapRect.top+st.startPy);
  const {dataX:x1d,dataY:y1d}=pixelToData(ch,
    wrapRect.left+st.curPx, wrapRect.top+st.curPy);

  // Only zoom if selection is large enough (>10px in each dim)
  if(Math.abs(st.curPx-st.startPx)<10||Math.abs(st.curPy-st.startPy)<10) return;

  p.view.x_min=Math.min(x0d,x1d); p.view.x_max=Math.max(x0d,x1d);
  p.view.y_min=Math.min(y0d,y1d); p.view.y_max=Math.max(y0d,y1d);

  applyScaleLimits(ch.options.scales,p.view);
  ch.update('none');
  syncCfgDomain();
  renderJS(p.id,false);
}

// ═══ ACTIONS ═════════════════════════════════════════════════════════════
function handleAction(action,pid){
  if(action==='del'){
    destroyChart(pid);
    plots=plots.filter(p=>p.id!==pid);
    if(activePid===pid) activePid=plots[0]?.id||null;
    if(plots.length===0){const np=mkPlot();plots.push(np);plotModes[np.id]='move';activePid=np.id;}
    renderDOM(); return;
  }
  if(action==='mpl')    {convertToMpl(pid); return;}
  if(action==='revert') {revertToJS(pid);   return;}
  if(action==='mode-move'){
    plotModes[pid]='move';
    const wrap=document.getElementById(`cwrap_${pid}`);
    if(wrap) wrap.dataset.mode='move';
    updateTopbar(pid);
    return;
  }
  if(action==='mode-select'){
    plotModes[pid]='select';
    const wrap=document.getElementById(`cwrap_${pid}`);
    if(wrap) wrap.dataset.mode='select';
    updateTopbar(pid);
    return;
  }
}

// ═══ CFG PANEL ═══════════════════════════════════════════════════════════
function refreshCfg(){
  const empty=document.getElementById('cfgEmpty');
  const content=document.getElementById('cfgContent');
  const p=activePid!==null?gp(activePid):null;
  if(!p){empty.style.display='flex';content.style.display='none';return;}
  empty.style.display='none'; content.style.display='flex';
  const v=p.view;
  sv('c_xn',v.x_min??''); sv('c_xx',v.x_max??'');
  sv('c_yn',v.y_min??''); sv('c_yx',v.y_max??'');
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
  const xn=pf('c_xn'),xx=pf('c_xx'),yn=pf('c_yn'),yx=pf('c_yx');
  v.x_min=isNaN(xn)?null:xn; v.x_max=isNaN(xx)?null:xx;
  v.y_min=isNaN(yn)?null:yn; v.y_max=isNaN(yx)?null:yx;
  v.line_color =document.getElementById('c_lc').value;
  v.line_width =parseFloat(document.getElementById('c_lw').value);
  v.line_style =document.getElementById('c_ls').value;
  v.marker     =document.getElementById('c_mk').value;
  v.fill_under =document.getElementById('c_fill').checked;
  v.show_grid  =document.getElementById('c_grid').checked;
  v.title_size =parseInt(document.getElementById('c_ts').value)||13;
  v.label_size =parseInt(document.getElementById('c_ls2').value)||10;
}

function triggerCfgRender(){
  if(activePid===null) return;
  readCfgIntoActive();
  const p=gp(activePid);
  if(!p||!p.template) return;
  // For JS mode: update view and redraw immediately (no backend)
  if(p.mode==='js') renderJS(activePid, false);
  // For mpl mode: re-convert on debounce
  else{
    clearTimeout(window._cfgDebounce);
    window._cfgDebounce=setTimeout(()=>convertToMpl(activePid),400);
  }
}

function syncCfgDomain(){
  if(activePid===null) return;
  const p=gp(activePid); if(!p) return;
  const v=p.view;
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val??'';};
  set('c_xn',v.x_min!=null?v.x_min.toFixed(3):'');
  set('c_xx',v.x_max!=null?v.x_max.toFixed(3):'');
  set('c_yn',v.y_min!=null?v.y_min.toFixed(3):'');
  set('c_yx',v.y_max!=null?v.y_max.toFixed(3):'');
}

function wireAllCfgInputs(){
  const ids=['c_xn','c_xx','c_yn','c_yx','c_lw','c_ls','c_mk','c_ts','c_ls2'];
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