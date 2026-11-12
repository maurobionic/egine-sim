// Modelo físico (simplificado, mas baseado em equações reais) de um motor a combustão.
//
// Torque = (PMEi - PMEatrito - PMEbombeamento) · Vd / 4π       (motor 4 tempos)
// PMEi   = η · Q / Vd ,  Q = energia do combustível queimado por ciclo
// Massa de ar por ciclo = EV · ρ · Vd   (EV = eficiência volumétrica, ρ = densidade do ar no coletor)
import { FUELS } from './fuels.js';

export const CAMS = {
  eco:    { name: 'Econômico (torque baixo)', peak: 3200, width: 3600, ve: 0.89, floor: 0.66 },
  street: { name: 'Rua',                      peak: 4600, width: 3600, ve: 0.94, floor: 0.62 },
  sport:  { name: 'Esportivo',                peak: 6000, width: 3300, ve: 0.99, floor: 0.57 },
  race:   { name: 'Corrida (bravo)',          peak: 7600, width: 2900, ve: 1.05, floor: 0.48 },
};

export const VALVETRAINS = {
  ohv:     { name: 'OHV (varetas)',               float: 6600,  friction: 0.95, flow: 0.94 },
  sohc:    { name: 'SOHC (1 comando)',            float: 7800,  friction: 1.0,  flow: 0.97 },
  dohc:    { name: 'DOHC (2 comandos)',           float: 9300,  friction: 1.03, flow: 1.0 },
  camless: { name: 'Válvulas eletromagnéticas',   float: 13000, friction: 0.9,  flow: 1.02 },
};

const VALVES = { 2: { flow: 0.93, choke: 7800 }, 3: { flow: 0.97, choke: 9000 }, 4: { flow: 1.0, choke: 10800 }, 5: { flow: 1.01, choke: 11500 } };

export const TURBOS = {
  // full = rotação em que a turbina enche totalmente em plena carga; choke = onde começa a perder fôlego
  // (tamanhos relativos ao motor: "pequena" = pequena para ESTE motor)
  small:  { name: 'Pequena (enche cedo)',   full: 2300, choke: 6200,  tau: 0.22, maxRpm: 230000 },
  medium: { name: 'Média',                  full: 3300, choke: 8500,  tau: 0.45, maxRpm: 185000 },
  large:  { name: 'Grande (lag, muito ar)', full: 5200, choke: 13000, tau: 0.9,  maxRpm: 140000 },
};

const FILTER_K = { paper: 0.06, performance: 0.035, cone: 0.02, none: 0.004 };
const MUFFLER_K = { stock: 0.07, sport: 0.035, straight: 0.012, none: 0 };
const HEADER_K = { cast: 0.05, tubular: 0.03, longtube: 0.022 };
const KNOCK_INJ = { carb: -0.3, port: 0, direct: 1.3, dual: 1.5 };
const EFF_INJ = { carb: -0.02, port: 0, direct: 0.02, dual: 0.025, indirect: -0.08, commonrail: 0.03 };
const VE_INJ = { carb: -0.04, port: 0, direct: 0.01, dual: 0.01, indirect: 0, commonrail: 0 };

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const gauss = (x, mu, w) => Math.exp(-(((x - mu) / w) ** 2));

function camVE(cam, rpm, vvt, k) {
  const peak = cam.peak * k;
  const width = cam.width * k * (vvt ? 1.35 : 1);
  const floor = vvt ? Math.min(0.76, cam.floor + 0.1) : cam.floor;
  const x = (rpm - peak) / width;
  return cam.ve * (floor + (1 - floor) * Math.exp(-x * x));
}

export class Engine {
  constructor(cfg) {
    this.state = {
      boost: 0, spool: 0, turboRpm: 0,
      prevThrottle: 0, bovEvent: null, bovCooldown: 0,
      nitroKg: cfg.nitro.bottleKg, nitroActive: false,
      coolant: 25, oil: 25, health: 1, broken: false, cause: '', damageNow: '',
    };
    this.setConfig(cfg);
  }

  setConfig(cfg) {
    const prevBottle = this.cfg?.nitro?.bottleKg;
    this.cfg = cfg;
    const e = cfg.engine;
    this.fuel = FUELS[cfg.fuel.type] || FUELS.gasolinaComum;
    this.isDiesel = this.fuel.kind === 'diesel';
    this.vd = e.cylinders * Math.PI / 4 * (e.bore / 1000) ** 2 * (e.stroke / 1000); // m³
    this.dispL = this.vd * 1000;
    const fw = { light: 0.6, normal: 1, heavy: 1.6 }[e.flywheel] || 1;
    this.inertia = (0.03 + 0.05 * this.dispL + 0.004 * e.cylinders) * fw * (this.isDiesel ? 1.3 : 1);
    this.canIgnite = !this.isDiesel || e.compression >= 14;
    this.pattern = this.firingPattern();
    if (prevBottle !== cfg.nitro.bottleKg) this.state.nitroKg = cfg.nitro.bottleKg;
    // capacidade do radiador dimensionada para a potência do motor
    let pmax = 0;
    for (let rpm = 1000; rpm <= e.redline; rpm += 500) pmax = Math.max(pmax, this.compute(rpm, 1, this.steadyBoost(rpm, 1), { ignoreDamage: true }).power);
    this.ratedPower = Math.max(20000, pmax);
    this.thermalMass = 20000 + 18000 * this.dispL; // J/K (bloco + líquido de arrefecimento)
  }

  // limites mecânicos: velocidade média do pistão e flutuação de válvula (motor de interferência)
  limits() {
    const e = this.cfg.engine, vt = VALVETRAINS[this.cfg.valvetrain.type];
    const piston = 25.5 * 60 / (2 * e.stroke / 1000) * (this.isDiesel ? 0.85 : 1);
    const valves = vt.float * 1.18;
    return { piston, valves, mech: Math.min(piston, valves) };
  }

  repair() { Object.assign(this.state, { health: 1, broken: false, cause: '', damageNow: '' }); }

  // temperatura (água/óleo) e desgaste/quebra. Chamar a cada passo com a telemetria do motor.
  thermal(dt, tel, airSpeedKmh, running) {
    const s = this.state, c = this.cfg, f = this.fuel;
    const Tamb = 25;
    // calor para a água ≈ 30% da energia do combustível
    const qIn = running ? tel.fuelFlow * f.lhv * 0.3 + Math.max(0, tel.friction) * tel.rpm * Math.PI / 30 * 0.5 : 0;
    const open = smoothstep(84, 96, s.coolant); // válvula termostática
    const fan = s.coolant > 98 ? 0.5 : 0;
    const ua = this.ratedPower * 1.15 / (95 - Tamb) * (0.3 + 0.7 * clamp(airSpeedKmh / 90, 0, 1) + fan); // radiador dimensionado p/ potência máx.
    const qOut = ua * (s.coolant - Tamb) * (0.04 + 0.96 * open) + 15 * (s.coolant - Tamb);
    s.coolant += (qIn - qOut) / this.thermalMass * dt;
    const oilTarget = s.coolant + 8 + 25 * clamp(tel.rpm / c.engine.redline, 0, 1.2) * (running ? 1 : 0);
    s.oil += (oilTarget - s.oil) * Math.min(1, dt / 40);
    if (s.broken) { s.damageNow = ''; return; }

    // causas de dano (fração da vida por segundo)
    const L = this.limits();
    const causes = [];
    if (tel.rpm > L.mech) {
      const over = tel.rpm / L.mech - 1;
      const why = L.valves < L.piston ? 'Válvulas bateram nos pistões (giro acima do limite do comando)' : 'Biela quebrou: velocidade do pistão acima do limite';
      causes.push([over > 0.12 ? 50 : over * 3, why]);
    }
    if (tel.knock > 0 && tel.map > 0.7) causes.push([0.04 * tel.knock * tel.knock * clamp(tel.map, 0, 3), 'Pistão furou por detonação']);
    if (tel.egt > 1000) causes.push([(tel.egt - 1000) / 200 * 0.03, 'Válvula de escape queimou (temperatura do escape alta demais)']);
    if (!this.isDiesel && tel.lambda > 1.08 && tel.throttle > 0.7 && tel.map > 0.9) causes.push([(tel.lambda - 1.08) * 0.25 * tel.map, 'Mistura pobre em carga: pistão derreteu']);
    if (s.coolant > 112) causes.push([(s.coolant - 112) * 0.004, 'Superaqueceu: junta do cabeçote queimou']);
    if (s.oil > 145) causes.push([(s.oil - 145) * 0.003, 'Óleo quente demais: bronzinas fundiram']);
    if (running && s.oil < 40 && tel.rpm > c.engine.redline * 0.75) causes.push([0.002, 'Desgaste: giro alto com motor frio']);
    if (c.intake.induction !== 'na' && s.turboRpm > this.turboParams().maxRpm * 1.04) causes.push([0.05, 'Turbina estourou (rotação acima do limite)']);
    s.damageNow = '';
    for (const [rate, why] of causes) {
      if (rate <= 0) continue;
      s.health -= rate * dt;
      s.damageNow = why;
      if (s.health <= 0) { s.health = 0; s.broken = true; s.cause = why; break; }
    }
  }

  // vazão máxima de ar (CFM) que o motor pede no corte, aspirado
  carbNeedMax() { return this.dispL * this.cfg.engine.redline * 0.017656 * 0.9; }

  refillNitro() { this.state.nitroKg = this.cfg.nitro.bottleKg; }

  // ------------------------------------------------------------------ ordem de ignição
  // Retorna para cada cilindro o ângulo (0..720°) em que ele explode, a bancada (0/1)
  // que leva ao escape e um atraso extra (s) de coletores desiguais.
  firingPattern() {
    const { layout, cylinders: n, vAngle, crankplane } = this.cfg.engine;
    const unequal = this.cfg.exhaust.unequal;
    let list = [];
    if (n === 1) list = [{ angle: 0, bank: 0 }];
    else if ((layout === 'v' || layout === 'w') && n === 2) list = [{ angle: 0, bank: 0 }, { angle: 360 + vAngle, bank: 1 }];
    else if (layout === 'v' && n === 8 && crankplane === 'cross') {
      const banks = [0, 1, 0, 0, 1, 0, 1, 1]; // padrão típico de V8 cruzado: cada bancada dispara irregular
      list = banks.map((b, i) => ({ angle: 90 * i, bank: b }));
    } else if (layout === 'v' && n === 6 && vAngle === 90) {
      const ang = [0, 90, 240, 330, 480, 570]; // V6 90° de ignição irregular
      list = ang.map((a, i) => ({ angle: a, bank: i % 2 }));
    } else {
      list = Array.from({ length: n }, (_, i) => ({ angle: 720 * i / n, bank: i % 2 }));
    }
    return list.map((c, i) => ({
      ...c,
      delay: (unequal ? ((i % 4 === 1 || i % 4 === 2) ? 0.0016 : 0) : 0) + 0.00004 * ((i * 7) % 5),
    }));
  }

  // ------------------------------------------------------------------ eficiência volumétrica
  volumetric(rpm, pr) {
    const c = this.cfg, e = c.engine, v = c.valvetrain;
    const vt = VALVETRAINS[v.type];
    const k = Math.pow(86 / e.stroke, 0.6) * (v.camScale || 1);
    let ve, vtecOn = false;
    if (v.type === 'camless') {
      ve = 0;
      for (const cam of Object.values(CAMS)) ve = Math.max(ve, camVE(cam, rpm, true, k));
    } else if (v.vtec && rpm >= v.vtecRpm && !this.isDiesel) {
      vtecOn = true;
      ve = camVE(CAMS[v.vtecCam], rpm, v.vvt, k);
    } else {
      ve = camVE(CAMS[v.cam], rpm, v.vvt, k);
    }
    ve *= vt.flow * (VALVES[v.valvesPerCyl]?.flow ?? 1) * (e.veScale || 1);
    if (e.atkinson) ve *= 0.8; // ciclo Atkinson: fecha a admissão tarde, enche menos

    // coletor de admissão sintonizado (ressonância de Helmholtz simplificada)
    const tune = 1.75e6 / c.intake.runnerLength;
    ve += 0.06 * gauss(rpm, tune, 1700);
    if (c.intake.throttle === 'itb') ve += 0.03;
    // coletor de escape: efeito de "scavenging"
    if (c.exhaust.headers === 'tubular') ve += 0.025 * gauss(rpm, 5500 * k, 2500);
    if (c.exhaust.headers === 'longtube') ve += 0.05 * gauss(rpm, 4500 * k, 2200);
    ve += VE_INJ[c.fuel.injection] || 0;

    // limite de fluxo das válvulas (o motor "sufoca" em giro alto)
    const choke = (VALVES[v.valvesPerCyl]?.choke ?? 10000) * (86 / e.stroke);
    ve /= 1 + Math.pow(rpm / choke, 6);
    // flutuação de válvula
    let floating = false;
    if (rpm > vt.float) { ve *= Math.exp(-(((rpm - vt.float) / 700) ** 2)); floating = true; }

    // restrições: filtro, catalisador, abafador, diâmetro do escape
    const q = this.dispL * rpm / 14000 * pr; // 1.0 = 2.0 L a 7000 rpm aspirado
    const qIn = q / Math.pow(Math.max(this.dispL / 2, 0.25), 0.75);
    const pipes = c.exhaust.layout === 'dual' ? 2 : 1;
    const area = pipes * (c.exhaust.diameter / 55) ** 2;
    const qEx = q / area;
    const ind = c.intake.induction;
    const kIn = 0.4 * FILTER_K[c.intake.filter];
    const kEx = 0.4 * (HEADER_K[c.exhaust.headers] + (c.exhaust.cat ? 0.04 : 0) + MUFFLER_K[c.exhaust.muffler]
      + (c.exhaust.resonator ? 0.01 : 0) + (ind === 'turbo' ? 0.06 : ind === 'twinturbo' ? 0.045 : 0));
    const restriction = kIn * qIn * qIn + kEx * qEx * qEx;
    ve /= 1 + restriction;
    // carburador: venturi pequeno demais estrangula em giro alto
    if (c.fuel.injection === 'carb') {
      const cfmNeed = this.dispL * rpm * 0.017656 * pr * 0.9; // CFM = pol³·rpm/3456·EV
      ve /= 1 + 0.12 * (cfmNeed / c.fuel.carbCfm) ** 2;
    }
    // escape grande demais perde velocidade dos gases em baixa
    const oversize = area / Math.max(this.dispL / 2, 0.2);
    if (oversize > 1.4) ve -= 0.03 * Math.min(2, oversize - 1.4) * Math.exp(-rpm / 3000);

    return { ve: Math.max(0.03, ve), vtecOn, floating, backpressure: kEx * qEx * qEx };
  }

  // ------------------------------------------------------------------ sobrealimentação
  turboParams() {
    const t = { ...TURBOS[this.cfg.intake.turboSize] };
    if (this.cfg.intake.induction === 'twinturbo') { t.full *= 0.78; t.tau *= 0.7; t.choke *= 1.5; }
    return t;
  }

  spoolTarget(rpm, thr) {
    const t = this.turboParams();
    const load = this.isDiesel ? 0.2 + 0.8 * thr : 0.25 + 0.75 * thr;
    const e = rpm * load;
    return { spool: smoothstep(0.35 * t.full, t.full, e), choke: e > t.choke ? clamp(1 - (e - t.choke) / t.choke, 0.55, 1) : 1 };
  }

  boostTarget(rpm, thr, spool, choke) {
    const c = this.cfg, B = c.intake.boost;
    const ind = c.intake.induction;
    if (ind === 'na') return 0;
    const gate = this.isDiesel ? 1 : smoothstep(0.1, 0.75, thr);
    if (ind === 'supercharger') return B * Math.pow(clamp(rpm / (0.6 * c.engine.redline), 0, 1), 0.8) * gate;
    return B * spool * choke * gate;
  }

  // Boost em regime permanente (sem lag) – usado nas curvas de dinamômetro
  steadyBoost(rpm, thr) {
    const s = this.spoolTarget(rpm, thr);
    return this.boostTarget(rpm, thr, s.spool, s.choke);
  }

  // Avança a dinâmica da turbina / compressor / nitro
  update(dt, rpm, thr, running, wantNitro) {
    const c = this.cfg, s = this.state, ind = c.intake.induction;
    // nitro
    const n = c.nitro;
    s.nitroActive = !!(n.enabled && wantNitro && running && !this.isDiesel && s.nitroKg > 0 && thr > 0.85 && rpm > n.minRpm);
    if (s.nitroActive) s.nitroKg = Math.max(0, s.nitroKg - n.shot * 0.00045 * dt);

    s.bovCooldown = Math.max(0, s.bovCooldown - dt);
    if (ind === 'na') { s.boost = 0; s.spool = 0; s.turboRpm = 0; s.prevThrottle = thr; return; }
    if (ind === 'supercharger') {
      const target = running ? this.boostTarget(rpm, thr, 1, 1) : 0;
      s.boost += (target - s.boost) * Math.min(1, dt / 0.08);
      s.spool = rpm / c.engine.redline;
      s.turboRpm = rpm * 2.6;
      s.prevThrottle = thr;
      return;
    }
    const t = this.turboParams();
    const st = running ? this.spoolTarget(rpm, thr) : { spool: 0, choke: 1 };
    const tau = st.spool > s.spool ? t.tau : t.tau * 1.6;
    s.spool += (st.spool - s.spool) * Math.min(1, dt / tau);
    const target = this.boostTarget(rpm, thr, s.spool, st.choke);
    // fechou a borboleta com pressão: válvula de alívio (ou "flutter" sem ela)
    if (!this.isDiesel && s.prevThrottle - thr > 0.3 && s.boost > 0.25 && s.bovCooldown <= 0) {
      s.bovEvent = { type: c.intake.blowoff ? 'bov' : 'flutter', strength: Math.min(1, s.boost / 1.5) };
      s.bovCooldown = 0.6;
      if (c.intake.blowoff) s.spool *= 0.85; else s.spool *= 0.7;
    }
    const down = c.intake.blowoff || this.isDiesel ? 0.07 : 0.3;
    s.boost += (target - s.boost) * Math.min(1, dt / (target > s.boost ? 0.06 : down));
    s.turboRpm = t.maxRpm * (0.06 + 0.94 * s.spool) * (running ? 1 : s.spool);
    s.prevThrottle = thr;
  }

  // ------------------------------------------------------------------ cálculo do torque
  // rpm, acelerador 0..1, boost atual (bar). opts.fire = há combustão; opts.nitro = nitro aberto
  compute(rpm, thr, boost, opts = {}) {
    const c = this.cfg, e = c.engine, f = this.fuel;
    const broken = this.state.broken && !opts.ignoreDamage;
    const fire = (opts.fire ?? true) && this.canIgnite && !broken;
    const nitro = !!opts.nitro && fire;
    rpm = Math.max(0, rpm);
    thr = clamp(thr, 0, 1);
    const vt = VALVETRAINS[c.valvetrain.type];
    const camless = c.valvetrain.type === 'camless';
    const ind = c.intake.induction;
    const omega = rpm * Math.PI / 30;
    const N = rpm / 1000, sf = e.stroke / 86;

    // atrito (PME de atrito, Pa)
    let fmep = (0.5 + 0.09 * N * sf + 0.022 * N * N * sf) * vt.friction * (this.isDiesel ? 1.2 : 1) * 1e5;
    if (rpm < 60) fmep *= rpm / 60;
    if (broken) fmep *= 6; // motor quebrado trava

    // pressão no coletor
    const itb = c.intake.throttle === 'itb';
    const aeff = itb ? Math.pow(thr, 1.5) * 1.6 : thr * thr;
    let charge = Math.max(0.1, 1 / Math.sqrt(1 + ((0.12 * (rpm / 7000)) / Math.max(aeff, 1e-4)) ** 2));
    if (this.isDiesel) charge = 1; // diesel não tem borboleta: a carga é controlada pela quantidade de diesel
    const pr = charge * (1 + boost);

    // temperatura do ar admitido
    const Tamb = 300;
    let Tc = Tamb, compRise = 0;
    if (boost > 0.01) {
      compRise = Tamb * ((Math.pow(1 + boost, 0.286) - 1) / 0.7);
      Tc += compRise * (c.intake.intercooler ? 0.25 : 1);
    }
    const directish = ['direct', 'dual', 'commonrail'].includes(c.fuel.injection);
    Tc -= f.cool * (directish ? 1 : 0.6);
    if (nitro) Tc -= 25;

    const rho = pr * 101325 / (287 * Tc);
    const V = this.volumetric(rpm, pr);
    const mAir = V.ve * rho * this.vd; // kg de ar por ciclo (todos os cilindros)
    const cyclesPerSec = rpm / 120;
    const mN2O = nitro && cyclesPerSec > 0 ? c.nitro.shot * 0.00045 / cyclesPerSec : 0;
    const mOx = mAir + mN2O * 1.57; // N2O carrega ~36% de oxigênio (ar: 23%)

    // combustível e mistura
    let lambda, mFuel, burnFactor, smoke = 0;
    if (this.isDiesel) {
      const mMax = mOx / (f.afr * c.fuel.smokeLambda);
      mFuel = fire ? mMax * thr : 0;
      lambda = mFuel > 0 ? mOx / (f.afr * mFuel) : 9.99;
      burnFactor = 1 - 0.25 * Math.max(0, 1.3 - lambda) ** 2;
      smoke = fire ? clamp((1.55 - lambda) / 0.45, 0, 1) : 0;
    } else if (c.fuel.injection === 'carb') {
      // carburador: a mistura depende do gicleur (alta) e do parafuso da lenta (baixa); não há sonda corrigindo
      const cfmNeed = this.dispL * rpm * 0.017656 * pr * 0.9;
      const flowFrac = clamp(cfmNeed / c.fuel.carbCfm, 0, 1.5);
      const main = 0.93 - c.fuel.carbJet * 0.012 - 0.04 * Math.max(0, flowFrac - 0.9); // venturi saturado enriquece
      const idle = 0.95 - c.fuel.idleMix * 0.12;
      lambda = idle + (main - idle) * smoothstep(0.04, 0.2, flowFrac);
      // "buraco" de aceleração quando o carburador é grande demais para o giro
      if (flowFrac < 0.25 && thr > 0.5) lambda += 0.12 * (1 - flowFrac / 0.25);
      if (nitro) lambda = Math.min(lambda, 0.82);
      mFuel = fire ? mOx / (f.afr * lambda) : 0;
      burnFactor = clamp(1 - 1.0 * (lambda - 0.88) ** 2, 0.4, 1);
    } else {
      // em carga parcial a central roda λ=1; em plena carga enriquece até o alvo
      lambda = 1 + (c.fuel.lambda - 1) * smoothstep(0.55, 0.95, Math.max(thr, boost > 0.2 ? 1 : 0));
      if (nitro) lambda = Math.min(lambda, 0.82);
      mFuel = fire ? mOx / (f.afr * lambda) : 0;
      burnFactor = clamp(1 - 1.0 * (lambda - 0.88) ** 2, 0.4, 1);
    }
    // limite de vazão: bicos injetores e bomba de combustível
    let injDuty = NaN, pumpUse = NaN, fuelStarved = false;
    if (fire && cyclesPerSec > 0) {
      const need = mFuel * cyclesPerSec; // kg/s
      const pumpMax = c.fuel.pumpLph / 3600 * f.density;
      let max = pumpMax;
      if (c.fuel.injection !== 'carb') {
        const refBar = { port: 3, direct: 200, dual: 200, indirect: 150, commonrail: 1600 }[c.fuel.injection] || 3;
        const pScale = Math.sqrt(Math.max(0.1, (c.fuel.pressureBar || refBar) / refBar)); // vazão ∝ √pressão
        const injMax = e.cylinders * c.fuel.injectorCc * pScale / 60 / 1000 * f.density * (this.isDiesel ? 1 : 0.9);
        injDuty = need / injMax * 0.9;
        max = Math.min(max, injMax);
      }
      pumpUse = need / pumpMax;
      if (need > max) {
        fuelStarved = true;
        mFuel = max / cyclesPerSec;
        lambda = mOx / (f.afr * mFuel);
        burnFactor = this.isDiesel ? burnFactor : clamp(1 - 1.0 * (lambda - 0.88) ** 2, 0.4, 1);
      }
    }
    const burnable = Math.min(mFuel, mOx / f.afr);
    const energy = burnable * f.lhv * burnFactor;

    // eficiência térmica (ciclo Otto ideal corrigido)
    const cr = e.compression;
    let eta = 0.74 * (1 - Math.pow(cr, -0.3)) * (this.isDiesel ? 0.95 : 1);
    eta *= 1 - 0.1 * Math.exp(-rpm / 1500);
    eta *= 1 + (EFF_INJ[c.fuel.injection] || 0) + f.effBonus;
    if (c.fuel.injection === 'carb' && c.fuel.carbCfm > 1.4 * this.carbNeedMax()) eta *= 1 - 0.05 * Math.exp(-rpm / 2500);

    // ignição: distribuidor tem limite de faíscas por segundo -> falhas em giro alto
    let misfire = 0;
    if (!this.isDiesel) {
      const sparksMax = { distributor: 420, wasted: 900, cop: 1e9 }[c.ignition.type] ?? 1e9;
      const rpmLimit = sparksMax * 120 / e.cylinders;
      misfire = 0.4 * smoothstep(0.75 * rpmLimit, 1.1 * rpmLimit, rpm);
      if (c.fuel.injection === 'carb' && lambda > 1.12) misfire = Math.max(misfire, clamp((lambda - 1.12) * 3, 0, 0.5));
    }

    // detonação (só ciclo Otto): a central atrasa o ponto quando passa do limite
    let retard = 0, knock = 0, timing = c.fuel.timing;
    if (!this.isDiesel) {
      const limit = f.knock + (KNOCK_INJ[c.fuel.injection] || 0);
      let demand = cr * (e.atkinson ? 0.78 : 1) * Math.pow(pr, 0.35) * Math.pow(Tc / 300, 1.4) * (1 + 0.12 * clamp(1 - rpm / 4000, 0, 1));
      demand += Math.max(0, lambda - 0.85) * 5 - Math.max(0, 0.85 - lambda) * 3 + timing * 0.2;
      if (nitro) demand += 2.5 * mN2O / Math.max(mAir, 1e-9);
      const loadW = smoothstep(0.35, 0.8, pr);
      const excess = (demand - limit) * loadW;
      if (c.ignition.type !== 'distributor') {
        // central com sensor de detonação: atrasa o ponto
        retard = Math.max(0, excess) * 3;
        knock = clamp((retard - 8) / 10, 0, 1);
        timing -= retard;
      } else {
        // distribuidor (sem sensor): ninguém corrige -> detona de verdade e perde potência
        knock = clamp(excess / 2.5, 0, 1);
        eta *= 1 - 0.22 * knock;
      }
      const dt = Math.abs(timing - 4); // ponto ótimo (MBT) = +4° sobre o mapa base
      eta *= clamp(1 - 0.0004 * dt * dt - 0.006 * dt, 0.4, 1);
    }

    const Wi = fire ? eta * energy * (1 - misfire) : 0;
    const imep = Wi / this.vd;
    let pmep = (camless ? 0.15 : c.valvetrain.variableLift ? 0.4 : e.atkinson ? 0.7 : 0.95) * (1 - charge) * 1e5 + V.backpressure * 0.6e5;
    if (ind === 'turbo' || ind === 'twinturbo') pmep += 0.1e5 * boost;
    let torque = (imep - fmep - pmep) * this.vd / (4 * Math.PI);
    if (rpm < 5 && torque < 0) torque *= rpm / 5;

    // supercharger rouba potência do virabrequim
    let airflow = mAir * cyclesPerSec; // kg/s
    let scLoss = 0;
    if (ind === 'supercharger' && omega > 1) scLoss = (airflow * 1005 * compRise / 0.75) / omega;
    torque -= scLoss;
    // limitador de torque da central (motores turbo modernos: "platô" de torque)
    let limited = 1;
    if (e.torqueLimit > 0 && torque > e.torqueLimit && fire) {
      const tf = torque + (fmep + pmep) * this.vd / (4 * Math.PI);
      const want = e.torqueLimit + (fmep + pmep) * this.vd / (4 * Math.PI);
      limited = want / tf;
      torque = e.torqueLimit;
    }

    airflow *= limited;
    const fuelFlow = mFuel * cyclesPerSec * limited; // kg/s
    const power = torque * omega;
    const loadFrac = clamp(imep / 14e5, 0, 2);
    const egt = this.isDiesel
      ? 250 + 520 * clamp(1.6 / Math.max(lambda, 1), 0, 1.3) * Math.min(1, loadFrac + 0.2)
      : fire ? 520 + 330 * Math.min(1.2, loadFrac) + 18 * retard + (lambda > 1 ? (lambda - 1) * 500 : -(1 - lambda) * 350) : 200;

    return {
      rpm, torque, power, throttle: thr,
      ve: V.ve, vtecOn: V.vtecOn, floating: V.floating,
      map: pr, charge, boost, intakeTemp: Tc - 273.15,
      airflow, fuelFlow, lambda: fire ? lambda : NaN, afr: fire ? lambda * f.afr : NaN,
      fuelLph: fuelFlow / f.density * 3600,
      bsfc: power > 1000 ? fuelFlow / (power / 1000) * 3.6e6 : NaN, // g/kWh
      retard, knock, timing, eta, egt, smoke, nitro, nitroFlow: nitro ? c.nitro.shot * 0.00045 : 0,
      misfire, injDuty, pumpUse, fuelStarved,
      friction: fmep * this.vd / (4 * Math.PI),
      imep, scLoss,
    };
  }

  // Curva de dinamômetro em regime permanente
  curve(throttle = 1, opts = {}) {
    const pts = [];
    const max = this.cfg.engine.redline;
    for (let rpm = 800; rpm <= max; rpm += 100) {
      const b = this.steadyBoost(rpm, throttle);
      const r = this.compute(rpm, throttle, b, { ignoreDamage: true, nitro: opts.nitro && rpm > this.cfg.nitro.minRpm && throttle > 0.85 });
      pts.push({ rpm, torque: r.torque, power: r.power, boost: b, ve: r.ve, lambda: r.lambda, retard: r.retard, vtec: r.vtecOn, floating: r.floating });
    }
    return pts;
  }
}

export const hp = (w) => w / 735.5;   // cavalo-vapor (cv)
export const kw = (w) => w / 1000;
