// ═══ MATHQUILL INIT ══════════════════════════════════════════════════════
let MQ = null;

function initMathQuill(){
  try{ MQ = MathQuill.getInterface(2); }catch(e){ MQ = null; }
}

function makeMathField(el, opts){
  if(!MQ) return null;
  try{ return MQ.MathField(el, opts); }
  catch(e){ console.warn('MathQuill MathField failed:', e); return null; }
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

// ─── Dropdown singleton ───────────────────────────────────────────────────
let _latexDropdown    = null;
let _latexDropdownMF  = null;
let _latexDropdownIdx = -1;

function getLatexDropdown(){
  if(!_latexDropdown){
    _latexDropdown = document.createElement('div');
    _latexDropdown.id = 'latex-ac-dropdown';
    _latexDropdown.style.cssText = [
      'position:fixed','z-index:99999',
      'background:var(--s0)','border:1px solid var(--border2)','border-radius:6px',
      'box-shadow:0 6px 24px rgba(0,0,0,.55)',
      'font-family:var(--mono,monospace)','font-size:.8rem',
      'min-width:160px','max-width:260px','overflow:hidden','display:none',
    ].join(';');
    document.body.appendChild(_latexDropdown);
    // Dismiss when clicking outside
    document.addEventListener('mousedown', e=>{
      if(!_latexDropdown.contains(e.target)) hideLatexDropdown();
    }, true);
  }
  return _latexDropdown;
}

function showLatexDropdown(mf, items, anchorEl, mqEl){
  const dd = getLatexDropdown();
  _latexDropdownMF  = mf;
  _latexDropdownIdx = 0;
  dd.innerHTML = '';

  items.forEach((cmd, i)=>{
    const row = document.createElement('div');
    row.className = 'latex-ac-item';
    row.textContent = cmd;
    row.style.cssText = 'padding:6px 14px;cursor:pointer;color:var(--text);transition:background .08s;white-space:nowrap;';
    row.addEventListener('mouseenter', ()=>{ _latexDropdownIdx=i; highlightLatexItem(); });
    row.addEventListener('mousedown', e=>{ e.preventDefault(); applyLatexCompletion(mf, mqEl, cmd); });
    dd.appendChild(row);
  });

  dd.style.display = 'block';
  requestAnimationFrame(()=> highlightLatexItem());

  // Position below anchor, flip up if it would clip the viewport
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
  _latexDropdownMF  = null;
  _latexDropdownIdx = -1;
}

function highlightLatexItem(){
  const items = _latexDropdown?.querySelectorAll('.latex-ac-item');
  if(!items) return;
  items.forEach((el, i)=>{
    el.style.background = i===_latexDropdownIdx ? 'rgba(90,255,206,.12)' : '';
    el.style.color       = i===_latexDropdownIdx ? 'var(--acc2)' : 'var(--text)';
  });
}

function navigateLatexDropdown(dir){
  const items = _latexDropdown?.querySelectorAll('.latex-ac-item');
  if(!items || !items.length) return false;
  _latexDropdownIdx = Math.max(0, Math.min(items.length-1, _latexDropdownIdx + dir));
  highlightLatexItem();
  return true;
}

// Insert the selected command into the MathField.
// If MQ is in command-entry mode (e.g. user typed \si), cancel it first.
function applyLatexCompletion(mf, mqEl, fullCmd){
  const inCommandMode = !!(mqEl && mqEl.querySelector('.mq-command-text'));
  if(inCommandMode){
    mf.keystroke('Escape'); // cancel partial command; reverts to before the '\'
  } else {
    // Strip any trailing partial \word from the stored latex
    const latex = mf.latex();
    const match = latex.match(/\\([a-zA-Z]*)$/);
    if(match){
      for(let i = 0; i < match[0].length; i++) mf.keystroke('Backspace');
    }
  }

  // Decorator commands need an argument box; step cursor inside after insertion
  const decorators = new Set([
    '\\overline','\\underline','\\overbrace','\\underbrace',
    '\\hat','\\bar','\\vec','\\tilde','\\dot','\\ddot',
  ]);
  if(decorators.has(fullCmd)){
    mf.write(fullCmd + '{}');
    mf.keystroke('Left');
  } else if(fullCmd === '\\text'){
    mf.cmd('\\text');
  } else {
    mf.cmd(fullCmd);
  }

  hideLatexDropdown();
  mf.focus();
}

// After each MQ edit, fix cursor position for decorator commands and auto-parens.
// prevLatex: the latex string from the previous edit event.
function fixDecoratorCursor(mf, prevLatex){
  const latex = mf.latex();
  // Decorator just created with empty box → move cursor inside
  if(/\\overline\{\}$|\\underline\{\}$|\\hat\{\}$|\\bar\{\}$|\\vec\{\}$|\\tilde\{\}$/.test(latex)){
    mf.keystroke('Left');
    return;
  }
  // MathQuill auto-inserts \left(\right) on '(' — only correct on fresh insertion
  if(/\\left\(\\right\)$/.test(latex) && !/\\left\(\\right\)$/.test(prevLatex || '')){
    mf.keystroke('Left');
  }
}

// Recompute the autocomplete suggestion list from the current MQ state.
function updateLatexDropdown(mf, anchorEl, mqEl){
  // MQ command-entry mode: partial command lives in .mq-command-text
  const cmdSpan = mqEl && mqEl.querySelector('.mq-command-text');
  let partial = null;

  if(cmdSpan){
    const text = cmdSpan.textContent || '';
    if(text.length > 0){
      partial = '\\' + text;
    } else {
      hideLatexDropdown(); // just '\' typed, no letters yet
      return;
    }
  } else {
    // Fall back to trailing \word in the stored latex
    const latex = mf.latex();
    const match  = latex.match(/\\([a-zA-Z]+)$/);
    if(!match){ hideLatexDropdown(); return; }
    partial = '\\' + match[1];
  }

  const suggestions = LATEX_COMMANDS.filter(c => c.startsWith(partial)).slice(0, 5);
  if(!suggestions.length){ hideLatexDropdown(); return; }
  showLatexDropdown(mf, suggestions, anchorEl, mqEl);
}

// Attach keyboard navigation for the autocomplete dropdown to a MQ element.
function wrapMathFieldWithAC(mqEl, mf){
  mqEl.addEventListener('keydown', e=>{
    const dd   = _latexDropdown;
    const open = dd && dd.style.display !== 'none';

    if(open){
      if(e.key === 'ArrowDown'){ e.preventDefault(); navigateLatexDropdown(1);  return; }
      if(e.key === 'ArrowUp')  { e.preventDefault(); navigateLatexDropdown(-1); return; }
      if(e.key === 'Enter' || e.key === 'Tab'){
        const items = dd.querySelectorAll('.latex-ac-item');
        const idx   = _latexDropdownIdx >= 0 ? _latexDropdownIdx : 0;
        if(items[idx]){ e.preventDefault(); applyLatexCompletion(mf, mqEl, items[idx].textContent); return; }
      }
      if(e.key === 'Escape'){
        e.preventDefault();
        hideLatexDropdown();
        mf.keystroke('Escape'); // also cancel MQ command-entry mode
        return;
      }
    }

    // Escape with dropdown closed: cancel command-entry mode if active
    if(e.key === 'Escape' && !open){
      const cmdText = mqEl.querySelector('.mq-command-text');
      if(cmdText !== null){
        e.preventDefault();
        mf.keystroke('Escape');
      }
    }
  }, true);
}

// ═══ LATEX PARSING ═══════════════════════════════════════════════════════
// Parse "name = expr" from a full latex string.
// Returns { name, nameLatex, exprLatex }
//   name      — canonical lookup key (e.g. "b_0", "varName")
//   nameLatex — raw LHS latex for reconstructing fullLatex (e.g. "b_{0}", "\\alpha")
//   exprLatex — raw RHS latex
function parseVarLatex(fullLatex){
  const eqIdx = fullLatex.indexOf('=');
  if(eqIdx < 0) return { name: '', nameLatex: '', exprLatex: fullLatex };

  const lhs = fullLatex.slice(0, eqIdx).trim();
  const rhs = fullLatex.slice(eqIdx + 1).trim();

  let name;
  const textMatch = lhs.match(/\\text\{([^}]+)\}/);
  if(textMatch){
    name = textMatch[1];
  } else {
    // Support subscripts: b_{0} → "b_0", x_{12} → "x_12", a → "a"
    const subMatch = lhs.match(/^([a-zA-Z]+(?:\\[a-zA-Z]+)?)(?:_\{([^}]*)\}|_([a-zA-Z0-9]))?$/);
    if(subMatch){
      const base = subMatch[1].replace(/\\/g,'');
      const sub  = subMatch[2] !== undefined ? subMatch[2]
                 : subMatch[3] !== undefined ? subMatch[3] : null;
      name = sub !== null ? `${base}_${sub}` : base;
    } else {
      name = lhs.replace(/[\\{}^_\s]/g, '').replace(/left|right/g,'').trim();
    }
  }

  return { name, nameLatex: lhs, exprLatex: rhs };
}

// ═══ VARIABLE CONTEXT ════════════════════════════════════════════════════
// Build a plain {name: numericValue} map from the current variable list.
// Resolution order: global first, then local (active tab) — local shadows global.
// Parameters always contribute; constants only if they have no active duplicate warning.
function buildVarContext(){
  const ctx = {};
  const localTabId = (typeof activeTabId !== 'undefined') ? activeTabId : null;

  // Helper: fold one ordered subset of variables into ctx.
  function _foldVars(subset){
    for(const v of subset){
      if(v.kind === 'parameter' && v.name) ctx[v.name] = v.value;
    }
    for(const v of subset){
      if(v.kind === 'constant' && v.name && !(v._warning?.active)){
        try{
          if(v._isNumeric){
            ctx[v.name] = v.value;
          } else {
            const localCtx = {...ctx};
            delete localCtx[v.name]; // prevent self-reference
            const val = evalLatexExpr(v.exprLatex || '', localCtx);
            if(val !== null) ctx[v.name] = val;
          }
        }catch(e){}
      }
    }
  }

  // Global vars first (baseline)
  _foldVars(variables.filter(v => (v.scope ?? 'global') === 'global'));
  // Local vars second — overwrite any global entry with same name
  if(localTabId) _foldVars(variables.filter(v => v.scope === localTabId));

  return ctx;
}

// ═══ EXPRESSION EVALUATION ═══════════════════════════════════════════════
// Utility: escape a string for use inside a RegExp literal.
function escapeRegex(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Format a number for display: scientific notation for |exp| > 6, plain otherwise.
function fmtNum(val){
  if(!isFinite(val)) return String(val);
  if(val === 0)      return '0';
  if(Number.isInteger(val) && Math.abs(val) < 1e7) return String(val);
  const abs = Math.abs(val);
  const exp = Math.floor(Math.log10(abs));
  if(Math.abs(exp) <= 6) return parseFloat(val.toPrecision(6)).toString();
  const coeff        = val / Math.pow(10, exp);
  const coeffRounded = parseFloat(coeff.toPrecision(4));
  if(coeffRounded ===  1) return `10^{${exp}}`;
  if(coeffRounded === -1) return `-10^{${exp}}`;
  return `${coeffRounded}\\cdot10^{${exp}}`;
}

// Fully evaluate a latex expression string to a number using the given context.
// Returns null if the result contains unresolved symbols.
function evalLatexExpr(latex, ctx={}){
  if(!latex || !latex.trim()) return null;
  let expr = latex;

  // Resolve \text{name} from context first
  expr = expr.replace(/\\text\{([^}]+)\}/g, (match, name) => {
    if(name in ctx) return `(${ctx[name]})`;
    return match;
  });

  // Substitute known variables (longest names first to avoid partial matches)
  const ctxNames = Object.keys(ctx).filter(n=>n).sort((a,b)=>b.length-a.length);
  for(const name of ctxNames){
    if(name.includes('_')){
      // Match both b_{0} and b_0 in latex
      const [base, sub] = name.split('_');
      const pat = `${escapeRegex(base)}_(?:\\{${escapeRegex(sub)}\\}|${escapeRegex(sub)})(?![a-zA-Z0-9_])`;
      expr = expr.replace(new RegExp(pat, 'g'), `(${ctx[name]})`);
    } else {
      expr = expr.replace(new RegExp(`(?<!\\\\)\\b${escapeRegex(name)}\\b`, 'g'), `(${ctx[name]})`);
    }
  }

  // Convert latex syntax to JS
  expr = expr
    .replace(/\\pi/g,        '(Math.PI)')
    .replace(/\\e(?![a-zA-Z])/g, '(Math.E)')
    .replace(/\\infty/g,     'Infinity')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '(($1)/($2))')
    .replace(/\\sqrt\{([^}]*)\}/g, 'Math.sqrt($1)')
    .replace(/\\sin/g,       'Math.sin')
    .replace(/\\cos/g,       'Math.cos')
    .replace(/\\tan/g,       'Math.tan')
    .replace(/\\arcsin/g,    'Math.asin')
    .replace(/\\arccos/g,    'Math.acos')
    .replace(/\\arctan/g,    'Math.atan')
    .replace(/\\sinh/g,      'Math.sinh')
    .replace(/\\cosh/g,      'Math.cosh')
    .replace(/\\tanh/g,      'Math.tanh')
    .replace(/\\ln/g,        'Math.log')
    .replace(/\\log/g,       'Math.log10')
    .replace(/\\exp/g,       'Math.exp')
    .replace(/\\left\(/g,    '(').replace(/\\right\)/g,')')
    .replace(/\\left\[/g,    '[').replace(/\\right\]/g,']')
    .replace(/\\left\|/g,    'Math.abs(').replace(/\\right\|/g,')')
    .replace(/\^\{([^}]*)\}/g, '**($1)')
    .replace(/\^(\w)/g,      '**$1')
    .replace(/\_\{[^}]*\}/g, '').replace(/\_\w/g,'')
    .replace(/\\cdot/g,'*').replace(/\\times/g,'*')
    .replace(/\{/g,'(').replace(/\}/g,')')
    .replace(/\\[a-zA-Z]+/g, ''); // strip remaining unknown commands

  // Insert implicit multiplication between adjacent tokens
  let implExpr = expr
    .replace(/\)\s*\(/g,  ')*(')
    .replace(/(\d)\s*\(/g,'$1*(')
    .replace(/\)\s*(\d)/g,')*$1')
    .replace(/(\d)\s+(\d)/g,'$1*$2');

  // Bail if unknown symbols remain
  const stripped = implExpr.replace(/Math\.[a-z]+/g,'').replace(/Infinity/g,'');
  if(/[a-df-wyzA-DF-WYZ_$]/.test(stripped)) return null;

  // eslint-disable-next-line no-new-func
  const result = Function('"use strict"; return (' + implExpr + ')')();
  return typeof result === 'number' ? result : null;
}

// Partially evaluate a latex expression, substituting known variables and
// extracting a numeric coefficient from the remaining symbolic terms.
// Returns a latex string like "2b_{0}" or null if no simplification is possible.
function partialEvalLatex(latex, ctx){
  if(!latex || !latex.trim()) return null;
  let expr = latex;

  // Resolve \text{name} from context
  expr = expr.replace(/\\text\{([^}]+)\}/g, (match, name) => {
    if(name in ctx) return `(${ctx[name]})`;
    return match;
  });

  // Collect unknown symbol tokens before substituting known ones
  const unknownTokens = [];
  const seenKeys = new Set();

  // Subscripted tokens: letter_{stuff} or letter_digit
  const subRe = /(?<!\\)([a-zA-Z])_\{([^}]*)\}|(?<!\\)([a-zA-Z])_([a-zA-Z0-9])/g;
  let m;
  while((m = subRe.exec(expr)) !== null){
    const base = m[1] || m[3];
    const sub  = m[2] !== undefined ? m[2] : m[4];
    const key  = `${base}_${sub}`;
    const ltx  = `${base}_{${sub}}`;
    if(!(key in ctx) && !seenKeys.has(key)){
      seenKeys.add(key);
      unknownTokens.push({ latex: ltx, key });
    }
  }
  // Plain single letters
  const plainRe = /(?<!\\)(?<![a-zA-Z])([a-zA-Z])(?![a-zA-Z_{])/g;
  while((m = plainRe.exec(expr)) !== null){
    const ch = m[1];
    if(!(ch in ctx) && !seenKeys.has(ch)){
      seenKeys.add(ch);
      unknownTokens.push({ latex: ch, key: ch });
    }
  }
  if(unknownTokens.length === 0) return null;

  // Substitute known context variables
  const ctxNames = Object.keys(ctx).filter(n=>n).sort((a,b)=>b.length-a.length);
  for(const name of ctxNames){
    if(name.includes('_')){
      const [base, sub] = name.split('_');
      const pat = `${escapeRegex(base)}_(?:\\{${escapeRegex(sub)}\\}|${escapeRegex(sub)})(?![a-zA-Z0-9_])`;
      expr = expr.replace(new RegExp(pat,'g'), `(${ctx[name]})`);
    } else {
      expr = expr.replace(new RegExp(`(?<!\\\\)\\b${escapeRegex(name)}\\b`,'g'), `(${ctx[name]})`);
    }
  }

  // Substitute unknown tokens with 1 to extract the numeric coefficient
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

  // Convert the coefficient latex expression to evaluable JS
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

  // Format the coefficient (suppress "1" and "-1" prefixes)
  let coeffStr = Number.isInteger(coeff) ? String(coeff) : parseFloat(coeff.toPrecision(5)).toString();
  if(coeffStr === '1') coeffStr = '';
  else if(coeffStr === '-1') coeffStr = '-';

  const unknownLatex = unknownTokens
    .slice().sort((a,b) => a.key.localeCompare(b.key))
    .map(t => t.latex).join(' ');

  if(!unknownLatex) return null;
  return coeffStr + unknownLatex;
}

// ═══ INCOMPLETE EXPRESSION DETECTION ═════════════════════════════════════
// Returns true when a LaTeX expression fragment is clearly unfinished:
//   • a structural command (\frac, \sqrt, …) has an empty argument slot { }
//   • a superscript or subscript has an empty argument slot ^{} / _{}
//   • the expression ends with a dangling binary/relational operator
function isIncompleteExpr(latex){
  if(!latex || !latex.trim()) return false;
  const s = latex.trim();

  // Empty super/subscript:  x^{} or x_{}  (MathQuill outputs { } for unfilled slots)
  if(/[\^_]\s*\{\s*\}/.test(s)) return true;

  // Structural command with any empty brace argument
  // The pattern: command present in string  AND  a bare {  } exists anywhere
  if(/\\(?:frac|sqrt|binom|hat|bar|vec|tilde|dot|ddot|overline|underline|widehat|widetilde)\b/.test(s) && /\{\s*\}/.test(s)) return true;

  // Trailing binary or relational operator (nothing written after it yet)
  if(/[+\-\*\/=<>]\s*$/.test(s)) return true;
  if(/\\(?:cdot|times|div|pm|mp|leq|geq|neq|approx|sim)\s*$/.test(s)) return true;

  return false;
}

// ═══ CONSTANT EVALUATION ═════════════════════════════════════════════════
// Evaluate a constant variable's expression and update its result display.
// Tries fast JS evaluation first; falls back to the SymPy backend if needed.
function evaluateConstant(v){
  const el = document.getElementById(`vres_${v.id}`); if(!el) return;

  // Cancel any pending timers on every call (new input resets the clock)
  clearTimeout(v._evalTimer);
  clearTimeout(v._invalidTimer);
  if(v._warning) v._warning.clearInvalid();

  if(v._isNumeric){ el.innerHTML = ''; el.className = 'var-result'; return; }

  const expr = (v.exprLatex || '').trim();

  // Empty expression — nothing to evaluate, nothing to show
  if(!expr){ el.innerHTML = ''; el.className = 'var-result'; return; }

  const ctx = buildVarContext();
  delete ctx[v.name]; // exclude self

  // Fast path: pure-JS numeric evaluation
  const val = evalLatexExpr(expr, ctx);
  if(val !== null && val !== undefined){
    _renderResultMQ(el, '= ' + fmtNum(val), 'var-result var-result-ok');
    return;
  }

  // Non-empty but not immediately resolvable — show loading dots
  el.innerHTML = '<span class="var-eval-loading">···</span>';
  el.className = 'var-result';

  // After 1 s of no valid result, warn — label as "incomplete expression" when
  // the expression is clearly unfinished, otherwise "Invalid expression"
  v._invalidTimer = setTimeout(()=>{
    if(v._isNumeric) return;
    const elNow = document.getElementById(`vres_${v.id}`);
    if(elNow){ elNow.innerHTML = ''; elNow.className = 'var-result'; }
    if(v._warning){
      const msg = isIncompleteExpr((v.exprLatex || '').trim())
        ? 'incomplete expression' : 'Invalid expression';
      v._warning.setInvalid(msg);
    }
  }, 1000);

  // Debounced backend call (300 ms) to avoid flooding on rapid typing
  v._evalTimer = setTimeout(async ()=>{
    try{
      const varDefs = [];
      for(const [name, numVal] of Object.entries(ctx)){
        varDefs.push({ id: `ctx_${name}`, name, expr_latex: String(numVal), kind: 'parameter' });
      }
      varDefs.push({ id: String(v.id), name: v.name, expr_latex: expr, kind: 'constant' });

      const resp = await fetch(`${API}/evaluate`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ variables: varDefs }),
      });
      if(!resp.ok) return;
      const data   = await resp.json();
      const result = (data.results || []).find(r => r.id === String(v.id));
      if(!result) return;

      // Re-check element is still live and variable hasn't switched to numeric mode
      const elNow = document.getElementById(`vres_${v.id}`);
      if(!elNow || v._isNumeric) return;

      if(result.is_numeric && result.value !== null){
        clearTimeout(v._invalidTimer);
        _renderResultMQ(elNow, '= ' + fmtNum(result.value), 'var-result var-result-ok');
        if(v._warning) v._warning.clearInvalid();
      } else if(result.latex && result.latex.trim()){
        clearTimeout(v._invalidTimer);
        _renderResultMQ(elNow, '= ' + result.latex, 'var-result var-result-partial');
        if(v._warning) v._warning.clearInvalid();
      } else if(result.error && result.error !== 'empty'){
        // Clear the dots immediately; the 1s _invalidTimer will show the warning
        elNow.innerHTML = ''; elNow.className = 'var-result';
      }
    }catch(e){
      // Backend unreachable — clear loading dots; don't warn (reconnect popup handles it)
      const elNow = document.getElementById(`vres_${v.id}`);
      if(elNow) { elNow.innerHTML = ''; elNow.className = 'var-result'; }
    }
  }, 300);
}

// Render a latex string into a result element via MQ StaticMath.
function _renderResultMQ(el, latex, className){
  el.className  = className;
  el.innerHTML  = '';
  if(MQ){
    try{
      const span = document.createElement('span');
      el.appendChild(span);
      MQ.StaticMath(span).latex(latex);
      return;
    }catch(e){}
  }
  el.textContent = latex; // fallback
}

// ═══ SLIDER HELPERS ══════════════════════════════════════════════════════
// Choose a visually "nice" step size for a slider spanning [min, max].
function niceParamStep(min, max){
  const span = Math.abs(max - min); if(!span) return 0.1;
  const raw  = span / 100;
  const mag  = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1,2,5].map(f=>f*mag).find(s=>s>=raw) || mag;
}

// Format a slider/parameter value for display (4 sig-figs for non-integers).
function formatParamVal(n){
  return Number.isInteger(n) ? String(n) : parseFloat(n.toPrecision(4)).toString();
}

// Keep a slider's position, min, and max in sync with the variable's numeric state.
function syncParamSlider(v){
  const slider = document.getElementById(`vpslider_${v.id}`); if(!slider) return;
  if(v.value < v.paramMin){
    v.paramMin = v.value; slider.min = v.paramMin;
    const mi = document.getElementById(`vpmin_${v.id}`); if(mi) mi.value = v.paramMin;
  }
  if(v.value > v.paramMax){
    v.paramMax = v.value; slider.max = v.paramMax;
    const ma = document.getElementById(`vpmax_${v.id}`); if(ma) ma.value = v.paramMax;
  }
  slider.value = v.value;
}

// Rebuild a slider's range after the user changes the min/max bounds.
function rebuildParamSlider(v){
  const slider = document.getElementById(`vpslider_${v.id}`); if(!slider) return;
  const minEl  = document.getElementById(`vpmin_${v.id}`);
  const maxEl  = document.getElementById(`vpmax_${v.id}`);
  slider.min  = v.paramMin;
  slider.max  = v.paramMax;
  slider.step = niceParamStep(v.paramMin, v.paramMax);
  v.value     = Math.max(v.paramMin, Math.min(v.paramMax, v.value));
  slider.value = v.value;
  if(minEl) minEl.value = v.paramMin;
  if(maxEl) maxEl.value = v.paramMax;
  // Refresh the MathField display to reflect the clamped value
  const mqEl = document.getElementById(`vmq_${v.id}`);
  if(mqEl && MQ){
    try{
      const mf   = MQ.MathField(mqEl);
      const name = v.name || 'p';
      mf.latex(`${name}=${formatParamVal(v.value)}`);
    }catch(e){}
  }
}

// ═══ EQUATION VALIDATION ═════════════════════════════════════════════════
// Validate a user-typed equation latex and update the variable's warning state.
function validateEquationLatex(latex, v){
  if(!v._warning) return;
  if(!latex || !latex.trim()){ v._warning.clearInvalid(); return; }

  const eqIdx = latex.indexOf('=');
  if(eqIdx < 0){ v._warning.setInvalid('Missing "=" sign'); return; }

  const lhs = latex.slice(0, eqIdx).trim();

  if(!/\\left\(|\(/.test(lhs)){
    v._warning.setInvalid('Missing independent variable'); return;
  }
  if(/\\left\(\\right\)/.test(lhs)){
    v._warning.setInvalid('Missing independent variable'); return;
  }

  const nameRaw  = lhs.replace(/\\left\(.*$|\(.*$/,'').trim();
  if(!nameRaw){ v._warning.setInvalid('Missing function name'); return; }

  const isText       = /^\\text\{[^}]+\}/.test(nameRaw);
  const isSingleChar = /^[a-zA-Z](_\{[^}]*\}|_[a-zA-Z0-9])?$/.test(nameRaw);
  if(!isText && !isSingleChar){ v._warning.setInvalid('Invalid function name'); return; }

  v._warning.clearInvalid();
}
