// ═══ TEMPLATE MODAL ══════════════════════════════════════════════════════
let modalSelTpl = null;

// Called by tryConnect after TEMPLATES loads; rebuilds the nav and card grid.
function buildCategories(){
  buildModalNavAndGrid();
}

function buildModalNavAndGrid(){
  const nav  = document.getElementById('tplModalNav');
  const grid = document.getElementById('tplModalGrid');
  if(!nav||!grid) return;
  nav.innerHTML=''; grid.innerHTML='';
  const catOrder=[], catMeta={};
  for(const [key,tpl] of Object.entries(TEMPLATES)){
    const cat=tpl.category;
    if(!catMeta[cat]){catOrder.push(cat);catMeta[cat]=[];}
    catMeta[cat].push({key,tpl});
  }
  const allBtn=document.createElement('button'); allBtn.className='tpl-nav-item active'; allBtn.dataset.cat='all';
  allBtn.innerHTML=`<span class="tpl-nav-dot" style="background:var(--muted)"></span>All Templates`;
  allBtn.addEventListener('click',()=>{ _setModalMode('templates'); setModalCat('all'); }); nav.appendChild(allBtn);
  for(const cat of catOrder){
    const meta=CAT_META[cat]||{label:cat,dotClass:''};
    const btn=document.createElement('button'); btn.className='tpl-nav-item'; btn.dataset.cat=cat;
    btn.innerHTML=`<span class="tpl-nav-dot ${meta.dotClass}"></span>${meta.label}`;
    btn.addEventListener('click',()=>{ _setModalMode('templates'); setModalCat(cat); }); nav.appendChild(btn);
  }
  // Divider + Lists entry
  const divider=document.createElement('div');
  divider.style.cssText='height:1px;background:var(--border);margin:6px 4px;flex-shrink:0';
  nav.appendChild(divider);
  const listsBtn=document.createElement('button'); listsBtn.className='tpl-nav-item'; listsBtn.dataset.cat='__lists__';
  listsBtn.innerHTML=`<span class="tpl-nav-dot" style="background:#ffb347"></span>Lists`;
  listsBtn.addEventListener('click',()=>_setModalMode('lists')); nav.appendChild(listsBtn);
  for(const cat of catOrder){
    const meta=CAT_META[cat]||{label:cat,dotClass:''};
    const hdr=document.createElement('div'); hdr.className='tpl-cat-header'; hdr.dataset.cat=cat;
    hdr.innerHTML=`<span class="cat-dot ${meta.dotClass}"></span>${meta.label}`;
    grid.appendChild(hdr);
    for(const {key,tpl} of catMeta[cat]){
      const card=document.createElement('div'); card.className='tpl-card'; card.dataset.key=key; card.dataset.cat=cat;
      // Build card with a placeholder span for the equation; MQ renders it after insertion
      card.innerHTML=`<div class="tpl-card-dot ${meta.dotClass}"></div><div class="tpl-card-label">${tpl.label}</div><div class="tpl-card-eq"><span class="tpl-card-eq-mq"></span></div>`;
      card.addEventListener('click',()=>selectModalTemplate(key)); grid.appendChild(card);
      // Render the equation string via MQ StaticMath once the card is in the DOM
      requestAnimationFrame(()=>{
        const mqSpan = card.querySelector('.tpl-card-eq-mq');
        if(mqSpan && MQ){
          try{ MQ.StaticMath(mqSpan).latex(tpl.equation); }
          catch(e){ mqSpan.textContent = tpl.equation; }
        } else if(mqSpan){
          mqSpan.textContent = tpl.equation;
        }
      });
    }
  }
}

function setModalCat(cat){
  // Clear selection when switching categories
  document.querySelectorAll('.tpl-card').forEach(c=>c.classList.remove('selected'));
  modalSelTpl = null;
  const footer = document.getElementById('tplModalFooter');
  if(footer){ footer.style.opacity='0.3'; footer.style.pointerEvents='none'; }

  document.querySelectorAll('.tpl-nav-item').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));
  const grid=document.getElementById('tplModalGrid'); if(!grid) return;
  grid.querySelectorAll('.tpl-card,.tpl-cat-header').forEach(el=>{
    el.style.display=(cat==='all'||el.dataset.cat===cat)?'':'none';
  });
  grid.scrollTop=0;
}

function filterModalTemplates(query){
  const q=query.toLowerCase().trim();
  const grid=document.getElementById('tplModalGrid'); if(!grid) return;
  grid.querySelectorAll('.tpl-card').forEach(card=>{
    const tpl=TEMPLATES[card.dataset.key]; if(!tpl) return;
    card.style.display=(!q||tpl.label.toLowerCase().includes(q)||tpl.equation.toLowerCase().includes(q))?'':'none';
  });
  grid.querySelectorAll('.tpl-cat-header').forEach(hdr=>{
    const has=[...grid.querySelectorAll(`.tpl-card[data-cat="${hdr.dataset.cat}"]`)].some(c=>c.style.display!=='none');
    hdr.style.display=has?'':'none';
  });
}

function selectModalTemplate(key){
  modalSelTpl=key;
  document.querySelectorAll('.tpl-card').forEach(c=>c.classList.toggle('selected',c.dataset.key===key));
  const footer=document.getElementById('tplModalFooter');
  const info=document.getElementById('tplModalSelectedInfo');
  const params=document.getElementById('tplModalParams');
  const addBtn=document.getElementById('tplModalAddBtn');
  if(!TEMPLATES[key]){
    if(footer){ footer.style.opacity='0.3'; footer.style.pointerEvents='none'; }
    return;
  }
  const tpl=TEMPLATES[key];
  if(footer){ footer.style.opacity=''; footer.style.pointerEvents=''; footer.style.display='flex'; }
  info.innerHTML=`<strong>${tpl.label}</strong><br><em>${tpl.equation}</em>`;
  params.innerHTML='';
  for(const [pk,pd] of Object.entries(tpl.params)){
    const item=document.createElement('div'); item.className='tpl-mp-item';
    item.innerHTML=`<span class="tpl-mp-label">${pd.label}</span><input class="tpl-mp-input" id="mp_${pk}" type="number" value="${pd.default}" step="${pd.step}" min="${pd.min}" max="${pd.max}"/>`;
    params.appendChild(item);
  }
  if(addBtn) addBtn.disabled=!activePid;
}

function addFromModal(){
  if(!modalSelTpl||activePid===null) return;
  const p=activePlot(); if(!p) return;
  const params={};
  for(const pk of Object.keys(TEMPLATES[modalSelTpl].params)){
    const el=document.getElementById(`mp_${pk}`); if(el) params[pk]=parseFloat(el.value);
  }
  selTpl=modalSelTpl;
  const autoName=TEMPLATES[selTpl]?.equation||selTpl;
  const curve=activeCurve();
  if(curve&&!curve.template){
    curve.template=selTpl; curve.params=params;
    if(!curve.name) curve.name=autoName;
    p.view.x_min=null;p.view.x_max=null;p.view.y_min=null;p.view.y_max=null;
    renderJS(p.id,true); refreshOverlayLegend(p.id); refreshLineCurveSelector();
  }else{
    const nc=defCurve(p.curves); nc.template=selTpl; nc.params=params; nc.name=autoName; p.curves.push(nc);
    activeCurveIdx=p.curves.length-1;
    renderJS(p.id,false); updateTopbar(p.id); refreshOverlayLegend(p.id); refreshLineCurveSelector(); refreshCfg();
  }
  closeTemplateModal();
  syncTemplateParamsToVars(selTpl, params);
  snapshotForUndo();
}

function openTemplateModal(){
  document.getElementById('tplModalBackdrop')?.classList.add('open');
  const addBtn=document.getElementById('tplModalAddBtn');
  if(addBtn) addBtn.disabled=!activePid||!modalSelTpl;
  _setModalMode(_modalMode);
  setTimeout(()=>{ if(_modalMode==='templates') document.getElementById('tplSearchInp')?.focus(); },50);
}

function closeTemplateModal(){
  document.getElementById('tplModalBackdrop')?.classList.remove('open');
}

function wireTemplateModal(){
  document.getElementById('tplModalClose')?.addEventListener('click',closeTemplateModal);
  document.getElementById('tplModalBackdrop')?.addEventListener('click',e=>{ if(e.target===document.getElementById('tplModalBackdrop')) closeTemplateModal(); });
  document.getElementById('tplModalAddBtn')?.addEventListener('click',()=>{
    if(_modalMode==='lists') addListCurve();
    else addFromModal();
  });
  document.getElementById('tplSearchInp')?.addEventListener('input',function(){filterModalTemplates(this.value);});
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeTemplateModal(); });
  document.getElementById('lvlAddBtn')?.addEventListener('click', addListCurve);
}

// ─── List vs List ──────────────────────────────────────────────────────────
let _lvlXName = null; // selected X list variable name
let _lvlYName = null; // selected Y list variable name
let _modalMode = 'templates'; // 'templates' | 'lists'

// Switch the modal between template-browsing and list-plotting modes
function _setModalMode(mode){
  _modalMode = mode;
  const grid   = document.getElementById('tplModalGrid');
  const lvl    = document.getElementById('lvlSection');
  const footer = document.getElementById('tplModalFooter');
  const search = document.getElementById('tplSearchWrap') || document.querySelector('.tpl-modal-search-wrap');
  const isLists = mode === 'lists';

  if(grid)   grid.style.display   = isLists ? 'none' : '';
  if(search) search.style.visibility = isLists ? 'hidden' : '';
  if(lvl){
    lvl.style.display = isLists ? 'flex' : 'none';
    if(isLists) refreshLvlSection();
  }
  // Footer: show in both modes; lists mode updates its content via refreshLvlSection
  if(footer){
    footer.style.display = 'flex';
    if(!isLists){
      // Restore template footer state
      const hasTemplate = !!(modalSelTpl && TEMPLATES[modalSelTpl]);
      footer.style.opacity = hasTemplate ? '' : '0.3';
      footer.style.pointerEvents = hasTemplate ? '' : 'none';
    }
  }
  document.querySelectorAll('.tpl-nav-item').forEach(b=>{
    if(isLists){ b.classList.toggle('active', b.dataset.cat==='__lists__'); }
  });
}

function refreshLvlSection(){
  const section = document.getElementById('lvlSection'); if(!section) return;
  const lists = (typeof variables !== 'undefined') ? variables.filter(v=>v.kind==='list' && v.name) : [];
  if(!lists.length){ section.style.display='none'; return; }
  if(_modalMode === 'lists') section.style.display = 'flex';

  // Reset if previously selected vars were removed
  if(_lvlXName && !lists.find(v=>v.name===_lvlXName)) _lvlXName = null;
  if(_lvlYName && !lists.find(v=>v.name===_lvlYName)) _lvlYName = null;

  const hint   = document.getElementById('lvlHint');
  const xRow   = document.getElementById('lvlXRow');
  const yRow   = document.getElementById('lvlYRow');
  const addBtn = document.getElementById('lvlAddBtn');
  const mainBtn = document.getElementById('tplModalAddBtn');
  const mainInfo = document.getElementById('tplModalSelectedInfo');
  const footer  = document.getElementById('tplModalFooter');

  // Build X picker (all lists)
  xRow.innerHTML = '';
  lists.forEach(v=>{
    const card = document.createElement('button');
    card.className = 'lvl-var-card' + (v.name===_lvlXName ? ' lvl-selected-x' : '');
    card.textContent = `${v.name} [${v.listItems.length}]`;
    card.addEventListener('click', ()=>{
      _lvlXName = (_lvlXName === v.name) ? null : v.name; // toggle
      if(_lvlXName === _lvlYName) _lvlYName = null;
      refreshLvlSection();
    });
    xRow.appendChild(card);
  });

  if(!_lvlXName){
    hint.textContent = 'Select an X variable';
    yRow.style.display = 'none';
    if(addBtn) addBtn.disabled = true;
    if(mainBtn && _modalMode==='lists'){ mainBtn.disabled=true; }
    if(footer && _modalMode==='lists'){ footer.style.opacity='0.3'; footer.style.pointerEvents='none'; }
    return;
  }

  // Build Y picker (same-length lists only, not X itself)
  const xLen = lists.find(v=>v.name===_lvlXName)?.listItems.length ?? 0;
  const yLists = lists.filter(v=>v.name !== _lvlXName);
  yRow.style.display = 'flex';
  yRow.innerHTML = '';
  yLists.forEach(v=>{
    const sameLen = v.listItems.length === xLen;
    const card = document.createElement('button');
    card.className = 'lvl-var-card'
      + (v.name===_lvlYName ? ' lvl-selected-y' : '')
      + (!sameLen ? ' lvl-disabled' : '');
    card.textContent = `${v.name} [${v.listItems.length}]`;
    if(sameLen){
      card.addEventListener('click', ()=>{
        _lvlYName = (_lvlYName === v.name) ? null : v.name;
        refreshLvlSection();
      });
    }
    yRow.appendChild(card);
  });

  if(!_lvlYName){
    hint.textContent = `X = ${_lvlXName} (${xLen} pts) — select Y`;
    if(addBtn) addBtn.disabled = true;
    if(mainBtn && _modalMode==='lists'){ mainBtn.disabled=true; }
    if(footer && _modalMode==='lists'){ footer.style.opacity='0.3'; footer.style.pointerEvents='none'; }
  } else {
    hint.textContent = `${_lvlXName} vs ${_lvlYName} (${xLen} pts)`;
    if(addBtn) addBtn.disabled = !activePid;
    if(_modalMode==='lists'){
      if(mainBtn){ mainBtn.disabled=!activePid; }
      if(mainInfo) mainInfo.innerHTML=`<strong>${_lvlYName} vs ${_lvlXName}</strong><br><em>${xLen} data points</em>`;
      if(footer){ footer.style.opacity=activePid?'':'0.3'; footer.style.pointerEvents=activePid?'':'none'; }
    }
  }
}

function addListCurve(){
  if(!_lvlXName || !_lvlYName || activePid === null) return;
  const xVar = variables.find(v=>v.name===_lvlXName);
  const yVar = variables.find(v=>v.name===_lvlYName);
  if(!xVar||!yVar) return;

  const p = activePlot(); if(!p) return;
  const nc = defCurve(p.curves);
  nc.name = `${_lvlYName} vs ${_lvlXName}`;
  nc.jsData = { x: [...xVar.listItems], y: [...yVar.listItems], discrete: false };
  nc.listXName = _lvlXName;
  nc.listYName = _lvlYName;
  p.curves.push(nc);
  activeCurveIdx = p.curves.length - 1;

  // Set view bounds from the data
  const xs = xVar.listItems, ys = yVar.listItems;
  const xPad = (Math.max(...xs)-Math.min(...xs))*0.06||0.5;
  const yPad = (Math.max(...ys)-Math.min(...ys))*0.06||0.5;
  if(p.view.x_min==null){
    p.view.x_min=Math.min(...xs)-xPad; p.view.x_max=Math.max(...xs)+xPad;
    p.view.y_min=Math.min(...ys)-yPad; p.view.y_max=Math.max(...ys)+yPad;
  }

  closeTemplateModal();
  drawChart(p); updateTopbar(p.id); refreshOverlayLegend(p.id); refreshLineCurveSelector(); refreshCfg();
  snapshotForUndo();
}

function refreshSidebar(){
  const addBtn=document.getElementById('tplModalAddBtn');
  if(addBtn) addBtn.disabled=!activePid||!modalSelTpl;
}

// ═══ PARAMETER PANEL ═════════════════════════════════════════════════════
const sliderRanges = {};

function buildParamsForTemplate(key, existingParams){
  const pa = document.getElementById('paramsArea');
  if(pa) pa.innerHTML = '';
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
  document.getElementById('paramsArea')?.querySelectorAll('.p-row').forEach(row=>{
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

  // Template-based curves: evaluate and store jsData
  for(const curve of p.curves){
    if(!curve.template) continue;
    const result = evalTemplate(curve.template, curve.params, p.view); if(!result) continue;
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

  // List-data curves: jsData already set directly, just count bounds
  for(const curve of p.curves){
    if(curve.template || !curve.jsData) continue;
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
      setTimeout(()=>{ drawChart(p); wireInteraction(p); wireAxisLabelInputs(p); wireOverlayLegend(p); renderTextAnnotations(p.id); applyBgColorToCanvas(pid); syncCfgDomain(); updateTopbar(pid); }, 0);
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
    setTimeout(()=>{ drawChart(p); wireInteraction(p); wireAxisLabelInputs(p); wireOverlayLegend(p); renderTextAnnotations(p.id); applyBgColorToCanvas(pid); syncCfgDomain(); updateTopbar(pid); }, 0);
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
        label: curve.name || (curve.template ? (TEMPLATES[curve.template]?.equation||'Curve') : 'Curve'),
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
        label: curve.name || (curve.template ? (TEMPLATES[curve.template]?.equation||'Curve') : 'Curve'),
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
      const gc = isLight ? `rgba(50,80,180,${galpha})` : `rgba(60,60,100,${galpha})`;
      ch.options.scales.x.grid.display=v.show_grid; ch.options.scales.x.grid.color=gc;
      ch.options.scales.y.grid.display=v.show_grid; ch.options.scales.y.grid.color=gc;
      ch.options.scales.x.ticks.callback = v.x_log ? makeLogTickCb() : makeTickCb('x');
      ch.options.scales.y.ticks.callback = v.y_log ? makeLogTickCb() : makeTickCb('y');
      applyScaleLimits(ch.options.scales, v); ch.update('none'); refreshOverlayLegend(p.id); updatePlotLockedAnnotations(p.id); return;
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

function dashFor(ls){ return ls==='dashed'?[6,3]:ls==='dotted'?[2,3]:ls==='dashdot'?[6,3,2,3]:[]; }
function borderWidthFor(curve){ return curve.line_connection==='none' ? 0 : (curve.line_width||2); }
function tensionFor(lc){ return lc==='cubic'?0.4:lc==='bezier'?0.6:0; }

function buildAxisLineDatasets(v){
  if(!v.show_axis_lines) return [];
  const alpha = v.axis_alpha ?? 0.6;
  const color = v.chart_theme === 'light'
    ? `rgba(30,50,140,${alpha})`
    : `rgba(180,180,220,${alpha})`;
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
  const gc = isLight
    ? `rgba(50,80,180,${galpha})`
    : `rgba(60,60,100,${galpha})`;
  const tickColor = isLight ? '#2a3570' : '#b0b0e0';
  const s = {
    x:{
      type: v.x_log ? 'logarithmic' : 'linear',
      border:{ display:true, color:gc },
      ticks:{color:tickColor,font:{family:"'IBM Plex Mono'",size:10},maxTicksLimit:12,
             callback: v.x_log ? makeLogTickCb() : makeTickCb('x')},
      grid:{color:gc,display:v.show_grid, drawBorder:true},
    },
    y:{
      type: v.y_log ? 'logarithmic' : 'linear',
      border:{ display:true, color:gc },
      ticks:{color:tickColor,font:{family:"'IBM Plex Mono'",size:10},maxTicksLimit:10,
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

function tooltipOpts(chartTheme = 'dark'){
  return chartTheme === 'light'
    ? { backgroundColor:'#eef2ff', borderColor:'#a0aacc', borderWidth:1,
        titleColor:'#1a2060', bodyColor:'#2a3478',
        titleFont:{family:"'IBM Plex Mono'",size:10}, bodyFont:{family:"'IBM Plex Mono'",size:10} }
    : { backgroundColor:'#0c0c18', borderColor:'#252540', borderWidth:1,
        titleColor:'#d4ff5a', bodyColor:'#d0d0ee',
        titleFont:{family:"'IBM Plex Mono'",size:10}, bodyFont:{family:"'IBM Plex Mono'",size:10} };
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
    const txt = `x=${sigFig(dataX,4)}&nbsp;y=${sigFig(dataY,4)}`;
    const tcel = document.getElementById(`ctop_coords_${p.id}`);
    if(tcel){
      tcel.innerHTML = txt;
      tcel.style.transition = 'opacity 0.3s ease';
      tcel.style.opacity='1';
    }
    if(panState[p.id]?.dragging) onPanMove(e, p);
  });
  wrap.addEventListener('mouseenter', ()=>{
    const tcel = document.getElementById(`ctop_coords_${p.id}`);
    if(tcel){
      tcel.style.transition = 'opacity 0.3s ease';
      tcel.style.opacity='1';
    }
  });
  wrap.addEventListener('mouseleave', ()=>{
    const tcel = document.getElementById(`ctop_coords_${p.id}`);
    if(tcel){
      tcel.style.transition = 'opacity 0.8s ease';
      tcel.style.opacity='0';
    }
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