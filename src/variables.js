// ═══ MATHQUILL INIT ══════════════════════════════════════════════════════
let MQ = null;
const variables = [];
let varIdCtr = 0;

function initMathQuill(){
  try{ MQ = MathQuill.getInterface(2); }catch(e){ MQ = null; }
}

// ═══ LATEX AUTOCOMPLETE ══════════════════════════════════════════════════
const LATEX_COMMANDS = [
  '\\alpha','\\beta','\\gamma','\\delta','\\epsilon','\\varepsilon',
  '\\zeta','\\eta','\\theta','\\vartheta','\\iota','\\kappa','\\lambda',
  '\\mu','\\nu','\\xi','\\pi','\\varpi','\\rho','\\varrho','\\sigma',
  '\\tau','\\upsilon','\\phi','\\varphi','\\chi','\\psi','\\omega',
  '\\Gamma','\\Delta','\\Theta','\\Lambda','\\Xi','\\Pi','\\Sigma',
  '\\Upsilon','\\Phi','\\Psi','\\Omega',
  '\\sin','\\cos','\\tan','\\cot','\\sec','\\csc',
  '\\arcsin','\\arccos','\\arctan',
  '\\sinh','\\cosh','\\tanh',
  '\\log','\\ln','\\exp','\\sqrt','\\frac','\\cdot','\\times','\\div',
  '\\pm','\\mp','\\leq','\\geq','\\neq','\\approx','\\equiv','\\sim',
  '\\infty','\\partial','\\nabla','\\sum','\\prod','\\int','\\oint',
  '\\lim','\\max','\\min','\\sup','\\inf',
  '\\rightarrow','\\leftarrow','\\Rightarrow','\\Leftarrow',
  '\\leftrightarrow','\\Leftrightarrow',
  '\\uparrow','\\downarrow','\\updownarrow',
  '\\forall','\\exists','\\in','\\notin','\\subset','\\supset',
  '\\cup','\\cap','\\emptyset','\\mathbb','\\mathrm','\\mathbf',
  '\\hat','\\bar','\\vec','\\tilde','\\dot','\\ddot',
  '\\text',
  '\\left','\\right','\\big','\\bigg',
  '\\overline','\\underline','\\overbrace','\\underbrace',
];

let _latexDropdown = null;
let _latexDropdownMF = null;
let _latexDropdownIdx = -1;

function getLatexDropdown(){
  if(!_latexDropdown){
    _latexDropdown = document.createElement('div');
    _latexDropdown.id = 'latex-ac-dropdown';
    _latexDropdown.style.cssText = [
      'position:fixed','z-index:99999',
      'background:#0e0e1c','border:1px solid #3a3a6a','border-radius:6px',
      'box-shadow:0 6px 24px rgba(0,0,0,.55)',
      'font-family:var(--mono,monospace)','font-size:.8rem',
      'min-width:160px','max-width:260px','overflow:hidden','display:none',
    ].join(';');
    document.body.appendChild(_latexDropdown);
    document.addEventListener('mousedown', e=>{
      if(!_latexDropdown.contains(e.target)) hideLatexDropdown();
    }, true);
  }
  return _latexDropdown;
}

function showLatexDropdown(mf, items, anchorEl){
  const dd = getLatexDropdown();
  _latexDropdownMF = mf;
  _latexDropdownIdx = 0;
  dd.innerHTML = '';
  items.forEach((cmd, i)=>{
    const row = document.createElement('div');
    row.className = 'latex-ac-item';
    row.textContent = cmd;
    row.style.cssText = 'padding:6px 14px;cursor:pointer;color:#c8c8ee;transition:background .08s;white-space:nowrap;';
    row.addEventListener('mouseenter', ()=>{ _latexDropdownIdx=i; highlightLatexItem(); });
    row.addEventListener('mousedown', e=>{ e.preventDefault(); applyLatexCompletion(mf, cmd); });
    dd.appendChild(row);
  });
  dd.style.display = 'block';
  requestAnimationFrame(()=>highlightLatexItem());
  const rect = anchorEl.getBoundingClientRect();
  dd.style.top  = (rect.bottom + 4) + 'px';
  dd.style.left = rect.left + 'px';
  requestAnimationFrame(()=>{
    const ddH = dd.offsetHeight;
    if(rect.bottom + 4 + ddH > window.innerHeight - 8)
      dd.style.top = (rect.top - ddH - 4) + 'px';
  });
}

function hideLatexDropdown(){
  if(_latexDropdown) _latexDropdown.style.display = 'none';
  _latexDropdownMF = null;
  _latexDropdownIdx = -1;
}

function highlightLatexItem(){
  const items = _latexDropdown?.querySelectorAll('.latex-ac-item');
  if(!items) return;
  items.forEach((el, i)=>{
    el.style.background = i===_latexDropdownIdx ? 'rgba(90,255,206,.12)' : '';
    el.style.color = i===_latexDropdownIdx ? '#5affce' : '#c8c8ee';
  });
}

function navigateLatexDropdown(dir){
  const items = _latexDropdown?.querySelectorAll('.latex-ac-item');
  if(!items||!items.length) return false;
  _latexDropdownIdx = Math.max(0, Math.min(items.length-1, _latexDropdownIdx + dir));
  highlightLatexItem();
  return true;
}

function applyLatexCompletion(mf, fullCmd){
  const latex = mf.latex();
  const match = latex.match(/\\([a-zA-Z]*)$/);
  if(match){
    const partial = match[0];
    for(let i=0; i<partial.length; i++) mf.keystroke('Backspace');
  }
  // For decorators that need cursor inside braces, use write+Left instead of cmd
  if(fullCmd === '\\overline' || fullCmd === '\\underline' ||
     fullCmd === '\\overbrace' || fullCmd === '\\underbrace' ||
     fullCmd === '\\hat' || fullCmd === '\\bar' || fullCmd === '\\vec' ||
     fullCmd === '\\tilde' || fullCmd === '\\dot' || fullCmd === '\\ddot'){
    mf.write(fullCmd + '{}');
    mf.keystroke('Left'); // step inside the braces
  } else if(fullCmd === '\\text'){
    // MathQuill's \text creates a plain-text box; cmd() places cursor inside it
    mf.cmd('\\text');
  } else {
    mf.cmd(fullCmd);
  }
  hideLatexDropdown();
  mf.focus();
}

// Detect when \overline (or similar) was completed by direct typing and fix cursor,
// and when MQ auto-inserted a matching ')' placing cursor after it.
function fixDecoratorCursor(mf){
  const latex = mf.latex();
  // If latex ends with \overline{} (empty box just created), cursor is outside — move it in
  if(/\\overline\{\}$|\\underline\{\}$|\\hat\{\}$|\\bar\{\}$|\\vec\{\}$|\\tilde\{\}$/.test(latex)){
    mf.keystroke('Left');
    return;
  }
  // MathQuill auto-inserts \left(\right) when user types '(' — cursor lands after \right).
  // Detect this by checking if latex ends with \left(\right) and cursor is at the very end.
  // We move left once to place cursor between the parens.
  if(/\\left\(\\right\)$/.test(latex)){
    mf.keystroke('Left');
  }
}

function updateLatexDropdown(mf, anchorEl){
  const latex = mf.latex();
  const match = latex.match(/\\([a-zA-Z]*)$/);
  if(!match){ hideLatexDropdown(); return; }
  const partial = '\\' + match[1];
  if(partial === '\\'){ hideLatexDropdown(); return; }
  const suggestions = LATEX_COMMANDS.filter(c => c.startsWith(partial)).slice(0, 5);
  if(!suggestions.length){ hideLatexDropdown(); return; }
  showLatexDropdown(mf, suggestions, anchorEl);
}

function wrapMathFieldWithAC(mqEl, mf){
  mqEl.addEventListener('keydown', e=>{
    const dd = _latexDropdown;
    const open = dd && dd.style.display !== 'none';
    if(open){
      if(e.key === 'ArrowDown'){ e.preventDefault(); navigateLatexDropdown(1); return; }
      if(e.key === 'ArrowUp'){  e.preventDefault(); navigateLatexDropdown(-1); return; }
      if(e.key === 'Enter' || e.key === 'Tab'){
        const items = dd.querySelectorAll('.latex-ac-item');
        const idx = _latexDropdownIdx >= 0 ? _latexDropdownIdx : 0;
        if(items[idx]){ e.preventDefault(); applyLatexCompletion(mf, items[idx].textContent); return; }
      }
      if(e.key === 'Escape'){ e.preventDefault(); hideLatexDropdown(); return; }
    }
  }, true);
}

function makeMathField(el, opts){
  if(!MQ) return null;
  try{ return MQ.MathField(el, opts); }
  catch(e){ console.warn('MathQuill MathField failed:', e); return null; }
}

// ─── Parse "name = expr" from full latex ─────────────────────────────────
// Returns { name, nameLatex, exprLatex }
// name      — canonical lookup key (e.g. "b_0", "varName")
// nameLatex — raw LHS latex used to reconstruct fullLatex (e.g. "b_{0}", "\alpha")
// exprLatex — raw RHS latex
function parseVarLatex(fullLatex){
  const eqIdx = fullLatex.indexOf('=');
  if(eqIdx < 0) return { name: '', nameLatex: '', exprLatex: fullLatex };
  const lhs = fullLatex.slice(0, eqIdx).trim();
  const rhs = fullLatex.slice(eqIdx + 1).trim();
  const nameLatex = lhs;

  let name;
  // Check for \text{name} on LHS
  const textMatch = lhs.match(/\\text\{([^}]+)\}/);
  if(textMatch){
    name = textMatch[1];
  } else {
    // Support subscripts: extract letter + optional _{...} or _x
    // e.g. "b_{0}" → "b_0", "x_{12}" → "x_12", "a" → "a"
    const subMatch = lhs.match(/^([a-zA-Z]+(?:\\[a-zA-Z]+)?)(?:_\{([^}]*)\}|_([a-zA-Z0-9]))?$/);
    if(subMatch){
      const base = subMatch[1].replace(/\\/g,'');
      const sub  = subMatch[2] !== undefined ? subMatch[2] : (subMatch[3] !== undefined ? subMatch[3] : null);
      name = sub !== null ? `${base}_${sub}` : base;
    } else {
      // Fallback: strip formatting chars
      name = lhs.replace(/[\\{}^_\s]/g, '').replace(/left|right/g,'').trim();
    }
  }
  return { name, nameLatex, exprLatex: rhs };
}

// ═══ VARIABLE CONTEXT ════════════════════════════════════════════════════
function buildVarContext(){
  const ctx = {};
  // Parameters: always numeric (value stored on v.value)
  for(const v of variables){
    if(v.kind === 'parameter' && v.name) ctx[v.name] = v.value;
  }
  // Constants: skip any variable whose name is a duplicate (has an active warning).
  // Only the first-defined owner of each name contributes to the context.
  for(const v of variables){
    if(v.kind === 'constant' && v.name && !(v._warning?.active)){
      try{
        if(v._isNumeric){
          ctx[v.name] = v.value;
        } else {
          const localCtx = {...ctx};
          delete localCtx[v.name];
          const val = evalLatexExpr(v.exprLatex || '', localCtx);
          if(val !== null) ctx[v.name] = val;
        }
      }catch(e){}
    }
  }
  return ctx;
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
    { key:'constant',  icon:'α',   label:'Constant',  desc:'Number or expression' },
    { key:'equation',  icon:'ƒ',   label:'Equation',  desc:'Function of x' },
    { key:'list',      icon:'[ ]', label:'List',      desc:'Fixed-length sequence' },
  ];
  types.forEach(t=>{
    const row = document.createElement('button');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;background:transparent;border:none;padding:9px 14px;cursor:pointer;transition:background .08s;text-align:left;';
    row.innerHTML = `<span style="font-size:1.05rem;width:22px;text-align:center;flex-shrink:0;color:#5affce;opacity:.85">${t.icon}</span>`
      +`<span><span style="color:#d0d0ee;font-size:.8rem;display:block">${t.label}</span>`
      +`<span style="color:#5a5a90;font-size:.68rem">${t.desc}</span></span>`;
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
  if(_varTypePicker){ _varTypePicker.remove(); _varTypePicker=null; }
}

// ═══ VARIABLE STATE ══════════════════════════════════════════════════════
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
    setTimeout(()=>{
      // All kinds: focus the MathField
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
}

// Remove all variables that were imported from a given file
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

// ═══ VARIABLE DRAG STATE (pointer-based) ══════════════════════════════════
let _varDrag = null; // { srcIdx, clone, placeholder, offX, offY }

function _varDragStart(e, item, idx){
  const list = document.getElementById('varsList'); if(!list) return;
  const rect = item.getBoundingClientRect();

  // Build floating clone
  const clone = item.cloneNode(true);
  clone.style.cssText = [
    'position:fixed','z-index:99999','pointer-events:none',
    `width:${rect.width}px`,
    `left:${rect.left}px`,`top:${rect.top}px`,
    'margin:0','opacity:0.92',
    'box-shadow:0 8px 32px rgba(0,0,0,.55)',
    'border-color:var(--acc2)',
    'transition:none',
  ].join(';');
  document.body.appendChild(clone);

  // Build placeholder (outline only, same height) — insert BEFORE item so it takes its visual slot
  const ph = document.createElement('div');
  ph.className = 'var-drag-placeholder';
  ph.style.height = rect.height + 'px';
  item.before(ph);

  // Hide original (placeholder now occupies its slot)
  item.style.display = 'none';

  _varDrag = {
    srcIdx: idx,
    srcItem: item,
    clone,
    placeholder: ph,
    offX: e.clientX - rect.left,
    offY: e.clientY - rect.top,
    list,
    committed: false,
  };

  document.addEventListener('pointermove', _varDragMove);
  document.addEventListener('pointerup',   _varDragEnd);
}

function _varDragMove(e){
  if(!_varDrag) return;
  const { clone, placeholder, offX, offY, list } = _varDrag;

  // Move floating clone
  clone.style.left = (e.clientX - offX) + 'px';
  clone.style.top  = (e.clientY - offY) + 'px';

  // Find which item the cursor is over (skip hidden original)
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
    // Determine destination index from placeholder position
    const sibs = [...list.children]; // items + placeholder
    const phPos = sibs.indexOf(placeholder);
    let destIdx = sibs.slice(0, phPos).filter(el=>el.classList.contains('var-item')).length;
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
class VarWarning {
  constructor(varId){
    this.varId = varId;
    this._msg = null;
  }
  get active(){ return this._msg !== null; }
  set(msg){
    this._msg = msg;
    this._apply();
  }
  clear(){
    this._msg = null;
    this._apply();
  }
  _apply(){
    const btn = document.querySelector(`.var-warn-btn[data-vid="${this.varId}"]`);
    if(!btn) return;
    const tip = btn.querySelector('.var-warn-tip');
    if(this._msg){
      btn.classList.add('var-warn-active');
      if(tip) tip.textContent = this._msg;
    } else {
      btn.classList.remove('var-warn-active');
      if(tip) tip.textContent = 'No errors';
    }
  }
}

function checkAllWarnings(){
  // Build a map of name → first variable index that owns it
  const nameOwner = new Map(); // name → first v.id that defined it
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


function renderVariables(){
  const list = document.getElementById('varsList'); if(!list) return;
  const empty = document.getElementById('varsEmpty');
  if(empty) empty.style.display = variables.length ? 'none' : 'flex';
  list.innerHTML = '';

  variables.forEach((v, idx)=>{
    const item = document.createElement('div');
    item.className = `var-item var-item-${v.kind}`;
    item.dataset.vid = v.id;

    // ── Drag handle (left side) ──────────────────────────────────
    const handle = document.createElement('div');
    handle.className = 'var-drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Drag to reorder';
    item.appendChild(handle);

    // ── Inner content column ─────────────────────────────────────
    const inner = document.createElement('div');
    inner.className = 'var-item-inner';
    item.appendChild(inner);

    // Drag wiring: only the handle initiates drag
    handle.addEventListener('pointerdown', e=>{
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      _varDragStart(e, item, idx);
    });

    // Green outline when any child element is focused/interacted with
    item.addEventListener('focusin',  ()=> item.classList.add('var-item--focused'));
    item.addEventListener('focusout', ()=> item.classList.remove('var-item--focused'));

    // ── Warning symbol (bottom-left of container) ────────────────
    const warnBtn = document.createElement('div');
    warnBtn.className = 'var-warn-btn';
    warnBtn.dataset.vid = v.id;
    warnBtn.innerHTML = '&#9888;';
    warnBtn.setAttribute('aria-label', 'No errors');
    const warnTip = document.createElement('div');
    warnTip.className = 'var-warn-tip';
    warnTip.textContent = 'No errors';
    warnBtn.appendChild(warnTip);
    item.appendChild(warnBtn);

    // Click anywhere on item → focus the MQ field (unless a specific interactive element was clicked)
    item.addEventListener('click', e=>{
      if(e.target.closest('input, button, .var-drag-handle, .var-warn-btn, .mq-editable-field')) return;
      const mqField = item.querySelector('.mq-editable-field');
      if(mqField) mqField.click();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'var-item-del';
    delBtn.innerHTML = '✕';
    delBtn.addEventListener('click', e=>{ e.stopPropagation(); removeVariable(v.id); });

    if(v.kind === 'list'){
      // List gets a two-row header: [badge · del] on top, [name · · length] on bottom
      const headerTop = document.createElement('div');
      headerTop.className = 'var-item-header';
      const badge = document.createElement('span');
      badge.className = `var-kind-badge var-kind-${v.kind}`;
      badge.textContent = 'List';
      headerTop.appendChild(badge);
      if(v.pickleSource){
        const srcTag = document.createElement('span');
        srcTag.className = 'var-source-tag';
        srcTag.textContent = v.pickleSource;
        srcTag.title = `Imported from ${v.pickleSource}`;
        headerTop.appendChild(srcTag);
      }
      headerTop.appendChild(delBtn);
      inner.appendChild(headerTop);

      // Second row: name as MQ (left) + length control (right)
      const headerBot = document.createElement('div');
      headerBot.className = 'var-list-subheader';

      // MathQuill name field
      const nameMqWrap = document.createElement('div');
      nameMqWrap.className = 'var-list-name-mq';
      nameMqWrap.id = `vnamemq_${v.id}`;

      const lenWrap = document.createElement('div');
      lenWrap.className = 'var-list-lenrow';
      const lenLabel = document.createElement('span');
      lenLabel.className = 'var-list-lenlabel';
      lenLabel.textContent = 'n =';
      const lenInp = document.createElement('input');
      lenInp.type = 'number'; lenInp.className = 'var-list-leninp';
      lenInp.id = `vlen_${v.id}`; lenInp.value = v.listLength;
      lenInp.min = 1; lenInp.max = 999; lenInp.step = 1;

      headerBot.appendChild(nameMqWrap);
      lenWrap.appendChild(lenLabel);
      lenWrap.appendChild(lenInp);
      headerBot.appendChild(lenWrap);
      inner.appendChild(headerBot);

      // Init MQ for the name field after element is in DOM
      requestAnimationFrame(()=>{
        if(!MQ) return;
        try{
          const nameMf = MQ.MathField(nameMqWrap, {
            spaceBehavesLikeTab: true,
            handlers:{
              edit(){
                // Extract plain text from what user typed as the name
                const raw = nameMf.latex().replace(/[\\{}\s]/g,'').replace(/left|right/g,'').trim();
                if(raw) v.name = raw;
                reEvalAllConstants();
                updateLatexDropdown(nameMf, nameMqWrap);
              }
            }
          });
          if(v.name) nameMf.latex(v.name);
          else nameMf.latex('');
          wrapMathFieldWithAC(nameMqWrap, nameMf);
        }catch(e){}
      });

      buildListBody(inner, v, lenInp);

    } else {
      // Non-list: single header row
      const header = document.createElement('div');
      header.className = 'var-item-header';
      const badge = document.createElement('span');
      badge.className = `var-kind-badge var-kind-${v.kind}`;
      badge.textContent = v.kind === 'constant' ? 'Const' : v.kind.charAt(0).toUpperCase() + v.kind.slice(1);
      header.appendChild(badge);
      if(v.pickleSource){
        const srcTag = document.createElement('span');
        srcTag.className = 'var-source-tag';
        srcTag.textContent = v.pickleSource;
        srcTag.title = `Imported from ${v.pickleSource}`;
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
  // Apply warning states after DOM is built (requestAnimationFrame so MQ init runs first)
  requestAnimationFrame(()=> checkAllWarnings());
}

function reEvalAllConstants(){
  for(const v of variables){
    if(v.kind === 'constant') evaluateConstant(v);
  }
}

// ─── CONSTANT — numeric value or expression, with optional slider ───────────
// One MathField for "name = expr". If the RHS is a plain number → show slider.
// If the RHS is an expression → show evaluated result beneath.
function buildConstantBody(item, v){
  const mqWrap = document.createElement('div');
  mqWrap.className = 'var-mq-wrap var-mq-single-line';
  mqWrap.id = `vmq_${v.id}`;
  item.appendChild(mqWrap);

  // Result line — shows "= <value>" in expression mode, hidden in slider mode
  const resultEl = document.createElement('div');
  resultEl.className = 'var-result';
  resultEl.id = `vres_${v.id}`;
  item.appendChild(resultEl);

  // Slider row — shown only when RHS is a plain number
  const sliderWrap = document.createElement('div');
  sliderWrap.className = 'var-param-sliderrow';
  sliderWrap.id = `vslrow_${v.id}`;

  const minInp = document.createElement('input');
  minInp.type = 'text'; minInp.className = 'var-param-bound';
  minInp.id = `vpmin_${v.id}`; minInp.value = v.paramMin;

  const slider = document.createElement('input');
  slider.type = 'range'; slider.className = 'var-param-slider';
  slider.id = `vpslider_${v.id}`;
  slider.min = v.paramMin; slider.max = v.paramMax;
  slider.step = niceParamStep(v.paramMin, v.paramMax);
  slider.value = v.value;

  const maxInp = document.createElement('input');
  maxInp.type = 'text'; maxInp.className = 'var-param-bound';
  maxInp.id = `vpmax_${v.id}`; maxInp.value = v.paramMax;

  sliderWrap.appendChild(minInp);
  sliderWrap.appendChild(slider);
  sliderWrap.appendChild(maxInp);
  item.appendChild(sliderWrap);

  function isNumericRhs(expr){
    if(!expr || !expr.trim()) return false;
    const stripped = expr.replace(/\s+/g,'').replace(/^-/,'');
    return /^\d+\.?\d*$/.test(stripped) || /^\d*\.\d+$/.test(stripped);
  }

  function updateMode(mf){
    const numericRhs = isNumericRhs(v.exprLatex);
    v._isNumeric = numericRhs;
    if(numericRhs){
      sliderWrap.classList.add('visible');
      resultEl.innerHTML = '';
      resultEl.className = 'var-result';
      const num = parseFloat(v.exprLatex.replace(/[^\d.\-]/g,''));
      if(!isNaN(num)){ v.value = num; syncParamSlider(v); }
    } else {
      sliderWrap.classList.remove('visible');
      evaluateConstant(v);
    }
    // Re-evaluate all other constants that may depend on this one
    reEvalAllConstants();
  }

  requestAnimationFrame(()=>{
    let _mf = null;
    _mf = makeMathField(mqWrap, {
      spaceBehavesLikeTab: true,
      handlers:{
        edit(){
          v.fullLatex = _mf.latex();
          const parsed = parseVarLatex(v.fullLatex);
          v.name = parsed.name;
          v.nameLatex = parsed.nameLatex;
          v.exprLatex = parsed.exprLatex;
          fixDecoratorCursor(_mf);
          updateMode(_mf);
          checkAllWarnings();
          updateLatexDropdown(_mf, mqWrap);
        }
      }
    });
    if(_mf){
      // latex() setter is the correct way to restore MQ content from a stored string.
      // write() processes as typed commands and garbles = signs, ^ etc.
      if(v.fullLatex) _mf.latex(v.fullLatex);
      updateMode(_mf);
      wrapMathFieldWithAC(mqWrap, _mf);
    }

    slider.addEventListener('input', ()=>{
      v.value = parseFloat(slider.value);
      if(_mf){
        // Use stored nameLatex so \-commands in the LHS are preserved
        const lhs = v.nameLatex || v.name || 'a';
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

function evaluateConstant(v){
  const el = document.getElementById(`vres_${v.id}`); if(!el) return;
  if(v._isNumeric){ el.innerHTML = ''; el.className = 'var-result'; return; }

  const ctx = buildVarContext();
  delete ctx[v.name];

  // ── Try pure-JS numeric evaluation first (instant) ───────────────────
  const val = evalLatexExpr(v.exprLatex || '', ctx);
  if(val !== null && val !== undefined){
    const formatted = Number.isInteger(val) ? String(val) : parseFloat(val.toPrecision(6)).toString();
    _renderResultMQ(el, '= ' + formatted, 'var-result var-result-ok');
    // Cancel any pending backend call — we already have a full numeric result
    clearTimeout(v._evalTimer);
    return;
  }

  // ── Show immediate JS partial as placeholder while SymPy loads ───────
  const partial = partialEvalLatex(v.exprLatex || '', ctx);
  if(partial !== null){
    _renderResultMQ(el, '= ' + partial, 'var-result var-result-partial');
  } else {
    el.innerHTML = ''; el.className = 'var-result';
  }

  // ── Debounce backend call (300ms) so rapid typing doesn't flood ───────
  clearTimeout(v._evalTimer);
  v._evalTimer = setTimeout(async ()=>{
    try{
      // Build the variable list for the backend: context numerics first, then this var
      const varDefs = [];
      for(const [name, numVal] of Object.entries(ctx)){
        varDefs.push({ id: `ctx_${name}`, name, expr_latex: String(numVal), kind: 'parameter' });
      }
      varDefs.push({ id: String(v.id), name: v.name, expr_latex: v.exprLatex || '', kind: 'constant' });

      const resp = await fetch(`${API}/evaluate`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ variables: varDefs }),
      });
      if(!resp.ok) return;
      const data = await resp.json();
      const result = (data.results || []).find(r => r.id === String(v.id));
      if(!result) return;

      // Re-check element still exists and variable hasn't changed
      const elNow = document.getElementById(`vres_${v.id}`);
      if(!elNow) return;

      if(result.is_numeric && result.value !== null){
        const fmt = Number.isInteger(result.value)
          ? String(result.value)
          : parseFloat(result.value.toPrecision(6)).toString();
        _renderResultMQ(elNow, '= ' + fmt, 'var-result var-result-ok');
      } else if(result.latex && result.latex.trim()){
        _renderResultMQ(elNow, '= ' + result.latex, 'var-result var-result-partial');
      } else if(result.error && result.error !== 'empty'){
        elNow.innerHTML = ''; elNow.className = 'var-result';
      }
    }catch(e){
      // Backend unreachable — silently keep the JS partial result
    }
  }, 300);
}

// Render a latex string into a result element via MQ StaticMath
function _renderResultMQ(el, latex, className){
  el.className = className;
  el.innerHTML = '';
  if(MQ){
    try{
      const span = document.createElement('span');
      el.appendChild(span);
      MQ.StaticMath(span).latex(latex);
      return;
    }catch(e){}
  }
  // Fallback to plain text if MQ unavailable
  el.textContent = latex;
}

// Partial evaluator: substitute known vars, collect unknown symbol tokens (with subscripts),
// compute the numeric coefficient, return a latex string like "2b_{0}" or "3cd".
function partialEvalLatex(latex, ctx){
  if(!latex || !latex.trim()) return null;
  let expr = latex;

  // Resolve \text{name} from ctx first
  expr = expr.replace(/\\text\{([^}]+)\}/g, (match, name) => {
    if(name in ctx) return `(${ctx[name]})`;
    return match;
  });

  // Collect unknown symbol tokens — bare letter OR letter+subscript (b_{0}, b_0)
  // Must be collected from expr BEFORE ctx substitution
  const unknownTokens = []; // { latex: 'b_{0}', key: 'b_0' } or { latex: 'c', key: 'c' }
  const seenKeys = new Set();

  // Match subscripted: letter_{stuff} or letter_digit
  const subRe = /(?<!\\)([a-zA-Z])_\{([^}]*)\}|(?<!\\)([a-zA-Z])_([a-zA-Z0-9])/g;
  let m;
  while((m = subRe.exec(expr)) !== null){
    const base = m[1] || m[3];
    const sub  = m[2] !== undefined ? m[2] : m[4];
    const key = `${base}_${sub}`;
    const ltx = m[2] !== undefined ? `${base}_{${sub}}` : `${base}_{${sub}}`;
    if(!(key in ctx) && !seenKeys.has(key)){
      seenKeys.add(key);
      unknownTokens.push({ latex: ltx, key });
    }
  }
  // Match plain single letters (not preceded by \, not already found as subscript base)
  const plainRe = /(?<!\\)(?<![a-zA-Z])([a-zA-Z])(?![a-zA-Z_{])/g;
  while((m = plainRe.exec(expr)) !== null){
    const ch = m[1];
    if(!(ch in ctx) && !seenKeys.has(ch)){
      seenKeys.add(ch);
      unknownTokens.push({ latex: ch, key: ch });
    }
  }

  if(unknownTokens.length === 0) return null;

  // Substitute known ctx vars (subscripted first, then plain)
  const ctxNames = Object.keys(ctx).filter(n=>n).sort((a,b)=>b.length-a.length);
  for(const name of ctxNames){
    if(name.includes('_')){
      const [base, sub] = name.split('_');
      const pat = `${escapeRegex(base)}_(?:\\{${escapeRegex(sub)}\\}|${escapeRegex(sub)})(?![a-zA-Z0-9_])`;
      expr = expr.replace(new RegExp(pat,'g'), `(${ctx[name]})`);
    } else {
      const safeRe = new RegExp(`(?<!\\\\)\\b${escapeRegex(name)}\\b`,'g');
      expr = expr.replace(safeRe, `(${ctx[name]})`);
    }
  }

  // Substitute unknown tokens with 1 to extract numeric coefficient
  let coeffExpr = expr;
  for(const tok of unknownTokens){
    if(tok.key.includes('_')){
      const [base, sub] = tok.key.split('_');
      const pat = `${escapeRegex(base)}_(?:\\{${escapeRegex(sub)}\\}|${escapeRegex(sub)})(?![a-zA-Z0-9_])`;
      coeffExpr = coeffExpr.replace(new RegExp(pat,'g'), '(1)');
    } else {
      const re = new RegExp(`(?<![a-zA-Z(])${escapeRegex(tok.key)}(?![a-zA-Z_{])`, 'g');
      coeffExpr = coeffExpr.replace(re, '(1)');
    }
  }

  // Convert latex coefficient expression to JS
  const toJS = e => {
    let r = e
      .replace(/\\pi/g,   '(Math.PI)')
      .replace(/\\e(?![a-zA-Z])/g, '(Math.E)')
      .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '(($1)/($2))')
      .replace(/\\sqrt\{([^}]*)\}/g, 'Math.sqrt($1)')
      .replace(/\\sin/g,'Math.sin').replace(/\\cos/g,'Math.cos').replace(/\\tan/g,'Math.tan')
      .replace(/\\ln/g,'Math.log').replace(/\\log/g,'Math.log10').replace(/\\exp/g,'Math.exp')
      .replace(/\\left\(/g,'(').replace(/\\right\)/g,')')
      .replace(/\^\{([^}]*)\}/g,'**($1)').replace(/\^(\w)/g,'**$1')
      .replace(/\_\{[^}]*\}/g,'').replace(/\_\w/g,'')
      .replace(/\\cdot/g,'*').replace(/\\times/g,'*')
      .replace(/\{/g,'(').replace(/\}/g,')')
      .replace(/\\[a-zA-Z]+/g,'');
    r = r.replace(/\)\s*\(/g,')*(' ).replace(/(\d)\s*\(/g,'$1*(').replace(/\)\s*(\d)/g,')*$1');
    return r;
  };

  let coeff = null;
  try{
    // eslint-disable-next-line no-new-func
    coeff = Function('"use strict"; return (' + toJS(coeffExpr) + ')')();
  }catch(e){ return null; }

  if(typeof coeff !== 'number' || !isFinite(coeff)) return null;

  // Format coefficient
  let coeffStr = Number.isInteger(coeff)
    ? String(coeff)
    : parseFloat(coeff.toPrecision(5)).toString();
  if(coeffStr === '1') coeffStr = '';
  else if(coeffStr === '-1') coeffStr = '-';

  // Build unknown part in latex (sort for deterministic output)
  const unknownLatex = unknownTokens
    .slice()
    .sort((a,b) => a.key.localeCompare(b.key))
    .map(t => t.latex)
    .join(' ');

  if(!unknownLatex) return null;
  return coeffStr + unknownLatex;
}

function escapeRegex(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function evalLatexExpr(latex, ctx={}){
  if(!latex || !latex.trim()) return null;
  let expr = latex;

  // First: resolve \text{name} patterns from context
  // e.g. \text{var_name} → replaced with its numeric value if known
  expr = expr.replace(/\\text\{([^}]+)\}/g, (match, name) => {
    if(name in ctx) return `(${ctx[name]})`;
    return match; // leave unknown \text{} for later stripping
  });

  // Substitute plain user variables (longest names first to avoid partial matches)
  // Subscript names like b_0 appear in latex as b_{0} or b_0 — handle both forms
  const ctxNames = Object.keys(ctx).filter(n=>n).sort((a,b)=>b.length-a.length);
  for(const name of ctxNames){
    if(name.includes('_')){
      // Build a regex that matches both b_{0} and b_0 in latex
      const [base, sub] = name.split('_');
      const subPattern = `${escapeRegex(base)}_(?:\\{${escapeRegex(sub)}\\}|${escapeRegex(sub)})(?![a-zA-Z0-9_])`;
      expr = expr.replace(new RegExp(subPattern, 'g'), `(${ctx[name]})`);
    } else {
      const safeRe = new RegExp(`(?<!\\\\)\\b${escapeRegex(name)}\\b`, 'g');
      expr = expr.replace(safeRe, `(${ctx[name]})`);
    }
  }

  expr = expr
    .replace(/\\pi/g,   '(Math.PI)')
    .replace(/\\e(?![a-zA-Z])/g, '(Math.E)')
    .replace(/\\infty/g,'Infinity')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '(($1)/($2))')
    .replace(/\\sqrt\{([^}]*)\}/g, 'Math.sqrt($1)')
    .replace(/\\sin/g,  'Math.sin')
    .replace(/\\cos/g,  'Math.cos')
    .replace(/\\tan/g,  'Math.tan')
    .replace(/\\arcsin/g,'Math.asin')
    .replace(/\\arccos/g,'Math.acos')
    .replace(/\\arctan/g,'Math.atan')
    .replace(/\\sinh/g, 'Math.sinh')
    .replace(/\\cosh/g, 'Math.cosh')
    .replace(/\\tanh/g, 'Math.tanh')
    .replace(/\\ln/g,   'Math.log')
    .replace(/\\log/g,  'Math.log10')
    .replace(/\\exp/g,  'Math.exp')
    .replace(/\\left\(/g,'(').replace(/\\right\)/g,')')
    .replace(/\\left\[/g,'[').replace(/\\right\]/g,']')
    .replace(/\\left\|/g,'Math.abs(').replace(/\\right\|/g,')')
    .replace(/\^\{([^}]*)\}/g, '**($1)')
    .replace(/\^(\w)/g,  '**$1')
    .replace(/\_\{[^}]*\}/g,'').replace(/\_\w/g,'')
    .replace(/\\cdot/g,'*').replace(/\\times/g,'*')
    .replace(/\{/g,'(').replace(/\}/g,')')
    .replace(/\\[a-zA-Z]+/g, ''); // strip remaining unknown commands

  // Insert implicit multiplication between adjacent tokens:
  // e.g. (2)(c)  →  (2)*(c)
  //      2c       →  2*c       (after variable substitution numerics remain)
  //      )(        →  )*(
  let implExpr = expr
    .replace(/\)\s*\(/g, ')*(')           // )(  →  )*(
    .replace(/(\d)\s*\(/g, '$1*(')        // 2(  →  2*(
    .replace(/\)\s*(\d)/g, ')*$1')        // )2  →  )*2
    .replace(/(\d)\s+(\d)/g, '$1*$2');    // bare digit-space-digit (rare)

  const stripped = implExpr.replace(/Math\.[a-z]+/g,'').replace(/Infinity/g,'');
  if(/[a-df-wyzA-DF-WYZ_$]/.test(stripped)) return null;

  // eslint-disable-next-line no-new-func
  const result = Function('"use strict"; return (' + implExpr + ')')();
  return typeof result === 'number' ? result : null;
}

// ─── PARAMETER ────────────────────────────────────────────────────────────
// Single MathField showing "name = value" (numeric only), slider below
function buildParameterBody(item, v){
  const mqWrap = document.createElement('div');
  mqWrap.className = 'var-mq-wrap var-mq-single-line';
  mqWrap.id = `vmq_${v.id}`;
  item.appendChild(mqWrap);

  const sliderWrap = document.createElement('div');
  sliderWrap.className = 'var-param-sliderrow';

  const minInp = document.createElement('input');
  minInp.type = 'text'; minInp.className = 'var-param-bound';
  minInp.id = `vpmin_${v.id}`; minInp.value = v.paramMin;

  const slider = document.createElement('input');
  slider.type = 'range'; slider.className = 'var-param-slider';
  slider.id = `vpslider_${v.id}`;
  slider.min = v.paramMin; slider.max = v.paramMax;
  slider.step = niceParamStep(v.paramMin, v.paramMax);
  slider.value = v.value;

  const maxInp = document.createElement('input');
  maxInp.type = 'text'; maxInp.className = 'var-param-bound';
  maxInp.id = `vpmax_${v.id}`; maxInp.value = v.paramMax;

  sliderWrap.appendChild(minInp);
  sliderWrap.appendChild(slider);
  sliderWrap.appendChild(maxInp);
  item.appendChild(sliderWrap);

  // MathField init deferred so element is in DOM
  requestAnimationFrame(()=>{
    let _mf = null;
    const buildInitLatex = () => {
      const name = v.name || 'p';
      return `${name}=${formatParamVal(v.value)}`;
    };

    _mf = makeMathField(mqWrap, {
      spaceBehavesLikeTab: true,
      handlers:{
        edit(){
          const latex = _mf.latex();
          // Parse "name = numeric" — only update if we can extract a clean number
          const eqIdx = latex.indexOf('=');
          if(eqIdx >= 0){
            const lhsRaw = latex.slice(0, eqIdx).trim();
            const rhsRaw = latex.slice(eqIdx + 1).trim();
            // Extract plain name from LHS
            const namePart = lhsRaw.replace(/[\\{}\s]/g,'');
            if(namePart) v.name = namePart;
            // Try to parse RHS as a number (strip minus sign handling)
            const numStr = rhsRaw.replace(/[^\d.\-]/g,'');
            const num = parseFloat(numStr);
            if(!isNaN(num)){
              v.value = num;
              syncParamSlider(v);
              reEvalAllConstants();
            }
          }
          updateLatexDropdown(_mf, mqWrap);
        }
      }
    });
    if(_mf){
      _mf.latex(buildInitLatex());
      wrapMathFieldWithAC(mqWrap, _mf);
    }

    // Slider drives the MathField value display
    slider.addEventListener('input', ()=>{
      v.value = parseFloat(slider.value);
      if(_mf){
        const name = v.name || 'p';
        _mf.latex(`${name}=${formatParamVal(v.value)}`);
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

function niceParamStep(min, max){
  const span = Math.abs(max - min); if(!span) return 0.1;
  const raw = span / 100;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1,2,5].map(f=>f*mag).find(s=>s>=raw) || mag;
}
function formatParamVal(n){
  return Number.isInteger(n) ? String(n) : parseFloat(n.toPrecision(4)).toString();
}
function syncParamSlider(v){
  const slider = document.getElementById(`vpslider_${v.id}`); if(!slider) return;
  if(v.value < v.paramMin){ v.paramMin = v.value; slider.min = v.paramMin; const mi=document.getElementById(`vpmin_${v.id}`); if(mi) mi.value=v.paramMin; }
  if(v.value > v.paramMax){ v.paramMax = v.value; slider.max = v.paramMax; const ma=document.getElementById(`vpmax_${v.id}`); if(ma) ma.value=v.paramMax; }
  slider.value = v.value;
}
function rebuildParamSlider(v){
  const slider = document.getElementById(`vpslider_${v.id}`); if(!slider) return;
  const minEl = document.getElementById(`vpmin_${v.id}`);
  const maxEl = document.getElementById(`vpmax_${v.id}`);
  slider.min = v.paramMin; slider.max = v.paramMax;
  slider.step = niceParamStep(v.paramMin, v.paramMax);
  v.value = Math.max(v.paramMin, Math.min(v.paramMax, v.value));
  slider.value = v.value;
  if(minEl) minEl.value = v.paramMin;
  if(maxEl) maxEl.value = v.paramMax;
  // Refresh the MathField display
  const mqEl = document.getElementById(`vmq_${v.id}`);
  if(mqEl && MQ){
    try{
      const mf = MQ.MathField(mqEl);
      const name = v.name || 'p';
      mf.latex(`${name}=${formatParamVal(v.value)}`);
    }catch(e){}
  }
}

// ─── EQUATION ─────────────────────────────────────────────────────────────
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
            const lhs = v.fullLatex.slice(0, eqIdx);
            const nameMatch = lhs.match(/^([a-zA-Z]+)/);
            if(nameMatch) v.name = nameMatch[1];
            v.exprLatex = v.fullLatex.slice(eqIdx + 1).trim();
          }
          updateLatexDropdown(mf, mqWrap);
        }
      }
    });
    if(mf){
      const fname = v.name || 'f';
      const initLatex = v.fullLatex || `${fname}\\left(x\\right)=${v.exprLatex||''}`;
      mf.latex(initLatex);
      wrapMathFieldWithAC(mqWrap, mf);
    }
  });
}

// ─── LIST ─────────────────────────────────────────────────────────────────
function buildListBody(item, v, lenInp){
  // Wire the length input (created in renderVariables)
  const cellsWrap = document.createElement('div');
  cellsWrap.className = 'var-list-cells';

  lenInp.addEventListener('change', ()=>{
    const n = Math.max(1, Math.min(999, parseInt(lenInp.value)||1));
    lenInp.value = n; v.listLength = n;
    while(v.listItems.length < n) v.listItems.push(0);
    v.listItems = v.listItems.slice(0, n);
    rebuildListCells(v, cellsWrap);
    rebuildEditIndex(v, editRow);
  });
  lenInp.addEventListener('click', e=>e.stopPropagation());

  item.appendChild(cellsWrap);
  rebuildListCells(v, cellsWrap);

  // "Edit index" footer — only shown for long lists (> THRESH)
  const editRow = document.createElement('div');
  editRow.className = 'var-list-editrow';
  editRow.id = `veditrow_${v.id}`;
  item.appendChild(editRow);
  rebuildEditIndex(v, editRow);
}

function rebuildEditIndex(v, editRow){
  const n = v.listItems.length;
  const THRESH = 8;
  editRow.innerHTML = '';
  if(n <= THRESH) return;

  editRow.style.display = 'flex';
  editRow.style.flexDirection = 'column';
  editRow.style.gap = '5px';

  const midIdx = Math.floor((n - 1) / 2);
  if(v._editIdx === undefined || v._editIdx >= n) v._editIdx = midIdx;

  // Top row: label
  const label = document.createElement('span');
  label.className = 'var-list-editlabel';
  label.textContent = 'Edit index';
  editRow.appendChild(label);

  // Bottom row: ‹ · idx · › · value (value stretches)
  const controlRow = document.createElement('div');
  controlRow.className = 'var-list-editcontrols';

  const leftBtn = document.createElement('button');
  leftBtn.className = 'var-list-editarrow';
  leftBtn.textContent = '‹';
  leftBtn.title = 'Previous index';

  const idxInp = document.createElement('input');
  idxInp.type = 'number'; idxInp.className = 'var-list-editidx';
  idxInp.min = 0; idxInp.max = n - 1; idxInp.step = 1;
  idxInp.placeholder = 'idx';
  idxInp.value = v._editIdx;

  const rightBtn = document.createElement('button');
  rightBtn.className = 'var-list-editarrow';
  rightBtn.textContent = '›';
  rightBtn.title = 'Next index';

  const valInp = document.createElement('input');
  valInp.type = 'number'; valInp.className = 'var-list-editval';
  valInp.step = 'any';
  valInp.value = v.listItems[v._editIdx];
  valInp.placeholder = 'value';

  function setIdx(idx){
    const clamped = Math.max(0, Math.min(n - 1, idx));
    v._editIdx = clamped;
    idxInp.value = clamped;
    valInp.value = v.listItems[clamped];
  }

  leftBtn.addEventListener('click', e=>{ e.stopPropagation(); setIdx(v._editIdx - 1); });
  rightBtn.addEventListener('click', e=>{ e.stopPropagation(); setIdx(v._editIdx + 1); });

  idxInp.addEventListener('input', ()=>{
    const raw = parseInt(idxInp.value);
    if(!isNaN(raw)) setIdx(raw);
  });
  idxInp.addEventListener('click', e=>e.stopPropagation());

  valInp.addEventListener('input', ()=>{
    const num = parseFloat(valInp.value);
    if(!isNaN(num) && v._editIdx >= 0 && v._editIdx < n){
      v.listItems[v._editIdx] = num;
    }
  });
  valInp.addEventListener('click', e=>e.stopPropagation());

  controlRow.appendChild(leftBtn);
  controlRow.appendChild(idxInp);
  controlRow.appendChild(rightBtn);
  controlRow.appendChild(valInp);
  editRow.appendChild(controlRow);
}

function rebuildListCells(v, cellsWrap){
  cellsWrap.innerHTML = '';
  const n = v.listItems.length;
  const THRESH = 8, HEAD = 4, TAIL = 4;

  function makeCell(i){
    const val = v.listItems[i];
    const cellWrap = document.createElement('div');
    cellWrap.className = 'var-list-cell-wrap';

    const idx = document.createElement('span');
    idx.className = 'var-list-idx';
    idx.textContent = i; // 0-based

    const cell = document.createElement('input');
    cell.type = 'number'; cell.className = 'var-list-cell';
    cell.value = val; cell.step = 'any';
    cell.addEventListener('input', ()=>{ const num=parseFloat(cell.value); v.listItems[i]=isNaN(num)?0:num; });
    cell.addEventListener('click', e=>e.stopPropagation());
    cell.addEventListener('keydown', e=>{
      if(e.key==='Tab'){
        e.preventDefault();
        const cells = cellsWrap.querySelectorAll('.var-list-cell');
        const pos = [...cells].indexOf(cell);
        const next = cells[e.shiftKey ? pos - 1 : pos + 1];
        if(next) next.focus();
      }
    });

    cellWrap.appendChild(idx);
    cellWrap.appendChild(cell);
    return cellWrap;
  }

  if(n <= THRESH){
    // All items in a single non-wrapping row
    const row = document.createElement('div');
    row.className = 'var-list-row';
    for(let i = 0; i < n; i++) row.appendChild(makeCell(i));
    cellsWrap.appendChild(row);
  } else {
    // Row 1: first HEAD cells — no wrapping
    const headRow = document.createElement('div');
    headRow.className = 'var-list-row';
    for(let i = 0; i < HEAD; i++) headRow.appendChild(makeCell(i));
    cellsWrap.appendChild(headRow);

    // Row 2: ellipsis centered on its own line
    const ellipsisRow = document.createElement('div');
    ellipsisRow.className = 'var-list-ellipsis-row';
    const ellipsis = document.createElement('span');
    ellipsis.className = 'var-list-ellipsis';
    ellipsis.textContent = '⋯';
    ellipsis.title = `${n - HEAD - TAIL} hidden item${n - HEAD - TAIL !== 1 ? 's' : ''}`;
    ellipsisRow.appendChild(ellipsis);
    cellsWrap.appendChild(ellipsisRow);

    // Row 3: last TAIL cells — no wrapping
    const tailRow = document.createElement('div');
    tailRow.className = 'var-list-row';
    for(let i = n - TAIL; i < n; i++) tailRow.appendChild(makeCell(i));
    cellsWrap.appendChild(tailRow);
  }
}

// ═══ TEMPLATE → VARIABLES SYNC ═══════════════════════════════════════════
function syncTemplateParamsToVars(tplKey, params){
  if(!TEMPLATES || !TEMPLATES[tplKey]) return;
  const tplParams = TEMPLATES[tplKey].params;
  for(const [pk, pd] of Object.entries(tplParams)){
    const currentVal = params[pk] ?? pd.default;
    const existing = variables.find(v=>v.fromTemplate && v.templateKey===tplKey && v.paramKey===pk);
    if(existing){
      existing.value = currentVal;
      existing.exprLatex = String(currentVal);
      existing.fullLatex = `${pk}=${currentVal}`;
      existing._isNumeric = true;
      const slider = document.getElementById(`vpslider_${existing.id}`);
      if(slider) syncParamSlider(existing);
    } else {
      addVariable('constant', {
        name: pk,
        value: currentVal,
        exprLatex: String(currentVal),
        fullLatex: `${pk}=${currentVal}`,
        paramMin: pd.min,
        paramMax: pd.max,
        fromTemplate: true,
        templateKey: tplKey,
        paramKey: pk,
        silent: true,
      });
    }
  }
  setSbTab('vars');
}

// ═══ PICKLE IMPORT ═══════════════════════════════════════════════════════
// Called by sidebars.js after user confirms the import modal.
// data: { varName: { kind: 'constant'|'list', value?, items? }, ... }
// sourceName: filename (for tagging + de-duplication)
// Key naming rules:
//   - 1-char key  → use as plain math variable (e.g. "a": 2  →  a=2)
//   - multi-char  → wrap in \text{} (e.g. "value": 9  →  \text{value}=9)
function importPickleVars(data, sourceName){
  for(const [rawKey, info] of Object.entries(data)){
    const isSingleChar = rawKey.length === 1;
    const latexName = isSingleChar ? rawKey : `\\text{${rawKey}}`;
    // The lookup name (for buildVarContext) stays as the raw string
    const name = rawKey;

    if(info.kind === 'constant'){
      const existing = variables.find(v=>v.name===name && v.pickleSource===sourceName);
      if(existing){
        existing.exprLatex = String(info.value);
        existing.fullLatex = `${latexName}=${info.value}`;
        existing._isNumeric = true;
        existing.value = info.value;
        renderVariables();
      } else {
        addVariable('constant', {
          name,
          exprLatex: String(info.value),
          fullLatex: `${latexName}=${info.value}`,
          value: info.value,
          pickleSource: sourceName,
          silent: true,
        });
      }
    } else if(info.kind === 'list'){
      const existing = variables.find(v=>v.name===name && v.pickleSource===sourceName);
      const items = (info.items || []).map(Number);
      if(existing){
        existing.listItems = items;
        existing.listLength = items.length;
        renderVariables();
      } else {
        addVariable('list', {
          name,
          listItems: items,
          listLength: items.length,
          pickleSource: sourceName,
          silent: true,
        });
      }
    }
  }
  setSbTab('vars');
}