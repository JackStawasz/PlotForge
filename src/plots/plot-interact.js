// ═══ CHART INTERACTIONS ══════════════════════════════════════════════════
function wireInteraction(p){
  const wrap = document.getElementById(`cwrap_${p.id}`); if(!wrap) return;
  wrap.addEventListener('mousemove', e=>{
    const ch = chartInstances[p.id]; if(!ch) return;
    const {dataX,dataY} = pixelToData(ch, e.clientX, e.clientY);
    const _fc = v => isFinite(v) ? v.toPrecision(4) : '—';
    const txt = `x=${_fc(dataX)}&nbsp;y=${_fc(dataY)}`;
    const tcel = document.getElementById(`ctop_coords_${p.id}`);
    if(tcel){
      tcel.innerHTML = txt;
      tcel.style.transition = 'opacity 0.3s ease';
      tcel.style.opacity='1';
    }
    if(panState[p.id]?.dragging) onPanMove(e, p);
  });
  wrap.addEventListener('mouseenter', ()=>{
    const tcel = document.getElementById(`ctop_coords_${p.id}`);
    if(tcel){
      tcel.style.transition = 'opacity 0.3s ease';
      tcel.style.opacity='1';
    }
  });
  wrap.addEventListener('mouseleave', ()=>{
    const tcel = document.getElementById(`ctop_coords_${p.id}`);
    if(tcel){
      tcel.style.transition = 'opacity 0.8s ease';
      tcel.style.opacity='0';
    }
  });
  wrap.addEventListener('wheel', e=>{
    // Only zoom when this plot is the active (selected) one.
    // If it isn't, let the event bubble so the plot list scrolls normally.
    if(p.id !== activePid) return;
    if(p.view?.locked) return;
    e.preventDefault();
    const ch = chartInstances[p.id]; if(!ch) return;
    const {dataX, dataY} = pixelToData(ch, e.clientX, e.clientY);
    const factor = e.deltaY > 0 ? 1.15 : 1/1.15; // >1 zooms out
    const v = p.view;

    // Zoom each axis in its own space: log axes scale multiplicatively, linear additively.
    if(v.x_log){
      const la = Math.log(Math.max(dataX, MIN_LOG_VAL));
      v.x_min = Math.exp(la + (Math.log(Math.max(v.x_min, MIN_LOG_VAL)) - la) * factor);
      v.x_max = Math.exp(la + (Math.log(Math.max(v.x_max, MIN_LOG_VAL)) - la) * factor);
    } else {
      v.x_min = dataX + (v.x_min - dataX) * factor;
      v.x_max = dataX + (v.x_max - dataX) * factor;
    }

    if(v.y_log){
      const la = Math.log(Math.max(dataY, MIN_LOG_VAL));
      v.y_min = Math.exp(la + (Math.log(Math.max(v.y_min, MIN_LOG_VAL)) - la) * factor);
      v.y_max = Math.exp(la + (Math.log(Math.max(v.y_max, MIN_LOG_VAL)) - la) * factor);
    } else {
      v.y_min = dataY + (v.y_min - dataY) * factor;
      v.y_max = dataY + (v.y_max - dataY) * factor;
    }

    clampLogLimits(v);
    applyScaleLimits(ch.options.scales, v); ch.update('none'); syncCfgDomain(); renderJS(p.id, false);
  }, {passive:false});
  wrap.addEventListener('mousedown', e=>{
    if(e.button!==0) return;
    if(p.view?.locked) return;
    if(e.target.closest('.overlay-legend')) return;
    startPan(e, p);
  });
  window.addEventListener('mouseup', ()=>endPan(p));
}

function startPan(e, p){
  const wrap = document.getElementById(`cwrap_${p.id}`);
  panState[p.id] = {dragging:true, startX:e.clientX, startY:e.clientY};
  if(wrap) wrap.classList.add('panning'); e.preventDefault();
}

function onPanMove(e, p){
  const st = panState[p.id]; if(!st||!st.dragging) return;
  const ch = chartInstances[p.id]; if(!ch) return;
  const rect   = ch.canvas.getBoundingClientRect();
  const scaleX = rect.width/ch.canvas.width, scaleY = rect.height/ch.canvas.height;
  const dx=(e.clientX-st.startX)/scaleX, dy=(e.clientY-st.startY)/scaleY;
  st.startX=e.clientX; st.startY=e.clientY;
  const sx=ch.scales.x, sy=ch.scales.y, xPx=sx.right-sx.left, yPx=sy.bottom-sy.top;
  if(!xPx||!yPx) return;
  const v = p.view;

  // X-axis: log → shift by a ratio (uniform translation in log space);
  //         linear → shift by a linear delta.
  if(v.x_log){
    const logSpan = Math.log(v.x_max) - Math.log(v.x_min);
    const dLog = (dx / xPx) * logSpan; // positive dx → shift domain left
    v.x_min = Math.exp(Math.log(v.x_min) - dLog);
    v.x_max = Math.exp(Math.log(v.x_max) - dLog);
  } else {
    const dxD = (dx / xPx) * (v.x_max - v.x_min);
    v.x_min -= dxD;
    v.x_max -= dxD;
  }

  // Y-axis: positive dy (mouse down in pixels) → shift domain up (see higher y values).
  if(v.y_log){
    const logSpan = Math.log(v.y_max) - Math.log(v.y_min);
    const dLog = (dy / yPx) * logSpan; // positive dy → shift domain up
    v.y_min = Math.exp(Math.log(v.y_min) + dLog);
    v.y_max = Math.exp(Math.log(v.y_max) + dLog);
  } else {
    const dyD = (dy / yPx) * (v.y_max - v.y_min);
    v.y_min += dyD;
    v.y_max += dyD;
  }

  clampLogLimits(v);
  applyScaleLimits(ch.options.scales, v); ch.update('none'); syncCfgDomain(); renderJS(p.id, false);
}

function endPan(p){
  if(!panState[p.id]?.dragging) return;
  panState[p.id].dragging = false;
  const wrap = document.getElementById(`cwrap_${p.id}`); if(wrap) wrap.classList.remove('panning');
}
