// Catálogo de componentes reais: motores a combustão, motores elétricos, baterias e carros completos.
//
// Fonte: fichas técnicas públicas das montadoras (diâmetro, curso, taxa, potência, torque, rotações,
// tipo de injeção, aspiração, capacidades de bateria e motores elétricos).
// Itens marcados com `est` NÃO são publicados pelas montadoras e foram estimados
// (vazão dos bicos, vazão da bomba, relações de câmbio de alguns carros, diâmetro do escape).
//
// Cada motor é CALIBRADO na hora de aplicar: o modelo físico ajusta o enchimento (veScale) para
// bater a potência oficial, e motores turbo usam o limitador de torque da central (o "platô").
import { Engine, hp } from './engine.js';
import { clone, deepMerge, engineWeight, makeGears, normalizeConfig, sizeFuelSystem, DEFAULT_CONFIG } from './config.js';

const turboLimit = (nm) => ({ torqueLimit: nm });

// ----------------------------------------------------------------------------- motores a combustão
export const ENGINE_MODELS = {
  'VW EA211 1.0 TSI 200 (3 cil. turbo, flex)': {
    official: { cv: 128, rpm: 5500, nm: 200, note: '128 cv (E) / 116 cv (G) · 200 N·m de 2000 a 3500 rpm' },
    cfg: {
      engine: { layout: 'inline', cylinders: 3, bore: 74.5, stroke: 76.4, compression: 10.5, redline: 6250, idleRpm: 800, ...turboLimit(200) },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'street', vvt: true, vtec: false, variableLift: false },
      intake: { filter: 'paper', throttle: 'single', runnerLength: 300, induction: 'turbo', boost: 1.0, turboSize: 'small', intercooler: true, blowoff: true },
      fuel: { type: 'etanol', injection: 'direct', pressureBar: 250, lambda: 0.9 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'cast', layout: 'single', diameter: 45, length: 3.2, cat: true, muffler: 'stock', resonator: true },
    },
  },
  'VW VR6 2.8 12V (AAA)': {
    official: { cv: 174, rpm: 5800, nm: 235, note: '174 cv a 5800 rpm · 235 N·m a 4200 rpm · V de 15°' },
    cfg: {
      engine: { layout: 'v', cylinders: 6, vAngle: 15, bore: 81, stroke: 90.3, compression: 10.0, redline: 6500, idleRpm: 750 },
      valvetrain: { type: 'sohc', valvesPerCyl: 2, cam: 'street', vvt: false, vtec: false },
      intake: { filter: 'paper', runnerLength: 420, induction: 'na' },
      fuel: { type: 'gasolinaPura', injection: 'port', pressureBar: 3.5 },
      ignition: { type: 'distributor' },
      exhaust: { headers: 'cast', layout: 'single', diameter: 55, length: 3.5, cat: true, muffler: 'stock', resonator: true },
    },
  },
  'VW VR6 3.6 FSI (EA390)': {
    official: { cv: 280, rpm: 6200, nm: 360, note: '280 cv a 6200 rpm · 360 N·m a 2750 rpm · V de 10,6°' },
    cfg: {
      engine: { layout: 'v', cylinders: 6, vAngle: 10.6, bore: 89, stroke: 96.4, compression: 12.0, redline: 6800, idleRpm: 700 },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'street', vvt: true },
      intake: { filter: 'paper', runnerLength: 400, induction: 'na' },
      fuel: { type: 'gasolinaPremium', injection: 'direct', pressureBar: 150 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'cast', layout: 'single', diameter: 60, length: 3.6, cat: true, muffler: 'sport', resonator: true },
    },
  },
  'VW/Bentley W12 6.0 biturbo': {
    official: { cv: 635, rpm: 6000, nm: 900, note: '635 cv a 6000 rpm · 900 N·m de 1350 a 4500 rpm (Continental GT 2018)' },
    cfg: {
      engine: { layout: 'w', cylinders: 12, vAngle: 72, bore: 84, stroke: 90.2, compression: 10.5, redline: 6500, idleRpm: 650, ...turboLimit(900) },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'street', vvt: true },
      intake: { filter: 'paper', runnerLength: 330, induction: 'twinturbo', boost: 1.3, turboSize: 'medium', intercooler: true, blowoff: true },
      fuel: { type: 'gasolinaPremium', injection: 'dual', pressureBar: 250 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'cast', layout: 'dual', diameter: 70, length: 3.8, cat: true, muffler: 'sport', resonator: false },
    },
  },
  'VW EA888 2.0 TSI Gen3 (Golf GTI)': {
    official: { cv: 230, rpm: 5500, nm: 350, note: '230 cv de 4700 a 6200 rpm · 350 N·m de 1500 a 4600 rpm' },
    cfg: {
      engine: { layout: 'inline', cylinders: 4, bore: 82.5, stroke: 92.8, compression: 9.6, redline: 6500, idleRpm: 700, ...turboLimit(350) },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'street', vvt: true },
      intake: { filter: 'paper', runnerLength: 320, induction: 'turbo', boost: 1.2, turboSize: 'medium', intercooler: true, blowoff: true },
      fuel: { type: 'gasolinaPremium', injection: 'dual', pressureBar: 200 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'cast', layout: 'single', diameter: 63, length: 3.4, cat: true, muffler: 'sport', resonator: true },
    },
  },
  'BMW N55 3.0 turbo (I6)': {
    official: { cv: 310, rpm: 5800, nm: 400, note: '306 hp (310 cv) a 5800 rpm · 400 N·m de 1200 a 5000 rpm · Valvetronic' },
    cfg: {
      engine: { layout: 'inline', cylinders: 6, bore: 84, stroke: 89.6, compression: 10.2, redline: 7000, idleRpm: 650, ...turboLimit(400) },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'street', vvt: true, variableLift: true },
      intake: { filter: 'paper', runnerLength: 340, induction: 'turbo', boost: 0.9, turboSize: 'medium', intercooler: true, blowoff: true },
      fuel: { type: 'gasolinaPremium', injection: 'direct', pressureBar: 200 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'cast', layout: 'single', diameter: 63, length: 3.6, cat: true, muffler: 'sport', resonator: true },
    },
  },
  'BMW B58 3.0 turbo (I6)': {
    official: { cv: 340, rpm: 5750, nm: 500, note: '340 cv de 5000 a 6500 rpm · 500 N·m de 1600 a 4500 rpm (sucessor do N55)' },
    cfg: {
      engine: { layout: 'inline', cylinders: 6, bore: 82, stroke: 94.6, compression: 11.0, redline: 7000, idleRpm: 650, ...turboLimit(500) },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'street', vvt: true, variableLift: true },
      intake: { filter: 'paper', runnerLength: 340, induction: 'turbo', boost: 1.1, turboSize: 'medium', intercooler: true, blowoff: true },
      fuel: { type: 'gasolinaPremium', injection: 'direct', pressureBar: 350 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'cast', layout: 'single', diameter: 70, length: 3.6, cat: true, muffler: 'sport', resonator: true },
    },
  },
  'BMW S55 3.0 biturbo (M3 F80)': {
    official: { cv: 431, rpm: 7300, nm: 550, note: '431 cv a 7300 rpm · 550 N·m de 1850 a 5500 rpm' },
    cfg: {
      engine: { layout: 'inline', cylinders: 6, bore: 84, stroke: 89.6, compression: 10.2, redline: 7600, idleRpm: 700, flywheel: 'light', ...turboLimit(550) },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'sport', vvt: true, variableLift: true },
      intake: { filter: 'performance', runnerLength: 300, induction: 'twinturbo', boost: 1.2, turboSize: 'small', intercooler: true, blowoff: true },
      fuel: { type: 'gasolinaPremium', injection: 'direct', pressureBar: 200 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'cast', layout: 'dual', diameter: 70, length: 3.6, cat: true, muffler: 'sport', resonator: false },
    },
  },
  'Mercedes-AMG M177 4.0 V8 biturbo': {
    official: { cv: 510, rpm: 5750, nm: 700, note: '510 cv de 5500 a 6250 rpm · 700 N·m de 2000 a 4500 rpm (C63 S W205) · turbos no "V quente"' },
    cfg: {
      engine: { layout: 'v', cylinders: 8, vAngle: 90, crankplane: 'cross', bore: 83, stroke: 92, compression: 10.5, redline: 7000, idleRpm: 650, ...turboLimit(700) },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'sport', vvt: true },
      intake: { filter: 'performance', runnerLength: 300, induction: 'twinturbo', boost: 1.3, turboSize: 'medium', intercooler: true, blowoff: true },
      fuel: { type: 'gasolinaPremium', injection: 'direct', pressureBar: 200 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'cast', layout: 'dual', diameter: 70, length: 3.8, cat: true, muffler: 'sport', resonator: false },
    },
  },
  'Mercedes-AMG M156 6.2 V8 aspirado': {
    official: { cv: 457, rpm: 6800, nm: 600, note: '457 cv a 6800 rpm · 600 N·m a 5000 rpm (C63 AMG W204)' },
    cfg: {
      engine: { layout: 'v', cylinders: 8, vAngle: 90, crankplane: 'cross', bore: 102.2, stroke: 94.6, compression: 11.3, redline: 7200, idleRpm: 650 },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'sport', vvt: true },
      intake: { filter: 'performance', runnerLength: 330, induction: 'na' },
      fuel: { type: 'gasolinaPremium', injection: 'port', pressureBar: 4 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'tubular', layout: 'dual', diameter: 63, length: 3.8, cat: true, muffler: 'sport', resonator: false },
    },
  },
  'Mercedes M256 3.0 I6 turbo + EQ Boost (48 V)': {
    official: { cv: 435, rpm: 6100, nm: 520, note: '435 cv a 6100 rpm · 520 N·m (AMG 53) + motor elétrico 48 V de 22 cv / 250 N·m' },
    cfg: {
      engine: { layout: 'inline', cylinders: 6, bore: 83, stroke: 92.4, compression: 10.5, redline: 6500, idleRpm: 650, ...turboLimit(520) },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'street', vvt: true },
      intake: { filter: 'paper', runnerLength: 330, induction: 'turbo', boost: 1.3, turboSize: 'medium', intercooler: true, blowoff: true },
      fuel: { type: 'gasolinaPremium', injection: 'direct', pressureBar: 250 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'cast', layout: 'dual', diameter: 63, length: 3.6, cat: true, muffler: 'sport', resonator: true },
      hybrid: { enabled: true, motorKw: 16, motorNm: 250, batteryKwh: 1.0, batteryKw: 20, batteryKg: 20, regen: 0.4, mode: 'hybrid', motorRatio: 1, motorMaxRpm: 7000 },
    },
  },
  'Ford 1.0 EcoBoost (3 cil. turbo)': {
    official: { cv: 125, rpm: 6000, nm: 170, note: '125 cv a 6000 rpm · 170 N·m de 1400 a 4500 rpm (200 N·m com overboost)' },
    cfg: {
      engine: { layout: 'inline', cylinders: 3, bore: 71.9, stroke: 82, compression: 10.0, redline: 6500, idleRpm: 750, ...turboLimit(170) },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'street', vvt: true },
      intake: { filter: 'paper', runnerLength: 300, induction: 'turbo', boost: 1.3, turboSize: 'small', intercooler: true, blowoff: true },
      fuel: { type: 'gasolinaPura', injection: 'direct', pressureBar: 150 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'cast', layout: 'single', diameter: 45, length: 3.2, cat: true, muffler: 'stock', resonator: true },
    },
  },
  'Ford 2.3 EcoBoost (Mustang)': {
    official: { cv: 317, rpm: 5500, nm: 475, note: '314 hp (317 cv) a 5500 rpm · 475 N·m a 3000 rpm' },
    cfg: {
      engine: { layout: 'inline', cylinders: 4, bore: 87.5, stroke: 94, compression: 9.5, redline: 6500, idleRpm: 700, ...turboLimit(475) },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'street', vvt: true },
      intake: { filter: 'paper', runnerLength: 320, induction: 'turbo', boost: 1.4, turboSize: 'medium', intercooler: true, blowoff: true },
      fuel: { type: 'gasolinaPremium', injection: 'direct', pressureBar: 200 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'cast', layout: 'dual', diameter: 63, length: 3.8, cat: true, muffler: 'sport', resonator: true },
    },
  },
  'Ford 1.0 Zetec Rocam 8V flex': {
    official: { cv: 73, rpm: 6250, nm: 91, note: '73 cv (E) a 6250 rpm · ~9,3 kgfm a 4250 rpm (Ka/Fiesta)' },
    cfg: {
      engine: { layout: 'inline', cylinders: 4, bore: 68.68, stroke: 67.4, compression: 12.8, redline: 6500, idleRpm: 850 },
      valvetrain: { type: 'sohc', valvesPerCyl: 2, cam: 'street', vvt: false },
      intake: { filter: 'paper', runnerLength: 380, induction: 'na' },
      fuel: { type: 'etanol', injection: 'port', pressureBar: 3.8 },
      ignition: { type: 'wasted' },
      exhaust: { headers: 'cast', layout: 'single', diameter: 42, length: 3.0, cat: true, muffler: 'stock', resonator: true },
    },
  },
  'Ford 1.6 Zetec Rocam 8V flex': {
    official: { cv: 111, rpm: 5500, nm: 156, note: '111 cv (E) a 5500 rpm · ~15,9 kgfm (Fiesta/EcoSport)' },
    cfg: {
      engine: { layout: 'inline', cylinders: 4, bore: 82.07, stroke: 75.48, compression: 12.3, redline: 6200, idleRpm: 850 },
      valvetrain: { type: 'sohc', valvesPerCyl: 2, cam: 'eco', vvt: false },
      intake: { filter: 'paper', runnerLength: 420, induction: 'na' },
      fuel: { type: 'etanol', injection: 'port', pressureBar: 3.8 },
      ignition: { type: 'wasted' },
      exhaust: { headers: 'cast', layout: 'single', diameter: 45, length: 3.2, cat: true, muffler: 'stock', resonator: true },
    },
  },
  'Honda K20A 2.0 i-VTEC (Civic Type R EP3/DC5)': {
    official: { cv: 220, rpm: 8000, nm: 206, note: '220 cv a 8000 rpm · 206 N·m a 7000 rpm · VTEC entra ~5800 rpm' },
    cfg: {
      engine: { layout: 'inline', cylinders: 4, bore: 86, stroke: 86, compression: 11.5, redline: 8600, idleRpm: 800, flywheel: 'light' },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'street', vvt: true, vtec: true, vtecRpm: 5800, vtecCam: 'race' },
      intake: { filter: 'paper', runnerLength: 270, induction: 'na' },
      fuel: { type: 'gasolinaPura', injection: 'port', pressureBar: 3.4 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'tubular', layout: 'single', diameter: 60, length: 3.2, cat: true, muffler: 'sport', resonator: true },
    },
  },
  'Honda K20C1 2.0 VTEC Turbo (Civic Type R FK8)': {
    official: { cv: 320, rpm: 6500, nm: 400, note: '320 cv a 6500 rpm · 400 N·m de 2500 a 4500 rpm' },
    cfg: {
      engine: { layout: 'inline', cylinders: 4, bore: 86, stroke: 85.9, compression: 9.8, redline: 7000, idleRpm: 750, ...turboLimit(400) },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'sport', vvt: true, vtec: false },
      intake: { filter: 'paper', runnerLength: 300, induction: 'turbo', boost: 1.6, turboSize: 'medium', intercooler: true, blowoff: true },
      fuel: { type: 'gasolinaPremium', injection: 'direct', pressureBar: 200 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'cast', layout: 'single', diameter: 76, length: 3.4, cat: true, muffler: 'sport', resonator: true },
    },
  },
  'Honda R18A 1.8 i-VTEC flex (Civic)': {
    official: { cv: 140, rpm: 6200, nm: 174, note: '140 cv (E) a 6200 rpm · ~17,7 kgfm a 4300 rpm' },
    cfg: {
      engine: { layout: 'inline', cylinders: 4, bore: 81, stroke: 87.3, compression: 10.6, redline: 6800, idleRpm: 750 },
      valvetrain: { type: 'sohc', valvesPerCyl: 4, cam: 'street', vvt: false, vtec: false },
      intake: { filter: 'paper', runnerLength: 400, induction: 'na' },
      fuel: { type: 'etanol', injection: 'port', pressureBar: 3.4 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'cast', layout: 'single', diameter: 48, length: 3.4, cat: true, muffler: 'stock', resonator: true },
    },
  },
  'MWM Sprint 2.8 turbodiesel (S10/Ranger/Frontier)': {
    official: { cv: 140, rpm: 3500, nm: 340, note: '140 cv a 3500 rpm · 340 N·m a 1800 rpm · common-rail' },
    cfg: {
      engine: { layout: 'inline', cylinders: 4, bore: 93, stroke: 103, compression: 17.2, redline: 4000, idleRpm: 750, flywheel: 'heavy' },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'eco', vvt: false, vtec: false },
      intake: { filter: 'paper', runnerLength: 480, induction: 'turbo', boost: 1.1, turboSize: 'medium', intercooler: true, blowoff: false },
      fuel: { type: 'diesel', injection: 'commonrail', pressureBar: 1600, smokeLambda: 1.35 },
      exhaust: { headers: 'cast', layout: 'single', diameter: 60, length: 3.8, cat: true, muffler: 'stock', resonator: false },
    },
  },
  'Fiat Fire 1.0 Evo 8V flex': {
    official: { cv: 75, rpm: 6250, nm: 99, note: '75 cv (E) a 6250 rpm · 9,9 kgfm a 3850 rpm (Uno/Palio)' },
    cfg: {
      engine: { layout: 'inline', cylinders: 4, bore: 70, stroke: 64.9, compression: 12.15, redline: 6500, idleRpm: 850 },
      valvetrain: { type: 'sohc', valvesPerCyl: 2, cam: 'street', vvt: false },
      intake: { filter: 'paper', runnerLength: 380, induction: 'na' },
      fuel: { type: 'etanol', injection: 'port', pressureBar: 3.5 },
      ignition: { type: 'wasted' },
      exhaust: { headers: 'cast', layout: 'single', diameter: 40, length: 3.0, cat: true, muffler: 'stock', resonator: true },
    },
  },
  'Fiat E.torQ 1.8 16V Evo flex': {
    official: { cv: 139, rpm: 5750, nm: 189, note: '139 cv (E) a 5750 rpm · 19,3 kgfm a 3750 rpm' },
    cfg: {
      engine: { layout: 'inline', cylinders: 4, bore: 80.5, stroke: 85.8, compression: 11.2, redline: 6500, idleRpm: 800 },
      valvetrain: { type: 'sohc', valvesPerCyl: 4, cam: 'eco', vvt: true },
      intake: { filter: 'paper', runnerLength: 420, induction: 'na' },
      fuel: { type: 'etanol', injection: 'port', pressureBar: 3.5 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'cast', layout: 'single', diameter: 48, length: 3.4, cat: true, muffler: 'stock', resonator: true },
    },
  },
  'BYD 1.5 Xiaoyun (Atkinson, DM-i)': {
    official: { cv: 110, rpm: 6000, nm: 135, note: '110 cv a 6000 rpm · 135 N·m · taxa 15,5:1 em ciclo Atkinson' },
    cfg: {
      engine: { layout: 'inline', cylinders: 4, bore: 72.5, stroke: 90.8, compression: 15.5, redline: 6000, idleRpm: 900, atkinson: true },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'eco', vvt: true },
      intake: { filter: 'paper', runnerLength: 450, induction: 'na' },
      fuel: { type: 'gasolinaComum', injection: 'port', pressureBar: 3.5 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'cast', layout: 'single', diameter: 45, length: 3.4, cat: true, muffler: 'stock', resonator: true },
    },
  },
  'GWM 1.5 turbo (Haval H6 híbrido)': {
    official: { cv: 150, rpm: 5500, nm: 230, note: '~150 cv · ~230 N·m (motor a combustão do H6 HEV/PHEV)' },
    cfg: {
      engine: { layout: 'inline', cylinders: 4, bore: 76, stroke: 82.6, compression: 10.5, redline: 6000, idleRpm: 800, ...turboLimit(230) },
      valvetrain: { type: 'dohc', valvesPerCyl: 4, cam: 'eco', vvt: true },
      intake: { filter: 'paper', runnerLength: 380, induction: 'turbo', boost: 1.0, turboSize: 'small', intercooler: true, blowoff: true },
      fuel: { type: 'gasolinaComum', injection: 'direct', pressureBar: 200 },
      ignition: { type: 'cop' },
      exhaust: { headers: 'cast', layout: 'single', diameter: 50, length: 3.4, cat: true, muffler: 'stock', resonator: true },
    },
  },
};

// ----------------------------------------------------------------------------- motores elétricos
export const MOTOR_MODELS = {
  'BYD Song Plus DM-i (dianteiro)':        { motorKw: 145, motorNm: 325, motorMaxRpm: 16000, note: '197 cv / 325 N·m' },
  'BYD Seal RWD (traseiro)':               { motorKw: 230, motorNm: 360, motorMaxRpm: 16000, note: '313 cv / 360 N·m' },
  'BYD Seal AWD Performance (2 motores)':  { motorKw: 390, motorNm: 670, motorMaxRpm: 16000, note: '160 kW dianteiro + 230 kW traseiro' },
  'BYD Dolphin':                           { motorKw: 70,  motorNm: 180, motorMaxRpm: 14000, note: '95 cv / 180 N·m' },
  'GWM Haval H6 HEV (tração)':             { motorKw: 130, motorNm: 300, motorMaxRpm: 14000, note: 'aprox.: 130 kW / 300 N·m' },
  'GWM Haval H6 PHEV AWD (2 motores)':     { motorKw: 280, motorNm: 530, motorMaxRpm: 14000, note: 'aprox.: dianteiro + traseiro' },
  'Geely EX2':                             { motorKw: 85,  motorNm: 150, motorMaxRpm: 14000, note: '116 cv / 150 N·m' },
  'Porsche Taycan Turbo S (2 motores)':    { motorKw: 560, motorNm: 1050, motorMaxRpm: 16000, note: '761 cv com overboost / 1050 N·m' },
  'Volvo XC40 Recharge Twin (2 motores)':  { motorKw: 300, motorNm: 660, motorMaxRpm: 14000, note: '408 cv / 660 N·m' },
  'Mercedes EQ Boost 48 V (ISG)':          { motorKw: 16,  motorNm: 250, motorMaxRpm: 7000,  note: '22 cv / 250 N·m, montado no virabrequim' },
};

// ----------------------------------------------------------------------------- baterias
export const BATTERY_MODELS = {
  'BYD Blade 18,3 kWh (Song Plus DM-i)':     { batteryKwh: 18.3, batteryKw: 160, batteryKg: 200 },
  'BYD Blade 44,9 kWh (Dolphin)':            { batteryKwh: 44.9, batteryKw: 120, batteryKg: 310 },
  'BYD Blade 82,5 kWh (Seal)':               { batteryKwh: 82.5, batteryKw: 420, batteryKg: 520 },
  'GWM H6 HEV 1,69 kWh':                     { batteryKwh: 1.69, batteryKw: 110, batteryKg: 40 },
  'GWM H6 PHEV 34 kWh':                      { batteryKwh: 34, batteryKw: 250, batteryKg: 260 },
  'Geely EX2 39,4 kWh (LFP)':                { batteryKwh: 39.4, batteryKw: 110, batteryKg: 270 },
  'Volvo XC40 Recharge 78 kWh':              { batteryKwh: 78, batteryKw: 320, batteryKg: 500 },
  'Volvo T8 Recharge 18,8 kWh (XC60/XC90)':  { batteryKwh: 18.8, batteryKw: 120, batteryKg: 150 },
  'Porsche Taycan Performance Plus 93,4 kWh': { batteryKwh: 93.4, batteryKw: 600, batteryKg: 630 },
  'Porsche Cayenne E-Hybrid 25,9 kWh':       { batteryKwh: 25.9, batteryKw: 150, batteryKg: 220 },
  'Mercedes 48 V (~1 kWh)':                  { batteryKwh: 1.0, batteryKw: 20, batteryKg: 20 },
};

// ----------------------------------------------------------------------------- carros completos
// massa = peso em ordem de marcha oficial (o modelo desconta o motor para você poder trocá-lo)
const car = (engine, curbKg, vehicle, transmission, extra = {}) => ({ engine, curbKg, vehicle, transmission, ...extra });
export const CAR_MODELS = {
  'VW Polo 200 TSI (automático 6)': car('VW EA211 1.0 TSI 200 (3 cil. turbo, flex)', 1124,
    { drive: 'fwd', tireRadius: 0.31, cd: 0.32, area: 2.15, grip: 1.0 }, { type: 'auto', gears: [4.46, 2.51, 1.56, 1.14, 0.85, 0.67], final: 3.68 }),
  'VW Golf GTI Mk7.5 (DSG 7)': car('VW EA888 2.0 TSI Gen3 (Golf GTI)', 1395,
    { drive: 'fwd', tireRadius: 0.32, cd: 0.30, area: 2.2, grip: 1.05 }, { type: 'auto', gears: [3.56, 2.53, 1.68, 1.02, 0.79, 0.81, 0.66], final: 3.94, shiftTime: 0.1 }),
  'VW Passat VR6 3.6 4Motion': car('VW VR6 3.6 FSI (EA390)', 1700,
    { drive: 'awd', tireRadius: 0.33, cd: 0.29, area: 2.3 }, { type: 'auto', gears: [3.46, 2.05, 1.30, 0.90, 0.91, 0.76], final: 4.25, shiftTime: 0.15 }),
  'Bentley Continental GT W12 (2018)': car('VW/Bentley W12 6.0 biturbo', 2244,
    { drive: 'awd', tireRadius: 0.36, cd: 0.29, area: 2.3, grip: 1.1 }, { type: 'auto', gears: makeGears(8, 4.71, 0.67), final: 2.85, clutchTorque: 1200, shiftTime: 0.12 }),
  'BMW 335i F30 (N55, ZF 8)': car('BMW N55 3.0 turbo (I6)', 1540,
    { drive: 'rwd', tireRadius: 0.33, cd: 0.29, area: 2.2 }, { type: 'auto', gears: [4.71, 3.14, 2.11, 1.67, 1.29, 1.0, 0.84, 0.67], final: 3.15, shiftTime: 0.15 }),
  'Toyota GR Supra 3.0 (B58, ZF 8)': car('BMW B58 3.0 turbo (I6)', 1520,
    { drive: 'rwd', tireRadius: 0.34, cd: 0.29, area: 2.0, grip: 1.1 }, { type: 'auto', gears: [5.0, 3.2, 2.14, 1.72, 1.31, 1.0, 0.82, 0.64], final: 3.15, shiftTime: 0.12 }),
  'BMW M3 F80 (S55, DCT 7)': car('BMW S55 3.0 biturbo (M3 F80)', 1560,
    { drive: 'rwd', tireRadius: 0.34, cd: 0.30, area: 2.2, grip: 1.15 }, { type: 'auto', gears: [4.81, 2.59, 1.70, 1.28, 1.0, 0.84, 0.67], final: 3.46, shiftTime: 0.08, clutchTorque: 800 }),
  'Mercedes-AMG C63 S W205 (M177, MCT 9)': car('Mercedes-AMG M177 4.0 V8 biturbo', 1725,
    { drive: 'rwd', tireRadius: 0.35, cd: 0.32, area: 2.25, grip: 1.15 }, { type: 'auto', gears: [5.35, 3.24, 2.25, 1.64, 1.21, 1.0, 0.87, 0.72, 0.6], final: 2.82, shiftTime: 0.1, clutchTorque: 1000 }),
  'Mercedes C63 AMG W204 (M156, 7G)': car('Mercedes-AMG M156 6.2 V8 aspirado', 1730,
    { drive: 'rwd', tireRadius: 0.34, cd: 0.31, area: 2.2, grip: 1.1 }, { type: 'auto', gears: [4.38, 2.86, 1.92, 1.37, 1.0, 0.82, 0.73], final: 2.82, shiftTime: 0.15, clutchTorque: 900 }),
  'Mercedes-AMG CLS 53 (M256 + EQ Boost)': car('Mercedes M256 3.0 I6 turbo + EQ Boost (48 V)', 1905,
    { drive: 'awd', tireRadius: 0.35, cd: 0.27, area: 2.3, grip: 1.05 }, { type: 'auto', gears: makeGears(9, 5.35, 0.6), final: 2.82, shiftTime: 0.12, clutchTorque: 900 }),
  'Ford Fiesta 1.0 EcoBoost (manual 6)': car('Ford 1.0 EcoBoost (3 cil. turbo)', 1105,
    { drive: 'fwd', tireRadius: 0.30, cd: 0.33, area: 2.1 }, { type: 'manual', gears: [3.73, 2.05, 1.36, 1.03, 0.81, 0.68], final: 4.06 }),
  'Ford Mustang EcoBoost 2.3 (manual 6)': car('Ford 2.3 EcoBoost (Mustang)', 1600,
    { drive: 'rwd', tireRadius: 0.34, cd: 0.35, area: 2.2, grip: 1.05 }, { type: 'manual', gears: [4.24, 2.54, 1.66, 1.24, 1.0, 0.68], final: 3.55, clutchTorque: 600 }),
  'Ford Ka 1.0 Rocam (manual 5)': car('Ford 1.0 Zetec Rocam 8V flex', 915,
    { drive: 'fwd', tireRadius: 0.28, cd: 0.36, area: 1.95 }, { type: 'manual', gears: [3.58, 1.93, 1.28, 0.95, 0.76], final: 4.25 }),
  'Ford EcoSport 1.6 Rocam (manual 5)': car('Ford 1.6 Zetec Rocam 8V flex', 1190,
    { drive: 'fwd', tireRadius: 0.32, cd: 0.38, area: 2.45 }, { type: 'manual', gears: [3.58, 1.93, 1.28, 0.95, 0.76], final: 4.06 }),
  'Honda Civic Type R EP3 (K20A, manual 6)': car('Honda K20A 2.0 i-VTEC (Civic Type R EP3/DC5)', 1190,
    { drive: 'fwd', tireRadius: 0.31, cd: 0.33, area: 2.1, grip: 1.08 }, { type: 'manual', gears: [3.27, 2.13, 1.52, 1.15, 0.92, 0.74], final: 4.76 }),
  'Honda Civic Type R FK8 (K20C1, manual 6)': car('Honda K20C1 2.0 VTEC Turbo (Civic Type R FK8)', 1390,
    { drive: 'fwd', tireRadius: 0.34, cd: 0.33, area: 2.2, grip: 1.15 }, { type: 'manual', gears: [3.63, 2.12, 1.53, 1.13, 0.91, 0.73], final: 4.11, clutchTorque: 550 }),
  'Honda Civic 1.8 (R18A, manual 5)': car('Honda R18A 1.8 i-VTEC flex (Civic)', 1260,
    { drive: 'fwd', tireRadius: 0.32, cd: 0.31, area: 2.15 }, { type: 'manual', gears: [3.14, 1.87, 1.24, 0.95, 0.77], final: 4.29 }),
  'Chevrolet S10 2.8 MWM Sprint (manual 5)': car('MWM Sprint 2.8 turbodiesel (S10/Ranger/Frontier)', 1890,
    { drive: 'rwd', tireRadius: 0.38, cd: 0.45, area: 2.9, grip: 0.95 }, { type: 'manual', gears: [4.23, 2.47, 1.47, 1.0, 0.82], final: 3.73, clutchTorque: 600 }),
  'Fiat Uno 1.0 Fire Evo (manual 5)': car('Fiat Fire 1.0 Evo 8V flex', 900,
    { drive: 'fwd', tireRadius: 0.28, cd: 0.34, area: 2.0 }, { type: 'manual', gears: [4.27, 2.24, 1.44, 1.03, 0.82], final: 4.92 }),
  'Fiat Toro 1.8 E.torQ (automático 6)': car('Fiat E.torQ 1.8 16V Evo flex', 1580,
    { drive: 'fwd', tireRadius: 0.35, cd: 0.38, area: 2.7 }, { type: 'auto', gears: [4.46, 2.51, 1.56, 1.14, 0.85, 0.67], final: 3.87 }),
  'BYD Song Plus DM-i (híbrido plug-in)': car('BYD 1.5 Xiaoyun (Atkinson, DM-i)', 1815,
    { drive: 'fwd', tireRadius: 0.35, cd: 0.33, area: 2.6 }, { type: 'auto', gears: [1.0], final: 2.9 },
    { motor: 'BYD Song Plus DM-i (dianteiro)', battery: 'BYD Blade 18,3 kWh (Song Plus DM-i)', hybrid: { mode: 'hybrid', motorRatio: 3.3, regen: 0.7 } }),
  'GWM Haval H6 HEV (híbrido)': car('GWM 1.5 turbo (Haval H6 híbrido)', 1750,
    { drive: 'fwd', tireRadius: 0.36, cd: 0.34, area: 2.7 }, { type: 'auto', gears: [2.2, 1.2], final: 3.6 },
    { motor: 'GWM Haval H6 HEV (tração)', battery: 'GWM H6 HEV 1,69 kWh', hybrid: { mode: 'hybrid', motorRatio: 2.5, regen: 0.6 } }),
  'GWM Haval H6 PHEV AWD': car('GWM 1.5 turbo (Haval H6 híbrido)', 2050,
    { drive: 'awd', tireRadius: 0.36, cd: 0.34, area: 2.7 }, { type: 'auto', gears: [2.2, 1.2], final: 3.6 },
    { motor: 'GWM Haval H6 PHEV AWD (2 motores)', battery: 'GWM H6 PHEV 34 kWh', hybrid: { mode: 'hybrid', motorRatio: 2.5, regen: 0.7 } }),
  'BYD Seal AWD Performance (elétrico)': car(null, 2185,
    { drive: 'awd', tireRadius: 0.35, cd: 0.22, area: 2.3, grip: 1.1 }, { type: 'auto', gears: [1.0], final: 9.0 },
    { motor: 'BYD Seal AWD Performance (2 motores)', battery: 'BYD Blade 82,5 kWh (Seal)' }),
  'BYD Dolphin (elétrico)': car(null, 1405,
    { drive: 'fwd', tireRadius: 0.32, cd: 0.29, area: 2.3 }, { type: 'auto', gears: [1.0], final: 10.0 },
    { motor: 'BYD Dolphin', battery: 'BYD Blade 44,9 kWh (Dolphin)' }),
  'Geely EX2 (elétrico)': car(null, 1240,
    { drive: 'rwd', tireRadius: 0.31, cd: 0.30, area: 2.2 }, { type: 'auto', gears: [1.0], final: 10.0 },
    { motor: 'Geely EX2', battery: 'Geely EX2 39,4 kWh (LFP)' }),
  'Porsche Taycan Turbo S (elétrico)': car(null, 2295,
    { drive: 'awd', tireRadius: 0.36, cd: 0.25, area: 2.3, grip: 1.2 }, { type: 'auto', gears: [1.0], final: 8.0 },
    { motor: 'Porsche Taycan Turbo S (2 motores)', battery: 'Porsche Taycan Performance Plus 93,4 kWh' }),
  'Volvo XC40 Recharge Twin (elétrico)': car(null, 2150,
    { drive: 'awd', tireRadius: 0.36, cd: 0.33, area: 2.6 }, { type: 'auto', gears: [1.0], final: 8.5 },
    { motor: 'Volvo XC40 Recharge Twin (2 motores)', battery: 'Volvo XC40 Recharge 78 kWh' }),
};

// ----------------------------------------------------------------------------- aplicação + calibração
export function peakOf(cfg) {
  const curve = new Engine(cfg).curve(1);
  let pp = curve[0], pt = curve[0];
  for (const p of curve) { if (p.power > pp.power) pp = p; if (p.torque > pt.torque) pt = p; }
  return { cv: hp(pp.power), rpm: pp.rpm, nm: pt.torque, rpmT: pt.rpm };
}

// ajusta o enchimento até a potência máxima bater com a ficha técnica
// 1) turbo: sobe a pressão até alcançar o platô de torque oficial
// 2) desloca o comando para o pico de potência cair na rotação oficial
// 3) ajusta o enchimento para bater a potência
export function calibrate(cfg, official) {
  cfg.engine.veScale = 1;
  cfg.valvetrain.camScale = 1;
  const boosted = cfg.intake.induction !== 'na';
  const maxBoost = Math.min(3, cfg.intake.boost * 1.5);
  const fitPower = () => {
    for (let i = 0; i < 12; i++) {
      const k = official.cv / peakOf(cfg).cv;
      if (Math.abs(k - 1) < 0.002) break;
      cfg.engine.veScale = Math.min(1.8, Math.max(0.5, cfg.engine.veScale * Math.pow(k, 0.9)));
    }
  };
  for (let pass = 0; pass < 4; pass++) {
    fitPower();
    const p = peakOf(cfg);
    if (official.rpm && !cfg.valvetrain.vtec) {
      cfg.valvetrain.camScale = Math.min(1.5, Math.max(0.65, cfg.valvetrain.camScale * Math.pow(official.rpm / p.rpm, 0.8)));
    }
    if (boosted && cfg.engine.torqueLimit > 0) {
      for (let j = 0; j < 30 && peakOf(cfg).nm < cfg.engine.torqueLimit * 0.99 && cfg.intake.boost < maxBoost; j++) cfg.intake.boost = +(cfg.intake.boost + 0.05).toFixed(2);
    } else if (boosted && official.nm) {
      const nm = peakOf(cfg).nm;
      cfg.intake.boost = +Math.min(maxBoost, Math.max(0.3, cfg.intake.boost * Math.pow(official.nm / nm, 0.8))).toFixed(2);
    }
  }
  fitPower();
  cfg.engine.veScale = +cfg.engine.veScale.toFixed(4);
  cfg.valvetrain.camScale = +cfg.valvetrain.camScale.toFixed(3);
  return cfg;
}

// troca só o motor a combustão (mantém carro, câmbio e híbrido)
export function applyEngineModel(cfg, name) {
  const m = ENGINE_MODELS[name];
  if (!m) return cfg;
  const next = clone(cfg);
  for (const k of ['engine', 'valvetrain', 'intake', 'fuel', 'ignition', 'exhaust']) {
    next[k] = deepMerge(DEFAULT_CONFIG[k], m.cfg[k] || {});
  }
  next.engine.torqueLimit = m.cfg.engine.torqueLimit || 0;
  next.nitro = clone(DEFAULT_CONFIG.nitro);
  if (m.cfg.hybrid) next.hybrid = deepMerge(next.hybrid, m.cfg.hybrid);
  next.hybrid.evOnly = false;
  if (next.hybrid.mode === 'ev' && !m.cfg.hybrid) next.hybrid.mode = 'hybrid';
  sizeFuelSystem(next, 1.25);
  normalizeConfig(next);
  calibrate(next, m.official);
  next.engineModel = name;
  next.name = name;
  return next;
}

export function applyMotorModel(cfg, name) {
  const m = MOTOR_MODELS[name];
  if (!m) return cfg;
  const next = clone(cfg);
  Object.assign(next.hybrid, { enabled: true, motorKw: m.motorKw, motorNm: m.motorNm, motorMaxRpm: m.motorMaxRpm });
  next.motorModel = name;
  return normalizeConfig(next);
}

export function applyBatteryModel(cfg, name) {
  const b = BATTERY_MODELS[name];
  if (!b) return cfg;
  const next = clone(cfg);
  Object.assign(next.hybrid, { enabled: true, ...b });
  next.batteryModel = name;
  return normalizeConfig(next);
}

export function applyCarModel(name) {
  const c = CAR_MODELS[name];
  let cfg = clone(DEFAULT_CONFIG);
  if (c.engine) cfg = applyEngineModel(cfg, c.engine);
  if (c.motor) cfg = applyMotorModel(cfg, c.motor);
  if (c.battery) cfg = applyBatteryModel(cfg, c.battery);
  if (c.hybrid) Object.assign(cfg.hybrid, c.hybrid);
  if (!c.engine) Object.assign(cfg.hybrid, { enabled: true, evOnly: true, mode: 'ev', motorRatio: 1, regen: 0.8 });
  Object.assign(cfg.vehicle, c.vehicle);
  cfg.transmission = deepMerge(DEFAULT_CONFIG.transmission, { autoClutch: true, ...c.transmission });
  if (!c.transmission.clutchTorque && c.engine) cfg.transmission.clutchTorque = Math.round(peakOf(cfg).nm * 1.4 / 10) * 10;
  normalizeConfig(cfg);
  cfg.vehicle.mass = Math.max(150, c.curbKg - engineWeight(cfg));
  cfg.name = name;
  cfg.carModel = name;
  return cfg;
}

export function officialFor(cfg) {
  return cfg.engineModel ? ENGINE_MODELS[cfg.engineModel]?.official : null;
}
