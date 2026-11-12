// "Montador": lista de peças e ajustes, agrupadas por abas. Gerado a partir de um esquema.
import { CAMS, VALVETRAINS, TURBOS } from '../engine/engine.js';
import { FUELS, isDieselFuel } from '../engine/fuels.js';
import { injectionOptions, makeGears, normalizeConfig } from '../engine/config.js';

const opts = (obj) => Object.entries(obj).map(([k, v]) => [k, v.name ?? v]);
const diesel = (c) => isDieselFuel(c.fuel.type);
const otto = (c) => !diesel(c);
const carb = (c) => c.fuel.injection === 'carb';
const boosted = (c) => c.intake.induction !== 'na';

export const SCHEMA = [
  { tab: 'Catálogo', items: [{ type: 'catalog' }] },
  { tab: 'Bloco', items: [
    { path: 'engine.layout', label: 'Arquitetura', type: 'select', options: [['inline', 'Em linha'], ['v', 'Em V'], ['boxer', 'Boxer (contraposto)']] },
    { path: 'engine.cylinders', label: 'Cilindros', type: 'select', num: true, options: [1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => [n, `${n}`]) },
    { path: 'engine.vAngle', label: 'Ângulo do V', type: 'range', min: 15, max: 120, step: 1, unit: '°', show: (c) => c.engine.layout === 'v', hint: 'V6 a 90° vira ignição irregular. V-twin: 45° = "batata".' },
    { path: 'engine.crankplane', label: 'Virabrequim (V8)', type: 'select', options: [['cross', 'Cruzado (ronco borbulhante)'], ['flat', 'Plano (grito de pista)']], show: (c) => c.engine.layout === 'v' && c.engine.cylinders === 8 },
    { path: 'engine.bore', label: 'Diâmetro do pistão', type: 'range', min: 50, max: 130, step: 0.1, unit: 'mm' },
    { path: 'engine.stroke', label: 'Curso do pistão', type: 'range', min: 40, max: 140, step: 0.1, unit: 'mm', hint: 'Curso longo = torque em baixa; curto = gira mais.' },
    { path: 'engine.compression', label: 'Taxa de compressão', type: 'range', min: 6, max: 23, step: 0.1, unit: ':1', hint: 'Mais taxa = mais eficiência, mas mais detonação. Diesel precisa de 14+.' },
    { path: 'engine.redline', label: 'Corte de giro', type: 'range', min: 2500, max: 13000, step: 100, unit: 'rpm' },
    { path: 'engine.idleRpm', label: 'Marcha lenta', type: 'range', min: 500, max: 1600, step: 10, unit: 'rpm' },
    { path: 'engine.flywheel', label: 'Volante do motor', type: 'select', options: [['light', 'Leve (sobe giro rápido)'], ['normal', 'Normal'], ['heavy', 'Pesado (suave)']] },
    { path: 'engine.atkinson', label: 'Ciclo Atkinson (eficiência de híbrido)', type: 'check', show: otto },
    { path: 'engine.torqueLimit', label: 'Limitador de torque da central (0 = livre)', type: 'range', min: 0, max: 1500, step: 5, unit: 'N·m', hint: 'Motores turbo modernos limitam o torque para proteger câmbio e motor.' },
    { path: 'engine.veScale', label: 'Calibração de enchimento', type: 'range', min: 0.55, max: 1.6, step: 0.005, hint: 'Ajuste fino do modelo. Os motores do catálogo são calibrados para bater a ficha técnica.' },
  ]},
  { tab: 'Cabeçote', items: [
    { path: 'valvetrain.type', label: 'Comando de válvulas', type: 'select', options: opts(VALVETRAINS), hint: 'Válvulas eletromagnéticas: perfil ideal em todo giro e quase sem perda de bombeamento.' },
    { path: 'valvetrain.valvesPerCyl', label: 'Válvulas por cilindro', type: 'select', num: true, options: [[2, '2'], [3, '3'], [4, '4'], [5, '5']] },
    { path: 'valvetrain.cam', label: 'Perfil do comando', type: 'select', options: opts(CAMS), show: (c) => c.valvetrain.type !== 'camless' },
    { path: 'valvetrain.vvt', label: 'Comando variável contínuo (VVT)', type: 'check', show: (c) => c.valvetrain.type !== 'camless' && c.valvetrain.type !== 'ohv' },
    { path: 'valvetrain.variableLift', label: 'Levante variável contínuo (tipo Valvetronic)', type: 'check', show: (c) => otto(c) && c.valvetrain.type !== 'camless' },
    { path: 'valvetrain.vtec', label: 'Comando escalonado (tipo VTEC)', type: 'check', show: (c) => otto(c) && c.valvetrain.type !== 'camless' && c.valvetrain.type !== 'ohv' },
    { path: 'valvetrain.vtecCam', label: 'Perfil alto (VTEC)', type: 'select', options: opts(CAMS), show: (c) => c.valvetrain.vtec && c.valvetrain.type !== 'camless' },
    { path: 'valvetrain.vtecRpm', label: 'Rotação de troca do VTEC', type: 'range', min: 2500, max: 9000, step: 100, unit: 'rpm', show: (c) => c.valvetrain.vtec && c.valvetrain.type !== 'camless' },
  ]},
  { tab: 'Admissão', items: [
    { path: 'intake.filter', label: 'Filtro de ar', type: 'select', options: [['paper', 'Papel (original)'], ['performance', 'Esportivo de algodão'], ['cone', 'Cônico aberto'], ['none', 'Sem filtro (só pista)']] },
    { path: 'intake.throttle', label: 'Borboleta', type: 'select', options: [['single', 'Corpo de borboleta único'], ['itb', 'Borboletas individuais (ITB)']], show: otto },
    { path: 'intake.runnerLength', label: 'Comprimento do coletor', type: 'range', min: 150, max: 700, step: 5, unit: 'mm', hint: 'Coletor longo = torque em baixa; curto = potência em alta.' },
    { path: 'intake.induction', label: 'Alimentação', type: 'select', options: [['na', 'Aspirado'], ['turbo', 'Turbo'], ['twinturbo', 'Biturbo'], ['supercharger', 'Supercharger (compressor)']] },
    { path: 'intake.boost', label: 'Pressão máxima (boost)', type: 'range', min: 0.2, max: 3.5, step: 0.05, unit: 'bar', show: boosted },
    { path: 'intake.turboSize', label: 'Tamanho da turbina', type: 'select', options: opts(TURBOS), show: (c) => c.intake.induction === 'turbo' || c.intake.induction === 'twinturbo' },
    { path: 'intake.intercooler', label: 'Intercooler', type: 'check', show: boosted },
    { path: 'intake.blowoff', label: 'Válvula de alívio (espirra)', type: 'check', show: (c) => otto(c) && (c.intake.induction === 'turbo' || c.intake.induction === 'twinturbo') },
  ]},
  { tab: 'Nitro', items: [
    { path: 'nitro.enabled', label: 'Kit de nitro (N₂O)', type: 'check', show: otto, hint: 'Segure N com o acelerador no fundo para injetar.' },
    { path: 'nitro.shot', label: 'Tamanho do kit', type: 'range', min: 25, max: 300, step: 5, unit: 'cv nominais', show: (c) => otto(c) && c.nitro.enabled },
    { path: 'nitro.bottleKg', label: 'Cilindro', type: 'range', min: 1, max: 10, step: 0.5, unit: 'kg', show: (c) => otto(c) && c.nitro.enabled },
    { path: 'nitro.minRpm', label: 'Ativa acima de', type: 'range', min: 1500, max: 7000, step: 100, unit: 'rpm', show: (c) => otto(c) && c.nitro.enabled },
    { label: 'O nitro só existe em motores a gasolina, etanol ou metanol.', type: 'note', show: diesel },
  ]},
  { tab: 'Combustível', items: [
    { path: 'fuel.type', label: 'Combustível', type: 'select', options: opts(FUELS), rerender: true },
    { path: 'fuel.injection', label: 'Alimentação de combustível', type: 'select', options: (c) => injectionOptions(c.fuel.type) },
    { path: 'fuel.carbCfm', label: 'Tamanho do carburador', type: 'range', min: 100, max: 1250, step: 25, unit: 'CFM', show: carb, hint: 'Pequeno demais estrangula em alta; grande demais "engasga" em baixa.' },
    { path: 'fuel.carbJet', label: 'Gicleur principal', type: 'range', min: -10, max: 10, step: 1, unit: 'passos', show: carb, hint: '+ enriquece a mistura em carga, − empobrece.' },
    { path: 'fuel.idleMix', label: 'Parafuso da mistura da lenta', type: 'range', min: -1, max: 1, step: 0.05, show: carb },
    { path: 'fuel.injectorCc', label: 'Vazão dos bicos injetores', type: 'range', min: 80, max: 2500, step: 10, unit: 'cc/min', show: (c) => !carb(c), hint: 'Se for pequeno, a mistura empobrece em alta (veja "duty do bico").' },
    { path: 'fuel.pumpLph', label: 'Bomba de combustível', type: 'range', min: 40, max: 900, step: 10, unit: 'L/h' },
    { path: 'fuel.pressureBar', label: 'Pressão da linha / rail', type: 'range', min: 0.2, max: 2500, step: 0.1, unit: 'bar', show: (c) => !carb(c), hint: 'Indireta ~3–4 bar · direta 150–350 bar · diesel common-rail 1600–2500 bar. Vazão do bico ∝ √pressão.' },
    { path: 'fuel.lambda', label: 'Mistura em plena carga (λ)', type: 'range', min: 0.7, max: 1.1, step: 0.01, show: (c) => otto(c) && !carb(c), hint: 'λ 0,85–0,90 = potência máxima. λ 1 = econômico. Pobre esquenta e detona.' },
    { path: 'fuel.smokeLambda', label: 'Limite de fumaça (λ mín.)', type: 'range', min: 1.0, max: 2.0, step: 0.01, show: diesel, hint: 'Mais baixo = mais diesel injetado, mais torque e mais fumaça preta.' },
  ]},
  { tab: 'Ignição', items: [
    { path: 'ignition.type', label: 'Sistema de ignição', type: 'select', options: [['distributor', 'Distribuidor (sem sensor de detonação)'], ['wasted', 'Centelha perdida (bobina dupla)'], ['cop', 'Bobina individual por cilindro']], show: otto, hint: 'O distribuidor falha em giro alto e não protege contra detonação.' },
    { path: 'fuel.timing', label: 'Ponto de ignição (avanço)', type: 'range', min: -15, max: 15, step: 0.5, unit: '°', show: otto, hint: 'O ótimo é por volta de +4°. Muito avanço detona.' },
    { label: 'Motor diesel: não tem vela nem ignição. A combustão é por compressão.', type: 'note', show: diesel },
  ]},
  { tab: 'Escape', items: [
    { path: 'exhaust.headers', label: 'Coletor de escape', type: 'select', options: [['cast', 'Ferro fundido (original)'], ['tubular', 'Dimensionado curto'], ['longtube', 'Dimensionado longo']] },
    { path: 'exhaust.unequal', label: 'Coletor de comprimentos desiguais (ronco irregular)', type: 'check' },
    { path: 'exhaust.layout', label: 'Saída', type: 'select', options: [['single', 'Simples'], ['dual', 'Dupla (uma por bancada)']] },
    { path: 'exhaust.diameter', label: 'Diâmetro do tubo', type: 'range', min: 32, max: 110, step: 1, unit: 'mm', hint: 'Maior = mais grave e mais fluxo; grande demais perde torque em baixa.' },
    { path: 'exhaust.length', label: 'Comprimento do escape', type: 'range', min: 0.5, max: 5, step: 0.1, unit: 'm', hint: 'Muda a ressonância (o "timbre") do ronco.' },
    { path: 'exhaust.cat', label: 'Catalisador', type: 'check' },
    { path: 'exhaust.muffler', label: 'Abafador', type: 'select', options: [['stock', 'Original (silencioso)'], ['sport', 'Esportivo'], ['straight', 'Reto (direto)'], ['none', 'Sem abafador (aberto)']] },
    { path: 'exhaust.resonator', label: 'Ressonador (tira o "zumbido")', type: 'check' },
  ]},
  { tab: 'Câmbio', items: [
    { path: 'transmission.type', label: 'Tipo', type: 'select', options: [['manual', 'Manual'], ['auto', 'Automático']] },
    { path: 'transmission.autoClutch', label: 'Embreagem automática (manual)', type: 'check', show: (c) => c.transmission.type === 'manual', hint: 'Desligue para usar a embreagem na tecla C.' },
    { path: 'transmission.gearCount', label: 'Número de marchas', type: 'range', min: 1, max: 10, step: 1, virtual: true },
    { type: 'gears' },
    { path: 'transmission.final', label: 'Diferencial (relação final)', type: 'range', min: 2, max: 6.5, step: 0.01 },
    { path: 'transmission.reverse', label: 'Ré', type: 'range', min: 2, max: 5, step: 0.01 },
    { path: 'transmission.clutchTorque', label: 'Capacidade da embreagem', type: 'range', min: 80, max: 1500, step: 10, unit: 'N·m', hint: 'Se for menor que o torque do motor, a embreagem patina.' },
    { path: 'transmission.shiftTime', label: 'Tempo de troca', type: 'range', min: 0.05, max: 0.8, step: 0.01, unit: 's' },
  ]},
  { tab: 'Híbrido', items: [
    { path: 'hybrid.enabled', label: 'Sistema híbrido (motor elétrico entre embreagem e câmbio)', type: 'check' },
    { path: 'hybrid.evOnly', label: 'Carro 100% elétrico (sem motor a combustão)', type: 'check', show: (c) => c.hybrid.enabled },
    { path: 'hybrid.motorKw', label: 'Potência do motor elétrico', type: 'range', min: 5, max: 300, step: 1, unit: 'kW', show: (c) => c.hybrid.enabled },
    { path: 'hybrid.motorNm', label: 'Torque do motor elétrico', type: 'range', min: 30, max: 800, step: 5, unit: 'N·m', show: (c) => c.hybrid.enabled },
    { path: 'hybrid.motorMaxRpm', label: 'Rotação máxima do motor elétrico', type: 'range', min: 3000, max: 25000, step: 100, unit: 'rpm', show: (c) => c.hybrid.enabled },
    { path: 'hybrid.motorRatio', label: 'Redução própria do motor elétrico', type: 'range', min: 1, max: 12, step: 0.05, show: (c) => c.hybrid.enabled },
    { path: 'hybrid.batteryKwh', label: 'Capacidade da bateria', type: 'range', min: 0.3, max: 150, step: 0.1, unit: 'kWh', show: (c) => c.hybrid.enabled },
    { path: 'hybrid.batteryKw', label: 'Potência máxima da bateria', type: 'range', min: 5, max: 800, step: 5, unit: 'kW', show: (c) => c.hybrid.enabled },
    { path: 'hybrid.batteryKg', label: 'Peso da bateria (0 = estimado)', type: 'range', min: 0, max: 900, step: 5, unit: 'kg', show: (c) => c.hybrid.enabled },
    { path: 'hybrid.regen', label: 'Freio regenerativo', type: 'range', min: 0, max: 1, step: 0.05, show: (c) => c.hybrid.enabled, hint: 'Recupera energia ao frear e ao tirar o pé.' },
    { path: 'hybrid.mode', label: 'Modo', type: 'select', options: [['hybrid', 'Híbrido (ajuda o motor)'], ['sport', 'Esporte (tudo junto)'], ['ev', 'Elétrico puro (motor desligado)'], ['charge', 'Carregar bateria']], show: (c) => c.hybrid.enabled },
  ]},
  { tab: 'Carro', items: [
    { path: 'vehicle.mass', label: 'Peso do carro (sem motor)', type: 'range', min: 100, max: 3500, step: 10, unit: 'kg' },
    { path: 'vehicle.drive', label: 'Tração', type: 'select', options: [['fwd', 'Dianteira'], ['rwd', 'Traseira'], ['awd', 'Integral (4x4)']] },
    { path: 'vehicle.tireRadius', label: 'Raio do pneu', type: 'range', min: 0.12, max: 0.5, step: 0.005, unit: 'm' },
    { path: 'vehicle.grip', label: 'Aderência do pneu', type: 'range', min: 0.5, max: 1.6, step: 0.01, unit: 'μ' },
    { path: 'vehicle.cd', label: 'Coeficiente aerodinâmico (Cx)', type: 'range', min: 0.2, max: 0.8, step: 0.01 },
    { path: 'vehicle.area', label: 'Área frontal', type: 'range', min: 0.5, max: 4, step: 0.05, unit: 'm²' },
  ]},
];

const get = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
const set = (o, path, v) => { const ks = path.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

export class Builder {
  constructor(tabsEl, bodyEl, getCfg, onChange) {
    this.tabsEl = tabsEl; this.bodyEl = bodyEl; this.getCfg = getCfg; this.onChange = onChange;
    this.tab = SCHEMA[1].tab;
    this.renderTabs();
    this.render();
  }

  renderTabs() {
    this.tabsEl.innerHTML = '';
    for (const s of SCHEMA) {
      const b = document.createElement('button');
      b.textContent = s.tab; b.className = 'tab' + (s.tab === this.tab ? ' active' : '');
      b.onclick = () => { this.tab = s.tab; this.renderTabs(); this.render(); };
      this.tabsEl.appendChild(b);
    }
  }

  changed(rerender) {
    normalizeConfig(this.getCfg());
    this.onChange();
    if (rerender) this.render();
  }

  render() {
    const cfg = this.getCfg();
    const section = SCHEMA.find((s) => s.tab === this.tab);
    this.bodyEl.innerHTML = '';
    for (const it of section.items) {
      if (it.show && !it.show(cfg)) continue;
      if (it.type === 'note') { const p = document.createElement('p'); p.className = 'note'; p.textContent = it.label; this.bodyEl.appendChild(p); continue; }
      if (it.type === 'gears') { this.renderGears(cfg); continue; }
      if (it.type === 'catalog') { this.renderCatalog?.(this.bodyEl, cfg); continue; }
      const row = document.createElement('div'); row.className = 'row';
      const label = document.createElement('label'); label.textContent = it.label;
      row.appendChild(label);
      const value = it.virtual ? cfg.transmission.gears.length : get(cfg, it.path);
      if (it.type === 'select') {
        const sel = document.createElement('select');
        const options = typeof it.options === 'function' ? it.options(cfg) : it.options;
        for (const [k, name] of options) { const o = document.createElement('option'); o.value = k; o.textContent = name; sel.appendChild(o); }
        sel.value = String(value);
        sel.onchange = () => { set(cfg, it.path, it.num ? Number(sel.value) : sel.value); this.changed(true); };
        row.appendChild(sel);
      } else if (it.type === 'check') {
        row.classList.add('check');
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!value;
        cb.onchange = () => { set(cfg, it.path, cb.checked); this.changed(true); };
        row.prepend(cb);
      } else if (it.type === 'range') {
        const wrap = document.createElement('div'); wrap.className = 'range';
        const r = document.createElement('input'); r.type = 'range'; r.min = it.min; r.max = it.max; r.step = it.step; r.value = value;
        const num = document.createElement('input'); num.type = 'number'; num.min = it.min; num.max = it.max; num.step = it.step; num.value = value;
        const unit = document.createElement('span'); unit.className = 'unit'; unit.textContent = it.unit || '';
        const apply = (v) => {
          v = Number(v); if (!Number.isFinite(v)) return;
          if (it.virtual) { this.setGearCount(cfg, Math.round(v)); this.changed(true); return; }
          set(cfg, it.path, v); r.value = v; num.value = v; this.changed(false);
        };
        r.oninput = () => apply(r.value);
        num.onchange = () => apply(num.value);
        wrap.append(r, num, unit); row.appendChild(wrap);
      }
      if (it.hint) { const h = document.createElement('small'); h.textContent = it.hint; row.appendChild(h); }
      this.bodyEl.appendChild(row);
    }
  }

  setGearCount(cfg, n) {
    const g = cfg.transmission.gears;
    if (n === g.length) return;
    cfg.transmission.gears = makeGears(n, g[0], g[g.length - 1] ?? 0.8);
  }

  renderGears(cfg) {
    const box = document.createElement('div'); box.className = 'gears';
    cfg.transmission.gears.forEach((ratio, i) => {
      const row = document.createElement('div'); row.className = 'gear-row';
      const l = document.createElement('span'); l.textContent = `${i + 1}ª`;
      const r = document.createElement('input'); r.type = 'range'; r.min = 0.4; r.max = 5.5; r.step = 0.01; r.value = ratio;
      const n = document.createElement('input'); n.type = 'number'; n.min = 0.4; n.max = 5.5; n.step = 0.01; n.value = ratio;
      const apply = (v) => { v = Number(v); if (!Number.isFinite(v)) return; cfg.transmission.gears[i] = v; r.value = v; n.value = v; this.changed(false); };
      r.oninput = () => apply(r.value); n.onchange = () => apply(n.value);
      row.append(l, r, n); box.appendChild(row);
    });
    this.bodyEl.appendChild(box);
  }
}
