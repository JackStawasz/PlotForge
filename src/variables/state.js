// ═══ VARIABLE STATE ══════════════════════════════════════════════════════
const variables = [];
let varIdCtr = 0;

function addVariable(kind='constant', opts={}){
  // Determine scope: explicit opt > caller-provided default > infer from active sidebar tab
  const scope = opts.scope != null ? opts.scope
    : (opts._defaultScope != null ? opts._defaultScope
      : ((typeof sbActiveTab !== 'undefined' && sbActiveTab === 'files'
          && typeof activeTabId !== 'undefined' && activeTabId != null)
          ? activeTabId : 'global'));
  const v = {
    id: ++varIdCtr, kind,
    name:      opts.name      || '',
    nameLatex: opts.nameLatex || '',
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
    pickleSource:  opts.pickleSource  || null,
    _isNumeric:    opts._isNumeric    || false,
    _categorical:  opts._categorical  || false,
    _labels:       opts._labels       ? [...opts._labels] : [],
    scope,
    folder:        opts.folder        ?? null,
    datasetCols:   opts.datasetCols
      ? opts.datasetCols.map(c => ({ name: c.name, values: [...c.values] }))
      : (kind === 'dataset'
          ? [{ name: 'col1', values: [null, null, null] }, { name: 'col2', values: [null, null, null] }]
          : undefined),
  };
  variables.push(v);
  renderVariables();
  if(!opts.silent){
    if(typeof snapshotForUndo === 'function') snapshotForUndo();
    // Focus the new variable's input field after DOM settles
    setTimeout(()=>{
      if(v.kind === 'list'){
        const mq = document.querySelector(`#vnamemq_${v.id} .mq-editable-field`);
        if(mq) mq.click();
      } else if(v.kind === 'dataset'){
        const inp = document.getElementById(`vdataname_${v.id}`);
        if(inp){ inp.focus(); inp.select(); }
      } else {
        const mq = document.querySelector(`#vmq_${v.id} .mq-editable-field`);
        if(mq) mq.click();
      }
    }, 80);
  }
  return v;
}

function removeVariable(id){
  const idx = variables.findIndex(x=>x.id===id);
  if(idx > -1) variables.splice(idx, 1);
  renderVariables();
  if(typeof snapshotForUndo === 'function') snapshotForUndo();
}

// Remove all variables that were imported from a given file.
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

// ═══ FOLDER STATE ════════════════════════════════════════════════════════
// Tracks which folder sections are collapsed. Key = "scopeId::folderName".
const _folderCollapsed = new Set();

// Tracks all ever-created folders so they persist when empty.
// Key = "scopeId::folderName". Cleared only on explicit × delete.
const _persistedFolders = new Set();

// Tracks the intended render order of folder groups per scope (both empty and non-empty).
// Key = scopeId (as string). Value = ordered string[] of folder names.
// Updated by folder-drag-end; new folders are appended automatically during render.
const _folderRenderOrder = new Map();

// ═══ TEMPLATE → VARIABLES SYNC ═══════════════════════════════════════════
// Called when a template is applied; syncs its parameters to the variables panel.
function syncTemplateParamsToVars(tplKey, params, overrideScope){
  if(!TEMPLATES || !TEMPLATES[tplKey]) return;
  const tpl        = TEMPLATES[tplKey];
  const tplParams  = tpl.params;
  const localScope = overrideScope ?? ((typeof activeTabId !== 'undefined' && activeTabId != null) ? activeTabId : 'global');
  const folderName = tpl.label;

  for(const [pk, pd] of Object.entries(tplParams)){
    const currentVal = params[pk] ?? pd.default;
    const existing   = variables.find(v=>v.fromTemplate && v.templateKey===tplKey && v.paramKey===pk && v.scope===localScope);
    if(existing){
      existing.value      = currentVal;
      existing.exprLatex  = String(currentVal);
      existing.fullLatex  = `${pk}=${currentVal}`;
      existing._isNumeric = true;
      existing.folder     = existing.folder ?? folderName;
      if(document.getElementById(`vpslider_${existing.id}`)) syncParamSlider(existing);
    } else {
      addVariable('constant', {
        name: pk, value: currentVal,
        exprLatex: String(currentVal), fullLatex: `${pk}=${currentVal}`,
        paramMin: pd.min, paramMax: pd.max,
        fromTemplate: true, templateKey: tplKey, paramKey: pk,
        silent: true, scope: localScope, folder: folderName,
      });
    }
  }

  // Add formula variable (equation kind) once per template+scope
  const existingFormula = variables.find(v=>v.fromTemplate && v.templateKey===tplKey && v.paramKey==='_formula' && v.scope===localScope);
  if(!existingFormula){
    const eqLatex = tpl.latexEq || tpl.equation;
    addVariable('equation', {
      name: 'f',
      exprLatex: eqLatex,
      fullLatex: eqLatex,
      fromTemplate: true, templateKey: tplKey, paramKey: '_formula',
      silent: true, scope: localScope, folder: folderName,
    });
  }
}

// ═══ PICKLE IMPORT ═══════════════════════════════════════════════════════
// Import variables from a parsed .pickle file (called by sidebars.js).
// Naming: single-char keys are used as-is; multi-char keys are wrapped in \text{}.
function importPickleVars(data, sourceName, scope='global'){
  const entries = Object.entries(data);
  // Auto-folder: when importing multiple variables, group them under the filename (no extension)
  const folderName = entries.length > 1 ? sourceName.replace(/\.[^.]+$/, '') : null;

  for(const [rawKey, info] of entries){
    const isSingleChar = rawKey.length === 1;
    const latexName    = isSingleChar ? rawKey : `\\text{${rawKey}}`;

    if(info.kind === 'constant'){
      const existing = variables.find(v=>v.name===rawKey && v.pickleSource===sourceName);
      if(existing){
        existing.exprLatex  = String(info.value);
        existing.fullLatex  = `${latexName}=${info.value}`;
        existing._isNumeric = true;
        existing.value      = info.value;
        existing.scope      = scope;
        if(folderName && !existing.folder) existing.folder = folderName;
        renderVariables();
      } else {
        addVariable('constant', {
          name: rawKey, value: info.value,
          exprLatex: String(info.value), fullLatex: `${latexName}=${info.value}`,
          pickleSource: sourceName, silent: true, scope, folder: folderName,
        });
      }
    } else if(info.kind === 'list'){
      const existing  = variables.find(v=>v.name===rawKey && v.pickleSource===sourceName);
      const items     = (info.items || []).map(Number);
      const isCat     = !!info._categorical;
      const labels    = info._labels ? [...info._labels] : [];
      if(existing){
        existing.listItems    = items;
        existing.listLength   = items.length;
        existing._categorical = isCat;
        existing._labels      = labels;
        existing.scope        = scope;
        if(folderName && !existing.folder) existing.folder = folderName;
        renderVariables();
      } else {
        addVariable('list', {
          name: rawKey, listItems: items, listLength: items.length,
          pickleSource: sourceName, silent: true, scope,
          _categorical: isCat, _labels: labels, folder: folderName,
        });
      }
    }
  }
  // Navigate to the pane that received the import
  if(scope === 'global') setSbTab('vars');
  else setSbTab('files');
  if (typeof refreshStatsVarSelectors === 'function') refreshStatsVarSelectors();
  if (typeof renderDataTable === 'function' && typeof _statsTab !== 'undefined' && _statsTab === 'data') renderDataTable();
}
