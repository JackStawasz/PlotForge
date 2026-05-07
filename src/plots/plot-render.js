// ═══ CORE JS RENDER ══════════════════════════════════════════════════════
function evalVarCurve(varName, view){
  const v = (typeof variables !== 'undefined') ? variables.find(v=>v.name===varName&&v.kind==='equation') : null;
  if(!v||!v.exprLatex) return null;
  // Use the first declared parameter as the independent plotting variable.
  const params=(typeof extractEquationParams==='function')?extractEquationParams(v.fullLatex||''):['x'];
  const indepVar=params[0]||'x';
  const N=600, xLo=view.x_min??-10, xHi=view.x_max??10;
  const xs=[];
  for(let i=0;i<N;i++) xs.push(xLo+(xHi-xLo)*i/(N-1));
  const baseCtx=(typeof buildVarContext==='function')?buildVarContext():{};
  delete baseCtx[indepVar]; // don't let a same-named constant shadow the sweep variable
  const ys=xs.map(xv=>evalLatexExpr(v.exprLatex, Object.assign({},baseCtx,{[indepVar]:xv})));
  const yFinite=ys.filter(y=>y!==null&&isFinite(y));
  return {
    x:xs, y:ys, autoXMin:xLo, autoXMax:xHi,
    autoYMin:yFinite.length?Math.min(...yFinite):-1,
    autoYMax:yFinite.length?Math.max(...yFinite):1,
  };
}

function renderJS(pid, firstRender=false){
  const p = gp(pid); if(!p) return;
  let anyData=false, gxMin=null, gxMax=null, gyMin=null, gyMax=null;

  // Template-based curves: evaluate and store jsData
  for(const curve of p.curves){
    if(!curve.template) continue;
    let result;
    try{ result = evalTemplate(curve.template, curve.params, p.view); }
    catch(e){ console.warn('evalTemplate error for', curve.template, e); continue; }
    if(!result) continue;
    let sampled = result;
    if(!result.discrete){
      const evalFn = x => {
        try{
          const tiny = evalTemplate(curve.template, curve.params, {x_min:x, x_max:x+1e-10});
          return tiny ? tiny.y[0] : null;
        }catch(e){ return null; }
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

  // Equation-variable curves: re-evaluate over current x-domain each render
  for(const curve of p.curves){
    if(!curve.varName) continue;
    const result = evalVarCurve(curve.varName, p.view);
    if(!result){ curve.jsData = {x:[],y:[],discrete:false}; continue; }
    const eqV = (typeof variables !== 'undefined') ? variables.find(v=>v.name===curve.varName&&v.kind==='equation') : null;
    const _params=(typeof extractEquationParams==='function')?extractEquationParams(eqV?.fullLatex||''):['x'];
    const _indepVar=_params[0]||'x';
    const evalFn = xv => {
      const baseCtx = Object.assign({}, buildVarContext());
      delete baseCtx[_indepVar];
      const ctx = Object.assign({}, baseCtx, {[_indepVar]: xv});
      return evalLatexExpr(eqV?.exprLatex||'', ctx);
    };
    const sampled = adaptiveSample(result.x, result.y, evalFn);
    const masked  = applyMask(sampled.x, sampled.y, curve);
    const clipped = clipForDisplay(masked.x, masked.y);
    curve.jsData = {x:clipped.x, y:clipped.y, discrete:false};
    curve.equation = `${curve.varName} = ${eqV?.exprLatex||'?'}`;
    anyData = true;
    if(gxMin===null||result.autoXMin<gxMin) gxMin=result.autoXMin;
    if(gxMax===null||result.autoXMax>gxMax) gxMax=result.autoXMax;
    if(gyMin===null||result.autoYMin<gyMin) gyMin=result.autoYMin;
    if(gyMax===null||result.autoYMax>gyMax) gyMax=result.autoYMax;
  }

  // List-data curves: jsData already set directly, just count bounds
  for(const curve of p.curves){
    if(curve.template || curve.varName || !curve.jsData) continue;
    anyData = true;
    const xs = curve.jsData.x, ys = curve.jsData.y.filter(v=>v!=null&&!isNaN(v));
    if(xs.length){
      const xMin=Math.min(...xs), xMax=Math.max(...xs);
      if(gxMin===null||xMin<gxMin) gxMin=xMin;
      if(gxMax===null||xMax>gxMax) gxMax=xMax;
    }
    if(ys.length){
      const yMin=Math.min(...ys), yMax=Math.max(...ys);
      if(gyMin===null||yMin<gyMin) gyMin=yMin;
      if(gyMax===null||yMax>gyMax) gyMax=yMax;
    }
  }
  if(!anyData){
    // No curves yet — still draw the empty interactive grid
    const innerEl = document.getElementById(`cinner_${pid}`); if(!innerEl) return;
    if(!document.getElementById(`chart_${pid}`)){
      innerEl.innerHTML = buildInnerHTML(p);
      setTimeout(()=>{ drawChart(p); wireInteraction(p); wireAxisLabelInputs(p); wireOverlayLegend(p); renderTextAnnotations(p.id); renderShapeAnnotations(p.id); applyBgColorToCanvas(pid); syncCfgDomain(); updateTopbar(pid); }, 0);
    } else {
      drawChart(p); syncCfgDomain(); applyBgColorToCanvas(pid);
    }
    return;
  }
  if(firstRender || p.view.x_min==null){
    p.view.x_min = gxMin; p.view.x_max = gxMax;
    const yPad = (gyMax-gyMin)*0.08 || 0.1;
    p.view.y_min = gyMin-yPad; p.view.y_max = gyMax+yPad;
    if(firstRender) chartFirstRender[pid] = true;
  }
  const innerEl = document.getElementById(`cinner_${pid}`); if(!innerEl) return;
  if(!document.getElementById(`chart_${pid}`)){
    innerEl.innerHTML = buildInnerHTML(p);
    setTimeout(()=>{ drawChart(p); wireInteraction(p); wireAxisLabelInputs(p); wireOverlayLegend(p); renderTextAnnotations(p.id); renderShapeAnnotations(p.id); applyBgColorToCanvas(pid); syncCfgDomain(); updateTopbar(pid); }, 0);
    return;
  }
  drawChart(p); syncCfgDomain(); refreshOverlayLegend(pid); applyBgColorToCanvas(pid);
}

// ═══ CHART.JS RENDERING ══════════════════════════════════════════════════
function destroyChart(pid){
  if(chartInstances[pid]){ chartInstances[pid].destroy(); delete chartInstances[pid]; }
}

function drawChart(p){
  const canvas = document.getElementById(`chart_${p.id}`); if(!canvas) return;
  const shouldAnimate = !!chartFirstRender[p.id]; if(shouldAnimate) delete chartFirstRender[p.id];

  // Set default view bounds for empty plots so axes display sensibly
  if(p.view.x_min==null){ p.view.x_min=-10; p.view.x_max=10; p.view.y_min=-7; p.view.y_max=7; }

  const v = p.view, animOpts = shouldAnimate ? {duration:500,easing:'easeOutQuart'} : {duration:0};
  const scales = buildScales(v);
  const datasets = []; let hasDiscrete = false;
  for(const curve of p.curves){
    if(!curve.jsData) continue;
    const lc = curve.line_color;
    if(curve.jsData.discrete){
      hasDiscrete = true;
      datasets.push({
        label: curve.name || (curve.template ? (TEMPLATES[curve.template]?.label||'Curve') : 'Curve'),
        type:'bar', data:curve.jsData.y,
        backgroundColor:hexAlpha(lc,.7), borderColor:lc, borderWidth:1,
      });
    }else{
      const isStep = (curve.line_connection||'linear') === 'step';
      const mk = curve.marker || 'none';
      const hasMarker = mk !== 'none';
      // Map matplotlib marker codes to Chart.js pointStyle
      const pointStyleMap = { 'o':'circle', 's':'rect', '^':'triangle', 'D':'rectRot', '+':'cross', 'x':'crossRot' };
      const chartPointStyle = pointStyleMap[mk] || 'circle';
      const strokeOnlyMarkers = new Set(['+', 'x']);
      const isStrokeOnly = strokeOnlyMarkers.has(mk);
      const ds = {
        label: curve.name || (curve.template ? (TEMPLATES[curve.template]?.label||'Curve') : 'Curve'),
        type:'line', data:curve.jsData.x.map((xv,i)=>({x:xv,y:curve.jsData.y[i]})),
        borderColor:lc, borderWidth:borderWidthFor(curve), borderDash:dashFor(curve.line_style),
        pointStyle: hasMarker ? chartPointStyle : false,
        pointRadius: hasMarker ? (curve.marker_size||4) : 0,
        pointHoverRadius: hasMarker ? (curve.marker_size||4) + 2 : 0,
        pointBackgroundColor: isStrokeOnly ? 'transparent' : lc,
        pointBorderColor: lc,
        pointBorderWidth: isStrokeOnly ? 2 : 1,
        fill:curve.fill_under, backgroundColor:hexAlpha(lc,curve.fill_alpha||.15),
        tension:isStep ? 0 : tensionFor(curve.line_connection||'linear'),
        stepped: isStep ? 'before' : false,
        spanGaps:false, parsing:false,
      };
      datasets.push(ds);
    }
  }
  const axisDatasets = buildAxisLineDatasets(v);
  const allDatasets = [...axisDatasets, ...datasets];

  if(chartInstances[p.id] && !shouldAnimate){
    const ch = chartInstances[p.id];
    const xTypeChanged = ch.options.scales.x.type !== (v.x_log ? 'logarithmic' : 'linear');
    const yTypeChanged = ch.options.scales.y.type !== (v.y_log ? 'logarithmic' : 'linear');
    if(xTypeChanged || yTypeChanged){
      destroyChart(p.id);
    } else {
      ch.data.datasets = allDatasets;
      if(hasDiscrete) ch.data.labels = p.curves.find(c=>c.jsData?.discrete)?.jsData.x.map(n=>n) || [];
      const isLight = v.chart_theme === 'light';
      const galpha = v.grid_alpha ?? 0.5;
      const gridBase = v.grid_color ?? (isLight ? '#3250b4' : '#3c3c64');
      const gc = hexAlpha(gridBase, galpha);
      const gridOn = galpha > 0;
      ch.options.scales.x.grid.display=gridOn; ch.options.scales.x.grid.color=gc;
      ch.options.scales.y.grid.display=gridOn; ch.options.scales.y.grid.color=gc;
      ch.options.scales.x.ticks.callback = v.x_log ? makeLogTickCb() : makeTickCb('x');
      ch.options.scales.y.ticks.callback = v.y_log ? makeLogTickCb() : makeTickCb('y');
      // Ensure afterBuildTicks is always set correctly for log axes
      ch.options.scales.x.afterBuildTicks = v.x_log ? makeLogAfterBuildTicks() : undefined;
      ch.options.scales.y.afterBuildTicks = v.y_log ? makeLogAfterBuildTicks() : undefined;
      applyScaleLimits(ch.options.scales, v); ch.update('none'); refreshOverlayLegend(p.id); updatePlotLockedAnnotations(p.id); renderShapeAnnotations(p.id); return;
    }
  }

  destroyChart(p.id); const ctx = canvas.getContext('2d');
  const ct = v.chart_theme ?? 'dark';
  if(hasDiscrete){
    const dc = p.curves.find(c=>c.jsData?.discrete);
    chartInstances[p.id] = new Chart(ctx, {
      type:'bar', data:{labels:dc?.jsData.x.map(n=>n)||[], datasets:allDatasets},
      options:{responsive:true,maintainAspectRatio:true,animation:animOpts,
        plugins:{legend:{display:false},tooltip:tooltipOpts(ct)},scales}
    });
  }else{
    scales.x.type = v.x_log ? 'logarithmic' : 'linear';
    chartInstances[p.id] = new Chart(ctx, {
      type:'line', data:{datasets:allDatasets},
      options:{responsive:true,maintainAspectRatio:true,animation:animOpts,
        plugins:{legend:{display:false},tooltip:{...tooltipOpts(ct),callbacks:{
          title:items=>`x = ${Number(items[0].parsed.x).toFixed(4)}`,
          label:item=>item.dataset._axisLine ? null : `${item.dataset.label}: y = ${Number(item.parsed.y)?.toFixed(5)?? '—'}`,
        }}},scales}
    });
  }
  refreshOverlayLegend(p.id);
}

// Convert a 6-digit hex color + opacity to an rgba() string used by Chart.js.
function hexAlpha(hex, alpha){
  const h = (hex || '#000000').replace('#','');
  const r = parseInt(h.slice(0,2), 16) || 0;
  const g = parseInt(h.slice(2,4), 16) || 0;
  const b = parseInt(h.slice(4,6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

function dashFor(ls){ return ls==='dashed'?[6,3]:ls==='dotted'?[2,3]:ls==='dashdot'?[6,3,2,3]:[]; }
function borderWidthFor(curve){ return curve.line_connection==='none' ? 0 : (curve.line_width||2); }
function tensionFor(lc){ return lc==='cubic'?0.4:lc==='bezier'?0.6:0; }

function buildAxisLineDatasets(v){
  const alpha = v.axis_alpha ?? 1.0;
  if(alpha <= 0) return [];
  const isLight = v.chart_theme === 'light';
  const baseColor = v.axis_color ?? (isLight ? '#1e328c' : '#b4b4dc');
  const color = hexAlpha(baseColor, alpha);
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
  const isLight = v.chart_theme === 'light';
  const galpha = v.grid_alpha ?? 0.5;
  const gridBase = v.grid_color ?? (isLight ? '#3250b4' : '#3c3c64');
  const gc = hexAlpha(gridBase, galpha);
  const tickColor = isLight ? '#2a3570' : '#b0b0e0';

  // Shared tick config builder — log axes get afterBuildTicks for correct grid alignment
  const axisCfg = (isLog, axisKey) => ({
    type: isLog ? 'logarithmic' : 'linear',
    border:{ display:true, color:gc },
    ticks:{
      color:tickColor,
      font:{family:"'IBM Plex Mono'",size:10},
      // maxTicksLimit only for linear — log scales manage their own tick count via afterBuildTicks
      ...(isLog ? {} : {maxTicksLimit: axisKey==='x' ? 12 : 10}),
      callback: isLog ? makeLogTickCb() : makeTickCb(axisKey),
    },
    grid:{color:gc, display:galpha > 0, drawBorder:true},
    // Force tick positions at log-decade boundaries so grid lines are semantically correct
    ...(isLog ? {afterBuildTicks: makeLogAfterBuildTicks()} : {}),
  });

  const s = { x: axisCfg(v.x_log, 'x'), y: axisCfg(v.y_log, 'y') };
  applyScaleLimits(s, v);
  return s;
}

// ─── Logarithmic axis helpers ─────────────────────────────────────────────
// Minimum positive value accepted on a log axis — guards against log(0).
const MIN_LOG_VAL = 1e-300;

// Clamp any log-axis view limits to strictly positive values.
// Called after every pan/zoom mutation before writing back to the chart.
function clampLogLimits(v){
  if(v.x_log){
    v.x_min = Math.max(MIN_LOG_VAL, v.x_min ?? MIN_LOG_VAL);
    v.x_max = Math.max(MIN_LOG_VAL, v.x_max ?? 1);
    if(v.x_min >= v.x_max) v.x_max = v.x_min * 10;
  }
  if(v.y_log){
    v.y_min = Math.max(MIN_LOG_VAL, v.y_min ?? MIN_LOG_VAL);
    v.y_max = Math.max(MIN_LOG_VAL, v.y_max ?? 1);
    if(v.y_min >= v.y_max) v.y_max = v.y_min * 10;
  }
}

// afterBuildTicks callback for Chart.js logarithmic scales.
// Forces ticks at every power-of-10 within the visible range, plus integer
// multiples 2–9 within each decade when the range spans ≤ 3 decades.
// This ensures grid lines always land at semantically correct positions.
function makeLogAfterBuildTicks(){
  return function(scale){
    const lo = scale.min, hi = scale.max;
    if(!lo || !hi || lo <= 0 || hi <= 0 || !isFinite(lo) || !isFinite(hi)) return;
    const logLo  = Math.floor(Math.log10(lo) - 1e-9);
    const logHi  = Math.ceil (Math.log10(hi) + 1e-9);
    const decades = logHi - logLo;
    const wantSubs = decades <= 3; // subdivisions only when range is narrow
    const ticks = [];
    for(let exp = logLo; exp <= logHi; exp++){
      const base = Math.pow(10, exp);
      if(base >= lo * (1-1e-9) && base <= hi * (1+1e-9)) ticks.push({value: base});
      if(wantSubs){
        for(let sub = 2; sub <= 9; sub++){
          const sv = base * sub;
          if(sv > lo && sv < hi) ticks.push({value: sv});
        }
      }
    }
    ticks.sort((a, b) => a.value - b.value);
    scale.ticks = ticks;
  };
}

// Tick label callback for log axes.
// Powers of 10 → formatted label; subdivision multiples → no label (grid line only).
function makeLogTickCb(){
  return function(val){
    if(val <= 0 || !isFinite(val)) return null;
    const log = Math.log10(val);
    const exp = Math.round(log);
    if(Math.abs(log - exp) < 1e-9){
      if(exp ===  0) return '1';
      if(exp ===  1) return '10';
      if(exp === -1) return '0.1';
      return `10^${exp}`;
    }
    return null; // subdivision: grid line drawn via afterBuildTicks, no label
  };
}

function applyScaleLimits(scales, v){
  if(v.x_min!=null) scales.x.min=v.x_min; else delete scales.x.min;
  if(v.x_max!=null) scales.x.max=v.x_max; else delete scales.x.max;
  if(v.y_min!=null) scales.y.min=v.y_min; else delete scales.y.min;
  if(v.y_max!=null) scales.y.max=v.y_max; else delete scales.y.max;
}

function tooltipOpts(chartTheme = 'dark'){
  return chartTheme === 'light'
    ? { backgroundColor:'#eef2ff', borderColor:'#a0aacc', borderWidth:1,
        titleColor:'#1a2060', bodyColor:'#2a3478',
        titleFont:{family:"'IBM Plex Mono'",size:10}, bodyFont:{family:"'IBM Plex Mono'",size:10} }
    : { backgroundColor:'#0c0c18', borderColor:'#252540', borderWidth:1,
        titleColor:'#d4ff5a', bodyColor:'#d0d0ee',
        titleFont:{family:"'IBM Plex Mono'",size:10}, bodyFont:{family:"'IBM Plex Mono'",size:10} };
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

  const lineVis = curve.line_connection==='none' ? 'visibility="hidden"' : '';

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
    if(p.view.legend_text_color) nm.style.color = p.view.legend_text_color;
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

  // Double-click legend row → activate that curve and open Line Settings tab
  box.addEventListener('dblclick', e=>{
    const row = e.target.closest('.ol-row');
    if(!row) return;
    const rowIdx = [...box.querySelectorAll('.ol-row')].indexOf(row);
    if(rowIdx < 0) return;
    // Activate the plot and select the curve
    activePid = pid;
    const p = gp(pid); if(!p) return;
    const realCurves = p.curves.filter(c=>c.jsData||c.template);
    const curve = realCurves[rowIdx];
    if(!curve) return;
    activeCurveIdx = p.curves.indexOf(curve);
    syncActiveHighlight();
    // Open Line Settings tab in the right cfg panel
    setCfgTab('line');
    refreshCfg();
    refreshLineCurveSelector();
    e.stopPropagation();
  });
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
    refreshSidebar(); refreshLineCurveSelector(); refreshCfg();
    snapshotForUndo(); return;
  }
  p.curves.splice(idx, 1);
  if(activeCurveIdx >= p.curves.length) activeCurveIdx = p.curves.length-1;
  renderJS(pid, false); updateTopbar(pid); refreshOverlayLegend(pid);
  refreshLineCurveSelector(); refreshSidebar(); refreshCfg();
  snapshotForUndo();
}
