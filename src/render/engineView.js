// "Motor por dentro": corte animado de cada cilindro (pistão, biela, virabrequim, válvulas, vela,
// mistura/explosão/escape) sincronizado com a ordem de ignição, e o diagrama de energia do híbrido.

function fit(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(r.width * dpr) || canvas.height !== Math.round(r.height * dpr)) {
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  }
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W: r.width, H: r.height };
}

const STROKES = ['Explosão', 'Escape', 'Admissão', 'Compressão'];
const lift = (theta, open, close) => {
  // levante senoidal entre abertura e fechamento (graus no ciclo de 720°)
  let t = ((theta - open) % 720 + 720) % 720, dur = ((close - open) % 720 + 720) % 720;
  return t < dur ? Math.sin(Math.PI * t / dur) : 0;
};

export class EngineView {
  constructor(canvas, flowCanvas) {
    this.canvas = canvas; this.flowCanvas = flowCanvas;
    this.crank = 0; this.turbo = 0; this.dots = 0;
    this.slow = 1 / 20;
  }

  advance(dt, rpm, turboRpm) {
    this.crank = (this.crank + rpm / 60 * 360 * dt * this.slow) % 720;
    this.turbo = (this.turbo + (turboRpm || 0) / 60 * 360 * dt * this.slow * 0.02) % 360;
    this.dots = (this.dots + dt) % 1000;
  }

  draw(cfg, engine, t) {
    const { ctx, W, H } = fit(this.canvas);
    ctx.clearRect(0, 0, W, H);
    const pat = engine.pattern;
    const n = pat.length;
    const diesel = engine.isDiesel;
    const cw = Math.min(110, (W - 40) / n);
    const bore = cw * 0.72;
    const strokePx = Math.min(H * 0.16, bore * 1.1 * cfg.engine.stroke / cfg.engine.bore);
    const rCrank = strokePx / 2, rod = strokePx * 1.6;
    const x0 = (W - cw * n) / 2 + cw / 2;
    const crankY = H - rCrank - 58;
    const deckY = crankY - rCrank - rod - bore * 0.45 - 8;
    const headY = deckY - 26;
    const camless = cfg.valvetrain.type === 'camless';

    ctx.font = '600 12px system-ui'; ctx.textAlign = 'center';
    // bloco
    ctx.fillStyle = '#2b313b'; ctx.fillRect(x0 - cw / 2 - 10, headY - 18, cw * n + 20, crankY - headY + 18 + rCrank + 22);
    ctx.fillStyle = '#3a414d'; ctx.fillRect(x0 - cw / 2 - 10, headY - 18, cw * n + 20, 44); // cabeçote

    const order = pat.map((p, i) => ({ ...p, i })).sort((a, b) => a.angle - b.angle).map((p, k) => [p.i, k + 1]);
    const firingIdx = new Map(order);

    for (let i = 0; i < n; i++) {
      const cx = x0 + i * cw;
      const theta = ((this.crank - pat[i].angle) % 720 + 720) % 720; // 0 = PMS de explosão
      const a = theta * Math.PI / 180;
      const pistonDist = rCrank * Math.cos(a) + Math.sqrt(rod * rod - (rCrank * Math.sin(a)) ** 2);
      const pinX = cx + rCrank * Math.sin(a), pinY = crankY - rCrank * Math.cos(a);
      const pistonY = crankY - pistonDist; // centro do pino do pistão
      const crownY = pistonY - bore * 0.35;
      const stroke = Math.floor(theta / 180);
      const tInStroke = (theta % 180) / 180;

      // câmara: cor do gás
      let gas;
      if (stroke === 0) gas = `rgba(255,${120 + 100 * tInStroke},30,${0.95 - 0.6 * tInStroke})`;
      else if (stroke === 1) gas = 'rgba(120,120,120,0.55)';
      else if (stroke === 2) gas = diesel ? 'rgba(170,210,255,0.35)' : 'rgba(80,170,255,0.45)';
      else gas = diesel ? `rgba(170,210,255,${0.35 + 0.4 * tInStroke})` : `rgba(80,170,255,${0.45 + 0.35 * tInStroke})`;
      if (!t.engineOn && t.rpm < 50) gas = 'rgba(80,90,100,0.3)';
      // cilindro
      ctx.fillStyle = '#12161c'; ctx.fillRect(cx - bore / 2 - 3, deckY, bore + 6, crankY - rCrank - 20 - deckY);
      ctx.fillStyle = gas; ctx.fillRect(cx - bore / 2, deckY, bore, Math.max(0, crownY - deckY));
      // válvulas: admissão (esq., azul) e escape (dir., vermelho)
      const exO = 140, exC = 380, inO = 340, inC = 580; // graus (com cruzamento ~40°)
      const li = camless ? lift(theta, 355, 560) : lift(theta, inO, inC);
      const le = camless ? lift(theta, 165, 365) : lift(theta, exO, exC);
      const vMax = bore * 0.18;
      const drawValve = (vx, l, color) => {
        const vy = deckY + l * vMax;
        ctx.strokeStyle = color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(vx, headY - 10); ctx.lineTo(vx, vy); ctx.stroke();
        ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(vx - bore * 0.14, vy); ctx.lineTo(vx + bore * 0.14, vy); ctx.lineTo(vx + 3, vy - 6); ctx.lineTo(vx - 3, vy - 6); ctx.fill();
      };
      drawValve(cx - bore * 0.24, li, '#4dabf7');
      drawValve(cx + bore * 0.24, le, '#ff6b6b');
      // comando/atuador
      ctx.fillStyle = camless ? '#a78bfa' : '#c9a227';
      if (camless) { ctx.fillRect(cx - bore * 0.32, headY - 16, 14, 8); ctx.fillRect(cx + bore * 0.18, headY - 16, 14, 8); }
      else {
        for (const [vx, ang] of [[cx - bore * 0.24, theta / 2 - 135], [cx + bore * 0.24, theta / 2 + 45]]) {
          ctx.save(); ctx.translate(vx, headY - 14); ctx.rotate(ang * Math.PI / 180);
          ctx.beginPath(); ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      }
      // vela / bico diesel
      ctx.fillStyle = '#ddd'; ctx.fillRect(cx - 2, headY - 14, 4, deckY - headY + 12);
      if (t.engineOn && !t.cut && theta > 712) {
        if (diesel) { ctx.fillStyle = 'rgba(255,240,180,0.9)'; ctx.beginPath(); ctx.moveTo(cx, deckY); ctx.lineTo(cx - 10, deckY + 16); ctx.lineTo(cx + 10, deckY + 16); ctx.fill(); }
        else { ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(cx, deckY + 3, 6, 0, Math.PI * 2); ctx.fill(); }
      }
      // pistão
      ctx.fillStyle = '#aab2bd'; ctx.fillRect(cx - bore / 2 + 1, crownY, bore - 2, bore * 0.5);
      ctx.fillStyle = '#7d8590'; for (let k = 0; k < 3; k++) ctx.fillRect(cx - bore / 2 + 1, crownY + 4 + k * 5, bore - 2, 2);
      // biela
      ctx.strokeStyle = '#c0c6ce'; ctx.lineWidth = Math.max(4, bore * 0.12);
      ctx.beginPath(); ctx.moveTo(cx, pistonY); ctx.lineTo(pinX, pinY); ctx.stroke();
      // virabrequim
      ctx.fillStyle = '#596170'; ctx.beginPath(); ctx.arc(cx, crankY, rCrank + 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8b93a0'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(cx, crankY); ctx.lineTo(pinX, pinY); ctx.stroke();
      ctx.fillStyle = '#c0c6ce'; ctx.beginPath(); ctx.arc(pinX, pinY, 5, 0, Math.PI * 2); ctx.fill();
      // rótulos
      ctx.fillStyle = '#e8ecf1'; ctx.fillText(`Cil. ${i + 1}`, cx, headY - 24);
      ctx.fillStyle = ['#ffa94d', '#adb5bd', '#4dabf7', '#74c0fc'][stroke];
      ctx.fillText(STROKES[stroke], cx, crankY + rCrank + 30);
      ctx.fillStyle = '#8b95a5'; ctx.fillText(`${firingIdx.get(i)}º na ordem`, cx, crankY + rCrank + 46);
    }
    // eixo do virabrequim
    ctx.strokeStyle = '#8b93a0'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x0 - cw / 2 - 10, crankY); ctx.lineTo(x0 + cw * (n - 0.5) + 10, crankY); ctx.stroke();

    // turbina
    const ind = cfg.intake.induction;
    if (ind !== 'na') {
      const tx = W - 70, ty = 70;
      ctx.fillStyle = '#2b313b'; ctx.beginPath(); ctx.arc(tx, ty, 38, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(this.turbo * Math.PI / 180);
      ctx.strokeStyle = '#c9d1db'; ctx.lineWidth = 3;
      for (let k = 0; k < 8; k++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(18, 6, 30, 0); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = '#e8ecf1'; ctx.fillText(ind === 'supercharger' ? 'Compressor' : 'Turbina', tx, ty + 54);
      ctx.fillStyle = '#69db7c'; ctx.fillText(`${Math.round(t.turboRpm || 0).toLocaleString('pt-BR')} rpm · ${(t.boost || 0).toFixed(2)} bar`, tx, ty + 70);
    }
    ctx.textAlign = 'left'; ctx.fillStyle = '#8b95a5';
    ctx.fillText(`Virabrequim: ${this.crank.toFixed(0)}°/720° · lenta ${this.slow === 1 ? 'não' : '1/' + Math.round(1 / this.slow)}`, 12, H - 26);
    ctx.fillText(diesel ? 'Diesel: o diesel injetado pega fogo pela compressão' : 'Otto: a vela acende a mistura no fim da compressão', 12, H - 10);
  }

  drawFlow(cfg, t) {
    const { ctx, W, H } = fit(this.flowCanvas);
    ctx.clearRect(0, 0, W, H);
    const f = t.flow;
    ctx.font = '600 12px system-ui'; ctx.textAlign = 'center';
    if (!cfg.hybrid.enabled || !f) {
      ctx.fillStyle = '#8b95a5';
      ctx.fillText('Sem sistema híbrido. Ative na etapa Montar → Híbrido, ou escolha um carro híbrido/elétrico no Catálogo.', W / 2, H / 2);
      return;
    }
    const box = (x, y, w, h, title, sub, color) => {
      ctx.fillStyle = '#1d2430'; ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8ecf1'; ctx.fillText(title, x, y - 4);
      ctx.fillStyle = '#8b95a5'; ctx.fillText(sub, x, y + 13);
    };
    const arrow = (x1, y1, x2, y2, kw, color) => {
      if (Math.abs(kw) < 0.3) { ctx.strokeStyle = '#2a3240'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); return; }
      if (kw < 0) [x1, y1, x2, y2] = [x2, y2, x1, y1];
      const w = Math.min(14, 2 + Math.sqrt(Math.abs(kw)) * 1.2);
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.globalAlpha = 1;
      const len = Math.hypot(x2 - x1, y2 - y1);
      const speed = 40 + Math.abs(kw) * 2;
      ctx.fillStyle = color;
      for (let d = (this.dots * speed) % 24; d < len; d += 24) {
        const px = x1 + (x2 - x1) * d / len, py = y1 + (y2 - y1) * d / len;
        ctx.beginPath(); ctx.arc(px, py, w / 2 + 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#e8ecf1';
      if (Math.abs(x2 - x1) < 2) { ctx.textAlign = 'left'; ctx.fillText(`${Math.abs(kw).toFixed(1)} kW`, x1 + w / 2 + 8, (y1 + y2) / 2 + 4); ctx.textAlign = 'center'; }
      else ctx.fillText(`${Math.abs(kw).toFixed(1)} kW`, (x1 + x2) / 2, (y1 + y2) / 2 - w / 2 - 6);
    };
    const cy = H * 0.36;
    const xE = W * 0.13, xM = W * 0.45, xW = W * 0.85, xB = W * 0.45, yB = H * 0.78;
    const evOnly = cfg.hybrid.evOnly;
    if (!evOnly) box(xE, cy, 130, 54, 'Motor a combustão', f.engineOn ? `${Math.round(t.rpm)} rpm` : 'desligado', f.engineOn ? '#ff8c42' : '#495057');
    box(xM, cy, 130, 54, 'Motor elétrico', `${Math.round(t.motorRpm || 0)} rpm`, f.motor > 0.3 ? '#20c997' : f.motor < -0.3 ? '#fab005' : '#495057');
    box(xW, cy, 120, 54, 'Rodas', `${Math.abs(t.speed || 0).toFixed(0)} km/h`, '#4dabf7');
    // bateria com nível
    ctx.fillStyle = '#1d2430'; ctx.strokeStyle = f.battery < -0.3 ? '#fab005' : f.battery > 0.3 ? '#20c997' : '#495057'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(xB - 80, yB - 26, 160, 52, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = f.soc < 0.15 ? '#ff6b6b' : '#20c997'; ctx.fillRect(xB - 70, yB + 8, 140 * f.soc, 9);
    ctx.strokeStyle = '#495057'; ctx.lineWidth = 1; ctx.strokeRect(xB - 70, yB + 8, 140, 9);
    ctx.fillStyle = '#e8ecf1';
    ctx.fillText(`Bateria ${(f.soc * 100).toFixed(1)}% · ${f.battery < -0.3 ? 'CARREGANDO' : f.battery > 0.3 ? 'descarregando' : 'em repouso'}`, xB, yB - 6);

    if (!evOnly) arrow(xE + 65, cy, xM - 65, cy, f.engine, '#ff8c42');
    arrow(xM + 65, cy, xW - 60, cy, f.motor + (evOnly ? 0 : f.engine), f.motor < 0 ? '#fab005' : '#20c997');
    arrow(xB, yB - 26, xM, cy + 27, f.battery, f.battery < 0 ? '#fab005' : '#20c997');
    if (f.brakeKw > 1) { ctx.fillStyle = '#ff6b6b'; ctx.fillText(`Freio a disco dissipando ${f.brakeKw.toFixed(0)} kW em calor`, xW, cy + 50); }
    ctx.fillStyle = '#8b95a5'; ctx.textAlign = 'left';
    const mode = { hybrid: 'Híbrido', sport: 'Esporte', ev: 'Elétrico', charge: 'Carregar bateria' }[cfg.hybrid.mode];
    ctx.fillText(`Modo: ${evOnly ? '100% elétrico' : mode} · regeneração ${(cfg.hybrid.regen * 100).toFixed(0)}% · ${f.regen ? 'REGENERANDO' : f.motor > 0.3 ? 'tracionando' : ''}`, 12, 18);
  }
}
