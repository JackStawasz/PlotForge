// stats.js — Statistical Analysis Module

'use strict';

// ═══ STATE ═══════════════════════════════════════════════════════════════════

let _statsTab = 'describe';
const _statsCharts = {};
let _currentView = 'plots';

// Preprocess last-result cache (for save/update/download actions)
let _lastPrepResult = null;
let _lastPrepVar    = null;
let _lastPrepOp     = null;
let _lastSplitData  = null;

// Per-tab chip selection state
let _describeSelected   = null;
let _histSingleSelected = null;
let _histBoxSelected    = new Set();
let _fitXSelected       = null;
let _fitYSelected       = null;
let _corrSelected       = new Set();
let _hypo1Selected      = null;
let _hypo2Selected      = null;
let _hypoAnovaSelected  = new Set();
let _prepSelected       = null;

// Regression chip selection state
let _regrXSelected = new Set(); // Set of variable id strings
let _regrYSelected = null;      // single variable id string or null

// ML chip selection state
let _mlXSelected = new Set();
let _mlYSelected = null;

// ═══ VIEW SWITCHING ══════════════════════════════════════════════════════════

function switchToView(view) {
  _currentView = view;
  document.querySelector('.shell')?.setAttribute('data-view', view);
  document.getElementById('hdrViewPlots')?.classList.toggle('hdr-view-active', view === 'plots');
  document.getElementById('hdrViewStats')?.classList.toggle('hdr-view-active', view === 'stats');
  if (view === 'stats') { refreshStatsVarSelectors(); if (_statsTab === 'data') renderDataTable(); }
}

// ═══ INIT ════════════════════════════════════════════════════════════════════

const _TABS = ['describe', 'histogram', 'fit', 'corr', 'hypo', 'preprocess', 'regression', 'ml', 'data'];

function initStats() {
  document.getElementById('hdrViewPlots')?.addEventListener('click', () => switchToView('plots'));
  document.getElementById('hdrViewStats')?.addEventListener('click', () => switchToView('stats'));

  _TABS.forEach(tab => {
    document.getElementById(`statsTab_${tab}`)?.addEventListener('click', () => setStatsTab(tab));
  });

  document.getElementById('statsRunDescribe')?.addEventListener('click', runDescribe);
  document.getElementById('statsRunHist')?.addEventListener('click', runHistogram);
  document.getElementById('statsRunFit')?.addEventListener('click', runCurveFit);
  document.getElementById('statsRunCorr')?.addEventListener('click', runCorrelation);
  document.getElementById('statsRunHypo')?.addEventListener('click', runHypothesis);
  document.getElementById('statsRunPreprocess')?.addEventListener('click', runPreprocess);
  document.getElementById('statsRunRegr')?.addEventListener('click', runRegression);

  // Regression type → show/hide threshold row
  document.getElementById('statsRegrType')?.addEventListener('change', _updateRegrControls);

  // Fit type → show/hide degree / formula rows
  document.getElementById('statsFitType')?.addEventListener('change', () => {
    const val = document.getElementById('statsFitType').value;
    const degRow = document.getElementById('statsFitDegreeRow');
    const fmlRow = document.getElementById('statsFitFormulaRow');
    if (degRow) degRow.style.display = val === 'polynomial' ? '' : 'none';
    if (fmlRow) fmlRow.style.display = val === 'custom'     ? '' : 'none';
  });

  // Histogram chart type → show/hide relevant controls
  document.getElementById('statsHistType')?.addEventListener('change', _updateHistControls);

  // Hypothesis test type → show/hide controls
  document.getElementById('statsHypoType')?.addEventListener('change', _updateHypoControls);

  // Preprocess op → show/hide sub-controls
  document.getElementById('statsPrepOp')?.addEventListener('change', _updatePrepControls);

  // Init regression chip state
  _regrXSelected = new Set();
  _regrYSelected = null;

  // ML tab
  document.getElementById('statsRunML')?.addEventListener('click', runML);
  document.getElementById('statsMLModel')?.addEventListener('change', _updateMLControls);
  _mlXSelected = new Set();
  _mlYSelected = null;
}

function setStatsTab(tab) {
  _statsTab = tab;
  _TABS.forEach(t => {
    document.getElementById(`statsTab_${t}`)?.classList.toggle('stats-tab-active', t === tab);
    document.getElementById(`statsPane_${t}`)?.classList.toggle('stats-pane-active', t === tab);
  });
  if (tab === 'data') renderDataTable();
}

// ─── Dynamic control visibility ──────────────────────────────────────────────

function _updateHistControls() {
  const val  = document.getElementById('statsHistType')?.value || 'histogram';
  const isBox = val === 'boxplot';
  const isSingle = !isBox; // all non-boxplot types use single-var selector
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('statsHistSingleRow', isSingle);
  show('statsBoxMultiRow',    isBox);
  show('statsHistBinsRow',    val === 'histogram');
  show('statsHistKdeRow',     val === 'histogram' || val === 'violin');
  show('statsHistMARow',      val === 'histogram');
}

function _updateHypoControls() {
  const type = document.getElementById('statsHypoType')?.value || 'ttest_1samp';
  const needs2    = ['ttest_2samp', 'ttest_paired', 'ks', 'mannwhitney'].includes(type);
  const needsMu0  = type === 'ttest_1samp';
  const isAnova   = type === 'anova';
  const isChi2    = type === 'chi2';
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('hypoVar1Row',  !isAnova);
  show('hypoVar2Row',  needs2 && !isAnova);
  show('hypoAnovaRow', isAnova);
  show('hypoMu0Row',   needsMu0);
  // Label update for chi2 (uses categorical var)
  const lbl = document.getElementById('hypoVar1Label');
  if (lbl) lbl.textContent = isChi2 ? 'Categorical variable' : 'Variable';
  refreshHypoSelectors(type);
}

function _updateRegrControls() {
  const type = document.getElementById('statsRegrType')?.value || 'linear';
  const el   = document.getElementById('regrThreshRow');
  if (el) el.style.display = type === 'logistic' ? '' : 'none';
}

function _updateMLControls() {
  const model = document.getElementById('statsMLModel')?.value || 'decision_tree';
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  const supervised = !['kmeans', 'pca'].includes(model);
  const treeBased  = ['decision_tree', 'random_forest', 'gradient_boosting'].includes(model);
  const ensemble   = ['random_forest', 'gradient_boosting'].includes(model);
  show('mlTaskRow',      supervised);
  show('mlNEstimRow',    ensemble);
  show('mlMaxDepthRow',  treeBased);
  show('mlKNeighRow',    model === 'knn');
  show('mlNClustersRow', model === 'kmeans');
  show('mlNCompRow',     model === 'pca');
  show('mlCVRow',        supervised);
  show('mlYRow',         supervised);
}

function _updatePrepControls() {
  const op = document.getElementById('statsPrepOp')?.value || 'normalize';
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('prepOutlierRow', op === 'remove_outliers');
  show('prepFillRow',    op === 'fill_missing');
  show('prepSplitRow',   op === 'train_test_split');
}

// ─── Variable selector refresh ────────────────────────────────────────────────

// Generic chip builder for a single-select chip state
function _buildSingleChips(containerId, vars, getSelected, setSelected, onRebuild) {
  const validIds = new Set(vars.map(v => String(v.id)));
  if (getSelected() && !validIds.has(getSelected())) setSelected(null);
  _buildChips(containerId, vars, 'single', v => {
    setSelected(String(v.id) === getSelected() ? null : String(v.id));
    onRebuild();
  }, id => String(id) === getSelected());
}

// Generic chip builder for a multi-select chip state
function _buildMultiChips(containerId, vars, selectedSet, onRebuild) {
  const validIds = new Set(vars.map(v => String(v.id)));
  for (const id of selectedSet) { if (!validIds.has(id)) selectedSet.delete(id); }
  _buildChips(containerId, vars, 'multi', v => {
    const id = String(v.id);
    if (selectedSet.has(id)) selectedSet.delete(id); else selectedSet.add(id);
    onRebuild();
  }, id => selectedSet.has(String(id)));
}

function refreshStatsVarSelectors() {
  const listVars = _getListVars();
  const numVars  = listVars.filter(v => !v._categorical);

  // ── Descriptive: all list vars ──
  _buildSingleChips('chips_describe', listVars,
    () => _describeSelected, v => { _describeSelected = v; },
    () => refreshStatsVarSelectors());

  // ── Histogram single: all list vars ──
  _buildSingleChips('chips_histSingle', listVars,
    () => _histSingleSelected, v => { _histSingleSelected = v; },
    () => refreshStatsVarSelectors());

  // ── Histogram box: numeric only ──
  _buildMultiChips('chips_histBox', numVars, _histBoxSelected, () => refreshStatsVarSelectors());

  // ── Curve fit X/Y: numeric only ──
  _buildSingleChips('chips_fitX', numVars,
    () => _fitXSelected, v => { _fitXSelected = v; },
    () => refreshStatsVarSelectors());
  _buildSingleChips('chips_fitY', numVars,
    () => _fitYSelected, v => { _fitYSelected = v; },
    () => refreshStatsVarSelectors());

  // ── Correlation: numeric only ──
  _buildMultiChips('chips_corr', numVars, _corrSelected, () => refreshStatsVarSelectors());

  // ── Hypothesis ──
  const hypoType = document.getElementById('statsHypoType')?.value || 'ttest_1samp';
  refreshHypoSelectors(hypoType);

  // ── Preprocess: numeric only ──
  _buildSingleChips('chips_preprocess', numVars,
    () => _prepSelected, v => { _prepSelected = v; },
    () => refreshStatsVarSelectors());

  // Regression: chip-style selectors (X = all vars, Y = numeric only)
  _renderRegrChips(listVars, numVars);

  // ML: chip-style selectors (X = all vars, Y = numeric only)
  _renderMLChips(listVars, numVars);
}

function refreshHypoSelectors(type) {
  const isChi2  = type === 'chi2';
  const listVars = _getListVars();
  const numVars  = listVars.filter(v => !v._categorical);
  const catVars  = listVars.filter(v =>  v._categorical);
  const hypo1Vars = isChi2 ? catVars : numVars;

  const rebuild = () => refreshHypoSelectors(document.getElementById('statsHypoType')?.value || type);

  // Prune stale selections
  const validH1 = new Set(hypo1Vars.map(v => String(v.id)));
  const validNum = new Set(numVars.map(v => String(v.id)));
  if (_hypo1Selected && !validH1.has(_hypo1Selected)) _hypo1Selected = null;
  if (_hypo2Selected && !validNum.has(_hypo2Selected)) _hypo2Selected = null;
  for (const id of _hypoAnovaSelected) { if (!validNum.has(id)) _hypoAnovaSelected.delete(id); }

  _buildChips('chips_hypo1', hypo1Vars, 'single', v => {
    _hypo1Selected = String(v.id) === _hypo1Selected ? null : String(v.id);
    rebuild();
  }, id => String(id) === _hypo1Selected);

  _buildChips('chips_hypo2', numVars, 'single', v => {
    _hypo2Selected = String(v.id) === _hypo2Selected ? null : String(v.id);
    rebuild();
  }, id => String(id) === _hypo2Selected);

  _buildMultiChips('chips_hypoAnova', numVars, _hypoAnovaSelected, rebuild);
}

// ─── Regression chip selectors ───────────────────────────────────────────────

function _renderRegrChips(xVars, yVars) {
  // xVars = all list vars (numeric + categorical), yVars = numeric only
  const validXIds = new Set(xVars.map(v => String(v.id)));
  const validYIds = new Set(yVars.map(v => String(v.id)));

  // Prune stale selections
  for (const id of _regrXSelected) { if (!validXIds.has(id)) _regrXSelected.delete(id); }
  if (_regrYSelected && !validYIds.has(_regrYSelected)) _regrYSelected = null;

  _buildChips('regrXChips', xVars, 'multi', v => {
    const id = String(v.id);
    if (_regrXSelected.has(id)) { _regrXSelected.delete(id); } else { _regrXSelected.add(id); }
    _renderRegrChips(xVars, yVars);
  }, id => _regrXSelected.has(String(id)));

  _buildChips('regrYChips', yVars, 'single', v => {
    _regrYSelected = String(v.id) === _regrYSelected ? null : String(v.id);
    _renderRegrChips(xVars, yVars);
  }, id => String(id) === _regrYSelected);
}

function _buildChips(containerId, vars, mode, onClick, isSelected) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  if (!vars.length) {
    el.innerHTML = '<span class="stats-chip-empty">No variables yet</span>';
    return;
  }
  vars.forEach(v => {
    const chip = document.createElement('button');
    chip.className = 'stats-chip' + (isSelected(v.id) ? ' stats-chip-on' : '') + (v._categorical ? ' stats-chip-cat' : '');
    const label = v.name || `v${v.id}`;
    chip.innerHTML = v._categorical
      ? `${label} <span class="stats-chip-cat-badge">cat</span>`
      : label;
    chip.title = v._categorical
      ? `${label}  [categorical · ${(v._labels||[]).length} levels · will one-hot encode]`
      : `${label}  (n = ${v.listItems.length})`;
    chip.addEventListener('click', () => onClick(v));
    el.appendChild(chip);
  });
}

// ─── ML chip selectors ────────────────────────────────────────────────────────

function _renderMLChips(xVars, yVars) {
  // xVars = all list vars (numeric + categorical), yVars = numeric only
  const validXIds = new Set(xVars.map(v => String(v.id)));
  const validYIds = new Set(yVars.map(v => String(v.id)));

  for (const id of _mlXSelected) { if (!validXIds.has(id)) _mlXSelected.delete(id); }
  if (_mlYSelected && !validYIds.has(_mlYSelected)) _mlYSelected = null;

  _buildChips('mlXChips', xVars, 'multi', v => {
    const id = String(v.id);
    if (_mlXSelected.has(id)) { _mlXSelected.delete(id); } else { _mlXSelected.add(id); }
    _renderMLChips(xVars, yVars);
  }, id => _mlXSelected.has(String(id)));

  _buildChips('mlYChips', yVars, 'single', v => {
    _mlYSelected = String(v.id) === _mlYSelected ? null : String(v.id);
    _renderMLChips(xVars, yVars);
  }, id => String(id) === _mlYSelected);
}

// ═══ HELPERS ═════════════════════════════════════════════════════════════════

function _getListVars() {
  if (typeof variables === 'undefined') return [];
  return variables.filter(v => v.kind === 'list' && Array.isArray(v.listItems) && v.listItems.length > 0);
}

/**
 * Expand a variable into one or more numeric columns.
 * Numeric vars → [{data, name}].
 * Categorical vars → one-hot dummy columns (reference category dropped).
 */
function _expandVar(v) {
  if (!v._categorical) {
    return [{ data: v.listItems.map(Number), name: v.name || `v${v.id}` }];
  }
  // Determine levels
  const labels = (v._labels && v._labels.length) ? v._labels : [...new Set(v.listItems)];
  if (labels.length < 2) {
    // Degenerate — treat as single 0-col
    return [{ data: v.listItems.map(() => 0), name: v.name || `v${v.id}` }];
  }
  // Drop first level (reference category); create dummy for each remaining level
  return labels.slice(1).map(lbl => ({
    data: v.listItems.map(val => (String(val) === String(lbl) ? 1 : 0)),
    name: `${v.name || `v${v.id}`}[${lbl}]`,
  }));
}

function _getVar(selId) {
  const sel = document.getElementById(selId);
  if (!sel || !sel.value) return null;
  if (typeof variables === 'undefined') return null;
  return variables.find(v => String(v.id) === String(sel.value)) || null;
}

// Lookup a variable by its chip state ID string
function _chipVar(selectedId) {
  if (!selectedId) return null;
  if (typeof variables === 'undefined') return null;
  return variables.find(v => String(v.id) === String(selectedId)) || null;
}

// Lookup multiple variables from a Set of IDs
function _chipVars(selectedSet) {
  if (typeof variables === 'undefined') return [];
  return Array.from(selectedSet).map(id => variables.find(v => String(v.id) === id)).filter(Boolean);
}

function _statsLoading(el) {
  if (el) el.innerHTML = '<div class="stats-loading"><div class="stats-spinner"></div>Computing…</div>';
}

function _statsError(el, msg) {
  if (el) el.innerHTML = `<div class="stats-error-box"><span>⚠</span> ${msg}</div>`;
}

async function _statsPost(endpoint, body) {
  const r = await fetch(`${API}/stats/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data;
}

function _fmtNum(n) {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  if (n === 0) return '0';
  if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-3 && n !== 0)) return n.toExponential(4);
  return parseFloat(n.toPrecision(6)).toString();
}

function _fmtP(p) {
  if (!isFinite(p)) return '—';
  if (p < 0.0001) return p.toExponential(3);
  return p.toFixed(4);
}

function _destroyChart(key) {
  if (_statsCharts[key]) { _statsCharts[key].destroy(); delete _statsCharts[key]; }
}

function _axisStyle() {
  return {
    grid: { color: 'rgba(26,26,44,0.9)' },
    ticks: { color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } },
  };
}

// ═══ DESCRIPTIVE STATISTICS ══════════════════════════════════════════════════

async function runDescribe() {
  const el = document.getElementById('statsResult_describe');
  const v  = _chipVar(_describeSelected);
  if (!v) return _statsError(el, 'Select a variable first.');

  if (v._categorical && v._labels && v._labels.length) {
    _renderCatDescribe(el, v);
    return;
  }

  _statsLoading(el);
  try {
    const data = await _statsPost('describe', { data: v.listItems });
    _renderDescribe(el, data, v.name || `v${v.id}`);
  } catch(e) { _statsError(el, e.message); }
}

function _renderCatDescribe(el, v) {
  const varName = v.name || `v${v.id}`;
  const total   = v.listItems.reduce((a, b) => a + b, 0);
  const mode    = v._labels[0];
  const modeCt  = v.listItems[0];
  const topN    = Math.min(v._labels.length, 25);
  const maxCt   = v.listItems[0];

  const freqRows = v._labels.slice(0, topN).map((lbl, i) => {
    const ct   = v.listItems[i];
    const pct  = (ct / total * 100);
    const barW = (ct / maxCt * 100).toFixed(1);
    return `<div class="stats-freq-row">
      <span class="stats-freq-lbl" title="${lbl}">${lbl}</span>
      <div class="stats-freq-bar-wrap"><div class="stats-freq-bar" style="width:${barW}%"></div></div>
      <span class="stats-freq-ct">${ct}</span>
      <span class="stats-freq-pct">${pct.toFixed(1)}%</span>
    </div>`;
  }).join('');

  const more = v._labels.length > topN
    ? `<div class="stats-freq-more">… and ${v._labels.length - topN} more levels</div>` : '';

  el.innerHTML = `
    <div class="stats-res-header">Descriptive Statistics — <span class="stats-varname">${varName}</span>
      <span class="stats-type-badge stats-type-cat">qualitative</span>
    </div>
    <div class="stats-desc-layout">
      <div class="stats-table-card">
        <div class="stats-section-lbl">Summary</div>
        <div class="stats-row"><span class="stats-lbl">Total obs.</span><span class="stats-val">${total}</span></div>
        <div class="stats-row stats-row-hi"><span class="stats-lbl">Unique levels</span><span class="stats-val">${v._labels.length}</span></div>
        <div class="stats-divider"></div>
        <div class="stats-section-lbl">Mode (most frequent)</div>
        <div class="stats-row stats-row-hi">
          <span class="stats-lbl" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${mode}">${mode}</span>
          <span class="stats-val">${modeCt} <span style="color:var(--muted);font-size:.67rem">(${(modeCt/total*100).toFixed(1)}%)</span></span>
        </div>
      </div>
      <div class="stats-table-card stats-freq-card">
        <div class="stats-freq-header">
          <span class="stats-section-lbl" style="margin:0">Frequency — top ${topN}</span>
          <span class="stats-freq-col-hdr">n</span>
          <span class="stats-freq-col-hdr">%</span>
        </div>
        ${freqRows}${more}
      </div>
    </div>`;
}

function _renderDescribe(el, d, name) {
  const row = (lbl, val, hi = false) =>
    `<div class="stats-row${hi ? ' stats-row-hi' : ''}">
       <span class="stats-lbl">${lbl}</span>
       <span class="stats-val">${_fmtNum(val)}</span>
     </div>`;

  const range = d.max - d.min;
  const cv    = d.mean !== 0 ? Math.abs(d.std / d.mean) * 100 : null;

  el.innerHTML = `
    <div class="stats-res-header">Descriptive Statistics — <span class="stats-varname">${name}</span>
      <span class="stats-type-badge stats-type-num">quantitative</span>
    </div>
    <div class="stats-desc-layout">
      <div class="stats-table-card">
        <div class="stats-section-lbl">Central Tendency</div>
        ${row('Mean', d.mean, true)}
        ${row('Median', d.median, true)}
        <div class="stats-divider"></div>
        <div class="stats-section-lbl">Spread</div>
        ${row('Std Dev', d.std, true)}
        ${row('Std Error', d.sem)}
        ${row('Variance', d.variance)}
        ${cv !== null ? row('CV (%)', cv) : ''}
      </div>
      <div class="stats-table-card">
        <div class="stats-section-lbl">Five-Number Summary</div>
        ${row('Min', d.min)}
        ${row('Q1 (25th)', d.q1)}
        ${row('Median', d.median)}
        ${row('Q3 (75th)', d.q3)}
        ${row('Max', d.max)}
        <div class="stats-divider"></div>
        ${row('Range', range)}
        ${row('IQR', d.iqr)}
        <div class="stats-divider"></div>
        <div class="stats-section-lbl">Shape</div>
        ${row('Skewness', d.skewness)}
        ${row('Kurtosis', d.kurtosis)}
        ${row('n', d.n)}
      </div>
    </div>`;
}

// ═══ DATA TABLE ══════════════════════════════════════════════════════════════

let _dataPage = 0;
const _DATA_PAGE = 50;

function renderDataTable() {
  const el = document.getElementById('statsResult_data');
  if (!el) return;

  const allVars = _getListVars();
  const numVars = allVars.filter(v => !v._categorical);
  const catVars = allVars.filter(v =>  v._categorical);

  if (!allVars.length) {
    el.innerHTML = '<div class="stats-empty-hint">Import a CSV or .pkl file from the Files tab to browse data here.</div>';
    return;
  }
  if (!numVars.length) {
    el.innerHTML = `<div class="stats-empty-hint">
      ${catVars.length} categorical variable${catVars.length > 1 ? 's' : ''} imported
      (${catVars.map(v => v.name).join(', ')}).<br>
      Explore them in the <strong>Descriptive</strong> and <strong>Histogram</strong> tabs.
    </div>`;
    return;
  }

  const maxRows    = Math.max(...numVars.map(v => v.listItems.length));
  const totalPages = Math.ceil(maxRows / _DATA_PAGE);
  _dataPage = Math.max(0, Math.min(_dataPage, totalPages - 1));
  const start = _dataPage * _DATA_PAGE;
  const end   = Math.min(start + _DATA_PAGE, maxRows);

  const headerCells = numVars.map(v => `<th class="data-th">${v.name || `v${v.id}`}</th>`).join('');

  const bodyRows = [];
  for (let r = start; r < end; r++) {
    const cells = numVars.map(v =>
      r < v.listItems.length
        ? `<td class="data-td">${_fmtNum(v.listItems[r])}</td>`
        : `<td class="data-td data-missing">—</td>`
    ).join('');
    bodyRows.push(`<tr><td class="data-td data-row-num">${r + 1}</td>${cells}</tr>`);
  }

  const catNote = catVars.length
    ? `<div class="data-cat-note">
        <strong>${catVars.length}</strong> categorical column${catVars.length > 1 ? 's' : ''} not shown here:
        ${catVars.map(v => `<em>${v.name}</em>`).join(', ')} — explore in Descriptive &amp; Histogram tabs
       </div>` : '';

  el.innerHTML = `
    ${catNote}
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th class="data-th data-th-idx">#</th>${headerCells}</tr></thead>
        <tbody>${bodyRows.join('')}</tbody>
      </table>
    </div>
    <div class="data-pagination">
      <button class="data-page-btn" id="dataPrevBtn" ${_dataPage === 0 ? 'disabled' : ''}>← Prev</button>
      <span class="data-page-info">Rows ${start + 1}–${end} of ${maxRows} &nbsp;·&nbsp; page ${_dataPage + 1} / ${totalPages}</span>
      <button class="data-page-btn" id="dataNextBtn" ${_dataPage >= totalPages - 1 ? 'disabled' : ''}>Next →</button>
      <button class="data-page-btn" id="dataDownloadCsvBtn" style="margin-left:auto">⬇ Download CSV</button>
    </div>`;

  document.getElementById('dataPrevBtn')?.addEventListener('click', () => { _dataPage--; renderDataTable(); });
  document.getElementById('dataNextBtn')?.addEventListener('click', () => { _dataPage++; renderDataTable(); });
  document.getElementById('dataDownloadCsvBtn')?.addEventListener('click', _downloadAllCsv);
}

// ═══ HISTOGRAM / BOX PLOT / VIOLIN ════════════════════════════════════════════

async function runHistogram() {
  const el      = document.getElementById('statsResult_hist');
  const type    = document.getElementById('statsHistType')?.value || 'histogram';

  if (type === 'boxplot') return _runBoxplot(el);

  const v = _chipVar(_histSingleSelected);
  if (!v) return _statsError(el, 'Select a variable first.');

  if (v._categorical && v._labels && v._labels.length && type === 'histogram') {
    _renderCatFreqBar(el, v);
    return;
  }

  if (type === 'qqplot') {
    _statsLoading(el);
    try {
      const data = await _statsPost('qqplot', { data: v.listItems });
      _renderQQPlot(el, data, v.name || `v${v.id}`);
    } catch(e) { _statsError(el, e.message); }
    return;
  }

  if (type === 'ecdf') {
    _renderECDF(el, v);
    return;
  }

  if (type === 'violin') {
    const binRaw = 'auto';
    _statsLoading(el);
    try {
      const data = await _statsPost('histogram', { data: v.listItems, bins: binRaw, kde: true });
      _renderViolin(el, data, v.name || `v${v.id}`);
    } catch(e) { _statsError(el, e.message); }
    return;
  }

  // Histogram
  const binRaw = document.getElementById('statsHistBins')?.value.trim() || 'auto';
  const kde    = document.getElementById('statsHistKde')?.checked ?? true;
  const bins   = (binRaw === '' || isNaN(Number(binRaw))) ? binRaw : Number(binRaw);
  const showMA = document.getElementById('statsHistMA')?.checked ?? false;
  const maWin  = parseInt(document.getElementById('statsHistMAWindow')?.value) || 5;

  _statsLoading(el);
  try {
    const data = await _statsPost('histogram', { data: v.listItems, bins, kde });
    _renderHistogram(el, data, v.name || `v${v.id}`, showMA, maWin);
  } catch(e) { _statsError(el, e.message); }
}

function _renderCatFreqBar(el, v) {
  const varName = v.name || `v${v.id}`;
  const total   = v.listItems.reduce((a, b) => a + b, 0);

  el.innerHTML = `
    <div class="stats-res-header">
      Frequency Distribution — <span class="stats-varname">${varName}</span>
      <span class="stats-fit-r2">${v._labels.length} levels</span>
      <span class="stats-fit-rmse">${total} observations</span>
    </div>
    <div class="stats-chart-wrap"><canvas id="statsCanvas_hist"></canvas></div>`;

  _destroyChart('hist');
  const ctx = document.getElementById('statsCanvas_hist').getContext('2d');

  _statsCharts['hist'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: v._labels,
      datasets: [{
        label: 'Count',
        data: v.listItems,
        backgroundColor: 'rgba(167,139,250,0.5)',
        borderColor: '#a78bfa',
        borderWidth: 1.5,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(26,26,44,0.9)' }, ticks: { color: '#9090c0', font: { family: 'IBM Plex Mono', size: 10 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 40 } },
        y: { ..._axisStyle(), title: { display: true, text: 'Count', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function _movingAverage(arr, window) {
  const half = Math.floor(window / 2);
  return arr.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(arr.length, i + half + 1);
    return arr.slice(lo, hi).reduce((a, b) => a + b, 0) / (hi - lo);
  });
}

function _renderHistogram(el, data, varName, showMA, maWin) {
  el.innerHTML = `
    <div class="stats-res-header">Histogram — <span class="stats-varname">${varName}</span></div>
    <div class="stats-chart-wrap"><canvas id="statsCanvas_hist"></canvas></div>
    <div class="stats-chart-meta">
      ${data.centers.length} bins &nbsp;·&nbsp; bin width = ${_fmtNum(data.bin_width)}
      ${showMA ? `&nbsp;·&nbsp; moving avg window = ${maWin}` : ''}
    </div>`;

  _destroyChart('hist');
  const ctx = document.getElementById('statsCanvas_hist').getContext('2d');

  const datasets = [{
    label: 'Count',
    data: data.centers.map((c, i) => ({ x: c, y: data.counts[i] })),
    type: 'bar',
    backgroundColor: 'rgba(90,255,206,0.42)',
    borderColor: '#5affce',
    borderWidth: 1.5,
    barPercentage: 1.0,
    categoryPercentage: 1.0,
    order: 2,
  }];

  if (data.kde_x && data.kde_y) {
    datasets.push({
      label: 'KDE',
      data: data.kde_x.map((x, i) => ({ x, y: data.kde_y[i] })),
      type: 'line', borderColor: '#d4ff5a', borderWidth: 2,
      pointRadius: 0, tension: 0.4, fill: false, order: 1,
    });
  }

  if (showMA && data.counts.length >= maWin) {
    const ma = _movingAverage(data.counts, maWin);
    datasets.push({
      label: `Moving Avg (${maWin})`,
      data: data.centers.map((x, i) => ({ x, y: ma[i] })),
      type: 'line', borderColor: '#ff6faa', borderWidth: 2.5,
      borderDash: [6, 3], pointRadius: 0, tension: 0.3, fill: false, order: 0,
    });
  }

  _statsCharts['hist'] = new Chart(ctx, {
    type: 'bar',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false, parsing: false,
      scales: {
        x: { type: 'linear', ..._axisStyle(), title: { display: true, text: varName, color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
        y: { ..._axisStyle(), title: { display: true, text: 'Count', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
      },
      plugins: { legend: { labels: { color: '#c0c0e0', font: { family: 'IBM Plex Mono', size: 11 } } } },
    },
  });
}

function _renderViolin(el, data, varName) {
  el.innerHTML = `
    <div class="stats-res-header">Violin Plot — <span class="stats-varname">${varName}</span></div>
    <div class="stats-chart-wrap"><canvas id="statsCanvas_hist"></canvas></div>`;

  _destroyChart('hist');
  const ctx = document.getElementById('statsCanvas_hist').getContext('2d');

  if (!data.kde_x || !data.kde_y) {
    _statsError(el, 'KDE data unavailable for violin plot.');
    return;
  }

  const maxY = Math.max(...data.kde_y);
  const half = data.kde_y.map(y => y / maxY * 0.45);

  // Mirror: positive half (right) + reversed negative half (left)
  const xs    = data.kde_x;
  const posHalf = xs.map((x, i) => ({ x:  half[i], y: x }));
  const negHalf = [...xs].reverse().map((x, i) => ({ x: -half[xs.length - 1 - i], y: x }));

  _statsCharts['hist'] = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: varName,
          data: [...posHalf, ...negHalf],
          showLine: true,
          fill: true,
          backgroundColor: 'rgba(90,255,206,0.2)',
          borderColor: '#5affce',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, parsing: false,
      scales: {
        x: { ..._axisStyle(), title: { display: true, text: 'Density (normalized)', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
        y: { ..._axisStyle(), title: { display: true, text: varName, color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function _renderQQPlot(el, data, varName) {
  el.innerHTML = `
    <div class="stats-res-header">Q-Q Plot — <span class="stats-varname">${varName}</span>
      <span class="stats-fit-r2">Shapiro-Wilk p = ${_fmtP(data.sw_p)}</span>
      <span class="stats-fit-rmse ${data.sw_p < 0.05 ? 'rmse-warn' : ''}">
        ${data.sw_p < 0.05 ? 'Non-normal' : 'Approx. normal'}
      </span>
    </div>
    <div class="stats-chart-wrap"><canvas id="statsCanvas_hist"></canvas></div>
    <div class="stats-chart-meta">
      Points close to the reference line indicate normality.
      Systematic departures suggest skewness or heavy tails.
    </div>`;

  _destroyChart('hist');
  const ctx = document.getElementById('statsCanvas_hist').getContext('2d');
  _statsCharts['hist'] = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Sample quantiles',
          data: data.theoretical.map((x, i) => ({ x, y: data.sample[i] })),
          backgroundColor: 'rgba(90,255,206,0.65)', borderColor: '#5affce', pointRadius: 3.5,
        },
        {
          label: 'Reference line',
          data: [{ x: data.line_x[0], y: data.line_y[0] }, { x: data.line_x[1], y: data.line_y[1] }],
          type: 'line', borderColor: 'rgba(212,255,90,0.7)', borderWidth: 2,
          borderDash: [6, 3], pointRadius: 0, fill: false,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, parsing: false,
      scales: {
        x: { ..._axisStyle(), title: { display: true, text: 'Theoretical quantiles (Normal)', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
        y: { ..._axisStyle(), title: { display: true, text: `Sample quantiles — ${varName}`, color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
      },
      plugins: { legend: { labels: { color: '#c0c0e0', font: { family: 'IBM Plex Mono', size: 11 } } } },
    },
  });
}

function _renderECDF(el, v) {
  const varName = v.name || `v${v.id}`;
  const sorted  = [...v.listItems].filter(x => x !== null && isFinite(x)).sort((a, b) => a - b);
  const n       = sorted.length;
  if (!n) return _statsError(el, 'No finite values in variable.');

  // Build step-function points: each x appears twice (before and after the step)
  const pts = [];
  sorted.forEach((x, i) => {
    pts.push({ x, y: i / n });       // just before step
    pts.push({ x, y: (i + 1) / n }); // after step
  });

  el.innerHTML = `
    <div class="stats-res-header">ECDF — <span class="stats-varname">${varName}</span>
      <span class="stats-fit-r2">n = ${n}</span>
    </div>
    <div class="stats-chart-wrap"><canvas id="statsCanvas_hist"></canvas></div>
    <div class="stats-chart-meta">
      Empirical Cumulative Distribution Function. Each step represents one observation.
    </div>`;

  _destroyChart('hist');
  const ctx = document.getElementById('statsCanvas_hist').getContext('2d');
  _statsCharts['hist'] = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: `ECDF — ${varName}`,
          data: pts,
          showLine: true,
          borderColor: '#5affce', borderWidth: 2,
          backgroundColor: 'rgba(90,255,206,0.08)',
          pointRadius: 0, tension: 0, fill: true,
          stepped: true,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, parsing: false,
      scales: {
        x: { ..._axisStyle(), title: { display: true, text: varName, color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
        y: {
          ..._axisStyle(),
          title: { display: true, text: 'Cumulative proportion', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } },
          min: 0, max: 1,
        },
      },
      plugins: { legend: { display: false } },
    },
  });
}

async function _runBoxplot(el) {
  const selectedVars = _chipVars(_histBoxSelected);
  if (!selectedVars.length) return _statsError(el, 'Select at least one variable.');

  const payload = {};
  selectedVars.forEach(v => {
    if (!v._categorical) payload[v.name || `v${v.id}`] = v.listItems;
  });

  _statsLoading(el);
  try {
    const resp = await _statsPost('boxplot', { datasets: payload });
    _renderBoxplot(el, resp.boxplots);
  } catch(e) { _statsError(el, e.message); }
}

function _renderBoxplot(el, boxplots) {
  const names = Object.keys(boxplots);
  if (!names.length) return _statsError(el, 'No data to display.');

  // Summary table
  const summaryRows = names.map(n => {
    const b = boxplots[n];
    return `<tr>
      <td class="data-td" style="text-align:left;color:var(--acc2);font-weight:600">${n}</td>
      <td class="data-td">${b.n}</td>
      <td class="data-td">${_fmtNum(b.min)}</td>
      <td class="data-td">${_fmtNum(b.q1)}</td>
      <td class="data-td" style="color:var(--acc2)">${_fmtNum(b.median)}</td>
      <td class="data-td">${_fmtNum(b.q3)}</td>
      <td class="data-td">${_fmtNum(b.max)}</td>
      <td class="data-td">${_fmtNum(b.mean)}</td>
      <td class="data-td">${b.outliers.length}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="stats-res-header">Box Plot — ${names.map(n => `<span class="stats-varname">${n}</span>`).join(', ')}</div>
    <div class="stats-chart-wrap" style="height:320px"><canvas id="statsCanvas_hist"></canvas></div>
    <div class="data-table-wrap" style="margin-top:14px;max-height:200px">
      <table class="data-table">
        <thead><tr>
          <th class="data-th" style="text-align:left">Variable</th>
          <th class="data-th">n</th><th class="data-th">Min</th><th class="data-th">Q1</th>
          <th class="data-th">Median</th><th class="data-th">Q3</th><th class="data-th">Max</th>
          <th class="data-th">Mean</th><th class="data-th">Outliers</th>
        </tr></thead>
        <tbody>${summaryRows}</tbody>
      </table>
    </div>`;

  _destroyChart('hist');
  const ctx = document.getElementById('statsCanvas_hist').getContext('2d');

  const colors = ['#5affce', '#d4ff5a', '#ff6faa', '#a78bfa', '#38bdf8', '#ffb347'];

  // Build datasets using chartjs-chart-boxplot if available, else floating bars
  if (typeof Chart !== 'undefined' && Chart.registry?.controllers?.boxplot) {
    _statsCharts['hist'] = new Chart(ctx, {
      type: 'boxplot',
      data: {
        labels: names,
        datasets: [{
          label: 'Distribution',
          data: names.map(n => ({
            min:       boxplots[n].whisker_lo,
            q1:        boxplots[n].q1,
            median:    boxplots[n].median,
            mean:      boxplots[n].mean,
            q3:        boxplots[n].q3,
            max:       boxplots[n].whisker_hi,
            outliers:  boxplots[n].outliers,
          })),
          backgroundColor: names.map((_, i) => colors[i % colors.length].replace(')', ', 0.35)').replace('rgb', 'rgba').replace('#', 'rgba(').replace('rgba(', 'rgba(')),
          borderColor: names.map((_, i) => colors[i % colors.length]),
          borderWidth: 1.5,
          outlierBackgroundColor: '#ff6faa',
          outlierRadius: 3,
          medianColor: '#d4ff5a',
          meanBackgroundColor: 'rgba(212,255,90,0.5)',
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ..._axisStyle() },
          y: { ..._axisStyle() },
        },
        plugins: { legend: { display: false } },
      },
    });
  } else {
    // Fallback: floating bar chart to approximate box plot
    const iqrData   = names.map(n => [boxplots[n].q1, boxplots[n].q3]);
    const wiskData  = names.map(n => [boxplots[n].whisker_lo, boxplots[n].whisker_hi]);
    const medData   = names.map(n => [boxplots[n].median - 1e-9, boxplots[n].median + 1e-9]);

    _statsCharts['hist'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: names,
        datasets: [
          { label: 'Whisker range', data: wiskData, backgroundColor: 'rgba(90,255,206,0.1)', borderColor: '#5affce', borderWidth: 1, barThickness: 3, order: 3 },
          { label: 'IQR (Q1–Q3)', data: iqrData, backgroundColor: 'rgba(90,255,206,0.35)', borderColor: '#5affce', borderWidth: 1.5, order: 2 },
          { label: 'Median', data: medData, backgroundColor: '#d4ff5a', borderColor: '#d4ff5a', borderWidth: 4, order: 1 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ..._axisStyle() },
          y: { ..._axisStyle(), title: { display: true, text: 'Value', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
        },
        plugins: { legend: { labels: { color: '#c0c0e0', font: { family: 'IBM Plex Mono', size: 11 } } } },
      },
    });
  }
}

// ═══ CURVE FITTING ════════════════════════════════════════════════════════════

async function runCurveFit() {
  const el   = document.getElementById('statsResult_fit');
  const xVar = _chipVar(_fitXSelected);
  const yVar = _chipVar(_fitYSelected);
  if (!xVar || !yVar) return _statsError(el, 'Select both X and Y variables.');

  const fitType = document.getElementById('statsFitType').value;
  const degree  = parseInt(document.getElementById('statsFitDegree')?.value) || 2;
  const formula = document.getElementById('statsFitFormula')?.value.trim() || '';
  const ci      = document.getElementById('statsFitCI')?.checked ?? false;

  if (fitType === 'custom' && !formula) {
    return _statsError(el, 'Enter a formula, e.g.  a*exp(-b*x) + c');
  }

  _statsLoading(el);
  try {
    const data = await _statsPost('fit', {
      x: xVar.listItems, y: yVar.listItems,
      type: fitType, degree, formula, ci,
    });
    _renderCurveFit(el, data, xVar.name || `v${xVar.id}`, yVar.name || `v${yVar.id}`, fitType, formula);
  } catch(e) { _statsError(el, e.message); }
}

function _renderCurveFit(el, data, xName, yName, fitType, formula) {
  const label = fitType === 'custom' ? (formula || 'custom') : fitType;
  const paramRows = Object.entries(data.params)
    .map(([k, v]) => `<div class="stats-row stats-row-hi">
       <span class="stats-lbl">${k}</span>
       <span class="stats-val">${_fmtNum(v)}</span>
     </div>`).join('');

  el.innerHTML = `
    <div class="stats-res-header">Curve Fit — <span class="stats-varname">${label}</span>
      &nbsp;<span class="stats-fit-r2">R² = ${data.r2.toFixed(5)}</span>
      <span class="stats-fit-rmse">RMSE = ${_fmtNum(data.rmse)}</span>
    </div>
    <div class="stats-fit-layout">
      <div class="stats-chart-wrap stats-chart-main"><canvas id="statsCanvas_fit"></canvas></div>
      <div class="stats-fit-sidebar">
        <div class="stats-table-card">
          <div class="stats-section-lbl">Parameters</div>
          ${paramRows}
          <div class="stats-divider"></div>
          <div class="stats-row stats-row-hi"><span class="stats-lbl">R²</span><span class="stats-val">${data.r2.toFixed(6)}</span></div>
          <div class="stats-row"><span class="stats-lbl">RMSE</span><span class="stats-val">${_fmtNum(data.rmse)}</span></div>
        </div>
      </div>
    </div>
    <div class="stats-res-header" style="margin-top:20px">Residuals</div>
    <div class="stats-chart-wrap stats-chart-small"><canvas id="statsCanvas_resid"></canvas></div>`;

  _destroyChart('fit'); _destroyChart('resid');

  const fitCtx = document.getElementById('statsCanvas_fit').getContext('2d');
  const fitDatasets = [
    {
      label: 'Data',
      data: data.x_orig.map((x, i) => ({ x, y: data.y_orig[i] })),
      backgroundColor: 'rgba(90,255,206,0.65)', borderColor: '#5affce', pointRadius: 3.5,
    },
    {
      label: `${label} fit`,
      data: data.x_fit.map((x, i) => ({ x, y: data.y_fit[i] })),
      type: 'line', borderColor: '#d4ff5a', borderWidth: 2.5, pointRadius: 0, tension: 0.1, fill: false,
    },
  ];

  if (data.ci_band) {
    fitDatasets.push({
      label: '95% CI upper',
      data: data.x_fit.map((x, i) => ({ x, y: data.ci_band.hi[i] })),
      type: 'line', borderColor: 'rgba(212,255,90,0.25)', borderWidth: 1,
      pointRadius: 0, fill: '+1', backgroundColor: 'rgba(212,255,90,0.08)', tension: 0.1,
    });
    fitDatasets.push({
      label: '95% CI lower',
      data: data.x_fit.map((x, i) => ({ x, y: data.ci_band.lo[i] })),
      type: 'line', borderColor: 'rgba(212,255,90,0.25)', borderWidth: 1,
      pointRadius: 0, fill: false, tension: 0.1,
    });
  }

  _statsCharts['fit'] = new Chart(fitCtx, {
    type: 'scatter',
    data: { datasets: fitDatasets },
    options: {
      responsive: true, maintainAspectRatio: false, parsing: false,
      scales: {
        x: { ..._axisStyle(), title: { display: true, text: xName, color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
        y: { ..._axisStyle(), title: { display: true, text: yName, color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
      },
      plugins: { legend: { labels: { color: '#c0c0e0', font: { family: 'IBM Plex Mono', size: 11 }, filter: item => !item.text.includes('CI') } } },
    },
  });

  const xRange = [Math.min(...data.x_orig), Math.max(...data.x_orig)];
  const residCtx = document.getElementById('statsCanvas_resid').getContext('2d');
  _statsCharts['resid'] = new Chart(residCtx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Residuals',
          data: data.x_orig.map((x, i) => ({ x, y: data.residuals[i] })),
          backgroundColor: 'rgba(255,111,170,0.65)', borderColor: '#ff6faa', pointRadius: 3,
        },
        {
          label: 'Zero',
          data: [{ x: xRange[0], y: 0 }, { x: xRange[1], y: 0 }],
          type: 'line', borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1,
          borderDash: [5, 5], pointRadius: 0, fill: false,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, parsing: false,
      scales: {
        x: { ..._axisStyle(), title: { display: true, text: xName, color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
        y: { ..._axisStyle(), title: { display: true, text: 'Residual', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

// ═══ CORRELATION ══════════════════════════════════════════════════════════════

async function runCorrelation() {
  const el       = document.getElementById('statsResult_corr');
  const selVars  = _chipVars(_corrSelected);
  if (selVars.length < 2) return _statsError(el, 'Select at least 2 variables.');

  const payload = {};
  selVars.forEach(v => { payload[v.name || `v${v.id}`] = v.listItems; });

  _statsLoading(el);
  try {
    const resp = await _statsPost('correlation', { data: payload });
    _renderCorrelation(el, resp);
  } catch(e) { _statsError(el, e.message); }
}

function _renderCorrelation(el, { names, matrix }) {
  function _corrBg(r) {
    if (r === null) return '#1a1a2c';
    const t = Math.abs(r);
    if (r >= 0) return `rgba(${Math.round(30*(1-t))}, ${Math.round(80+175*t)}, ${Math.round(80+126*t)}, 0.85)`;
    return `rgba(${Math.round(80+175*t)}, ${Math.round(40*(1-t))}, ${Math.round(60*(1-t))}, 0.85)`;
  }
  function _corrFg(r) { return r !== null && Math.abs(r) > 0.38 ? '#fff' : '#c0c0e0'; }

  const headerCells = names.map(n => `<th class="corr-th">${n}</th>`).join('');
  const bodyRows = matrix.map((row, i) => {
    const cells = row.map((val, j) => {
      const fmt = val !== null ? val.toFixed(3) : '—';
      return `<td class="corr-cell" style="background:${_corrBg(val)};color:${_corrFg(val)}"
                title="${names[i]} × ${names[j]}: ${fmt}">${fmt}</td>`;
    }).join('');
    return `<tr><th class="corr-th corr-row-hdr">${names[i]}</th>${cells}</tr>`;
  }).join('');

  el.innerHTML = `
    <div class="stats-res-header">Pearson Correlation Matrix</div>
    <div class="corr-table-wrap">
      <table class="corr-table">
        <thead><tr><th class="corr-th corr-corner"></th>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
    <div class="corr-legend-wrap">
      <span class="corr-leg-lbl">−1 (negative)</span>
      <div class="corr-legend-bar"></div>
      <span class="corr-leg-lbl">(positive) +1</span>
    </div>`;
}

// ═══ HYPOTHESIS TESTING ═══════════════════════════════════════════════════════

async function runHypothesis() {
  const el   = document.getElementById('statsResult_hypo');
  const type = document.getElementById('statsHypoType')?.value || 'ttest_1samp';
  _statsLoading(el);

  try {
    let payload = { type };

    if (type === 'ttest_1samp') {
      const v = _chipVar(_hypo1Selected);
      if (!v) return _statsError(el, 'Select a variable.');
      payload.data = v.listItems;
      payload.mu0  = parseFloat(document.getElementById('statsHypoMu0')?.value) || 0;

    } else if (type === 'ttest_2samp' || type === 'ttest_paired' || type === 'ks' || type === 'mannwhitney') {
      const v1 = _chipVar(_hypo1Selected);
      const v2 = _chipVar(_hypo2Selected);
      if (!v1 || !v2) return _statsError(el, 'Select two variables.');
      payload.data1 = v1.listItems;
      payload.data2 = v2.listItems;

    } else if (type === 'anova') {
      const anovaVars = _chipVars(_hypoAnovaSelected);
      if (anovaVars.length < 2) return _statsError(el, 'Select at least 2 groups.');
      payload.groups = anovaVars.map(v => v.listItems);

    } else if (type === 'chi2') {
      const v = _chipVar(_hypo1Selected);
      if (!v) return _statsError(el, 'Select a categorical variable.');
      if (!v._categorical) return _statsError(el, 'Chi-squared requires a categorical variable.');
      payload.observed = v.listItems;

    } else {
      return _statsError(el, `Unknown test type: ${type}`);
    }

    const data = await _statsPost('test', payload);
    _renderHypothesisResult(el, data, type, payload);
  } catch(e) { _statsError(el, e.message); }
}

function _renderHypothesisResult(el, d, type, payload) {
  const reject05 = d.reject_05;
  const reject01 = d.reject_01;

  const verdict = reject01
    ? `<span class="hypo-badge hypo-reject">Reject H₀ at α = 0.01</span>`
    : reject05
    ? `<span class="hypo-badge hypo-reject">Reject H₀ at α = 0.05</span>`
    : `<span class="hypo-badge hypo-fail">Fail to reject H₀ at α = 0.05</span>`;

  const sigStars = reject01 ? '★★★' : reject05 ? '★★' : '—';

  const pRow = `<div class="stats-row stats-row-hi">
    <span class="stats-lbl">p-value</span>
    <span class="stats-val" style="color:${reject05 ? 'var(--acc)' : 'var(--text)'}">${_fmtP(d.p_value)}</span>
  </div>`;

  const statRow = `<div class="stats-row">
    <span class="stats-lbl">Test statistic</span>
    <span class="stats-val">${_fmtNum(d.statistic)}</span>
  </div>`;

  let extraRows = '';
  if (d.df !== undefined)       extraRows += `<div class="stats-row"><span class="stats-lbl">df</span><span class="stats-val">${d.df}</span></div>`;
  if (d.n !== undefined)        extraRows += `<div class="stats-row"><span class="stats-lbl">n</span><span class="stats-val">${d.n}</span></div>`;
  if (d.n_pairs !== undefined)  extraRows += `<div class="stats-row"><span class="stats-lbl">n pairs</span><span class="stats-val">${d.n_pairs}</span></div>`;
  if (d.n1 !== undefined)       extraRows += `<div class="stats-row"><span class="stats-lbl">n₁ / n₂</span><span class="stats-val">${d.n1} / ${d.n2}</span></div>`;
  if (d.n_groups !== undefined) extraRows += `<div class="stats-row"><span class="stats-lbl">Groups</span><span class="stats-val">${d.n_groups}</span></div>`;
  if (d.mean !== undefined)     extraRows += `<div class="stats-row"><span class="stats-lbl">Sample mean</span><span class="stats-val">${_fmtNum(d.mean)}</span></div>`;
  if (d.mean1 !== undefined)    extraRows += `<div class="stats-row"><span class="stats-lbl">Mean₁ / Mean₂</span><span class="stats-val">${_fmtNum(d.mean1)} / ${_fmtNum(d.mean2)}</span></div>`;
  if (d.mean_diff !== undefined)extraRows += `<div class="stats-row"><span class="stats-lbl">Mean diff</span><span class="stats-val">${_fmtNum(d.mean_diff)}</span></div>`;
  if (d.mu0 !== undefined)      extraRows += `<div class="stats-row"><span class="stats-lbl">Null mean (μ₀)</span><span class="stats-val">${d.mu0}</span></div>`;
  if (d.ci_95)                  extraRows += `<div class="stats-row"><span class="stats-lbl">95% CI</span><span class="stats-val">[${_fmtNum(d.ci_95[0])}, ${_fmtNum(d.ci_95[1])}]</span></div>`;

  // Group means for ANOVA
  let groupMeansCard = '';
  if (d.group_means && d.group_means.length) {
    const rows = d.group_means.map((m, i) =>
      `<div class="stats-row"><span class="stats-lbl">Group ${i+1} (n=${d.group_ns[i]})</span><span class="stats-val">${_fmtNum(m)}</span></div>`
    ).join('');
    groupMeansCard = `<div class="stats-table-card" style="min-width:160px;flex:0 0 auto">
      <div class="stats-section-lbl">Group Means</div>
      ${rows}
    </div>`;
  }

  el.innerHTML = `
    <div class="stats-res-header">${d.test} &nbsp; ${verdict} &nbsp; <span style="color:var(--acc);font-size:.9rem">${sigStars}</span></div>
    <div class="stats-desc-layout" style="margin-top:12px">
      <div class="stats-table-card" style="min-width:220px">
        <div class="stats-section-lbl">Results</div>
        ${pRow}${statRow}${extraRows}
      </div>
      ${groupMeansCard}
      <div class="stats-table-card hypo-interpretation-card" style="flex:2;min-width:200px">
        <div class="stats-section-lbl">Interpretation</div>
        <div class="hypo-interp-text">${_hypoInterpretation(d, type)}</div>
      </div>
    </div>`;
}

function _hypoInterpretation(d, type) {
  const p = d.p_value;
  const sig05 = p < 0.05;
  const sig01 = p < 0.01;

  if (type === 'ttest_1samp') {
    return sig05
      ? `The sample mean (${_fmtNum(d.mean)}) differs significantly from the hypothesized value μ₀ = ${d.mu0} (p = ${_fmtP(p)}). Sufficient evidence to reject H₀.`
      : `No significant difference between the sample mean (${_fmtNum(d.mean)}) and μ₀ = ${d.mu0} (p = ${_fmtP(p)}). Insufficient evidence to reject H₀.`;
  }
  if (type === 'ttest_2samp' || type === 'ttest_paired') {
    return sig05
      ? `The two groups have significantly different means (p = ${_fmtP(p)}). Sufficient evidence to reject H₀ of equal means.`
      : `No significant difference between the two group means (p = ${_fmtP(p)}). Insufficient evidence to reject H₀.`;
  }
  if (type === 'anova') {
    return sig05
      ? `At least one group mean differs significantly from the others (p = ${_fmtP(p)}). Consider post-hoc testing to identify which pairs differ.`
      : `No significant difference among the group means (p = ${_fmtP(p)}). Insufficient evidence to reject H₀.`;
  }
  if (type === 'chi2') {
    return sig05
      ? `The observed frequencies differ significantly from the expected uniform distribution (p = ${_fmtP(p)}).`
      : `The observed frequencies are consistent with the expected distribution (p = ${_fmtP(p)}).`;
  }
  if (type === 'ks') {
    return sig05
      ? `The two samples likely come from different distributions (p = ${_fmtP(p)}). D = ${_fmtNum(d.statistic)}.`
      : `No significant evidence that the two samples come from different distributions (p = ${_fmtP(p)}).`;
  }
  if (type === 'mannwhitney') {
    return sig05
      ? `The two distributions are significantly different (p = ${_fmtP(p)}). Non-parametric alternative to the t-test.`
      : `No significant difference between the two distributions (p = ${_fmtP(p)}).`;
  }
  return `p = ${_fmtP(p)}`;
}

// ═══ DATA PREPROCESSING ═══════════════════════════════════════════════════════

async function runPreprocess() {
  const el = document.getElementById('statsResult_preprocess');
  const v  = _chipVar(_prepSelected);
  if (!v) return _statsError(el, 'Select a numeric variable first.');

  const op       = document.getElementById('statsPrepOp')?.value || 'normalize';
  const method   = document.getElementById('statsPrepOutlierMethod')?.value || 'iqr';
  const strategy = document.getElementById('statsPrepFillStrategy')?.value  || 'mean';
  const testSize = (parseInt(document.getElementById('statsPrepTestSize')?.value) || 20) / 100;

  _statsLoading(el);
  try {
    const data = await _statsPost('preprocess', {
      data: v.listItems, op, method, strategy, test_size: testSize,
    });
    _renderPreprocessResult(el, data, op, v);
  } catch(e) { _statsError(el, e.message); }
}

function _renderPreprocessResult(el, data, op, v) {
  // Store state for save/update/download actions
  _lastPrepVar  = v;
  _lastPrepOp   = op;

  const varName  = v.name || `v${v.id}`;
  const opSuffix = { normalize: '_norm', standardize: '_std', remove_outliers: '_clean', fill_missing: '_filled' }[op] || '_processed';

  if (op === 'train_test_split') {
    _lastSplitData  = { train: data.train, test: data.test };
    _lastPrepResult = null;

    el.innerHTML = `
      <div class="stats-res-header">Train / Test Split — <span class="stats-varname">${varName}</span></div>
      <div class="stats-desc-layout" style="margin-top:12px">
        <div class="stats-table-card">
          <div class="stats-section-lbl">Split Summary</div>
          <div class="stats-row stats-row-hi"><span class="stats-lbl">Train size</span><span class="stats-val">${data.n_train} <span style="color:var(--muted);font-size:.67rem">(${(data.n_train/(data.n_train+data.n_test)*100).toFixed(1)}%)</span></span></div>
          <div class="stats-row stats-row-hi"><span class="stats-lbl">Test size</span><span class="stats-val">${data.n_test} <span style="color:var(--muted);font-size:.67rem">(${(data.n_test/(data.n_train+data.n_test)*100).toFixed(1)}%)</span></span></div>
          <div class="stats-row"><span class="stats-lbl">Total</span><span class="stats-val">${data.n_train + data.n_test}</span></div>
        </div>
        <div class="stats-table-card" style="flex:2">
          <div class="stats-section-lbl">Train statistics</div>
          ${_miniStats(data.train)}
          <div class="stats-divider"></div>
          <div class="stats-section-lbl" style="margin-top:8px">Test statistics</div>
          ${_miniStats(data.test)}
        </div>
      </div>
      <div class="prep-action-row">
        <button class="prep-action-btn prep-save-btn" id="prepSaveSplitBtn">+ Save as ${varName}_train &amp; ${varName}_test</button>
        <button class="prep-action-btn prep-dl-btn" id="prepDlSplitBtn">⬇ Download CSV</button>
      </div>
      <div id="prepActionMsg" class="prep-action-msg"></div>`;

    document.getElementById('prepSaveSplitBtn')?.addEventListener('click', () => {
      const base = _lastPrepVar.name || `v${_lastPrepVar.id}`;
      addVariable('list', { name: base + '_train', listItems: [..._lastSplitData.train], _isNumeric: true });
      addVariable('list', { name: base + '_test',  listItems: [..._lastSplitData.test],  _isNumeric: true });
      if (typeof refreshStatsVarSelectors === 'function') refreshStatsVarSelectors();
      _setPrepMsg(`Saved "${base}_train" (${_lastSplitData.train.length}) and "${base}_test" (${_lastSplitData.test.length}).`);
    });

    document.getElementById('prepDlSplitBtn')?.addEventListener('click', () => {
      const base = _lastPrepVar.name || `v${_lastPrepVar.id}`;
      const rows = [];
      const maxLen = Math.max(_lastSplitData.train.length, _lastSplitData.test.length);
      rows.push(`${base}_train,${base}_test`);
      for (let i = 0; i < maxLen; i++) {
        const t  = i < _lastSplitData.train.length ? _lastSplitData.train[i] : '';
        const te = i < _lastSplitData.test.length  ? _lastSplitData.test[i]  : '';
        rows.push(`${t},${te}`);
      }
      _triggerDownload(rows.join('\n'), `${base}_split.csv`, 'text/csv');
    });
    return;
  }

  // Regular transform — save result array
  const orig   = v.listItems;
  const result = data.result || [];
  const info   = data.info   || {};
  _lastPrepResult = result;
  _lastSplitData  = null;

  let infoRows = '';
  if (op === 'normalize') {
    infoRows = `<div class="stats-row"><span class="stats-lbl">Original range</span><span class="stats-val">[${_fmtNum(info.min)}, ${_fmtNum(info.max)}]</span></div>
      <div class="stats-row stats-row-hi"><span class="stats-lbl">New range</span><span class="stats-val">[0, 1]</span></div>`;
  } else if (op === 'standardize') {
    infoRows = `<div class="stats-row"><span class="stats-lbl">Original μ</span><span class="stats-val">${_fmtNum(info.mean)}</span></div>
      <div class="stats-row"><span class="stats-lbl">Original σ</span><span class="stats-val">${_fmtNum(info.std)}</span></div>
      <div class="stats-row stats-row-hi"><span class="stats-lbl">New μ / σ</span><span class="stats-val">0 / 1</span></div>`;
  } else if (op === 'remove_outliers') {
    infoRows = `<div class="stats-row"><span class="stats-lbl">Method</span><span class="stats-val">${info.method?.toUpperCase()}</span></div>
      <div class="stats-row"><span class="stats-lbl">Bounds</span><span class="stats-val">[${_fmtNum(info.lo)}, ${_fmtNum(info.hi)}]</span></div>
      <div class="stats-row stats-row-hi"><span class="stats-lbl">Removed</span><span class="stats-val" style="color:var(--acc3)">${info.removed}</span></div>
      <div class="stats-row stats-row-hi"><span class="stats-lbl">Kept</span><span class="stats-val">${info.kept}</span></div>`;
  } else if (op === 'fill_missing') {
    infoRows = `<div class="stats-row"><span class="stats-lbl">Strategy</span><span class="stats-val">${info.strategy}</span></div>
      <div class="stats-row"><span class="stats-lbl">Fill value</span><span class="stats-val">${_fmtNum(info.fill_value)}</span></div>
      <div class="stats-row stats-row-hi"><span class="stats-lbl">Values filled</span><span class="stats-val">${info.n_filled}</span></div>`;
  }

  const newName = varName + opSuffix;

  el.innerHTML = `
    <div class="stats-res-header">Preprocessing — <span class="stats-varname">${varName}</span>
      <span class="stats-type-badge" style="background:rgba(56,189,248,.12);color:#38bdf8;border:1px solid rgba(56,189,248,.3)">${op}</span>
    </div>
    <div class="stats-desc-layout" style="margin-top:12px">
      <div class="stats-table-card">
        <div class="stats-section-lbl">Operation Info</div>
        ${infoRows}
      </div>
      <div class="stats-table-card">
        <div class="stats-section-lbl">Before (${orig.length})</div>
        ${_miniStats(orig)}
      </div>
      <div class="stats-table-card">
        <div class="stats-section-lbl">After (${result.length})</div>
        ${_miniStats(result)}
      </div>
    </div>
    <div class="prep-preview-note">Preview — first 10 values:</div>
    <div class="prep-preview-vals">${result.slice(0, 10).map(x => `<span>${_fmtNum(x)}</span>`).join('')}${result.length > 10 ? `<span style="color:var(--muted)">… +${result.length - 10} more</span>` : ''}</div>
    <div class="prep-action-row">
      <button class="prep-action-btn prep-save-btn" id="prepSaveNewBtn">+ Save as "${newName}"</button>
      <button class="prep-action-btn prep-update-btn" id="prepUpdateBtn">↻ Update "${varName}"</button>
      <button class="prep-action-btn prep-dl-btn" id="prepDlBtn">⬇ Download CSV</button>
    </div>
    <div id="prepActionMsg" class="prep-action-msg"></div>`;

  document.getElementById('prepSaveNewBtn')?.addEventListener('click', () => {
    const nm = (_lastPrepVar.name || `v${_lastPrepVar.id}`) + opSuffix;
    addVariable('list', { name: nm, listItems: [..._lastPrepResult], _isNumeric: true });
    if (typeof refreshStatsVarSelectors === 'function') refreshStatsVarSelectors();
    _setPrepMsg(`Saved as new variable "${nm}" (${_lastPrepResult.length} values).`);
    document.getElementById('prepSaveNewBtn').disabled = true;
  });

  document.getElementById('prepUpdateBtn')?.addEventListener('click', () => {
    const target = typeof variables !== 'undefined'
      ? variables.find(vv => vv.id === _lastPrepVar.id) : null;
    if (!target) return;
    if (typeof snapshotForUndo === 'function') snapshotForUndo();
    target.listItems = [..._lastPrepResult];
    target.listLength = _lastPrepResult.length;
    if (typeof renderVariables === 'function') renderVariables();
    if (typeof refreshStatsVarSelectors === 'function') refreshStatsVarSelectors();
    _setPrepMsg(`Variable "${target.name || `v${target.id}`}" updated in place (${_lastPrepResult.length} values).`);
    document.getElementById('prepUpdateBtn').disabled = true;
  });

  document.getElementById('prepDlBtn')?.addEventListener('click', () => {
    const nm = (_lastPrepVar.name || `v${_lastPrepVar.id}`) + opSuffix;
    const csv = nm + '\n' + _lastPrepResult.join('\n');
    _triggerDownload(csv, nm + '.csv', 'text/csv');
  });
}

function _miniStats(arr) {
  if (!arr || !arr.length) return '<div class="stats-row"><span class="stats-lbl">No data</span></div>';
  const fin = arr.filter(x => x !== null && isFinite(x));
  if (!fin.length) return '<div class="stats-row"><span class="stats-lbl">No finite values</span></div>';
  const mean = fin.reduce((a,b)=>a+b,0)/fin.length;
  const mn   = Math.min(...fin), mx = Math.max(...fin);
  const std  = Math.sqrt(fin.reduce((a,b)=>a+(b-mean)**2,0)/Math.max(fin.length-1,1));
  return `
    <div class="stats-row"><span class="stats-lbl">n</span><span class="stats-val">${fin.length}</span></div>
    <div class="stats-row stats-row-hi"><span class="stats-lbl">Mean</span><span class="stats-val">${_fmtNum(mean)}</span></div>
    <div class="stats-row"><span class="stats-lbl">Std Dev</span><span class="stats-val">${_fmtNum(std)}</span></div>
    <div class="stats-row"><span class="stats-lbl">Min / Max</span><span class="stats-val">${_fmtNum(mn)} / ${_fmtNum(mx)}</span></div>`;
}

// ═══ SHARED UTILITIES ════════════════════════════════════════════════════════

function _setPrepMsg(msg) {
  const el = document.getElementById('prepActionMsg');
  if (el) { el.textContent = msg; el.style.display = ''; }
}

function _triggerDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function _downloadAllCsv() {
  const allVars = _getListVars();
  const numVars = allVars.filter(v => !v._categorical);
  if (!numVars.length) return;
  const maxRows = Math.max(...numVars.map(v => v.listItems.length));
  const header  = numVars.map(v => (v.name || `v${v.id}`).replace(/,/g, '_')).join(',');
  const rows = [];
  for (let r = 0; r < maxRows; r++) {
    rows.push(numVars.map(v => r < v.listItems.length ? (v.listItems[r] ?? '') : '').join(','));
  }
  _triggerDownload(header + '\n' + rows.join('\n'), 'plotforge_data.csv', 'text/csv');
}

// ═══ REGRESSION ═══════════════════════════════════════════════════════════════

async function runRegression() {
  const el   = document.getElementById('statsResult_regression');
  const type = document.getElementById('statsRegrType')?.value || 'linear';

  const selectedXIds = Array.from(_regrXSelected);
  if (!selectedXIds.length) return _statsError(el, 'Select at least one feature variable (X).');
  if (!_regrYSelected)      return _statsError(el, 'Select a target variable (Y).');

  const allVars = typeof variables !== 'undefined' ? variables : [];
  const xVars   = selectedXIds.map(id => allVars.find(v => String(v.id) === id)).filter(Boolean);
  const yVar    = allVars.find(v => String(v.id) === _regrYSelected);
  if (!yVar) return _statsError(el, 'Target variable not found — please reselect.');

  if (xVars.some(v => v.id === yVar.id)) {
    return _statsError(el, 'Y (target) cannot also be an X (feature).');
  }

  const threshold = parseFloat(document.getElementById('statsRegrThresh')?.value) || 0.5;

  // Expand X variables (one-hot encode categoricals)
  const xExpanded = xVars.flatMap(v => _expandVar(v));
  const xNames    = xExpanded.map(c => c.name);

  _statsLoading(el);
  try {
    const data = await _statsPost('regression', {
      type,
      X: xExpanded.map(c => c.data),
      y: yVar.listItems,
      threshold,
    });
    _renderRegression(el, data, xNames, yVar.name || `v${yVar.id}`);
  } catch(e) { _statsError(el, e.message); }
}

function _renderRegression(el, data, xNames, yName) {
  if (data.type === 'linear')   _renderLinearRegression(el, data, xNames, yName);
  else                          _renderLogisticRegression(el, data, xNames, yName);
}

function _renderLinearRegression(el, data, xNames, yName) {
  const eqParts = xNames.map((n, i) => `${_fmtNum(data.coef[i])}·${n}`);
  const eqStr   = `${yName} = ${eqParts.join(' + ')} + ${_fmtNum(data.intercept)}`;
  const adjR2   = 1 - (1 - data.r2) * (data.n - 1) / Math.max(1, data.n - data.p - 1);

  const coefRows = xNames.map((n, i) => {
    const b   = data.coef[i];
    const se  = data.coef_se?.[i];
    const t   = data.t_stats?.[i];
    const p   = data.p_values?.[i];
    const sig = (p != null && p < 0.001) ? '★★★' : (p != null && p < 0.01) ? '★★' : (p != null && p < 0.05) ? '★' : '';
    return `<tr>
      <td class="data-td" style="text-align:left;color:var(--acc2);font-weight:600">${n}</td>
      <td class="data-td">${_fmtNum(b)}</td>
      <td class="data-td">${se != null ? _fmtNum(se) : '—'}</td>
      <td class="data-td">${t  != null ? _fmtNum(t)  : '—'}</td>
      <td class="data-td">${p  != null ? _fmtP(p)    : '—'} <span style="color:var(--acc);font-size:.75em">${sig}</span></td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="stats-res-header">Linear Regression — <span class="stats-varname">${yName}</span>
      <span class="stats-fit-r2">R² = ${data.r2.toFixed(5)}</span>
      <span class="stats-fit-rmse">RMSE = ${_fmtNum(data.rmse)}</span>
    </div>
    <div class="regr-eq-wrap"><span class="regr-eq">${eqStr}</span></div>
    <div class="stats-desc-layout" style="margin-top:12px">
      <div class="stats-table-card" style="flex:2;min-width:0">
        <div class="stats-section-lbl">Coefficients</div>
        <div class="data-table-wrap" style="max-height:200px">
          <table class="data-table">
            <thead><tr>
              <th class="data-th" style="text-align:left">Variable</th>
              <th class="data-th">Coef</th>
              <th class="data-th">Std Err</th>
              <th class="data-th">t-stat</th>
              <th class="data-th">p-value</th>
            </tr></thead>
            <tbody>
              <tr>
                <td class="data-td" style="text-align:left;color:var(--muted)">Intercept</td>
                <td class="data-td">${_fmtNum(data.intercept)}</td>
                <td class="data-td">—</td><td class="data-td">—</td><td class="data-td">—</td>
              </tr>
              ${coefRows}
            </tbody>
          </table>
        </div>
      </div>
      <div class="stats-table-card" style="min-width:180px">
        <div class="stats-section-lbl">Model Summary</div>
        <div class="stats-row stats-row-hi"><span class="stats-lbl">R²</span><span class="stats-val">${data.r2.toFixed(6)}</span></div>
        <div class="stats-row"><span class="stats-lbl">Adj. R²</span><span class="stats-val">${adjR2.toFixed(6)}</span></div>
        <div class="stats-row"><span class="stats-lbl">RMSE</span><span class="stats-val">${_fmtNum(data.rmse)}</span></div>
        <div class="stats-row"><span class="stats-lbl">n</span><span class="stats-val">${data.n}</span></div>
        <div class="stats-row"><span class="stats-lbl">Features (p)</span><span class="stats-val">${data.p}</span></div>
        <div class="stats-divider"></div>
        <div class="stats-section-lbl">Significance</div>
        <div class="stats-row"><span class="stats-lbl" style="color:var(--acc)">★ p &lt; 0.05</span></div>
        <div class="stats-row"><span class="stats-lbl" style="color:var(--acc)">★★ p &lt; 0.01</span></div>
        <div class="stats-row"><span class="stats-lbl" style="color:var(--acc)">★★★ p &lt; 0.001</span></div>
      </div>
    </div>
    <div class="stats-res-header" style="margin-top:20px">Actual vs Predicted</div>
    <div class="stats-chart-wrap stats-chart-small"><canvas id="statsCanvas_regrFit"></canvas></div>
    <div class="stats-res-header" style="margin-top:16px">Residuals</div>
    <div class="stats-chart-wrap stats-chart-small"><canvas id="statsCanvas_regrResid"></canvas></div>`;

  _destroyChart('regrFit'); _destroyChart('regrResid');

  const fitCtx = document.getElementById('statsCanvas_regrFit')?.getContext('2d');
  if (fitCtx) {
    const mn = Math.min(...data.y_pred, ...data.y_orig);
    const mx = Math.max(...data.y_pred, ...data.y_orig);
    _statsCharts['regrFit'] = new Chart(fitCtx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Actual vs Predicted',
            data: data.y_orig.map((y, i) => ({ x: data.y_pred[i], y })),
            backgroundColor: 'rgba(90,255,206,0.5)', borderColor: '#5affce', pointRadius: 3,
          },
          {
            label: 'Perfect fit',
            data: [{ x: mn, y: mn }, { x: mx, y: mx }],
            type: 'line', borderColor: 'rgba(212,255,90,0.45)', borderDash: [5, 3],
            borderWidth: 1.5, pointRadius: 0, fill: false,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, parsing: false,
        scales: {
          x: { ..._axisStyle(), title: { display: true, text: 'Predicted', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
          y: { ..._axisStyle(), title: { display: true, text: 'Actual',    color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
        },
        plugins: { legend: { labels: { color: '#c0c0e0', font: { family: 'IBM Plex Mono', size: 11 } } } },
      },
    });
  }

  const residCtx = document.getElementById('statsCanvas_regrResid')?.getContext('2d');
  if (residCtx) {
    const mn = Math.min(...data.y_pred), mx = Math.max(...data.y_pred);
    _statsCharts['regrResid'] = new Chart(residCtx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Residuals',
            data: data.y_pred.map((yp, i) => ({ x: yp, y: data.residuals[i] })),
            backgroundColor: 'rgba(255,111,170,0.5)', borderColor: '#ff6faa', pointRadius: 3,
          },
          {
            label: 'Zero',
            data: [{ x: mn, y: 0 }, { x: mx, y: 0 }],
            type: 'line', borderColor: 'rgba(255,255,255,0.2)', borderDash: [5, 5],
            borderWidth: 1, pointRadius: 0, fill: false,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, parsing: false,
        scales: {
          x: { ..._axisStyle(), title: { display: true, text: 'Predicted', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
          y: { ..._axisStyle(), title: { display: true, text: 'Residual',  color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }
}

function _renderLogisticRegression(el, data, xNames, yName) {
  const coefRows = xNames.map((n, i) => `<tr>
    <td class="data-td" style="text-align:left;color:var(--acc2);font-weight:600">${n}</td>
    <td class="data-td">${_fmtNum(data.coef[i])}</td>
    <td class="data-td">${_fmtNum(Math.exp(data.coef[i]))}</td>
  </tr>`).join('');

  const [[tn, fp], [fn, tp]] = data.confusion_matrix;
  const cls0 = _fmtNum(data.classes[0]);
  const cls1 = _fmtNum(data.classes[1]);

  el.innerHTML = `
    <div class="stats-res-header">Logistic Regression — <span class="stats-varname">${yName}</span>
      <span class="stats-fit-r2">Accuracy = ${(data.accuracy * 100).toFixed(2)}%</span>
      <span class="stats-fit-rmse">F1 = ${_fmtNum(data.f1)}</span>
    </div>
    <div class="stats-desc-layout" style="margin-top:12px">
      <div class="stats-table-card" style="flex:2;min-width:0">
        <div class="stats-section-lbl">Coefficients</div>
        <div class="data-table-wrap" style="max-height:200px">
          <table class="data-table">
            <thead><tr>
              <th class="data-th" style="text-align:left">Variable</th>
              <th class="data-th">Coef (log-odds)</th>
              <th class="data-th">Odds Ratio</th>
            </tr></thead>
            <tbody>
              <tr>
                <td class="data-td" style="text-align:left;color:var(--muted)">Intercept</td>
                <td class="data-td">${_fmtNum(data.intercept)}</td>
                <td class="data-td">${_fmtNum(Math.exp(data.intercept))}</td>
              </tr>
              ${coefRows}
            </tbody>
          </table>
        </div>
      </div>
      <div class="stats-table-card" style="min-width:180px">
        <div class="stats-section-lbl">Performance</div>
        <div class="stats-row stats-row-hi"><span class="stats-lbl">Accuracy</span><span class="stats-val">${(data.accuracy * 100).toFixed(2)}%</span></div>
        <div class="stats-row"><span class="stats-lbl">Precision</span><span class="stats-val">${_fmtNum(data.precision)}</span></div>
        <div class="stats-row"><span class="stats-lbl">Recall</span><span class="stats-val">${_fmtNum(data.recall)}</span></div>
        <div class="stats-row stats-row-hi"><span class="stats-lbl">F1 Score</span><span class="stats-val">${_fmtNum(data.f1)}</span></div>
        <div class="stats-divider"></div>
        <div class="stats-row"><span class="stats-lbl">n</span><span class="stats-val">${data.n}</span></div>
        <div class="stats-row"><span class="stats-lbl">Threshold</span><span class="stats-val">${data.threshold}</span></div>
      </div>
    </div>
    <div class="stats-res-header" style="margin-top:16px">Confusion Matrix
      <span style="font-size:.68rem;color:var(--muted);font-weight:400">&nbsp;·&nbsp;threshold = ${data.threshold}</span>
    </div>
    <div class="regr-confmat-wrap">
      <table class="regr-confmat">
        <thead>
          <tr><th></th><th class="regr-confmat-hdr">Pred: ${cls0}</th><th class="regr-confmat-hdr">Pred: ${cls1}</th></tr>
        </thead>
        <tbody>
          <tr>
            <th class="regr-confmat-row-hdr">Actual: ${cls0}</th>
            <td class="regr-confmat-cell regr-confmat-tn">${tn}<span class="regr-confmat-lbl">TN</span></td>
            <td class="regr-confmat-cell regr-confmat-fp">${fp}<span class="regr-confmat-lbl">FP</span></td>
          </tr>
          <tr>
            <th class="regr-confmat-row-hdr">Actual: ${cls1}</th>
            <td class="regr-confmat-cell regr-confmat-fn">${fn}<span class="regr-confmat-lbl">FN</span></td>
            <td class="regr-confmat-cell regr-confmat-tp">${tp}<span class="regr-confmat-lbl">TP</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="stats-res-header" style="margin-top:16px">Predicted Probability Distribution</div>
    <div class="stats-chart-wrap stats-chart-small"><canvas id="statsCanvas_logit"></canvas></div>`;

  _destroyChart('logit');
  const ctx = document.getElementById('statsCanvas_logit')?.getContext('2d');
  if (ctx) {
    const mkHist = (arr, bins = 20) => {
      if (!arr.length) return { centers: [], counts: [] };
      const step = 1 / bins;
      const counts = Array(bins).fill(0);
      arr.forEach(x => { const b = Math.min(Math.floor(x / step), bins - 1); counts[b]++; });
      return { centers: Array.from({ length: bins }, (_, i) => (i + 0.5) * step), counts };
    };
    const neg = data.y_proba.filter((_, i) => data.y_orig[i] === 0);
    const pos = data.y_proba.filter((_, i) => data.y_orig[i] === 1);
    const negH = mkHist(neg), posH = mkHist(pos);
    _statsCharts['logit'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: negH.centers.map(c => c.toFixed(2)),
        datasets: [
          { label: `Class ${cls0}`, data: negH.counts, backgroundColor: 'rgba(255,111,170,0.45)', borderColor: '#ff6faa', borderWidth: 1 },
          { label: `Class ${cls1}`, data: posH.counts, backgroundColor: 'rgba(90,255,206,0.45)', borderColor: '#5affce', borderWidth: 1 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ..._axisStyle(), title: { display: true, text: 'Predicted probability', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
          y: { ..._axisStyle(), title: { display: true, text: 'Count', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
        },
        plugins: { legend: { labels: { color: '#c0c0e0', font: { family: 'IBM Plex Mono', size: 11 } } } },
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ML MODELS TAB
// ═══════════════════════════════════════════════════════════════════════════════

async function runML() {
  const model = document.getElementById('statsMLModel')?.value;
  if (!model) return;

  const allVars    = _getListVars();
  const numVars    = allVars.filter(v => !v._categorical);
  const supervised = !['kmeans', 'pca'].includes(model);

  const xIds = Array.from(_mlXSelected);
  if (!xIds.length) { alert('Select at least one feature (X).'); return; }

  // Look up selected X vars from ALL vars (numeric + categorical)
  const xVars = xIds.map(id => allVars.find(v => String(v.id) === id)).filter(Boolean);
  if (!xVars.length) return;

  // Expand / one-hot encode X
  const xExpanded = xVars.flatMap(v => _expandVar(v));
  const xNames    = xExpanded.map(c => c.name);

  let yVar  = null;
  let yName = null;
  if (supervised) {
    if (!_mlYSelected) { alert('Select a target variable (Y).'); return; }
    yVar  = numVars.find(v => String(v.id) === _mlYSelected);
    if (!yVar) return;
    yName = yVar.name || `v${yVar.id}`;
  }

  const out = document.getElementById('statsResult_ml');
  const prog = _startMLProgress(model, xExpanded[0]?.data?.length || 100,
    xExpanded.length, parseInt(document.getElementById('statsMLNEstim')?.value) || 100,
    parseInt(document.getElementById('statsMLCV')?.value) || 5);

  const payload = {
    model,
    task:         document.getElementById('statsMLTask')?.value || 'classification',
    n_estimators: parseInt(document.getElementById('statsMLNEstim')?.value)    || 100,
    max_depth:    parseInt(document.getElementById('statsMLMaxDepth')?.value)  || null,
    n_neighbors:  parseInt(document.getElementById('statsMLKNeigh')?.value)    || 5,
    n_clusters:   parseInt(document.getElementById('statsMLNClusters')?.value) || 3,
    n_components: parseInt(document.getElementById('statsMLNComp')?.value)     || 2,
    cv_folds:     parseInt(document.getElementById('statsMLCV')?.value)        || 5,
    X:       xExpanded.map(c => c.data),
    y:       yVar ? yVar.listItems : null,
    x_names: xNames,
    y_name:  yName,
  };

  try {
    const data = await _statsPost('ml', payload);
    prog.cancel();
    _finishMLProgress(out);
    await new Promise(r => setTimeout(r, 150)); // brief flash of 100%
    if (out) { out.innerHTML = ''; _renderMLResult(out, data, payload); }
  } catch (e) {
    prog.cancel();
    _statsError(out, e.message);
  }
}

// ── ML progress bar helpers ───────────────────────────────────────────────────

function _startMLProgress(model, n, p, nEstimators, cvFolds) {
  // Rough ms-per-obs estimates calibrated for sklearn default settings
  const msPerObs = { random_forest: 0.6, gradient_boosting: 1.2, decision_tree: 0.08,
                     knn: 0.04, svm: 1.8, kmeans: 0.25, pca: 0.06 };
  const rate = msPerObs[model] || 0.5;
  // For ensemble models, cost scales with n_estimators and CV folds
  const ensembleMult = ['random_forest','gradient_boosting'].includes(model) ? (nEstimators / 100) * cvFolds : cvFolds;
  const estMs = Math.min(Math.max(rate * n * ensembleMult, 400), 120000);

  const out = document.getElementById('statsResult_ml');
  if (out) out.innerHTML = `
    <div class="ml-progress-wrap">
      <div class="ml-progress-label">Training <span class="ml-progress-model">${_mlModelLabel(model)}</span>…</div>
      <div class="ml-progress-bar-track"><div class="ml-progress-bar" id="mlProgressBar"></div></div>
      <div class="ml-progress-detail">
        <span class="ml-progress-pct" id="mlProgressPct">0%</span>
        <span class="ml-progress-eta" id="mlProgressEta">Estimating…</span>
      </div>
    </div>`;

  const startTime = Date.now();
  let rafId = null;

  function tick() {
    const elapsed = Date.now() - startTime;
    // Asymptotic fill: reaches 90% at ~estMs, never hits 100% until done
    const pct = 90 * (1 - Math.exp(-3 * elapsed / estMs));
    const bar  = document.getElementById('mlProgressBar');
    const pctEl = document.getElementById('mlProgressPct');
    const etaEl = document.getElementById('mlProgressEta');
    if (bar)   bar.style.width = pct.toFixed(1) + '%';
    if (pctEl) pctEl.textContent = Math.round(pct) + '%';
    if (etaEl) {
      const remaining = Math.max(0, estMs - elapsed);
      etaEl.textContent = elapsed < 600 ? 'Estimating…'
        : remaining < 1000 ? 'Almost done…'
        : `~${(remaining / 1000).toFixed(1)}s remaining`;
    }
    if (pct < 89.5) rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
  return { cancel: () => { if (rafId) cancelAnimationFrame(rafId); rafId = null; } };
}

function _finishMLProgress(out) {
  const bar   = document.getElementById('mlProgressBar');
  const pctEl = document.getElementById('mlProgressPct');
  const etaEl = document.getElementById('mlProgressEta');
  if (bar)   { bar.style.transition = 'width 0.15s ease-out'; bar.style.width = '100%'; }
  if (pctEl) pctEl.textContent = '100%';
  if (etaEl) etaEl.textContent = 'Done';
}

function _renderMLResult(el, data, payload) {
  const xNames = payload.x_names || [];
  const yName  = payload.y_name  || '';
  if (data.model === 'kmeans')  { _renderKMeans(el, data, xNames); return; }
  if (data.model === 'pca')     { _renderPCA(el, data, xNames); return; }
  if (payload.task === 'classification') { _renderMLClassification(el, data, xNames, yName); }
  else                                   { _renderMLRegression(el, data, xNames, yName); }
}

// ── Classification results ────────────────────────────────────────────────────

function _renderMLClassification(el, data, xNames, yName) {
  const modelLabel = _mlModelLabel(data.model || '');
  const cls0 = data.classes ? String(data.classes[0]) : '0';
  const cls1 = data.classes ? String(data.classes[1]) : '1';
  const cm = data.confusion_matrix || [[0,0],[0,0]];
  const [[tn, fp], [fn, tp]] = cm;
  const fi = data.feature_importance || [];
  const cv = data.cv_scores || [];
  const roc = data.roc || null;
  // Compute precision / recall / F1 from confusion matrix
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall    = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1        = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

  const fiRows = fi.map((imp, i) => `<tr>
    <td class="data-td" style="text-align:left;color:var(--acc2)">${xNames[i] || `f${i}`}</td>
    <td class="data-td">${_fmtNum(imp)}</td>
    <td class="data-td" style="padding:0 4px"><div class="ml-fi-bar" style="width:${Math.round(imp * 100)}%"></div></td>
  </tr>`).join('');

  el.innerHTML = `
    <div class="stats-res-header">${modelLabel} — <span class="stats-varname">${yName}</span>
      <span class="stats-fit-r2">Accuracy = ${(data.accuracy * 100).toFixed(2)}%</span>
    </div>
    <div class="stats-desc-layout" style="margin-top:12px">
      <div class="stats-table-card">
        <div class="stats-section-lbl">Performance</div>
        <div class="stats-row stats-row-hi"><span class="stats-lbl">Accuracy</span><span class="stats-val">${(data.accuracy * 100).toFixed(2)}%</span></div>
        <div class="stats-row"><span class="stats-lbl">Precision</span><span class="stats-val">${_fmtNum(precision)}</span></div>
        <div class="stats-row"><span class="stats-lbl">Recall</span><span class="stats-val">${_fmtNum(recall)}</span></div>
        <div class="stats-row stats-row-hi"><span class="stats-lbl">F1 Score</span><span class="stats-val">${_fmtNum(f1)}</span></div>
        <div class="stats-divider"></div>
        ${cv.length ? `<div class="stats-row"><span class="stats-lbl">CV Mean</span><span class="stats-val">${_fmtNum(cv.reduce((a,b)=>a+b)/cv.length)}</span></div>
        <div class="stats-section-lbl" style="margin-top:8px">CV Fold Scores</div>
        <div class="ml-cv-chips">${cv.map((s,i)=>`<span class="ml-cv-chip">F${i+1}: ${_fmtNum(s)}</span>`).join('')}</div>` : ''}
      </div>
      ${fi.length ? `<div class="stats-table-card" style="flex:2;min-width:0">
        <div class="stats-section-lbl">Feature Importance</div>
        <div class="data-table-wrap" style="max-height:200px">
          <table class="data-table">
            <thead><tr><th class="data-th" style="text-align:left">Feature</th><th class="data-th">Importance</th><th class="data-th" style="min-width:80px"></th></tr></thead>
            <tbody>${fiRows}</tbody>
          </table>
        </div>
      </div>` : ''}
    </div>
    <div class="stats-res-header" style="margin-top:16px">Confusion Matrix</div>
    <div class="regr-confmat-wrap">
      <table class="regr-confmat">
        <thead><tr><th></th><th class="regr-confmat-hdr">Pred: ${cls0}</th><th class="regr-confmat-hdr">Pred: ${cls1}</th></tr></thead>
        <tbody>
          <tr><th class="regr-confmat-row-hdr">Actual: ${cls0}</th>
            <td class="regr-confmat-cell regr-confmat-tn">${tn}<span class="regr-confmat-lbl">TN</span></td>
            <td class="regr-confmat-cell regr-confmat-fp">${fp}<span class="regr-confmat-lbl">FP</span></td>
          </tr>
          <tr><th class="regr-confmat-row-hdr">Actual: ${cls1}</th>
            <td class="regr-confmat-cell regr-confmat-fn">${fn}<span class="regr-confmat-lbl">FN</span></td>
            <td class="regr-confmat-cell regr-confmat-tp">${tp}<span class="regr-confmat-lbl">TP</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    ${roc ? `
    <div class="stats-desc-layout" style="margin-top:16px">
      <div style="flex:1;min-width:0">
        <div class="stats-res-header">ROC Curve <span class="stats-fit-r2">AUC = ${_fmtNum(roc.auc)}</span></div>
        <div class="stats-chart-wrap stats-chart-small"><canvas id="statsCanvas_mlRoc"></canvas></div>
      </div>
      <div style="flex:1;min-width:0">
        <div class="stats-res-header">Precision-Recall Curve <span class="stats-fit-r2">AP = ${_fmtNum(roc.pr_auc)}</span></div>
        <div class="stats-chart-wrap stats-chart-small"><canvas id="statsCanvas_mlPr"></canvas></div>
      </div>
    </div>` : ''}`;

  if (roc) {
    _destroyChart('mlRoc');
    const ctx = document.getElementById('statsCanvas_mlRoc')?.getContext('2d');
    if (ctx) {
      _statsCharts['mlRoc'] = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: [
          { label: 'ROC', data: roc.fpr.map((x,i) => ({ x, y: roc.tpr[i] })), showLine: true, borderColor: '#5affce', borderWidth: 2, pointRadius: 0, fill: false },
          { label: 'Random', data: [{ x:0, y:0 }, { x:1, y:1 }], showLine: true, borderColor: 'rgba(255,255,255,0.2)', borderDash: [5,5], borderWidth: 1, pointRadius: 0, fill: false },
        ]},
        options: {
          responsive: true, maintainAspectRatio: false, parsing: false,
          scales: {
            x: { ..._axisStyle(), min: 0, max: 1, title: { display: true, text: 'FPR', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
            y: { ..._axisStyle(), min: 0, max: 1, title: { display: true, text: 'TPR', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
          },
          plugins: { legend: { display: false } },
        },
      });
    }
    _destroyChart('mlPr');
    const ctx2 = document.getElementById('statsCanvas_mlPr')?.getContext('2d');
    if (ctx2 && roc.precision) {
      _statsCharts['mlPr'] = new Chart(ctx2, {
        type: 'scatter',
        data: { datasets: [
          { label: 'PR', data: roc.recall.map((x,i) => ({ x, y: roc.precision[i] })), showLine: true, borderColor: '#ff6faa', borderWidth: 2, pointRadius: 0, fill: false },
        ]},
        options: {
          responsive: true, maintainAspectRatio: false, parsing: false,
          scales: {
            x: { ..._axisStyle(), min: 0, max: 1, title: { display: true, text: 'Recall', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
            y: { ..._axisStyle(), min: 0, max: 1, title: { display: true, text: 'Precision', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
          },
          plugins: { legend: { display: false } },
        },
      });
    }
  }
}

// ── Regression results ────────────────────────────────────────────────────────

function _renderMLRegression(el, data, xNames, yName) {
  const modelLabel = _mlModelLabel(data.model || '');
  const fi = data.feature_importance || [];
  const cv = data.cv_scores || [];
  const resid = data.residuals || [];

  const fiRows = fi.map((imp, i) => `<tr>
    <td class="data-td" style="text-align:left;color:var(--acc2)">${xNames[i] || `f${i}`}</td>
    <td class="data-td">${_fmtNum(imp)}</td>
    <td class="data-td" style="padding:0 4px"><div class="ml-fi-bar" style="width:${Math.round(imp * 100)}%"></div></td>
  </tr>`).join('');

  el.innerHTML = `
    <div class="stats-res-header">${modelLabel} — <span class="stats-varname">${yName}</span>
      <span class="stats-fit-r2">R\u00b2 = ${_fmtNum(data.r2)}</span>
      <span class="stats-fit-rmse">RMSE = ${_fmtNum(data.rmse)}</span>
    </div>
    <div class="stats-desc-layout" style="margin-top:12px">
      <div class="stats-table-card">
        <div class="stats-section-lbl">Performance</div>
        <div class="stats-row stats-row-hi"><span class="stats-lbl">R\u00b2</span><span class="stats-val">${_fmtNum(data.r2)}</span></div>
        <div class="stats-row stats-row-hi"><span class="stats-lbl">RMSE</span><span class="stats-val">${_fmtNum(data.rmse)}</span></div>
        <div class="stats-divider"></div>
        ${cv.length ? `<div class="stats-row"><span class="stats-lbl">CV Mean R\u00b2</span><span class="stats-val">${_fmtNum(cv.reduce((a,b)=>a+b)/cv.length)}</span></div>
        <div class="stats-section-lbl" style="margin-top:8px">CV Fold R\u00b2</div>
        <div class="ml-cv-chips">${cv.map((s,i)=>`<span class="ml-cv-chip">F${i+1}: ${_fmtNum(s)}</span>`).join('')}</div>` : ''}
      </div>
      ${fi.length ? `<div class="stats-table-card" style="flex:2;min-width:0">
        <div class="stats-section-lbl">Feature Importance</div>
        <div class="data-table-wrap" style="max-height:200px">
          <table class="data-table">
            <thead><tr><th class="data-th" style="text-align:left">Feature</th><th class="data-th">Importance</th><th class="data-th" style="min-width:80px"></th></tr></thead>
            <tbody>${fiRows}</tbody>
          </table>
        </div>
      </div>` : ''}
    </div>
    ${(data.y_pred && data.y_orig) ? `
    <div class="stats-desc-layout" style="margin-top:16px">
      <div style="flex:1;min-width:0">
        <div class="stats-res-header">Actual vs Predicted</div>
        <div class="stats-chart-wrap stats-chart-small"><canvas id="statsCanvas_mlAvP"></canvas></div>
      </div>
      <div style="flex:1;min-width:0">
        <div class="stats-res-header">Residuals</div>
        <div class="stats-chart-wrap stats-chart-small"><canvas id="statsCanvas_mlRes"></canvas></div>
      </div>
    </div>` : ''}`;

  if (data.y_pred && data.y_orig) {
    _destroyChart('mlAvP');
    const ctx = document.getElementById('statsCanvas_mlAvP')?.getContext('2d');
    if (ctx) {
      const mn = Math.min(...data.y_orig, ...data.y_pred);
      const mx = Math.max(...data.y_orig, ...data.y_pred);
      _statsCharts['mlAvP'] = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: [
          { label: 'Points', data: data.y_orig.map((y,i) => ({ x: y, y: data.y_pred[i] })), backgroundColor: 'rgba(90,255,206,0.5)', pointRadius: 3 },
          { label: 'Perfect', data: [{ x: mn, y: mn }, { x: mx, y: mx }], type: 'line', borderColor: 'rgba(255,255,255,0.25)', borderDash: [5,5], borderWidth: 1, pointRadius: 0, fill: false },
        ]},
        options: {
          responsive: true, maintainAspectRatio: false, parsing: false,
          scales: {
            x: { ..._axisStyle(), title: { display: true, text: 'Actual',    color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
            y: { ..._axisStyle(), title: { display: true, text: 'Predicted', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
          },
          plugins: { legend: { display: false } },
        },
      });
    }
    _destroyChart('mlRes');
    const ctx2 = document.getElementById('statsCanvas_mlRes')?.getContext('2d');
    if (ctx2 && resid.length) {
      _statsCharts['mlRes'] = new Chart(ctx2, {
        type: 'scatter',
        data: { datasets: [
          { label: 'Residual', data: data.y_pred.map((p,i) => ({ x: p, y: resid[i] })), backgroundColor: 'rgba(255,111,170,0.5)', pointRadius: 3 },
          { label: 'Zero', data: [{ x: Math.min(...data.y_pred), y: 0 }, { x: Math.max(...data.y_pred), y: 0 }], type: 'line', borderColor: 'rgba(255,255,255,0.2)', borderDash: [5,5], borderWidth: 1, pointRadius: 0, fill: false },
        ]},
        options: {
          responsive: true, maintainAspectRatio: false, parsing: false,
          scales: {
            x: { ..._axisStyle(), title: { display: true, text: 'Predicted', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
            y: { ..._axisStyle(), title: { display: true, text: 'Residual',  color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
          },
          plugins: { legend: { display: false } },
        },
      });
    }
  }
}

// ── K-Means results ───────────────────────────────────────────────────────────

function _renderKMeans(el, data, xNames) {
  // Backend field names: n_clusters, elbow_ks, elbow_inertias, scatter_2d, labels
  const scatter2d = data.scatter_2d || [];
  const hasScatter = scatter2d.length > 0;
  const clusterLabels = data.labels || [];
  const nClusters = data.n_clusters || data.k || 3;

  // Compute cluster sizes from labels array
  const clusterSizes = Array.from({ length: nClusters }, (_, c) => clusterLabels.filter(l => l === c).length);

  el.innerHTML = `
    <div class="stats-res-header">K-Means Clustering
      <span class="stats-fit-r2">k = ${nClusters}</span>
      <span class="stats-fit-rmse">Silhouette = ${_fmtNum(data.silhouette)}</span>
    </div>
    <div class="stats-desc-layout" style="margin-top:12px">
      <div class="stats-table-card">
        <div class="stats-section-lbl">Cluster Sizes</div>
        ${clusterSizes.map((sz, i) => `<div class="stats-row"><span class="stats-lbl">Cluster ${i}</span><span class="stats-val">${sz}</span></div>`).join('')}
        <div class="stats-divider"></div>
        <div class="stats-row"><span class="stats-lbl">Silhouette Score</span><span class="stats-val">${_fmtNum(data.silhouette)}</span></div>
      </div>
    </div>
    <div class="stats-desc-layout" style="margin-top:16px">
      <div style="flex:1;min-width:0">
        <div class="stats-res-header">Elbow Curve (Inertia)</div>
        <div class="stats-chart-wrap stats-chart-small"><canvas id="statsCanvas_kmElbow"></canvas></div>
      </div>
      ${hasScatter ? `<div style="flex:1;min-width:0">
        <div class="stats-res-header">Cluster Scatter (PCA 2D)</div>
        <div class="stats-chart-wrap stats-chart-small"><canvas id="statsCanvas_kmScatter"></canvas></div>
      </div>` : ''}
    </div>`;

  _destroyChart('kmElbow');
  const ctx = document.getElementById('statsCanvas_kmElbow')?.getContext('2d');
  if (ctx && data.elbow_ks) {
    _statsCharts['kmElbow'] = new Chart(ctx, {
      type: 'line',
      data: { labels: data.elbow_ks, datasets: [{ label: 'Inertia', data: data.elbow_inertias, borderColor: '#5affce', backgroundColor: 'rgba(90,255,206,0.15)', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#5affce', fill: true }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ..._axisStyle(), title: { display: true, text: 'k', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
          y: { ..._axisStyle(), title: { display: true, text: 'Inertia', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  if (hasScatter) {
    _destroyChart('kmScatter');
    const ctx2 = document.getElementById('statsCanvas_kmScatter')?.getContext('2d');
    if (ctx2) {
      const clusterColors = ['#5affce','#ff6faa','#ffd166','#a78bfa','#38bdf8','#fb923c','#4ade80','#e879f9','#f87171','#34d399'];
      const datasets = Array.from({ length: nClusters }, (_, c) => ({
        label: `Cluster ${c}`,
        data: scatter2d.map((pt, i) => clusterLabels[i] === c ? { x: pt[0], y: pt[1] } : null).filter(Boolean),
        backgroundColor: clusterColors[c % clusterColors.length] + '99',
        borderColor:     clusterColors[c % clusterColors.length],
        pointRadius: 4,
      }));
      _statsCharts['kmScatter'] = new Chart(ctx2, {
        type: 'scatter',
        data: { datasets },
        options: {
          responsive: true, maintainAspectRatio: false, parsing: false,
          scales: {
            x: { ..._axisStyle(), title: { display: true, text: 'PC1', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
            y: { ..._axisStyle(), title: { display: true, text: 'PC2', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
          },
          plugins: { legend: { labels: { color: '#c0c0e0', font: { family: 'IBM Plex Mono', size: 11 } } } },
        },
      });
    }
  }
}

// ── PCA results ───────────────────────────────────────────────────────────────

function _renderPCA(el, data, xNames) {
  // Backend: explained_variance_ratio is full (all components); cumulative_variance also full
  // scores is 2D array [n_obs × n_components]; loadings is [n_components × n_features]
  const cumVar = data.explained_variance_ratio || [];
  const cumSum = cumVar.reduce((acc, v, i) => { acc.push((acc[i-1] || 0) + v); return acc; }, []);
  const nComp  = Math.min(cumVar.length, data.n_components || cumVar.length);

  const loadings = data.loadings || [];
  const loadingRows = (xNames || []).map((name, fi) =>
    `<tr><td class="data-td" style="text-align:left;color:var(--acc2)">${name}</td>` +
    loadings.map(compRow => `<td class="data-td">${_fmtNum(compRow[fi])}</td>`).join('') +
    '</tr>'
  ).join('');

  // Extract PC1/PC2 from 2D scores array
  const scores = data.scores || [];
  const scoresX = scores.length >= 2 ? scores.map(row => row[0]) : null;
  const scoresY = scores.length >= 2 && (scores[0]?.length || 0) >= 2 ? scores.map(row => row[1]) : null;

  el.innerHTML = `
    <div class="stats-res-header">Principal Component Analysis
      <span class="stats-fit-r2">${nComp} components</span>
      <span class="stats-fit-rmse">Total var = ${_fmtNum((cumSum[nComp-1] || 0) * 100)}%</span>
    </div>
    <div class="stats-desc-layout" style="margin-top:12px">
      <div style="flex:1;min-width:0">
        <div class="stats-res-header">Scree Plot</div>
        <div class="stats-chart-wrap stats-chart-small"><canvas id="statsCanvas_pcaScree"></canvas></div>
      </div>
      <div style="flex:1;min-width:0">
        <div class="stats-res-header">Cumulative Variance</div>
        <div class="stats-chart-wrap stats-chart-small"><canvas id="statsCanvas_pcaCum"></canvas></div>
      </div>
    </div>
    <div class="stats-res-header" style="margin-top:16px">Component Loadings</div>
    <div class="data-table-wrap" style="max-height:220px;margin-top:8px">
      <table class="data-table">
        <thead><tr>
          <th class="data-th" style="text-align:left">Feature</th>
          ${loadings.map((_, i) => `<th class="data-th">PC${i+1}</th>`).join('')}
        </tr></thead>
        <tbody>${loadingRows}</tbody>
      </table>
    </div>
    ${(scoresX && scoresY) ? `
    <div class="stats-res-header" style="margin-top:16px">Score Plot (PC1 vs PC2)</div>
    <div class="stats-chart-wrap stats-chart-small"><canvas id="statsCanvas_pcaScore"></canvas></div>` : ''}`;

  const pcLabels = Array.from({ length: nComp }, (_, i) => `PC${i+1}`);

  _destroyChart('pcaScree');
  const ctxS = document.getElementById('statsCanvas_pcaScree')?.getContext('2d');
  if (ctxS) {
    _statsCharts['pcaScree'] = new Chart(ctxS, {
      type: 'bar',
      data: { labels: pcLabels, datasets: [{ label: 'Variance %', data: cumVar.map(v => v * 100), backgroundColor: 'rgba(90,255,206,0.5)', borderColor: '#5affce', borderWidth: 1 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ..._axisStyle() },
          y: { ..._axisStyle(), title: { display: true, text: 'Variance %', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  _destroyChart('pcaCum');
  const ctxC = document.getElementById('statsCanvas_pcaCum')?.getContext('2d');
  if (ctxC) {
    _statsCharts['pcaCum'] = new Chart(ctxC, {
      type: 'line',
      data: { labels: pcLabels, datasets: [{ label: 'Cumulative %', data: cumSum.map(v => v * 100), borderColor: '#ff6faa', backgroundColor: 'rgba(255,111,170,0.15)', borderWidth: 2, pointRadius: 3, fill: true }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ..._axisStyle() },
          y: { ..._axisStyle(), min: 0, max: 100, title: { display: true, text: 'Cumulative %', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  if (scoresX && scoresY) {
    _destroyChart('pcaScore');
    const ctxSc = document.getElementById('statsCanvas_pcaScore')?.getContext('2d');
    if (ctxSc) {
      _statsCharts['pcaScore'] = new Chart(ctxSc, {
        type: 'scatter',
        data: { datasets: [{ label: 'Scores', data: scoresX.map((x, i) => ({ x, y: scoresY[i] })), backgroundColor: 'rgba(167,139,250,0.5)', borderColor: '#a78bfa', pointRadius: 3 }] },
        options: {
          responsive: true, maintainAspectRatio: false, parsing: false,
          scales: {
            x: { ..._axisStyle(), title: { display: true, text: 'PC1', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
            y: { ..._axisStyle(), title: { display: true, text: 'PC2', color: '#9090c0', font: { family: 'IBM Plex Mono', size: 11 } } },
          },
          plugins: { legend: { display: false } },
        },
      });
    }
  }
}

function _mlModelLabel(model) {
  const labels = {
    decision_tree: 'Decision Tree', random_forest: 'Random Forest',
    gradient_boosting: 'Gradient Boosting', knn: 'K-Nearest Neighbors',
    svm: 'Support Vector Machine', kmeans: 'K-Means', pca: 'PCA',
  };
  return labels[model] || model;
}
