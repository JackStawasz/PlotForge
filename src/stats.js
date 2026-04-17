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

// ═══ VIEW SWITCHING ══════════════════════════════════════════════════════════

function switchToView(view) {
  _currentView = view;
  document.querySelector('.shell')?.setAttribute('data-view', view);
  document.getElementById('hdrViewPlots')?.classList.toggle('hdr-view-active', view === 'plots');
  document.getElementById('hdrViewStats')?.classList.toggle('hdr-view-active', view === 'stats');
  if (view === 'stats') { refreshStatsVarSelectors(); if (_statsTab === 'data') renderDataTable(); }
}

// ═══ INIT ════════════════════════════════════════════════════════════════════

const _TABS = ['describe', 'histogram', 'fit', 'corr', 'hypo', 'preprocess', 'data'];

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
  const val   = document.getElementById('statsHistType')?.value || 'histogram';
  const isBox = val === 'boxplot';
  const show  = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('statsHistSingleRow', !isBox);
  show('statsBoxMultiRow',    isBox);
  show('statsHistBinsRow',    val === 'histogram');
  show('statsHistKdeRow',     val !== 'boxplot');
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

function _updatePrepControls() {
  const op = document.getElementById('statsPrepOp')?.value || 'normalize';
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('prepOutlierRow', op === 'remove_outliers');
  show('prepFillRow',    op === 'fill_missing');
  show('prepSplitRow',   op === 'train_test_split');
}

// ─── Variable selector refresh ────────────────────────────────────────────────

function refreshStatsVarSelectors() {
  const listVars   = _getListVars();
  const numVars    = listVars.filter(v => !v._categorical);
  const catVars    = listVars.filter(v =>  v._categorical);

  // Helpers
  const _fillSel = (id, vars, withCat) => {
    const sel = document.getElementById(id); if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">— select —</option>';
    vars.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v._categorical
        ? `${v.name || `v${v.id}`}  [cat · ${v._labels.length} levels]`
        : `${v.name || `v${v.id}`}  (n = ${v.listItems.length})`;
      if (String(v.id) === String(prev)) opt.selected = true;
      sel.appendChild(opt);
    });
  };

  const _fillMulti = (id, vars) => {
    const sel = document.getElementById(id); if (!sel) return;
    const prevVals = Array.from(sel.selectedOptions).map(o => o.value);
    sel.innerHTML = '';
    vars.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.name || `v${v.id}`}  (n = ${v.listItems.length})`;
      if (prevVals.includes(String(v.id))) opt.selected = true;
      sel.appendChild(opt);
    });
    if (!vars.length) {
      const ph = document.createElement('option'); ph.disabled = true;
      ph.textContent = 'No numeric variables yet'; sel.appendChild(ph);
    }
  };

  // Descriptive: all list vars
  const describeSel = document.getElementById('statsVar_describe');
  if (describeSel) {
    const prev = describeSel.value;
    describeSel.innerHTML = '<option value="">— select variable —</option>';
    listVars.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v._categorical
        ? `${v.name || `v${v.id}`}  [categorical · ${v._labels.length} levels]`
        : `${v.name || `v${v.id}`}  (n = ${v.listItems.length})`;
      if (String(v.id) === String(prev)) opt.selected = true;
      describeSel.appendChild(opt);
    });
  }

  // Histogram single: all list vars
  _fillSel('statsVar_histX', listVars);

  // Box plot multi: numeric only
  _fillMulti('statsVar_boxMulti', numVars);

  // Fit X/Y: numeric only
  ['statsVar_fitX', 'statsVar_fitY'].forEach(id => _fillSel(id, numVars));

  // Correlation multi: numeric only
  _fillMulti('statsVar_corrMulti', numVars);

  // Hypothesis
  const hypoType = document.getElementById('statsHypoType')?.value || 'ttest_1samp';
  refreshHypoSelectors(hypoType);

  // Preprocess: numeric only
  _fillSel('statsVar_preprocess', numVars);
}

function refreshHypoSelectors(type) {
  const isChi2  = type === 'chi2';
  const isAnova = type === 'anova';
  const listVars = _getListVars();
  const numVars  = listVars.filter(v => !v._categorical);
  const catVars  = listVars.filter(v =>  v._categorical);

  const _fillSel = (id, vars) => {
    const sel = document.getElementById(id); if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">— select —</option>';
    vars.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v._categorical
        ? `${v.name || `v${v.id}`}  [cat · ${v._labels.length} levels]`
        : `${v.name || `v${v.id}`}  (n = ${v.listItems.length})`;
      if (String(v.id) === String(prev)) opt.selected = true;
      sel.appendChild(opt);
    });
  };
  const _fillMulti = (id, vars) => {
    const sel = document.getElementById(id); if (!sel) return;
    const prevVals = Array.from(sel.selectedOptions).map(o => o.value);
    sel.innerHTML = '';
    vars.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.name || `v${v.id}`}  (n = ${v.listItems.length})`;
      if (prevVals.includes(String(v.id))) opt.selected = true;
      sel.appendChild(opt);
    });
  };

  _fillSel('statsVar_hypo1', isChi2 ? catVars : numVars);
  _fillSel('statsVar_hypo2', numVars);
  _fillMulti('statsVar_hypoAnova', numVars);
}

// ═══ HELPERS ═════════════════════════════════════════════════════════════════

function _getListVars() {
  if (typeof variables === 'undefined') return [];
  return variables.filter(v => v.kind === 'list' && Array.isArray(v.listItems) && v.listItems.length > 0);
}

function _getVar(selId) {
  const sel = document.getElementById(selId);
  if (!sel || !sel.value) return null;
  if (typeof variables === 'undefined') return null;
  return variables.find(v => String(v.id) === String(sel.value)) || null;
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
  const v  = _getVar('statsVar_describe');
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

  if (type === 'boxplot') {
    return _runBoxplot(el);
  }

  const v = _getVar('statsVar_histX');
  if (!v) return _statsError(el, 'Select a variable first.');

  if (v._categorical && v._labels && v._labels.length) {
    _renderCatFreqBar(el, v);
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

async function _runBoxplot(el) {
  const sel = document.getElementById('statsVar_boxMulti');
  if (!sel) return _statsError(el, 'No variable selector found.');
  const selectedIds = Array.from(sel.selectedOptions).map(o => o.value);
  if (!selectedIds.length) return _statsError(el, 'Select at least one variable (Ctrl/⌘+click for multiple).');

  const allVars = typeof variables !== 'undefined' ? variables : [];
  const payload = {};
  selectedIds.forEach(id => {
    const v = allVars.find(v => String(v.id) === id);
    if (v && !v._categorical) payload[v.name || `v${v.id}`] = v.listItems;
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
  const xVar = _getVar('statsVar_fitX');
  const yVar = _getVar('statsVar_fitY');
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
  const el      = document.getElementById('statsResult_corr');
  const corrSel = document.getElementById('statsVar_corrMulti');
  if (!corrSel) return;
  const selectedIds = Array.from(corrSel.selectedOptions).map(o => o.value);
  if (selectedIds.length < 2) return _statsError(el, 'Select at least 2 variables (Ctrl+click or Cmd+click).');

  const allVars = typeof variables !== 'undefined' ? variables : [];
  const payload = {};
  selectedIds.forEach(id => {
    const v = allVars.find(v => String(v.id) === id);
    if (v) payload[v.name || `v${v.id}`] = v.listItems;
  });

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
      const v = _getVar('statsVar_hypo1');
      if (!v) return _statsError(el, 'Select a variable.');
      payload.data = v.listItems;
      payload.mu0  = parseFloat(document.getElementById('statsHypoMu0')?.value) || 0;

    } else if (type === 'ttest_2samp' || type === 'ttest_paired' || type === 'ks' || type === 'mannwhitney') {
      const v1 = _getVar('statsVar_hypo1');
      const v2 = _getVar('statsVar_hypo2');
      if (!v1 || !v2) return _statsError(el, 'Select two variables.');
      payload.data1 = v1.listItems;
      payload.data2 = v2.listItems;

    } else if (type === 'anova') {
      const sel = document.getElementById('statsVar_hypoAnova');
      const ids = Array.from(sel?.selectedOptions || []).map(o => o.value);
      if (ids.length < 2) return _statsError(el, 'Select at least 2 groups (Ctrl+click).');
      const allVars = typeof variables !== 'undefined' ? variables : [];
      payload.groups = ids.map(id => {
        const v = allVars.find(v => String(v.id) === id);
        return v ? v.listItems : [];
      });

    } else if (type === 'chi2') {
      const v = _getVar('statsVar_hypo1');
      if (!v) return _statsError(el, 'Select a categorical variable.');
      if (!v._categorical) return _statsError(el, 'Chi-squared requires a categorical variable.');
      payload.observed = v.listItems; // frequency counts

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
  const v  = _getVar('statsVar_preprocess');
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
