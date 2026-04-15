// ═══ PLOT THEME DEFINITIONS ══════════════════════════════════════════════
const PLOT_THEMES = {
  dark: {
    bg_color:        '#12121c',
    surface_color:   '#12121c',
    chart_theme:     'dark',
    show_grid:       true,
    grid_alpha:      0.5,
    show_axis_lines: true,
    axis_alpha:      1.0,
    show_legend:     true,
    title_size:      13,
    label_size:      10,
    legend_size:     9,
  },
  light: {
    bg_color:        '#ffffff',
    surface_color:   '#f5f7fc',
    chart_theme:     'light',
    show_grid:       true,
    grid_alpha:      0.4,
    show_axis_lines: true,
    axis_alpha:      0.7,
    show_legend:     true,
    title_size:      13,
    label_size:      10,
    legend_size:     9,
  },
};

// ═══ PRESET SYSTEM ════════════════════════════════════════════════════════
const _BUILT_IN_PRESETS = [
  { id:'dark',  name:'Dark',  builtIn:true },
  { id:'light', name:'Light', builtIn:true },
];

let _userPresets = [];

function _loadUserPresets(){
  try{ _userPresets = JSON.parse(localStorage.getItem('pf-user-presets') || '[]'); }
  catch(e){ _userPresets = []; }
}

function _saveUserPresets(){
  localStorage.setItem('pf-user-presets', JSON.stringify(_userPresets));
}

function getAllPresets(){
  _loadUserPresets();
  return [..._BUILT_IN_PRESETS, ..._userPresets];
}

function getActivePresetId(){
  return localStorage.getItem('pf-active-preset') || 'dark';
}

function setActivePresetId(id){
  localStorage.setItem('pf-active-preset', id);
}

function _captureView(view){
  return {
    bg_color:        view.bg_color        ?? '#12121c',
    surface_color:   view.surface_color   ?? '#12121c',
    chart_theme:     view.chart_theme     ?? 'dark',
    show_grid:       view.show_grid       ?? true,
    grid_alpha:      view.grid_alpha      ?? 0.5,
    show_axis_lines: view.show_axis_lines ?? true,
    axis_alpha:      view.axis_alpha      ?? 1.0,
    show_legend:     view.show_legend     ?? true,
    title_size:      view.title_size      ?? 13,
    label_size:      view.label_size      ?? 10,
    legend_size:     view.legend_size     ?? 9,
    x_min:           view.x_min           ?? null,
    x_max:           view.x_max           ?? null,
    y_min:           view.y_min           ?? null,
    y_max:           view.y_max           ?? null,
    x_log:           view.x_log           ?? false,
    y_log:           view.y_log           ?? false,
    legend_x_frac:   view.legend_x_frac   ?? 0.98,
    legend_y_frac:   view.legend_y_frac   ?? 0.02,
  };
}

function createPreset(name, view){
  _loadUserPresets();
  const snap = _captureView(view);
  const preset = {
    id:    'preset_' + Date.now(),
    name:  name || ('Preset ' + (_userPresets.length + 1)),
    dark:  { ...snap },
    light: { ...snap },
  };
  _userPresets.push(preset);
  _saveUserPresets();
  return preset;
}

function deletePreset(id){
  _loadUserPresets();
  _userPresets = _userPresets.filter(p => p.id !== id);
  _saveUserPresets();
  if(getActivePresetId() === id) setActivePresetId('dark');
}

function renamePreset(id, name){
  _loadUserPresets();
  const p = _userPresets.find(p => p.id === id);
  if(p && name.trim()){ p.name = name.trim(); _saveUserPresets(); }
}

function applyPreset(id, pid = null, refreshUI = true){
  setActivePresetId(id);
  const allPresets = getAllPresets();
  const preset = allPresets.find(p => p.id === id);
  if(!preset) return;

  let fields;
  if(preset.builtIn){
    fields = PLOT_THEMES[id] || PLOT_THEMES.dark;
  } else {
    const siteTheme = getSiteTheme();
    fields = preset[siteTheme] || preset.dark || preset.light;
  }
  if(!fields) return;

  _applyViewFieldsToPlots(fields, pid, refreshUI);
}

function _applyViewFieldsToPlots(fields, pid, refreshUI){
  if(typeof plots === 'undefined') return;
  const targets = pid !== null ? plots.filter(p => p.id === pid) : plots;

  for(const p of targets){
    Object.assign(p.view, fields);
    if(refreshUI){
      if(typeof applyBgColorToCanvas === 'function') applyBgColorToCanvas(p.id);
      if(p.curves.some(c => c.jsData)){
        if(typeof renderJS === 'function') renderJS(p.id, false);
      } else if(typeof chartInstances !== 'undefined' && chartInstances[p.id]){
        if(typeof drawChart === 'function') drawChart(p);
      }
    }
  }

  if(refreshUI){
    if(typeof refreshCfg      === 'function') refreshCfg();
    if(typeof snapshotForUndo === 'function') snapshotForUndo();
  }
}

// Backward-compat shim
function applyPlotTheme(theme, pid = null, refreshUI = true){
  applyPreset(theme, pid, refreshUI);
}

// ═══ SITE THEME ══════════════════════════════════════════════════════════
function getSiteTheme(){
  return localStorage.getItem('pf-site-theme') || 'dark';
}

function applySiteTheme(theme, syncPlots = true){
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('pf-site-theme', theme);

  const toggle = document.getElementById('siteThemeToggle');
  if(toggle) toggle.checked = (theme === 'light');

  if(syncPlots && typeof plots !== 'undefined' && plots.length){
    applyPreset(getActivePresetId(), null, true);
  }
}

// Return view defaults for new plots from the active preset
function defViewThemeOverrides(){
  const activeId   = getActivePresetId();
  const allPresets = getAllPresets();
  const preset     = allPresets.find(p => p.id === activeId);

  if(!preset) return { ...PLOT_THEMES.dark };
  if(preset.builtIn) return { ...(PLOT_THEMES[preset.id] || PLOT_THEMES.dark) };

  const siteTheme = getSiteTheme();
  const variant   = preset[siteTheme] || preset.dark || preset.light;
  return variant ? { ...variant } : { ...PLOT_THEMES.dark };
}

// ═══ INIT ════════════════════════════════════════════════════════════════
function initTheme(){
  applySiteTheme(getSiteTheme(), false);
}
