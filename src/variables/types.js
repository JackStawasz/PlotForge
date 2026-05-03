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
          fixDecoratorCursor(_mf, prev, mqWrap);
          checkAllWarnings();
          _scheduleRerenderVarCurves();
          updateLatexDropdown(_mf, mqWrap, mqWrap);
          // Defer updateMode so MQ.StaticMath calls inside evaluateConstant
          // don't steal focus mid-edit and corrupt cursor/command-mode state.
          requestAnimationFrame(()=> updateMode(_mf));
        }
      }
    });
    if(_mf){
      if(v.fullLatex) _mf.latex(v.fullLatex);
      updateMode(_mf);
      wrapMathFieldWithAC(mqWrap, _mf, v);
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
      _rerenderVarCurves();
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
          _scheduleRerenderVarCurves();
          updateLatexDropdown(_mf, mqWrap, mqWrap);
        }
      }
    });
    if(_mf){
      _mf.latex(`${v.name || 'p'}=${formatParamVal(v.value)}`);
      wrapMathFieldWithAC(mqWrap, _mf, v);
    }

    slider.addEventListener('input', ()=>{
      v.value = parseFloat(slider.value);
      if(_mf) _mf.latex(`${v.name || 'p'}=${formatParamVal(v.value)}`);
      reEvalAllConstants();
      _rerenderVarCurves();
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
          checkAllWarnings();
          _scheduleRerenderVarCurves();
          // Incomplete-expression check: fires 1 s after typing stops.
          // Only activates when no structural error is already shown.
          clearTimeout(v._incompleteTimer);
          v._incompleteTimer = setTimeout(()=>{
            if(!v._warning || v._warning._invalidMsg !== null) return;
            if(isIncompleteExpr((v.exprLatex || '').trim()))
              v._warning.setInvalid('incomplete expression');
          }, 1000);
          updateLatexDropdown(mf, mqWrap, mqWrap);
        }
      }
    });
    if(mf){
      const fname    = v.name || 'f';
      const initLatex = v.fullLatex || `${fname}\\left(x\\right)=${v.exprLatex || ''}`;
      mf.latex(initLatex);
      validateEquationLatex(mf.latex(), v);
      wrapMathFieldWithAC(mqWrap, mf, v);
    }
  });
}

// ═══ LIST BODY ═══════════════════════════════════════════════════════════
function buildListBody(item, v, lenInp){
  // Inline grid + edit-by-index row (only for numeric lists, not categorical)
  const cellsWrap = v._categorical ? null : document.createElement('div');
  if(cellsWrap) cellsWrap.className = 'var-list-cells';

  const editRow = v._categorical ? null : document.createElement('div');

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
    // Update summary count
    const sumEl = document.getElementById(`vlistsummary_${v.id}`);
    if(sumEl) sumEl.textContent = `${v.listItems.length} values`;
    // Rebuild inline grid
    if(cellsWrap) rebuildListCells(v, cellsWrap);
    if(editRow)   rebuildEditIndex(v, editRow);
  });
  lenInp.addEventListener('click', e=>e.stopPropagation());

  // Summary row: count label + "View / Edit →" popup button
  const summaryRow = document.createElement('div');
  summaryRow.className = 'var-list-summary';

  const summaryText = document.createElement('span');
  summaryText.className = 'var-list-summary-text';
  summaryText.id = `vlistsummary_${v.id}`;
  if(v._categorical){
    summaryText.textContent = `${v._labels.length} levels`;
  } else {
    summaryText.textContent = `${v.listItems.length} values`;
    if(v.listItems.length > 0){
      const preview = v.listItems.slice(0, 3).map(x => {
        if(x === null || !isFinite(x)) return '—';
        return parseFloat(x.toPrecision(4)).toString();
      }).join(', ');
      summaryText.title = `[${preview}${v.listItems.length > 3 ? ', …' : ''}]`;
    }
  }

  const viewBtn = document.createElement('button');
  viewBtn.className = 'var-list-view-btn';
  viewBtn.textContent = 'View / Edit →';
  viewBtn.addEventListener('click', e=>{ e.stopPropagation(); _openListPopup(v); });

  summaryRow.appendChild(summaryText);
  summaryRow.appendChild(viewBtn);
  item.appendChild(summaryRow);

  // Inline cell grid (numeric lists only)
  if(cellsWrap){
    item.appendChild(cellsWrap);
    rebuildListCells(v, cellsWrap);
  }

  // "Edit index" row — shown only for long lists (> 8 items)
  if(editRow){
    editRow.className = 'var-list-editrow';
    editRow.id = `veditrow_${v.id}`;
    item.appendChild(editRow);
    rebuildEditIndex(v, editRow);
  }
}

// ═══ LIST POPUP MODAL ═════════════════════════════════════════════════════
let _listPopupVar  = null;
let _listPopupPage = 0;
const _LIST_POP_PG = 50;

function _openListPopup(v){
  _listPopupVar  = v;
  _listPopupPage = 0;

  let overlay = document.getElementById('listPopupOverlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id        = 'listPopupOverlay';
    overlay.className = 'list-popup-overlay';
    overlay.addEventListener('mousedown', e=>{ if(e.target === overlay) _closeListPopup(); });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="list-popup" id="listPopupMain">
      <div class="list-popup-header">
        <div class="list-popup-title">
          <span class="list-popup-varname">${v.name || `v${v.id}`}</span>
          <span class="list-popup-meta" id="listPopupMeta"></span>
        </div>
        <button class="list-popup-close" id="listPopupClose">&#10005;</button>
      </div>
      <div class="list-popup-body" id="listPopupBody"></div>
      <div class="list-popup-footer" id="listPopupFooter"></div>
    </div>`;

  overlay.style.display = 'flex';
  document.getElementById('listPopupClose')?.addEventListener('click', _closeListPopup);
  _renderListPopupPage();
}

function _closeListPopup(){
  const overlay = document.getElementById('listPopupOverlay');
  if(overlay) overlay.style.display = 'none';
  // Sync sidebar summary text, length inputs, and inline grid after any edits
  if(typeof variables !== 'undefined'){
    variables.forEach(v=>{
      if(v.kind !== 'list') return;
      const lenInp = document.getElementById(`vlen_${v.id}`);
      if(lenInp) lenInp.value = v.listLength;
      const sumEl = document.getElementById(`vlistsummary_${v.id}`);
      if(sumEl) sumEl.textContent = v._categorical
        ? `${v._labels.length} levels`
        : `${v.listItems.length} values`;
      // Rebuild inline cell grid so it reflects any popup edits
      if(!v._categorical){
        const cellsWrap = document.querySelector(`.var-item[data-vid="${v.id}"] .var-list-cells`);
        if(cellsWrap) rebuildListCells(v, cellsWrap);
        const editRow = document.getElementById(`veditrow_${v.id}`);
        if(editRow) rebuildEditIndex(v, editRow);
      }
    });
  }
  if(typeof refreshStatsVarSelectors === 'function') refreshStatsVarSelectors();
  _listPopupVar = null;
}

function _renderListPopupPage(){
  const v      = _listPopupVar;
  const body   = document.getElementById('listPopupBody');
  const footer = document.getElementById('listPopupFooter');
  const meta   = document.getElementById('listPopupMeta');
  if(!v || !body || !footer) return;

  const n = v._categorical ? v._labels.length : v.listItems.length;
  if(meta) meta.textContent = v._categorical ? `${n} levels` : `${n} values`;

  if(v._categorical && v._labels.length){
    const rows = v._labels.slice(0, 500).map((lbl, i) =>
      `<tr><td class="lp-td lp-idx">${i}</td>
            <td class="lp-td" style="text-align:left;color:var(--text)">${lbl}</td>
            <td class="lp-td">${v.listItems[i] ?? '—'}</td></tr>`
    ).join('');
    body.innerHTML = `
      <table class="lp-table">
        <thead><tr>
          <th class="lp-th lp-th-idx">#</th>
          <th class="lp-th" style="text-align:left">Label</th>
          <th class="lp-th">Count</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    footer.innerHTML = `
      <span class="lp-info">${n} categories · read-only</span>
      <button class="lp-btn lp-done-btn" id="lp_done">Close</button>`;
    document.getElementById('lp_done')?.addEventListener('click', _closeListPopup);
    return;
  }

  const totalPages = Math.ceil(v.listItems.length / _LIST_POP_PG) || 1;
  _listPopupPage   = Math.max(0, Math.min(_listPopupPage, totalPages - 1));
  const start = _listPopupPage * _LIST_POP_PG;
  const end   = Math.min(start + _LIST_POP_PG, v.listItems.length);

  const rows = [];
  for(let i = start; i < end; i++){
    rows.push(`<tr>
      <td class="lp-td lp-idx">${i}</td>
      <td class="lp-td"><input type="number" class="lp-inp" data-idx="${i}" value="${v.listItems[i]}" step="any"/></td>
    </tr>`);
  }

  body.innerHTML = `
    <table class="lp-table">
      <thead><tr>
        <th class="lp-th lp-th-idx">#</th>
        <th class="lp-th">Value</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;

  body.querySelectorAll('.lp-inp').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const idx = parseInt(inp.dataset.idx);
      const num = parseFloat(inp.value);
      if(!isNaN(num) && idx >= 0 && idx < v.listItems.length) v.listItems[idx] = num;
    });
  });

  footer.innerHTML = `
    <div class="lp-pagination">
      ${totalPages > 1 ? `
        <button class="lp-btn" id="lp_prev" ${_listPopupPage === 0 ? 'disabled' : ''}>&#8592; Prev</button>
        <span class="lp-info">Rows ${start}–${end - 1} of ${v.listItems.length - 1}</span>
        <button class="lp-btn" id="lp_next" ${_listPopupPage >= totalPages - 1 ? 'disabled' : ''}>Next &#8594;</button>
      ` : `<span class="lp-info">${v.listItems.length} values</span>`}
    </div>
    <div class="lp-actions">
      <button class="lp-btn lp-add-btn" id="lp_addRow">+ Add row</button>
      <button class="lp-btn lp-del-btn" id="lp_delRow" ${v.listItems.length <= 1 ? 'disabled' : ''}>&#8722; Last row</button>
      <button class="lp-btn lp-done-btn" id="lp_done">Done</button>
    </div>`;

  document.getElementById('lp_prev')?.addEventListener('click', ()=>{ _listPopupPage--; _renderListPopupPage(); });
  document.getElementById('lp_next')?.addEventListener('click', ()=>{ _listPopupPage++; _renderListPopupPage(); });
  document.getElementById('lp_addRow')?.addEventListener('click', ()=>{
    v.listItems.push(0);
    v.listLength = v.listItems.length;
    _listPopupPage = Math.floor((v.listItems.length - 1) / _LIST_POP_PG);
    _renderListPopupPage();
  });
  document.getElementById('lp_delRow')?.addEventListener('click', ()=>{
    if(v.listItems.length > 1){
      v.listItems.pop();
      v.listLength = v.listItems.length;
      _listPopupPage = Math.min(_listPopupPage, Math.ceil(v.listItems.length / _LIST_POP_PG) - 1);
      _renderListPopupPage();
    }
  });
  document.getElementById('lp_done')?.addEventListener('click', _closeListPopup);
}

// ═══ DATASET BODY ════════════════════════════════════════════════════════
function _dsEsc(str){ return String(str ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function _syncDatasetSummary(v){
  const el = document.getElementById(`vdssummary_${v.id}`);
  if(!el) return;
  const maxRows = v.datasetCols.length > 0 ? Math.max(0, ...v.datasetCols.map(c => c.values.length)) : 0;
  el.textContent = `${maxRows} rows × ${v.datasetCols.length} cols`;
}

function buildDatasetBody(inner, v){
  const summaryRow = document.createElement('div');
  summaryRow.className = 'var-list-summary';

  const summaryText = document.createElement('span');
  summaryText.className = 'var-list-summary-text';
  summaryText.id = `vdssummary_${v.id}`;
  const maxRows = v.datasetCols.length > 0 ? Math.max(0, ...v.datasetCols.map(c => c.values.length)) : 0;
  summaryText.textContent = `${maxRows} rows × ${v.datasetCols.length} cols`;

  const viewBtn = document.createElement('button');
  viewBtn.className = 'var-list-view-btn';
  viewBtn.textContent = 'View / Edit →';
  viewBtn.addEventListener('click', e=>{ e.stopPropagation(); _openDatasetPopup(v); });

  summaryRow.appendChild(summaryText);
  summaryRow.appendChild(viewBtn);
  inner.appendChild(summaryRow);
}

// ═══ DATASET POPUP MODAL ═════════════════════════════════════════════════
let _datasetPopupVar  = null;
let _datasetPopupPage = 0;
const _DS_POP_PG      = 50;

function _openDatasetPopup(v){
  _datasetPopupVar  = v;
  _datasetPopupPage = 0;

  let overlay = document.getElementById('datasetPopupOverlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id        = 'datasetPopupOverlay';
    overlay.className = 'list-popup-overlay';
    overlay.addEventListener('mousedown', e=>{ if(e.target === overlay) _closeDatasetPopup(); });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="list-popup ds-popup" id="datasetPopupMain">
      <div class="list-popup-header">
        <div class="list-popup-title">
          <span class="list-popup-varname">${_dsEsc(v.name) || `dataset ${v.id}`}</span>
          <span class="list-popup-meta" id="dspopMeta"></span>
        </div>
        <button class="list-popup-close" id="dspopClose">&#10005;</button>
      </div>
      <div class="ds-popup-body" id="dspopBody"></div>
      <div class="list-popup-footer" id="dspopFooter"></div>
    </div>`;

  overlay.style.display = 'flex';
  document.getElementById('dspopClose')?.addEventListener('click', _closeDatasetPopup);
  _renderDatasetPopupPage();
}

function _closeDatasetPopup(){
  const overlay = document.getElementById('datasetPopupOverlay');
  if(overlay) overlay.style.display = 'none';
  if(_datasetPopupVar) _syncDatasetSummary(_datasetPopupVar);
  if(typeof snapshotForUndo === 'function') snapshotForUndo();
  if(typeof checkAllWarnings === 'function') checkAllWarnings();
  _datasetPopupVar = null;
}

function _renderDatasetPopupPage(){
  const v      = _datasetPopupVar;
  const body   = document.getElementById('dspopBody');
  const footer = document.getElementById('dspopFooter');
  const meta   = document.getElementById('dspopMeta');
  if(!v || !body || !footer) return;

  const cols    = v.datasetCols;
  const maxRows = cols.length > 0 ? Math.max(0, ...cols.map(c => c.values.length)) : 0;
  if(meta) meta.textContent = `${maxRows} rows × ${cols.length} cols`;

  const totalPages = Math.ceil(maxRows / _DS_POP_PG) || 1;
  _datasetPopupPage = Math.max(0, Math.min(_datasetPopupPage, totalPages - 1));
  const start = _datasetPopupPage * _DS_POP_PG;
  const end   = Math.min(start + _DS_POP_PG, maxRows);

  const headerCells = cols.map((col, ci) =>
    `<th class="data-th ds-th-edit">
       <input class="ds-col-inp" data-ci="${ci}" value="${_dsEsc(col.name)}" placeholder="col ${ci+1}">
     </th>`
  ).join('');

  const bodyRows = [];
  for(let r = start; r < end; r++){
    const cells = cols.map((col, ci) => {
      const val    = r < col.values.length ? col.values[r] : null;
      const strVal = (val === null || val === undefined) ? '' : String(val);
      return `<td class="data-td"><input class="ds-cell-inp${strVal===''?' ds-cell-empty':''}" data-row="${r}" data-ci="${ci}" value="${_dsEsc(strVal)}" placeholder="—"></td>`;
    }).join('');
    bodyRows.push(`<tr><td class="data-td data-row-num">${r + 1}</td>${cells}</tr>`);
  }

  body.innerHTML = `
    <div class="data-table-wrap ds-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th class="data-th data-th-idx">#</th>
          ${headerCells}
          <th class="data-th ds-th-add"><button class="ds-add-col-btn" id="dspopAddCol">+ col</button></th>
        </tr></thead>
        <tbody>${bodyRows.join('')}</tbody>
      </table>
    </div>`;

  body.querySelectorAll('.ds-col-inp').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const ci = parseInt(inp.dataset.ci);
      if(ci >= 0 && ci < cols.length) cols[ci].name = inp.value;
    });
    inp.addEventListener('click', e=>e.stopPropagation());
  });

  body.querySelectorAll('.ds-cell-inp').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const r  = parseInt(inp.dataset.row);
      const ci = parseInt(inp.dataset.ci);
      if(ci >= 0 && ci < cols.length){
        while(cols[ci].values.length <= r) cols[ci].values.push(null);
        const raw = inp.value.trim();
        const num = Number(raw);
        cols[ci].values[r] = raw === '' ? null : (!isNaN(num) ? num : raw);
        inp.classList.toggle('ds-cell-empty', raw === '');
      }
      _syncDatasetSummary(v);
      if(typeof checkAllWarnings === 'function') checkAllWarnings();
    });
    inp.addEventListener('click', e=>e.stopPropagation());
  });

  document.getElementById('dspopAddCol')?.addEventListener('click', ()=>{
    cols.push({ name: `col${cols.length + 1}`, values: Array(maxRows).fill(null) });
    _renderDatasetPopupPage();
  });

  const paginationHtml = totalPages > 1
    ? `<button class="lp-btn" id="dspop_prev" ${_datasetPopupPage === 0 ? 'disabled' : ''}>&#8592; Prev</button>
       <span class="lp-info">Rows ${start + 1}–${end} of ${maxRows}</span>
       <button class="lp-btn" id="dspop_next" ${_datasetPopupPage >= totalPages - 1 ? 'disabled' : ''}>Next &#8594;</button>`
    : `<span class="lp-info">${maxRows} rows · ${cols.length} col${cols.length !== 1 ? 's' : ''}</span>`;

  const delColBtn = cols.length > 1
    ? `<button class="lp-btn lp-del-btn" id="dspop_delCol">&#8722; Last col</button>` : '';

  footer.innerHTML = `
    <div class="lp-pagination">${paginationHtml}</div>
    <div class="lp-actions">
      <button class="lp-btn lp-add-btn"  id="dspop_addRow">+ Add row</button>
      <button class="lp-btn lp-del-btn"  id="dspop_delRow" ${maxRows <= 0 ? 'disabled' : ''}>&#8722; Last row</button>
      ${delColBtn}
      <button class="lp-btn lp-done-btn" id="dspop_done">Done</button>
    </div>`;

  document.getElementById('dspop_prev')?.addEventListener('click', ()=>{ _datasetPopupPage--; _renderDatasetPopupPage(); });
  document.getElementById('dspop_next')?.addEventListener('click', ()=>{ _datasetPopupPage++; _renderDatasetPopupPage(); });

  document.getElementById('dspop_addRow')?.addEventListener('click', ()=>{
    cols.forEach(col => col.values.push(null));
    const newMax = Math.max(0, ...cols.map(c => c.values.length));
    _datasetPopupPage = Math.floor(Math.max(0, newMax - 1) / _DS_POP_PG);
    _renderDatasetPopupPage();
    _syncDatasetSummary(v);
    if(typeof checkAllWarnings === 'function') checkAllWarnings();
  });

  document.getElementById('dspop_delRow')?.addEventListener('click', ()=>{
    const curMax = cols.length > 0 ? Math.max(0, ...cols.map(c => c.values.length)) : 0;
    if(curMax > 0){
      cols.forEach(col => { if(col.values.length >= curMax) col.values.pop(); });
      const newMax = cols.length > 0 ? Math.max(0, ...cols.map(c => c.values.length)) : 0;
      _datasetPopupPage = Math.min(_datasetPopupPage, Math.max(0, Math.ceil(newMax / _DS_POP_PG) - 1));
      _renderDatasetPopupPage();
      _syncDatasetSummary(v);
      if(typeof checkAllWarnings === 'function') checkAllWarnings();
    }
  });

  document.getElementById('dspop_delCol')?.addEventListener('click', ()=>{
    if(cols.length > 1){
      cols.pop();
      _renderDatasetPopupPage();
      _syncDatasetSummary(v);
      if(typeof checkAllWarnings === 'function') checkAllWarnings();
    }
  });

  document.getElementById('dspop_done')?.addEventListener('click', _closeDatasetPopup);
}

// ═══ LIST CELL GRID ═══════════════════════════════════════════════════════
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
