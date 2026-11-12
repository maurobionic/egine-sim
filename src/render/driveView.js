// Visão lateral 2D do test drive: estrada à beira-mar, carro com rodas girando, fumaça e chamas.
export class DriveView {
  constructor(canvas, track) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.track = track;
    this.particles = []; this.t = 0;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(sim, s, dt) {
    if (!this.W) this.resize();
    const { ctx, W, H, track } = this;
    this.t += dt;
    const scale = Math.max(9, Math.min(22, W / 48)) * (1 - Math.min(0.3, Math.abs(sim.v) / 250));
    const camX = sim.x + 4;
    const camY = track.height(sim.x);
    const sx = (x) => (x - camX) * scale + W * 0.42;
    const sy = (y) => H * 0.7 - (y - camY) * scale;

    // céu
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.5);
    sky.addColorStop(0, '#5aa9e6'); sky.addColorStop(1, '#bfe3f7');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff6c9';
    ctx.beginPath(); ctx.arc(W * 0.8, H * 0.14, 28, 0, Math.PI * 2); ctx.fill();
    // nuvens
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 380 - camX * scale * 0.05) % (W + 300) + W + 300) % (W + 300) - 150;
      const cy = H * (0.08 + 0.05 * (i % 3));
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(cx + k * 22, cy + (k % 2) * 6, 18 + (k % 2) * 6, 0, Math.PI * 2); ctx.fill(); }
    }
    // mar
    const horizon = H * 0.42;
    const sea = ctx.createLinearGradient(0, horizon, 0, H);
    sea.addColorStop(0, '#2f7fb8'); sea.addColorStop(1, '#3fb6c8');
    ctx.fillStyle = sea; ctx.fillRect(0, horizon, W, H - horizon);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
    for (let row = 0; row < 6; row++) {
      const y = horizon + 8 + row * row * 6;
      const off = (this.t * 12 * (row + 1) + camX * scale * 0.08 * (row + 1)) % 60;
      ctx.beginPath();
      for (let x = -off; x < W; x += 60) { ctx.moveTo(x, y); ctx.lineTo(x + 18 + row * 3, y); }
      ctx.stroke();
    }
    // ilhas distantes
    ctx.fillStyle = '#4c8a6e';
    for (let i = 0; i < 3; i++) {
      const cx = ((i * 700 + 200 - camX * scale * 0.1) % (W + 800) + W + 800) % (W + 800) - 400;
      ctx.beginPath(); ctx.ellipse(cx, horizon, 160 + 40 * i, 26 + 8 * i, 0, Math.PI, 0); ctx.fill();
    }
    // coqueiros (paralaxe)
    const px = 0.7;
    const startP = Math.floor((camX - W / scale) / 37) * 37;
    for (let x = startP; x < camX + W / scale; x += 37) {
      const X = (x - camX) * scale * px + W * 0.42 + ((x * 13) % 17) * 4;
      if (X < -60 || X > W + 60) continue;
      this.palm(ctx, X, H * 0.7 - 6 - (track.height(x) - camY) * scale * px, 0.8 + ((x * 7) % 5) / 10);
    }

    // chão / areia e estrada
    const x0 = camX - (W * 0.42) / scale - 2, x1 = camX + (W * 0.58) / scale + 2;
    ctx.beginPath();
    ctx.moveTo(sx(x0), H);
    for (let x = x0; x <= x1; x += 1) ctx.lineTo(sx(x), sy(track.height(x)));
    ctx.lineTo(sx(x1), H); ctx.closePath();
    const sand = ctx.createLinearGradient(0, H * 0.6, 0, H);
    sand.addColorStop(0, '#e9d29a'); sand.addColorStop(1, '#cfae6a');
    ctx.fillStyle = sand; ctx.fill();
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 1) { const X = sx(x), Y = sy(track.height(x)); x === x0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
    ctx.strokeStyle = '#3b3b40'; ctx.lineWidth = Math.max(5, 0.35 * scale); ctx.stroke();
    ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 1.5; ctx.setLineDash([scale * 2, scale * 2]);
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 1) { const X = sx(x), Y = sy(track.height(x)) - 1; x === x0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
    ctx.stroke(); ctx.setLineDash([]);

    // placas de distância
    ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center';
    const marks = [[0, 'LARGADA'], [100, '100 m'], [201, '1/8 milha'], [402, '1/4 milha (400 m)']];
    for (let x = Math.ceil(x0 / 100) * 100; x < x1; x += 100) if (x > 402 && x % 500 === 0) marks.push([x, `${x} m`]);
    for (const [x, label] of marks) {
      if (x < x0 || x > x1) continue;
      const X = sx(x), Y = sy(track.height(x));
      ctx.fillStyle = '#555'; ctx.fillRect(X - 1.5, Y - 3.2 * scale, 3, 3.2 * scale);
      ctx.fillStyle = x === 0 || x === 402 ? '#111' : '#1d5fa8';
      const w = ctx.measureText(label).width + 12;
      ctx.fillRect(X - w / 2, Y - 3.2 * scale - 20, w, 20);
      ctx.fillStyle = '#fff'; ctx.fillText(label, X, Y - 3.2 * scale - 6);
    }

    // carro
    const r = sim.cfg.vehicle.tireRadius;
    const small = sim.mass < 500;
    const wb = small ? 1.6 : 2.6;
    const xr = sim.x - wb / 2, xf = sim.x + wb / 2;
    const yr = track.height(xr) + r, yf = track.height(xf) + r;
    const pitch = Math.atan2(yf - yr, wb) - Math.max(-0.05, Math.min(0.05, (s.accelG || 0) * 0.04));
    const cx = sx(sim.x), cy = sy((yr + yf) / 2);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-pitch);
    const k = scale;
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(0, r * k, wb * 0.75 * k, 0.15 * k, 0, 0, Math.PI * 2); ctx.fill();
    if (small) this.kart(ctx, k, wb, r); else this.body(ctx, k, wb, r);
    this.wheel(ctx, -wb / 2 * k, 0, r * k, sim.wheelAngle);
    this.wheel(ctx, wb / 2 * k, 0, r * k, sim.v / r * (sim.time || 0) || sim.wheelAngle);
    // escapamento
    const exX = (-wb / 2 - (small ? 0.4 : 0.75)) * k, exY = (r * 0.2) * k;
    ctx.restore();

    const toWorld = (lx, ly) => [cx + lx * Math.cos(-pitch) - ly * Math.sin(-pitch), cy + lx * Math.sin(-pitch) + ly * Math.cos(-pitch)];
    // partículas: fumaça de pneu, fumaça preta do diesel, chamas de pipoco
    if (s.wheelSpin && Math.abs(sim.v) < 60) for (let i = 0; i < 3; i++) {
      const [wx, wy] = toWorld((sim.cfg.vehicle.drive === 'fwd' ? wb / 2 : -wb / 2) * k, r * k);
      this.particles.push({ x: wx, y: wy, vx: -40 - Math.random() * 60, vy: -20 - Math.random() * 30, life: 1.2, size: 8, color: '220,220,220' });
    }
    const [ex, ey] = toWorld(exX, exY);
    if (s.smoke > 0.15 && Math.random() < s.smoke) this.particles.push({ x: ex, y: ey, vx: -30, vy: -15, life: 1, size: 6 + s.smoke * 8, color: '40,40,40' });
    if ((s.cut || (s.decelCut && s.rpm > 4000)) && sim.cfg.exhaust.muffler !== 'stock' && Math.random() < 0.35)
      this.particles.push({ x: ex, y: ey, vx: -80, vy: -5, life: 0.12, size: 7, color: '255,150,40', flame: true });
    if (s.nitro && Math.random() < 0.5) this.particles.push({ x: ex, y: ey, vx: -120, vy: 0, life: 0.15, size: 6, color: '120,170,255', flame: true });

    for (const p of this.particles) {
      p.life -= dt; p.x += p.vx * dt - sim.v * scale * dt * 0.2; p.y += p.vy * dt; p.size += dt * (p.flame ? -10 : 18);
      ctx.fillStyle = `rgba(${p.color},${Math.max(0, Math.min(0.6, p.life))})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.size), 0, Math.PI * 2); ctx.fill();
    }
    this.particles = this.particles.filter((p) => p.life > 0).slice(-250);

    this.hud(ctx, W, H, sim, s);
  }

  body(ctx, k, wb, r) {
    const L = 4.2, h = 1.3;
    ctx.fillStyle = '#d7263d'; ctx.strokeStyle = '#7a0f1e'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-L / 2 * k, -0.25 * k);
    ctx.lineTo(-L / 2 * k, -0.75 * k);
    ctx.lineTo(-1.55 * k, -0.85 * k);
    ctx.lineTo(-0.9 * k, -h * k);
    ctx.lineTo(0.55 * k, -h * k);
    ctx.lineTo(1.25 * k, -0.85 * k);
    ctx.lineTo(L / 2 * k, -0.7 * k);
    ctx.lineTo(L / 2 * k, -0.25 * k);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a9d6f5';
    ctx.beginPath(); ctx.moveTo(-0.8 * k, -1.2 * k); ctx.lineTo(0.5 * k, -1.2 * k); ctx.lineTo(1.05 * k, -0.88 * k); ctx.lineTo(-1.35 * k, -0.88 * k); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a0f1e'; ctx.fillRect(-0.2 * k, -1.2 * k, 0.08 * k, 0.33 * k);
    ctx.fillStyle = '#ffe066'; ctx.fillRect((L / 2 - 0.12) * k, -0.62 * k, 0.12 * k, 0.12 * k);
    ctx.fillStyle = '#333'; ctx.fillRect(-(L / 2 + 0.12) * k, -0.1 * k + r * 0.2 * k, 0.35 * k, 0.08 * k);
  }

  kart(ctx, k, wb) {
    ctx.fillStyle = '#ff8c1a'; ctx.strokeStyle = '#7a3d00'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-1.1 * k, -0.45 * k, 2.2 * k, 0.3 * k, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.fillRect(-0.4 * k, -0.95 * k, 0.12 * k, 0.5 * k);
    ctx.fillStyle = '#2b59c3'; ctx.beginPath(); ctx.arc(-0.25 * k, -1.05 * k, 0.17 * k, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.moveTo(0.3 * k, -0.45 * k); ctx.lineTo(0.1 * k, -0.85 * k); ctx.stroke();
  }

  wheel(ctx, x, y, R, angle) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b8bec6'; ctx.beginPath(); ctx.arc(0, 0, R * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6b7178'; ctx.lineWidth = Math.max(1.5, R * 0.12);
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R * 0.58, Math.sin(a) * R * 0.58); ctx.stroke(); }
    ctx.restore();
  }

  palm(ctx, x, y, s) {
    ctx.strokeStyle = '#8a6a3f'; ctx.lineWidth = 6 * s;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 12 * s, y - 50 * s, x + 6 * s, y - 95 * s); ctx.stroke();
    ctx.strokeStyle = '#2f8f46'; ctx.lineWidth = 5 * s;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.55;
      ctx.beginPath(); ctx.moveTo(x + 6 * s, y - 95 * s);
      ctx.quadraticCurveTo(x + 6 * s + Math.cos(a) * 30 * s, y - 95 * s + Math.sin(a) * 30 * s - 8 * s, x + 6 * s + Math.cos(a) * 48 * s, y - 95 * s + Math.sin(a) * 30 * s + 18 * s);
      ctx.stroke();
    }
  }

  hud(ctx, W, H, sim, s) {
    // conta-giros
    const R = Math.min(90, W * 0.1), cx = W - R - 24, cy = H - R - 24;
    const red = sim.cfg.engine.redline, max = Math.ceil((red + 1000) / 1000) * 1000;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const ang = (rpm) => a0 + (a1 - a0) * Math.min(1, rpm / max);
    ctx.fillStyle = 'rgba(15,18,24,0.82)'; ctx.beginPath(); ctx.arc(cx, cy, R + 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e03131'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, R - 4, ang(red), a1); ctx.stroke();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.fillStyle = '#ddd'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
    for (let rpm = 0; rpm <= max; rpm += 1000) {
      const a = ang(rpm);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10)); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
      ctx.fillText(rpm / 1000, cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22) + 4);
    }
    const a = ang(s.rpm);
    ctx.strokeStyle = '#ff6b00'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6)); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '700 26px system-ui'; ctx.fillText(s.gearLabel, cx, cy + R * 0.45);
    ctx.font = '600 13px system-ui'; ctx.fillText(`${Math.round(s.rpm)} rpm`, cx, cy + R * 0.7);
    // velocidade
    ctx.textAlign = 'right'; ctx.font = '800 44px system-ui'; ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 5;
    const sp = `${Math.abs(Math.round(s.speed))}`;
    ctx.strokeText(sp, cx - R - 30, cy + 10); ctx.fillText(sp, cx - R - 30, cy + 10);
    ctx.font = '600 14px system-ui'; ctx.strokeText('km/h', cx - R - 30, cy + 30); ctx.fillText('km/h', cx - R - 30, cy + 30);
    // avisos
    const flags = [];
    if (s.broken) flags.push([`MOTOR QUEBROU: ${s.cause}`, '#c92a2a']);
    else if (!s.engineOn && !s.ev) flags.push([s.stalled ? 'MOTOR MORREU — aperte I' : s.starting ? 'DANDO PARTIDA…' : 'MOTOR DESLIGADO — aperte I', '#e03131']);
    if (s.damageNow && !s.broken) flags.push([`DANIFICANDO: ${s.damageNow}`, '#e8590c']);
    if (s.coolant > 108) flags.push(['SUPERAQUECENDO', '#e03131']);
    if (s.flow?.regen) flags.push(['REGENERANDO', '#fab005']);
    if (s.ev) flags.push(['MODO ELÉTRICO', '#20c997']);
    if (s.vtecOn) flags.push(['VTEC', '#fab005']);
    if (s.cut) flags.push(['CORTE DE GIRO', '#e03131']);
    if (s.knock > 0) flags.push(['DETONAÇÃO!', '#e03131']);
    if (s.floating) flags.push(['FLUTUAÇÃO DE VÁLVULA', '#e8590c']);
    if (s.wheelSpin) flags.push(['PATINANDO', '#868e96']);
    if (s.nitro) flags.push(['NITRO', '#4dabf7']);
    if (s.smoke > 0.5) flags.push(['FUMAÇA PRETA', '#495057']);
    if (s.clutch < 0.98 && s.gear !== 0 && s.engineOn) flags.push([`EMBREAGEM ${Math.round(s.clutch * 100)}%`, '#7950f2']);
    ctx.textAlign = 'left'; ctx.font = '700 13px system-ui';
    let fx = 16;
    for (const [t, col] of flags) {
      const w = ctx.measureText(t).width + 16;
      ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(fx, H - 40, w, 24, 6); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(t, fx + 8, H - 23); fx += w + 8;
    }
    // cronômetro
    const run = s.run, best = s.best;
    ctx.fillStyle = 'rgba(15,18,24,0.75)'; ctx.beginPath(); ctx.roundRect(12, 12, 230, 82, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '600 13px system-ui';
    const f = (x) => (x == null ? '—' : x.toFixed(2) + ' s');
    ctx.fillText(`Tempo: ${run ? run.t?.toFixed(2) ?? '0.00' : '—'} s`, 22, 32);
    ctx.fillText(`0-100 km/h: ${f(run?.t100)}  (melhor ${f(best.t100)})`, 22, 52);
    ctx.fillText(`400 m: ${f(run?.t402)}${run?.v402 ? ' @ ' + run.v402.toFixed(0) + ' km/h' : ''}`, 22, 72);
    ctx.fillText(`melhor 400 m: ${f(best.t402)}`, 22, 88);
    // temperaturas e saúde
    ctx.fillStyle = 'rgba(15,18,24,0.75)'; ctx.beginPath(); ctx.roundRect(252, 12, 200, 82, 8); ctx.fill();
    ctx.fillStyle = s.coolant > 105 ? '#ff6b6b' : '#fff';
    ctx.fillText(`Água: ${Math.round(s.coolant)} °C`, 262, 32);
    ctx.fillStyle = s.oilTemp > 135 ? '#ff6b6b' : '#fff';
    ctx.fillText(`Óleo: ${Math.round(s.oilTemp)} °C`, 262, 52);
    ctx.fillStyle = '#fff'; ctx.fillText(`Saúde do motor: ${(s.health * 100).toFixed(0)}%`, 262, 72);
    ctx.fillStyle = '#333'; ctx.fillRect(262, 80, 180, 6);
    ctx.fillStyle = s.health > 0.6 ? '#51cf66' : s.health > 0.3 ? '#fab005' : '#ff6b6b'; ctx.fillRect(262, 80, 180 * s.health, 6);
    if (s.flow && this.showSoc !== false && sim.cfg.hybrid.enabled) {
      ctx.fillStyle = 'rgba(15,18,24,0.75)'; ctx.beginPath(); ctx.roundRect(462, 12, 170, 62, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(`Bateria: ${(s.soc * 100).toFixed(1)}%`, 472, 32);
      ctx.fillStyle = s.flow.battery < 0 ? '#fab005' : '#20c997';
      ctx.fillText(`${s.flow.battery < -0.3 ? 'carregando' : s.flow.battery > 0.3 ? 'usando' : 'parada'} ${Math.abs(s.flow.battery).toFixed(1)} kW`, 472, 52);
      ctx.fillStyle = '#333'; ctx.fillRect(472, 60, 150, 6); ctx.fillStyle = '#20c997'; ctx.fillRect(472, 60, 150 * s.soc, 6);
    }
  }
}
