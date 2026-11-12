import { Engine, hp } from './engine/engine.js';
import { PRESETS, presetConfig, planToConfig, displacementL, engineWeight, estimateCost, clone, deepMerge, DEFAULT_CONFIG, normalizeConfig } from './engine/config.js';
import { Simulation } from './sim/vehicle.js';
import { Dyno } from './sim/dyno.js';
import { Track } from './sim/track.js';
import { EngineAudio } from './audio/engineAudio.js';
import { DriveView } from './render/driveView.js';
import { DynoChart, StripChart } from './render/charts.js';
import { Builder } from './ui/builder.js';
import { Planner } from './ui/planner.js';
import { Telemetry } from './ui/telemetry.js';
import { EngineView } from './render/engineView.js';
import { ENGINE_MODELS, MOTOR_MODELS, BATTERY_MODELS, CAR_MODELS, applyEngineModel, applyMotorModel, applyBatteryModel, applyCarModel, officialFor, peakOf } from './engine/catalog.js';

const $ = (id) => document.getElementById(id);
const STORAGE = 'engine-sim.config.v1';

// ------------------------------------------------------------------ estado
function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) return normalizeConfig(deepMerge(DEFAULT_CONFIG, JSON.parse(raw)));
  } catch { /* sem armazenamento */ }
  return presetConfig(Object.keys(PRESETS)[0]);
}
let cfg = loadSaved();
let step = 'build';

const track = new Track();
const sim = new Simulation(cfg, track);
const dyno = new Dyno(new Engine(cfg));
const curveEngine = new Engine(cfg);
const audio = new EngineAudio();
const driveView = new DriveView($('drive'), track);
const chart = new DynoChart($('dyno'));
const strip = new StripChart($('strip'), [
  { label: 'Rotação', unit: 'rpm', color: '#ff6b00', min: 0 },
  { label: 'Torque', unit: 'N·m', color: '#ff8c42' },
  { label: 'Potência', unit: 'cv', color: '#4dabf7', min: 0 },
  { label: 'Boost', unit: 'bar', color: '#69db7c', dec: 2, minRange: 0.2 },
  { label: 'Lambda', unit: '', color: '#e599f7', dec: 2, minRange: 0.1 },
  { label: 'Fluxo de ar', unit: 'g/s', color: '#a5d8ff', min: 0 },
]);
const telemetry = new Telemetry($('telemetry'));
const engineView = new EngineView($('engine-cut'), $('engine-flow'));
$('slow').onchange = () => { engineView.slow = Number($('slow').value); };

// ------------------------------------------------------------------ config
let saveTimer = 0;
function configChanged() {
  normalizeConfig(cfg);
  sim.setConfig(cfg);
  dyno.engine.setConfig(cfg);
  curveEngine.setConfig(cfg);
  audio.configure(cfg, sim.engine);
  chart.curve = curveEngine.curve(1, { nitro: cfg.nitro.enabled });
  updateSummary();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(STORAGE, JSON.stringify(cfg)); } catch { /* ok */ } }, 300);
}

function setConfig(newCfg) {
  cfg = normalizeConfig(newCfg);
  builder.render();
  configChanged();
  sim.reset();
}

const builder = new Builder($('tabs'), $('parts'), () => cfg, configChanged);
// aba "Catálogo": componentes reais, aplicados separadamente (dá para misturar)
builder.renderCatalog = (el) => {
  const card = (title, list, apply, help) => {
    const d = document.createElement('div'); d.className = 'catalog-card';
    d.innerHTML = `<h4>${title}</h4>`;
    const sel = document.createElement('select');
    sel.innerHTML = '<option value="">Escolher…</option>' + Object.keys(list).map((k) => `<option>${k}</option>`).join('');
    const btn = document.createElement('button'); btn.textContent = 'Aplicar';
    const cmp = document.createElement('div'); cmp.className = 'cmp'; cmp.textContent = help;
    sel.onchange = () => { const v = list[sel.value]; cmp.textContent = v ? (v.official?.note || v.note || (v.batteryKwh ? `${v.batteryKwh} kWh · ${v.batteryKw} kW · ${v.batteryKg} kg` : help)) : help; };
    btn.onclick = () => { if (!sel.value) return; chart.ghost = chart.curve; setConfig(apply(sel.value)); builder.tab = 'Catálogo'; builder.renderTabs(); builder.render(); };
    d.append(sel, btn, cmp); el.appendChild(d);
  };
  card('Carro completo', CAR_MODELS, (n) => applyCarModel(n), 'Carro com motor, câmbio, peso e pneus de fábrica.');
  card('Motor a combustão (troca só o motor)', ENGINE_MODELS, (n) => applyEngineModel(cfg, n), 'Mantém carro, câmbio e híbrido. Calibrado para bater a ficha técnica.');
  card('Motor elétrico', MOTOR_MODELS, (n) => applyMotorModel(cfg, n), 'Liga o sistema híbrido com este motor elétrico.');
  card('Bateria', BATTERY_MODELS, (n) => applyBatteryModel(cfg, n), 'Capacidade, potência e peso reais.');
  const off = officialFor(cfg);
  if (off) {
    const p = peakOf(cfg);
    const d = document.createElement('div'); d.className = 'catalog-card';
    d.innerHTML = `<h4>${cfg.engineModel}</h4><div class="cmp">Ficha técnica: ${off.note}<br>Simulado: <b>${p.cv.toFixed(0)} cv</b> @ ${p.rpm} rpm · <b>${p.nm.toFixed(0)} N·m</b> @ ${p.rpmT} rpm<br>Bicos, bomba e escape são estimados (as montadoras não publicam).</div>`;
    el.appendChild(d);
  }
  const n = document.createElement('p'); n.className = 'note';
  n.textContent = 'Misture à vontade: um W12 com bateria de Taycan, um Fire 1.0 com motor elétrico do Seal… Depois ajuste qualquer peça nas outras abas.';
  el.appendChild(n);
};
const planner = new Planner($('planner'),
  (plan) => { chart.curve = new Engine(planToConfig(plan)).curve(1); updateSummary(planToConfig(plan)); },
  (plan) => { chart.ghost = chart.curve; setConfig(planToConfig(plan)); goto('build'); });

// presets
const presetSel = $('preset');
for (const name of Object.keys(PRESETS)) { const o = document.createElement('option'); o.textContent = name; presetSel.appendChild(o); }
presetSel.value = '';
presetSel.onchange = () => { if (presetSel.value) { chart.ghost = chart.curve; setConfig(presetConfig(presetSel.value)); presetSel.value = ''; } };

$('btn-ghost').onclick = () => { chart.ghost = clone(chart.curve); };
$('btn-export').onclick = () => {
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = (cfg.name || 'motor').replace(/[^\w-]+/g, '_') + '.json'; a.click();
};
$('btn-import').onclick = () => $('file').click();
$('file').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { setConfig(deepMerge(DEFAULT_CONFIG, JSON.parse(await f.text()))); } catch (err) { alert('Arquivo inválido: ' + err.message); }
  e.target.value = '';
};

// ------------------------------------------------------------------ resumo do projeto
function updateSummary(c = cfg) {
  const e = new Engine(c);
  const curve = c === cfg ? chart.curve : e.curve(1);
  let pt = curve[0], pp = curve[0];
  for (const p of curve) { if (p.torque > pt.torque) pt = p; if (p.power > pp.power) pp = p; }
  const d = displacementL(c);
  const pistonSpeed = 2 * c.engine.stroke / 1000 * c.engine.redline / 60;
  const ew = engineWeight(c), total = c.vehicle.mass + ew;
  const cv = hp(pp.power);
  const warn = [];
  if (pistonSpeed > 25) warn.push(`Velocidade média do pistão muito alta (${pistonSpeed.toFixed(1)} m/s) — risco de quebra.`);
  const atPeak = e.compute(pp.rpm, 1, pp.boost);
  if (curve.some((p) => p.floating)) warn.push('Flutuação de válvula antes do corte: troque o comando ou baixe o corte.');
  if (atPeak.retard > 5) warn.push(`Detonação: a central atrasa ${atPeak.retard.toFixed(1)}° em plena carga. Baixe a taxa/boost ou use combustível melhor.`);
  if (atPeak.knock > 0 && c.ignition.type === 'distributor') warn.push('Detonação SEM sensor (distribuidor): o motor está batendo pino!');
  if (atPeak.fuelStarved) warn.push('Falta combustível em alta: aumente os bicos ou a bomba.');
  if (atPeak.misfire > 0.02) warn.push('Falhas de ignição em giro alto (limite do distribuidor ou mistura pobre).');
  if (pt.torque > c.transmission.clutchTorque) warn.push(`Embreagem (${c.transmission.clutchTorque} N·m) menor que o torque do motor: vai patinar.`);
  if (!e.canIgnite) warn.push('Diesel com taxa abaixo de 14:1 não pega!');
  if (c.fuel.injection === 'carb' && c.fuel.carbCfm < e.carbNeedMax() * 0.85) warn.push('Carburador pequeno para esse motor (estrangula em alta).');
  if (c.fuel.injection === 'carb' && c.fuel.carbCfm > e.carbNeedMax() * 1.4) warn.push('Carburador grande demais: engasga e perde resposta em baixa.');
  $('summary').innerHTML = `
    <h3>${c.name || 'Projeto'}</h3>
    <div class="stats">
      <div><b>${(d * 1000).toFixed(0)}</b> cm³</div>
      <div><b>${c.engine.bore} × ${c.engine.stroke}</b> mm</div>
      <div><b>${cv.toFixed(0)}</b> cv @ ${pp.rpm}</div>
      <div><b>${pt.torque.toFixed(0)}</b> N·m @ ${pt.rpm}</div>
      <div><b>${(cv / d).toFixed(0)}</b> cv/L</div>
      <div><b>${pistonSpeed.toFixed(1)}</b> m/s pistão</div>
      <div><b>${ew}</b> kg motor</div>
      <div><b>${total}</b> kg total</div>
      <div><b>${(total / Math.max(cv, 1)).toFixed(1)}</b> kg/cv</div>
      <div><b>R$ ${estimateCost(c).toLocaleString('pt-BR')}</b></div>
    </div>
    ${warn.length ? `<ul class="warnings">${warn.map((w) => `<li>${w}</li>`).join('')}</ul>` : '<p class="ok">Nenhum problema detectado.</p>'}`;
}

// ------------------------------------------------------------------ navegação entre etapas
function goto(s) {
  step = s;
  document.body.dataset.step = s;
  document.querySelectorAll('.steps button').forEach((b) => b.classList.toggle('active', b.dataset.step === s));
  if (s === 'drive') { driveView.resize(); }
  if (s !== 'dyno') { dyno.sweep = null; }
  document.querySelectorAll('.only-drive.only-inside').forEach((e) => (e.style.display = ''));
  telemetry.key = '';
  requestAnimationFrame(() => { chart.draw(); driveView.resize(); });
}
document.querySelectorAll('.steps button').forEach((b) => (b.onclick = () => goto(b.dataset.step)));

// ------------------------------------------------------------------ controles
const keys = new Set();
const ctrl = { throttle: 0, brake: 0, clutch: 0, fixedThrottle: 0 };
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range' || e.target.tagName === 'SELECT') return;
  ensureAudio();
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
  if (e.repeat) { keys.add(k); return; }
  keys.add(k);
  if (k === 'e' || k === 'arrowright') sim.shift(1);
  if (k === 'q' || k === 'arrowleft') sim.shift(-1);
  if (k === 'i') { if (step === 'drive' || step === 'inside') sim.ignition(); else (dyno.on ? dyno.stop() : dyno.start()); }
  if (k === 'r' && (step === 'drive' || step === 'inside')) { sim.reset(); sim.engine.refillNitro(); }
  if (k === 'm') $('btn-sound').textContent = audio.toggleMute() ? '🔇 Som' : '🔊 Som';
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

$('thr').oninput = () => { ctrl.fixedThrottle = Number($('thr').value) / 100; $('thr-v').textContent = $('thr').value + '%'; };
$('load').oninput = () => { dyno.load = Number($('load').value) / 100; $('load-v').textContent = $('load').value + '%'; };
$('btn-dyno-start').onclick = () => { ensureAudio(); dyno.on ? dyno.stop() : dyno.start(); };
$('btn-sweep').onclick = () => { ensureAudio(); dyno.startSweep(1); };
$('btn-refill').onclick = () => { sim.engine.refillNitro(); dyno.engine.refillNitro(); };
$('btn-repair').onclick = () => { sim.engine.repair(); dyno.engine.repair(); sim.stalled = false; };

let audioStarting = false;
async function ensureAudio() {
  if (audio.ready || audioStarting) return;
  audioStarting = true;
  try { await audio.start(); audio.configure(cfg, sim.engine); $('btn-sound').textContent = '🔊 Som'; }
  catch (err) { console.error(err); $('btn-sound').textContent = 'Som indisponível'; }
  audioStarting = false;
}
$('btn-sound').onclick = async () => {
  if (!audio.ready) { await ensureAudio(); return; }
  $('btn-sound').textContent = audio.toggleMute() ? '🔇 Som' : '🔊 Som';
};
$('vol').oninput = () => audio.setVolume(Number($('vol').value) / 100);
document.addEventListener('pointerdown', ensureAudio, { once: true });

function readInputs(dt) {
  const up = keys.has('arrowup') || keys.has('w');
  const down = keys.has('arrowdown') || keys.has('s');
  const rate = (target, cur, upRate, downRate) => cur + Math.max(-downRate * dt, Math.min(upRate * dt, target - cur));
  ctrl.throttle = rate(up ? 1 : ctrl.fixedThrottle, ctrl.throttle, 8, 10);
  ctrl.brake = rate(down ? 1 : 0, ctrl.brake, 6, 10);
  ctrl.clutch = rate(keys.has('c') ? 1 : 0, ctrl.clutch, 8, 2.5);
  return keys.has('n');
}

// ------------------------------------------------------------------ laço principal
let lastT = performance.now(), stripAcc = 0, chartAcc = 0;
dyno.start();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const nitro = readInputs(dt);
  let snap;
  if (step === 'drive' || step === 'inside') {
    sim.input.throttle = ctrl.throttle; sim.input.brake = ctrl.brake; sim.input.clutch = ctrl.clutch; sim.input.nitro = nitro;
    sim.step(dt);
    snap = sim.snapshot();
    if (step === 'drive') driveView.draw(sim, snap, dt);
    else {
      engineView.advance(dt, snap.rpm, snap.turboRpm);
      engineView.draw(cfg, sim.engine, snap);
      engineView.drawFlow(cfg, snap);
    }
  } else {
    dyno.throttle = ctrl.throttle; dyno.nitro = nitro;
    dyno.load = step === 'dyno' ? Number($('load').value) / 100 : 0;
    dyno.step(dt);
    snap = dyno.snapshot();
    chartAcc += dt;
    if (chartAcc > 1 / 30) {
      chartAcc = 0;
      chart.live = step === 'dyno' || snap.throttle > 0.05 ? snap : null;
      chart.sweep = dyno.sweep ? dyno.sweep.data : step === 'dyno' ? dyno.lastSweep : null;
      chart.draw();
    }
  }
  audio.update(snap);
  telemetry.build(cfg, sim.engine, step === 'drive' || step === 'inside' ? 'drive' : 'dyno');
  const hEl = $('health');
  if (hEl && (step === 'drive' || step === 'inside' || step === 'dyno')) {
    const hl = snap.health ?? 1;
    hEl.className = hl < 0.5 ? 'bad' : '';
    hEl.innerHTML = `Saúde do motor: <b>${(hl * 100).toFixed(1)}%</b><div class="bar"><i style="width:${hl * 100}%"></i></div>` +
      (snap.broken ? `<span style="color:var(--warn)">Quebrou: ${snap.cause}</span>` : snap.damageNow ? `<span style="color:var(--warn)">Danificando: ${snap.damageNow}</span>` : '');
  }
  telemetry.update(snap, now);
  stripAcc += dt;
  if (stripAcc > 1 / 60) {
    stripAcc = 0;
    strip.push([snap.rpm, snap.torque, Math.max(0, snap.power) / 735.5, snap.boost, snap.lambda, snap.airflow * 1000]);
    if (step === 'drive' || step === 'dyno' || step === 'inside') strip.draw();
  }
  $('dyno-state').textContent = dyno.sweep ? `Puxada… ${Math.round(dyno.rpm)} rpm` : dyno.on ? 'Motor ligado' : dyno.starting ? 'Dando partida…' : 'Motor desligado';
  $('btn-dyno-start').textContent = dyno.on ? 'Desligar motor (I)' : 'Ligar motor (I)';
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => { driveView.resize(); chart.draw(); });
configChanged();
chart.ghost = null;
goto('plan');
requestAnimationFrame(frame);

// para depuração no console
window.engineSim = { sim, dyno, get cfg() { return cfg; }, setConfig };
