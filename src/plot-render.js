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
  for(const pk of Object.keys(TEMPLATES[modalSelTpl].params)){
    const el=document.getElementById(`mp_${pk}`); if(el) params[pk]=parseFloat(el.value);
  }
  selTpl=modalSelTpl;
  const autoName=TEMPLATES[selTpl]?.label||selTpl;
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
    // Build template category sub-nav below the page items
    if(divider) divider.style.display='';
    if(subNav)  _buildFunctionSubNav(subNav);
    // Rebuild grid with template cards
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
      card.title=`Click to create variable: ${cd.varName}`;

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
// ═══ ADD CURVE MODAL (Function / Dataset picker) ══════════════════════════

let _acMode = 'function';
let _acSelVarName = null;
let _acListXName = null;
let _acListYName = null;

function buildAddCurveModal(){
  if(document.getElementById('ac-modal')) return;
  const el=document.createElement('div');
  el.id='ac-modal'; el.className='ac-modal-backdrop';
  el.innerHTML=`
    <div class="ac-modal">
      <div class="ac-modal-header">
        <div class="ac-modal-title"><em>Add</em> Curve</div>
        <button class="ac-modal-close" id="ac-close">✕</button>
      </div>
      <div class="ac-tabs">
        <button class="ac-tab active" data-mode="function">ƒ&nbsp; Function</button>
        <button class="ac-tab" data-mode="list">[ ]&nbsp; List</button>
        <button class="ac-tab" data-mode="dataset">⊞&nbsp; Dataset</button>
      </div>
      <div class="ac-modal-body" id="ac-body"></div>
      <div class="ac-modal-footer">
        <span class="ac-sel-info" id="ac-sel-info">Select an equation variable above</span>
        <button class="ac-add-btn" id="ac-add-btn" disabled>⊕ Add to Plot</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  document.getElementById('ac-close').addEventListener('click', closeAddCurveModal);
  el.addEventListener('click', e=>{ if(e.target===el) closeAddCurveModal(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeAddCurveModal(); });
  el.querySelectorAll('.ac-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>_setAcMode(tab.dataset.mode));
  });
  document.getElementById('ac-add-btn').addEventListener('click', _onAcAdd);
}

function _setAcMode(mode){
  _acMode=mode; _acSelVarName=null; _acListXName=null; _acListYName=null;
  document.querySelectorAll('.ac-tab').forEach(t=>t.classList.toggle('active', t.dataset.mode===mode));
  refreshAcBody();
}

function refreshAcBody(){
  const body=document.getElementById('ac-body'); if(!body) return;
  const addBtn=document.getElementById('ac-add-btn');
  const selInfo=document.getElementById('ac-sel-info');

  if(_acMode==='dataset'){
    body.innerHTML='<div class="ac-placeholder">Plotting from datasets coming soon…</div>';
    if(addBtn) addBtn.disabled=true;
    if(selInfo) selInfo.textContent='';
    return;
  }

  if(_acMode==='list'){
    const lists=(typeof variables!=='undefined')?variables.filter(v=>v.kind==='list'&&v.name):[];
    if(!lists.length){
      body.innerHTML='<div class="ac-empty">No list variables defined yet.<br>Add one in the Variables panel on the left.</div>';
      if(addBtn) addBtn.disabled=true;
      if(selInfo) selInfo.textContent='No list variables available';
      return;
    }
    const wrap=document.createElement('div'); wrap.className='ac-list-wrap';
    const xHint=document.createElement('div'); xHint.className='lvl-hint';
    xHint.textContent=_acListXName?`X = ${_acListXName} — now select Y`:'Select X variable';
    wrap.appendChild(xHint);
    const xRow=document.createElement('div'); xRow.className='lvl-picker-row';
    lists.forEach(v=>{
      const card=document.createElement('button');
      card.className='lvl-var-card'+(_acListXName===v.name?' lvl-selected-x':'');
      card.textContent=`${v.name} [${v.listItems.length}]`;
      card.addEventListener('click',()=>{
        _acListXName=(_acListXName===v.name)?null:v.name;
        if(_acListXName===_acListYName) _acListYName=null;
        refreshAcBody();
      });
      xRow.appendChild(card);
    });
    wrap.appendChild(xRow);
    if(_acListXName){
      const xLen=lists.find(v=>v.name===_acListXName)?.listItems.length??0;
      const yHint=document.createElement('div'); yHint.className='lvl-hint';
      yHint.textContent=_acListYName?`${_acListYName} vs ${_acListXName} (${xLen} pts)`:'Select Y variable';
      wrap.appendChild(yHint);
      const yRow=document.createElement('div'); yRow.className='lvl-picker-row';
      lists.filter(v=>v.name!==_acListXName).forEach(v=>{
        const sameLen=v.listItems.length===xLen;
        const card=document.createElement('button');
        card.className='lvl-var-card'+(_acListYName===v.name?' lvl-selected-y':'')+(!sameLen?' lvl-disabled':'');
        card.textContent=`${v.name} [${v.listItems.length}]`;
        if(sameLen) card.addEventListener('click',()=>{ _acListYName=(_acListYName===v.name)?null:v.name; refreshAcBody(); });
        yRow.appendChild(card);
      });
      wrap.appendChild(yRow);
    }
    body.innerHTML=''; body.appendChild(wrap);
    const ready=!!(activePid&&_acListXName&&_acListYName);
    if(addBtn) addBtn.disabled=!ready;
    if(selInfo) selInfo.textContent=ready
      ? `${_acListYName} vs ${_acListXName}`
      : (_acListXName?'Select Y variable':'Select X variable');
    return;
  }

  // Function mode
  const eqVars=(typeof variables!=='undefined')?variables.filter(v=>v.kind==='equation'&&v.name&&v.exprLatex):[];
  if(!eqVars.length){
    body.innerHTML='<div class="ac-empty">No equation variables defined yet.<br>Add one in the Variables panel on the left.</div>';
    if(addBtn) addBtn.disabled=true;
    if(selInfo) selInfo.textContent='No equation variables available';
    return;
  }
  const grid=document.createElement('div'); grid.className='ac-var-grid';
  eqVars.forEach(v=>{
    const card=document.createElement('div');
    card.className='ac-var-card'+(v.name===_acSelVarName?' selected':'');
    card.innerHTML=`<div class="ac-var-name">${v.name}</div><div class="ac-var-expr">= ${v.exprLatex}</div>`;
    card.addEventListener('click',()=>{ _acSelVarName=(_acSelVarName===v.name)?null:v.name; refreshAcBody(); });
    grid.appendChild(card);
  });
  body.innerHTML=''; body.appendChild(grid);
  const sel=_acSelVarName?eqVars.find(v=>v.name===_acSelVarName):null;
  if(addBtn) addBtn.disabled=!sel||!activePid;
  if(selInfo) selInfo.textContent=sel?`${sel.name} = ${sel.exprLatex}`:'Select an equation variable above';
}

function _onAcAdd(){
  if(_acMode==='list') _addFromAcList();
  else addFromEquationVar();
}

function _addFromAcList(){
  if(!_acListXName||!_acListYName||activePid===null) return;
  const xVar=(typeof variables!=='undefined')?variables.find(v=>v.name===_acListXName):null;
  const yVar=(typeof variables!=='undefined')?variables.find(v=>v.name===_acListYName):null;
  if(!xVar||!yVar) return;
  const p=gp(activePid); if(!p) return;
  const nc=defCurve(p.curves);
  nc.name=`${_acListYName} vs ${_acListXName}`;
  nc.jsData={x:[...xVar.listItems], y:[...yVar.listItems], discrete:false};
  nc.listXName=_acListXName; nc.listYName=_acListYName;
  p.curves.push(nc); activeCurveIdx=p.curves.length-1;
  const xs=xVar.listItems, ys=yVar.listItems;
  if(p.view.x_min==null){
    const xPad=(Math.max(...xs)-Math.min(...xs))*0.06||0.5;
    const yPad=(Math.max(...ys)-Math.min(...ys))*0.06||0.5;
    p.view.x_min=Math.min(...xs)-xPad; p.view.x_max=Math.max(...xs)+xPad;
    p.view.y_min=Math.min(...ys)-yPad; p.view.y_max=Math.max(...ys)+yPad;
  }
  closeAddCurveModal();
  drawChart(p); updateTopbar(p.id); refreshOverlayLegend(p.id); refreshLineCurveSelector(); refreshCfg();
  snapshotForUndo();
}

function openAddCurveModal(){
  buildAddCurveModal();
  _acSelVarName=null; _setAcMode('function');
  document.getElementById('ac-modal').classList.add('open');
}

function closeAddCurveModal(){
  document.getElementById('ac-modal')?.classList.remove('open');
  _acSelVarName=null;
}

function addFromEquationVar(){
  if(!_acSelVarName||activePid===null) return;
  const p=gp(activePid); if(!p) return;
  const v=(typeof variables!=='undefined')?variables.find(v=>v.name===_acSelVarName&&v.kind==='equation'):null;
  if(!v) return;
  const nc=defCurve(p.curves);
  nc.varName=_acSelVarName; nc.name=v.name;
  p.curves.push(nc); activeCurveIdx=p.curves.length-1;
  closeAddCurveModal();
  renderJS(p.id, p.view.x_min==null);
  updateTopbar(p.id); refreshOverlayLegend(p.id); refreshLineCurveSelector(); refreshCfg();
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

// ═══ CHART INTERACTIONS ══════════════════════════════════════════════════
// Use Chart.js's built-in getValueForPixel so both linear and log axes
// invert correctly — no manual interpolation needed.
function pixelToData(ch, clientX, clientY){
  const canvas=ch.canvas, rect=canvas.getBoundingClientRect();
  const scaleX=rect.width/canvas.width, scaleY=rect.height/canvas.height;
  const px=(clientX-rect.left)/scaleX, py=(clientY-rect.top)/scaleY;
  return {
    dataX: ch.scales.x.getValueForPixel(px),
    dataY: ch.scales.y.getValueForPixel(py),
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
    // Only zoom when this plot is the active (selected) one.
    // If it isn't, let the event bubble so the plot list scrolls normally.
    if(p.id !== activePid) return;
    if(p.view?.locked) return;
    e.preventDefault();
    const ch = chartInstances[p.id]; if(!ch) return;
    const {dataX, dataY} = pixelToData(ch, e.clientX, e.clientY);
    const factor = e.deltaY > 0 ? 1.15 : 1/1.15; // >1 zooms out
    const v = p.view;

    // Zoom each axis in its own space: log axes scale multiplicatively, linear additively.
    if(v.x_log){
      const la = Math.log(Math.max(dataX, MIN_LOG_VAL));
      v.x_min = Math.exp(la + (Math.log(Math.max(v.x_min, MIN_LOG_VAL)) - la) * factor);
      v.x_max = Math.exp(la + (Math.log(Math.max(v.x_max, MIN_LOG_VAL)) - la) * factor);
    } else {
      v.x_min = dataX + (v.x_min - dataX) * factor;
      v.x_max = dataX + (v.x_max - dataX) * factor;
    }

    if(v.y_log){
      const la = Math.log(Math.max(dataY, MIN_LOG_VAL));
      v.y_min = Math.exp(la + (Math.log(Math.max(v.y_min, MIN_LOG_VAL)) - la) * factor);
      v.y_max = Math.exp(la + (Math.log(Math.max(v.y_max, MIN_LOG_VAL)) - la) * factor);
    } else {
      v.y_min = dataY + (v.y_min - dataY) * factor;
      v.y_max = dataY + (v.y_max - dataY) * factor;
    }

    clampLogLimits(v);
    applyScaleLimits(ch.options.scales, v); ch.update('none'); syncCfgDomain(); renderJS(p.id, false);
  }, {passive:false});
  wrap.addEventListener('mousedown', e=>{
    if(e.button!==0) return;
    if(p.view?.locked) return;
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
  const v = p.view;

  // X-axis: log → shift by a ratio (uniform translation in log space);
  //         linear → shift by a linear delta.
  if(v.x_log){
    const logSpan = Math.log(v.x_max) - Math.log(v.x_min);
    const dLog = (dx / xPx) * logSpan; // positive dx → shift domain left
    v.x_min = Math.exp(Math.log(v.x_min) - dLog);
    v.x_max = Math.exp(Math.log(v.x_max) - dLog);
  } else {
    const dxD = (dx / xPx) * (v.x_max - v.x_min);
    v.x_min -= dxD;
    v.x_max -= dxD;
  }

  // Y-axis: positive dy (mouse down in pixels) → shift domain up (see higher y values).
  if(v.y_log){
    const logSpan = Math.log(v.y_max) - Math.log(v.y_min);
    const dLog = (dy / yPx) * logSpan; // positive dy → shift domain up
    v.y_min = Math.exp(Math.log(v.y_min) + dLog);
    v.y_max = Math.exp(Math.log(v.y_max) + dLog);
  } else {
    const dyD = (dy / yPx) * (v.y_max - v.y_min);
    v.y_min += dyD;
    v.y_max += dyD;
  }

  clampLogLimits(v);
  applyScaleLimits(ch.options.scales, v); ch.update('none'); syncCfgDomain(); renderJS(p.id, false);
}

function endPan(p){
  if(!panState[p.id]?.dragging) return;
  panState[p.id].dragging = false;
  const wrap = document.getElementById(`cwrap_${p.id}`); if(wrap) wrap.classList.remove('panning');
}
