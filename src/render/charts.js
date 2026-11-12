// Gráficos: curva do dinamômetro (torque × potência) e telemetria rolando ao vivo.
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(r.width * dpr) || canvas.height !== Math.round(r.height * dpr)) {
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W: r.width, H: r.height };
}

const niceStep = (range, n) => {
  const raw = range / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
};

export class DynoChart {
  constructor(canvas) { this.canvas = canvas; this.curve = null; this.ghost = null; this.live = null; this.sweep = null; }

  draw() {
    const { ctx, W, H } = fitCanvas(this.canvas);
    const fg = css('--fg') || '#ddd', muted = css('--muted') || '#888', grid = css('--grid') || '#333';
    const cT = css('--torque') || '#ff8c42', cP = css('--power') || '#4dabf7', cB = css('--boost') || '#69db7c';
    ctx.clearRect(0, 0, W, H);
    const pad = { l: 52, r: 56, t: 30, b: 34 };
    const all = [this.curve, this.ghost, this.sweep].filter(Boolean).flat();
    if (!all.length) return;
    const maxRpm = Math.max(...all.map((p) => p.rpm)) + 200;
    const maxT = Math.max(50, ...all.map((p) => p.torque)) * 1.15;
    const maxP = Math.max(30, ...all.map((p) => p.power / 735.5)) * 1.15;
    const X = (rpm) => pad.l + (W - pad.l - pad.r) * rpm / maxRpm;
    const YT = (t) => H - pad.b - (H - pad.t - pad.b) * Math.max(0, t) / maxT;
    const YP = (p) => H - pad.b - (H - pad.t - pad.b) * Math.max(0, p) / maxP;

    ctx.font = '11px system-ui, sans-serif'; ctx.lineWidth = 1;
    const sR = niceStep(maxRpm, 8);
    ctx.strokeStyle = grid; ctx.fillStyle = muted; ctx.textAlign = 'center';
    for (let r = 0; r <= maxRpm; r += sR) { ctx.beginPath(); ctx.moveTo(X(r), pad.t); ctx.lineTo(X(r), H - pad.b); ctx.stroke(); ctx.fillText(r, X(r), H - pad.b + 16); }
    ctx.fillText('rpm', W / 2, H - 4);
    const sT = niceStep(maxT, 6);
    ctx.textAlign = 'right';
    for (let t = 0; t <= maxT; t += sT) { ctx.beginPath(); ctx.moveTo(pad.l, YT(t)); ctx.lineTo(W - pad.r, YT(t)); ctx.stroke(); ctx.fillStyle = cT; ctx.fillText(t, pad.l - 6, YT(t) + 4); }
    const sP = niceStep(maxP, 6);
    ctx.textAlign = 'left';
    for (let p = 0; p <= maxP; p += sP) { ctx.fillStyle = cP; ctx.fillText(p, W - pad.r + 6, YP(p) + 4); }
    ctx.save(); ctx.fillStyle = cT; ctx.translate(14, H / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText('Torque (N·m)', 0, 0); ctx.restore();
    ctx.save(); ctx.fillStyle = cP; ctx.translate(W - 12, H / 2); ctx.rotate(Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText('Potência (cv)', 0, 0); ctx.restore();

    const line = (pts, f, color, width, dash = []) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(X(p.rpm), f(p)) : ctx.moveTo(X(p.rpm), f(p))));
      ctx.stroke(); ctx.setLineDash([]);
    };
    if (this.ghost) {
      ctx.globalAlpha = 0.45;
      line(this.ghost, (p) => YT(p.torque), cT, 1.5, [5, 4]);
      line(this.ghost, (p) => YP(p.power / 735.5), cP, 1.5, [5, 4]);
      ctx.globalAlpha = 1;
    }
    if (this.curve) {
      // faixa de boost (escala própria, embaixo)
      const maxB = Math.max(...this.curve.map((p) => p.boost || 0));
      if (maxB > 0.05) {
        const YB = (b) => H - pad.b - (H - pad.t - pad.b) * 0.3 * b / maxB;
        line(this.curve, (p) => YB(p.boost), cB, 1.5, [2, 3]);
        ctx.fillStyle = cB; ctx.textAlign = 'left'; ctx.fillText(`boost (máx ${maxB.toFixed(2)} bar)`, pad.l + 6, YB(maxB) - 6);
      }
      // faixa do VTEC
      const v = this.curve.find((p) => p.vtec);
      if (v) { ctx.fillStyle = 'rgba(250,176,5,0.08)'; ctx.fillRect(X(v.rpm), pad.t, X(maxRpm) - X(v.rpm), H - pad.t - pad.b); ctx.fillStyle = '#fab005'; ctx.fillText('VTEC', X(v.rpm) + 4, pad.t + 12); }
      line(this.curve, (p) => YT(p.torque), cT, 2.5);
      line(this.curve, (p) => YP(p.power / 735.5), cP, 2.5);
      let pt = this.curve[0], pp = this.curve[0];
      for (const p of this.curve) { if (p.torque > pt.torque) pt = p; if (p.power > pp.power) pp = p; }
      const dot = (x, y, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); };
      dot(X(pt.rpm), YT(pt.torque), cT); dot(X(pp.rpm), YP(pp.power / 735.5), cP);
      ctx.font = '600 12px system-ui'; ctx.textAlign = 'left';
      ctx.fillStyle = cT; ctx.fillText(`${pt.torque.toFixed(0)} N·m (${(pt.torque / 9.80665).toFixed(1)} kgfm) @ ${pt.rpm}`, pad.l + 8, pad.t - 10);
      ctx.fillStyle = cP; ctx.textAlign = 'right'; ctx.fillText(`${(pp.power / 735.5).toFixed(0)} cv (${(pp.power / 1000).toFixed(0)} kW) @ ${pp.rpm}`, W - pad.r - 8, pad.t - 10);
    }
    if (this.sweep && this.sweep.length > 1) {
      line(this.sweep, (p) => YT(p.torque), '#fff', 1.5);
      line(this.sweep, (p) => YP(p.power / 735.5), '#fff', 1.5);
    }
    if (this.live) {
      const { rpm, torque, power } = this.live;
      ctx.strokeStyle = fg; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(X(rpm), pad.t); ctx.lineTo(X(rpm), H - pad.b); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = cT; ctx.beginPath(); ctx.arc(X(rpm), YT(torque), 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = cP; ctx.beginPath(); ctx.arc(X(rpm), YP(power / 735.5), 5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// Telemetria rolando: várias faixas empilhadas, cada uma com sua escala
export class StripChart {
  constructor(canvas, series, length = 600) {
    this.canvas = canvas; this.series = series; this.length = length;
    this.data = series.map(() => new Float32Array(length)); this.pos = 0; this.count = 0;
  }
  push(values) {
    values.forEach((v, i) => { this.data[i][this.pos] = Number.isFinite(v) ? v : NaN; });
    this.pos = (this.pos + 1) % this.length; this.count = Math.min(this.length, this.count + 1);
  }
  draw() {
    const { ctx, W, H } = fitCanvas(this.canvas);
    ctx.clearRect(0, 0, W, H);
    const n = this.series.length, lane = H / n;
    const muted = css('--muted') || '#888', grid = css('--grid') || '#333';
    ctx.font = '11px system-ui, sans-serif';
    this.series.forEach((s, i) => {
      const y0 = i * lane, d = this.data[i];
      let lo = s.min ?? Infinity, hi = s.max ?? -Infinity;
      if (s.min == null || s.max == null) for (let k = 0; k < this.count; k++) { const v = d[k]; if (Number.isFinite(v)) { if (s.min == null) lo = Math.min(lo, v); if (s.max == null) hi = Math.max(hi, v); } }
      if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
      if (hi - lo < (s.minRange || 1e-6)) hi = lo + (s.minRange || 1);
      ctx.strokeStyle = grid; ctx.beginPath(); ctx.moveTo(0, y0 + lane - 0.5); ctx.lineTo(W, y0 + lane - 0.5); ctx.stroke();
      ctx.strokeStyle = s.color; ctx.lineWidth = 1.6; ctx.beginPath();
      let started = false;
      for (let k = 0; k < this.count; k++) {
        const idx = (this.pos - this.count + k + this.length) % this.length;
        const v = d[idx];
        if (!Number.isFinite(v)) { started = false; continue; }
        const x = W * (k + this.length - this.count) / (this.length - 1);
        const y = y0 + lane - 4 - (lane - 16) * (v - lo) / (hi - lo);
        started ? ctx.lineTo(x, y) : ctx.moveTo(x, y); started = true;
      }
      ctx.stroke();
      const last = d[(this.pos - 1 + this.length) % this.length];
      ctx.fillStyle = s.color; ctx.textAlign = 'left';
      ctx.fillText(`${s.label}: ${Number.isFinite(last) ? last.toFixed(s.dec ?? 0) : '—'} ${s.unit || ''}`, 6, y0 + 13);
      ctx.fillStyle = muted; ctx.textAlign = 'right';
      ctx.fillText(`${lo.toFixed(s.dec ?? 0)} – ${hi.toFixed(s.dec ?? 0)}`, W - 6, y0 + 13);
    });
  }
}
