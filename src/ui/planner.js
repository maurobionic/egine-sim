// Etapa 1 – Planejamento: você define objetivo, combustível, alimentação, arquitetura etc.
// e o planejador gera um projeto base coerente (diâmetro/curso, comando, taxa, câmbio…).
import { PLAN_DEFAULT, GOAL_NAMES, BODY_NAMES } from '../engine/config.js';
import { FUELS } from '../engine/fuels.js';

const FIELDS = [
  { key: 'goal', label: 'Objetivo do projeto', options: Object.entries(GOAL_NAMES) },
  { key: 'body', label: 'Carroceria', options: Object.entries(BODY_NAMES) },
  { key: 'fuel', label: 'Combustível', options: Object.entries(FUELS).map(([k, v]) => [k, v.name]) },
  { key: 'fuelSystem', label: 'Alimentação de combustível', options: [['injection', 'Injeção eletrônica'], ['carb', 'Carburador + distribuidor']] },
  { key: 'aspiration', label: 'Aspiração', options: [['na', 'Aspirado'], ['turbo', 'Turbo'], ['twinturbo', 'Biturbo'], ['supercharger', 'Supercharger']] },
  { key: 'nitro', label: 'Nitro', options: [[false, 'Sem nitro'], [true, 'Com nitro']] },
  { key: 'layout', label: 'Arquitetura', options: [['inline', 'Em linha'], ['v', 'Em V'], ['boxer', 'Boxer']] },
  { key: 'cylinders', label: 'Cilindros', options: [1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => [n, String(n)]) },
  { key: 'displacement', label: 'Cilindrada', range: [0.1, 10, 0.1], unit: 'L' },
  { key: 'powertrain', label: 'Trem de força', options: [['ice', 'Só combustão'], ['hybrid', 'Híbrido']] },
  { key: 'drive', label: 'Tração', options: [['fwd', 'Dianteira'], ['rwd', 'Traseira'], ['awd', 'Integral']] },
  { key: 'gearbox', label: 'Câmbio', options: [['manual', 'Manual'], ['auto', 'Automático']] },
];

export class Planner {
  constructor(el, onPreview, onApply) {
    this.el = el; this.plan = { ...PLAN_DEFAULT };
    this.onPreview = onPreview; this.onApply = onApply;
    this.render();
  }

  render() {
    this.el.innerHTML = '<p class="lead">Defina o que você quer construir. O planejador calcula um projeto base, e depois você troca cada peça na etapa <b>Montar</b>.</p>';
    for (const f of FIELDS) {
      const row = document.createElement('div'); row.className = 'row';
      const l = document.createElement('label'); l.textContent = f.label; row.appendChild(l);
      if (f.options) {
        const s = document.createElement('select');
        for (const [k, name] of f.options) { const o = document.createElement('option'); o.value = String(k); o.textContent = name; s.appendChild(o); }
        s.value = String(this.plan[f.key]);
        s.onchange = () => {
          const raw = s.value;
          this.plan[f.key] = raw === 'true' ? true : raw === 'false' ? false : /^\d+$/.test(raw) ? Number(raw) : raw;
          this.onPreview(this.plan);
        };
        row.appendChild(s);
      } else {
        const wrap = document.createElement('div'); wrap.className = 'range';
        const r = document.createElement('input'); r.type = 'range'; [r.min, r.max, r.step] = f.range; r.value = this.plan[f.key];
        const n = document.createElement('input'); n.type = 'number'; [n.min, n.max, n.step] = f.range; n.value = this.plan[f.key];
        const u = document.createElement('span'); u.className = 'unit'; u.textContent = f.unit;
        const apply = (v) => { v = Number(v); if (!Number.isFinite(v)) return; this.plan[f.key] = v; r.value = v; n.value = v; this.onPreview(this.plan); };
        r.oninput = () => apply(r.value); n.onchange = () => apply(n.value);
        wrap.append(r, n, u); row.appendChild(wrap);
      }
      this.el.appendChild(row);
    }
    const btn = document.createElement('button');
    btn.className = 'primary'; btn.textContent = 'Gerar projeto e ir para a montagem →';
    btn.onclick = () => this.onApply(this.plan);
    this.el.appendChild(btn);
  }
}
