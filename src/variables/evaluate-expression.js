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

  // Resolve bare \text{name} scalar variables from context.
  // The negative lookahead skips occurrences followed by \left( — those are
  // function calls handled by _resolveTextFnCalls below.
  expr = expr.replace(/\\text\{([^}]+)\}(?!\\left\()/g, (match, name) => {
    if(name in ctx) return `(${ctx[name]})`;
    return match;
  });

  // Dispatch \text{name}\left(...\right) to built-in special functions.
  expr = _resolveTextFnCalls(expr, ctx);

  // Resolve calls to known equation variables before variable substitution.
  // e.g. g\left(2,3\right) → (8) when g(x,t)=x+3t is defined.
  // Unknown names (not equation variables) are left as-is and become
  // implicit multiplication after LaTeX conversion.
  expr = _resolveFunctionCalls(expr, ctx);

  // Substitute known variables (longest names first to avoid partial matches)
  const ctxNames = Object.keys(ctx).filter(n=>n).sort((a,b)=>b.length-a.length);
  for(const name of ctxNames){
    if(name.includes('_')){
      // Match both b_{0} and b_0 in latex
      const [base, sub] = name.split('_');
      const pat = `${escapeRegex(base)}_(?:\\{${escapeRegex(sub)}\\}|${escapeRegex(sub)})(?![a-zA-Z0-9_])`;
      expr = expr.replace(new RegExp(pat, 'g'), `(${ctx[name]})`);
    } else {
      // Use lookahead/lookbehind instead of \b so that digit-adjacent names work,
      // e.g. '3t' with {t:5} → '3(5)' rather than failing to match.
      // Lookbehind: not preceded by letter or backslash (prevents partial matches
      // inside multi-char names like 'alpha', and skips LaTeX commands like '\theta').
      // Lookahead: not followed by letter/digit/underscore (avoids partial matches).
      expr = expr.replace(new RegExp(`(?<![a-zA-Z\\\\])${escapeRegex(name)}(?![a-zA-Z0-9_])`, 'g'), `(${ctx[name]})`);
    }
  }

  // Evaluate \binom{n}{r} with dual-mode dispatch.
  // Must run before the generic { → ( rule turns \binom into multiplication.
  expr = expr.replace(/\\binom\{([^}]*)\}\{([^}]*)\}/g, (match, nStr, rStr) => {
    const n = evalLatexExpr(nStr, ctx);
    const r = evalLatexExpr(rStr, ctx);
    if(n === null || r === null || !isFinite(n) || !isFinite(r)) return match;

    // Integer mode — exact symmetry-reduced product; no full factorial expansion.
    if(Number.isInteger(n) && Number.isInteger(r)){
      const ni = Math.round(n);
      let ri = Math.min(Math.round(r), ni - Math.round(r));
      if(ri < 0 || ni < 0) return '(0)';
      let c = 1;
      for(let i = 0; i < ri; i++) c = c*(ni-i)/(i+1);
      return `(${c})`;
    }

    // Continuous mode — analytic extension via Gamma function using log-space
    // for numerical stability: C(n,r) = Γ(n+1) / [Γ(r+1)·Γ(n-r+1)].
    const ln0 = lnGamma(n+1), ln1 = lnGamma(r+1), ln2 = lnGamma(n-r+1);
    // A pole in the denominator (ln1 or ln2 = Infinity) means the limit is 0.
    if(!isFinite(ln1) || !isFinite(ln2)) return '(0)';
    if(!isFinite(ln0)) return '(0/0)'; // undefined numerator
    const sign = gammaSign(n+1) * gammaSign(r+1) * gammaSign(n-r+1);
    if(sign === 0) return '(0)';
    const val = sign * Math.exp(ln0 - ln1 - ln2);
    return isFinite(val) ? `(${val})` : '(0/0)';
  });

  // Evaluate n! factorial. Matches a digit-sequence or parenthesised expression
  // followed by !. After variable substitution, n! becomes (value)! so both forms
  // are covered. Must run before the symbol-check strips letters.
  expr = expr.replace(/(\([^()]*\)|\d+(?:\.\d+)?)!/g, (match, nStr) => {
    const n = evalLatexExpr(nStr, ctx);
    if(n === null || !isFinite(n) || n < 0) return match;
    const ni = Math.round(n);
    let f = 1;
    for(let i = 2; i <= ni; i++) f *= i;
    return `(${f})`;
  });

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
    .replace(/\\arctanh/g,   'Math.atanh')
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
    .replace(/\\hbar/g,      'hbar')
    .replace(/\\ell/g,       'ell')
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

  // Resolve bare \text{name} scalar variables from context (skip function calls).
  expr = expr.replace(/\\text\{([^}]+)\}(?!\\left\()/g, (match, name) => {
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
