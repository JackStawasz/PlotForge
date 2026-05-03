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
  '\\hbar','\\ell','\\dagger',
  '\\sin','\\cos','\\tan','\\cot','\\sec','\\csc',
  '\\arcsin','\\arccos','\\arctan','\\arctanh',
  '\\sinh','\\cosh','\\tanh',
  '\\log','\\ln','\\exp','\\sqrt','\\frac','\\binom','\\cdot','\\times','\\div','\\otimes','\\oplus',
  '\\pm','\\mp','\\leq','\\geq','\\neq','\\approx','\\equiv','\\sim',
  '\\infty','\\partial','\\nabla','\\sum','\\prod','\\int','\\oint',
  '\\lim','\\max','\\min','\\sup','\\inf',
  '\\rightarrow','\\leftarrow','\\Rightarrow','\\Leftarrow',
  '\\leftrightarrow','\\Leftrightarrow',
  '\\uparrow','\\downarrow','\\updownarrow',
  '\\forall','\\exists','\\in','\\notin','\\subset','\\supset','\\subseteq','\\supseteq',
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
// Delete the '\' and any partial command letters typed so far.
// Works by backspacing within command-entry mode: each backspace removes one
// letter from the command text, and the final backspace removes the '\' itself.
function _cancelCommandEntry(mf, mqEl){
  const cmdText = mqEl && mqEl.querySelector('.mq-command-text');
  if(!cmdText) return;
  const cmdLen = (cmdText.textContent || '').length;
  for(let i = 0; i <= cmdLen; i++) mf.keystroke('Backspace');
}

function applyLatexCompletion(mf, mqEl, fullCmd){
  const inCommandMode = !!(mqEl && mqEl.querySelector('.mq-command-text'));
  if(inCommandMode){
    _cancelCommandEntry(mf, mqEl); // remove '\partial' before applying the command
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
// mqEl: the MathQuill wrapper element (used to detect command-entry mode).
function fixDecoratorCursor(mf, prevLatex, mqEl){
  // Never keystroke while MQ is in command-entry mode — any cursor movement
  // will eject the cursor out of the command box (.mq-command-text).
  if(mqEl && mqEl.querySelector('.mq-command-text')) return;

  const latex = mf.latex();
  // Decorator just created with empty box → move cursor inside
  if(/\\overline\{\}$|\\underline\{\}$|\\hat\{\}$|\\bar\{\}$|\\vec\{\}$|\\tilde\{\}$|\\dot\{\}$|\\ddot\{\}$/.test(latex)){
    mf.keystroke('Left');
    return;
  }
  // MathQuill auto-inserts \left(\right) on '(' — only correct on fresh insertion
  const grew = latex.length > (prevLatex||'').length;
  if(/\\left\(\\right\)$/.test(latex) && grew){
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
// varCtx: optional variable object { scope, folder } — when provided, Enter with
// a closed dropdown creates a new blank constant in the same scope/folder.
function wrapMathFieldWithAC(mqEl, mf, varCtx){
  mqEl.addEventListener('keydown', e=>{
    const dd   = _latexDropdown;
    const open = dd && dd.style.display !== 'none';

    if(open){
      if(e.key === 'ArrowDown'){ e.preventDefault(); navigateLatexDropdown(1);  return; }
      if(e.key === 'ArrowUp')  { e.preventDefault(); navigateLatexDropdown(-1); return; }
      if(e.key === 'Enter' || e.key === 'Tab'){
        const items = dd.querySelectorAll('.latex-ac-item');
        const idx   = _latexDropdownIdx >= 0 ? _latexDropdownIdx : 0;
        if(items[idx]){ e.preventDefault(); e.stopPropagation(); applyLatexCompletion(mf, mqEl, items[idx].textContent); return; }
      }
      if(e.key === 'Escape'){
        e.preventDefault();
        hideLatexDropdown();
        _cancelCommandEntry(mf, mqEl); // delete '\partial' entirely
        return;
      }
    }

    // Escape with dropdown closed: delete the partial command entry if active
    if(e.key === 'Escape' && !open){
      if(mqEl.querySelector('.mq-command-text')){
        e.preventDefault();
        _cancelCommandEntry(mf, mqEl);
      }
    }

    // Enter with dropdown closed: create a new blank constant in same scope/folder
    if(e.key === 'Enter' && !open && varCtx && typeof addVariable === 'function'){
      e.preventDefault();
      addVariable('constant', { scope: varCtx.scope, folder: varCtx.folder });
    }
  }, true);
}
