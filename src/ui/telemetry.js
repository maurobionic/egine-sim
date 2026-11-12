// Painel de telemetria ao vivo (como um software de injeção / datalogger).
const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '—');

const FIELDS = [
  ['rpm', 'Rotação', 'rpm', (t) => fmt(t.rpm)],
  ['torque', 'Torque', 'N·m', (t) => fmt(t.torque)],
  ['cv', 'Potência', 'cv', (t) => fmt(Math.max(0, t.power) / 735.5)],
  ['kw', 'Potência', 'kW', (t) => fmt(Math.max(0, t.power) / 1000)],
  ['thr', 'Acelerador', '%', (t) => fmt(t.throttle * 100)],
  ['boost', 'Boost', 'bar', (t) => fmt(t.boost, 2), (c) => c.intake.induction !== 'na'],
  ['map', 'Pressão no coletor', 'kPa', (t) => fmt(t.map * 101.3)],
  ['turbo', 'Rotação da turbina', 'rpm', (t) => fmt(t.turboRpm), (c) => c.intake.induction === 'turbo' || c.intake.induction === 'twinturbo'],
  ['sc', 'Rotação do compressor', 'rpm', (t) => fmt(t.turboRpm), (c) => c.intake.induction === 'supercharger'],
  ['air', 'Fluxo de ar', 'g/s', (t) => fmt(t.airflow * 1000, 1)],
  ['fuel', 'Fluxo de combustível', 'g/s', (t) => fmt(t.fuelFlow * 1000, 2)],
  ['lph', 'Consumo', 'L/h', (t) => fmt(t.fuelLph, 1)],
  ['lambda', 'Lambda (λ)', '', (t) => fmt(t.lambda, 2)],
  ['afr', 'Relação ar/comb. (AFR)', ':1', (t) => fmt(t.afr, 1)],
  ['iat', 'Temp. do ar admitido', '°C', (t) => fmt(t.intakeTemp)],
  ['coolant', 'Temp. da água', '°C', (t) => fmt(t.coolant)],
  ['oil', 'Temp. do óleo', '°C', (t) => fmt(t.oilTemp)],
  ['health', 'Saúde do motor', '%', (t) => fmt((t.health ?? NaN) * 100, 1)],
  ['egt', 'Temp. do escape (EGT)', '°C', (t) => fmt(t.egt)],
  ['ve', 'Eficiência volumétrica', '%', (t) => fmt(t.ve * 100)],
  ['eta', 'Eficiência térmica', '%', (t) => fmt(t.eta * 100, 1)],
  ['bsfc', 'Consumo específico', 'g/kWh', (t) => fmt(t.bsfc)],
  ['timing', 'Ponto (rel. ao mapa)', '°', (t) => fmt(t.timing, 1), (c, e) => !e.isDiesel],
  ['retard', 'Atraso p/ detonação', '°', (t) => fmt(t.retard, 1), (c, e) => !e.isDiesel],
  ['duty', 'Duty dos bicos', '%', (t) => fmt(t.injDuty * 100), (c) => c.fuel.injection !== 'carb'],
  ['pump', 'Uso da bomba', '%', (t) => fmt(t.pumpUse * 100)],
  ['misfire', 'Falhas de ignição', '%', (t) => fmt(t.misfire * 100), (c, e) => !e.isDiesel],
  ['smoke', 'Fumaça', '%', (t) => fmt(t.smoke * 100), (c, e) => e.isDiesel],
  ['nitroKg', 'Nitro no cilindro', 'kg', (t) => fmt(t.nitroKg, 2), (c) => c.nitro.enabled],
  ['speed', 'Velocidade', 'km/h', (t) => fmt(Math.abs(t.speed ?? NaN))],
  ['gear', 'Marcha', '', (t) => t.gearLabel ?? '—'],
  ['clutch', 'Embreagem acoplada', '%', (t) => fmt((t.clutch ?? NaN) * 100)],
  ['wheelT', 'Torque na roda', 'N·m', (t) => fmt(t.wheelTorque)],
  ['accel', 'Aceleração', 'g', (t) => fmt(t.accelG, 2)],
  ['l100', 'Consumo instantâneo', 'L/100km', (t) => fmt(t.lPer100, 1)],
  ['soc', 'Bateria', '%', (t) => fmt(t.soc * 100), (c) => c.hybrid.enabled],
  ['motor', 'Motor elétrico', 'kW', (t) => fmt((t.motorPower ?? NaN) / 1000, 1), (c) => c.hybrid.enabled],
  ['brake', 'Freio do dinamômetro', 'N·m', (t) => fmt(t.brakeTorque), () => false],
];

export class Telemetry {
  constructor(el) { this.el = el; this.cells = {}; this.key = ''; this.last = 0; }

  build(cfg, engine, mode) {
    const key = JSON.stringify([cfg.intake.induction, cfg.fuel.injection, cfg.fuel.type, cfg.nitro.enabled, cfg.hybrid.enabled, mode]);
    if (key === this.key) return;
    this.key = key; this.el.innerHTML = ''; this.cells = {};
    for (const [id, label, unit, , show] of FIELDS) {
      if (show && !show(cfg, engine) && !(id === 'brake' && mode === 'dyno')) continue;
      if (mode === 'dyno' && ['speed', 'gear', 'clutch', 'wheelT', 'accel', 'l100', 'motor', 'soc'].includes(id)) continue;
      const d = document.createElement('div'); d.className = 'tile';
      d.innerHTML = `<span class="l">${label}</span><span class="v">—</span><span class="u">${unit}</span>`;
      this.el.appendChild(d); this.cells[id] = d.querySelector('.v');
    }
  }

  update(t, now) {
    if (now - this.last < 66) return; // ~15 vezes por segundo
    this.last = now;
    for (const [id, , , fn] of FIELDS) {
      const c = this.cells[id];
      if (!c) continue;
      c.textContent = fn(t);
      c.classList.toggle('warn',
        (id === 'retard' && t.retard > 6) || (id === 'lambda' && t.lambda > 1.05 && t.throttle > 0.8) ||
        (id === 'duty' && t.injDuty > 0.9) || (id === 'pump' && t.pumpUse > 0.9) || (id === 'egt' && t.egt > 950) ||
        (id === 'misfire' && t.misfire > 0.02) || (id === 'rpm' && t.cut) ||
        (id === 'coolant' && t.coolant > 105) || (id === 'oil' && t.oilTemp > 135) || (id === 'health' && t.health < 0.999));
    }
  }
}
