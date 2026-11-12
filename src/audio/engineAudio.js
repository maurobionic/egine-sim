// Controla o AudioWorklet: traduz as peças escolhidas + telemetria ao vivo em parâmetros de som.

const MUFFLER = {
  stock:    { cut: 380,  gain: 0.45, fb: 0.30 },
  sport:    { cut: 750,  gain: 0.65, fb: 0.42 },
  straight: { cut: 1500, gain: 0.85, fb: 0.55 },
  none:     { cut: 3200, gain: 1.0,  fb: 0.62 },
};
const FILTER_GAIN = { paper: 0.18, performance: 0.3, cone: 0.5, none: 0.65 };

export class EngineAudio {
  constructor() {
    this.ctx = null; this.node = null; this.gain = null;
    this.muted = false; this.volume = 0.7; this.ready = false;
  }

  async start() {
    if (this.ready) { await this.ctx.resume(); return; }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    await this.ctx.audioWorklet.addModule(new URL('./engine-worklet.js', import.meta.url));
    this.node = new AudioWorkletNode(this.ctx, 'engine-sound', { outputChannelCount: [2] });
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.muted ? 0 : this.volume;
    this.node.connect(this.gain).connect(this.ctx.destination);
    this.ready = true;
  }

  setVolume(v) { this.volume = v; if (this.gain && !this.muted) this.gain.gain.value = v; }
  toggleMute() {
    this.muted = !this.muted;
    if (this.gain) this.gain.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  // parâmetros "estáticos" que vêm das peças
  configure(cfg, engine) {
    if (!this.ready) return;
    const ex = cfg.exhaust;
    const m = MUFFLER[ex.muffler];
    let cut = m.cut, gain = m.gain, fb = m.fb;
    if (ex.cat) { cut *= 0.85; gain *= 0.9; }
    if (ex.resonator) gain *= 0.92;
    const ind = cfg.intake.induction;
    if (ind === 'turbo' || ind === 'twinturbo') { cut *= 0.8; gain *= 0.8; fb *= 0.85; } // a turbina abafa
    if (ex.headers === 'longtube') fb *= 1.1;
    const d = ex.diameter;
    this.static = {
      pattern: engine.pattern,
      diesel: engine.isDiesel,
      mufflerCut: cut, mufflerGain: gain * (0.6 + 0.4 * Math.sqrt(d / 55)), combFb: Math.min(0.75, fb),
      pipeLength: ex.length, bodyFreq: 190 * (55 / d), bodyGain: 3 + (d - 55) / 8,
      resonator: ex.resonator, dual: ex.layout === 'dual',
      intakeGain: FILTER_GAIN[cfg.intake.filter] * (cfg.intake.throttle === 'itb' ? 1.6 : 1),
      mech: { ohv: 0.35, sohc: 0.3, dohc: 0.2, camless: 0.45 }[cfg.valvetrain.type] + (engine.isDiesel ? 0.2 : 0),
      turboOn: ind === 'turbo' || ind === 'twinturbo',
      sc: ind === 'supercharger',
      popChance: { stock: 0.0, sport: 0.08, straight: 0.25, none: 0.4 }[ex.muffler] * (ex.cat ? 0.3 : 1),
    };
  }

  // parâmetros ao vivo (chamado a cada quadro)
  update(t) {
    if (!this.ready || !this.static) return;
    const load = Math.max(0, Math.min(1.3, (t.imep || 0) / 13e5));
    this.node.port.postMessage({
      type: 'params',
      params: {
        ...this.static,
        rpm: t.rpm, load, throttle: t.throttle, on: t.engineOn, cut: t.cut || t.decelCut,
        turbo: t.spool || 0, turboRpm: t.turboRpm || 0, vtec: t.vtecOn, misfire: t.misfire || 0, knock: t.knock || 0,
        motorRpm: t.motorRpm || 0, motorLoad: Math.abs(t.motorPower || 0) / 20000,
        volume: 1.1,
      },
    });
    if (t.bovEvent) this.node.port.postMessage({ type: 'bov', kind: t.bovEvent.type, strength: t.bovEvent.strength });
  }
}
