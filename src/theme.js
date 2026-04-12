// ═══ PLOT THEME DEFINITIONS ══════════════════════════════════════════════
// Each entry stores the full set of p.view fields that a theme controls.
// Users may further tweak any individual field from the cfg panel after applying.
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

// ═══ SITE THEME ══════════════════════════════════════════════════════════
// Controls the UI chrome via data-theme attribute on <html>.

function getSiteTheme(){
  return localStorage.getItem('pf-site-theme') || 'dark';
}

// Apply a site theme. When syncPlots is true (default), the matching plot
// theme is also applied to all existing plots.
function applySiteTheme(theme, syncPlots = true){
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('pf-site-theme', theme);

  // Keep the gear panel toggle in sync
  const toggle = document.getElementById('siteThemeToggle');
  if(toggle) toggle.checked = (theme === 'light');

  if(syncPlots && typeof plots !== 'undefined' && plots.length){
    _applyPlotThemeToViews(theme, null, true);
  }
}

// ═══ PLOT THEME ══════════════════════════════════════════════════════════
// Controls per-plot background, grid, axis, and label defaults.

function getPlotTheme(){
  return localStorage.getItem('pf-plot-theme') || 'dark';
}

// Apply a named plot theme to one plot (by pid) or all plots (pid = null).
// Writes the theme key to localStorage and refreshes the canvas/cfg if refreshUI is true.
function applyPlotTheme(theme, pid = null, refreshUI = true){
  localStorage.setItem('pf-plot-theme', theme);
  _applyPlotThemeToViews(theme, pid, refreshUI);
}

function _applyPlotThemeToViews(theme, pid, refreshUI){
  if(typeof plots === 'undefined') return;
  const def = PLOT_THEMES[theme] || PLOT_THEMES.dark;
  const targets = pid !== null ? plots.filter(p => p.id === pid) : plots;

  for(const p of targets){
    Object.assign(p.view, {
      bg_color:        def.bg_color,
      surface_color:   def.surface_color,
      chart_theme:     def.chart_theme,
      show_grid:       def.show_grid,
      grid_alpha:      def.grid_alpha,
      show_axis_lines: def.show_axis_lines,
      axis_alpha:      def.axis_alpha,
      show_legend:     def.show_legend,
      title_size:      def.title_size,
      label_size:      def.label_size,
      legend_size:     def.legend_size,
    });
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
    if(typeof refreshCfg     === 'function') refreshCfg();
    if(typeof snapshotForUndo === 'function') snapshotForUndo();
  }
}

// Return the view fields derived from the current plot theme.
// Used by defView() so every new plot starts with the correct theme.
function defViewThemeOverrides(){
  const t = PLOT_THEMES[getPlotTheme()] || PLOT_THEMES.dark;
  return {
    bg_color:        t.bg_color,
    surface_color:   t.surface_color,
    chart_theme:     t.chart_theme,
    show_grid:       t.show_grid,
    grid_alpha:      t.grid_alpha,
    show_axis_lines: t.show_axis_lines,
    axis_alpha:      t.axis_alpha,
    show_legend:     t.show_legend,
    title_size:      t.title_size,
    label_size:      t.label_size,
    legend_size:     t.legend_size,
  };
}

// ═══ INIT ════════════════════════════════════════════════════════════════
// Called once at the very start of boot(), before any DOM rendering.
// Restores site theme from localStorage. Plot theme is embedded in defView()
// so new plots automatically inherit it without a separate init step.
function initTheme(){
  applySiteTheme(getSiteTheme(), false); // false = don't sync plots — none exist yet
}
