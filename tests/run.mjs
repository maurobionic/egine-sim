// Testes rápidos de sanidade do modelo: node tests/run.mjs
import assert from 'node:assert/strict';
import { Engine, hp } from '../src/engine/engine.js';
import { PRESETS, presetConfig, planToConfig, PLAN_DEFAULT, displacementL } from '../src/engine/config.js';
import { Simulation } from '../src/sim/vehicle.js';
import { Track } from '../src/sim/track.js';
import { CAR_MODELS, ENGINE_MODELS, applyCarModel, applyEngineModel, peakOf } from '../src/engine/catalog.js';

let failed = 0;
const test = (name, fn) => { try { fn(); console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n     ', e.message); } };
const peak = (cfg) => { const c = new Engine(cfg).curve(1); return { cv: Math.max(...c.map((p) => hp(p.power))), nm: Math.max(...c.map((p) => p.torque)) }; };

test('cilindrada 86x86x4 = 1998 cm³', () => {
  const c = presetConfig('Projeto padrão (2.0 16V)');
  assert.ok(Math.abs(displacementL(c) * 1000 - 1998) < 1);
});

test('potência específica de aspirado na faixa real (50–110 cv/L)', () => {
  for (const name of Object.keys(PRESETS)) {
    const c = presetConfig(name);
    if (c.intake.induction !== 'na' || c.nitro.enabled) continue;
    const cvL = peak(c).cv / displacementL(c);
    assert.ok(cvL > 25 && cvL < 115, `${name}: ${cvL.toFixed(0)} cv/L`);
  }
});

test('turbo dá mais potência que aspirado', () => {
  const na = presetConfig('Projeto padrão (2.0 16V)');
  const tb = presetConfig('Projeto padrão (2.0 16V)'); tb.intake.induction = 'turbo'; tb.intake.boost = 1.0; tb.engine.compression = 9.5;
  assert.ok(peak(tb).cv > peak(na).cv * 1.4);
});

test('nitro aumenta a potência', () => {
  const c = presetConfig('Projeto padrão (2.0 16V)');
  const e = new Engine(c);
  const off = e.compute(5000, 1, 0).power, on = e.compute(5000, 1, 0, { nitro: true }).power;
  assert.ok(on > off * 1.2, `${hp(off)} -> ${hp(on)}`);
});

test('bicos pequenos empobrecem a mistura', () => {
  const c = presetConfig('Projeto padrão (2.0 16V)'); c.fuel.injectorCc = 100;
  const r = new Engine(c).compute(6000, 1, 0);
  assert.ok(r.fuelStarved && r.lambda > 1);
});

test('diesel com taxa baixa não pega', () => {
  const c = presetConfig('Diesel 2.8 turbo (picape)'); c.engine.compression = 12;
  assert.equal(new Engine(c).canIgnite, false);
});

test('planejador gera a cilindrada pedida', () => {
  for (const d of [1.0, 2.0, 5.0]) {
    const c = planToConfig({ ...PLAN_DEFAULT, displacement: d, cylinders: d > 3 ? 8 : 4 });
    assert.ok(Math.abs(displacementL(c) - d) < 0.02, `${d} -> ${displacementL(c)}`);
  }
});

test('todos os presets ligam, aceleram e voltam para a lenta', () => {
  for (const name of Object.keys(PRESETS)) {
    const sim = new Simulation(presetConfig(name), new Track());
    for (let i = 0; i < 180; i++) sim.step(1 / 60);
    assert.ok(sim.engineOn, `${name} não ligou`);
    sim.shift(1); sim.input.throttle = 1;
    for (let i = 0; i < 300; i++) sim.step(1 / 60);
    assert.ok(sim.v > 8, `${name} não andou (${sim.v})`);
    sim.input.throttle = 0; sim.input.brake = 1;
    for (let i = 0; i < 900; i++) sim.step(1 / 60);
    assert.ok(sim.engineOn && Math.abs(sim.v) < 0.1, `${name}: motor ${sim.engineOn ? 'ligado' : 'morreu'}, v=${sim.v}`);
  }
});

test('motores do catálogo batem a potência oficial (±2%)', () => {
  const base = applyCarModel(Object.keys(CAR_MODELS)[0]);
  for (const [name, m] of Object.entries(ENGINE_MODELS)) {
    const cv = peakOf(applyEngineModel(base, name)).cv;
    assert.ok(Math.abs(cv / m.official.cv - 1) < 0.02, `${name}: ${cv.toFixed(0)} vs ${m.official.cv}`);
  }
});

test('carros do catálogo (combustão, híbridos e elétricos) andam', () => {
  for (const name of Object.keys(CAR_MODELS)) {
    const sim = new Simulation(applyCarModel(name), new Track());
    for (let i = 0; i < 120; i++) sim.step(1 / 60);
    sim.shift(1); sim.input.throttle = 1;
    for (let i = 0; i < 600; i++) { sim.step(1 / 60); if (sim.cfg.transmission.type === 'manual' && sim.rpm > sim.cfg.engine.redline - 300 && sim.shiftCooldown <= 0 && sim.gear < sim.cfg.transmission.gears.length) sim.shift(1); }
    const s = sim.snapshot();
    assert.ok(s.speed > 60, `${name}: só ${s.speed.toFixed(0)} km/h em 10 s`);
    assert.ok(!s.broken, `${name}: quebrou (${s.cause})`);
  }
});

if (failed) { console.log(`\n${failed} teste(s) falharam`); process.exit(1); }
console.log('\ntodos os testes passaram');
