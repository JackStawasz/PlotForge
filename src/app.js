const API = 'http://localhost:5000/api';

// ═══ CATEGORY META ═══════════════════════════════════════════════════════
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

// ═══ STATE ═══════════════════════════════════════════════════════════════
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

function mkPid(){ return ++pid_ctr; }
function mkCid(){ return ++curve_ctr; }

function defView(){
  return {
    x_min:null, x_max:null, y_min:null, y_max:null,
    show_grid:true, grid_alpha:.5,
    title_size:13, label_size:10,
    show_legend:true,
    legend_x_frac: 0.98,
    legend_y_frac: 0.02,
  };
}

function defCurve(colorIdx){
  return {
    id: mkCid(),
    template: null, params: {}, equation: '',
    jsData: null,
    line_color: CURVE_COLORS[colorIdx % CURVE_COLORS.length],
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
    curves: [ defCurve(0) ],
    view: defView(),
    labels: { title:'', xlabel:'', ylabel:'' },
    loading: false,
    converting: false,
    mplMode: false,
    mplImage: null,
  };
}

function gp(pid){ return plots.find(p => p.id === pid); }
function activePlot(){ return activePid !== null ? gp(activePid) : null; }
function activeCurve(){
  const p = activePlot(); if(!p) return null;
  return p.curves[activeCurveIdx] || p.curves[0] || null;
}

// ═══ DATA MASKING ════════════════════════════════════════════════════════
// xMask = (x > xMin) & (x < xMax); yMask = (y > yMin) & (y < yMax)
// masked arrays keep nulls at filtered positions (so spanGaps still works)
function applyMask(xArr, yArr, curve){
  const xn=curve.mask_x_min, xx=curve.mask_x_max;
  const yn=curve.mask_y_min, yx=curve.mask_y_max;
  if(xn==null && xx==null && yn==null && yx==null) return {x:xArr, y:yArr};
  const xOut=[], yOut=[];
  for(let i=0;i<xArr.length;i++){
    const xi=xArr[i], yi=yArr[i];
    let keep = true;
    if(xn!=null && xi!=null && xi <= xn) keep=false;
    if(xx!=null && xi!=null && xi >= xx) keep=false;
    if(yn!=null && yi!=null && yi <= yn) keep=false;
    if(yx!=null && yi!=null && yi >= yx) keep=false;
    xOut.push(keep ? xi : null);
    yOut.push(keep ? yi : null);
  }
  return {x:xOut, y:yOut};
}

// ═══ MATH ENGINE ═════════════════════════════════════════════════════════
function evalTemplate(tkey, params, view){
  const tpl = TEMPLATES[tkey];
  if(!tpl) return null;
  const xd = tpl.x_default;
  const p  = params;
  const N  = 600;
  const xLo = view.x_min != null ? view.x_min : xd[0];
  const xHi = view.x_max != null ? view.x_max : xd[1];

  function linspace(lo,hi,n){ const a=[]; for(let i=0;i<n;i++) a.push(lo+(hi-lo)*i/(n-1)); return a; }

  let x, y, discrete=false;
  switch(tkey){
    case 'sin':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)*Math.sin((p.f||1)*v+(p.phi||0))); break; }
    case 'arcsin':{ const lo2=Math.max(-0.9999,xLo),hi2=Math.min(0.9999,xHi); x=linspace(lo2,hi2,400); y=x.map(v=>(p.A||1)*Math.asin(v)); break; }
    case 'sinh':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)*Math.sinh((p.f||1)*v)); break; }
    case 'arcsinh':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)*Math.asinh((p.f||1)*v)); break; }
    case 'cos':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)*Math.cos((p.f||1)*v+(p.phi||0))); break; }
    case 'arccos':{ const lo2=Math.max(-0.9999,xLo),hi2=Math.min(0.9999,xHi); x=linspace(lo2,hi2,400); y=x.map(v=>(p.A||1)*Math.acos(v)); break; }
    case 'cosh':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)*Math.cosh((p.f||1)*v)); break; }
    case 'arccosh':{ const lo2=Math.max(1.001,xLo); x=linspace(lo2,xHi,400); y=x.map(v=>(p.A||1)*Math.acosh((p.f||1)*v)); break; }
    case 'tan':{ x=linspace(xLo,xHi,800); y=x.map(v=>{const val=(p.A||1)*Math.tan((p.f||1)*v);return Math.abs(val)>50?null:val;}); break; }
    case 'arctan':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)*Math.atan((p.f||1)*v)); break; }
    case 'tanh':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)*Math.tanh((p.f||1)*v)); break; }
    case 'arctanh':{ const f=p.f||1,bound=0.9999/Math.max(0.0001,Math.abs(f)); const lo2=Math.max(-bound,xLo),hi2=Math.min(bound,xHi); x=linspace(lo2,hi2,400); y=x.map(v=>(p.A||1)*Math.atanh(f*v)); break; }
    case 'csc':{ x=linspace(xLo,xHi,800); y=x.map(v=>{const s=Math.sin((p.f||1)*v);if(Math.abs(s)<0.01)return null;const val=(p.A||1)/s;return Math.abs(val)>20?null:val;}); break; }
    case 'arccsc':{ x=linspace(xLo,xHi,N); y=x.map(v=>Math.abs(v)<1?null:(p.A||1)*Math.asin(1/v)); break; }
    case 'csch':{ x=linspace(xLo,xHi,N); y=x.map(v=>{const s=Math.sinh((p.f||1)*v);if(Math.abs(s)<0.001)return null;const val=(p.A||1)/s;return Math.abs(val)>50?null:val;}); break; }
    case 'arccsch':{ x=linspace(xLo,xHi,N); y=x.map(v=>v===0?null:(p.A||1)*Math.asinh(1/v)); break; }
    case 'sec':{ x=linspace(xLo,xHi,800); y=x.map(v=>{const c=Math.cos((p.f||1)*v);if(Math.abs(c)<0.01)return null;const val=(p.A||1)/c;return Math.abs(val)>20?null:val;}); break; }
    case 'arcsec':{ x=linspace(xLo,xHi,N); y=x.map(v=>Math.abs(v)<1?null:(p.A||1)*Math.acos(1/v)); break; }
    case 'sech':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)/Math.cosh((p.f||1)*v)); break; }
    case 'arcsech':{ const lo2=Math.max(0.001,xLo),hi2=Math.min(0.9999,xHi); x=linspace(lo2,hi2,400); y=x.map(v=>(p.A||1)*Math.acosh(1/v)); break; }
    case 'cot':{ x=linspace(xLo,xHi,800); y=x.map(v=>{const s=Math.sin((p.f||1)*v);if(Math.abs(s)<0.01)return null;const val=(p.A||1)*Math.cos((p.f||1)*v)/s;return Math.abs(val)>50?null:val;}); break; }
    case 'arccot':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)*(Math.PI/2-Math.atan((p.f||1)*v))); break; }
    case 'coth':{ x=linspace(xLo,xHi,N); y=x.map(v=>{const t=Math.tanh((p.f||1)*v);if(Math.abs(t)<0.001)return null;const val=(p.A||1)/t;return Math.abs(val)>50?null:val;}); break; }
    case 'arccoth':{ x=linspace(xLo,xHi,N); y=x.map(v=>Math.abs(v)<=1?null:(p.A||1)*Math.atanh(1/v)); break; }
    case 'gaussian':{ x=linspace(xLo,xHi,N); const mu=p.mu||0,sig=Math.max(0.001,p.sig||1); y=x.map(v=>(p.A||1)*Math.exp(-((v-mu)**2)/(2*sig**2))); break; }
    case 'lorentzian':{ x=linspace(xLo,xHi,N); const g=Math.max(0.001,p.gamma||1),x0=p.x0||0; y=x.map(v=>(p.A||1)*g**2/((v-x0)**2+g**2)); break; }
    case 'binomial':{ discrete=true; const n=Math.round(p.n||20),pk=Math.max(0.001,Math.min(0.999,p.p||0.5)); x=[]; y=[]; for(let k=0;k<=n;k++){x.push(k);y.push(binomPMF(n,k,pk));} break; }
    case 'poisson':{ discrete=true; const lam=Math.max(0.01,p.lam||4),hi2=Math.max(20,Math.ceil(lam*3)); x=[]; y=[]; for(let k=0;k<=hi2;k++){x.push(k);y.push(poissonPMF(lam,k));} break; }
    case 'laplace':{ x=linspace(xLo,xHi,N); const b=Math.max(0.001,p.b||1),mu2=p.mu||0; y=x.map(v=>(p.A||1)/(2*b)*Math.exp(-Math.abs(v-mu2)/b)); break; }
    case 'linear':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.m||1)*v+(p.b||0)); break; }
    case 'vline':{ const c=p.c||0; x=[c,c]; y=[-1e6,1e6]; break; }
    case 'hline':{ x=linspace(xLo,xHi,N); y=x.map(()=>p.c||0); break; }
    case 'poly_custom':{ x=linspace(xLo,xHi,N); const deg=Math.round(p.degree||4); y=x.map(v=>{let sum=0;for(let i=0;i<=deg;i++)sum+=(p[`a${i}`]||0)*v**i;return sum;}); break; }
    case 'logarithmic':{ const lo2=Math.max(0.001,xLo); x=linspace(lo2,xHi,400); const base=Math.max(1.0001,p.b||Math.E); y=x.map(v=>(p.a||1)*(Math.log(v)/Math.log(base))+(p.c||0)); break; }
    case 'exponential':{ x=linspace(xLo,xHi,N); const base=Math.max(1.0001,p.b||Math.E); y=x.map(v=>(p.a||1)*Math.pow(base,(p.s||0.5)*v)); break; }
    case 'nth_root':{ const lo2=Math.max(0,xLo); x=linspace(lo2,xHi,400); const n=Math.max(0.001,p.n||2); y=x.map(v=>(p.a||1)*Math.sign(v)*Math.pow(Math.abs(v),1/n)); break; }
    case 'reciprocal':{ x=linspace(xLo,xHi,800); y=x.map(v=>{const d=v+(p.h||0);if(Math.abs(d)<0.01)return null;const val=(p.a||1)/d;return Math.abs(val)>50?null:val;}); break; }
    case 'factorial':{ x=linspace(xLo,xHi,400); y=x.map(v=>{const xp1=v+1;if(xp1<=0)return null;const g=lanczosGamma(xp1);return(p.a||1)*(Math.abs(g)>1e8?null:g);}); break; }
    case 'ceiling':{ x=linspace(xLo,xHi,800); y=x.map(v=>(p.a||1)*Math.ceil(v)); break; }
    case 'floor':{ x=linspace(xLo,xHi,800); y=x.map(v=>(p.a||1)*Math.floor(v)); break; }
    case 'absolute':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.a||1)*Math.abs(v+(p.h||0))); break; }
    default: return null;
  }

  const yVals=y.filter(v=>v!=null&&isFinite(v));
  const autoYMin=yVals.length?Math.min(...yVals):-1;
  const autoYMax=yVals.length?Math.max(...yVals):1;
  return {x,y,discrete,equation:tpl.equation,autoXMin:xLo,autoXMax:xHi,autoYMin,autoYMax};
}

function binomPMF(n,k,p){return binomCoeff(n,k)*Math.pow(p,k)*Math.pow(1-p,n-k);}
function binomCoeff(n,k){if(k>n)return 0;let c=1;for(let i=0;i<k;i++)c=c*(n-i)/(i+1);return c;}
function poissonPMF(lam,k){return Math.exp(-lam+k*Math.log(lam)-logFactorial(k));}
function logFactorial(n){let s=0;for(let i=2;i<=n;i++)s+=Math.log(i);return s;}
function lanczosGamma(z){
  if(z<0.5) return Math.PI/(Math.sin(Math.PI*z)*lanczosGamma(1-z));
  z-=1;
  const g=7,c=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  let x=c[0]; for(let i=1;i<g+2;i++)x+=c[i]/(z+i);
  const t=z+g+0.5;
  return Math.sqrt(2*Math.PI)*Math.pow(t,z+0.5)*Math.exp(-t)*x;
}

// ═══ BOOT ════════════════════════════════════════════════════════════════
async function boot(){
  try{
    const r=await fetch(`${API}/templates`);
    TEMPLATES=await r.json();
    buildCategories();
    setConn('ok','Backend connected');
  }catch(e){ setConn('err','Backend unreachable — run app.py'); }
  plots=[];
  const p=mkPlot(); plots.push(p);
  activePid=p.id; activeCurveIdx=0;
  renderDOM();
  wireAllCfgInputs();
}

function setConn(s,msg){
  document.getElementById('cdot').className='cdot'+(s==='ok'?' ok':s==='err'?' err':'');
  document.getElementById('cmsg').textContent=msg;
}

// ═══ SIDEBAR ═════════════════════════════════════════════════════════════
function refreshSidebar(){
  const noPlot=document.getElementById('sidebarNoPlot');
  const plotContent=document.getElementById('sidebarPlotContent');
  const p=activePlot();
  if(!p){ if(noPlot)noPlot.style.display='flex'; if(plotContent)plotContent.style.display='none'; return; }
  if(noPlot)noPlot.style.display='none';
  if(plotContent)plotContent.style.display='flex';
  updateAddToPlotBtn();
  const curve=activeCurve();
  const tkey=curve?.template||null;
  document.querySelectorAll('.tpl-item').forEach(b=>b.classList.toggle('sel',b.dataset.key===tkey));
  if(tkey){
    document.querySelectorAll('.cat-body').forEach(b=>b.classList.remove('open'));
    document.querySelectorAll('.cat-hdr').forEach(h=>h.classList.remove('open'));
    document.querySelectorAll('.subfolder-body').forEach(b=>b.classList.remove('open'));
    document.querySelectorAll('.subfolder-hdr').forEach(h=>h.classList.remove('open'));
    document.querySelectorAll('.cat-hdr').forEach(hdr=>{
      const body=hdr.nextElementSibling;
      if(body?.querySelector(`[data-key="${tkey}"]`)){
        hdr.classList.add('open'); body.classList.add('open');
        body.querySelectorAll('.subfolder-hdr').forEach(sh=>{
          const sb=sh.nextElementSibling;
          if(sb?.querySelector(`[data-key="${tkey}"]`)){ sh.classList.add('open'); sb.classList.add('open'); }
        });
      }
    });
    selTpl=tkey;
    buildParamsForTemplate(tkey,curve.params);
  }else{
    selTpl=null;
    const pa=document.getElementById('paramsArea');
    if(pa) pa.innerHTML='<div style="font-size:.65rem;color:var(--muted);font-style:italic">Select a template.</div>';
  }
}

function updateAddToPlotBtn(){
  const btn=document.getElementById('addToPlotBtn'); if(!btn) return;
  btn.disabled=!selTpl; btn.classList.toggle('atp-disabled',!selTpl);
}

function buildCategories(){
  const container=document.getElementById('catBlocks');
  container.innerHTML='';
  const grouped={};
  for(const [key,tpl] of Object.entries(TEMPLATES)){
    const cat=tpl.category, sub=tpl.subfolder||null;
    if(!grouped[cat]) grouped[cat]={_flat:[]};
    if(sub){ if(!grouped[cat][sub]) grouped[cat][sub]=[]; grouped[cat][sub].push({key,tpl}); }
    else grouped[cat]._flat.push({key,tpl});
  }
  for(const [cat,submap] of Object.entries(grouped)){
    const meta=CAT_META[cat]||{label:cat,dotClass:''};
    const wrap=document.createElement('div'); wrap.className='cat-wrap';
    const hdr=document.createElement('button'); hdr.className='cat-hdr';
    hdr.innerHTML=`<div class="cat-dot ${meta.dotClass}"></div><span>${meta.label}</span><span class="cat-arrow">›</span>`;
    const body=document.createElement('div'); body.className='cat-body';
    const subfolders=Object.keys(submap).filter(k=>k!=='_flat');
    const flatItems=submap._flat;
    const total=subfolders.length+flatItems.length; let ti=0;
    subfolders.forEach(subName=>{
      const items=submap[subName]; const isLast=(ti===total-1); ti++;
      const sw=document.createElement('div'); sw.className='subfolder-wrap';
      const sh=document.createElement('button'); sh.className='subfolder-hdr';
      sh.innerHTML=`<span class="tree-connector">${isLast?'└':'├'}</span><span class="sub-label">${subName}</span><span class="sub-arrow">›</span>`;
      const sb=document.createElement('div'); sb.className='subfolder-body';
      items.forEach(({key,tpl},idx)=>{
        const btn=document.createElement('button'); btn.className='tpl-item sub-item'; btn.dataset.key=key;
        btn.innerHTML=`<span class="tree-connector sub-connector">${idx===items.length-1?'└':'├'}</span><span class="tpl-label">${tpl.label}</span><span class="tpl-eq">${tpl.equation}</span>`;
        btn.addEventListener('click',()=>selectTemplate(key)); sb.appendChild(btn);
      });
      sh.addEventListener('click',e=>{ e.stopPropagation(); const was=sb.classList.contains('open'); body.querySelectorAll('.subfolder-body').forEach(b=>b.classList.remove('open')); body.querySelectorAll('.subfolder-hdr').forEach(h=>h.classList.remove('open')); if(!was){sb.classList.add('open');sh.classList.add('open');} });
      sw.appendChild(sh); sw.appendChild(sb); body.appendChild(sw);
    });
    flatItems.forEach(({key,tpl})=>{
      ti++; const isLast=(ti===total);
      const btn=document.createElement('button'); btn.className='tpl-item'; btn.dataset.key=key;
      btn.innerHTML=`<span class="tree-connector">${isLast?'└':'├'}</span><span class="tpl-label">${tpl.label}</span><span class="tpl-eq">${tpl.equation}</span>`;
      btn.addEventListener('click',()=>selectTemplate(key)); body.appendChild(btn);
    });
    hdr.addEventListener('click',()=>{ const was=body.classList.contains('open'); document.querySelectorAll('.cat-body').forEach(b=>b.classList.remove('open')); document.querySelectorAll('.cat-hdr').forEach(h=>h.classList.remove('open')); if(!was){body.classList.add('open');hdr.classList.add('open');} });
    wrap.appendChild(hdr); wrap.appendChild(body); container.appendChild(wrap);
  }
}

function selectTemplate(key){
  selTpl=key;
  document.querySelectorAll('.tpl-item').forEach(b=>b.classList.toggle('sel',b.dataset.key===key));
  updateAddToPlotBtn();
  const p=activePlot();
  if(p){
    const curve=activeCurve();
    if(curve&&!curve.template){ curve.template=key; buildParamsForTemplate(key,curve.params); p.view.x_min=null;p.view.x_max=null;p.view.y_min=null;p.view.y_max=null; applyAndRender(p.id,true); }
    else buildParamsForTemplate(key,curve?.params);
  }
}

function addToPlot(){
  const p=activePlot(); if(!p||!selTpl) return;
  const curve=activeCurve();
  if(curve&&!curve.template){
    curve.template=selTpl; buildParamsForTemplate(selTpl,curve.params);
    p.view.x_min=null;p.view.x_max=null;p.view.y_min=null;p.view.y_max=null;
    applyAndRender(p.id,true); refreshOverlayLegend(p.id); refreshLineCurveSelector(); return;
  }
  const nc=defCurve(p.curves.length); nc.template=selTpl; p.curves.push(nc);
  activeCurveIdx=p.curves.length-1;
  buildParamsForTemplate(selTpl,{});
  applyAndRender(p.id,false);
  updateTopbar(p.id); refreshOverlayLegend(p.id); refreshLineCurveSelector(); refreshCfg();
}

// ═══ PARAMS ══════════════════════════════════════════════════════════════
// Compute a "nice" slider step proportional to the range (~1/200th, snapped to 1-2-5 series)
function niceSliderStep(min, max){
  const span = Math.abs(max - min);
  if(span === 0) return 0.01;
  const rough = span / 200;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let nice;
  if(norm < 1.5)      nice = 1;
  else if(norm < 3.5) nice = 2;
  else if(norm < 7.5) nice = 5;
  else                nice = 10;
  return nice * mag;
}

const sliderRanges={};

function buildParamsForTemplate(key,existingParams){
  const pa=document.getElementById('paramsArea'); pa.innerHTML='';
  if(!key||!TEMPLATES[key]) return;
  for(const [pk,pd] of Object.entries(TEMPLATES[key].params)){
    const row=document.createElement('div'); row.className='p-row'; row.dataset.pkey=pk;
    const val=existingParams?.[pk]??pd.default;
    if(!sliderRanges[key]) sliderRanges[key]={};
    if(!sliderRanges[key][pk]) sliderRanges[key][pk]={min:pd.min,max:pd.max};
    const {min,max}=sliderRanges[key][pk];
    // Use proportional step for the slider; keep pd.step for the value input precision hint
    const sliderStep = niceSliderStep(min, max);
    const dispDecimals = sliderStep >= 1 ? 0 : Math.max(0, Math.ceil(-Math.log10(sliderStep)) + 1);
    const fmt = v => dispDecimals === 0 ? parseInt(v) : parseFloat(v).toFixed(dispDecimals);
    row.innerHTML=`
      <div class="p-row-top">
        <span class="p-lbl">${pd.label}</span>
        <input class="p-val-inp" id="pv_${pk}" type="text" value="${fmt(val)}" data-pk="${pk}" data-step="${sliderStep}"/>
      </div>
      <div class="p-slider-wrap">
        <input class="p-range-inp" type="text" value="${fmt(min)}" data-pk="${pk}" data-bound="min" title="Slider min"/>
        <input type="range" id="ps_${pk}" min="${min}" max="${max}" step="${sliderStep}" value="${val}" oninput="onParamSlider('${pk}',this.value)"/>
        <input class="p-range-inp" type="text" value="${fmt(max)}" data-pk="${pk}" data-bound="max" title="Slider max"/>
      </div>`;
    pa.appendChild(row);
    const vi=row.querySelector(`#pv_${pk}`);
    vi.addEventListener('change',()=>commitParamValue(pk,vi.value,pd.step));
    vi.addEventListener('keydown',e=>{if(e.key==='Enter'){commitParamValue(pk,vi.value,pd.step);vi.blur();}});
    vi.addEventListener('click',e=>e.stopPropagation());
    row.querySelectorAll('.p-range-inp').forEach(inp=>{
      inp.addEventListener('change',()=>commitRangeBound(key,pk,inp.dataset.bound,inp.value,pd.step));
      inp.addEventListener('keydown',e=>{if(e.key==='Enter'){commitRangeBound(key,pk,inp.dataset.bound,inp.value,pd.step);inp.blur();}});
      inp.addEventListener('click',e=>e.stopPropagation());
    });
  }
  if(key==='poly_custom') updatePolyCoeffVisibility(existingParams?.degree??TEMPLATES.poly_custom.params.degree.default);
}

function commitParamValue(pk,raw,step){
  const val=parseFloat(raw); if(isNaN(val)){syncParamInputFromSlider(pk);return;}
  const slider=document.getElementById(`ps_${pk}`), vi=document.getElementById(`pv_${pk}`); if(!slider)return;
  const sliderStep=parseFloat(slider.step)||0.01;
  const dec=sliderStep>=1?0:Math.max(0,Math.ceil(-Math.log10(sliderStep))+1);
  const fmt=v=>dec===0?parseInt(v):parseFloat(v).toFixed(dec);
  if(val<parseFloat(slider.min)){slider.min=val;if(selTpl){if(!sliderRanges[selTpl])sliderRanges[selTpl]={};if(!sliderRanges[selTpl][pk])sliderRanges[selTpl][pk]={};sliderRanges[selTpl][pk].min=val;}const mi=slider.parentElement.querySelector('[data-bound="min"]');if(mi)mi.value=fmt(val);}
  if(val>parseFloat(slider.max)){slider.max=val;if(selTpl){if(!sliderRanges[selTpl])sliderRanges[selTpl]={};if(!sliderRanges[selTpl][pk])sliderRanges[selTpl][pk]={};sliderRanges[selTpl][pk].max=val;}const ma=slider.parentElement.querySelector('[data-bound="max"]');if(ma)ma.value=fmt(val);}
  slider.value=val; if(vi)vi.value=fmt(val);
  if(selTpl==='poly_custom'&&pk==='degree')updatePolyCoeffVisibility(parseInt(val));
  if(activePid!==null)applyAndRender(activePid,false);
}

function commitRangeBound(key,pk,bound,raw,step){
  const val=parseFloat(raw),slider=document.getElementById(`ps_${pk}`),inp=slider?.parentElement?.querySelector(`[data-bound="${bound}"]`);
  if(isNaN(val)||!slider){if(inp)inp.value=bound==='min'?slider?.min:slider?.max;return;}
  const sliderStep=parseFloat(slider.step)||0.01;
  const dec=sliderStep>=1?0:Math.max(0,Math.ceil(-Math.log10(sliderStep))+1);
  const fmt=v=>dec===0?parseInt(v):parseFloat(v).toFixed(dec);
  if(bound==='min')slider.min=val;else slider.max=val;
  if(inp)inp.value=fmt(val);
  if(!sliderRanges[key])sliderRanges[key]={};if(!sliderRanges[key][pk])sliderRanges[key][pk]={};sliderRanges[key][pk][bound]=val;
  // Also update slider step proportionally to new range
  const newMin=parseFloat(slider.min), newMax=parseFloat(slider.max);
  const newStep=niceSliderStep(newMin,newMax);
  slider.step=newStep;
  const cur=parseFloat(slider.value);
  if(bound==='min'&&cur<val){slider.value=val;const vi=document.getElementById(`pv_${pk}`);if(vi)vi.value=fmt(val);}
  if(bound==='max'&&cur>val){slider.value=val;const vi=document.getElementById(`pv_${pk}`);if(vi)vi.value=fmt(val);}
}

function syncParamInputFromSlider(pk){
  const slider=document.getElementById(`ps_${pk}`),vi=document.getElementById(`pv_${pk}`);
  if(slider&&vi){
    const step=parseFloat(slider.step)||0.01;
    const dec=step>=1?0:Math.max(0,Math.ceil(-Math.log10(step))+1);
    vi.value=dec===0?parseInt(slider.value):parseFloat(slider.value).toFixed(dec);
  }
}

function onParamSlider(pk,val){
  const slider=document.getElementById(`ps_${pk}`);
  const step=parseFloat(slider?.step)||0.01;
  const dec=step>=1?0:Math.max(0,Math.ceil(-Math.log10(step))+1);
  const vi=document.getElementById(`pv_${pk}`);
  if(vi)vi.value=dec===0?parseInt(val):parseFloat(val).toFixed(dec);
  if(selTpl==='poly_custom'&&pk==='degree')updatePolyCoeffVisibility(parseInt(val));
  if(activePid!==null)applyAndRender(activePid,false);
}

function updatePolyCoeffVisibility(deg){
  document.getElementById('paramsArea').querySelectorAll('.p-row').forEach(row=>{const pk=row.dataset.pkey;if(!pk||pk==='degree')return;row.style.display=parseInt(pk.replace('a',''))<=deg?'':'none';});
}

function applyAndRender(pid,isNewTemplate=false){
  const p=gp(pid); if(!p) return;
  const curve=p.curves[activeCurveIdx]||p.curves[0]; if(!curve||!selTpl)return;
  const params={};
  for(const pk of Object.keys(TEMPLATES[selTpl].params)){const el=document.getElementById(`ps_${pk}`);if(el)params[pk]=parseFloat(el.value);}
  curve.template=selTpl; curve.params=params;
  renderJS(pid,isNewTemplate);
}

// ═══ CORE JS RENDER ══════════════════════════════════════════════════════
function renderJS(pid,firstRender=false){
  const p=gp(pid); if(!p) return;
  let anyData=false,gxMin=null,gxMax=null,gyMin=null,gyMax=null;
  for(const curve of p.curves){
    if(!curve.template) continue;
    const result=evalTemplate(curve.template,curve.params,p.view); if(!result) continue;
    const masked=applyMask(result.x,result.y,curve);
    curve.jsData={x:masked.x,y:masked.y,discrete:result.discrete};
    curve.equation=result.equation; anyData=true;
    if(gxMin===null||result.autoXMin<gxMin)gxMin=result.autoXMin;
    if(gxMax===null||result.autoXMax>gxMax)gxMax=result.autoXMax;
    if(gyMin===null||result.autoYMin<gyMin)gyMin=result.autoYMin;
    if(gyMax===null||result.autoYMax>gyMax)gyMax=result.autoYMax;
  }
  if(!anyData) return;
  if(firstRender||p.view.x_min==null){
    p.view.x_min=gxMin; p.view.x_max=gxMax;
    const yPad=(gyMax-gyMin)*0.08||0.1;
    p.view.y_min=gyMin-yPad; p.view.y_max=gyMax+yPad;
    if(firstRender)chartFirstRender[pid]=true;
  }
  const innerEl=document.getElementById(`cinner_${pid}`); if(!innerEl) return;
  if(!document.getElementById(`chart_${pid}`)){
    innerEl.innerHTML=buildInnerHTML(p);
    setTimeout(()=>{ drawChart(p); wireInteraction(p); wireAxisLabelInputs(p); wireOverlayLegend(p); syncCfgDomain(); updateTopbar(pid); },0);
    return;
  }
  drawChart(p); syncCfgDomain(); refreshOverlayLegend(pid);
}

// ═══ MATPLOTLIB ══════════════════════════════════════════════════════════
async function convertToMpl(pid){
  const p=gp(pid); if(!p||!p.curves.some(c=>c.template)) return;
  p.loading=true; p.converting=true; updateSpinner(pid);
  const curvesPayload=p.curves.filter(c=>c.template).map(c=>({
    template:c.template, params:c.params, line_color:c.line_color, line_width:c.line_width,
    line_style:c.line_style, marker:c.marker, marker_size:c.marker_size,
    fill_under:c.fill_under, fill_alpha:c.fill_alpha,
    label:c.name||(TEMPLATES[c.template]?.label||c.template),
    mask_x_min:c.mask_x_min, mask_x_max:c.mask_x_max,
    mask_y_min:c.mask_y_min, mask_y_max:c.mask_y_max,
  }));
  try{
    const r=await fetch(`${API}/plot`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({curves:curvesPayload,view:p.view,labels:p.labels})});
    const data=await r.json();
    if(data.error) throw new Error(data.error);
    p.mplImage=data.image; p.mplMode=true;
    setConn('ok',`Matplotlib: ${curvesPayload.map(c=>c.label).join(', ')}`);
  }catch(e){ setConn('err','Error: '+e.message); }
  finally{ p.loading=false; p.converting=false; updateCardContent(pid); updateTopbar(pid); updateSpinner(pid); }
}

function revertToJS(pid){
  const p=gp(pid); if(!p) return;
  p.mplMode=false; p.mplImage=null;
  updateCardContent(pid); updateTopbar(pid);
  if(p.curves.some(c=>c.template)) renderJS(pid,false);
}

// ═══ CHART.JS ════════════════════════════════════════════════════════════
function destroyChart(pid){if(chartInstances[pid]){chartInstances[pid].destroy();delete chartInstances[pid];}}

function drawChart(p){
  const canvas=document.getElementById(`chart_${p.id}`); if(!canvas) return;
  const shouldAnimate=!!chartFirstRender[p.id]; if(shouldAnimate)delete chartFirstRender[p.id];
  const v=p.view, animOpts=shouldAnimate?{duration:500,easing:'easeOutQuart'}:{duration:0};
  const scales=buildScales(v);
  const datasets=[]; let hasDiscrete=false;
  for(const curve of p.curves){
    if(!curve.jsData) continue;
    const lc=curve.line_color;
    if(curve.jsData.discrete){
      hasDiscrete=true;
      datasets.push({label:curve.name||(curve.template?TEMPLATES[curve.template]?.label:'Curve'),type:'bar',
        data:curve.jsData.y,backgroundColor:hexAlpha(lc,.7),borderColor:lc,borderWidth:1});
    }else{
      datasets.push({label:curve.name||(curve.template?TEMPLATES[curve.template]?.label:'Curve'),type:'line',
        data:curve.jsData.x.map((xv,i)=>({x:xv,y:curve.jsData.y[i]})),
        borderColor:lc,borderWidth:curve.line_width||2,borderDash:dashFor(curve.line_style),
        pointRadius:curve.marker!=='none'?curve.marker_size||4:0,pointBackgroundColor:lc,
        fill:curve.fill_under,backgroundColor:hexAlpha(lc,curve.fill_alpha||.15),
        tension:0.35,spanGaps:true,parsing:false});
    }
  }
  if(!datasets.length) return;
  if(chartInstances[p.id]&&!shouldAnimate){
    const ch=chartInstances[p.id];
    ch.data.datasets=datasets;
    if(hasDiscrete)ch.data.labels=p.curves.find(c=>c.jsData?.discrete)?.jsData.x.map(n=>n)||[];
    const galpha=v.grid_alpha??0.5, gc=`rgba(60,60,100,${galpha})`;
    ch.options.scales.x.grid.display=v.show_grid; ch.options.scales.x.grid.color=gc;
    ch.options.scales.y.grid.display=v.show_grid; ch.options.scales.y.grid.color=gc;
    ch.options.scales.x.ticks.callback=makeTickCb('x'); ch.options.scales.y.ticks.callback=makeTickCb('y');
    applyScaleLimits(ch.options.scales,v); ch.update('none'); refreshOverlayLegend(p.id); return;
  }
  destroyChart(p.id); const ctx=canvas.getContext('2d');
  if(hasDiscrete){
    const dc=p.curves.find(c=>c.jsData?.discrete);
    chartInstances[p.id]=new Chart(ctx,{type:'bar',data:{labels:dc?.jsData.x.map(n=>n)||[],datasets},
      options:{responsive:true,maintainAspectRatio:true,animation:animOpts,
        plugins:{legend:{display:false},tooltip:tooltipOpts()},scales}});
  }else{
    scales.x.type='linear';
    chartInstances[p.id]=new Chart(ctx,{type:'line',data:{datasets},
      options:{responsive:true,maintainAspectRatio:true,animation:animOpts,
        plugins:{legend:{display:false},tooltip:{...tooltipOpts(),callbacks:{
          title:items=>`x = ${Number(items[0].parsed.x).toFixed(4)}`,
          label:item=>`${item.dataset.label}: y = ${Number(item.parsed.y)?.toFixed(5)??'—'}`,
        }}},scales}});
  }
  refreshOverlayLegend(p.id);
}

function dashFor(ls){return ls==='dashed'?[6,3]:ls==='dotted'?[2,3]:ls==='dashdot'?[6,3,2,3]:[];}

function niceStep(span,targetTicks){
  if(!span||span<=0||!isFinite(span))return 1;
  const rough=span/targetTicks,mag=Math.pow(10,Math.floor(Math.log10(rough))),norm=rough/mag;
  let nice;if(norm<1.5)nice=1;else if(norm<3.5)nice=2;else if(norm<7.5)nice=5;else nice=10;
  return nice*mag;
}
function makeTickCb(axisKey){
  return function(val){
    const span=this.max-this.min,target=axisKey==='x'?8:6,step=niceStep(span,target);
    const rem=Math.abs(val%step),tol=step*1e-6;
    if(rem>tol&&(step-rem)>tol)return null;
    const dec=step>=1?0:Math.max(0,Math.ceil(-Math.log10(step))+1);
    return parseFloat(val.toFixed(dec+2)).toFixed(dec);
  };
}
function buildScales(v){
  const galpha=v.grid_alpha??0.5, gc=`rgba(60,60,100,${galpha})`;
  const s={
    x:{ticks:{color:'#b0b0e0',font:{family:"'IBM Plex Mono'",size:10},maxTicksLimit:12,callback:makeTickCb('x')},grid:{color:gc,display:v.show_grid}},
    y:{ticks:{color:'#b0b0e0',font:{family:"'IBM Plex Mono'",size:10},maxTicksLimit:10,callback:makeTickCb('y')},grid:{color:gc,display:v.show_grid}},
  };
  applyScaleLimits(s,v); return s;
}
function applyScaleLimits(scales,v){
  if(v.x_min!=null)scales.x.min=v.x_min;else delete scales.x.min;
  if(v.x_max!=null)scales.x.max=v.x_max;else delete scales.x.max;
  if(v.y_min!=null)scales.y.min=v.y_min;else delete scales.y.min;
  if(v.y_max!=null)scales.y.max=v.y_max;else delete scales.y.max;
}
function tooltipOpts(){
  return{backgroundColor:'#0c0c18',borderColor:'#252540',borderWidth:1,titleColor:'#d4ff5a',bodyColor:'#d0d0ee',
    titleFont:{family:"'IBM Plex Mono'",size:10},bodyFont:{family:"'IBM Plex Mono'",size:10}};
}
function hexAlpha(hex,a){
  if(!hex||hex.length<7)return `rgba(90,255,206,${a})`;
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}
function sigFig(v,n){if(!isFinite(v))return '—';if(v===0)return '0';return parseFloat(v.toPrecision(n)).toString();}

// ═══ OVERLAY LEGEND ══════════════════════════════════════════════════════
// Draggable box inside canvas-wrap. Position stored as fraction of available space.
// legend_x_frac=0 → left, =1 → right. legend_y_frac=0 → top, =1 → bottom.

function refreshOverlayLegend(pid){
  const p=gp(pid); if(!p) return;
  const wrap=document.getElementById(`cwrap_${pid}`); if(!wrap) return;
  let box=document.getElementById(`olegend_${pid}`);
  const curvesWithData=p.curves.filter(c=>c.jsData||c.template);
  const visible=p.view.show_legend&&curvesWithData.length>0;
  if(!visible){ if(box)box.style.display='none'; return; }
  if(!box){
    box=document.createElement('div'); box.id=`olegend_${pid}`; box.className='overlay-legend';
    wrap.appendChild(box); wireLegendDrag(box,pid);
  }
  box.style.display='block'; box.innerHTML='';
  curvesWithData.forEach(curve=>{
    const label=curve.name||(curve.template?(TEMPLATES[curve.template]?.label||curve.template):'Curve');
    const row=document.createElement('div'); row.className='ol-row';
    const sw=document.createElement('span'); sw.className='ol-swatch'; sw.style.background=curve.line_color;
    const nm=document.createElement('span'); nm.className='ol-label'; nm.textContent=label;
    row.appendChild(sw); row.appendChild(nm); box.appendChild(row);
  });
  // Position after a tick so dimensions are known
  requestAnimationFrame(()=>positionOverlayLegend(box,pid));
}

function positionOverlayLegend(box,pid){
  const p=gp(pid); if(!p||!box) return;
  const wrap=document.getElementById(`cwrap_${pid}`); if(!wrap) return;
  const ww=wrap.offsetWidth, wh=wrap.offsetHeight;
  const bw=box.offsetWidth||100, bh=box.offsetHeight||40;
  const fx=p.view.legend_x_frac??0.98, fy=p.view.legend_y_frac??0.02;
  box.style.left=Math.max(0,Math.min(ww-bw,fx*(ww-bw)))+'px';
  box.style.top =Math.max(0,Math.min(wh-bh,fy*(wh-bh)))+'px';
}

function wireLegendDrag(box,pid){
  let dragging=false,sx=0,sy=0,sl=0,st=0;
  box.addEventListener('mousedown',e=>{
    if(e.target.classList.contains('ol-del'))return;
    dragging=true; sx=e.clientX; sy=e.clientY;
    sl=parseInt(box.style.left)||0; st=parseInt(box.style.top)||0;
    box.classList.add('dragging'); e.preventDefault(); e.stopPropagation();
  });
  window.addEventListener('mousemove',e=>{
    if(!dragging)return;
    const wrap=document.getElementById(`cwrap_${pid}`); if(!wrap)return;
    const ww=wrap.offsetWidth, wh=wrap.offsetHeight, bw=box.offsetWidth, bh=box.offsetHeight;
    const nl=Math.max(0,Math.min(ww-bw,sl+(e.clientX-sx)));
    const nt=Math.max(0,Math.min(wh-bh,st+(e.clientY-sy)));
    box.style.left=nl+'px'; box.style.top=nt+'px';
    const p=gp(pid); if(!p)return;
    p.view.legend_x_frac=(ww-bw)>0?nl/(ww-bw):0;
    p.view.legend_y_frac=(wh-bh)>0?nt/(wh-bh):0;
  });
  window.addEventListener('mouseup',()=>{ if(!dragging)return; dragging=false; box.classList.remove('dragging'); });
}

// ═══ REMOVE CURVE ════════════════════════════════════════════════════════
function removeCurve(pid,idx){
  const p=gp(pid); if(!p) return;
  if(p.curves.length<=1){
    p.curves[0]=defCurve(0); activeCurveIdx=0; selTpl=null;
    destroyChart(pid); updateCardContent(pid); updateTopbar(pid);
    refreshSidebar(); refreshLineCurveSelector(); refreshCfg(); return;
  }
  p.curves.splice(idx,1);
  if(activeCurveIdx>=p.curves.length)activeCurveIdx=p.curves.length-1;
  renderJS(pid,false); updateTopbar(pid); refreshOverlayLegend(pid);
  refreshLineCurveSelector(); refreshSidebar(); refreshCfg();
}

// ═══ PIXEL → DATA ════════════════════════════════════════════════════════
function pixelToData(ch,clientX,clientY){
  const canvas=ch.canvas, rect=canvas.getBoundingClientRect();
  const scaleX=rect.width/canvas.width, scaleY=rect.height/canvas.height;
  const px=(clientX-rect.left)/scaleX, py=(clientY-rect.top)/scaleY;
  const sx=ch.scales.x, sy=ch.scales.y;
  const dataX=sx.min+(sx.max-sx.min)*(px-sx.left)/(sx.right-sx.left);
  const dataY=sy.max-(sy.max-sy.min)*(py-sy.top)/(sy.bottom-sy.top);
  return {dataX,dataY};
}

// ═══ INTERACTIONS ════════════════════════════════════════════════════════
function wireInteraction(p){
  const wrap=document.getElementById(`cwrap_${p.id}`); if(!wrap) return;
  wrap.addEventListener('mousemove',e=>{
    const ch=chartInstances[p.id]; if(!ch)return;
    const {dataX,dataY}=pixelToData(ch,e.clientX,e.clientY);
    const cel=document.getElementById(`coords_${p.id}`);
    if(cel)cel.textContent=`x=${sigFig(dataX,4)}  y=${sigFig(dataY,4)}`;
    if(panState[p.id]?.dragging)onPanMove(e,p);
  });
  wrap.addEventListener('mouseleave',()=>{ const cel=document.getElementById(`coords_${p.id}`); if(cel)cel.textContent='x=—  y=—'; });
  wrap.addEventListener('wheel',e=>{
    e.preventDefault();
    const ch=chartInstances[p.id]; if(!ch)return;
    const {dataX,dataY}=pixelToData(ch,e.clientX,e.clientY);
    const factor=e.deltaY>0?1.15:1/1.15;
    const xMin=p.view.x_min,xMax=p.view.x_max,yMin=p.view.y_min,yMax=p.view.y_max;
    const nxMin=dataX+(xMin-dataX)*factor,nxMax=dataX+(xMax-dataX)*factor;
    const xSO=xMax-xMin,xSN=nxMax-nxMin,ySO=yMax-yMin,ySN=ySO*(xSN/xSO);
    p.view.x_min=nxMin;p.view.x_max=nxMax;
    p.view.y_min=dataY+(yMin-dataY)*(ySN/ySO);p.view.y_max=dataY+(yMax-dataY)*(ySN/ySO);
    applyScaleLimits(ch.options.scales,p.view);ch.update('none');syncCfgDomain();renderJS(p.id,false);
  },{passive:false});
  wrap.addEventListener('mousedown',e=>{
    if(e.button!==0)return;
    if(e.target.closest('.overlay-legend'))return;
    startPan(e,p);
  });
  window.addEventListener('mouseup',()=>endPan(p));
}
function startPan(e,p){
  const wrap=document.getElementById(`cwrap_${p.id}`);
  panState[p.id]={dragging:true,startX:e.clientX,startY:e.clientY};
  if(wrap)wrap.classList.add('panning'); e.preventDefault();
}
function onPanMove(e,p){
  const st=panState[p.id]; if(!st||!st.dragging)return;
  const ch=chartInstances[p.id]; if(!ch)return;
  const rect=ch.canvas.getBoundingClientRect();
  const scaleX=rect.width/ch.canvas.width, scaleY=rect.height/ch.canvas.height;
  const dx=(e.clientX-st.startX)/scaleX, dy=(e.clientY-st.startY)/scaleY;
  st.startX=e.clientX; st.startY=e.clientY;
  const sx=ch.scales.x,sy=ch.scales.y,xPx=sx.right-sx.left,yPx=sy.bottom-sy.top;
  if(!xPx||!yPx)return;
  const dxD=(dx/xPx)*(p.view.x_max-p.view.x_min), dyD=(dy/yPx)*(p.view.y_max-p.view.y_min);
  p.view.x_min-=dxD;p.view.x_max-=dxD;p.view.y_min+=dyD;p.view.y_max+=dyD;
  applyScaleLimits(ch.options.scales,p.view);ch.update('none');syncCfgDomain();renderJS(p.id,false);
}
function endPan(p){
  if(!panState[p.id]?.dragging)return;
  panState[p.id].dragging=false;
  const wrap=document.getElementById(`cwrap_${p.id}`); if(wrap)wrap.classList.remove('panning');
}

// ═══ CONTENT HTML ════════════════════════════════════════════════════════
function buildInnerHTML(p){
  const pid=p.id;
  if(!p.curves.some(c=>c.jsData||c.template))
    return `<div class="plot-empty"><div class="ei">⊹</div><span>Insert Plot</span></div>`;
  if(p.mplMode&&p.mplImage)
    return `<div class="mpl-body"><img class="mpl-img" src="data:image/png;base64,${p.mplImage}" alt="plot"/></div>`;
  const titleVal=p.labels.title||'',xlabelVal=p.labels.xlabel||'',ylabelVal=p.labels.ylabel||'';
  const tpx=Math.max(14,(p.view.title_size||13)+3), lpx=Math.max(12,(p.view.label_size||10)+3);
  return `
    <div class="chart-region" id="cregion_${pid}">
      <input class="chart-title-inp auto-inp" id="ctitleinp_${pid}" type="text"
             value="${titleVal}" placeholder="Title" maxlength="80" style="font-size:${tpx}px"/>
      <div class="canvas-wrap" id="cwrap_${pid}">
        <canvas id="chart_${pid}" style="display:block;width:100%"></canvas>
        <div class="cursor-coords" id="coords_${pid}">x=— y=—</div>
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

function wireOverlayLegend(p){
  refreshOverlayLegend(p.id);
  const wrap=document.getElementById(`cwrap_${p.id}`); if(!wrap) return;
  new ResizeObserver(()=>{ const box=document.getElementById(`olegend_${p.id}`); positionOverlayLegend(box,p.id); }).observe(wrap);
}

// ═══ DOM HELPERS ═════════════════════════════════════════════════════════
function updateCardContent(pid){
  const p=gp(pid); if(!p) return;
  const innerEl=document.getElementById(`cinner_${pid}`); if(!innerEl) return;
  destroyChart(pid); innerEl.innerHTML=buildInnerHTML(p);
  if(!p.mplMode&&p.curves.some(c=>c.jsData)){
    setTimeout(()=>{ drawChart(p); wireInteraction(p); wireAxisLabelInputs(p); wireOverlayLegend(p); },0);
  }
}
function updateTopbar(pid){
  const p=gp(pid); if(!p) return;
  const topEl=document.getElementById(`ctop_${pid}`); if(!topEl) return;
  topEl.innerHTML=buildTopbarInner(p,plots.findIndex(q=>q.id===pid));
}
function updateSpinner(pid){
  const p=gp(pid); if(!p) return;
  const sp=document.getElementById(`spin_${pid}`),sh=document.getElementById(`shim_${pid}`);
  if(sp){sp.classList.toggle('show',p.loading);if(p.loading)sp.querySelector('.spin-lbl').textContent='rendering…';}
  if(sh)sh.classList.toggle('show',!!p.converting);
}

// ═══ FULL DOM RENDER ═════════════════════════════════════════════════════
function renderDOM(){
  for(const p of plots)destroyChart(p.id);
  const list=document.getElementById('plotList'); list.innerHTML='';
  plots.forEach((p,i)=>list.appendChild(buildCard(p,i)));
  const ghost=document.createElement('div'); ghost.className='add-card';
  ghost.innerHTML=`<div class="add-plus">+</div><span>Add new plot</span>`;
  ghost.addEventListener('click',()=>{ const np=mkPlot();plots.push(np);activePid=np.id;activeCurveIdx=0;renderDOM();refreshCfg();refreshSidebar(); });
  list.appendChild(ghost);
  list.addEventListener('click',e=>{ const onCard=e.target.closest('.plot-card'),onGhost=e.target.closest('.add-card'); if(!onCard&&!onGhost){activePid=null;syncActiveHighlight();refreshCfg();refreshSidebar();} });
  refreshCfg(); refreshSidebar();
  setTimeout(()=>{ for(const p of plots){ if(p.curves.some(c=>c.jsData)){drawChart(p);wireInteraction(p);wireAxisLabelInputs(p);wireOverlayLegend(p);} } },0);
}

function buildCard(p,i){
  const card=document.createElement('div');
  card.className='plot-card'+(p.id===activePid?' active':'');
  card.dataset.pid=p.id;
  card.innerHTML=`
    <div class="ctop" id="ctop_${p.id}">${buildTopbarInner(p,i)}</div>
    <div class="cbody" id="cbody_${p.id}">
      <div id="cinner_${p.id}">${buildInnerHTML(p)}</div>
      <div class="spin-overlay${p.loading?' show':''}" id="spin_${p.id}">
        <div class="spinner"></div><div class="spin-lbl">rendering…</div>
      </div>
      <div class="shimmer-overlay${p.converting?' show':''}" id="shim_${p.id}"></div>
    </div>`;

  // Use capture phase so this fires before children can stopPropagation.
  // This ensures clicking ANY button inside the card first activates the card.
  card.addEventListener('click', e=>{
    // Activate card
    if(activePid!==p.id){ activePid=p.id; activeCurveIdx=0; syncActiveHighlight(); refreshCfg(); refreshSidebar(); }
    // Dispatch button actions
    const btn=e.target.closest('[data-action]');
    if(btn) handleAction(btn.dataset.action,parseInt(btn.dataset.pid));
  }, true);

  return card;
}

function buildTopbarInner(p,i){
  const cc=p.curves.filter(c=>c.template).length, canMpl=cc>0;
  const mplBtn=p.mplMode
    ?`<button class="cbtn revert-btn" data-pid="${p.id}" data-action="revert">⟲ interactive</button>`
    :`<button class="cbtn mpl-btn${!canMpl?' mpl-disabled':''}" data-pid="${p.id}" data-action="mpl" ${!canMpl?'disabled':''}>▨ matplotlib</button>`;
  return `
    <span class="cnum">PLOT ${String(i+1).padStart(2,'0')}</span>
    <span class="cnum" style="color:var(--muted)">${cc} curve${cc!==1?'s':''}</span>
    <div class="cactions">${mplBtn}<button class="cbtn" data-pid="${p.id}" data-action="del">✕</button></div>`;
}

const _measureSpan=document.createElement('span');
_measureSpan.style.cssText='position:absolute;visibility:hidden;white-space:pre;pointer-events:none;top:-9999px;left:-9999px';
document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(_measureSpan));

function autoResizeInput(inp,maxPx){
  if(!inp)return;
  const cs=window.getComputedStyle(inp);
  _measureSpan.style.font=cs.font; _measureSpan.style.letterSpacing=cs.letterSpacing;
  _measureSpan.textContent=inp.value||inp.placeholder||'';
  inp.style.width=Math.min(maxPx||9999,Math.max(30,_measureSpan.offsetWidth+16))+'px';
}
function getCanvasDims(pid){const wrap=document.getElementById(`cwrap_${pid}`);return wrap?{w:wrap.offsetWidth,h:wrap.offsetHeight}:{w:300,h:200};}

function wireAxisLabelInputs(p){
  const xi=document.getElementById(`xlabel_${p.id}`),yi=document.getElementById(`ylabel_${p.id}`),ti=document.getElementById(`ctitleinp_${p.id}`);
  const dims=getCanvasDims(p.id);
  function wire(el,setter,maxPx){ if(!el)return; autoResizeInput(el,maxPx); el.addEventListener('input',()=>{setter(el.value);autoResizeInput(el,maxPx);}); el.addEventListener('change',()=>{setter(el.value);autoResizeInput(el,maxPx);}); el.addEventListener('click',e=>e.stopPropagation()); }
  wire(xi,v=>{p.labels.xlabel=v;},dims.w); wire(yi,v=>{p.labels.ylabel=v;},dims.h);
  if(ti){ autoResizeInput(ti,dims.w); ti.addEventListener('input',()=>{p.labels.title=ti.value;autoResizeInput(ti,dims.w);}); ti.addEventListener('change',()=>{p.labels.title=ti.value;autoResizeInput(ti,dims.w);}); ti.addEventListener('click',e=>e.stopPropagation()); ti.addEventListener('keydown',e=>{if(e.key==='Enter')ti.blur();}); }
}

function applyLabelFontSizes(pid){
  const p=gp(pid); if(!p)return;
  const tpx=Math.max(14,(p.view.title_size||13)+3),lpx=Math.max(12,(p.view.label_size||10)+3);
  const dims=getCanvasDims(pid);
  const ti=document.getElementById(`ctitleinp_${pid}`),xi=document.getElementById(`xlabel_${pid}`),yi=document.getElementById(`ylabel_${pid}`);
  if(ti){ti.style.fontSize=tpx+'px';autoResizeInput(ti,dims.w);}
  if(xi){xi.style.fontSize=lpx+'px';autoResizeInput(xi,dims.w);}
  if(yi){yi.style.fontSize=lpx+'px';autoResizeInput(yi,dims.h);}
}

function syncActiveHighlight(){document.querySelectorAll('.plot-card').forEach(c=>c.classList.toggle('active',parseInt(c.dataset.pid)===activePid));}

// ═══ ACTIONS ═════════════════════════════════════════════════════════════
function handleAction(action,pid){
  if(action==='del'){
    destroyChart(pid); plots=plots.filter(p=>p.id!==pid);
    if(activePid===pid){activePid=plots[0]?.id||null;activeCurveIdx=0;}
    if(plots.length===0){const np=mkPlot();plots.push(np);activePid=np.id;}
    renderDOM(); return;
  }
  if(action==='mpl')   {convertToMpl(pid);return;}
  if(action==='revert'){revertToJS(pid);return;}
}

// ═══ CFG PANEL ═══════════════════════════════════════════════════════════
let cfgActiveTab='plot';

function setCfgTab(tab){
  cfgActiveTab=tab;
  document.getElementById('cfgTabPlot')?.classList.toggle('cfg-tab-active',tab==='plot');
  document.getElementById('cfgTabLine')?.classList.toggle('cfg-tab-active',tab==='line');
  document.getElementById('cfgPanePlot')?.style.setProperty('display',tab==='plot'?'flex':'none');
  document.getElementById('cfgPaneLine')?.style.setProperty('display',tab==='line'?'flex':'none');
}

function fmtDomain(v){if(v==null||!isFinite(v))return '';return parseFloat(v.toPrecision(5)).toString();}

function getEffectiveDomain(pid){
  const p=gp(pid); if(!p)return{xMin:0,xMax:1,yMin:0,yMax:1};
  const v=p.view;
  if(v.x_min!=null&&v.x_max!=null&&v.y_min!=null&&v.y_max!=null)
    return{xMin:v.x_min,xMax:v.x_max,yMin:v.y_min,yMax:v.y_max};
  if(p.curves[0]?.template){
    const res=evalTemplate(p.curves[0].template,p.curves[0].params,{});
    if(res){const yp=(res.autoYMax-res.autoYMin)*0.08||0.1;return{xMin:res.autoXMin,xMax:res.autoXMax,yMin:res.autoYMin-yp,yMax:res.autoYMax+yp};}
  }
  return{xMin:0,xMax:1,yMin:0,yMax:1};
}

// ── Line settings: curve selector pills ──────────────────────────────────
function refreshLineCurveSelector(){
  const container=document.getElementById('lineCurveSelector'); if(!container)return;
  const p=activePlot();
  if(!p||!p.curves.some(c=>c.template)){container.innerHTML='';container.style.display='none';return;}
  container.style.display='flex'; container.innerHTML='';
  p.curves.forEach((curve,idx)=>{
    if(!curve.template)return;
    const label=curve.name||(TEMPLATES[curve.template]?.label||`Curve ${idx+1}`);
    const pill=document.createElement('button');
    pill.className='curve-pill'+(idx===activeCurveIdx?' curve-pill-active':'');
    const dot=document.createElement('span'); dot.className='pill-dot'; dot.style.background=curve.line_color;
    const txt=document.createElement('span'); txt.className='pill-label'; txt.textContent=label;
    pill.appendChild(dot); pill.appendChild(txt);
    pill.addEventListener('click',()=>{ activeCurveIdx=idx; refreshLineCurveSelector(); refreshCfg(); });
    container.appendChild(pill);
  });
}

function refreshCfg(){
  const empty=document.getElementById('cfgEmpty'),content=document.getElementById('cfgContent');
  const p=activePid!==null?gp(activePid):null;
  if(!p){empty.style.display='flex';content.style.display='none';return;}
  empty.style.display='none'; content.style.display='flex';
  setCfgTab(cfgActiveTab);
  syncCfgDomain();
  const v=p.view;
  document.getElementById('c_grid').checked=v.show_grid;
  sv('c_galpha',v.grid_alpha??0.5);
  document.getElementById('c_galpha_val').textContent=parseFloat(v.grid_alpha??0.5).toFixed(2);
  sv('c_ts',v.title_size); sv('c_ls2',v.label_size);
  const slEl=document.getElementById('c_show_legend'); if(slEl)slEl.checked=v.show_legend??true;
  updateGridOpacityState(v.show_grid);
  // Line tab
  refreshLineCurveSelector();
  const curve=activeCurve();
  if(curve){
    document.getElementById('c_lc').value=curve.line_color;
    document.getElementById('c_lchex').value=curve.line_color;
    sv('c_lw',curve.line_width);
    document.getElementById('c_lw_val').textContent=parseFloat(curve.line_width).toFixed(1);
    sv('c_ls',curve.line_style); sv('c_mk',curve.marker);
    document.getElementById('c_fill').checked=curve.fill_under;
    const ni=document.getElementById('c_curvename'); if(ni)ni.value=curve.name||'';
    syncDataMaskInputs();
  }
}

// ── Data mask inputs ──────────────────────────────────────────────────────
function syncDataMaskInputs(){
  const curve=activeCurve(),focused=document.activeElement?.id;
  const set=(id,val)=>{ const el=document.getElementById(id); if(el&&el.id!==focused)el.value=val!=null?fmtDomain(val):''; };
  if(!curve){['c_mask_xn','c_mask_xx','c_mask_yn','c_mask_yx'].forEach(id=>{const el=document.getElementById(id);if(el&&el.id!==focused)el.value='';});return;}
  set('c_mask_xn',curve.mask_x_min); set('c_mask_xx',curve.mask_x_max);
  set('c_mask_yn',curve.mask_y_min); set('c_mask_yx',curve.mask_y_max);
}

function commitMaskInput(id,axis,minMax){
  const p=activePlot(); if(!p)return;
  const curve=activeCurve(); if(!curve)return;
  const el=document.getElementById(id); if(!el)return;
  const raw=el.value.trim(), key=`mask_${axis}_${minMax}`;
  if(raw===''){curve[key]=null;}
  else{ const val=parseFloat(raw); if(isNaN(val)){syncDataMaskInputs();return;} curve[key]=val; el.value=fmtDomain(val); }
  if(p.mplMode){clearTimeout(window._mplDebounce);window._mplDebounce=setTimeout(()=>convertToMpl(p.id),350);}
  else renderJS(p.id,false);
}

function updateGridOpacityState(gridOn){
  const row = document.getElementById('c_galpha')?.closest('.crow');
  if(!row) return;
  row.style.opacity = gridOn ? '1' : '0.35';
  row.style.pointerEvents = gridOn ? '' : 'none';
}

function sv(id,val){const el=document.getElementById(id);if(el)el.value=val;}

function commitDomainInput(id,axis,minMax){
  const p=activePid!==null?gp(activePid):null; if(!p)return;
  const el=document.getElementById(id); if(!el)return;
  const raw=el.value.trim();
  if(raw===''){
    const dom=getEffectiveDomain(activePid),cur=axis==='x'?(minMax==='min'?dom.xMin:dom.xMax):(minMax==='min'?dom.yMin:dom.yMax);
    el.value=fmtDomain(cur); p.view[axis+'_'+minMax]=null;
    if(p.mplMode){clearTimeout(window._mplDebounce);window._mplDebounce=setTimeout(()=>convertToMpl(activePid),350);}
    else if(p.curves.some(c=>c.template))renderJS(activePid,false); return;
  }
  const val=parseFloat(raw);
  if(isNaN(val)){const dom=getEffectiveDomain(activePid),cur=axis==='x'?(minMax==='min'?dom.xMin:dom.xMax):(minMax==='min'?dom.yMin:dom.yMax);el.value=fmtDomain(cur);return;}
  p.view[axis+'_'+minMax]=val; el.value=fmtDomain(val);
  if(p.mplMode){clearTimeout(window._mplDebounce);window._mplDebounce=setTimeout(()=>convertToMpl(activePid),350);}
  else if(p.curves.some(c=>c.template))renderJS(activePid,false);
}

function triggerCfgRender(){
  if(activePid===null)return;
  readCfgIntoActive();
  const p=gp(activePid); if(!p)return;
  applyLabelFontSizes(activePid);
  if(p.mplMode){clearTimeout(window._mplDebounce);window._mplDebounce=setTimeout(()=>convertToMpl(activePid),350);}
  else if(p.curves.some(c=>c.jsData))renderJS(activePid,false);
}

function readCfgIntoActive(){
  const p=activePid!==null?gp(activePid):null; if(!p)return;
  const v=p.view;
  v.show_grid  =document.getElementById('c_grid').checked;
  v.grid_alpha =parseFloat(document.getElementById('c_galpha').value)||0.5;
  v.title_size =parseInt(document.getElementById('c_ts').value)||13;
  v.label_size =parseInt(document.getElementById('c_ls2').value)||10;
  v.show_legend=document.getElementById('c_show_legend')?.checked??true;
  const curve=activeCurve();
  if(curve){
    curve.line_color=document.getElementById('c_lc').value;
    curve.line_width=parseFloat(document.getElementById('c_lw').value);
    curve.line_style=document.getElementById('c_ls').value;
    curve.marker    =document.getElementById('c_mk').value;
    curve.fill_under=document.getElementById('c_fill').checked;
    const ni=document.getElementById('c_curvename'); if(ni)curve.name=ni.value;
  }
}

function syncCfgDomain(){
  if(activePid===null)return;
  const p=gp(activePid); if(!p)return;
  const dom=getEffectiveDomain(activePid),focused=document.activeElement?.id;
  const set=(id,val)=>{const el=document.getElementById(id);if(el&&el.id!==focused)el.value=fmtDomain(val);};
  set('c_xn',dom.xMin);set('c_xx',dom.xMax);set('c_yn',dom.yMin);set('c_yx',dom.yMax);
}

function resetDomainToDefault(){const p=activePid!==null?gp(activePid):null;if(!p)return;p.view.x_min=null;p.view.x_max=null;p.view.y_min=null;p.view.y_max=null;renderJS(p.id,true);}

function wireAllCfgInputs(){
  document.getElementById('cfgTabPlot')?.addEventListener('click',()=>setCfgTab('plot'));
  document.getElementById('cfgTabLine')?.addEventListener('click',()=>{setCfgTab('line');refreshLineCurveSelector();});
  document.getElementById('domainHomeBtn')?.addEventListener('click',resetDomainToDefault);
  [['c_xn','x','min'],['c_xx','x','max'],['c_yn','y','min'],['c_yx','y','max']].forEach(([id,axis,mm])=>{
    const el=document.getElementById(id); if(!el)return;
    el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commitDomainInput(id,axis,mm);el.blur();}if(e.key==='Escape'){syncCfgDomain();el.blur();}});
    el.addEventListener('blur',()=>commitDomainInput(id,axis,mm));
  });
  ['c_ts','c_ls2'].forEach(id=>{const el=document.getElementById(id);if(el){el.addEventListener('input',triggerCfgRender);el.addEventListener('change',triggerCfgRender);}});
  document.getElementById('c_grid').addEventListener('change',function(){ updateGridOpacityState(this.checked); triggerCfgRender(); });
  document.getElementById('c_show_legend')?.addEventListener('change',triggerCfgRender);
  document.getElementById('c_galpha').addEventListener('input',function(){document.getElementById('c_galpha_val').textContent=parseFloat(this.value).toFixed(2);triggerCfgRender();});
  ['c_lw','c_ls','c_mk'].forEach(id=>{const el=document.getElementById(id);if(el){el.addEventListener('input',triggerCfgRender);el.addEventListener('change',triggerCfgRender);}});
  document.getElementById('c_lc').addEventListener('input',function(){document.getElementById('c_lchex').value=this.value;triggerCfgRender();refreshOverlayLegend(activePid);refreshLineCurveSelector();});
  document.getElementById('c_lchex').addEventListener('input',function(){if(/^#[0-9a-fA-F]{6}$/.test(this.value)){document.getElementById('c_lc').value=this.value;triggerCfgRender();refreshOverlayLegend(activePid);refreshLineCurveSelector();}});
  document.getElementById('c_lw').addEventListener('input',function(){document.getElementById('c_lw_val').textContent=parseFloat(this.value).toFixed(1);});
  document.getElementById('c_fill').addEventListener('change',triggerCfgRender);
  document.getElementById('c_curvename')?.addEventListener('input',function(){const curve=activeCurve();if(curve){curve.name=this.value;refreshOverlayLegend(activePid);refreshLineCurveSelector();}});
  [['c_mask_xn','x','min'],['c_mask_xx','x','max'],['c_mask_yn','y','min'],['c_mask_yx','y','max']].forEach(([id,axis,mm])=>{
    const el=document.getElementById(id); if(!el)return;
    el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commitMaskInput(id,axis,mm);el.blur();}if(e.key==='Escape'){syncDataMaskInputs();el.blur();}});
    el.addEventListener('blur',()=>commitMaskInput(id,axis,mm));
  });
  document.getElementById('removeCurveBtn')?.addEventListener('click',()=>{
    const p=activePlot(); if(!p) return;
    removeCurve(p.id, activeCurveIdx);
  });
  document.getElementById('addToPlotBtn')?.addEventListener('click',addToPlot);
}

boot();