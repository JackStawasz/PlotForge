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
    mf.cmd(fullCmd);
  } else {
    mf.cmd(fullCmd);
  }
  hideLatexDropdown();
  mf.focus();
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
function parseVarLatex(fullLatex){
  const eqIdx = fullLatex.indexOf('=');
  if(eqIdx < 0) return { name: '', exprLatex: fullLatex };
  const lhs = fullLatex.slice(0, eqIdx).trim();
  const rhs = fullLatex.slice(eqIdx + 1).trim();
  // Check for \text{name} on LHS — extract the name inside braces
  const textMatch = lhs.match(/\\text\{([^}]+)\}/);
  let name;
  if(textMatch){
    name = textMatch[1]; // e.g. "var_name"
  } else {
    name = lhs.replace(/[\\{}^_\s]/g, '').replace(/left|right/g,'').trim();
  }
  return { name, exprLatex: rhs };
}

// ═══ VARIABLE CONTEXT ════════════════════════════════════════════════════
function buildVarContext(){
  const ctx = {};
  // Parameters: always numeric (value stored on v.value)
  for(const v of variables){
    if(v.kind === 'parameter' && v.name) ctx[v.name] = v.value;
  }
  // Variables (merged kind): if pure numeric → use v.value; else evaluate exprLatex
  for(const v of variables){
    if(v.kind === 'variable' && v.name){
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
  // Constants (legacy kind — keep for backward compat)
  for(const v of variables){
    if(v.kind === 'constant' && v.name){
      try{
        const localCtx = {...ctx};
        delete localCtx[v.name];
        const val = evalLatexExpr(v.exprLatex || '', localCtx);
        if(val !== null) ctx[v.name] = val;
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
    { key:'variable',  icon:'α',   label:'Variable',  desc:'Number or expression' },
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

function renderVariables(){
  const list = document.getElementById('varsList'); if(!list) return;
  const empty = document.getElementById('varsEmpty');
  if(empty) empty.style.display = variables.length ? 'none' : 'flex';
  list.innerHTML = '';

  variables.forEach(v=>{
    const item = document.createElement('div');
    item.className = `var-item var-item-${v.kind}`;
    item.dataset.vid = v.id;

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
      item.appendChild(headerTop);

      // Second row: name (left) + length control (right)
      const headerBot = document.createElement('div');
      headerBot.className = 'var-list-subheader';

      const nameInp = document.createElement('input');
      nameInp.type = 'text';
      nameInp.className = 'var-name-inp var-list-name';
      nameInp.id = `vname_${v.id}`;
      nameInp.value = v.name;
      nameInp.placeholder = 'name';
      nameInp.maxLength = 16;
      nameInp.addEventListener('input', ()=>{ v.name = nameInp.value; reEvalAllConstants(); });
      nameInp.addEventListener('click', e=>e.stopPropagation());
      nameInp.addEventListener('keydown', e=>{ if(e.key==='Enter') nameInp.blur(); e.stopPropagation(); });

      const lenWrap = document.createElement('div');
      lenWrap.className = 'var-list-lenrow';
      const lenLabel = document.createElement('span');
      lenLabel.className = 'var-list-lenlabel';
      lenLabel.textContent = 'n =';
      const lenInp = document.createElement('input');
      lenInp.type = 'number'; lenInp.className = 'var-list-leninp';
      lenInp.id = `vlen_${v.id}`; lenInp.value = v.listLength;
      lenInp.min = 1; lenInp.max = 999; lenInp.step = 1;

      headerBot.appendChild(nameInp);
      lenWrap.appendChild(lenLabel);
      lenWrap.appendChild(lenInp);
      headerBot.appendChild(lenWrap);
      item.appendChild(headerBot);

      buildListBody(item, v, lenInp);

    } else {
      // Non-list: single header row
      const header = document.createElement('div');
      header.className = 'var-item-header';
      const badge = document.createElement('span');
      badge.className = `var-kind-badge var-kind-${v.kind}`;
      badge.textContent = v.kind.charAt(0).toUpperCase() + v.kind.slice(1);
      header.appendChild(badge);
      if(v.pickleSource){
        const srcTag = document.createElement('span');
        srcTag.className = 'var-source-tag';
        srcTag.textContent = v.pickleSource;
        srcTag.title = `Imported from ${v.pickleSource}`;
        header.appendChild(srcTag);
      }
      header.appendChild(delBtn);
      item.appendChild(header);

      if(v.kind === 'constant')       buildConstantBody(item, v);
      else if(v.kind === 'variable')  buildVariableBody(item, v);
      else if(v.kind === 'parameter') buildParameterBody(item, v);
      else if(v.kind === 'equation')  buildEquationBody(item, v);
    }

    list.appendChild(item);
  });
}

function reEvalAllConstants(){
  for(const v of variables){
    if(v.kind === 'constant' || v.kind === 'variable') evaluateConstant(v);
  }
}

// ─── CONSTANT (legacy) ─────────────────────────────────────────────────────
function buildConstantBody(item, v){
  const mqWrap = document.createElement('div');
  mqWrap.className = 'var-mq-wrap var-mq-single-line';
  mqWrap.id = `vmq_${v.id}`;
  item.appendChild(mqWrap);

  const result = document.createElement('div');
  result.className = 'var-result';
  result.id = `vres_${v.id}`;
  item.appendChild(result);

  requestAnimationFrame(()=>{
    const mf = makeMathField(mqWrap, {
      spaceBehavesLikeTab: true,
      handlers:{
        edit(){
          v.fullLatex = mf.latex();
          const parsed = parseVarLatex(v.fullLatex);
          v.name = parsed.name;
          v.exprLatex = parsed.exprLatex;
          evaluateConstant(v);
          updateLatexDropdown(mf, mqWrap);
        }
      }
    });
    if(mf){
      const initLatex = v.fullLatex || (v.name ? `${v.name}=${v.exprLatex||''}` : (v.exprLatex || ''));
      if(initLatex) mf.latex(initLatex);
      evaluateConstant(v);
      wrapMathFieldWithAC(mqWrap, mf);
    }
  });
}

// ─── VARIABLE (merged constant+parameter) ──────────────────────────────────
// One MathField for "name = expr". If the RHS is a plain number → show slider.
// If the RHS is an expression → show evaluated result beneath.
function buildVariableBody(item, v){
  const mqWrap = document.createElement('div');
  mqWrap.className = 'var-mq-wrap var-mq-single-line';
  mqWrap.id = `vmq_${v.id}`;
  item.appendChild(mqWrap);

  // Result line — shows either "= <value>" (expression mode) or nothing (slider mode)
  const resultEl = document.createElement('div');
  resultEl.className = 'var-result';
  resultEl.id = `vres_${v.id}`;
  item.appendChild(resultEl);

  // Slider row — shown only in numeric mode
  const sliderWrap = document.createElement('div');
  sliderWrap.className = 'var-param-sliderrow';
  sliderWrap.id = `vslrow_${v.id}`;
  sliderWrap.style.display = 'none'; // hidden until we know mode

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

  // Determine whether the RHS is a pure number (slider mode) or expression (eval mode)
  function isNumericRhs(expr){
    if(!expr || !expr.trim()) return false;
    // A "pure number" is just digits, optional minus, optional decimal, optional whitespace
    // and no latex commands other than a leading minus
    const stripped = expr.replace(/\s+/g,'').replace(/^-/,'');
    return /^\d+\.?\d*$/.test(stripped) || /^\d*\.\d+$/.test(stripped);
  }

  function updateMode(mf){
    const numericRhs = isNumericRhs(v.exprLatex);
    v._isNumeric = numericRhs;
    if(numericRhs){
      // Slider mode
      sliderWrap.style.display = 'flex';
      resultEl.textContent = '';
      resultEl.className = 'var-result';
      // Parse the numeric value from exprLatex
      const num = parseFloat(v.exprLatex.replace(/[^\d.\-]/g,''));
      if(!isNaN(num)){
        v.value = num;
        syncParamSlider(v);
      }
    } else {
      // Expression mode
      sliderWrap.style.display = 'none';
      evaluateConstant(v);
    }
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
          v.exprLatex = parsed.exprLatex;
          updateMode(_mf);
          updateLatexDropdown(_mf, mqWrap);
        }
      }
    });
    if(_mf){
      const initLatex = v.fullLatex || (v.name ? `${v.name}=${v._isNumeric ? formatParamVal(v.value) : (v.exprLatex||'')}` : '');
      if(initLatex) _mf.latex(initLatex);
      updateMode(_mf);
      wrapMathFieldWithAC(mqWrap, _mf);
    }

    // Slider changes update the MathField and value
    slider.addEventListener('input', ()=>{
      v.value = parseFloat(slider.value);
      if(_mf){
        const name = v.name || 'a';
        _mf.latex(`${name}=${formatParamVal(v.value)}`);
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
  try{
    const ctx = buildVarContext();
    delete ctx[v.name];
    const val = evalLatexExpr(v.exprLatex || '', ctx);
    if(val !== null && val !== undefined){
      const formatted = Number.isInteger(val) ? String(val) : parseFloat(val.toPrecision(6)).toString();
      el.textContent = '= ' + formatted;
      el.className = 'var-result var-result-ok';
      return;
    }
    // Full eval failed — try partial: substitute knowns, report simplified form
    const partial = partialEvalLatex(v.exprLatex || '', ctx);
    if(partial !== null){
      el.textContent = '= ' + partial;
      el.className = 'var-result var-result-partial';
    } else {
      el.textContent = ''; el.className = 'var-result';
    }
  } catch(e){
    el.textContent = ''; el.className = 'var-result';
  }
}

// Partial evaluator: substitute known vars, collect unknown single-letter symbols,
// compute the numeric coefficient, return a readable string like "18c" or "9bc".
function partialEvalLatex(latex, ctx){
  if(!latex || !latex.trim()) return null;
  let expr = latex;

  // Resolve \text{name} from ctx
  expr = expr.replace(/\\text\{([^}]+)\}/g, (match, name) => {
    if(name in ctx) return `(${ctx[name]})`;
    return match;
  });

  // Collect unknown single-letter names from the raw latex (before substitution)
  // These are bare single letters not in ctx and not math commands
  const allLetters = new Set();
  // Find single latin letters used as variables (not preceded by \)
  const rawLetterRe = /(?<!\\)(?<![a-zA-Z])([a-zA-Z])(?![a-zA-Z])/g;
  let m;
  while((m = rawLetterRe.exec(expr)) !== null){
    const ch = m[1];
    // Skip if it's a known ctx variable — those will be substituted
    if(!(ch in ctx)) allLetters.add(ch);
  }

  // Substitute known ctx vars
  const ctxNames = Object.keys(ctx).filter(n=>n).sort((a,b)=>b.length-a.length);
  for(const name of ctxNames){
    const safeRe = new RegExp(`(?<!\\\\)\\b${escapeRegex(name)}\\b`, 'g');
    expr = expr.replace(safeRe, `(${ctx[name]})`);
  }

  // Now compute numeric coefficient: substitute all remaining unknown letters with 1
  let coeffExpr = expr;
  for(const ch of allLetters){
    const re = new RegExp(`(?<![a-zA-Z(])${ch}(?![a-zA-Z])`, 'g');
    coeffExpr = coeffExpr.replace(re, '(1)');
  }

  // Apply standard latex→JS transforms to the coefficient expression
  const toJS = e => e
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

  let coeff = null;
  try{
    const jsExpr = toJS(coeffExpr);
    // eslint-disable-next-line no-new-func
    coeff = Function('"use strict"; return (' + jsExpr + ')')();
  }catch(e){ return null; }

  if(typeof coeff !== 'number' || !isFinite(coeff)) return null;
  if(allLetters.size === 0) return null; // would have been caught by full eval

  // Format coefficient — omit "1" if it's a bare multiplier
  let coeffStr = Number.isInteger(coeff)
    ? String(coeff)
    : parseFloat(coeff.toPrecision(5)).toString();
  if(coeffStr === '1') coeffStr = '';
  else if(coeffStr === '-1') coeffStr = '-';

  // Build unknown part: sort letters for deterministic output
  const unknownPart = [...allLetters].sort().join('');

  if(!unknownPart) return null;
  return coeffStr + unknownPart;
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
  const ctxNames = Object.keys(ctx).filter(n=>n).sort((a,b)=>b.length-a.length);
  for(const name of ctxNames){
    const safeRe = new RegExp(`(?<!\\\\)\\b${escapeRegex(name)}\\b`, 'g');
    expr = expr.replace(safeRe, `(${ctx[name]})`);
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

  const stripped = expr.replace(/Math\.[a-z]+/g,'').replace(/Infinity/g,'');
  if(/[a-df-wyzA-DF-WYZ_$]/.test(stripped)) return null;

  // eslint-disable-next-line no-new-func
  const result = Function('"use strict"; return (' + expr + ')')();
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
  const midIdx = Math.floor((n - 1) / 2);
  if(v._editIdx === undefined || v._editIdx >= n) v._editIdx = midIdx;

  const label = document.createElement('span');
  label.className = 'var-list-editlabel';
  label.textContent = 'edit index';

  // ← arrow
  const leftBtn = document.createElement('button');
  leftBtn.className = 'var-list-editarrow';
  leftBtn.textContent = '‹';
  leftBtn.title = 'Previous index';

  const idxInp = document.createElement('input');
  idxInp.type = 'number'; idxInp.className = 'var-list-editidx';
  idxInp.min = 0; idxInp.max = n - 1; idxInp.step = 1;
  idxInp.placeholder = 'idx';
  idxInp.value = v._editIdx;

  // → arrow
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

  editRow.appendChild(label);
  editRow.appendChild(leftBtn);
  editRow.appendChild(idxInp);
  editRow.appendChild(rightBtn);
  editRow.appendChild(valInp);
}

function rebuildListCells(v, cellsWrap){
  cellsWrap.innerHTML = '';
  const n = v.listItems.length;
  const THRESH = 8, HEAD = 4, TAIL = 4;

  // Decide which real indices to show
  let slots; // array of { realIdx } or null (= ellipsis)
  if(n <= THRESH){
    slots = v.listItems.map((_, i) => ({ realIdx: i }));
  } else {
    slots = [];
    for(let i = 0; i < HEAD; i++) slots.push({ realIdx: i });
    slots.push(null); // ellipsis
    for(let i = n - TAIL; i < n; i++) slots.push({ realIdx: i });
  }

  slots.forEach(slot => {
    if(slot === null){
      // Ellipsis divider
      const el = document.createElement('div');
      el.className = 'var-list-ellipsis';
      el.textContent = '⋯';
      el.title = `${n - HEAD - TAIL} hidden items`;
      cellsWrap.appendChild(el);
      return;
    }
    const i = slot.realIdx;
    const val = v.listItems[i];

    const cellWrap = document.createElement('div');
    cellWrap.className = 'var-list-cell-wrap';

    const idx = document.createElement('span');
    idx.className = 'var-list-idx';
    idx.textContent = i; // 0-based index

    const cell = document.createElement('input');
    cell.type = 'number'; cell.className = 'var-list-cell';
    cell.value = val; cell.step = 'any';
    cell.addEventListener('input', ()=>{ const num=parseFloat(cell.value); v.listItems[i]=isNaN(num)?0:num; });
    cell.addEventListener('click', e=>e.stopPropagation());
    cell.addEventListener('keydown', e=>{
      if(e.key==='Tab'){
        e.preventDefault();
        // Navigate among only the visible cells, using real indices
        const visibleCells = [...cellsWrap.querySelectorAll('.var-list-cell')];
        const pos = visibleCells.indexOf(cell);
        const next = visibleCells[e.shiftKey ? pos - 1 : pos + 1];
        if(next) next.focus();
      }
    });

    cellWrap.appendChild(idx);
    cellWrap.appendChild(cell);
    cellsWrap.appendChild(cellWrap);
  });
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
      addVariable('variable', {
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
        addVariable('variable', {
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