// ═══ VARIABLE STATE ══════════════════════════════════════════════════════
const variables = [];
let varIdCtr = 0;

function addVariable(kind='constant', opts={}){
  const v = {
    id: ++varIdCtr, kind,
    name:      opts.name      || '',
    nameLatex: opts.nameLatex || '',
    fullLatex: opts.fullLatex || '',
    exprLatex: opts.exprLatex || '',
    value:     opts.value     ?? 0,
    paramMin:  opts.paramMin  ?? -10,
    paramMax:  opts.paramMax  ?? 10,
    listLength: opts.listLength ?? 3,
    listItems:  opts.listItems  ? [...opts.listItems] : [0, 0, 0],
    fromTemplate: opts.fromTemplate || false,
    templateKey:  opts.templateKey  || null,
    paramKey:     opts.paramKey     || null,
    pickleSource: opts.pickleSource || null,
  };
  variables.push(v);
  renderVariables();
  if(!opts.silent){
    if(typeof snapshotForUndo === 'function') snapshotForUndo();
    // Focus the new MQ field after DOM settles
    setTimeout(()=>{
      const mq = document.querySelector(`#vmq_${v.id} .mq-editable-field`);
      if(mq) mq.click();
    }, 80);
  }
  return v;
}

function removeVariable(id){
  const idx = variables.findIndex(x=>x.id===id);
  if(idx > -1) variables.splice(idx, 1);
  renderVariables();
  if(typeof snapshotForUndo === 'function') snapshotForUndo();
}

// Remove all variables that were imported from a given file.
function removeVariablesBySource(sourceName){
  let changed = false;
  for(let i = variables.length - 1; i >= 0; i--){
    if(variables[i].pickleSource === sourceName){
      variables.splice(i, 1);
      changed = true;
    }
  }
  if(changed) renderVariables();
}

// ═══ VAR TYPE PICKER ═════════════════════════════════════════════════════
let _varTypePicker = null;

function showVarTypePicker(){
  hideVarTypePicker();
  const btn = document.getElementById('varsAddBtn'); if(!btn) return;
  const picker = document.createElement('div');
  picker.id = 'var-type-picker';
  picker.style.cssText = [
    'position:fixed','z-index:99998',
    'background:#0e0e1c','border:1px solid #3a3a6a','border-radius:8px',
    'box-shadow:0 8px 28px rgba(0,0,0,.55)',
    'font-family:var(--mono,monospace)','font-size:.8rem',
    'min-width:178px','overflow:hidden','padding:4px 0',
  ].join(';');
  _varTypePicker = picker;

  const types = [
    { key:'constant', icon:'α',   label:'Constant', desc:'Number or expression' },
    { key:'equation', icon:'ƒ',   label:'Equation', desc:'Function of x'        },
    { key:'list',     icon:'[ ]', label:'List',     desc:'Fixed-length sequence' },
  ];
  types.forEach(t=>{
    const row = document.createElement('button');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;background:transparent;border:none;padding:9px 14px;cursor:pointer;transition:background .08s;text-align:left;';
    row.innerHTML = `<span style="font-size:1.05rem;width:22px;text-align:center;flex-shrink:0;color:#5affce;opacity:.85">${t.icon}</span>`
      + `<span><span style="color:#d0d0ee;font-size:.8rem;display:block">${t.label}</span>`
      + `<span style="color:#5a5a90;font-size:.68rem">${t.desc}</span></span>`;
    row.addEventListener('mouseenter', ()=>{ row.style.background='rgba(90,255,206,.07)'; });
    row.addEventListener('mouseleave', ()=>{ row.style.background='transparent'; });
    row.addEventListener('mousedown', e=>{ e.preventDefault(); e.stopPropagation(); });
    row.addEventListener('click', e=>{ e.stopPropagation(); hideVarTypePicker(); addVariable(t.key); });
    picker.appendChild(row);
  });

  document.body.appendChild(picker);
  const rect = btn.getBoundingClientRect();
  picker.style.top   = (rect.bottom + 6) + 'px';
  picker.style.right = (window.innerWidth - rect.right) + 'px';
}

function hideVarTypePicker(){
  if(_varTypePicker){ _varTypePicker.remove(); _varTypePicker = null; }
}

// ═══ DRAG-TO-REORDER ═════════════════════════════════════════════════════
let _varDrag = null; // { srcIdx, srcItem, clone, placeholder, offX, offY, list }

function _varDragStart(e, item, idx){
  const list = document.getElementById('varsList'); if(!list) return;
  const rect  = item.getBoundingClientRect();

  // Floating clone follows the pointer
  const clone = item.cloneNode(true);
  clone.style.cssText = [
    'position:fixed','z-index:99999','pointer-events:none',
    `width:${rect.width}px`,`left:${rect.left}px`,`top:${rect.top}px`,
    'margin:0','opacity:0.92',
    'box-shadow:0 8px 32px rgba(0,0,0,.55)',
    'border-color:var(--acc2)','transition:none',
  ].join(';');
  document.body.appendChild(clone);

  // Placeholder occupies the original item's slot while dragging
  const ph = document.createElement('div');
  ph.className  = 'var-drag-placeholder';
  ph.style.height = rect.height + 'px';
  item.before(ph);
  item.style.display = 'none';

  _varDrag = { srcIdx: idx, srcItem: item, clone, placeholder: ph, offX: e.clientX - rect.left, offY: e.clientY - rect.top, list, committed: false };
  document.addEventListener('pointermove', _varDragMove);
  document.addEventListener('pointerup',   _varDragEnd);
}

function _varDragMove(e){
  if(!_varDrag) return;
  const { clone, placeholder, offX, offY, list } = _varDrag;

  clone.style.left = (e.clientX - offX) + 'px';
  clone.style.top  = (e.clientY - offY) + 'px';

  // Move placeholder to the closest item boundary
  const items = [...list.querySelectorAll('.var-item')].filter(el=>el.style.display !== 'none');
  let target = null;
  for(const el of items){
    const r = el.getBoundingClientRect();
    if(e.clientY >= r.top && e.clientY <= r.bottom){ target = el; break; }
  }
  if(target){
    const r = target.getBoundingClientRect();
    if(e.clientY < r.top + r.height / 2){
      if(placeholder.nextSibling !== target) list.insertBefore(placeholder, target);
    } else {
      if(target.nextSibling !== placeholder) list.insertBefore(placeholder, target.nextSibling);
    }
  }
}

function _varDragEnd(e){
  if(!_varDrag) return;
  document.removeEventListener('pointermove', _varDragMove);
  document.removeEventListener('pointerup',   _varDragEnd);

  const { srcIdx, srcItem, clone, placeholder, list } = _varDrag;
  clone.remove();
  srcItem.style.display = '';

  if(placeholder.parentNode === list){
    const sibs    = [...list.children];
    const phPos   = sibs.indexOf(placeholder);
    let destIdx   = sibs.slice(0, phPos).filter(el=>el.classList.contains('var-item')).length;
    if(destIdx > srcIdx) destIdx--;

    placeholder.remove();
    _varDrag = null;

    if(destIdx !== srcIdx){
      const [moved] = variables.splice(srcIdx, 1);
      variables.splice(destIdx, 0, moved);
      renderVariables();
      reEvalAllConstants();
      if(typeof snapshotForUndo === 'function') snapshotForUndo();
    }
  } else {
    placeholder.remove();
    _varDrag = null;
  }
}

// ═══ WARNING SYSTEM ══════════════════════════════════════════════════════
// Tracks duplicate-name and invalid-expression warnings for one variable.
// Duplicate-name takes display priority over invalid-expression.
class VarWarning {
  constructor(varId){
    this.varId      = varId;
    this._dupMsg    = null;
    this._invalidMsg = null;
  }
  get active(){ return this._dupMsg !== null; }
  set(msg){         this._dupMsg    = msg;  this._apply(); }
  clear(){          this._dupMsg    = null; this._apply(); }
  setInvalid(msg){  this._invalidMsg = msg; this._apply(); }
  clearInvalid(){   this._invalidMsg = null; this._apply(); }
  _apply(){
    const btn = document.querySelector(`.var-warn-btn[data-vid="${this.varId}"]`);
    if(!btn) return;
    // Tip may be a detached body element — use stored reference if available
    const tip = btn._tipEl || btn.querySelector('.var-warn-tip');
    const msg = this._dupMsg || this._invalidMsg; // duplicate takes priority
    if(msg){
      btn.classList.add('var-warn-active');
      if(tip) tip.textContent = msg;
    } else {
      btn.classList.remove('var-warn-active');
      if(tip) tip.textContent = 'No errors';
    }
  }
}

// Check all variables for duplicate names and update their warning state.
function checkAllWarnings(){
  const nameOwner = new Map(); // name → id of first variable that defined it
  for(const v of variables){
    if(!v.name) continue;
    if(!nameOwner.has(v.name)) nameOwner.set(v.name, v.id);
  }
  for(const v of variables){
    if(!v._warning) v._warning = new VarWarning(v.id);
    if(v.name && nameOwner.get(v.name) !== v.id){
      v._warning.set(`"${v.name}" is already defined`);
    } else {
      v._warning.clear();
    }
  }
}

// Re-evaluate all constant variables (call after any context-affecting change).
function reEvalAllConstants(){
  for(const v of variables){
    if(v.kind === 'constant') evaluateConstant(v);
  }
}

// ═══ RENDER VARIABLES LIST ═══════════════════════════════════════════════
function renderVariables(){
  const list  = document.getElementById('varsList'); if(!list) return;
  const empty = document.getElementById('varsEmpty');
  if(empty) empty.style.display = variables.length ? 'none' : 'flex';

  // Remove any detached tooltip elements from the previous render
  document.querySelectorAll('body > .var-warn-tip').forEach(el => el.remove());
  list.innerHTML = '';

  variables.forEach((v, idx)=>{
    const item = document.createElement('div');
    item.className   = `var-item var-item-${v.kind}`;
    item.dataset.vid = v.id;

    // ── Drag handle ──────────────────────────────────────────────────────
    const handle = document.createElement('div');
    handle.className  = 'var-drag-handle';
    handle.textContent = '⠿';
    handle.title      = 'Drag to reorder';
    item.appendChild(handle);

    // ── Inner content column ─────────────────────────────────────────────
    const inner = document.createElement('div');
    inner.className = 'var-item-inner';
    item.appendChild(inner);

    handle.addEventListener('pointerdown', e=>{
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      _varDragStart(e, item, idx);
    });

    // Highlight the item border when any child is focused
    item.addEventListener('focusin',  ()=> item.classList.add('var-item--focused'));
    item.addEventListener('focusout', ()=> item.classList.remove('var-item--focused'));

    // ── Warning button + tooltip ─────────────────────────────────────────
    const warnBtn = document.createElement('div');
    warnBtn.className = 'var-warn-btn';
    warnBtn.dataset.vid = v.id;
    warnBtn.innerHTML   = '&#9888;';
    warnBtn.setAttribute('aria-label', 'No errors');

    // Tooltip lives on document.body to escape the item's stacking context
    const warnTip = document.createElement('div');
    warnTip.className   = 'var-warn-tip';
    warnTip.textContent = 'No errors';
    document.body.appendChild(warnTip);

    const _positionTip = ()=>{
      const r = warnBtn.getBoundingClientRect();
      warnTip.style.top  = (r.bottom + 4) + 'px';
      warnTip.style.left = r.left + 'px';
    };
    const _showTip = ()=>{ _positionTip(); warnTip.style.display = 'block'; };
    const _hideTip = ()=>{ if(!warnBtn.classList.contains('var-warn-pinned')) warnTip.style.display = 'none'; };

    warnBtn.addEventListener('mouseenter', _showTip);
    warnBtn.addEventListener('mouseleave', _hideTip);
    warnBtn.addEventListener('click', e=>{
      e.stopPropagation();
      const pinned = warnBtn.classList.toggle('var-warn-pinned');
      if(pinned){ _positionTip(); warnTip.style.display = 'block'; }
      else { warnTip.style.display = 'none'; }
    });
    // Dismiss pinned tooltip on any outside click
    document.addEventListener('click', ()=>{
      warnBtn.classList.remove('var-warn-pinned');
      warnTip.style.display = 'none';
    });
    warnBtn._tipEl = warnTip; // store reference for VarWarning._apply

    item.appendChild(warnBtn);

    // Click on the item background → focus the primary MQ field
    item.addEventListener('mousedown', e=>{
      if(e.button !== 0) return;
      const blocked = e.target.closest(
        'input[type="range"], input[type="number"], input[type="text"], ' +
        'button, .var-drag-handle, .var-warn-btn, .var-list-cell, ' +
        '.var-list-leninp, .var-param-bound'
      );
      if(blocked) return;
      if(e.target.closest('.mq-editable-field')) return;
      e.preventDefault();
      const mqField = item.querySelector('.mq-editable-field');
      if(mqField) mqField.click();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'var-item-del';
    delBtn.innerHTML = '✕';
    delBtn.addEventListener('click', e=>{ e.stopPropagation(); removeVariable(v.id); });

    if(v.kind === 'list'){
      // List: two-row header — [badge · source-tag · del] and [name MQ · length]
      const headerTop = document.createElement('div');
      headerTop.className = 'var-item-header';
      const badge = document.createElement('span');
      badge.className   = `var-kind-badge var-kind-${v.kind}`;
      badge.textContent = 'List';
      headerTop.appendChild(badge);
      if(v.pickleSource){
        const srcTag = document.createElement('span');
        srcTag.className   = 'var-source-tag';
        srcTag.textContent = v.pickleSource;
        srcTag.title       = `Imported from ${v.pickleSource}`;
        headerTop.appendChild(srcTag);
      }
      headerTop.appendChild(delBtn);
      inner.appendChild(headerTop);

      const headerBot = document.createElement('div');
      headerBot.className = 'var-list-subheader';

      const nameMqWrap = document.createElement('div');
      nameMqWrap.className = 'var-list-name-mq';
      nameMqWrap.id = `vnamemq_${v.id}`;

      const lenWrap  = document.createElement('div');
      lenWrap.className = 'var-list-lenrow';
      const lenLabel = document.createElement('span');
      lenLabel.className   = 'var-list-lenlabel';
      lenLabel.textContent = 'n =';
      const lenInp = document.createElement('input');
      lenInp.type  = 'number'; lenInp.className = 'var-list-leninp';
      lenInp.id    = `vlen_${v.id}`; lenInp.value = v.listLength;
      lenInp.min   = 1; lenInp.max = 999; lenInp.step = 1;

      headerBot.appendChild(nameMqWrap);
      lenWrap.appendChild(lenLabel);
      lenWrap.appendChild(lenInp);
      headerBot.appendChild(lenWrap);
      inner.appendChild(headerBot);

      // Init MQ for the list name field after element is in DOM
      requestAnimationFrame(()=>{
        if(!MQ) return;
        try{
          const nameMf = MQ.MathField(nameMqWrap, {
            spaceBehavesLikeTab: true,
            handlers:{
              edit(){
                const raw = nameMf.latex().replace(/[\\{}\s]/g,'').replace(/left|right/g,'').trim();
                if(raw) v.name = raw;
                reEvalAllConstants();
                updateLatexDropdown(nameMf, nameMqWrap, nameMqWrap);
              }
            }
          });
          nameMf.latex(v.name || '');
          wrapMathFieldWithAC(nameMqWrap, nameMf);
        }catch(e){}
      });

      buildListBody(inner, v, lenInp);

    } else {
      // Constant / parameter / equation: single header row
      const header = document.createElement('div');
      header.className = 'var-item-header';
      const badge = document.createElement('span');
      badge.className   = `var-kind-badge var-kind-${v.kind}`;
      badge.textContent = v.kind === 'constant'
        ? 'Const'
        : v.kind.charAt(0).toUpperCase() + v.kind.slice(1);
      header.appendChild(badge);
      if(v.pickleSource){
        const srcTag = document.createElement('span');
        srcTag.className   = 'var-source-tag';
        srcTag.textContent = v.pickleSource;
        srcTag.title       = `Imported from ${v.pickleSource}`;
        header.appendChild(srcTag);
      }
      header.appendChild(delBtn);
      inner.appendChild(header);

      if(v.kind === 'constant')       buildConstantBody(inner, v);
      else if(v.kind === 'parameter') buildParameterBody(inner, v);
      else if(v.kind === 'equation')  buildEquationBody(inner, v);
    }

    list.appendChild(item);
  });

  // Apply warning states after DOM and MQ init complete
  requestAnimationFrame(()=> checkAllWarnings());
}

// ═══ CONSTANT BODY ═══════════════════════════════════════════════════════
// One MathField for "name = expr". Shows a slider when RHS is a plain number,
// or the evaluated result below when RHS is an expression.
function buildConstantBody(item, v){
  const mqWrap = document.createElement('div');
  mqWrap.className = 'var-mq-wrap var-mq-single-line';
  mqWrap.id = `vmq_${v.id}`;
  item.appendChild(mqWrap);

  // Result display — visible only in expression mode
  const resultEl = document.createElement('div');
  resultEl.className = 'var-result';
  resultEl.id = `vres_${v.id}`;
  item.appendChild(resultEl);

  // Slider row — visible only when RHS is a plain number
  const sliderWrap = document.createElement('div');
  sliderWrap.className = 'var-param-sliderrow';
  sliderWrap.id = `vslrow_${v.id}`;

  const minInp = document.createElement('input');
  minInp.type  = 'text'; minInp.className = 'var-param-bound';
  minInp.id    = `vpmin_${v.id}`; minInp.value = v.paramMin;

  const slider = document.createElement('input');
  slider.type  = 'range'; slider.className = 'var-param-slider';
  slider.id    = `vpslider_${v.id}`;
  slider.min   = v.paramMin; slider.max = v.paramMax;
  slider.step  = niceParamStep(v.paramMin, v.paramMax);
  slider.value = v.value;

  const maxInp = document.createElement('input');
  maxInp.type  = 'text'; maxInp.className = 'var-param-bound';
  maxInp.id    = `vpmax_${v.id}`; maxInp.value = v.paramMax;

  sliderWrap.appendChild(minInp);
  sliderWrap.appendChild(slider);
  sliderWrap.appendChild(maxInp);
  item.appendChild(sliderWrap);

  function isNumericRhs(expr){
    if(!expr || !expr.trim()) return false;
    const stripped = expr.replace(/\s+/g,'').replace(/^-/,'');
    return /^\d+\.?\d*$/.test(stripped) || /^\d*\.\d+$/.test(stripped);
  }

  // Switch between slider mode (numeric RHS) and expression mode.
  function updateMode(mf){
    const numericRhs = isNumericRhs(v.exprLatex);
    v._isNumeric = numericRhs;
    if(numericRhs){
      sliderWrap.classList.add('visible');
      resultEl.innerHTML = ''; resultEl.className = 'var-result';
      const num = parseFloat(v.exprLatex.replace(/[^\d.\-]/g,''));
      if(!isNaN(num)){ v.value = num; syncParamSlider(v); }
    } else {
      sliderWrap.classList.remove('visible');
      evaluateConstant(v);
    }
    reEvalAllConstants();
  }

  requestAnimationFrame(()=>{
    let _mf = null;
    let _prevLatex = '';
    _mf = makeMathField(mqWrap, {
      spaceBehavesLikeTab: true,
      handlers:{
        edit(){
          const prev  = _prevLatex;
          _prevLatex  = _mf.latex();
          v.fullLatex = _mf.latex();
          const parsed = parseVarLatex(v.fullLatex);
          v.name      = parsed.name;
          v.nameLatex = parsed.nameLatex;
          v.exprLatex = parsed.exprLatex;
          fixDecoratorCursor(_mf, prev);
          updateMode(_mf);
          checkAllWarnings();
          updateLatexDropdown(_mf, mqWrap, mqWrap);
        }
      }
    });
    if(_mf){
      if(v.fullLatex) _mf.latex(v.fullLatex);
      updateMode(_mf);
      wrapMathFieldWithAC(mqWrap, _mf);
    }

    // Slider moves value and updates the MathField display
    slider.addEventListener('input', ()=>{
      v.value = parseFloat(slider.value);
      if(_mf){
        const lhs      = v.nameLatex || v.name || 'a';
        const newLatex = `${lhs}=${formatParamVal(v.value)}`;
        _mf.latex(newLatex);
        v.fullLatex = _mf.latex();
        v.exprLatex = formatParamVal(v.value);
      }
      reEvalAllConstants();
    });

    minInp.addEventListener('change', ()=>{
      const n = parseFloat(minInp.value);
      if(!isNaN(n)){ v.paramMin = n; rebuildParamSlider(v); }
      else minInp.value = v.paramMin;
    });
    minInp.addEventListener('click', e=>e.stopPropagation());

    maxInp.addEventListener('change', ()=>{
      const n = parseFloat(maxInp.value);
      if(!isNaN(n)){ v.paramMax = n; rebuildParamSlider(v); }
      else maxInp.value = v.paramMax;
    });
    maxInp.addEventListener('click', e=>e.stopPropagation());
  });
}

// ═══ PARAMETER BODY ══════════════════════════════════════════════════════
// Single MathField showing "name = value" (numeric only) with a range slider.
function buildParameterBody(item, v){
  const mqWrap = document.createElement('div');
  mqWrap.className = 'var-mq-wrap var-mq-single-line';
  mqWrap.id = `vmq_${v.id}`;
  item.appendChild(mqWrap);

  const sliderWrap = document.createElement('div');
  sliderWrap.className = 'var-param-sliderrow';

  const minInp = document.createElement('input');
  minInp.type  = 'text'; minInp.className = 'var-param-bound';
  minInp.id    = `vpmin_${v.id}`; minInp.value = v.paramMin;

  const slider = document.createElement('input');
  slider.type  = 'range'; slider.className = 'var-param-slider';
  slider.id    = `vpslider_${v.id}`;
  slider.min   = v.paramMin; slider.max = v.paramMax;
  slider.step  = niceParamStep(v.paramMin, v.paramMax);
  slider.value = v.value;

  const maxInp = document.createElement('input');
  maxInp.type  = 'text'; maxInp.className = 'var-param-bound';
  maxInp.id    = `vpmax_${v.id}`; maxInp.value = v.paramMax;

  sliderWrap.appendChild(minInp);
  sliderWrap.appendChild(slider);
  sliderWrap.appendChild(maxInp);
  item.appendChild(sliderWrap);

  requestAnimationFrame(()=>{
    let _mf = null;

    _mf = makeMathField(mqWrap, {
      spaceBehavesLikeTab: true,
      handlers:{
        edit(){
          const latex  = _mf.latex();
          const eqIdx  = latex.indexOf('=');
          if(eqIdx >= 0){
            const namePart = latex.slice(0, eqIdx).trim().replace(/[\\{}\s]/g,'');
            if(namePart) v.name = namePart;
            const num = parseFloat(latex.slice(eqIdx + 1).replace(/[^\d.\-]/g,''));
            if(!isNaN(num)){
              v.value = num;
              syncParamSlider(v);
              reEvalAllConstants();
            }
          }
          updateLatexDropdown(_mf, mqWrap, mqWrap);
        }
      }
    });
    if(_mf){
      _mf.latex(`${v.name || 'p'}=${formatParamVal(v.value)}`);
      wrapMathFieldWithAC(mqWrap, _mf);
    }

    slider.addEventListener('input', ()=>{
      v.value = parseFloat(slider.value);
      if(_mf) _mf.latex(`${v.name || 'p'}=${formatParamVal(v.value)}`);
      reEvalAllConstants();
    });

    minInp.addEventListener('change', ()=>{
      const n = parseFloat(minInp.value);
      if(!isNaN(n)){ v.paramMin = n; rebuildParamSlider(v); }
      else minInp.value = v.paramMin;
    });
    minInp.addEventListener('click', e=>e.stopPropagation());

    maxInp.addEventListener('change', ()=>{
      const n = parseFloat(maxInp.value);
      if(!isNaN(n)){ v.paramMax = n; rebuildParamSlider(v); }
      else maxInp.value = v.paramMax;
    });
    maxInp.addEventListener('click', e=>e.stopPropagation());
  });
}

// ═══ EQUATION BODY ═══════════════════════════════════════════════════════
// Single MathField for a function definition, e.g. f(x) = 2x + 1.
function buildEquationBody(item, v){
  const mqWrap = document.createElement('div');
  mqWrap.className = 'var-mq-wrap var-mq-single-line';
  mqWrap.id = `vmq_${v.id}`;
  item.appendChild(mqWrap);

  requestAnimationFrame(()=>{
    const mf = makeMathField(mqWrap, {
      spaceBehavesLikeTab: true,
      handlers:{
        edit(){
          v.fullLatex = mf.latex();
          const eqIdx = v.fullLatex.indexOf('=');
          if(eqIdx >= 0){
            const nameMatch = v.fullLatex.slice(0, eqIdx).match(/^([a-zA-Z]+)/);
            if(nameMatch) v.name = nameMatch[1];
            v.exprLatex = v.fullLatex.slice(eqIdx + 1).trim();
          }
          validateEquationLatex(v.fullLatex, v);
          updateLatexDropdown(mf, mqWrap, mqWrap);
        }
      }
    });
    if(mf){
      const fname    = v.name || 'f';
      const initLatex = v.fullLatex || `${fname}\\left(x\\right)=${v.exprLatex || ''}`;
      mf.latex(initLatex);
      validateEquationLatex(mf.latex(), v);
      wrapMathFieldWithAC(mqWrap, mf);
    }
  });
}

// ═══ LIST BODY ═══════════════════════════════════════════════════════════
function buildListBody(item, v, lenInp){
  const cellsWrap = document.createElement('div');
  cellsWrap.className = 'var-list-cells';

  // Validate on input (transient), commit on change (Enter/blur)
  lenInp.addEventListener('input', ()=>{
    const num = parseFloat(lenInp.value);
    if(lenInp.value === '' || isNaN(num)){
      if(v._warning) v._warning.setInvalid('List length must be a positive integer');
    } else if(!Number.isInteger(num)){
      if(v._warning) v._warning.setInvalid('List length must be an integer');
    } else if(num < 1){
      if(v._warning) v._warning.setInvalid('List length must be at least 1');
    } else {
      if(v._warning) v._warning.clearInvalid();
    }
  });

  lenInp.addEventListener('change', ()=>{
    const num = parseFloat(lenInp.value);
    if(isNaN(num) || !Number.isInteger(num) || num < 1){
      lenInp.value = v.listLength;
      if(v._warning) v._warning.clearInvalid();
      return;
    }
    const n = Math.min(999, num);
    lenInp.value = n; v.listLength = n;
    while(v.listItems.length < n) v.listItems.push(0);
    v.listItems = v.listItems.slice(0, n);
    if(v._warning) v._warning.clearInvalid();
    rebuildListCells(v, cellsWrap);
    rebuildEditIndex(v, editRow);
  });
  lenInp.addEventListener('click', e=>e.stopPropagation());

  item.appendChild(cellsWrap);
  rebuildListCells(v, cellsWrap);

  // "Edit index" row — shown only for long lists (> 8 items)
  const editRow = document.createElement('div');
  editRow.className = 'var-list-editrow';
  editRow.id = `veditrow_${v.id}`;
  item.appendChild(editRow);
  rebuildEditIndex(v, editRow);
}

// Rebuild the edit-by-index footer for lists longer than the display threshold.
function rebuildEditIndex(v, editRow){
  const THRESH = 8;
  const n = v.listItems.length;
  editRow.innerHTML = '';
  if(n <= THRESH) return;

  editRow.style.cssText = 'display:flex;flex-direction:column;gap:5px';

  const midIdx = Math.floor((n - 1) / 2);
  if(v._editIdx === undefined || v._editIdx >= n) v._editIdx = midIdx;

  const label = document.createElement('span');
  label.className   = 'var-list-editlabel';
  label.textContent = 'Edit index';
  editRow.appendChild(label);

  const controlRow = document.createElement('div');
  controlRow.className = 'var-list-editcontrols';

  const leftBtn = document.createElement('button');
  leftBtn.className   = 'var-list-editarrow';
  leftBtn.textContent = '‹';
  leftBtn.title       = 'Previous index';

  const idxInp = document.createElement('input');
  idxInp.type  = 'number'; idxInp.className = 'var-list-editidx';
  idxInp.min   = 0; idxInp.max = n - 1; idxInp.step = 1;
  idxInp.placeholder = 'idx';
  idxInp.value = v._editIdx;

  const rightBtn = document.createElement('button');
  rightBtn.className   = 'var-list-editarrow';
  rightBtn.textContent = '›';
  rightBtn.title       = 'Next index';

  const valInp = document.createElement('input');
  valInp.type  = 'number'; valInp.className = 'var-list-editval';
  valInp.step  = 'any';
  valInp.value = v.listItems[v._editIdx];
  valInp.placeholder = 'value';

  function setIdx(idx){
    const clamped = Math.max(0, Math.min(n - 1, idx));
    v._editIdx  = clamped;
    idxInp.value = clamped;
    valInp.value = v.listItems[clamped];
  }

  leftBtn.addEventListener('click',  e=>{ e.stopPropagation(); setIdx(v._editIdx - 1); });
  rightBtn.addEventListener('click', e=>{ e.stopPropagation(); setIdx(v._editIdx + 1); });
  idxInp.addEventListener('input',  ()=>{ const raw=parseInt(idxInp.value); if(!isNaN(raw)) setIdx(raw); });
  idxInp.addEventListener('click',  e=>e.stopPropagation());
  valInp.addEventListener('input',  ()=>{
    const num = parseFloat(valInp.value);
    if(!isNaN(num) && v._editIdx >= 0 && v._editIdx < n) v.listItems[v._editIdx] = num;
  });
  valInp.addEventListener('click',  e=>e.stopPropagation());

  controlRow.appendChild(leftBtn);
  controlRow.appendChild(idxInp);
  controlRow.appendChild(rightBtn);
  controlRow.appendChild(valInp);
  editRow.appendChild(controlRow);
}

// Render the cell grid for a list. Lists longer than THRESH show head/tail rows
// with an ellipsis in between.
function rebuildListCells(v, cellsWrap){
  cellsWrap.innerHTML = '';
  const n = v.listItems.length;
  const THRESH = 8, HEAD = 4, TAIL = 4;

  function makeCell(i){
    const cellWrap = document.createElement('div');
    cellWrap.className = 'var-list-cell-wrap';

    const idx = document.createElement('span');
    idx.className   = 'var-list-idx';
    idx.textContent = i;

    const cell = document.createElement('input');
    cell.type  = 'number'; cell.className = 'var-list-cell';
    cell.value = v.listItems[i]; cell.step = 'any';
    cell.addEventListener('input', ()=>{
      const num = parseFloat(cell.value);
      v.listItems[i] = isNaN(num) ? 0 : num;
    });
    cell.addEventListener('click', e=>e.stopPropagation());
    cell.addEventListener('keydown', e=>{
      if(e.key === 'Tab'){
        e.preventDefault();
        const cells = cellsWrap.querySelectorAll('.var-list-cell');
        const pos   = [...cells].indexOf(cell);
        const next  = cells[e.shiftKey ? pos - 1 : pos + 1];
        if(next) next.focus();
      }
    });

    cellWrap.appendChild(idx);
    cellWrap.appendChild(cell);
    return cellWrap;
  }

  if(n <= THRESH){
    const row = document.createElement('div');
    row.className = 'var-list-row';
    for(let i = 0; i < n; i++) row.appendChild(makeCell(i));
    cellsWrap.appendChild(row);
  } else {
    // Head row
    const headRow = document.createElement('div');
    headRow.className = 'var-list-row';
    for(let i = 0; i < HEAD; i++) headRow.appendChild(makeCell(i));
    cellsWrap.appendChild(headRow);

    // Ellipsis
    const ellipsisRow = document.createElement('div');
    ellipsisRow.className = 'var-list-ellipsis-row';
    const ellipsis = document.createElement('span');
    ellipsis.className   = 'var-list-ellipsis';
    ellipsis.textContent = '⋯';
    ellipsis.title = `${n - HEAD - TAIL} hidden item${n - HEAD - TAIL !== 1 ? 's' : ''}`;
    ellipsisRow.appendChild(ellipsis);
    cellsWrap.appendChild(ellipsisRow);

    // Tail row
    const tailRow = document.createElement('div');
    tailRow.className = 'var-list-row';
    for(let i = n - TAIL; i < n; i++) tailRow.appendChild(makeCell(i));
    cellsWrap.appendChild(tailRow);
  }
}

// ═══ TEMPLATE → VARIABLES SYNC ═══════════════════════════════════════════
// Called when a template is applied; syncs its parameters to the variables panel.
function syncTemplateParamsToVars(tplKey, params){
  if(!TEMPLATES || !TEMPLATES[tplKey]) return;
  const tplParams = TEMPLATES[tplKey].params;
  for(const [pk, pd] of Object.entries(tplParams)){
    const currentVal = params[pk] ?? pd.default;
    const existing   = variables.find(v=>v.fromTemplate && v.templateKey===tplKey && v.paramKey===pk);
    if(existing){
      existing.value      = currentVal;
      existing.exprLatex  = String(currentVal);
      existing.fullLatex  = `${pk}=${currentVal}`;
      existing._isNumeric = true;
      if(document.getElementById(`vpslider_${existing.id}`)) syncParamSlider(existing);
    } else {
      addVariable('constant', {
        name: pk, value: currentVal,
        exprLatex: String(currentVal), fullLatex: `${pk}=${currentVal}`,
        paramMin: pd.min, paramMax: pd.max,
        fromTemplate: true, templateKey: tplKey, paramKey: pk,
        silent: true,
      });
    }
  }
  setSbTab('vars');
}

// ═══ PICKLE IMPORT ═══════════════════════════════════════════════════════
// Import variables from a parsed .pickle file (called by sidebars.js).
// Naming: single-char keys are used as-is; multi-char keys are wrapped in \text{}.
function importPickleVars(data, sourceName){
  for(const [rawKey, info] of Object.entries(data)){
    const isSingleChar = rawKey.length === 1;
    const latexName    = isSingleChar ? rawKey : `\\text{${rawKey}}`;

    if(info.kind === 'constant'){
      const existing = variables.find(v=>v.name===rawKey && v.pickleSource===sourceName);
      if(existing){
        existing.exprLatex  = String(info.value);
        existing.fullLatex  = `${latexName}=${info.value}`;
        existing._isNumeric = true;
        existing.value      = info.value;
        renderVariables();
      } else {
        addVariable('constant', {
          name: rawKey, value: info.value,
          exprLatex: String(info.value), fullLatex: `${latexName}=${info.value}`,
          pickleSource: sourceName, silent: true,
        });
      }
    } else if(info.kind === 'list'){
      const existing = variables.find(v=>v.name===rawKey && v.pickleSource===sourceName);
      const items    = (info.items || []).map(Number);
      if(existing){
        existing.listItems  = items;
        existing.listLength = items.length;
        renderVariables();
      } else {
        addVariable('list', {
          name: rawKey, listItems: items, listLength: items.length,
          pickleSource: sourceName, silent: true,
        });
      }
    }
  }
  setSbTab('vars');
}
