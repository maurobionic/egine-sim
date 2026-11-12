// Simulação do conjunto: motor + embreagem + câmbio + motor elétrico (híbrido P2) + pneus + carro.
// Integração em passos fixos de 1 ms. A embreagem e os pneus usam modelo "gruda/escorrega"
// (stick–slip), que é estável e reproduz patinar embreagem, morrer o motor e cantar pneu.
import { Engine } from '../engine/engine.js';
import { engineWeight } from '../engine/config.js';

const G = 9.81;
const H = 0.001;
const RPM = 30 / Math.PI; // rad/s -> rpm
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sgn = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);

export class Simulation {
  constructor(cfg, track) {
    this.track = track;
    this.engine = new Engine(cfg);
    this.input = { throttle: 0, brake: 0, clutch: 0, nitro: false };
    this.best = { t100: null, t402: null, v402: null };
    this.setConfig(cfg);
    this.reset();
  }

  setConfig(cfg) {
    this.cfg = cfg;
    this.engine.setConfig(cfg);
    const n = cfg.transmission.gears.length;
    if (this.gear > n) this.gear = n;
    this.engineMass = engineWeight(cfg);
    this.mass = cfg.vehicle.mass + this.engineMass;
    if (this.soc === undefined) this.soc = 0.6;
  }

  reset() {
    this.x = 0; this.v = 0; this.a = 0;
    this.we = 0; this.ww = 0; this.wheelAngle = 0;
    this.gear = 0; this.clutchLocked = false; this.wheelSpin = false;
    this.engineOn = false; this.starting = true; this.startTimer = 0; this.stalled = false;
    this.cut = false; this.idleI = 0; this.autoE = 0;
    this.shiftTimer = 0; this.shiftCooldown = 0; this.shiftTarget = 0;
    this.soc = 0.6; this.motorTorque = 0; this.motorPower = 0; this.regenForce = 0; this.motorRpm = 0;
    this.fuelUsed = 0; this.distance = 0; this.time = 0;
    this.run = null; this.lastRun = null;
    this.tel = null;
    this.engine.state.boost = 0; this.engine.state.spool = 0;
  }

  ratio(g = this.gear) {
    const tr = this.cfg.transmission;
    if (g === 0) return 0;
    if (g < 0) return -tr.reverse * tr.final;
    return tr.gears[g - 1] * tr.final;
  }

  get rpm() { return this.we * RPM; }
  get evMode() { return this.cfg.hybrid.enabled && (this.cfg.hybrid.mode === 'ev' || this.cfg.hybrid.evOnly); }

  ignition() {
    if (this.evMode || this.engine.state.broken) return;
    if (this.engineOn) { this.engineOn = false; this.starting = false; return; }
    this.starting = true; this.startTimer = 0; this.stalled = false;
  }

  shift(dir) {
    const tr = this.cfg.transmission;
    const n = tr.gears.length;
    let g = this.gear;
    if (tr.type === 'auto') {
      // automático: R <- N -> D (as marchas dentro do D trocam sozinhas)
      if (dir > 0) g = g < 0 ? 0 : g === 0 ? 1 : g;
      else g = g >= 1 ? 0 : g === 0 && Math.abs(this.v) < 1.5 ? -1 : g;
    } else {
      g += dir;
      if (g < -1) g = -1;
      if (g > n) g = n;
      if (g === -1 && this.v > 1.5) g = 0;
    }
    if (g !== this.gear) this.doShift(g);
  }

  doShift(g) {
    const tr = this.cfg.transmission;
    this.gear = g;
    this.clutchLocked = false;
    if (tr.type === 'auto' || tr.autoClutch) {
      this.shiftTimer = g === 0 ? 0 : tr.shiftTime;
      this.autoE = 0;
    }
    this.shiftCooldown = 0.6;
  }

  autoShift(pedal) {
    const tr = this.cfg.transmission, e = this.cfg.engine;
    if (tr.type !== 'auto' || this.gear < 1 || this.shiftTimer > 0 || this.shiftCooldown > 0) return;
    const n = tr.gears.length;
    const inRpm = Math.abs(this.ww * this.ratio()) * RPM;
    const up = e.redline * (0.45 + 0.5 * pedal);
    const down = e.redline * (0.2 + 0.32 * pedal);
    if (this.rpm > up && inRpm > up * 0.9 && this.gear < n && !this.wheelSpin) this.doShift(this.gear + 1);
    else if (this.gear > 1) {
      const lower = inRpm * tr.gears[this.gear - 2] / tr.gears[this.gear - 1];
      if (inRpm < down && lower < e.redline * 0.88) this.doShift(this.gear - 1);
    }
  }

  clutchEngagement(Gr, pedal) {
    const tr = this.cfg.transmission, idle = this.cfg.engine.idleRpm;
    if (Gr === 0 || this.evMode) return 0;
    if (tr.type === 'auto' || tr.autoClutch) {
      if (this.shiftTimer > 0) { this.autoE = 0; return 0; }
      const inRpm = Math.abs(this.ww * Gr) * RPM;
      let target;
      if (!this.engineOn) target = 0;
      else if (pedal < 0.02 && inRpm < idle * (this.input.brake > 0.05 ? 1.4 : 1.15)) target = 0;
      else if (this.clutchLocked && inRpm > idle * 0.85) target = 1;
      else if (inRpm > idle + 400) target = 1;
      else target = pedal > 0.02 ? clamp((this.rpm - idle - 150) / 1000, 0, 1) : 0;
      const tau = target > this.autoE ? 0.15 : 0.03;
      this.autoE += (target - this.autoE) * Math.min(1, H / tau);
      return this.autoE;
    }
    return 1 - this.input.clutch;
  }

  // aceleração com atrito "seco" (freio, rolamento): não deixa o carro andar para trás sozinho
  frictionAccel(Fnet, Ffric, meff) {
    const v = this.v;
    if (Math.abs(v) < 0.02) {
      if (Math.abs(Fnet) <= Ffric) return -v / H;
      return (Fnet - sgn(Fnet) * Ffric) / meff;
    }
    let a = (Fnet - sgn(v) * Ffric) / meff;
    if (sgn(v + a * H) !== sgn(v)) a = -v / H;
    return a;
  }

  step(dt) {
    let t = dt;
    while (t > 1e-9) { this.substep(); t -= H; }
    this.wheelAngle += this.ww * dt;
  }

  substep() {
    const c = this.cfg, eng = this.engine, tr = c.transmission, veh = c.vehicle, hy = c.hybrid;
    const r = veh.tireRadius, m = this.mass;
    const pedal = clamp(this.input.throttle, 0, 1);
    this.time += H;
    this.shiftTimer = Math.max(0, this.shiftTimer - H);
    this.shiftCooldown = Math.max(0, this.shiftCooldown - H);

    if (this.evMode) { this.engineOn = false; this.starting = false; }
    else if (hy.enabled && !this.engineOn && !this.starting && !this.stalled) { this.starting = true; this.startTimer = 0; }

    this.autoShift(pedal);
    const Gr = this.ratio();
    let rpm = this.rpm;

    // central de marcha lenta (controlador PI na borboleta / na bomba injetora)
    let thr = 0;
    if (this.engineOn) {
      const err = c.engine.idleRpm - rpm;
      this.idleI = clamp(this.idleI + err * H * 0.00012, -0.03, 0.25);
      const idleThr = clamp(0.04 + this.idleI + err * 0.00015, 0, 0.5);
      thr = Math.max(pedal, idleThr);
    } else if (this.starting) thr = eng.isDiesel ? 0.35 : 0.12;
    // corte de giro
    if (rpm > c.engine.redline) this.cut = true;
    else if (rpm < c.engine.redline - 250) this.cut = false;

    // durante a troca automática a central casa o giro (blip / corte)
    const autoClutch = tr.type === 'auto' || tr.autoClutch;
    let revMatch = false;
    if (autoClutch && this.shiftTimer > 0 && Gr !== 0 && this.engineOn) {
      const target = Math.max(c.engine.idleRpm, Math.abs(this.ww * Gr) * RPM);
      revMatch = true;
      thr = target > rpm + 150 ? 0.7 : 0;
    }

    const running = this.engineOn || (this.starting && rpm > 150);
    // corte de combustível em desaceleração (pé fora do acelerador com giro alto)
    if (pedal < 0.01 && rpm > c.engine.idleRpm + 500 && !revMatch) this.decelCut = true;
    else if (pedal > 0.01 || rpm < c.engine.idleRpm + 250) this.decelCut = false;
    const fire = running && !this.cut && !this.decelCut && !(revMatch && thr === 0);
    eng.update(H, rpm, thr, running, this.input.nitro);
    const tel = eng.compute(rpm, thr, eng.state.boost, { fire, nitro: eng.state.nitroActive });
    let Te = tel.torque;

    // motor de partida
    if (this.starting) {
      this.startTimer += H;
      Te += 70 * Math.max(0, 1 - rpm / 320) * (0.6 + 0.4 * eng.dispL / 2);
      if (rpm > c.engine.idleRpm * 0.6 && eng.canIgnite) { this.engineOn = true; this.starting = false; this.idleI = 0; }
      if (this.startTimer > 6) this.starting = false;
    }

    // motor elétrico (híbrido P2: entre embreagem e câmbio, com redução própria)
    let Tm = 0, regenTm = 0;
    this.motorRpm = 0;
    if (hy.enabled && Gr !== 0) {
      const k = hy.motorRatio || 1;
      const wIn = Math.abs(this.ww * Gr);
      const wM = wIn * k;
      this.motorRpm = wM * RPM;
      const Pmax = Math.min(hy.motorKw, hy.batteryKw || 1e9) * 1000;
      let Tavail = Math.min(hy.motorNm, Pmax / Math.max(wM, 1)) * k; // torque no eixo de entrada
      if (this.motorRpm > (hy.motorMaxRpm || 16000)) Tavail *= Math.max(0, 1 - (this.motorRpm - hy.motorMaxRpm) / 500);
      const canUse = this.soc > 0.05, canCharge = this.soc < 0.98;
      const mode = hy.mode;
      if (canUse) {
        if (mode === 'ev' || mode === 'sport') Tm = pedal * Tavail;
        else if (mode === 'hybrid') Tm = pedal * Tavail * (this.v < 15 ? 0.9 : 0.5);
      }
      if (canCharge) {
        if (mode === 'charge' && pedal > 0.05 && this.engineOn) Tm = -0.35 * Tavail;
        const moving = this.v * Gr > 0 && Math.abs(this.v) > 1.5;
        if (moving && this.input.brake > 0) regenTm = -Math.min(1, this.input.brake * 1.5) * hy.regen * Tavail;
        else if (moving && pedal < 0.02) regenTm = -0.25 * hy.regen * Tavail;
        Tm += regenTm;
      }
      const Pm = Tm * wIn;
      this.soc -= (Pm > 0 ? Pm / 0.9 : Pm * 0.9) * H / (hy.batteryKwh * 3.6e6);
      this.soc = clamp(this.soc, 0, 1);
      this.motorPower = Pm;
    } else this.motorPower = 0;
    this.regenForce = Math.abs(regenTm * Gr) / r;
    this.motorTorque = Tm;

    // forças externas
    const theta = this.track.slope(this.x);
    const cos = Math.cos(theta);
    const Faero = 0.5 * 1.2 * veh.cd * veh.area * this.v * Math.abs(this.v);
    const Fgrade = m * G * Math.sin(theta);
    const Froll = 0.012 * m * G * cos;
    // freio combinado: o regenerativo faz parte do trabalho, o disco faz o resto (com ABS)
    const Fbrake = Math.max(0, Math.min(this.input.brake * 1.05, veh.grip * 1.05) * m * G * cos - (this.input.brake > 0 ? this.regenForce : 0));
    const Fext = -Faero - Fgrade;
    const Ffric = Froll + Fbrake;
    const frac = { fwd: 0.62, rwd: 0.48, awd: 1 }[veh.drive];
    const transfer = { fwd: -0.18, rwd: 0.18, awd: 0 }[veh.drive] * this.a / G;
    const Fmax = veh.grip * m * G * cos * clamp(frac + transfer, 0.2, 1);

    const Ie = eng.inertia, Iw = 1.2;
    const eta = 0.92;
    const e = this.clutchEngagement(Gr, pedal);
    const cap = tr.clutchTorque * e;
    const coupled = Gr !== 0 && cap > 0.5;
    let locked = this.clutchLocked && coupled;
    let a = 0;

    if (locked) {
      if (!this.wheelSpin) {
        const meff = m + (Iw + Ie * Gr * Gr) / (r * r);
        const Fdrive = (Te + Tm) * eta * Gr / r;
        a = this.frictionAccel(Fdrive + Fext, Ffric, meff);
        const alphaE = a * Gr / r;
        const Tc = Te - Ie * alphaE;
        if (Math.abs(Tc) > cap) locked = false;
        else {
          const Ftrac = (Tc + Tm) * eta * Gr / r - Iw * a / (r * r);
          if (Math.abs(Ftrac) > Fmax) this.wheelSpin = true;
          this.v += a * H;
          this.ww = this.v / r;
          this.we = this.ww * Gr;
        }
      } else {
        const Iws = Iw + Ie * Gr * Gr;
        const slipDir = sgn(this.ww * r - this.v) || sgn(Te * Gr) || 1;
        const Fx = Fmax * slipDir;
        const alphaW = ((Te + Tm) * eta * Gr - Fx * r - sgn(this.ww) * Fbrake * r * 0.3) / Iws;
        const Tc = Te - Ie * alphaW * Gr;
        if (Math.abs(Tc) > cap) locked = false;
        else {
          this.ww += alphaW * H;
          a = this.frictionAccel(Fx + Fext, Ffric * 0.7, m);
          this.v += a * H;
          if (sgn(this.ww * r - this.v) !== slipDir) { this.wheelSpin = false; this.ww = this.v / r; }
          this.we = this.ww * Gr;
        }
      }
    }

    if (!locked) {
      const dPrev = this.we - this.ww * Gr;
      const Tc = coupled ? cap * sgn(dPrev) : 0;
      if (revMatch) {
        const target = Math.max(c.engine.idleRpm, Math.abs(this.ww * Gr) * RPM) / RPM;
        this.we += (target - this.we) * Math.min(1, H / 0.06);
      } else this.we += (Te - Tc) / Ie * H;
      if (this.we < 0) this.we = 0;
      const Tw = Gr !== 0 ? (Tc + Tm) * eta * Gr : 0;
      if (!this.wheelSpin) {
        const meff = m + Iw / (r * r);
        a = this.frictionAccel(Tw / r + Fext, Ffric, meff);
        const Ftrac = Tw / r - Iw * a / (r * r);
        if (Math.abs(Ftrac) > Fmax && Gr !== 0) this.wheelSpin = true;
        this.v += a * H;
        this.ww = this.v / r;
      } else {
        const slipDir = sgn(this.ww * r - this.v) || sgn(Tw) || 1;
        const Fx = Fmax * slipDir;
        this.ww += (Tw - Fx * r - sgn(this.ww) * Fbrake * r * 0.3) / Iw * H;
        a = this.frictionAccel(Fx + Fext, Ffric * 0.7, m);
        this.v += a * H;
        if (sgn(this.ww * r - this.v) !== slipDir) { this.wheelSpin = false; this.ww = this.v / r; }
      }
      // embreagem "gruda" quando as rotações se igualam
      if (coupled) {
        const d = this.we - this.ww * Gr;
        if ((sgn(d) !== sgn(dPrev) || Math.abs(d) < 0.5) && Math.abs(Te) < cap * 1.2) {
          locked = true;
          this.we = Math.max(0, this.ww * Gr);
        }
      }
    }
    this.clutchLocked = locked;
    this.a = a;
    if (this.we < 0) this.we = 0;

    // motor morreu?
    if (this.engineOn && this.rpm < 280) { this.engineOn = false; this.stalled = true; }

    // posição e contadores
    const dx = this.v * cos * H;
    this.x += dx;
    this.distance += Math.abs(dx);
    this.fuelUsed += tel.fuelFlow * H;
    this.trackRun();

    eng.thermal(H, tel, Math.abs(this.v) * 3.6, this.engineOn);
    if (eng.state.broken && this.engineOn) { this.engineOn = false; this.starting = false; }

    this.tel = tel;
    this.clutchE = e;
  }

  // cronômetro de 0-100 km/h e 400 m (começa quando o carro sai parado)
  trackRun() {
    const v = this.v;
    if (!this.run) {
      if (Math.abs(v) < 0.05) this.armed = true;
      if (this.armed && v > 0.1) { this.run = { t0: this.time, x0: this.x, t100: null, t402: null, v402: null }; this.armed = false; }
      return;
    }
    const run = this.run, t = this.time - run.t0;
    if (!run.t100 && v * 3.6 >= 100) { run.t100 = t; if (!this.best.t100 || t < this.best.t100) this.best.t100 = t; }
    if (!run.t402 && this.x - run.x0 >= 402.3) {
      run.t402 = t; run.v402 = v * 3.6;
      if (!this.best.t402 || t < this.best.t402) { this.best.t402 = t; this.best.v402 = run.v402; }
    }
    run.t = t;
    if (v < 0.05 || (run.t402 && run.t100)) { this.lastRun = run; this.run = null; }
  }

  snapshot() {
    const tel = this.tel || this.engine.compute(0, 0, 0, { fire: false });
    const s = this.engine.state;
    return {
      ...tel,
      rpm: this.rpm, speed: this.v * 3.6, gear: this.gear, gearLabel: this.gearLabel(),
      clutch: this.clutchE ?? 0, clutchLocked: this.clutchLocked, wheelSpin: this.wheelSpin,
      engineOn: this.engineOn, starting: this.starting, stalled: this.stalled, cut: this.cut, decelCut: this.decelCut,
      motorRpm: this.motorRpm || 0,
      flow: this.energyFlow(tel),
      bovEvent: this.takeBov(),
      turboRpm: s.turboRpm, spool: s.spool, nitroKg: s.nitroKg,
      coolant: s.coolant, oilTemp: s.oil, health: s.health, broken: s.broken, cause: s.cause, damageNow: s.damageNow,
      soc: this.soc, motorPower: this.motorPower, motorTorque: this.motorTorque,
      wheelTorque: (tel.torque * (this.clutchLocked ? 1 : 0) + this.motorTorque) * this.ratio(),
      accelG: this.a / G, distance: this.distance, fuelUsed: this.fuelUsed,
      lPer100: this.v > 1 ? (tel.fuelLph / (this.v * 3.6)) * 100 : NaN,
      mass: this.mass, run: this.run || this.lastRun, best: this.best,
      ev: this.evMode,
    };
  }

  // fluxo de energia (kW) para a tela do híbrido
  energyFlow(tel) {
    const engKw = this.engineOn ? Math.max(0, tel.power) / 1000 : 0;
    const motKw = (this.motorPower || 0) / 1000;
    const wheelKw = (this.tel ? 0 : 0) + this.a * this.mass * this.v / 1000;
    return {
      engine: engKw * (this.clutchLocked ? 1 : 0.3),
      motor: motKw,                                   // + tracionando, − gerando
      battery: motKw > 0 ? motKw / 0.9 : motKw * 0.9, // + descarregando, − carregando
      wheels: wheelKw,
      regen: motKw < 0,
      brakeKw: Math.max(0, -wheelKw - Math.max(0, -motKw)),
      soc: this.soc,
      ev: this.evMode, engineOn: this.engineOn, clutch: this.clutchLocked,
    };
  }

  takeBov() { const b = this.engine.state.bovEvent; this.engine.state.bovEvent = null; return b; }

  gearLabel() {
    if (this.gear < 0) return 'R';
    if (this.gear === 0) return 'N';
    return (this.cfg.transmission.type === 'auto' ? 'D' : '') + this.gear;
  }
}
