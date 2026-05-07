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
    </div>`;
  document.body.appendChild(el);
  document.getElementById('ac-close').addEventListener('click', closeAddCurveModal);
  el.addEventListener('click', e=>{ if(e.target===el) closeAddCurveModal(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeAddCurveModal(); });
  el.querySelectorAll('.ac-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>_setAcMode(tab.dataset.mode));
  });
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
        if(sameLen) card.addEventListener('click',()=>{
          if(_acListYName===v.name){ _acListYName=null; refreshAcBody(); }
          else { _acListYName=v.name; _addFromAcList(); }
        });
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
    card.addEventListener('click',()=>{ _acSelVarName=v.name; addFromEquationVar(); });
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
