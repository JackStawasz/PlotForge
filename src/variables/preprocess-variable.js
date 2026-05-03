// ─── Special \text{} function registry ───────────────────────────────────
// Maps operator names (written as \text{name} in LaTeX) to their JS implementations.
// `arity`: expected argument count.  `fn`: receives numeric args, returns a number.
// Multi-arg functions take (degree/order, x) — always integers for the first arg.
// The helper functions (besselJ, erfApprox, airyAi, …) live in math.js and are
// guaranteed to be loaded before this file.
const TEXT_FN_REGISTRY = {
  // Inverse hyperbolic
  arcsinh:{ arity:1, fn: v      => Math.asinh(v) },
  arccosh:{ arity:1, fn: v      => Math.acosh(v) },
  arctanh:{ arity:1, fn: v      => Math.atanh(v) },
  // Reciprocal-trig inverses
  arccsc: { arity:1, fn: v      => Math.asin(1/v) },
  arccsch:{ arity:1, fn: v      => Math.asinh(1/v) },
  arcsec: { arity:1, fn: v      => Math.acos(1/v) },
  arcsech:{ arity:1, fn: v      => Math.acosh(1/v) },
  arccot: { arity:1, fn: v      => Math.PI/2 - Math.atan(v) },
  arccoth:{ arity:1, fn: v      => Math.atanh(1/v) },
  // Reciprocal hyperbolic
  csch:   { arity:1, fn: v      => 1/Math.sinh(v) },
  sech:   { arity:1, fn: v      => 1/Math.cosh(v) },
  coth:   { arity:1, fn: v      => 1/Math.tanh(v) },
  // Normalised sinc: sin(πx)/(πx)
  sinc:   { arity:1, fn: v      => { const a=Math.PI*v; return Math.abs(a)<1e-10?1:Math.sin(a)/a; } },
  // Error function family
  erf:    { arity:1, fn: v      => erfApprox(v) },
  erfc:   { arity:1, fn: v      => 1-erfApprox(v) },
  // Airy Ai(x)  — keyword \text{airy}, displayed as \text{Ai} in templates
  airy:     { arity:1, fn: v      => airyAi(v) },
  // Fresnel integrals — full-name keywords
  fresnelC: { arity:1, fn: v      => fresnelC(v) },
  fresnelS: { arity:1, fn: v      => fresnelS(v) },
  // Bessel J_n(x): two args (n, x)
  bessel:   { arity:2, fn: (n,v)  => besselJ(Math.round(n), v) },
  // Orthogonal polynomials: two args (degree, x) — helpers defined in math.js
  legendre: { arity:2, fn: (n,v)  => legendreP(Math.round(n), v) },
  hermite:  { arity:2, fn: (n,v)  => hermiteH(Math.round(n), v) },
  laguerre: { arity:2, fn: (n,v)  => laguerreL(Math.round(n), v) },
  chebyshev:{ arity:2, fn: (n,v)  => chebyshevT(Math.round(n), v) },
};

// ═══ EQUATION PARAMETER EXTRACTION ═══════════════════════════════════════
// Parse parameter names from the LHS of a function definition latex string.
// e.g. 'g\left(t\right)=3t'    → ['t']
// e.g. 'g\left(x,t\right)=x+t' → ['x','t']
function extractEquationParams(fullLatex){
  if(!fullLatex) return ['x'];
  const eqIdx = fullLatex.indexOf('=');
  if(eqIdx < 0) return ['x'];
  const lhs = fullLatex.slice(0, eqIdx).trim();
  let paramStr = null;
  const leftMatch = lhs.match(/\\left\((.*?)\\right\)/);
  if(leftMatch){ paramStr = leftMatch[1]; }
  else { const pm = lhs.match(/\(([^)]*)\)/); if(pm) paramStr = pm[1]; }
  if(!paramStr || !paramStr.trim()) return ['x'];
  const params = paramStr.split(',').map(p=>{
    p = p.trim(); if(!p) return null;
    if(/^[a-zA-Z]$/.test(p)) return p;
    const subM = p.match(/^([a-zA-Z])_\{([^}]+)\}$/); if(subM) return subM[1]+'_'+subM[2];
    const txtM = p.match(/^\\text\{([^}]+)\}$/);       if(txtM) return txtM[1];
    return null;
  }).filter(Boolean);
  return params.length ? params : ['x'];
}

// Extract the content and end position of a \left(…\right) block.
// `start` is the position immediately after the opening \left(.
// Returns [argsStr, endPos] where endPos points past the closing \right).
function _extractBalancedArgs(str, start){
  let depth=1, i=start;
  while(i<str.length){
    if(str.startsWith('\\left(',i)||str.startsWith('\\left[',i)){depth++;i+=6;continue;}
    if(str.startsWith('\\right)',i)){depth--;if(depth===0)return[str.slice(start,i),i+7];i+=7;continue;}
    if(str.startsWith('\\right]',i)){depth--;if(depth===0)return[null,-1];i+=7;continue;}
    if(str[i]==='{')depth++; else if(str[i]==='}')depth--;
    i++;
  }
  return[null,-1];
}

// Split a latex argument string on top-level commas only.
function _splitLatexArgs(str){
  const args=[]; let depth=0, start=0, i=0;
  while(i<str.length){
    if(str.startsWith('\\left(',i)||str.startsWith('\\left[',i)){depth++;i+=6;continue;}
    if(str.startsWith('\\right)',i)||str.startsWith('\\right]',i)){depth--;i+=7;continue;}
    if(str[i]==='{'){depth++;i++;continue;} if(str[i]==='}'){depth--;i++;continue;}
    if(str[i]===','&&depth===0){args.push(str.slice(start,i).trim());start=i+1;}
    i++;
  }
  const last=str.slice(start).trim(); if(last) args.push(last);
  return args;
}

// Resolve \text{name}\left(...\right) calls to built-in special functions from
// TEXT_FN_REGISTRY.  Runs after context variable substitution so that arguments
// that reference variables are already simplified to numbers.
// Calls evalLatexExpr recursively on each argument — a depth guard prevents
// runaway recursion if an argument somehow contains another \text{} call.
let _textFnCallDepth = 0;
function _resolveTextFnCalls(expr, ctx){
  if(_textFnCallDepth >= 4) return expr;
  _textFnCallDepth++;
  try{
    let result = expr;
    for(let iter=0; iter<8; iter++){
      let anyReplaced = false;
      const pat = /\\text\{([^}]+)\}\\left\(/g;
      let m;
      while((m = pat.exec(result)) !== null){
        const name  = m[1];
        const entry = TEXT_FN_REGISTRY[name];
        if(!entry){ pat.lastIndex = m.index+1; continue; }
        const [argsStr, endPos] = _extractBalancedArgs(result, m.index+m[0].length);
        if(argsStr===null){ pat.lastIndex = m.index+1; continue; }
        const rawArgs = _splitLatexArgs(argsStr);
        if(rawArgs.length !== entry.arity){ pat.lastIndex = m.index+1; continue; }
        const evaledArgs = rawArgs.map(a => evalLatexExpr(a, ctx));
        if(evaledArgs.some(a => a===null || !isFinite(a))){ pat.lastIndex = m.index+1; continue; }
        let fnResult;
        try{ fnResult = entry.fn(...evaledArgs); }catch(e){ pat.lastIndex = m.index+1; continue; }
        if(fnResult===null || !isFinite(fnResult)){ pat.lastIndex = m.index+1; continue; }
        const repl = `(${fnResult})`;
        result = result.slice(0, m.index) + repl + result.slice(endPos);
        pat.lastIndex = m.index + repl.length;
        anyReplaced = true;
      }
      if(!anyReplaced) break;
    }
    return result;
  }finally{
    _textFnCallDepth--;
  }
}

// Recursion guard for function call evaluation.
let _funcCallDepth = 0;

// Preprocess a latex expression string, replacing calls to known equation variables
// with their numeric result.  Example: if g(x,t)=x+3t and the expression contains
// g\left(2,2\right), it is replaced with (8).
// Only single-letter function names are matched (e.g. g, f, h) so that
// something like t\left(2\right) is treated as implicit multiplication when t is
// not an equation variable.
function _resolveFunctionCalls(latex, ctx){
  if(typeof variables==='undefined'||_funcCallDepth>=8) return latex;
  const fnVars=variables.filter(v=>
    v.kind==='equation'&&v.name&&v.exprLatex&&v.fullLatex&&/^[a-zA-Z]$/.test(v.name)
  );
  if(!fnVars.length) return latex;
  _funcCallDepth++;
  try{
    let expr=latex;
    for(let iter=0;iter<8;iter++){
      let anyReplaced=false;
      for(const fv of fnVars){
        const params=extractEquationParams(fv.fullLatex);
        const pat=new RegExp(`(?<![a-zA-Z\\\\])${escapeRegex(fv.name)}\\\\left\\(`,'g');
        let m;
        while((m=pat.exec(expr))!==null){
          const[argsStr,endPos]=_extractBalancedArgs(expr,m.index+m[0].length);
          if(argsStr===null){pat.lastIndex=m.index+1;continue;}
          const args=_splitLatexArgs(argsStr);
          if(args.length!==params.length){pat.lastIndex=m.index+1;continue;}
          const evaledArgs=args.map(a=>evalLatexExpr(a,ctx));
          if(evaledArgs.some(a=>a===null||!isFinite(a))){pat.lastIndex=m.index+1;continue;}
          const fnCtx=Object.assign({},ctx);
          params.forEach((p,i)=>{fnCtx[p]=evaledArgs[i];});
          const fnResult=evalLatexExpr(fv.exprLatex,fnCtx);
          if(fnResult===null||!isFinite(fnResult)){pat.lastIndex=m.index+1;continue;}
          const repl=`(${fnResult})`;
          expr=expr.slice(0,m.index)+repl+expr.slice(endPos);
          pat.lastIndex=m.index+repl.length;
          anyReplaced=true;
        }
      }
      if(!anyReplaced) break;
    }
    return expr;
  }finally{
    _funcCallDepth--;
  }
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

// ═══ UTILITIES ═══════════════════════════════════════════════════════════
// Utility: escape a string for use inside a RegExp literal.
function escapeRegex(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

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

// ═══ LATEX → PYTHON CONVERSION ════════════════════════════════════════════
// Convert a LaTeX expression string to a Python expression string.
// Best-effort: handles powers, fractions, trig, absolute value, implicit mul.
function latexToPython(latex){
  if(!latex||!latex.trim()) return '';
  let expr = latex.trim();

  // Map known \text{name} operators to Python equivalents; fall back to bare name.
  const _PY_FN = {
    erf:'math.erf', erfc:'math.erfc',
    arcsinh:'math.asinh', arccosh:'math.acosh', arctanh:'math.atanh',
    arccsc:'math.asin',   arccsch:'math.asinh',
    arcsec:'math.acos',   arcsech:'math.acosh',
    arccot:'math.atan',   arccoth:'math.atanh',
    csch:'np.csch', sech:'np.sech', coth:'np.coth',
    sinc:'np.sinc',
    airy:'scipy.special.airy',
    bessel:'scipy.special.jv',
    fresnelC:'scipy.special.fresnel_c', fresnelS:'scipy.special.fresnel_s',
    legendre:'scipy.special.legendre', hermite:'scipy.special.hermite',
    laguerre:'scipy.special.laguerre', chebyshev:'scipy.special.chebyt',
  };
  expr = expr.replace(/\\text\{([^}]+)\}/g, (_, name) => _PY_FN[name] || name);

  // Subscripted identifiers: b_{0} → b_0
  expr = expr
    .replace(/([a-zA-Z])_\{([^}]+)\}/g, '$1_$2')
    .replace(/([a-zA-Z])_([a-zA-Z0-9])/g, '$1_$2');

  // LaTeX commands → Python
  expr = expr
    .replace(/\\pi/g,             'math.pi')
    .replace(/\\e(?![a-zA-Z])/g, 'math.e')
    .replace(/\\infty/g,          'math.inf')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
    .replace(/\\sqrt\{([^{}]*)\}/g,'math.sqrt($1)')
    .replace(/\\sin/g,    'math.sin')
    .replace(/\\cos/g,    'math.cos')
    .replace(/\\tan/g,    'math.tan')
    .replace(/\\arcsin/g,  'math.asin')
    .replace(/\\arccos/g,  'math.acos')
    .replace(/\\arctanh/g, 'math.atanh')
    .replace(/\\arctan/g,  'math.atan')
    .replace(/\\sinh/g,    'math.sinh')
    .replace(/\\cosh/g,   'math.cosh')
    .replace(/\\tanh/g,   'math.tanh')
    .replace(/\\ln/g,     'math.log')
    .replace(/\\log/g,    'math.log10')
    .replace(/\\exp/g,    'math.exp')
    .replace(/\\left\(/g, '(').replace(/\\right\)/g,')')
    .replace(/\\left\[/g, '[').replace(/\\right\]/g,']')
    .replace(/\\left\|/g, 'abs(').replace(/\\right\|/g,')')
    .replace(/\^\{([^{}]*)\}/g,  '**($1)')
    .replace(/\^(\w)/g,          '**$1')
    .replace(/\\hbar/g, 'hbar')
    .replace(/\\ell/g,  'ell')
    .replace(/\\cdot/g,'*').replace(/\\times/g,'*')
    .replace(/\{/g,'(').replace(/\}/g,')')
    .replace(/\\[a-zA-Z]+/g,'');

  // Simplify **(<digit>) → **<digit>
  expr = expr.replace(/\*\*\((\w+)\)/g, '**$1');

  // Insert explicit * for implicit multiplication
  expr = expr
    .replace(/\)\s*\(/g,          ')*(')
    .replace(/(\d)\s*\(/g,        '$1*(')
    .replace(/\)\s*(\d)/g,        ')*$1')
    .replace(/(\d)\s*([a-zA-Z])/g,'$1*$2');

  return expr.trim();
}

// Generate a one-line Python code snippet for the given variable.
function varToPython(v){
  const name = v.name || '_';
  switch(v.kind){
    case 'equation':{
      const params = (typeof extractEquationParams==='function')
        ? extractEquationParams(v.fullLatex||'') : ['x'];
      return `${name} = lambda ${params.join(', ')}: ${latexToPython(v.exprLatex||'')}`;
    }
    case 'constant':
      if(v._isNumeric) return `${name} = ${v.value}`;
      return `${name} = ${latexToPython(v.exprLatex||'')}`;
    case 'parameter':
      return `${name} = ${v.value}`;
    case 'list':
      return `${name} = [${(v.listItems||[]).join(', ')}]`;
    default:
      return '';
  }
}
