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
    const tip = btn._tipEl || btn.querySelector('.var-warn-tip');
    const msg = this._dupMsg || this._invalidMsg; // duplicate takes priority
    if(msg){
      btn.classList.add('var-warn-active');
      btn.innerHTML = '&#9888;'; // ⚠ warning triangle
      btn.setAttribute('aria-label', msg);
      if(tip) tip.textContent = msg;
    } else {
      btn.classList.remove('var-warn-active');
      btn.innerHTML = '&#9881;'; // ⚙ gear
      btn.setAttribute('aria-label', 'Variable settings');
      if(tip) tip.textContent = 'No errors';
    }
  }
}

// Check all variables for duplicate names within the same scope context.
// Local vars may intentionally shadow globals, so duplicates are only flagged
// within the same scope bucket (global vs. a specific tabId).
function checkAllWarnings(){
  // Build first-owner maps per scope bucket
  const scopeOwners = new Map(); // scope → Map(name → first v.id)
  for(const v of variables){
    if(!v.name) continue;
    const sc = v.scope ?? 'global';
    if(!scopeOwners.has(sc)) scopeOwners.set(sc, new Map());
    const m = scopeOwners.get(sc);
    if(!m.has(v.name)) m.set(v.name, v.id);
  }
  for(const v of variables){
    if(!v._warning) v._warning = new VarWarning(v.id);
    const sc = v.scope ?? 'global';
    const firstId = scopeOwners.get(sc)?.get(v.name);
    if(v.name && firstId !== undefined && firstId !== v.id){
      v._warning.set(`"${v.name}" is already defined in this scope`);
    } else {
      v._warning.clear();
    }
    // Dataset-specific: warn about incomplete rows
    if(v.kind === 'dataset' && v.datasetCols && v.datasetCols.length > 0){
      const maxRows = Math.max(0, ...v.datasetCols.map(c => c.values.length));
      const hasEmpty = maxRows > 0 && v.datasetCols.some(col =>
        col.values.length < maxRows ||
        col.values.some(val => val === null || val === undefined || val === '')
      );
      if(hasEmpty) v._warning.setInvalid('Dataset has rows with missing or empty values');
      else v._warning.clearInvalid();
    }
  }
}

// Re-evaluate all constant variables (call after any context-affecting change).
function reEvalAllConstants(){
  for(const v of variables){
    if(v.kind === 'constant') evaluateConstant(v);
  }
}

// ── Reactive curve re-render ──────────────────────────────────────────────
// Re-renders every plot that has at least one equation-variable curve.
// Immediate: used for slider/live-value updates.
// Debounced: used for keyboard edits to avoid redrawing on every keystroke.
function _rerenderVarCurves(){
  if(typeof plots === 'undefined' || typeof renderJS !== 'function') return;
  for(const p of plots){
    if(p.curves.some(c => c.varName)) renderJS(p.id);
  }
}
let _rerenderVarTimer = null;
function _scheduleRerenderVarCurves(){
  clearTimeout(_rerenderVarTimer);
  _rerenderVarTimer = setTimeout(_rerenderVarCurves, 150);
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
