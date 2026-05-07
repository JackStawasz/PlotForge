// ═══ TEMPLATE MODAL ══════════════════════════════════════════════════════
let modalSelTpl = null;

// 'curve' = add curve to active plot (original behaviour)
// 'variable' = create variable(s) from template / constant
let _templateModalContext = 'curve';
let _varModalPage = 'constants'; // active page in variable mode
let _varModalScope = 'global';   // scope for variables created in variable mode

// ─── Fundamental Constants ────────────────────────────────────────────────
const FUNDAMENTAL_CONSTANTS = [
  {
    group: 'Mathematical Constants', color: '#a78bfa',
    items: [
      { varName:'pi',        nameLatex:'\\pi',                 displayName:'Pi',                  value:3.14159265358979323,  unit:'' },
      { varName:'e_math',    nameLatex:'e',                    displayName:"Euler's Number",       value:2.71828182845904523,  unit:'' },
      { varName:'phi',       nameLatex:'\\varphi',             displayName:'Golden Ratio',         value:1.61803398874989484,  unit:'' },
      { varName:'gamma_EM',  nameLatex:'\\gamma',              displayName:'Euler–Mascheroni',     value:0.57721566490153286,  unit:'' },
      { varName:'G_cat',     nameLatex:'G',                    displayName:"Catalan's Constant",   value:0.91596559417721901,  unit:'' },
      { varName:'zeta_3',    nameLatex:'\\zeta_{3}',           displayName:"Apéry's Constant",     value:1.20205690315959428,  unit:'' },
      { varName:'delta_F',   nameLatex:'\\delta_{F}',          displayName:'Feigenbaum Delta',     value:4.66920160910299067,  unit:'' },
    ]
  },
  {
    group: 'Physical Constants', color: '#34d399',
    items: [
      { varName:'c',         nameLatex:'c',                    displayName:'Speed of Light',       value:2.99792458e8,         unit:'m/s' },
      { varName:'h_P',       nameLatex:'h',                    displayName:'Planck Constant',      value:6.62607015e-34,       unit:'J·s' },
      { varName:'hbar',      nameLatex:'\\hbar',               displayName:'Reduced Planck',       value:1.054571817e-34,      unit:'J·s' },
      { varName:'e_ch',      nameLatex:'e',                    displayName:'Elementary Charge',    value:1.602176634e-19,      unit:'C' },
      { varName:'k_B',       nameLatex:'k_{B}',                displayName:'Boltzmann Constant',   value:1.380649e-23,         unit:'J/K' },
      { varName:'varepsilon_0', nameLatex:'\\varepsilon_{0}',  displayName:'Vacuum Permittivity',  value:8.8541878128e-12,     unit:'F/m' },
      { varName:'mu_0',      nameLatex:'\\mu_{0}',             displayName:'Vacuum Permeability',  value:1.25663706212e-6,     unit:'N/A²' },
      { varName:'alpha_fs',  nameLatex:'\\alpha_{\\text{fs}}', displayName:'Fine-Structure',       value:7.2973525693e-3,      unit:'' },
    ]
  },
  {
    group: 'Derived Constants', color: '#60a5fa',
    items: [
      { varName:'g',         nameLatex:'g',                    displayName:'Gravity (Earth)',      value:9.80665,              unit:'m/s²' },
      { varName:'G_grav',    nameLatex:'G',                    displayName:'Gravitational Const.', value:6.67430e-11,          unit:'N·m²/kg²' },
      { varName:'k_e',       nameLatex:'k_{e}',                displayName:'Coulomb Constant',     value:8.9875517923e9,       unit:'N·m²/C²' },
      { varName:'R_gas',     nameLatex:'R',                    displayName:'Ideal Gas Constant',   value:8.314462618,          unit:'J/(mol·K)' },
      { varName:'sigma_SB',  nameLatex:'\\sigma',              displayName:'Stefan–Boltzmann',     value:5.670374419e-8,       unit:'W/(m²·K⁴)' },
      { varName:'R_inf',     nameLatex:'R_{\\infty}',          displayName:'Rydberg Constant',     value:10973731.568160,      unit:'m⁻¹' },
      { varName:'a_0',       nameLatex:'a_{0}',                displayName:'Bohr Radius',          value:5.29177210903e-11,    unit:'m' },
      { varName:'eV',        nameLatex:'\\text{eV}',           displayName:'Electron Volt',        value:1.602176634e-19,      unit:'J' },
      { varName:'N_A',       nameLatex:'N_{A}',                displayName:"Avogadro's Number",    value:6.02214076e23,        unit:'mol⁻¹' },
    ]
  },
  {
    group: 'Particle Properties', color: '#f87171',
    items: [
      { varName:'m_e',       nameLatex:'m_{e}',                displayName:'Electron Mass',        value:9.1093837015e-31,     unit:'kg' },
      { varName:'m_p',       nameLatex:'m_{p}',                displayName:'Proton Mass',          value:1.67262192369e-27,    unit:'kg' },
      { varName:'m_n',       nameLatex:'m_{n}',                displayName:'Neutron Mass',         value:1.67492749804e-27,    unit:'kg' },
      { varName:'m_mu',      nameLatex:'m_{\\mu}',             displayName:'Muon Mass',            value:1.883531627e-28,      unit:'kg' },
      { varName:'m_tau',     nameLatex:'m_{\\tau}',            displayName:'Tau Mass',             value:3.16754e-27,          unit:'kg' },
      { varName:'sin2_tW',   nameLatex:'\\sin^{2}\\theta_{W}', displayName:'Weak Mixing Angle',    value:0.23122,              unit:'' },
    ]
  },
];

// Format a JS number as a LaTeX string suitable for MathQuill.
function _numToLatex(value){
  if(value === 0) return '0';
  if(Number.isInteger(value) && Math.abs(value) < 1e10) return String(value);
  const abs = Math.abs(value);
  const exp = Math.floor(Math.log10(abs));
  if(exp >= -4 && exp <= 6) return parseFloat(value.toPrecision(12)).toString();
  const coeff    = value / Math.pow(10, exp);
  const coeffStr = parseFloat(coeff.toPrecision(10)).toString();
  if(coeffStr === '1')  return `10^{${exp}}`;
  if(coeffStr === '-1') return `-10^{${exp}}`;
  return `${coeffStr}\\times10^{${exp}}`;
}

// Called by tryConnect after TEMPLATES loads.
function buildCategories(){
  buildModalNavAndGrid();
}

// ─── Curve-mode nav + grid ────────────────────────────────────────────────
function buildModalNavAndGrid(){
  const nav  = document.getElementById('tplModalNav');
  const grid = document.getElementById('tplModalGrid');
  if(!nav||!grid) return;
  nav.innerHTML=''; grid.innerHTML='';
  _buildCurveNav(nav);
  _buildTemplateGrid(grid);
}

function _buildCurveNav(nav){
  const catOrder=[], catMeta={};
  for(const [key,tpl] of Object.entries(TEMPLATES)){
    const cat=tpl.category;
    if(!catMeta[cat]){catOrder.push(cat);catMeta[cat]=[];}
    catMeta[cat].push({key,tpl});
  }
  const allBtn=document.createElement('button');
  allBtn.className='tpl-nav-item active'; allBtn.dataset.cat='all';
  allBtn.innerHTML=`<span class="tpl-nav-dot" style="background:var(--muted)"></span>All Templates`;
  allBtn.addEventListener('click',()=>{ _setModalMode('templates'); setModalCat('all'); });
  nav.appendChild(allBtn);
  for(const cat of catOrder){
    const meta=CAT_META[cat]||{label:cat,dotClass:''};
    const btn=document.createElement('button'); btn.className='tpl-nav-item'; btn.dataset.cat=cat;
    btn.innerHTML=`<span class="tpl-nav-dot ${meta.dotClass}"></span>${meta.label}`;
    btn.addEventListener('click',()=>{ _setModalMode('templates'); setModalCat(cat); });
    nav.appendChild(btn);
  }
  const divider=document.createElement('div');
  divider.style.cssText='height:1px;background:var(--border);margin:6px 4px;flex-shrink:0';
  nav.appendChild(divider);
  const listsBtn=document.createElement('button'); listsBtn.className='tpl-nav-item'; listsBtn.dataset.cat='__lists__';
  listsBtn.innerHTML=`<span class="tpl-nav-dot" style="background:#ffb347"></span>Lists`;
  listsBtn.addEventListener('click',()=>_setModalMode('lists'));
  nav.appendChild(listsBtn);
}

function _buildTemplateGrid(grid){
  grid.innerHTML='';
  const catOrder=[], catMeta={};
  for(const [key,tpl] of Object.entries(TEMPLATES)){
    const cat=tpl.category;
    if(!catMeta[cat]){catOrder.push(cat);catMeta[cat]=[];}
    catMeta[cat].push({key,tpl});
  }
  for(const cat of catOrder){
    const meta=CAT_META[cat]||{label:cat,dotClass:''};
    const hdr=document.createElement('div'); hdr.className='tpl-cat-header'; hdr.dataset.cat=cat;
    hdr.innerHTML=`<span class="cat-dot ${meta.dotClass}"></span>${meta.label}`;
    grid.appendChild(hdr);
    for(const {key,tpl} of catMeta[cat]){
      const card=document.createElement('div'); card.className='tpl-card'; card.dataset.key=key; card.dataset.cat=cat;
      card.innerHTML=`<div class="tpl-card-dot ${meta.dotClass}"></div><div class="tpl-card-label">${tpl.label}</div><div class="tpl-card-eq"><span class="tpl-card-eq-mq"></span></div>`;
      card.addEventListener('click',()=>selectModalTemplate(key));
      grid.appendChild(card);
      requestAnimationFrame(()=>{
        const mqSpan=card.querySelector('.tpl-card-eq-mq');
        if(mqSpan&&MQ){ try{ MQ.StaticMath(mqSpan).latex(tpl.equation); }catch(e){ mqSpan.textContent=tpl.equation; } }
        else if(mqSpan){ mqSpan.textContent=tpl.equation; }
      });
    }
  }
}

function setModalCat(cat){
  document.querySelectorAll('.tpl-card').forEach(c=>c.classList.remove('selected'));
  modalSelTpl=null;
  const footer=document.getElementById('tplModalFooter');
  if(footer){ footer.style.opacity='0.3'; footer.style.pointerEvents='none'; }
  // Only toggle category nav items, not page nav items
  document.querySelectorAll('.tpl-nav-item[data-cat]').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));
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
  if(addBtn){
    if(_templateModalContext==='variable'){
      addBtn.disabled=false;
      addBtn.innerHTML='<span>⊕</span> Create Variable';
    } else {
      addBtn.disabled=!activePid;
      addBtn.innerHTML='<span>&#8853;</span> Add to Plot';
    }
  }
  // Variable context: create immediately on selection (no extra confirm click needed)
  if(_templateModalContext==='variable') addFromModal();
}

function addFromModal(){
  // ── Variable context: create equation variable + params via syncTemplateParamsToVars ──
  if(_templateModalContext==='variable'){
    if(!modalSelTpl) return;
    const tpl=TEMPLATES[modalSelTpl]; if(!tpl) return;
    const params={};
    for(const [pk,pd] of Object.entries(tpl.params)){
      const el=document.getElementById(`mp_${pk}`);
      params[pk]=el ? parseFloat(el.value) : pd.default;
    }
    syncTemplateParamsToVars(modalSelTpl, params, _varModalScope);
    closeTemplateModal();
    return;
  }
  // ── Curve context: original behaviour ────────────────────────────────────
  if(!modalSelTpl||activePid===null) return;
  const p=activePlot(); if(!p) return;
  const params={};
  for(const [pk,pd] of Object.entries(TEMPLATES[modalSelTpl].params)){
    const el=document.getElementById(`mp_${pk}`);
    const v = el ? parseFloat(el.value) : NaN;
    params[pk] = isFinite(v) ? v : pd.default;
  }
  selTpl=modalSelTpl;
  const autoName=TEMPLATES[selTpl]?.label||selTpl;
  const curve=activeCurve();
  if(curve&&!curve.template){
    curve.template=selTpl; curve.params=params; curve.varName=null;
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

// ─── Variable-mode nav ────────────────────────────────────────────────────
function _buildVarNav(){
  const nav=document.getElementById('tplModalNav'); if(!nav) return;
  nav.innerHTML='';

  const pages=[
    { key:'constants',   color:'#a78bfa', label:'Fundamental Constants' },
    { key:'functions',   color:'#34d399', label:'Base Functions'         },
    { key:'conversions', color:'#60a5fa', label:'Unit Conversions'       },
    { key:'datasets',    color:'#f87171', label:'Sample Datasets'        },
  ];
  pages.forEach(p=>{
    const btn=document.createElement('button');
    btn.className='tpl-nav-item'+(p.key===_varModalPage?' active':'');
    btn.dataset.page=p.key;
    btn.innerHTML=`<span class="tpl-nav-dot" style="background:${p.color}"></span>${p.label}`;
    btn.addEventListener('click',()=>_setVarPage(p.key));
    nav.appendChild(btn);
  });

  // Placeholder container for template category sub-nav (Functions page only)
  const divider=document.createElement('div');
  divider.id='tplVarSubDivider';
  divider.style.cssText='height:1px;background:var(--border);margin:6px 4px;flex-shrink:0;display:none';
  nav.appendChild(divider);
  const subNav=document.createElement('div');
  subNav.id='tplVarSubNav';
  nav.appendChild(subNav);
}

function _setVarPage(page){
  _varModalPage=page;

  // Update page nav active state
  document.querySelectorAll('#tplModalNav .tpl-nav-item[data-page]').forEach(b=>{
    b.classList.toggle('active', b.dataset.page===page);
  });

  const grid   =document.getElementById('tplModalGrid');
  const lvl    =document.getElementById('lvlSection');
  const footer =document.getElementById('tplModalFooter');
  const search =document.getElementById('tplSearchWrap');
  const divider=document.getElementById('tplVarSubDivider');
  const subNav =document.getElementById('tplVarSubNav');

  // Reset transient elements
  if(lvl)     lvl.style.display='none';
  if(divider) divider.style.display='none';
  if(subNav)  subNav.innerHTML='';
  if(search)  search.style.visibility='hidden';

  if(page==='constants'){
    if(footer) footer.style.display='none';
    _buildConstantsGrid();
    if(grid) grid.style.display='';

  } else if(page==='functions'){
    // Restore footer for template selection
    if(footer){
      footer.style.display='flex';
      const has=!!(modalSelTpl&&TEMPLATES[modalSelTpl]);
      footer.style.opacity=has?'':'0.3';
      footer.style.pointerEvents=has?'':'none';
      const addBtn=document.getElementById('tplModalAddBtn');
      if(addBtn) addBtn.innerHTML='<span>⊕</span> Create Variable';
    }
    if(search) search.style.visibility='';
    // Rebuild grid with template cards (inline category headers, no left-nav sub-filter)
    if(grid){ _buildTemplateGrid(grid); grid.style.display=''; }
    setModalCat('all');
    setTimeout(()=>document.getElementById('tplSearchInp')?.focus(), 50);

  } else {
    // Conversions / Datasets — coming soon
    if(footer) footer.style.display='none';
    if(grid){
      grid.style.display='';
      grid.innerHTML='<div class="tpl-coming-soon">Coming soon…</div>';
    }
  }
}

function _buildFunctionSubNav(container){
  container.innerHTML='';
  const catOrder=[],catMeta={};
  for(const [,tpl] of Object.entries(TEMPLATES)){
    const cat=tpl.category;
    if(!catMeta[cat]){catOrder.push(cat);catMeta[cat]=true;}
  }
  const allBtn=document.createElement('button');
  allBtn.className='tpl-nav-item active'; allBtn.dataset.cat='all';
  allBtn.innerHTML=`<span class="tpl-nav-dot" style="background:var(--muted)"></span>All`;
  allBtn.addEventListener('click',()=>setModalCat('all'));
  container.appendChild(allBtn);
  for(const cat of catOrder){
    const meta=CAT_META[cat]||{label:cat,dotClass:''};
    const btn=document.createElement('button'); btn.className='tpl-nav-item'; btn.dataset.cat=cat;
    btn.innerHTML=`<span class="tpl-nav-dot ${meta.dotClass}"></span>${meta.label}`;
    btn.addEventListener('click',()=>setModalCat(cat));
    container.appendChild(btn);
  }
}

// ─── Constants grid ───────────────────────────────────────────────────────
function _buildConstantsGrid(){
  const grid=document.getElementById('tplModalGrid'); if(!grid) return;
  grid.innerHTML='';
  grid.style.gridTemplateColumns='repeat(auto-fill,minmax(190px,1fr))';

  for(const group of FUNDAMENTAL_CONSTANTS){
    const hdr=document.createElement('div');
    hdr.className='tpl-cat-header';
    hdr.innerHTML=`<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${group.color};flex-shrink:0"></span>${group.group}`;
    grid.appendChild(hdr);

    for(const cd of group.items){
      const card=document.createElement('div');
      card.className='const-card';
      card.dataset.tip=`Create variable: ${cd.varName}`;

      const symSpan=document.createElement('span');
      symSpan.className='const-card-sym-mq';
      const nameEl=document.createElement('div');  nameEl.className='const-card-name'; nameEl.textContent=cd.displayName;
      const valEl =document.createElement('div');  valEl.className ='const-card-val';  valEl.textContent=_fmtConstVal(cd.value);
      const unitEl=document.createElement('div');  unitEl.className='const-card-unit'; unitEl.textContent=cd.unit;

      const symWrap=document.createElement('div'); symWrap.className='const-card-sym';
      symWrap.appendChild(symSpan);
      card.appendChild(symWrap);
      card.appendChild(nameEl);
      card.appendChild(valEl);
      if(cd.unit) card.appendChild(unitEl);

      card.addEventListener('click',()=>_createConstantVariable(cd));
      grid.appendChild(card);

      requestAnimationFrame(()=>{
        if(MQ){ try{ MQ.StaticMath(symSpan).latex(cd.nameLatex); }catch(e){ symSpan.textContent=cd.nameLatex; } }
        else symSpan.textContent=cd.nameLatex;
      });
    }
  }
}

// Plain display format for constant values on the card (short, readable).
function _fmtConstVal(v){
  if(v===0) return '0';
  const abs=Math.abs(v);
  const exp=Math.floor(Math.log10(abs));
  if(exp>=-3&&exp<=6) return parseFloat(v.toPrecision(6)).toString();
  const c=v/Math.pow(10,exp);
  const cs=parseFloat(c.toPrecision(4)).toString();
  return `${cs}×10^${exp}`;
}

function _createConstantVariable(cd){
  const valLatex=_numToLatex(cd.value);
  const fullLatex=cd.nameLatex+'='+valLatex;
  if(typeof addVariable==='function'){
    addVariable('constant',{
      scope:      _varModalScope,
      name:       cd.varName,
      nameLatex:  cd.nameLatex,
      fullLatex,
      exprLatex:  String(cd.value),
      value:      cd.value,
      _isNumeric: true,
    });
  }
  closeTemplateModal();
}

function refreshSidebar(){
  const addBtn=document.getElementById('tplModalAddBtn');
  if(addBtn) addBtn.disabled=!activePid||!modalSelTpl;
}

// ─── Open / close ─────────────────────────────────────────────────────────
function openTemplateModal(context='curve', scope='global'){
  _templateModalContext=context;
  _varModalScope=scope;

  const titleSpan=document.querySelector('.tpl-modal-title span');
  const addBtn=document.getElementById('tplModalAddBtn');

  if(context==='variable'){
    if(titleSpan) titleSpan.textContent='Templates';
    _varModalPage='constants';
    _buildVarNav();
    _setVarPage('constants');
  } else {
    if(titleSpan) titleSpan.textContent='Add Curve';
    if(addBtn){ addBtn.disabled=!activePid||!modalSelTpl; addBtn.innerHTML='<span>&#8853;</span> Add to Plot'; }
    _setModalMode(_modalMode);
    setTimeout(()=>{ if(_modalMode==='templates') document.getElementById('tplSearchInp')?.focus(); },50);
  }

  document.getElementById('tplModalBackdrop')?.classList.add('open');
}

function closeTemplateModal(){
  document.getElementById('tplModalBackdrop')?.classList.remove('open');
}

function wireTemplateModal(){
  document.getElementById('tplModalClose')?.addEventListener('click',closeTemplateModal);
  document.getElementById('tplModalBackdrop')?.addEventListener('click',e=>{
    if(e.target===document.getElementById('tplModalBackdrop')) closeTemplateModal();
  });
  document.getElementById('tplModalAddBtn')?.addEventListener('click',()=>{
    if(_templateModalContext==='variable') addFromModal();
    else if(_modalMode==='lists') addListCurve();
    else addFromModal();
  });
  document.getElementById('tplSearchInp')?.addEventListener('input',function(){ filterModalTemplates(this.value); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeTemplateModal(); });
  document.getElementById('lvlAddBtn')?.addEventListener('click',addListCurve);
}

// ─── List vs List ──────────────────────────────────────────────────────────
let _lvlXName=null;
let _lvlYName=null;
let _modalMode='templates'; // 'templates' | 'lists'  (curve context only)

function _setModalMode(mode){
  _modalMode=mode;
  const grid  =document.getElementById('tplModalGrid');
  const lvl   =document.getElementById('lvlSection');
  const footer=document.getElementById('tplModalFooter');
  const search=document.getElementById('tplSearchWrap')||document.querySelector('.tpl-modal-search-wrap');
  const isLists=mode==='lists';
  if(grid)   grid.style.display  =isLists?'none':'';
  if(search) search.style.visibility=isLists?'hidden':'';
  if(lvl){
    lvl.style.display=isLists?'flex':'none';
    if(isLists) refreshLvlSection();
  }
  if(footer){
    footer.style.display='flex';
    if(!isLists){
      const hasTemplate=!!(modalSelTpl&&TEMPLATES[modalSelTpl]);
      footer.style.opacity=hasTemplate?'':'0.3';
      footer.style.pointerEvents=hasTemplate?'':'none';
    }
  }
  document.querySelectorAll('.tpl-nav-item[data-cat]').forEach(b=>{
    if(isLists) b.classList.toggle('active',b.dataset.cat==='__lists__');
  });
}

function refreshLvlSection(){
  const section=document.getElementById('lvlSection'); if(!section) return;
  const lists=(typeof variables!=='undefined')?variables.filter(v=>v.kind==='list'&&v.name):[];
  if(!lists.length){ section.style.display='none'; return; }
  if(_modalMode==='lists') section.style.display='flex';
  if(_lvlXName&&!lists.find(v=>v.name===_lvlXName)) _lvlXName=null;
  if(_lvlYName&&!lists.find(v=>v.name===_lvlYName)) _lvlYName=null;
  const hint   =document.getElementById('lvlHint');
  const xRow   =document.getElementById('lvlXRow');
  const yRow   =document.getElementById('lvlYRow');
  const addBtn =document.getElementById('lvlAddBtn');
  const mainBtn=document.getElementById('tplModalAddBtn');
  const mainInfo=document.getElementById('tplModalSelectedInfo');
  const footer =document.getElementById('tplModalFooter');
  xRow.innerHTML='';
  lists.forEach(v=>{
    const card=document.createElement('button');
    card.className='lvl-var-card'+(v.name===_lvlXName?' lvl-selected-x':'');
    card.textContent=`${v.name} [${v.listItems.length}]`;
    card.addEventListener('click',()=>{ _lvlXName=(_lvlXName===v.name)?null:v.name; if(_lvlXName===_lvlYName) _lvlYName=null; refreshLvlSection(); });
    xRow.appendChild(card);
  });
  if(!_lvlXName){
    hint.textContent='Select an X variable';
    yRow.style.display='none';
    if(addBtn) addBtn.disabled=true;
    if(mainBtn&&_modalMode==='lists'){ mainBtn.disabled=true; }
    if(footer&&_modalMode==='lists'){ footer.style.opacity='0.3'; footer.style.pointerEvents='none'; }
    return;
  }
  const xLen=lists.find(v=>v.name===_lvlXName)?.listItems.length??0;
  const yLists=lists.filter(v=>v.name!==_lvlXName);
  yRow.style.display='flex'; yRow.innerHTML='';
  yLists.forEach(v=>{
    const sameLen=v.listItems.length===xLen;
    const card=document.createElement('button');
    card.className='lvl-var-card'+(v.name===_lvlYName?' lvl-selected-y':'')+(!sameLen?' lvl-disabled':'');
    card.textContent=`${v.name} [${v.listItems.length}]`;
    if(sameLen){ card.addEventListener('click',()=>{ _lvlYName=(_lvlYName===v.name)?null:v.name; refreshLvlSection(); }); }
    yRow.appendChild(card);
  });
  if(!_lvlYName){
    hint.textContent=`X = ${_lvlXName} (${xLen} pts) — select Y`;
    if(addBtn) addBtn.disabled=true;
    if(mainBtn&&_modalMode==='lists'){ mainBtn.disabled=true; }
    if(footer&&_modalMode==='lists'){ footer.style.opacity='0.3'; footer.style.pointerEvents='none'; }
  } else {
    hint.textContent=`${_lvlXName} vs ${_lvlYName} (${xLen} pts)`;
    if(addBtn) addBtn.disabled=!activePid;
    if(_modalMode==='lists'){
      if(mainBtn){ mainBtn.disabled=!activePid; }
      if(mainInfo) mainInfo.innerHTML=`<strong>${_lvlYName} vs ${_lvlXName}</strong><br><em>${xLen} data points</em>`;
      if(footer){ footer.style.opacity=activePid?'':'0.3'; footer.style.pointerEvents=activePid?'':'none'; }
    }
  }
}

function addListCurve(){
  if(!_lvlXName||!_lvlYName||activePid===null) return;
  const xVar=variables.find(v=>v.name===_lvlXName);
  const yVar=variables.find(v=>v.name===_lvlYName);
  if(!xVar||!yVar) return;
  const p=activePlot(); if(!p) return;
  const nc=defCurve(p.curves);
  nc.name=`${_lvlYName} vs ${_lvlXName}`;
  nc.jsData={x:[...xVar.listItems],y:[...yVar.listItems],discrete:false};
  nc.listXName=_lvlXName; nc.listYName=_lvlYName;
  p.curves.push(nc);
  activeCurveIdx=p.curves.length-1;
  const xs=xVar.listItems,ys=yVar.listItems;
  const xPad=(Math.max(...xs)-Math.min(...xs))*0.06||0.5;
  const yPad=(Math.max(...ys)-Math.min(...ys))*0.06||0.5;
  if(p.view.x_min==null){
    p.view.x_min=Math.min(...xs)-xPad; p.view.x_max=Math.max(...xs)+xPad;
    p.view.y_min=Math.min(...ys)-yPad; p.view.y_max=Math.max(...ys)+yPad;
  }
  closeTemplateModal();
  drawChart(p); updateTopbar(p.id); refreshOverlayLegend(p.id); refreshLineCurveSelector(); refreshCfg();
  snapshotForUndo();
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
