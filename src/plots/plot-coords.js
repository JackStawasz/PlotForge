// ═══ COORDINATE TRANSFORMS ════════════════════════════════════════════════
// Pure utilities used by annotations and plot interaction. No DOM mutation
// beyond reads of `cwrap_${pid}` for CSS-vs-canvas pixel scale.

// Convert plot-data coords → canvas fraction for a given chart instance
function dataToFrac(ch, dataX, dataY){
  const sx=ch.scales.x, sy=ch.scales.y;
  const cw=ch.canvas.width, ch_=ch.canvas.height;
  const pxX = sx.left + (dataX - sx.min) / (sx.max - sx.min) * (sx.right - sx.left);
  const pxY = sy.top  + (1 - (dataY - sy.min) / (sy.max - sy.min)) * (sy.bottom - sy.top);
  return { x: pxX/cw, y: pxY/ch_ };
}

// Convert a size in plot-data units (x-axis) → CSS pixels for a given plot
function _plotSizeToPx(pid, plotSize){
  const ch = chartInstances[pid]; if(!ch) return plotSize;
  const wrap = document.getElementById(`cwrap_${pid}`); if(!wrap) return plotSize;
  const sx = ch.scales.x;
  const dataRange = sx.max - sx.min; if(!dataRange) return plotSize;
  const canvasPx = sx.right - sx.left; if(!canvasPx) return plotSize;
  const cssScale = wrap.offsetWidth / ch.canvas.width;
  if(!cssScale || !isFinite(cssScale)) return plotSize;
  return plotSize * canvasPx * cssScale / dataRange;
}

// Convert CSS pixels → plot-data units (x-axis) for a given plot
function _pxToPlotSize(pid, cssPx){
  const ch = chartInstances[pid]; if(!ch) return cssPx;
  const wrap = document.getElementById(`cwrap_${pid}`); if(!wrap) return cssPx;
  const sx = ch.scales.x;
  const canvasPx = sx.right - sx.left; if(!canvasPx) return cssPx;
  const cssScale = wrap.offsetWidth / ch.canvas.width;
  return cssPx / (canvasPx * cssScale) * (sx.max - sx.min);
}

// Convert canvas fraction → plot-data coords
function fracToData(ch, fracX, fracY){
  const sx=ch.scales.x, sy=ch.scales.y;
  const cw=ch.canvas.width, ch_=ch.canvas.height;
  const pxX = fracX*cw, pxY = fracY*ch_;
  const dataX = sx.min + (pxX - sx.left)/(sx.right - sx.left) * (sx.max-sx.min);
  const dataY = sy.min + (1 - (pxY - sy.top)/(sy.bottom - sy.top)) * (sy.max-sy.min);
  return { dataX, dataY };
}

// Use Chart.js's built-in getValueForPixel so both linear and log axes
// invert correctly — no manual interpolation needed.
function pixelToData(ch, clientX, clientY){
  const canvas=ch.canvas, rect=canvas.getBoundingClientRect();
  const scaleX=rect.width/canvas.width, scaleY=rect.height/canvas.height;
  const px=(clientX-rect.left)/scaleX, py=(clientY-rect.top)/scaleY;
  return {
    dataX: ch.scales.x.getValueForPixel(px),
    dataY: ch.scales.y.getValueForPixel(py),
  };
}
