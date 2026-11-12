// Configuração padrão do projeto, presets e o "planejador" que gera um projeto base.
import { FUELS, isDieselFuel } from './fuels.js';

export const DEFAULT_CONFIG = {
  name: 'Meu motor',
  engine: {
    layout: 'inline',      // inline | v | boxer
    cylinders: 4,
    vAngle: 90,
    crankplane: 'cross',   // V8: cross (virabrequim cruzado) | flat (plano)
    bore: 86,              // mm
    stroke: 86,            // mm
    compression: 10.5,
    redline: 7500,         // corte de giro
    idleRpm: 850,
    flywheel: 'normal',    // light | normal | heavy
    atkinson: false,       // ciclo Atkinson (híbridos)
    torqueLimit: 0,        // limitador de torque da central (N·m, 0 = sem limite)
    veScale: 1,            // calibração de enchimento (ajusta o modelo a um motor real)
  },
  valvetrain: {
    type: 'dohc',          // ohv | sohc | dohc | camless (válvulas eletromagnéticas)
    valvesPerCyl: 4,
    cam: 'street',         // eco | street | sport | race
    vvt: true,             // comando variável contínuo
    vtec: false,           // comando escalonado (2 perfis)
    vtecRpm: 5500,
    vtecCam: 'race',
    camScale: 1,           // calibração: desloca a faixa de giro dos comandos
    variableLift: false,   // levante variável contínuo (tipo Valvetronic): quase sem perda de bombeamento
  },
  intake: {
    filter: 'paper',       // paper | performance | cone | none
    throttle: 'single',    // single | itb (borboletas individuais)
    runnerLength: 350,     // mm – coletor de admissão
    induction: 'na',       // na | turbo | twinturbo | supercharger
    boost: 0.8,            // bar
    turboSize: 'medium',   // small | medium | large
    intercooler: true,
    blowoff: true,
  },
  nitro: {
    enabled: false,
    shot: 75,              // "cv" nominais do kit
    bottleKg: 4.5,
    minRpm: 3000,
  },
  fuel: {
    type: 'gasolinaComum',
    injection: 'port',     // otto: carb | port | direct | dual  · diesel: indirect | direct | commonrail
    lambda: 0.88,          // mistura em plena carga (otto)
    smokeLambda: 1.3,      // limite de fumaça (diesel) – menor = mais potência e mais fumaça
    timing: 0,             // avanço de ignição (° em relação ao mapa base)
    injectorCc: 440,       // vazão de cada bico (cc/min)
    pumpLph: 190,          // vazão da bomba de combustível (L/h)
    pressureBar: 0,        // pressão de linha / rail (bar) · 0 = padrão do tipo de injeção
    carbCfm: 450,          // tamanho do carburador (CFM)
    carbJet: 0,            // gicleur principal: + enriquece / - empobrece (passos)
    idleMix: 0,            // parafuso de mistura da lenta (-1 pobre … +1 rica)
  },
  ignition: {
    type: 'cop',           // distributor | wasted (centelha perdida) | cop (bobina por cilindro)
  },
  exhaust: {
    headers: 'cast',       // cast | tubular | longtube
    unequal: false,        // coletor de comprimentos desiguais (ronco "boxer")
    layout: 'single',      // single | dual
    diameter: 55,          // mm
    length: 3.0,           // m
    cat: true,
    muffler: 'stock',      // stock | sport | straight | none
    resonator: true,
  },
  hybrid: {
    enabled: false,
    motorKw: 30,
    batteryKwh: 1.5,
    motorNm: 200,          // torque máximo do motor elétrico
    regen: 0.6,            // força do freio regenerativo (0..1)
    mode: 'hybrid',        // hybrid | sport | ev | charge
    evOnly: false,         // carro 100% elétrico (sem motor a combustão)
    motorRatio: 1,         // redução própria do motor elétrico
    motorMaxRpm: 16000,
    batteryKw: 150,        // potência máxima da bateria
    batteryKg: 0,          // 0 = estimado
  },
  transmission: {
    type: 'manual',        // manual | auto
    autoClutch: true,
    gears: [3.42, 2.05, 1.45, 1.13, 0.92, 0.79],
    final: 4.1,
    reverse: 3.3,
    clutchTorque: 350,     // Nm
    shiftTime: 0.25,       // s
  },
  vehicle: {
    mass: 1050,            // kg do carro SEM o motor (o peso do motor é somado)
    drive: 'fwd',          // fwd | rwd | awd
    cd: 0.32,
    area: 2.0,
    tireRadius: 0.30,
    grip: 1.0,
  },
};

export const clone = (o) => JSON.parse(JSON.stringify(o));

export function deepMerge(base, over) {
  const out = clone(base);
  (function merge(t, s) {
    for (const k of Object.keys(s || {})) {
      if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) {
        if (!t[k] || typeof t[k] !== 'object') t[k] = {};
        merge(t[k], s[k]);
      } else t[k] = Array.isArray(s[k]) ? s[k].slice() : s[k];
    }
  })(out, over);
  return out;
}

export function displacementL(cfg) {
  const e = cfg.engine;
  return e.cylinders * Math.PI / 4 * (e.bore / 10) ** 2 * (e.stroke / 10) / 1000;
}

// Peso estimado do motor + periféricos (kg)
export function engineWeight(cfg) {
  const d = displacementL(cfg);
  let w = 45 + 28 * d + 5 * cfg.engine.cylinders;
  if (cfg.engine.layout === 'v') w *= 0.95;
  if (isDieselFuel(cfg.fuel.type)) w *= 1.3;
  if (cfg.intake.induction === 'turbo') w += 14;
  if (cfg.intake.induction === 'twinturbo') w += 26;
  if (cfg.intake.induction === 'supercharger') w += 18;
  if (cfg.intake.intercooler && cfg.intake.induction !== 'na') w += 8;
  if (cfg.nitro.enabled) w += 8 + cfg.nitro.bottleKg;
  if (cfg.valvetrain.type === 'camless') w += 6;
  const elec = cfg.hybrid.enabled ? cfg.hybrid.motorKw * 0.35 + 10 + (cfg.hybrid.batteryKg || cfg.hybrid.batteryKwh * 6.5 + 8) : 0;
  if (cfg.hybrid.enabled && cfg.hybrid.evOnly) return Math.round(elec);
  w += elec;
  return Math.round(w);
}

// Custo estimado (R$) – só para dar noção de "orçamento" como num tycoon
export function estimateCost(cfg) {
  const d = displacementL(cfg);
  let c = 9000 + 6000 * d + 1500 * cfg.engine.cylinders;
  c *= { ohv: 0.85, sohc: 0.95, dohc: 1.1, camless: 1.9 }[cfg.valvetrain.type];
  if (cfg.valvetrain.vvt) c += 1800;
  if (cfg.valvetrain.vtec) c += 2500;
  c += { na: 0, turbo: 9000, twinturbo: 17000, supercharger: 12000 }[cfg.intake.induction];
  if (cfg.intake.throttle === 'itb') c += 6000;
  c += { carb: -1500, port: 0, direct: 3500, dual: 6000, indirect: 0, commonrail: 7000 }[cfg.fuel.injection] || 0;
  c += { cast: 0, tubular: 2500, longtube: 4500 }[cfg.exhaust.headers];
  if (cfg.exhaust.layout === 'dual') c += 2000;
  if (cfg.nitro.enabled) c += 4500;
  if (cfg.hybrid.enabled) c += cfg.hybrid.motorKw * 250 + cfg.hybrid.batteryKwh * 3500;
  c += (cfg.transmission.type === 'auto' ? 9000 : 5000) + cfg.transmission.gears.length * 600;
  return Math.round(c / 100) * 100;
}

// Gera relações de marcha em progressão geométrica
export function makeGears(n, first, last) {
  if (n === 1) return [first];
  const k = Math.pow(last / first, 1 / (n - 1));
  // leve "fechamento" das marchas altas, como nos câmbios reais
  return Array.from({ length: n }, (_, i) => +(first * Math.pow(k, i) * (1 + 0.04 * Math.sin(Math.PI * i / (n - 1)))).toFixed(2));
}

export function injectionOptions(fuelKey) {
  return isDieselFuel(fuelKey)
    ? [['indirect', 'Indireta (pré-câmara)'], ['direct', 'Direta mecânica'], ['commonrail', 'Direta common-rail']]
    : [['carb', 'Carburador'], ['port', 'Indireta (no coletor / MPFI)'], ['direct', 'Injeção direta (GDI)'], ['dual', 'Dupla (direta + indireta)']];
}

export function defaultPressure(inj) {
  return { carb: 0.3, port: 3.5, direct: 200, dual: 250, indirect: 150, commonrail: 1600 }[inj] || 3;
}

// Ajusta o projeto quando o combustível muda de ciclo (Otto <-> Diesel)
export function normalizeConfig(cfg) {
  const diesel = isDieselFuel(cfg.fuel.type);
  const valid = injectionOptions(cfg.fuel.type).map((o) => o[0]);
  if (!valid.includes(cfg.fuel.injection)) { cfg.fuel.injection = diesel ? 'commonrail' : 'port'; cfg.fuel.pressureBar = defaultPressure(cfg.fuel.injection); }
  if (cfg.engine.layout !== 'v' && cfg.engine.cylinders === 16) cfg.engine.layout = 'v';
  if (cfg.engine.layout === 'boxer' && cfg.engine.cylinders % 2) cfg.engine.layout = 'inline';
  if ((cfg.engine.layout === 'v' || cfg.engine.layout === 'w') && cfg.engine.cylinders % 2) cfg.engine.layout = 'inline';
  if (cfg.hybrid.evOnly) { cfg.hybrid.enabled = true; cfg.hybrid.mode = 'ev'; }
  const pDef = defaultPressure(cfg.fuel.injection);
  if (!cfg.fuel.pressureBar || cfg.fuel.pressureBar < pDef * 0.2 || cfg.fuel.pressureBar > pDef * 8) cfg.fuel.pressureBar = pDef;
  if (!FUELS[cfg.fuel.type]) cfg.fuel.type = 'gasolinaComum';
  return cfg;
}

// ---------------------------------------------------------------------------
// Planejador: transforma objetivos em um projeto base que depois é montado peça a peça
export const PLAN_DEFAULT = {
  goal: 'sport',           // eco | sport | drag | track | truck
  fuel: 'gasolinaComum',
  aspiration: 'na',        // na | turbo | twinturbo | supercharger
  nitro: false,
  layout: 'inline',
  cylinders: 4,
  displacement: 2.0,       // L
  powertrain: 'ice',       // ice | hybrid
  drive: 'fwd',
  gearbox: 'manual',
  body: 'hatch',           // hatch | sedan | coupe | pickup | kart
  fuelSystem: 'injection', // injection | carb
};

const GOALS = {
  eco:   { name: 'Rua econômico', bs: 0.92, cam: 'eco', redline: 6200, cr: 11.5, boost: 0.7, turbo: 'small', exhaust: 'stock', headers: 'cast', lambda: 0.92 },
  sport: { name: 'Esportivo de rua', bs: 1.05, cam: 'street', redline: 7500, cr: 10.8, boost: 1.0, turbo: 'medium', exhaust: 'sport', headers: 'tubular', lambda: 0.88 },
  track: { name: 'Pista / track day', bs: 1.15, cam: 'sport', redline: 8600, cr: 11.8, boost: 1.2, turbo: 'medium', exhaust: 'straight', headers: 'longtube', lambda: 0.87 },
  drag:  { name: 'Arrancada', bs: 1.1, cam: 'race', redline: 8800, cr: 10.5, boost: 2.0, turbo: 'large', exhaust: 'none', headers: 'longtube', lambda: 0.82 },
  truck: { name: 'Trabalho / torque', bs: 0.88, cam: 'eco', redline: 5200, cr: 10.0, boost: 1.0, turbo: 'medium', exhaust: 'stock', headers: 'cast', lambda: 0.9 },
};
export const GOAL_NAMES = Object.fromEntries(Object.entries(GOALS).map(([k, v]) => [k, v.name]));

const BODIES = {
  kart:   { name: 'Kart / gaiola leve', mass: 220, cd: 0.6, area: 1.0, r: 0.14, grip: 1.15 },
  hatch:  { name: 'Hatch', mass: 900, cd: 0.32, area: 2.0, r: 0.30, grip: 1.0 },
  sedan:  { name: 'Sedã', mass: 1150, cd: 0.29, area: 2.2, r: 0.32, grip: 1.0 },
  coupe:  { name: 'Cupê esportivo', mass: 1100, cd: 0.30, area: 1.95, r: 0.33, grip: 1.12 },
  pickup: { name: 'Picape', mass: 1700, cd: 0.42, area: 2.9, r: 0.38, grip: 0.95 },
};
export const BODY_NAMES = Object.fromEntries(Object.entries(BODIES).map(([k, v]) => [k, v.name]));

export function planToConfig(plan) {
  const g = GOALS[plan.goal] || GOALS.sport;
  const b = BODIES[plan.body] || BODIES.hatch;
  const diesel = isDieselFuel(plan.fuel);
  const cfg = clone(DEFAULT_CONFIG);
  const n = plan.cylinders;
  // diâmetro/curso a partir da cilindrada desejada e da relação D/C
  const bs = diesel ? 0.88 : g.bs;
  const volCyl = plan.displacement * 1e6 / n; // mm³ por cilindro
  const strokeMm = Math.cbrt(volCyl / (Math.PI / 4 * bs * bs));
  const boreMm = strokeMm * bs;
  let layout = plan.layout;
  if ((layout === 'v' || layout === 'boxer') && n % 2) layout = 'inline';
  if (n >= 10 && layout === 'inline') layout = 'v';
  Object.assign(cfg.engine, {
    layout, cylinders: n,
    vAngle: n === 6 ? 60 : n === 12 ? 60 : n === 10 ? 72 : n === 2 ? 45 : 90,
    crankplane: plan.goal === 'track' ? 'flat' : 'cross',
    bore: +boreMm.toFixed(1), stroke: +strokeMm.toFixed(1),
    redline: diesel ? 4600 : g.redline,
    idleRpm: diesel ? 750 : g.cam === 'race' ? 1100 : 850,
    flywheel: plan.goal === 'track' || plan.goal === 'drag' ? 'light' : diesel ? 'heavy' : 'normal',
  });
  const boosted = plan.aspiration !== 'na';
  cfg.engine.compression = diesel ? (boosted ? 16.5 : 19) : +(g.cr - (boosted ? 1.4 + g.boost * 0.5 : 0)
    + (plan.fuel === 'etanol' || plan.fuel === 'metanol' || plan.fuel === 'e85' ? 1.8 : 0)).toFixed(1);

  Object.assign(cfg.valvetrain, {
    type: diesel ? 'sohc' : plan.goal === 'truck' ? 'ohv' : 'dohc',
    valvesPerCyl: diesel ? 2 : plan.goal === 'truck' ? 2 : 4,
    cam: diesel ? 'eco' : g.cam,
    vvt: !diesel && plan.goal !== 'truck',
    vtec: !diesel && plan.goal === 'track' && !boosted,
    vtecRpm: 5800, vtecCam: 'race',
  });
  if (cfg.valvetrain.vtec) cfg.valvetrain.cam = 'street';

  Object.assign(cfg.intake, {
    induction: plan.aspiration,
    boost: diesel ? 1.4 : g.boost,
    turboSize: diesel ? 'medium' : g.turbo,
    intercooler: boosted,
    blowoff: !diesel,
    filter: plan.goal === 'eco' || plan.goal === 'truck' ? 'paper' : plan.goal === 'sport' ? 'performance' : 'cone',
    throttle: plan.goal === 'track' && !boosted ? 'itb' : 'single',
    runnerLength: Math.round(diesel ? 450 : 1.75e6 / (g.redline * 0.72)),
  });
  cfg.nitro.enabled = !!plan.nitro && !diesel;
  cfg.nitro.shot = Math.round(Math.min(150, 40 + plan.displacement * 25) / 5) * 5;

  cfg.fuel.type = plan.fuel;
  cfg.fuel.injection = diesel ? 'commonrail' : plan.goal === 'eco' ? 'direct' : boosted ? 'direct' : 'port';
  cfg.fuel.lambda = g.lambda;
  if (plan.fuelSystem === 'carb' && !diesel) { cfg.fuel.injection = 'carb'; cfg.ignition.type = 'distributor'; cfg.valvetrain.vvt = false; }
  sizeFuelSystem(cfg);

  const dL = plan.displacement;
  Object.assign(cfg.exhaust, {
    headers: diesel ? 'cast' : g.headers,
    unequal: layout === 'boxer',
    layout: (layout === 'v' || layout === 'boxer') && n >= 6 ? 'dual' : 'single',
    diameter: Math.round(Math.min(90, 40 + 9 * Math.sqrt(dL * (boosted ? 1.5 : 1)) * (layout === 'v' && n >= 6 ? 0.75 : 1))),
    muffler: diesel ? 'stock' : g.exhaust,
    cat: plan.goal !== 'drag',
    resonator: plan.goal === 'eco' || plan.goal === 'sport',
  });

  cfg.hybrid.enabled = plan.powertrain === 'hybrid';
  cfg.hybrid.motorKw = Math.round(20 + dL * 15);
  cfg.hybrid.batteryKwh = 1.5;

  const nGears = plan.gearbox === 'auto' ? 8 : plan.goal === 'eco' ? 5 : 6;
  const first = diesel ? 4.6 : plan.goal === 'drag' ? 2.9 : 3.4;
  const last = plan.goal === 'drag' ? 1.0 : plan.goal === 'track' ? 0.85 : 0.72;
  Object.assign(cfg.transmission, {
    type: plan.gearbox, autoClutch: true, gears: makeGears(nGears, first, last),
    final: diesel ? 3.9 : plan.goal === 'drag' ? 3.7 : 4.1,
  });

  Object.assign(cfg.vehicle, { mass: b.mass, drive: plan.drive, cd: b.cd, area: b.area, tireRadius: b.r, grip: b.grip });
  cfg.name = `${GOALS[plan.goal].name} · ${plan.displacement.toFixed(1)} ${n} cil.`;
  return normalizeConfig(cfg);
}

// Dimensiona bicos, bomba e carburador para a potência esperada (com folga)
export function sizeFuelSystem(cfg, margin = 1.3) {
  const d = displacementL(cfg);
  const boost = cfg.intake.induction === 'na' ? 0 : cfg.intake.boost;
  const afr = FUELS[cfg.fuel.type]?.afr ?? 14.7;
  const airKgS = d / 1000 * 1.18 * 0.95 * (1 + boost) * cfg.engine.redline / 120;
  const fuelKgS = airKgS / (afr * 0.85) + (cfg.nitro.enabled ? cfg.nitro.shot * 0.00045 * 1.57 / (afr * 0.82) : 0);
  const dens = FUELS[cfg.fuel.type]?.density ?? 0.75;
  const ccMin = fuelKgS / dens * 1000 * 60 / cfg.engine.cylinders / 0.85 * margin;
  cfg.fuel.injectorCc = Math.max(120, Math.round(ccMin / 10) * 10);
  cfg.fuel.pumpLph = Math.max(80, Math.round(fuelKgS / dens * 3600 * margin / 10) * 10);
  cfg.fuel.carbCfm = Math.max(150, Math.round(d * cfg.engine.redline * 0.017656 * 0.9 * 1.1 / 25) * 25);
  return cfg;
}

// ---------------------------------------------------------------------------
// Presets prontos
export const PRESETS = {
  'Projeto padrão (2.0 16V)': {},
  '1.6 16V comando escalonado (giro alto)': {
    engine: { bore: 81, stroke: 77.4, compression: 10.4, redline: 8300 },
    valvetrain: { cam: 'street', vtec: true, vtecRpm: 5600, vtecCam: 'race' },
    intake: { runnerLength: 300, filter: 'performance' },
    exhaust: { headers: 'tubular', muffler: 'sport', diameter: 55 },
    transmission: { gears: [3.23, 2.1, 1.48, 1.16, 0.94], final: 4.4 },
    vehicle: { mass: 950 },
  },
  '2.0 boxer turbo 4x4': {
    engine: { layout: 'boxer', bore: 92, stroke: 75, compression: 8.5, redline: 7200 },
    intake: { induction: 'turbo', boost: 1.1, turboSize: 'medium', intercooler: true },
    fuel: { type: 'gasolinaPremium', injection: 'direct' },
    exhaust: { headers: 'cast', unequal: true, muffler: 'sport', diameter: 65 },
    transmission: { gears: [3.6, 2.2, 1.5, 1.1, 0.88, 0.72], final: 3.9, clutchTorque: 550 },
    vehicle: { mass: 1250, drive: 'awd' },
  },
  'V8 5.0 virabrequim cruzado': {
    engine: { layout: 'v', cylinders: 8, vAngle: 90, crankplane: 'cross', bore: 92.2, stroke: 92.7, compression: 11, redline: 7000 },
    intake: { runnerLength: 420 },
    exhaust: { layout: 'dual', diameter: 63, muffler: 'sport', headers: 'longtube' },
    transmission: { gears: [3.1, 2.0, 1.45, 1.1, 0.87, 0.69], final: 3.55, clutchTorque: 700 },
    vehicle: { mass: 1450, drive: 'rwd', tireRadius: 0.34 },
  },
  'V8 4.5 virabrequim plano (pista)': {
    engine: { layout: 'v', cylinders: 8, vAngle: 90, crankplane: 'flat', bore: 94, stroke: 81, compression: 12.5, redline: 9000, flywheel: 'light' },
    valvetrain: { cam: 'sport' },
    intake: { runnerLength: 260, throttle: 'itb', filter: 'cone' },
    fuel: { type: 'gasolinaCorrida', injection: 'direct' },
    exhaust: { layout: 'dual', diameter: 60, muffler: 'straight', headers: 'longtube', cat: false },
    transmission: { gears: [3.0, 2.1, 1.6, 1.28, 1.05, 0.88, 0.75], final: 3.9, clutchTorque: 650 },
    vehicle: { mass: 1250, drive: 'rwd', grip: 1.15, tireRadius: 0.34 },
  },
  '1.0 3 cil. turbo híbrido (automático)': {
    engine: { cylinders: 3, bore: 74, stroke: 77.6, compression: 9.6, redline: 6500 },
    intake: { induction: 'turbo', boost: 1.1, turboSize: 'small' },
    fuel: { injection: 'direct' },
    hybrid: { enabled: true, motorKw: 40, batteryKwh: 1.5, mode: 'hybrid' },
    transmission: { type: 'auto', gears: makeGears(7, 3.8, 0.7), final: 4.2 },
    vehicle: { mass: 1000 },
  },
  'Diesel 2.8 turbo (picape)': {
    engine: { bore: 92.9, stroke: 103, compression: 15.6, redline: 4400, idleRpm: 720, flywheel: 'heavy' },
    valvetrain: { type: 'dohc', cam: 'eco', vvt: false, valvesPerCyl: 4 },
    intake: { induction: 'turbo', boost: 1.6, turboSize: 'medium', intercooler: true, blowoff: false, runnerLength: 480 },
    fuel: { type: 'diesel', injection: 'commonrail', smokeLambda: 1.3 },
    exhaust: { diameter: 70, muffler: 'stock' },
    transmission: { type: 'auto', gears: makeGears(6, 4.6, 0.75), final: 3.9, clutchTorque: 700 },
    vehicle: { mass: 1700, drive: 'rwd', cd: 0.42, area: 2.9, tireRadius: 0.38 },
  },
  'V12 6.0 aspirado': {
    engine: { layout: 'v', cylinders: 12, vAngle: 60, bore: 89, stroke: 80, compression: 11.5, redline: 8700 },
    valvetrain: { cam: 'sport' },
    intake: { runnerLength: 300 },
    fuel: { type: 'gasolinaPremium', injection: 'direct' },
    exhaust: { layout: 'dual', diameter: 60, muffler: 'sport', headers: 'longtube' },
    transmission: { gears: [3.1, 2.15, 1.6, 1.25, 1.0, 0.82, 0.68], final: 3.6, clutchTorque: 800 },
    vehicle: { mass: 1400, drive: 'rwd', tireRadius: 0.35, grip: 1.1 },
  },
  'Etanol 2.0 turbo de arrancada + nitro': {
    engine: { bore: 86, stroke: 86, compression: 10.0, redline: 8500, flywheel: 'light' },
    valvetrain: { cam: 'race' },
    intake: { induction: 'turbo', boost: 2.2, turboSize: 'large', filter: 'cone' },
    nitro: { enabled: true, shot: 100 },
    fuel: { type: 'etanol', injection: 'port', lambda: 0.8 },
    exhaust: { headers: 'longtube', muffler: 'none', cat: false, diameter: 76 },
    transmission: { gears: [2.9, 1.95, 1.45, 1.15, 0.95], final: 3.7, clutchTorque: 900 },
    vehicle: { mass: 900, drive: 'rwd', grip: 1.3 },
  },
  'Moto/kart monocilíndrico 500': {
    engine: { cylinders: 1, bore: 92, stroke: 75, compression: 11.5, redline: 9500, flywheel: 'light' },
    valvetrain: { cam: 'sport' },
    intake: { runnerLength: 250, filter: 'cone' },
    exhaust: { muffler: 'straight', diameter: 42, length: 1.2, cat: false, resonator: false },
    transmission: { gears: [2.6, 1.9, 1.5, 1.25, 1.08, 0.96], final: 3.0, clutchTorque: 120 },
    vehicle: { mass: 180, drive: 'rwd', cd: 0.6, area: 0.9, tireRadius: 0.28, grip: 1.1 },
  },
  'V8 5.7 carburado com distribuidor (clássico)': {
    engine: { layout: 'v', cylinders: 8, vAngle: 90, crankplane: 'cross', bore: 101.6, stroke: 88.4, compression: 9.5, redline: 5800, idleRpm: 750 },
    valvetrain: { type: 'ohv', valvesPerCyl: 2, cam: 'street', vvt: false },
    intake: { runnerLength: 380, filter: 'paper' },
    fuel: { type: 'gasolinaPura', injection: 'carb', carbCfm: 650, carbJet: 0, idleMix: 0, timing: 0, pumpLph: 250, injectorCc: 0 },
    ignition: { type: 'distributor' },
    exhaust: { layout: 'dual', diameter: 57, muffler: 'sport', headers: 'cast', cat: false, resonator: false },
    transmission: { gears: [2.95, 1.94, 1.34, 1.0], final: 3.42, clutchTorque: 650 },
    vehicle: { mass: 1350, drive: 'rwd', tireRadius: 0.34, cd: 0.4 },
  },
  'V-twin 45° 1.6 (ronco "batata")': {
    engine: { layout: 'v', cylinders: 2, vAngle: 45, bore: 100, stroke: 101.6, compression: 10, redline: 5800, flywheel: 'heavy' },
    valvetrain: { type: 'ohv', valvesPerCyl: 2, cam: 'eco', vvt: false },
    fuel: { injection: 'carb', carbCfm: 300 },
    ignition: { type: 'wasted' },
    exhaust: { muffler: 'straight', diameter: 48, length: 1.4, cat: false, resonator: false },
    transmission: { gears: [3.0, 2.0, 1.5, 1.2, 1.0, 0.86], final: 2.6, clutchTorque: 200 },
    vehicle: { mass: 260, drive: 'rwd', cd: 0.6, area: 0.9, tireRadius: 0.32 },
  },
};

export function presetConfig(name) {
  const cfg = deepMerge(DEFAULT_CONFIG, PRESETS[name] || {});
  const f = PRESETS[name]?.fuel || {};
  if (!('injectorCc' in f)) sizeFuelSystem(cfg);
  return normalizeConfig(cfg);
}
