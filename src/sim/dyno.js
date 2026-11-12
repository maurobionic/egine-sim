// Dinamômetro de bancada: o motor gira preso a um freio (carga) controlado por você,
// ou faz uma "puxada" automática de giro baixo até o corte em plena carga.
const RPM = 30 / Math.PI;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export class Dyno {
  constructor(engine) {
    this.engine = engine;
    this.we = 0; this.on = false; this.starting = false; this.startT = 0;
    this.throttle = 0;      // acelerador (0..1)
    this.load = 0.3;        // carga do freio (0..1)
    this.sweep = null;      // { rpm, data[] }
    this.points = [];       // pontos medidos ao vivo
    this.cut = false; this.idleI = 0; this.nitro = false;
    this.tel = null;
  }

  get rpm() { return this.we * RPM; }

  start() { if (this.engine.state.broken) return; if (!this.on) { this.starting = true; this.startT = 0; } }
  stop() { this.on = false; this.starting = false; this.sweep = null; }

  startSweep(throttle = 1) {
    if (!this.on) this.start();
    this.sweep = { throttle, rpm: Math.max(1500, this.engine.cfg.engine.idleRpm + 500), data: [], settle: 1.2 };
  }

  step(dt) {
    const H = 0.001;
    for (let t = 0; t < dt - 1e-9; t += H) this.substep(H);
  }

  substep(H) {
    const eng = this.engine, c = eng.cfg;
    let rpm = this.rpm;
    let thr = 0;
    if (this.on) {
      const err = c.engine.idleRpm - rpm;
      this.idleI = clamp(this.idleI + err * H * 0.00012, -0.03, 0.25);
      thr = Math.max(this.throttle, clamp(0.04 + this.idleI + err * 0.00015, 0, 0.5));
    } else if (this.starting) thr = eng.isDiesel ? 0.35 : 0.12;
    if (rpm > c.engine.redline) this.cut = true; else if (rpm < c.engine.redline - 250) this.cut = false;

    const sw = this.sweep;
    if (sw) thr = sw.throttle;

    const running = this.on || (this.starting && rpm > 150);
    eng.update(H, rpm, thr, running, this.nitro);
    const tel = eng.compute(rpm, thr, eng.state.boost, { fire: running && !this.cut, nitro: eng.state.nitroActive });
    let T = tel.torque;
    if (this.starting) {
      this.startT += H;
      T += 70 * Math.max(0, 1 - rpm / 320) * (0.6 + 0.4 * eng.dispL / 2);
      if (rpm > c.engine.idleRpm * 0.6 && eng.canIgnite) { this.on = true; this.starting = false; this.idleI = 0; }
      if (this.startT > 4) this.starting = false;
    }

    const I = eng.inertia + 0.4; // inércia do rolo do dinamômetro
    if (sw) {
      // o freio controla o giro: rampa de ~1000 rpm/s
      if (sw.settle > 0) { sw.settle -= H; sw.rpm = Math.max(sw.rpm, 1500); }
      else sw.rpm += 1000 * H;
      const target = sw.rpm / RPM;
      this.we += (target - this.we) * Math.min(1, H / 0.02);
      if (sw.settle <= 0 && (sw.data.length === 0 || rpm - sw.data[sw.data.length - 1].rpm >= 50)) {
        sw.data.push({ rpm, torque: tel.torque, power: tel.power, boost: eng.state.boost, lambda: tel.lambda, afr: tel.afr });
      }
      if (sw.rpm >= c.engine.redline) { this.lastSweep = sw.data; this.sweep = null; }
      this.brakeTorque = T;
    } else {
      // freio tipo correntes parasitas: torque cresce com o giro
      const maxT = Math.max(50, eng.dispL * 200 + c.intake.boost * (c.intake.induction !== 'na' ? eng.dispL * 150 : 0));
      const Tb = this.load * maxT * clamp(rpm / 2500, 0, 1.5);
      this.brakeTorque = Tb;
      this.we += (T - Tb) / I * H;
    }
    if (this.we < 0) this.we = 0;
    eng.thermal(H, tel, 50, this.on); // ventilador do dinamômetro ≈ 50 km/h
    if (eng.state.broken) { this.on = false; this.starting = false; this.sweep = null; }
    if (this.on && this.rpm < 250) { this.on = false; this.stalled = true; }
    this.tel = tel;
  }

  snapshot() {
    const tel = this.tel || this.engine.compute(0, 0, 0, { fire: false });
    const s = this.engine.state;
    const b = s.bovEvent; s.bovEvent = null;
    return {
      ...tel, rpm: this.rpm, engineOn: this.on, starting: this.starting, cut: this.cut,
      turboRpm: s.turboRpm, spool: s.spool, nitroKg: s.nitroKg, bovEvent: b,
      coolant: s.coolant, oilTemp: s.oil, health: s.health, broken: s.broken, cause: s.cause, damageNow: s.damageNow,
      brakeTorque: this.brakeTorque || 0, sweeping: !!this.sweep, gearLabel: 'DINO',
    };
  }
}
