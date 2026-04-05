// ═══ DATA MASKING ════════════════════════════════════════════════════════
// xMask = (x > xMin) & (x < xMax); yMask = (y > yMin) & (y < yMax)
// Filtered positions become null so Chart.js spanGaps can bridge them.
function applyMask(xArr, yArr, curve){
  const xn=curve.mask_x_min, xx=curve.mask_x_max;
  const yn=curve.mask_y_min, yx=curve.mask_y_max;
  if(xn==null && xx==null && yn==null && yx==null) return {x:xArr, y:yArr};
  const xOut=[], yOut=[];
  for(let i=0;i<xArr.length;i++){
    const xi=xArr[i], yi=yArr[i];
    let keep = true;
    if(xn!=null && xi!=null && xi <= xn) keep=false;
    if(xx!=null && xi!=null && xi >= xx) keep=false;
    if(yn!=null && yi!=null && yi <= yn) keep=false;
    if(yx!=null && yi!=null && yi >= yx) keep=false;
    xOut.push(keep ? xi : null);
    yOut.push(keep ? yi : null);
  }
  return {x:xOut, y:yOut};
}

// ═══ TEMPLATE EVALUATOR ══════════════════════════════════════════════════
function evalTemplate(tkey, params, view){
  const tpl = TEMPLATES[tkey];
  if(!tpl) return null;
  const xd = tpl.x_default;
  const p  = params;
  const N  = 600;
  const xLo = view.x_min != null ? view.x_min : xd[0];
  const xHi = view.x_max != null ? view.x_max : xd[1];

  function linspace(lo,hi,n){ const a=[]; for(let i=0;i<n;i++) a.push(lo+(hi-lo)*i/(n-1)); return a; }

  let x, y, discrete=false;
  switch(tkey){
    case 'sin':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)*Math.sin((p.f||1)*v+(p.phi||0))); break; }
    case 'arcsin':{ const lo2=Math.max(-0.9999,xLo),hi2=Math.min(0.9999,xHi); x=linspace(lo2,hi2,400); y=x.map(v=>(p.A||1)*Math.asin(v)); break; }
    case 'sinh':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)*Math.sinh((p.f||1)*v)); break; }
    case 'arcsinh':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)*Math.asinh((p.f||1)*v)); break; }
    case 'cos':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)*Math.cos((p.f||1)*v+(p.phi||0))); break; }
    case 'arccos':{ const lo2=Math.max(-0.9999,xLo),hi2=Math.min(0.9999,xHi); x=linspace(lo2,hi2,400); y=x.map(v=>(p.A||1)*Math.acos(v)); break; }
    case 'cosh':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)*Math.cosh((p.f||1)*v)); break; }
    case 'arccosh':{ const lo2=Math.max(1.001,xLo); x=linspace(lo2,xHi,400); y=x.map(v=>(p.A||1)*Math.acosh((p.f||1)*v)); break; }
    case 'tan':{ x=linspace(xLo,xHi,800); y=x.map(v=>{const val=(p.A||1)*Math.tan((p.f||1)*v);return Math.abs(val)>50?null:val;}); break; }
    case 'arctan':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)*Math.atan((p.f||1)*v)); break; }
    case 'tanh':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)*Math.tanh((p.f||1)*v)); break; }
    case 'arctanh':{ const f=p.f||1,bound=0.9999/Math.max(0.0001,Math.abs(f)); const lo2=Math.max(-bound,xLo),hi2=Math.min(bound,xHi); x=linspace(lo2,hi2,400); y=x.map(v=>(p.A||1)*Math.atanh(f*v)); break; }
    case 'csc':{ x=linspace(xLo,xHi,800); y=x.map(v=>{const s=Math.sin((p.f||1)*v);if(Math.abs(s)<0.01)return null;const val=(p.A||1)/s;return Math.abs(val)>20?null:val;}); break; }
    case 'arccsc':{ x=linspace(xLo,xHi,N); y=x.map(v=>Math.abs(v)<1?null:(p.A||1)*Math.asin(1/v)); break; }
    case 'csch':{ x=linspace(xLo,xHi,N); y=x.map(v=>{const s=Math.sinh((p.f||1)*v);if(Math.abs(s)<0.001)return null;const val=(p.A||1)/s;return Math.abs(val)>50?null:val;}); break; }
    case 'arccsch':{ x=linspace(xLo,xHi,N); y=x.map(v=>v===0?null:(p.A||1)*Math.asinh(1/v)); break; }
    case 'sec':{ x=linspace(xLo,xHi,800); y=x.map(v=>{const c=Math.cos((p.f||1)*v);if(Math.abs(c)<0.01)return null;const val=(p.A||1)/c;return Math.abs(val)>20?null:val;}); break; }
    case 'arcsec':{ x=linspace(xLo,xHi,N); y=x.map(v=>Math.abs(v)<1?null:(p.A||1)*Math.acos(1/v)); break; }
    case 'sech':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)/Math.cosh((p.f||1)*v)); break; }
    case 'arcsech':{ const lo2=Math.max(0.001,xLo),hi2=Math.min(0.9999,xHi); x=linspace(lo2,hi2,400); y=x.map(v=>(p.A||1)*Math.acosh(1/v)); break; }
    case 'cot':{ x=linspace(xLo,xHi,800); y=x.map(v=>{const s=Math.sin((p.f||1)*v);if(Math.abs(s)<0.01)return null;const val=(p.A||1)*Math.cos((p.f||1)*v)/s;return Math.abs(val)>50?null:val;}); break; }
    case 'arccot':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.A||1)*(Math.PI/2-Math.atan((p.f||1)*v))); break; }
    case 'coth':{ x=linspace(xLo,xHi,N); y=x.map(v=>{const t=Math.tanh((p.f||1)*v);if(Math.abs(t)<0.001)return null;const val=(p.A||1)/t;return Math.abs(val)>50?null:val;}); break; }
    case 'arccoth':{ x=linspace(xLo,xHi,N); y=x.map(v=>Math.abs(v)<=1?null:(p.A||1)*Math.atanh(1/v)); break; }
    case 'gaussian':{ x=linspace(xLo,xHi,N); const mu=p.mu||0,sig=Math.max(0.001,p.sig||1); y=x.map(v=>(p.A||1)*Math.exp(-((v-mu)**2)/(2*sig**2))); break; }
    case 'lorentzian':{ x=linspace(xLo,xHi,N); const g=Math.max(0.001,p.gamma||1),x0=p.x0||0; y=x.map(v=>(p.A||1)*g**2/((v-x0)**2+g**2)); break; }
    case 'binomial':{ discrete=true; const n=Math.round(p.n||20),pk=Math.max(0.001,Math.min(0.999,p.p||0.5)); x=[]; y=[]; for(let k=0;k<=n;k++){x.push(k);y.push(binomPMF(n,k,pk));} break; }
    case 'poisson':{ discrete=true; const lam=Math.max(0.01,p.lam||4),hi2=Math.max(20,Math.ceil(lam*3)); x=[]; y=[]; for(let k=0;k<=hi2;k++){x.push(k);y.push(poissonPMF(lam,k));} break; }
    case 'laplace':{ x=linspace(xLo,xHi,N); const b=Math.max(0.001,p.b||1),mu2=p.mu||0; y=x.map(v=>(p.A||1)/(2*b)*Math.exp(-Math.abs(v-mu2)/b)); break; }
    case 'linear':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.m||1)*v+(p.b||0)); break; }
    case 'vline':{ const c=p.c||0; x=[c,c]; y=[-1e6,1e6]; break; }
    case 'hline':{ x=linspace(xLo,xHi,N); y=x.map(()=>p.c||0); break; }
    case 'poly_custom':{ x=linspace(xLo,xHi,N); const deg=Math.round(p.degree||4); y=x.map(v=>{let sum=0;for(let i=0;i<=deg;i++)sum+=(p[`a${i}`]||0)*v**i;return sum;}); break; }
    case 'logarithmic':{ const lo2=Math.max(0.001,xLo); x=linspace(lo2,xHi,400); const base=Math.max(1.0001,p.b||Math.E); y=x.map(v=>(p.a||1)*(Math.log(v)/Math.log(base))+(p.c||0)); break; }
    case 'exponential':{ x=linspace(xLo,xHi,N); const base=Math.max(1.0001,p.b||Math.E); y=x.map(v=>(p.a||1)*Math.pow(base,(p.s||0.5)*v)); break; }
    case 'nth_root':{ const lo2=Math.max(0,xLo); x=linspace(lo2,xHi,400); const n=Math.max(0.001,p.n||2); y=x.map(v=>(p.a||1)*Math.sign(v)*Math.pow(Math.abs(v),1/n)); break; }
    case 'reciprocal':{ x=linspace(xLo,xHi,800); y=x.map(v=>{const d=v+(p.h||0);if(Math.abs(d)<0.01)return null;const val=(p.a||1)/d;return Math.abs(val)>50?null:val;}); break; }
    case 'factorial':{ x=linspace(xLo,xHi,400); y=x.map(v=>{const xp1=v+1;if(xp1<=0)return null;const g=lanczosGamma(xp1);return(p.a||1)*(Math.abs(g)>1e8?null:g);}); break; }
    case 'ceiling':{ x=linspace(xLo,xHi,800); y=x.map(v=>(p.a||1)*Math.ceil(v)); break; }
    case 'floor':{ x=linspace(xLo,xHi,800); y=x.map(v=>(p.a||1)*Math.floor(v)); break; }
    case 'absolute':{ x=linspace(xLo,xHi,N); y=x.map(v=>(p.a||1)*Math.abs(v+(p.h||0))); break; }
    case 'legendre':{
      const ell = Math.max(0, Math.round(p.ell ?? 3));
      const a   = p.a ?? 1;
      x = linspace(Math.max(-1, xLo), Math.min(1, xHi), 600);
      y = x.map(v => {
        if(ell === 0) return a * 1;
        if(ell === 1) return a * v;
        let pp = 1, pc = v;
        for(let n = 1; n < ell; n++){
          const pn = ((2*n+1)*v*pc - n*pp) / (n+1);
          pp = pc; pc = pn;
        }
        return a * pc;
      });
      break;
    }
    case 'sinc':{
      x = linspace(xLo, xHi, N);
      const A=p.A??1, f=p.f??1;
      y = x.map(v => { const arg = Math.PI*f*v; return A*(Math.abs(arg)<1e-10 ? 1 : Math.sin(arg)/arg); });
      break;
    }
    case 'bessel':{
      // Bessel J_n(x) via downward recurrence (Miller's algorithm)
      x = linspace(xLo, xHi, N);
      const A=p.A??1, n=Math.max(0,Math.round(p.n??0));
      y = x.map(v => A * besselJ(n, v));
      break;
    }
    case 'fresnel_c':{
      x = linspace(xLo, xHi, N);
      const A=p.A??1, f=p.f??1;
      y = x.map(v => A * fresnelC(f*v));
      break;
    }
    case 'fresnel_s':{
      x = linspace(xLo, xHi, N);
      const A=p.A??1, f=p.f??1;
      y = x.map(v => A * fresnelS(f*v));
      break;
    }
    case 'erf':{
      x = linspace(xLo, xHi, N);
      const A=p.A??1, f=p.f??1;
      y = x.map(v => A * erfApprox(f*v));
      break;
    }
    case 'airy':{
      x = linspace(xLo, xHi, N);
      const A=p.A??1, f=p.f??1;
      y = x.map(v => A * airyAi(f*v));
      break;
    }
    default: return null;
  }

  const yVals=y.filter(v=>v!=null&&isFinite(v));
  const autoYMin=yVals.length?Math.min(...yVals):-1;
  const autoYMax=yVals.length?Math.max(...yVals):1;
  return {x,y,discrete,equation:tpl.equation,autoXMin:xLo,autoXMax:xHi,autoYMin,autoYMax};
}

// ═══ STATISTICAL HELPERS ═════════════════════════════════════════════════
function binomPMF(n,k,p){return binomCoeff(n,k)*Math.pow(p,k)*Math.pow(1-p,n-k);}
function binomCoeff(n,k){if(k>n)return 0;let c=1;for(let i=0;i<k;i++)c=c*(n-i)/(i+1);return c;}
function poissonPMF(lam,k){return Math.exp(-lam+k*Math.log(lam)-logFactorial(k));}
function logFactorial(n){let s=0;for(let i=2;i<=n;i++)s+=Math.log(i);return s;}

function lanczosGamma(z){
  if(z<0.5) return Math.PI/(Math.sin(Math.PI*z)*lanczosGamma(1-z));
  z-=1;
  const g=7,c=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,
    -176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  let x=c[0]; for(let i=1;i<g+2;i++)x+=c[i]/(z+i);
  const t=z+g+0.5;
  return Math.sqrt(2*Math.PI)*Math.pow(t,z+0.5)*Math.exp(-t)*x;
}

// ═══ SPECIAL FUNCTION HELPERS ════════════════════════════════════════════

// Bessel J_n(x) — uses series for small |x|, Miller's downward recurrence for large n
function besselJ(n, x){
  if(x === 0) return n === 0 ? 1 : 0;
  const sign = (x < 0 && n % 2 !== 0) ? -1 : 1;
  const ax = Math.abs(x);
  // Series expansion: J_n(x) = sum_{k=0}^inf (-1)^k (x/2)^{2k+n} / (k! (k+n)!)
  // Converges well for small |x|; use enough terms
  const half = ax / 2;
  let term = Math.pow(half, n);
  for(let i = 1; i <= n; i++) term /= i; // (x/2)^n / n!
  let sum = term;
  for(let k = 1; k <= 60; k++){
    term *= -(half * half) / (k * (k + n));
    sum += term;
    if(Math.abs(term) < 1e-14 * Math.abs(sum)) break;
  }
  return sign * sum;
}

// Fresnel C(x) = integral_0^x cos(pi/2 * t^2) dt — power series
function fresnelC(x){
  if(x === 0) return 0;
  const sign = x < 0 ? -1 : 1;
  const t = x * x;  // t = x^2
  const pt2 = Math.PI / 2;
  let sum = x, term = x, xsq = -t * t * pt2 * pt2;
  for(let k = 1; k <= 80; k++){
    term *= xsq / ((2*k) * (2*k - 1));
    const next = term / (4*k + 1);
    sum += next;
    if(Math.abs(next) < 1e-14 * Math.abs(sum)) break;
  }
  return sign * Math.abs(sum) * sign < 0 ? -Math.abs(sum) : Math.abs(sum);
}

// Fresnel S(x) = integral_0^x sin(pi/2 * t^2) dt — power series
function fresnelS(x){
  if(x === 0) return 0;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const pt2 = Math.PI / 2;
  const xsq = ax * ax;
  let term = pt2 * xsq * xsq * ax / 3;  // first term: (pi/2)x^3/3
  let sum = term;
  const c = -(pt2 * pt2) * xsq * xsq;
  for(let k = 1; k <= 80; k++){
    term *= c / ((2*k) * (2*k + 1));
    const next = term / (4*k + 3);
    sum += next;
    if(Math.abs(next) < 1e-14 * Math.abs(sum)) break;
  }
  return sign * sum;
}

// erf(x) — Abramowitz & Stegun rational approximation (max error 1.5e-7)
function erfApprox(x){
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly = t*(0.254829592 + t*(-0.284496736 + t*(1.421413741 + t*(-1.453152027 + t*1.061405429))));
  const val = 1 - poly * Math.exp(-x*x);
  return x < 0 ? -val : val;
}

// Airy Ai(x) — series expansion valid for moderate |x|
// Ai(x) = c1*f(x) - c2*g(x)  where
//   c1 = Ai(0) = 1/(3^{2/3} Gamma(2/3)), c2 = -Ai'(0) = 1/(3^{1/3} Gamma(1/3))
//   f(x) = sum x^{3k}/(3k)! * prod factors,  g(x) = sum x^{3k+1}/(3k+1)! * prod factors
function airyAi(x){
  // For large positive x use asymptotic; series handles the rest
  if(x > 8){
    const xi = (2/3)*Math.pow(x,1.5);
    return Math.exp(-xi)/(2*Math.sqrt(Math.PI)*Math.pow(x,0.25));
  }
  if(x < -8){
    const xi = (2/3)*Math.pow(-x,1.5);
    return Math.sin(xi + Math.PI/4)/(Math.sqrt(Math.PI)*Math.pow(-x,0.25));
  }
  const c1 = 0.3550280538878172;  // Ai(0)
  const c2 = 0.2588194037928068;  // -Ai'(0)
  // f series: 1 + x^3/3! + x^6*2/(6!) + ...
  let f=1, g=x, tf=1, tg=x;
  for(let k=1; k<=30; k++){
    tf *= x*x*x / ((3*k-1)*(3*k));
    tg *= x*x*x / ((3*k)*(3*k+1));
    f += tf; g += tg;
    if(Math.abs(tf)<1e-14*Math.abs(f) && Math.abs(tg)<1e-14*Math.abs(g)) break;
  }
  return c1*f - c2*g;
}


// Inserts null sentinels only at true asymptote discontinuities (sign-flip
// jumps). Does NOT clip finite peaks — even narrow ones.
function clipForDisplay(xArr, yArr){
  const n = xArr.length;
  if(n < 4) return {x:xArr, y:yArr};

  // Collect all finite values to estimate the data range
  const finite = yArr.filter(v => v != null && isFinite(v));
  if(finite.length < 4) return {x:xArr, y:yArr};

  const yMin = Math.min(...finite);
  const yMax = Math.max(...finite);
  const yRange = yMax - yMin;

  // If the entire range is well-behaved, no clipping needed
  if(yRange <= 0 || !isFinite(yRange)) return {x:xArr, y:yArr};

  // Detect only true discontinuities: jumps that are very large relative to
  // the full data range AND cross zero (sign-flip = asymptote crossing).
  // This avoids clipping smooth peaks like Lorentzians.
  const DISC_THRESH = 5.0;   // jump > 5× total range = likely asymptote

  const xOut = [], yOut = [];
  let prevKeptY = null;

  for(let i = 0; i < n; i++){
    const yi = yArr[i];

    if(yi == null || !isFinite(yi)){
      xOut.push(xArr[i]); yOut.push(null);
      prevKeptY = null;
      continue;
    }

    if(prevKeptY !== null){
      const dy = Math.abs(yi - prevKeptY);
      // Only break if: large jump AND values cross zero (true asymptote)
      const crossesZero = (yi * prevKeptY < 0);
      if(dy > DISC_THRESH * yRange && crossesZero){
        xOut.push(xArr[i]); yOut.push(null);
        // Don't update prevKeptY — next point compares against the pre-jump value
      }
    }

    xOut.push(xArr[i]); yOut.push(yi);
    prevKeptY = yi;
  }
  return {x:xOut, y:yOut};
}

// Round a value to N significant figures, stripping trailing zeros.
function sigFig(v,n){
  if(!isFinite(v)) return '—';
  if(v===0) return '0';
  return parseFloat(v.toPrecision(n)).toString();
}

// Nice step for chart axis ticks: ~1/targetTicks of span, snapped to 1-2-5 series.
function niceStep(span,targetTicks){
  if(!span||span<=0||!isFinite(span)) return 1;
  const rough=span/targetTicks, mag=Math.pow(10,Math.floor(Math.log10(rough))), norm=rough/mag;
  let nice; if(norm<1.5)nice=1; else if(norm<3.5)nice=2; else if(norm<7.5)nice=5; else nice=10;
  return nice*mag;
}

// Nice step for parameter sliders: ~1/200 of range, snapped to 1-2-5 series.
function niceSliderStep(min,max){
  const span=Math.abs(max-min);
  if(span===0) return 0.01;
  const rough=span/200, mag=Math.pow(10,Math.floor(Math.log10(rough))), norm=rough/mag;
  let nice; if(norm<1.5)nice=1; else if(norm<3.5)nice=2; else if(norm<7.5)nice=5; else nice=10;
  return nice*mag;
}

// ═══ ADAPTIVE SAMPLING ═══════════════════════════════════════════════════
// Detects intervals with large |Δy| and inserts extra evaluated points so
// narrow peaks (e.g. thin Lorentzians) are never dropped on zoom-out.
function adaptiveSample(xArr, yArr, evalFn, maxExtra=600){
  const n = xArr.length;
  if(n < 2 || !evalFn) return {x:xArr, y:yArr};

  // Median |Δy| as a robust scale estimate
  const diffs = [];
  for(let i=1;i<n;i++){
    const yi=yArr[i], yp=yArr[i-1];
    if(yi!=null&&yp!=null&&isFinite(yi)&&isFinite(yp)) diffs.push(Math.abs(yi-yp));
  }
  if(!diffs.length) return {x:xArr, y:yArr};
  diffs.sort((a,b)=>a-b);
  const medDiff = diffs[Math.floor(diffs.length/2)] || 1e-10;

  // Collect segments that need more points
  const THRESH = 6;
  const hot = [];
  for(let i=1;i<n;i++){
    const yi=yArr[i], yp=yArr[i-1];
    if(yi==null||yp==null||!isFinite(yi)||!isFinite(yp)) continue;
    const dy = Math.abs(yi-yp);
    if(dy > THRESH * medDiff) hot.push({i, dy});
  }
  if(!hot.length) return {x:xArr, y:yArr};

  const totalDy = hot.reduce((s,h)=>s+h.dy, 0);
  const extras = [];
  let used = 0;

  for(const {i, dy} of hot){
    if(used >= maxExtra) break;
    const k = Math.min(Math.ceil((dy/totalDy)*maxExtra), maxExtra-used, 80);
    if(k < 1) continue;
    const x0=xArr[i-1], x1=xArr[i];
    for(let j=1;j<=k;j++){
      const xr = x0 + (x1-x0)*j/(k+1);
      try{ const yr=evalFn(xr); if(yr!=null&&isFinite(yr)) extras.push({x:xr,y:yr}); }catch(e){}
    }
    used += k;
  }
  if(!extras.length) return {x:xArr, y:yArr};

  const merged = xArr.map((x,i)=>({x, y:yArr[i]})).concat(extras);
  merged.sort((a,b)=>a.x-b.x);
  return {x:merged.map(p=>p.x), y:merged.map(p=>p.y)};
}