// ═══ SIDEBAR ═════════════════════════════════════════════════════════════
function refreshSidebar(){
  const noPlot    = document.getElementById('sidebarNoPlot');
  const plotContent = document.getElementById('sidebarPlotContent');
  const p = activePlot();
  if(!p){
    if(noPlot) noPlot.style.display = 'flex';
    if(plotContent) plotContent.style.display = 'none';
    return;
  }
  if(noPlot) noPlot.style.display = 'none';
  if(plotContent) plotContent.style.display = 'flex';
  updateAddToPlotBtn();
  const curve = activeCurve();
  const tkey  = curve?.template || null;
  document.querySelectorAll('.tpl-item').forEach(b => b.classList.toggle('sel', b.dataset.key === tkey));
  if(tkey){
    document.querySelectorAll('.cat-body').forEach(b=>b.classList.remove('open'));
    document.querySelectorAll('.cat-hdr').forEach(h=>h.classList.remove('open'));
    document.querySelectorAll('.subfolder-body').forEach(b=>b.classList.remove('open'));
    document.querySelectorAll('.subfolder-hdr').forEach(h=>h.classList.remove('open'));
    document.querySelectorAll('.cat-hdr').forEach(hdr=>{
      const body = hdr.nextElementSibling;
      if(body?.querySelector(`[data-key="${tkey}"]`)){
        hdr.classList.add('open'); body.classList.add('open');
        body.querySelectorAll('.subfolder-hdr').forEach(sh=>{
          const sb = sh.nextElementSibling;
          if(sb?.querySelector(`[data-key="${tkey}"]`)){ sh.classList.add('open'); sb.classList.add('open'); }
        });
      }
    });
    selTpl = tkey;
    buildParamsForTemplate(tkey, curve.params);
  }else{
    selTpl = null;
    const pa = document.getElementById('paramsArea');
    if(pa) pa.innerHTML = '<div style="font-size:.65rem;color:var(--muted);font-style:italic">Select a template.</div>';
  }
}

function updateAddToPlotBtn(){
  const btn = document.getElementById('addToPlotBtn'); if(!btn) return;
  btn.disabled = !selTpl; btn.classList.toggle('atp-disabled', !selTpl);
}

function buildCategories(){
  const container = document.getElementById('catBlocks');
  container.innerHTML = '';

  // Build grouped structure preserving JSON insertion order.
  // Use arrays for both category order and subfolder order.
  const catOrder    = [];   // category keys in encounter order
  const catMeta     = {};   // cat -> { subfolderOrder:[], subfolders:{name->[items]}, flat:[items] }

  for(const [key,tpl] of Object.entries(TEMPLATES)){
    const cat = tpl.category, sub = tpl.subfolder || null;
    if(!catMeta[cat]){
      catOrder.push(cat);
      catMeta[cat] = { subfolderOrder:[], subfolders:{}, flat:[] };
    }
    const cm = catMeta[cat];
    if(sub){
      if(!cm.subfolders[sub]){ cm.subfolderOrder.push(sub); cm.subfolders[sub]=[]; }
      cm.subfolders[sub].push({key,tpl});
    }else{
      cm.flat.push({key,tpl});
    }
  }

  for(const cat of catOrder){
    const cm   = catMeta[cat];
    const meta = CAT_META[cat] || {label:cat, dotClass:''};
    const wrap = document.createElement('div'); wrap.className = 'cat-wrap';
    const hdr  = document.createElement('button'); hdr.className = 'cat-hdr';
    hdr.innerHTML = `<div class="cat-dot ${meta.dotClass}"></div><span>${meta.label}</span><span class="cat-arrow">›</span>`;
    const body = document.createElement('div'); body.className = 'cat-body';
    const total = cm.subfolderOrder.length + cm.flat.length; let ti = 0;

    cm.subfolderOrder.forEach(subName=>{
      const items = cm.subfolders[subName]; const isLast = (ti===total-1); ti++;
      const sw = document.createElement('div'); sw.className = 'subfolder-wrap';
      const sh = document.createElement('button'); sh.className = 'subfolder-hdr';
      sh.innerHTML = `<span class="tree-connector">${isLast?'└':'├'}</span><span class="sub-label">${subName}</span><span class="sub-arrow">›</span>`;
      const sb = document.createElement('div'); sb.className = 'subfolder-body';
      items.forEach(({key,tpl},idx)=>{
        const btn = document.createElement('button'); btn.className = 'tpl-item sub-item'; btn.dataset.key = key;
        btn.innerHTML = `<span class="tree-connector sub-connector">${idx===items.length-1?'└':'├'}</span><span class="tpl-label">${tpl.label}</span><span class="tpl-eq">${tpl.equation}</span>`;
        btn.addEventListener('click', ()=>selectTemplate(key)); sb.appendChild(btn);
      });
      sh.addEventListener('click', e=>{
        e.stopPropagation();
        const was = sb.classList.contains('open');
        body.querySelectorAll('.subfolder-body').forEach(b=>b.classList.remove('open'));
        body.querySelectorAll('.subfolder-hdr').forEach(h=>h.classList.remove('open'));
        if(!was){ sb.classList.add('open'); sh.classList.add('open'); }
      });
      sw.appendChild(sh); sw.appendChild(sb); body.appendChild(sw);
    });

    cm.flat.forEach(({key,tpl})=>{
      ti++; const isLast = (ti===total);
      const btn = document.createElement('button'); btn.className = 'tpl-item'; btn.dataset.key = key;
      btn.innerHTML = `<span class="tree-connector">${isLast?'└':'├'}</span><span class="tpl-label">${tpl.label}</span><span class="tpl-eq">${tpl.equation}</span>`;
      btn.addEventListener('click', ()=>selectTemplate(key)); body.appendChild(btn);
    });

    hdr.addEventListener('click', ()=>{
      const was = body.classList.contains('open');
      document.querySelectorAll('.cat-body').forEach(b=>b.classList.remove('open'));
      document.querySelectorAll('.cat-hdr').forEach(h=>h.classList.remove('open'));
      if(!was){ body.classList.add('open'); hdr.classList.add('open'); }
    });
    wrap.appendChild(hdr); wrap.appendChild(body); container.appendChild(wrap);
  }
}

// ═══ TEMPLATE SELECTION ══════════════════════════════════════════════════
function selectTemplate(key){
  selTpl = key;
  document.querySelectorAll('.tpl-item').forEach(b=>b.classList.toggle('sel', b.dataset.key===key));
  updateAddToPlotBtn();
  // Load params for the selected template using the active curve's existing param values
  // (if any), but do NOT auto-assign or auto-render — user must click "Add to Plot".
  const curve = activeCurve();
  buildParamsForTemplate(key, curve?.template === key ? curve.params : {});
}

function addToPlot(){
  const p = activePlot(); if(!p||!selTpl) return;
  const autoName = TEMPLATES[selTpl]?.equation || selTpl;
  const curve = activeCurve();
  if(curve && !curve.template){
    curve.template = selTpl;
    if(!curve.name) curve.name = autoName;
    buildParamsForTemplate(selTpl, curve.params);
    p.view.x_min=null; p.view.x_max=null; p.view.y_min=null; p.view.y_max=null;
    applyAndRender(p.id, true); refreshOverlayLegend(p.id); refreshLineCurveSelector(); return;
  }
  const nc = defCurve(p.curves); nc.template = selTpl; nc.name = autoName; p.curves.push(nc);
  activeCurveIdx = p.curves.length - 1;
  buildParamsForTemplate(selTpl, {});
  applyAndRender(p.id, false);
  updateTopbar(p.id); refreshOverlayLegend(p.id); refreshLineCurveSelector(); refreshCfg();
}

// ═══ PARAMETER PANEL ═════════════════════════════════════════════════════
const sliderRanges = {};

function buildParamsForTemplate(key, existingParams){
  const pa = document.getElementById('paramsArea'); pa.innerHTML = '';
  if(!key || !TEMPLATES[key]) return;
  for(const [pk,pd] of Object.entries(TEMPLATES[key].params)){
    const row = document.createElement('div'); row.className = 'p-row'; row.dataset.pkey = pk;
    const val = existingParams?.[pk] ?? pd.default;
    if(!sliderRanges[key]) sliderRanges[key] = {};
    if(!sliderRanges[key][pk]) sliderRanges[key][pk] = {min:pd.min, max:pd.max};
    const {min,max} = sliderRanges[key][pk];
    const sliderStep = niceSliderStep(min, max);
    const dispDecimals = sliderStep >= 1 ? 0 : Math.max(0, Math.ceil(-Math.log10(sliderStep)) + 1);
    const fmt = v => dispDecimals === 0 ? parseInt(v) : parseFloat(v).toFixed(dispDecimals);
    row.innerHTML = `
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
    const vi = row.querySelector(`#pv_${pk}`);
    vi.addEventListener('change', ()=>commitParamValue(pk, vi.value, pd.step));
    vi.addEventListener('keydown', e=>{ if(e.key==='Enter'){commitParamValue(pk,vi.value,pd.step);vi.blur();} });
    vi.addEventListener('click', e=>e.stopPropagation());
    row.querySelectorAll('.p-range-inp').forEach(inp=>{
      inp.addEventListener('change', ()=>commitRangeBound(key,pk,inp.dataset.bound,inp.value,pd.step));
      inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){commitRangeBound(key,pk,inp.dataset.bound,inp.value,pd.step);inp.blur();} });
      inp.addEventListener('click', e=>e.stopPropagation());
    });
  }
  if(key==='poly_custom') updatePolyCoeffVisibility(existingParams?.degree ?? TEMPLATES.poly_custom.params.degree.default);
}

function commitParamValue(pk, raw, step){
  const val = parseFloat(raw); if(isNaN(val)){ syncParamInputFromSlider(pk); return; }
  const slider = document.getElementById(`ps_${pk}`), vi = document.getElementById(`pv_${pk}`); if(!slider) return;
  const sliderStep = parseFloat(slider.step)||0.01;
  const dec = sliderStep>=1 ? 0 : Math.max(0,Math.ceil(-Math.log10(sliderStep))+1);
  const fmt = v => dec===0 ? parseInt(v) : parseFloat(v).toFixed(dec);
  if(val < parseFloat(slider.min)){
    slider.min = val;
    if(selTpl){ if(!sliderRanges[selTpl])sliderRanges[selTpl]={}; if(!sliderRanges[selTpl][pk])sliderRanges[selTpl][pk]={}; sliderRanges[selTpl][pk].min=val; }
    const mi = slider.parentElement.querySelector('[data-bound="min"]'); if(mi) mi.value = fmt(val);
  }
  if(val > parseFloat(slider.max)){
    slider.max = val;
    if(selTpl){ if(!sliderRanges[selTpl])sliderRanges[selTpl]={}; if(!sliderRanges[selTpl][pk])sliderRanges[selTpl][pk]={}; sliderRanges[selTpl][pk].max=val; }
    const ma = slider.parentElement.querySelector('[data-bound="max"]'); if(ma) ma.value = fmt(val);
  }
  slider.value = val; if(vi) vi.value = fmt(val);
  if(selTpl==='poly_custom' && pk==='degree') updatePolyCoeffVisibility(parseInt(val));
  if(activePid!==null) applyAndRender(activePid, false);
}

function commitRangeBound(key, pk, bound, raw, step){
  const val = parseFloat(raw);
  const slider = document.getElementById(`ps_${pk}`);
  const inp = slider?.parentElement?.querySelector(`[data-bound="${bound}"]`);
  if(isNaN(val)||!slider){ if(inp) inp.value = bound==='min' ? slider?.min : slider?.max; return; }
  const sliderStep = parseFloat(slider.step)||0.01;
  const dec = sliderStep>=1 ? 0 : Math.max(0,Math.ceil(-Math.log10(sliderStep))+1);
  const fmt = v => dec===0 ? parseInt(v) : parseFloat(v).toFixed(dec);
  if(bound==='min') slider.min = val; else slider.max = val;
  if(inp) inp.value = fmt(val);
  if(!sliderRanges[key]) sliderRanges[key]={};
  if(!sliderRanges[key][pk]) sliderRanges[key][pk]={};
  sliderRanges[key][pk][bound] = val;
  const newStep = niceSliderStep(parseFloat(slider.min), parseFloat(slider.max));
  slider.step = newStep;
  const cur = parseFloat(slider.value);
  if(bound==='min' && cur<val){ slider.value=val; const vi=document.getElementById(`pv_${pk}`); if(vi) vi.value=fmt(val); }
  if(bound==='max' && cur>val){ slider.value=val; const vi=document.getElementById(`pv_${pk}`); if(vi) vi.value=fmt(val); }
}

function syncParamInputFromSlider(pk){
  const slider = document.getElementById(`ps_${pk}`), vi = document.getElementById(`pv_${pk}`);
  if(slider && vi){
    const step = parseFloat(slider.step)||0.01;
    const dec  = step>=1 ? 0 : Math.max(0,Math.ceil(-Math.log10(step))+1);
    vi.value = dec===0 ? parseInt(slider.value) : parseFloat(slider.value).toFixed(dec);
  }
}

function onParamSlider(pk, val){
  const slider = document.getElementById(`ps_${pk}`);
  const step   = parseFloat(slider?.step)||0.01;
  const dec    = step>=1 ? 0 : Math.max(0,Math.ceil(-Math.log10(step))+1);
  const vi     = document.getElementById(`pv_${pk}`);
  if(vi) vi.value = dec===0 ? parseInt(val) : parseFloat(val).toFixed(dec);
  if(selTpl==='poly_custom' && pk==='degree') updatePolyCoeffVisibility(parseInt(val));
  if(activePid!==null) applyAndRender(activePid, false);
}

function updatePolyCoeffVisibility(deg){
  document.getElementById('paramsArea').querySelectorAll('.p-row').forEach(row=>{
    const pk = row.dataset.pkey;
    if(!pk || pk==='degree') return;
    row.style.display = parseInt(pk.replace('a',''))<=deg ? '' : 'none';
  });
}

function applyAndRender(pid, isNewTemplate=false){
  const p = gp(pid); if(!p) return;
  const curve = p.curves[activeCurveIdx] || p.curves[0]; if(!curve||!selTpl) return;
  const params = {};
  for(const pk of Object.keys(TEMPLATES[selTpl].params)){
    const el = document.getElementById(`ps_${pk}`); if(el) params[pk] = parseFloat(el.value);
  }
  curve.template = selTpl; curve.params = params;
  renderJS(pid, isNewTemplate);
}

// ═══ CORE JS RENDER ══════════════════════════════════════════════════════
function renderJS(pid, firstRender=false){
  const p = gp(pid); if(!p) return;
  let anyData=false, gxMin=null, gxMax=null, gyMin=null, gyMax=null;
  for(const curve of p.curves){
    if(!curve.template) continue;
    const result = evalTemplate(curve.template, curve.params, p.view); if(!result) continue;
    // Adaptive sampling: re-evaluate in high-|dy/dx| regions to preserve narrow peaks
    let sampled = result;
    if(!result.discrete){
      const evalFn = x => {
        const tiny = evalTemplate(curve.template, curve.params, {x_min:x, x_max:x+1e-10});
        return tiny ? tiny.y[0] : null;
      };
      sampled = adaptiveSample(result.x, result.y, evalFn);
    }
    const masked = applyMask(sampled.x, sampled.y, curve);
    const clipped = masked.discrete ? masked : clipForDisplay(masked.x, masked.y);
    curve.jsData = {x:clipped.x, y:clipped.y, discrete:result.discrete};
    curve.equation = result.equation; anyData = true;
    if(gxMin===null||result.autoXMin<gxMin) gxMin=result.autoXMin;
    if(gxMax===null||result.autoXMax>gxMax) gxMax=result.autoXMax;
    if(gyMin===null||result.autoYMin<gyMin) gyMin=result.autoYMin;
    if(gyMax===null||result.autoYMax>gyMax) gyMax=result.autoYMax;
  }
  if(!anyData) return;
  if(firstRender || p.view.x_min==null){
    p.view.x_min = gxMin; p.view.x_max = gxMax;
    const yPad = (gyMax-gyMin)*0.08 || 0.1;
    p.view.y_min = gyMin-yPad; p.view.y_max = gyMax+yPad;
    if(firstRender) chartFirstRender[pid] = true;
  }
  const innerEl = document.getElementById(`cinner_${pid}`); if(!innerEl) return;
  if(!document.getElementById(`chart_${pid}`)){
    innerEl.innerHTML = buildInnerHTML(p);
    setTimeout(()=>{ drawChart(p); wireInteraction(p); wireAxisLabelInputs(p); wireOverlayLegend(p); syncCfgDomain(); updateTopbar(pid); }, 0);
    return;
  }
  drawChart(p); syncCfgDomain(); refreshOverlayLegend(pid);
}

// ═══ CHART.JS RENDERING ══════════════════════════════════════════════════
function destroyChart(pid){
  if(chartInstances[pid]){ chartInstances[pid].destroy(); delete chartInstances[pid]; }
}

function drawChart(p){
  const canvas = document.getElementById(`chart_${p.id}`); if(!canvas) return;
  const shouldAnimate = !!chartFirstRender[p.id]; if(shouldAnimate) delete chartFirstRender[p.id];
  const v = p.view, animOpts = shouldAnimate ? {duration:500,easing:'easeOutQuart'} : {duration:0};
  const scales = buildScales(v);
  const datasets = []; let hasDiscrete = false;
  for(const curve of p.curves){
    if(!curve.jsData) continue;
    const lc = curve.line_color;
    if(curve.jsData.discrete){
      hasDiscrete = true;
      datasets.push({
        label: curve.name || (curve.template ? (TEMPLATES[curve.template]?.equation||'Curve') : 'Curve'),
        type:'bar', data:curve.jsData.y,
        backgroundColor:hexAlpha(lc,.7), borderColor:lc, borderWidth:1,
      });
    }else{
      datasets.push({
        label: curve.name || (curve.template ? (TEMPLATES[curve.template]?.equation||'Curve') : 'Curve'),
        type:'line', data:curve.jsData.x.map((xv,i)=>({x:xv,y:curve.jsData.y[i]})),
        borderColor:lc, borderWidth:borderWidthFor(curve), borderDash:dashFor(curve.line_style),
        pointRadius:curve.marker!=='none' ? curve.marker_size||4 : 0, pointBackgroundColor:lc,
        fill:curve.fill_under, backgroundColor:hexAlpha(lc,curve.fill_alpha||.15),
        tension:0, spanGaps:false, parsing:false,
      });
    }
  }
  if(!datasets.length) return;

  // Axis lines at x=0 and y=0
  const axisDatasets = buildAxisLineDatasets(v);

  if(chartInstances[p.id] && !shouldAnimate){
    const ch = chartInstances[p.id];
    // If scale type changed (log toggle), must destroy and recreate
    const xTypeChanged = ch.options.scales.x.type !== (v.x_log ? 'logarithmic' : 'linear');
    const yTypeChanged = ch.options.scales.y.type !== (v.y_log ? 'logarithmic' : 'linear');
    if(xTypeChanged || yTypeChanged){
      destroyChart(p.id);
      // Fall through to full rebuild below
    } else {
      ch.data.datasets = [...axisDatasets, ...datasets];
      if(hasDiscrete) ch.data.labels = p.curves.find(c=>c.jsData?.discrete)?.jsData.x.map(n=>n) || [];
      const galpha = v.grid_alpha ?? 0.5, gc = `rgba(60,60,100,${galpha})`;
      ch.options.scales.x.grid.display=v.show_grid; ch.options.scales.x.grid.color=gc;
      ch.options.scales.y.grid.display=v.show_grid; ch.options.scales.y.grid.color=gc;
      ch.options.scales.x.ticks.callback = v.x_log ? makeLogTickCb() : makeTickCb('x');
      ch.options.scales.y.ticks.callback = v.y_log ? makeLogTickCb() : makeTickCb('y');
      applyScaleLimits(ch.options.scales, v); ch.update('none'); refreshOverlayLegend(p.id); return;
    }
  }

  destroyChart(p.id); const ctx = canvas.getContext('2d');
  if(hasDiscrete){
    const dc = p.curves.find(c=>c.jsData?.discrete);
    chartInstances[p.id] = new Chart(ctx, {
      type:'bar', data:{labels:dc?.jsData.x.map(n=>n)||[], datasets:[...axisDatasets,...datasets]},
      options:{responsive:true,maintainAspectRatio:true,animation:animOpts,
        plugins:{legend:{display:false},tooltip:tooltipOpts()},scales}
    });
  }else{
    // For continuous plots, override x type from the default 'category' to linear/log
    scales.x.type = v.x_log ? 'logarithmic' : 'linear';
    chartInstances[p.id] = new Chart(ctx, {
      type:'line', data:{datasets:[...axisDatasets,...datasets]},
      options:{responsive:true,maintainAspectRatio:true,animation:animOpts,
        plugins:{legend:{display:false},tooltip:{...tooltipOpts(),callbacks:{
          title:items=>`x = ${Number(items[0].parsed.x).toFixed(4)}`,
          label:item=>item.dataset._axisLine ? null : `${item.dataset.label}: y = ${Number(item.parsed.y)?.toFixed(5)?? '—'}`,
        }}},scales}
    });
  }
  refreshOverlayLegend(p.id);
}

function dashFor(ls){ return ls==='dashed'?[6,3]:ls==='dotted'?[2,3]:ls==='dashdot'?[6,3,2,3]:[]; }
function borderWidthFor(curve){ return curve.line_style==='none' ? 0 : (curve.line_width||2); }

function buildAxisLineDatasets(v){
  if(!v.show_axis_lines) return [];
  const alpha = v.axis_alpha ?? 0.6;
  const color = `rgba(180,180,220,${alpha})`;
  const big = 1e9;
  return [
    { // y=0 line (horizontal)
      type:'line', _axisLine:true, label:'',
      data:[{x:-big,y:0},{x:big,y:0}],
      borderColor:color, borderWidth:1.5, borderDash:[],
      pointRadius:0, fill:false, tension:0, spanGaps:true, parsing:false,
    },
    { // x=0 line (vertical)
      type:'line', _axisLine:true, label:'',
      data:[{x:0,y:-big},{x:0,y:big}],
      borderColor:color, borderWidth:1.5, borderDash:[],
      pointRadius:0, fill:false, tension:0, spanGaps:true, parsing:false,
    },
  ];
}

function makeTickCb(axisKey){
  return function(val, index, ticks){
    const span=this.max-this.min, target=axisKey==='x'?8:6, step=niceStep(span,target);
    const rem=Math.abs(val%step), tol=step*1e-6;
    if(rem>tol && (step-rem)>tol) return null;
    const dec = step>=1 ? 0 : Math.max(0,Math.ceil(-Math.log10(step))+1);
    return parseFloat(val.toFixed(dec+2)).toFixed(dec);
  };
}

function buildScales(v){
  const galpha = v.grid_alpha ?? 0.5, gc = `rgba(60,60,100,${galpha})`;
  const s = {
    x:{
      type: v.x_log ? 'logarithmic' : 'linear',
      border:{ display:true, color:gc },
      ticks:{color:'#b0b0e0',font:{family:"'IBM Plex Mono'",size:10},maxTicksLimit:12,
             callback: v.x_log ? makeLogTickCb() : makeTickCb('x')},
      grid:{color:gc,display:v.show_grid, drawBorder:true},
    },
    y:{
      type: v.y_log ? 'logarithmic' : 'linear',
      border:{ display:true, color:gc },
      ticks:{color:'#b0b0e0',font:{family:"'IBM Plex Mono'",size:10},maxTicksLimit:10,
             callback: v.y_log ? makeLogTickCb() : makeTickCb('y')},
      grid:{color:gc,display:v.show_grid, drawBorder:true},
    },
  };
  applyScaleLimits(s, v); return s;
}

function makeLogTickCb(){
  return function(val){
    // Show labels at powers of 10
    const log = Math.log10(val);
    if(Math.abs(log - Math.round(log)) > 0.01) return null;
    const exp = Math.round(log);
    if(exp === 0) return '1';
    if(exp === 1) return '10';
    return `10^${exp}`;
  };
}

function applyScaleLimits(scales, v){
  if(v.x_min!=null) scales.x.min=v.x_min; else delete scales.x.min;
  if(v.x_max!=null) scales.x.max=v.x_max; else delete scales.x.max;
  if(v.y_min!=null) scales.y.min=v.y_min; else delete scales.y.min;
  if(v.y_max!=null) scales.y.max=v.y_max; else delete scales.y.max;
}

function tooltipOpts(){
  return {
    backgroundColor:'#0c0c18', borderColor:'#252540', borderWidth:1,
    titleColor:'#d4ff5a', bodyColor:'#d0d0ee',
    titleFont:{family:"'IBM Plex Mono'",size:10}, bodyFont:{family:"'IBM Plex Mono'",size:10},
  };
}

function hexAlpha(hex,a){
  if(!hex||hex.length<7) return `rgba(90,255,206,${a})`;
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ═══ CURVE SYMBOL ════════════════════════════════════════════════════════
// Renders a miniature SVG line+marker symbol matching the curve's style.
function makeCurveSymbolSVG(curve, w=32, h=10){
  const c   = curve.line_color;
  const lw  = Math.min(curve.line_width||2, 3);
  const ls  = curve.line_style || 'solid';
  const mk  = curve.marker || 'none';
  const ms  = Math.min(curve.marker_size||4, 5);
  const y   = h/2;
  const x1  = 2, x2 = w-2, xm = w/2;

  let dashAttr = '';
  if(ls==='dashed')  dashAttr = `stroke-dasharray="5,3"`;
  else if(ls==='dotted')  dashAttr = `stroke-dasharray="1,3"`;
  else if(ls==='dashdot') dashAttr = `stroke-dasharray="5,2,1,2"`;

  const lineVis = ls==='none' ? 'visibility="hidden"' : '';

  let markerSVG = '';
  if(mk !== 'none'){
    const r = ms/2;
    if(mk==='o')
      markerSVG = `<circle cx="${xm}" cy="${y}" r="${r}" fill="${c}" stroke="none"/>`;
    else if(mk==='s')
      markerSVG = `<rect x="${xm-r}" y="${y-r}" width="${ms}" height="${ms}" fill="${c}" stroke="none"/>`;
    else if(mk==='^')
      markerSVG = `<polygon points="${xm},${y-r} ${xm-r},${y+r} ${xm+r},${y+r}" fill="${c}" stroke="none"/>`;
    else if(mk==='D')
      markerSVG = `<polygon points="${xm},${y-r} ${xm+r},${y} ${xm},${y+r} ${xm-r},${y}" fill="${c}" stroke="none"/>`;
    else if(mk==='+')
      markerSVG = `<line x1="${xm-r}" y1="${y}" x2="${xm+r}" y2="${y}" stroke="${c}" stroke-width="1.5"/><line x1="${xm}" y1="${y-r}" x2="${xm}" y2="${y+r}" stroke="${c}" stroke-width="1.5"/>`;
    else if(mk==='x')
      markerSVG = `<line x1="${xm-r}" y1="${y-r}" x2="${xm+r}" y2="${y+r}" stroke="${c}" stroke-width="1.5"/><line x1="${xm+r}" y1="${y-r}" x2="${xm-r}" y2="${y+r}" stroke="${c}" stroke-width="1.5"/>`;
    else
      markerSVG = `<circle cx="${xm}" cy="${y}" r="${r}" fill="${c}" stroke="none"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="vertical-align:middle;flex-shrink:0">
    <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${c}" stroke-width="${lw}" ${dashAttr} ${lineVis}/>
    ${markerSVG}
  </svg>`;
}

// ═══ OVERLAY LEGEND ══════════════════════════════════════════════════════
function refreshOverlayLegend(pid){
  const p = gp(pid); if(!p) return;
  const wrap = document.getElementById(`cwrap_${pid}`); if(!wrap) return;
  let box = document.getElementById(`olegend_${pid}`);
  const curvesWithData = p.curves.filter(c=>c.jsData||c.template);
  const visible = p.view.show_legend && curvesWithData.length > 0;
  if(!visible){ if(box) box.style.display='none'; return; }
  if(!box){
    box = document.createElement('div'); box.id = `olegend_${pid}`; box.className = 'overlay-legend';
    wrap.appendChild(box); wireLegendDrag(box, pid);
  }
  const legPx = Math.max(8, (p.view.legend_size ?? 9) + 2); // display px slightly larger than pt
  const symH  = Math.max(8, legPx - 2);
  box.style.display = 'block'; box.innerHTML = '';
  curvesWithData.forEach(curve=>{
    const label = curve.name || (curve.template ? (TEMPLATES[curve.template]?.equation||curve.template) : 'Curve');
    const row = document.createElement('div');
    row.className = 'ol-row';
    row.style.fontSize = legPx + 'px';
    const swrap = document.createElement('span'); swrap.className = 'ol-swatch';
    swrap.innerHTML = makeCurveSymbolSVG(curve, 32, symH);
    const nm  = document.createElement('span'); nm.className = 'ol-label'; nm.textContent = label;
    row.appendChild(swrap); row.appendChild(nm); box.appendChild(row);
  });
  requestAnimationFrame(()=>positionOverlayLegend(box, pid));
}

function positionOverlayLegend(box, pid){
  const p = gp(pid); if(!p||!box) return;
  const wrap = document.getElementById(`cwrap_${pid}`); if(!wrap) return;
  const ww=wrap.offsetWidth, wh=wrap.offsetHeight;
  const bw=box.offsetWidth||100, bh=box.offsetHeight||40;
  const fx=p.view.legend_x_frac ?? 0.98, fy=p.view.legend_y_frac ?? 0.02;
  box.style.left = Math.max(0, Math.min(ww-bw, fx*(ww-bw))) + 'px';
  box.style.top  = Math.max(0, Math.min(wh-bh, fy*(wh-bh))) + 'px';
}

function wireLegendDrag(box, pid){
  let dragging=false, sx=0, sy=0, sl=0, st=0;
  box.addEventListener('mousedown', e=>{
    if(e.target.classList.contains('ol-del')) return;
    dragging=true; sx=e.clientX; sy=e.clientY;
    sl=parseInt(box.style.left)||0; st=parseInt(box.style.top)||0;
    box.classList.add('dragging'); e.preventDefault(); e.stopPropagation();
  });
  window.addEventListener('mousemove', e=>{
    if(!dragging) return;
    const wrap = document.getElementById(`cwrap_${pid}`); if(!wrap) return;
    const ww=wrap.offsetWidth, wh=wrap.offsetHeight, bw=box.offsetWidth, bh=box.offsetHeight;
    const nl = Math.max(0, Math.min(ww-bw, sl+(e.clientX-sx)));
    const nt = Math.max(0, Math.min(wh-bh, st+(e.clientY-sy)));
    box.style.left = nl+'px'; box.style.top = nt+'px';
    const p = gp(pid); if(!p) return;
    p.view.legend_x_frac = (ww-bw)>0 ? nl/(ww-bw) : 0;
    p.view.legend_y_frac = (wh-bh)>0 ? nt/(wh-bh) : 0;
  });
  window.addEventListener('mouseup', ()=>{ if(!dragging) return; dragging=false; box.classList.remove('dragging'); });
}

function wireOverlayLegend(p){
  refreshOverlayLegend(p.id);
  const wrap = document.getElementById(`cwrap_${p.id}`); if(!wrap) return;
  new ResizeObserver(()=>{
    const box = document.getElementById(`olegend_${p.id}`);
    positionOverlayLegend(box, p.id);
  }).observe(wrap);
}

// ═══ REMOVE CURVE ════════════════════════════════════════════════════════
function removeCurve(pid, idx){
  const p = gp(pid); if(!p) return;
  if(p.curves.length <= 1){
    p.curves[0] = defCurve([]); activeCurveIdx=0; selTpl=null;
    destroyChart(pid); updateCardContent(pid); updateTopbar(pid);
    refreshSidebar(); refreshLineCurveSelector(); refreshCfg(); return;
  }
  p.curves.splice(idx, 1);
  if(activeCurveIdx >= p.curves.length) activeCurveIdx = p.curves.length-1;
  renderJS(pid, false); updateTopbar(pid); refreshOverlayLegend(pid);
  refreshLineCurveSelector(); refreshSidebar(); refreshCfg();
}

// ═══ CHART INTERACTIONS ══════════════════════════════════════════════════
function pixelToData(ch, clientX, clientY){
  const canvas=ch.canvas, rect=canvas.getBoundingClientRect();
  const scaleX=rect.width/canvas.width, scaleY=rect.height/canvas.height;
  const px=(clientX-rect.left)/scaleX, py=(clientY-rect.top)/scaleY;
  const sx=ch.scales.x, sy=ch.scales.y;
  return {
    dataX: sx.min + (sx.max-sx.min)*(px-sx.left)/(sx.right-sx.left),
    dataY: sy.max - (sy.max-sy.min)*(py-sy.top)/(sy.bottom-sy.top),
  };
}

function wireInteraction(p){
  const wrap = document.getElementById(`cwrap_${p.id}`); if(!wrap) return;
  wrap.addEventListener('mousemove', e=>{
    const ch = chartInstances[p.id]; if(!ch) return;
    const {dataX,dataY} = pixelToData(ch, e.clientX, e.clientY);
    const cel = document.getElementById(`coords_${p.id}`);
    if(cel) cel.textContent = `x=${sigFig(dataX,4)}  y=${sigFig(dataY,4)}`;
    if(panState[p.id]?.dragging) onPanMove(e, p);
  });
  wrap.addEventListener('mouseleave', ()=>{
    const cel = document.getElementById(`coords_${p.id}`); if(cel) cel.textContent='x=—  y=—';
  });
  wrap.addEventListener('wheel', e=>{
    e.preventDefault();
    const ch = chartInstances[p.id]; if(!ch) return;
    const {dataX,dataY} = pixelToData(ch, e.clientX, e.clientY);
    const factor = e.deltaY>0 ? 1.15 : 1/1.15;
    const xMin=p.view.x_min, xMax=p.view.x_max, yMin=p.view.y_min, yMax=p.view.y_max;
    const nxMin=dataX+(xMin-dataX)*factor, nxMax=dataX+(xMax-dataX)*factor;
    const xSO=xMax-xMin, xSN=nxMax-nxMin, ySO=yMax-yMin, ySN=ySO*(xSN/xSO);
    p.view.x_min=nxMin; p.view.x_max=nxMax;
    p.view.y_min=dataY+(yMin-dataY)*(ySN/ySO); p.view.y_max=dataY+(yMax-dataY)*(ySN/ySO);
    applyScaleLimits(ch.options.scales, p.view); ch.update('none'); syncCfgDomain(); renderJS(p.id, false);
  }, {passive:false});
  wrap.addEventListener('mousedown', e=>{
    if(e.button!==0) return;
    if(e.target.closest('.overlay-legend')) return;
    startPan(e, p);
  });
  window.addEventListener('mouseup', ()=>endPan(p));
}

function startPan(e, p){
  const wrap = document.getElementById(`cwrap_${p.id}`);
  panState[p.id] = {dragging:true, startX:e.clientX, startY:e.clientY};
  if(wrap) wrap.classList.add('panning'); e.preventDefault();
}

function onPanMove(e, p){
  const st = panState[p.id]; if(!st||!st.dragging) return;
  const ch = chartInstances[p.id]; if(!ch) return;
  const rect   = ch.canvas.getBoundingClientRect();
  const scaleX = rect.width/ch.canvas.width, scaleY = rect.height/ch.canvas.height;
  const dx=(e.clientX-st.startX)/scaleX, dy=(e.clientY-st.startY)/scaleY;
  st.startX=e.clientX; st.startY=e.clientY;
  const sx=ch.scales.x, sy=ch.scales.y, xPx=sx.right-sx.left, yPx=sy.bottom-sy.top;
  if(!xPx||!yPx) return;
  const dxD=(dx/xPx)*(p.view.x_max-p.view.x_min), dyD=(dy/yPx)*(p.view.y_max-p.view.y_min);
  p.view.x_min-=dxD; p.view.x_max-=dxD; p.view.y_min+=dyD; p.view.y_max+=dyD;
  applyScaleLimits(ch.options.scales, p.view); ch.update('none'); syncCfgDomain(); renderJS(p.id, false);
}

function endPan(p){
  if(!panState[p.id]?.dragging) return;
  panState[p.id].dragging = false;
  const wrap = document.getElementById(`cwrap_${p.id}`); if(wrap) wrap.classList.remove('panning');
}

// ═══ CARD / PLOT HTML ════════════════════════════════════════════════════
function buildInnerHTML(p){
  const pid = p.id;
  if(!p.curves.some(c=>c.jsData||c.template))
    return `<div class="plot-empty"><div class="ei">⊹</div><span>Insert Plot</span></div>`;
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

function updateCardContent(pid){
  const p = gp(pid); if(!p) return;
  const innerEl = document.getElementById(`cinner_${pid}`); if(!innerEl) return;
  destroyChart(pid); innerEl.innerHTML = buildInnerHTML(p);
  if(!p.mplMode && p.curves.some(c=>c.jsData)){
    setTimeout(()=>{ drawChart(p); wireInteraction(p); wireAxisLabelInputs(p); wireOverlayLegend(p); }, 0);
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
    renderDOM(); refreshCfg(); refreshSidebar();
  });
  list.appendChild(ghost);
  list.addEventListener('click', e=>{
    const onCard=e.target.closest('.plot-card'), onGhost=e.target.closest('.add-card');
    if(!onCard && !onGhost){ activePid=null; syncActiveHighlight(); refreshCfg(); refreshSidebar(); }
  });
  refreshCfg(); refreshSidebar();
  setTimeout(()=>{
    for(const p of plots){
      if(p.curves.some(c=>c.jsData)){ drawChart(p); wireInteraction(p); wireAxisLabelInputs(p); wireOverlayLegend(p); }
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
    if(btn) handleAction(btn.dataset.action, parseInt(btn.dataset.pid));
  }, true);
  return card;
}

function buildTopbarInner(p, i){
  const cc = p.curves.filter(c=>c.template).length, canMpl = cc>0;
  const mplBtn = p.mplMode
    ? `<button class="cbtn revert-btn" data-pid="${p.id}" data-action="revert">⟲ interactive</button>`
    : `<button class="cbtn mpl-btn${!canMpl?' mpl-disabled':''}" data-pid="${p.id}" data-action="mpl" ${!canMpl?'disabled':''}>▨ matplotlib</button>`;
  return `
    <span class="ctitle-text">Plot ${i+1} <span class="ctitle-curves">(${cc} curve${cc!==1?'s':''})</span></span>
    <div class="cactions">
      ${mplBtn}
      <button class="cbtn dup-btn" data-pid="${p.id}" data-action="dup" title="Duplicate plot">⧉</button>
      <button class="cbtn" data-pid="${p.id}" data-action="del">✕</button>
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

function handleAction(action, pid){
  if(action==='dup')  { duplicatePlot(pid); return; }
  if(action==='del'){
    destroyChart(pid); plots = plots.filter(p=>p.id!==pid);
    if(activePid===pid){ activePid=plots[0]?.id||null; activeCurveIdx=0; }
    if(plots.length===0){ const np=mkPlot(); plots.push(np); activePid=np.id; }
    renderDOM(); return;
  }
  if(action==='mpl')    { convertToMpl(pid); return; }
  if(action==='revert') { revertToJS(pid);   return; }
}

// ═══ CFG PANEL ═══════════════════════════════════════════════════════════
let cfgActiveTab = 'plot';

function setCfgTab(tab){
  cfgActiveTab = tab;
  document.getElementById('cfgTabPlot')?.classList.toggle('cfg-tab-active', tab==='plot');
  document.getElementById('cfgTabLine')?.classList.toggle('cfg-tab-active', tab==='line');
  document.getElementById('cfgPanePlot')?.style.setProperty('display', tab==='plot'?'flex':'none');
  document.getElementById('cfgPaneLine')?.style.setProperty('display', tab==='line'?'flex':'none');
}

function fmtDomain(v){ if(v==null||!isFinite(v)) return ''; return parseFloat(v.toPrecision(5)).toString(); }

function getEffectiveDomain(pid){
  const p = gp(pid); if(!p) return {xMin:0,xMax:1,yMin:0,yMax:1};
  const v = p.view;
  if(v.x_min!=null && v.x_max!=null && v.y_min!=null && v.y_max!=null)
    return {xMin:v.x_min, xMax:v.x_max, yMin:v.y_min, yMax:v.y_max};
  if(p.curves[0]?.template){
    const res = evalTemplate(p.curves[0].template, p.curves[0].params, {});
    if(res){ const yp=(res.autoYMax-res.autoYMin)*0.08||0.1; return {xMin:res.autoXMin,xMax:res.autoXMax,yMin:res.autoYMin-yp,yMax:res.autoYMax+yp}; }
  }
  return {xMin:0,xMax:1,yMin:0,yMax:1};
}

function refreshLineCurveSelector(){
  const container = document.getElementById('lineCurveSelector'); if(!container) return;
  const p = activePlot();
  if(!p || !p.curves.some(c=>c.template)){ container.innerHTML=''; container.style.display='none'; return; }
  container.style.display = 'flex'; container.innerHTML = '';

  let dragSrcIdx = null;

  p.curves.forEach((curve, idx)=>{
    if(!curve.template) return;
    const label = curve.name || (TEMPLATES[curve.template]?.label || `Curve ${idx+1}`);

    const pill = document.createElement('div');
    pill.className = 'curve-pill' + (idx===activeCurveIdx ? ' curve-pill-active' : '');
    pill.dataset.idx = idx;
    pill.draggable = true;

    const handle = document.createElement('span');
    handle.className = 'pill-drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Drag to reorder';

    const symWrap = document.createElement('span');
    symWrap.className = 'pill-sym';
    symWrap.innerHTML = makeCurveSymbolSVG(curve, 28, 10);

    // Inline name input — required, falls back to equation as placeholder
    const autoName = TEMPLATES[curve.template]?.equation || `Curve ${idx+1}`;
    const nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.className = 'pill-name-inp';
    nameInp.value = curve.name || autoName;
    nameInp.maxLength = 40;

    let nameOnFocus = '';  // snapshot taken when user starts editing

    nameInp.addEventListener('focus', ()=>{
      nameOnFocus = nameInp.value;
    });
    nameInp.addEventListener('click', e=>e.stopPropagation());
    nameInp.addEventListener('input', ()=>{
      curve.name = nameInp.value || autoName;
      refreshOverlayLegend(p.id);
    });
    nameInp.addEventListener('blur', ()=>{
      // Enforce non-empty: if blank, restore to pre-edit value (or autoName)
      if(!nameInp.value.trim()){
        const fallback = nameOnFocus.trim() || autoName;
        nameInp.value = fallback;
        curve.name = fallback;
        refreshOverlayLegend(p.id);
      } else {
        curve.name = nameInp.value;
      }
    });
    nameInp.addEventListener('keydown', e=>{ if(e.key==='Enter') nameInp.blur(); e.stopPropagation(); });

    // X delete button, right-justified
    const delBtn = document.createElement('button');
    delBtn.className = 'pill-del-btn';
    delBtn.textContent = '✕';
    delBtn.title = 'Remove curve';
    delBtn.addEventListener('click', e=>{
      e.stopPropagation();
      const ap = activePlot(); if(!ap) return;
      removeCurve(ap.id, idx);
    });

    pill.appendChild(handle);
    pill.appendChild(symWrap);
    pill.appendChild(nameInp);
    pill.appendChild(delBtn);

    // Select curve on click (but not when dragging or clicking name/del)
    pill.addEventListener('click', e=>{
      if(e.target === handle || e.target === nameInp || e.target === delBtn) return;
      activeCurveIdx = idx; refreshLineCurveSelector(); refreshCfg();
    });

    // Drag-to-reorder
    pill.addEventListener('dragstart', e=>{
      dragSrcIdx = idx;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(()=>pill.style.opacity='0.4', 0);
    });
    pill.addEventListener('dragend', ()=>{
      pill.style.opacity='';
      container.querySelectorAll('.curve-pill').forEach(p=>p.classList.remove('drag-over'));
    });
    pill.addEventListener('dragover', e=>{
      e.preventDefault(); e.dataTransfer.dropEffect='move';
      pill.classList.add('drag-over');
    });
    pill.addEventListener('dragleave', ()=>pill.classList.remove('drag-over'));
    pill.addEventListener('drop', e=>{
      e.preventDefault();
      pill.classList.remove('drag-over');
      const destIdx = parseInt(pill.dataset.idx);
      if(dragSrcIdx === null || dragSrcIdx === destIdx) return;
      const ap = activePlot(); if(!ap) return;
      // Reorder curves array
      const [moved] = ap.curves.splice(dragSrcIdx, 1);
      ap.curves.splice(destIdx, 0, moved);
      // Update activeCurveIdx to follow the moved curve
      if(activeCurveIdx === dragSrcIdx) activeCurveIdx = destIdx;
      else if(activeCurveIdx > dragSrcIdx && activeCurveIdx <= destIdx) activeCurveIdx--;
      else if(activeCurveIdx < dragSrcIdx && activeCurveIdx >= destIdx) activeCurveIdx++;
      dragSrcIdx = null;
      refreshLineCurveSelector();
      refreshOverlayLegend(ap.id);
      if(ap.mplMode){ clearTimeout(window._mplDebounce); window._mplDebounce=setTimeout(()=>convertToMpl(ap.id),350); }
    });

    container.appendChild(pill);
  });
}

function refreshCfg(){
  const empty=document.getElementById('cfgEmpty'), content=document.getElementById('cfgContent');
  const p = activePid!==null ? gp(activePid) : null;
  if(!p){ empty.style.display='flex'; content.style.display='none'; return; }
  empty.style.display='none'; content.style.display='flex';
  setCfgTab(cfgActiveTab);
  syncCfgDomain();
  const v = p.view;
  document.getElementById('c_grid').checked = v.show_grid;
  sv('c_galpha', v.grid_alpha ?? 0.5);
  document.getElementById('c_galpha_val').textContent = Math.round((v.grid_alpha ?? 0.5)*100)+'%';
  const axEl = document.getElementById('c_axis_lines'); if(axEl) axEl.checked = v.show_axis_lines ?? true;
  sv('c_aalpha', v.axis_alpha ?? 1.0);
  document.getElementById('c_aalpha_val').textContent = Math.round((v.axis_alpha ?? 1.0)*100)+'%';
  const xlEl = document.getElementById('c_x_log'); if(xlEl) xlEl.checked = v.x_log ?? false;
  const ylEl = document.getElementById('c_y_log'); if(ylEl) ylEl.checked = v.y_log ?? false;
  sv('c_ts', v.title_size); sv('c_ls2', v.label_size);
  sv('c_legend_size', v.legend_size ?? 9);
  const slEl = document.getElementById('c_show_legend'); if(slEl) slEl.checked = v.show_legend ?? true;
  updateGridOpacityState(v.show_grid);
  updateAxisOpacityState(v.show_axis_lines ?? true);
  updateLegendOpacityState(v.show_legend ?? true);
  refreshLineCurveSelector();
  const curve = activeCurve();
  if(curve){
    document.getElementById('c_lc').value = curve.line_color;
    document.getElementById('c_lchex').value = curve.line_color;
    sv('c_lw', curve.line_width);
    document.getElementById('c_lw_val').textContent = parseFloat(curve.line_width).toFixed(1);
    sv('c_ls', curve.line_style); sv('c_mk', curve.marker);
    syncDataMaskInputs();
  }
}

function syncDataMaskInputs(){
  const curve=activeCurve(), focused=document.activeElement?.id;
  const set=(id,val)=>{ const el=document.getElementById(id); if(el&&el.id!==focused) el.value=val!=null?fmtDomain(val):''; };
  if(!curve){ ['c_mask_xn','c_mask_xx','c_mask_yn','c_mask_yx'].forEach(id=>{ const el=document.getElementById(id); if(el&&el.id!==focused) el.value=''; }); return; }
  set('c_mask_xn', curve.mask_x_min); set('c_mask_xx', curve.mask_x_max);
  set('c_mask_yn', curve.mask_y_min); set('c_mask_yx', curve.mask_y_max);
}

function commitMaskInput(id, axis, minMax){
  const p = activePlot(); if(!p) return;
  const curve = activeCurve(); if(!curve) return;
  const el = document.getElementById(id); if(!el) return;
  const raw = el.value.trim(), key = `mask_${axis}_${minMax}`;
  if(raw==='') curve[key]=null;
  else{ const val=parseFloat(raw); if(isNaN(val)){ syncDataMaskInputs(); return; } curve[key]=val; el.value=fmtDomain(val); }
  if(p.mplMode){ clearTimeout(window._mplDebounce); window._mplDebounce=setTimeout(()=>convertToMpl(p.id),350); }
  else renderJS(p.id, false);
}

function updateGridOpacityState(gridOn){
  const row = document.getElementById('row_galpha');
  if(!row) return;
  row.style.opacity = gridOn ? '1' : '0.35';
  row.style.pointerEvents = gridOn ? '' : 'none';
}

function updateAxisOpacityState(axisOn){
  const row = document.getElementById('row_aalpha');
  if(!row) return;
  row.style.opacity = axisOn ? '1' : '0.35';
  row.style.pointerEvents = axisOn ? '' : 'none';
}

function updateLegendOpacityState(legendOn){
  const row = document.getElementById('row_legend_size');
  if(!row) return;
  row.style.opacity = legendOn ? '1' : '0.35';
  row.style.pointerEvents = legendOn ? '' : 'none';
}

function sv(id, val){ const el=document.getElementById(id); if(el) el.value=val; }

function commitDomainInput(id, axis, minMax){
  const p = activePid!==null ? gp(activePid) : null; if(!p) return;
  const el = document.getElementById(id); if(!el) return;
  const raw = el.value.trim();
  if(raw===''){
    const dom=getEffectiveDomain(activePid), cur=axis==='x'?(minMax==='min'?dom.xMin:dom.xMax):(minMax==='min'?dom.yMin:dom.yMax);
    el.value=fmtDomain(cur); p.view[axis+'_'+minMax]=null;
    if(p.mplMode){ clearTimeout(window._mplDebounce); window._mplDebounce=setTimeout(()=>convertToMpl(activePid),350); }
    else if(p.curves.some(c=>c.template)) renderJS(activePid, false); return;
  }
  const val = parseFloat(raw);
  if(isNaN(val)){
    const dom=getEffectiveDomain(activePid), cur=axis==='x'?(minMax==='min'?dom.xMin:dom.xMax):(minMax==='min'?dom.yMin:dom.yMax);
    el.value=fmtDomain(cur); return;
  }
  p.view[axis+'_'+minMax] = val; el.value=fmtDomain(val);
  if(p.mplMode){ clearTimeout(window._mplDebounce); window._mplDebounce=setTimeout(()=>convertToMpl(activePid),350); }
  else if(p.curves.some(c=>c.template)) renderJS(activePid, false);
}

function triggerCfgRender(){
  if(activePid===null) return;
  readCfgIntoActive();
  const p = gp(activePid); if(!p) return;
  applyLabelFontSizes(activePid);
  if(p.mplMode){ clearTimeout(window._mplDebounce); window._mplDebounce=setTimeout(()=>convertToMpl(activePid),350); }
  else if(p.curves.some(c=>c.jsData)) renderJS(activePid, false);
}

function readCfgIntoActive(){
  const p = activePid!==null ? gp(activePid) : null; if(!p) return;
  const v = p.view;
  v.show_grid        = document.getElementById('c_grid').checked;
  v.grid_alpha       = parseFloat(document.getElementById('c_galpha').value) || 0.5;
  v.show_axis_lines  = document.getElementById('c_axis_lines')?.checked ?? true;
  v.axis_alpha       = parseFloat(document.getElementById('c_aalpha')?.value) || 1.0;
  v.x_log            = document.getElementById('c_x_log')?.checked ?? false;
  v.y_log            = document.getElementById('c_y_log')?.checked ?? false;
  v.title_size       = parseInt(document.getElementById('c_ts').value) || 13;
  v.label_size       = parseInt(document.getElementById('c_ls2').value) || 10;
  v.legend_size      = parseInt(document.getElementById('c_legend_size')?.value) || 9;
  v.show_legend      = document.getElementById('c_show_legend')?.checked ?? true;
  const curve = activeCurve();
  if(curve){
    curve.line_color = document.getElementById('c_lc').value;
    curve.line_width = parseFloat(document.getElementById('c_lw').value);
    curve.line_style = document.getElementById('c_ls').value;
    curve.marker     = document.getElementById('c_mk').value;
  }
}

function syncCfgDomain(){
  if(activePid===null) return;
  const p = gp(activePid); if(!p) return;
  const dom=getEffectiveDomain(activePid), focused=document.activeElement?.id;
  const set=(id,val)=>{ const el=document.getElementById(id); if(el&&el.id!==focused) el.value=fmtDomain(val); };
  set('c_xn',dom.xMin); set('c_xx',dom.xMax); set('c_yn',dom.yMin); set('c_yx',dom.yMax);
}

function resetDomainToDefault(){
  const p = activePid!==null ? gp(activePid) : null; if(!p) return;
  p.view.x_min=null; p.view.x_max=null; p.view.y_min=null; p.view.y_max=null;
  renderJS(p.id, true);
}

function wireAllCfgInputs(){
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

  document.getElementById('cfgTabPlot')?.addEventListener('click', ()=>setCfgTab('plot'));
  document.getElementById('cfgTabLine')?.addEventListener('click', ()=>{ setCfgTab('line'); refreshLineCurveSelector(); });
  document.getElementById('domainHomeBtn')?.addEventListener('click', resetDomainToDefault);

  [['c_xn','x','min'],['c_xx','x','max'],['c_yn','y','min'],['c_yx','y','max']].forEach(([id,axis,mm])=>{
    const el = document.getElementById(id); if(!el) return;
    el.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();commitDomainInput(id,axis,mm);el.blur();} if(e.key==='Escape'){syncCfgDomain();el.blur();} });
    el.addEventListener('blur', ()=>commitDomainInput(id,axis,mm));
  });

  ['c_ts','c_ls2','c_legend_size'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.addEventListener('input',triggerCfgRender); el.addEventListener('change',triggerCfgRender); } });
  document.getElementById('c_grid').addEventListener('change', function(){ updateGridOpacityState(this.checked); triggerCfgRender(); });
  document.getElementById('c_axis_lines')?.addEventListener('change', function(){ updateAxisOpacityState(this.checked); triggerCfgRender(); });
  document.getElementById('c_show_legend')?.addEventListener('change', function(){ updateLegendOpacityState(this.checked); triggerCfgRender(); });
  document.getElementById('c_x_log')?.addEventListener('change', triggerCfgRender);
  document.getElementById('c_y_log')?.addEventListener('change', triggerCfgRender);
  document.getElementById('c_galpha').addEventListener('input', function(){ document.getElementById('c_galpha_val').textContent=Math.round(parseFloat(this.value)*100)+'%'; triggerCfgRender(); });
  document.getElementById('c_aalpha')?.addEventListener('input', function(){ document.getElementById('c_aalpha_val').textContent=Math.round(parseFloat(this.value)*100)+'%'; triggerCfgRender(); });

  ['c_lw','c_ls','c_mk'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.addEventListener('input',triggerCfgRender); el.addEventListener('change',triggerCfgRender); } });
  document.getElementById('c_lc').addEventListener('input', function(){ document.getElementById('c_lchex').value=this.value; triggerCfgRender(); refreshOverlayLegend(activePid); refreshLineCurveSelector(); });
  document.getElementById('c_lchex').addEventListener('input', function(){ if(/^#[0-9a-fA-F]{6}$/.test(this.value)){ document.getElementById('c_lc').value=this.value; triggerCfgRender(); refreshOverlayLegend(activePid); refreshLineCurveSelector(); } });
  document.getElementById('c_lw').addEventListener('input', function(){ document.getElementById('c_lw_val').textContent=parseFloat(this.value).toFixed(1); });

  [['c_mask_xn','x','min'],['c_mask_xx','x','max'],['c_mask_yn','y','min'],['c_mask_yx','y','max']].forEach(([id,axis,mm])=>{
    const el = document.getElementById(id); if(!el) return;
    el.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();commitMaskInput(id,axis,mm);el.blur();} if(e.key==='Escape'){syncDataMaskInputs();el.blur();} });
    el.addEventListener('blur', ()=>commitMaskInput(id,axis,mm));
  });

  document.getElementById('maskResetBtn')?.addEventListener('click', ()=>{
    const p = activePlot(); if(!p) return;
    const curve = activeCurve(); if(!curve) return;
    curve.mask_x_min=null; curve.mask_x_max=null; curve.mask_y_min=null; curve.mask_y_max=null;
    syncDataMaskInputs();
    if(p.mplMode){ clearTimeout(window._mplDebounce); window._mplDebounce=setTimeout(()=>convertToMpl(p.id),350); }
    else renderJS(p.id, false);
  });

  document.getElementById('addToPlotBtn')?.addEventListener('click', addToPlot);
}