// Síntese do som do motor em tempo real (AudioWorklet).
//
// Ideia: cada explosão gera um pulso de pressão no escape. Os pulsos seguem a ordem de ignição
// real (ângulo de cada cilindro no ciclo de 720°), então um V8 cruzado "borbulha", um 4 cilindros
// "zune", um V-twin faz "batata". Depois o pulso passa pelo "escape virtual":
//   - tubo (linha de atraso com realimentação = ressonância do comprimento do tubo)
//   - ressonância do diâmetro (filtro de pico)
//   - abafador (passa-baixa) / ressonador (corta o "drone")
// Somamos ronco da admissão, assobio da turbina, válvula de alívio, chiado do supercharger,
// motor elétrico, batida de válvulas e o "tec-tec" do diesel.

const TWO_PI = Math.PI * 2;

class Biquad {
  constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.z1 = 0; this.z2 = 0; }
  set(type, f, q, gainDb, sr) {
    f = Math.min(Math.max(f, 10), sr * 0.45);
    const w = TWO_PI * f / sr, cs = Math.cos(w), sn = Math.sin(w), alpha = sn / (2 * q);
    const A = Math.pow(10, (gainDb || 0) / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; }
    else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; }
    else if (type === 'bp') { b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; }
    else { b0 = 1 + alpha * A; b1 = -2 * cs; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cs; a2 = 1 - alpha / A; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  process(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

class ExhaustChain {
  constructor() {
    this.buf = new Float32Array(8192); this.idx = 0; this.damp = 0;
    this.hp = new Biquad(); this.body = new Biquad(); this.lp1 = new Biquad(); this.lp2 = new Biquad(); this.res = new Biquad();
  }
  configure(p, sr, bright) {
    this.delay = Math.max(8, Math.min(8000, Math.round(2 * p.pipeLength / 340 * sr)));
    this.fb = p.combFb;
    this.hp.set('hp', 28, 0.7, 0, sr);
    this.body.set('peak', p.bodyFreq, 1.2, p.bodyGain, sr);
    const cut = p.mufflerCut * bright;
    this.lp1.set('lp', cut, 0.7, 0, sr);
    this.lp2.set('lp', cut * 1.6, 0.6, 0, sr);
    this.res.set('peak', 110, 1.4, p.resonator ? -9 : 0, sr);
  }
  process(x) {
    const read = this.buf[(this.idx - this.delay + 8192) & 8191];
    this.damp += 0.45 * (read - this.damp);
    const y = this.hp.process(x) + this.fb * this.damp;
    this.buf[this.idx] = y; this.idx = (this.idx + 1) & 8191;
    let o = this.body.process(y);
    o = this.lp1.process(o);
    o = this.lp2.process(o);
    return this.res.process(o);
  }
}

class EngineProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.p = {
      rpm: 0, load: 0, throttle: 0, on: false, cut: false, diesel: false,
      pattern: [{ angle: 0, bank: 0, delay: 0 }],
      mufflerCut: 600, mufflerGain: 0.5, combFb: 0.4, pipeLength: 3, bodyFreq: 180, bodyGain: 4,
      resonator: true, dual: false, intakeGain: 0.3, mech: 0.3,
      turbo: 0, turboOn: false, turboRpm: 0, sc: false, scRatio: 2.5,
      vtec: false, misfire: 0, knock: 0, motorRpm: 0, motorLoad: 0, volume: 0.6, popChance: 0, nitro: false,
    };
    this.rpm = 0; this.crank = 0; this.load = 0; this.thr = 0; this.turbo = 0; this.motorRpm = 0; this.motorLoad = 0;
    this.env1 = new Float32Array(16); this.env2 = new Float32Array(16); this.pending = new Int32Array(16).fill(-1); this.amp = new Float32Array(16);
    this.banks = [new ExhaustChain(), new ExhaustChain()];
    this.intakeBp = new Biquad(); this.inductLp = new Biquad(); this.mechBp = new Biquad(); this.bovBp = new Biquad(); this.clatterBp = new Biquad(); this.pingBp = new Biquad(); this.pingEnv = 0;
    this.bov = 0; this.bovType = 'bov'; this.flutterPh = 0; this.mechEnv = 0; this.clatterEnv = 0;
    this.phT = 0; this.phS = 0; this.phM = 0; this.dc = 0; this.dcR = 0;
    this.blockCount = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'params') Object.assign(this.p, d.params);
      else if (d.type === 'bov') { this.bov = 1; this.bovType = d.kind; this.bovStrength = d.strength; }
    };
    this.configure();
  }

  configure() {
    const bright = this.p.vtec ? 1.45 : 1;
    for (const b of this.banks) b.configure(this.p, sampleRate, bright);
    this.intakeBp.set('bp', 220 + this.rpm * 0.12, 1.1, 0, sampleRate);
    this.inductLp.set('lp', 260 * bright, 0.8, 0, sampleRate);
    this.mechBp.set('bp', 3200, 2, 0, sampleRate);
    this.bovBp.set('bp', this.bovType === 'bov' ? 2200 : 900, 0.8, 0, sampleRate);
    this.clatterBp.set('bp', 2600, 1.5, 0, sampleRate);
    this.pingBp.set('bp', 6300, 8, 0, sampleRate);
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const L = out[0], R = out[1] || out[0];
    const p = this.p, sr = sampleRate;
    if ((this.blockCount++ & 3) === 0) this.configure();
    const pat = p.pattern, n = Math.min(pat.length, 16);
    const kS = 1 - Math.exp(-1 / (0.012 * sr));
    const targetRpm = p.rpm;
    const tau1 = Math.min(0.0035, Math.max(0.0008, 0.0035 * Math.sqrt(1000 / Math.max(this.rpm, 600)))) * (p.diesel ? 0.75 : 1);
    const d1 = Math.exp(-1 / (tau1 * sr)), d2 = Math.exp(-1 / ((p.diesel ? 0.00012 : 0.00025) * sr));
    const bovDecay = Math.exp(-1 / ((this.bovType === 'bov' ? 0.32 : 0.5) * sr));
    const mechDecay = Math.exp(-1 / (0.0009 * sr));

    for (let i = 0; i < L.length; i++) {
      this.rpm += (targetRpm - this.rpm) * kS;
      this.load += (p.load - this.load) * kS;
      this.thr += (p.throttle - this.thr) * kS;
      this.turbo += (p.turbo - this.turbo) * kS * 0.3;
      this.motorRpm += (p.motorRpm - this.motorRpm) * kS;
      this.motorLoad += (p.motorLoad - this.motorLoad) * kS;

      const prev = this.crank;
      let cur = prev + this.rpm / 60 * 360 / sr; // graus de virabrequim por amostra (ciclo 4T = 720°)
      let wrapped = false;
      if (cur >= 720) { cur -= 720; wrapped = true; }
      this.crank = cur;

      let exA = 0, exB = 0;
      for (let c = 0; c < n; c++) {
        const a = pat[c].angle % 720;
        const hit = wrapped ? (a >= prev || a < cur) : (a >= prev && a < cur);
        if (hit && this.rpm > 40) {
          this.pending[c] = Math.round(pat[c].delay * sr);
          // amplitude: explosão com carga; com corte só "sopra"; às vezes estoura (pipoco)
          let amp;
          if (p.on && !p.cut && Math.random() >= p.misfire) {
            amp = (0.25 + 0.75 * this.load) * (0.88 + 0.24 * Math.random());
            if (p.knock > 0 && Math.random() < p.knock + 0.2) this.pingEnv = 0.25 + 0.5 * p.knock;
          }
          else if (p.on && p.cut && Math.random() < p.popChance) amp = 1.6 + Math.random();
          else amp = 0.08;
          this.amp[c] = amp;
          if (p.diesel && p.on) this.clatterEnv = 0.6 + 0.4 * this.load;
          this.mechEnv = 1;
        }
        if (this.pending[c] >= 0) {
          if (this.pending[c] === 0) { this.env1[c] = this.amp[c]; this.env2[c] = this.amp[c]; }
          this.pending[c]--;
        }
        const e1 = this.env1[c], e2 = this.env2[c];
        if (e1 > 1e-5) {
          const pulse = (e1 - e2) * (1 + 0.5 * (Math.random() * 2 - 1));
          if (pat[c].bank && p.dual) exB += pulse; else exA += pulse;
          this.env1[c] = e1 * d1; this.env2[c] = e2 * d2;
        }
      }

      let sigA = this.banks[0].process(exA), sigB = p.dual ? this.banks[1].process(exB) : 0;
      sigA *= p.mufflerGain; sigB *= p.mufflerGain;

      // admissão (ronco + chiado do filtro)
      const noise = Math.random() * 2 - 1;
      const induct = this.inductLp.process(exA + exB) * p.intakeGain * this.thr * 1.6;
      const hiss = this.intakeBp.process(noise) * p.intakeGain * this.thr * (0.15 + this.rpm / 9000) * 0.5;
      // batida de válvulas / mecânica
      this.mechEnv *= mechDecay;
      const mech = this.mechBp.process(noise) * this.mechEnv * p.mech * 0.25 * (p.on || this.rpm > 50 ? 1 : 0);
      // diesel: "tec-tec" da combustão por compressão
      this.clatterEnv *= mechDecay;
      const clatter = p.diesel ? this.clatterBp.process(noise) * this.clatterEnv * 0.9 : 0;
      // detonação: "grilo" metálico
      this.pingEnv *= mechDecay;
      const ping = this.pingBp.process(noise) * this.pingEnv * 3;

      // turbina: assobio + válvula de alívio
      let turbo = 0;
      if (p.turboOn) {
        const f = 1200 + p.turboRpm / 60 * 0.9;
        this.phT += f / sr; if (this.phT > 1) this.phT -= 1;
        turbo = Math.sin(TWO_PI * this.phT) * 0.05 * this.turbo * this.turbo * (0.3 + 0.7 * this.thr);
      }
      if (this.bov > 1e-4) {
        let b = this.bovBp.process(noise) * this.bov * 0.5 * (this.bovStrength || 1);
        if (this.bovType === 'flutter') { this.flutterPh += 16 / sr; b *= 0.5 + 0.5 * Math.sin(TWO_PI * this.flutterPh); }
        turbo += b;
        this.bov *= bovDecay;
      }
      // supercharger (chiado proporcional ao giro)
      let sc = 0;
      if (p.sc) {
        this.phS += this.rpm / 60 * p.scRatio * 6 / sr; this.phS -= Math.floor(this.phS);
        sc = (Math.sin(TWO_PI * this.phS) + 0.4 * Math.sin(2 * TWO_PI * this.phS)) * 0.03 * Math.min(1, this.rpm / 3000) * (0.4 + this.thr);
      }
      // motor elétrico
      let ev = 0;
      if (this.motorLoad > 0.001) {
        this.phM += this.motorRpm / 60 * 8 / sr; this.phM -= Math.floor(this.phM);
        ev = (Math.sin(TWO_PI * this.phM) + 0.3 * Math.sin(3 * TWO_PI * this.phM)) * 0.04 * Math.min(1, this.motorLoad);
      }

      const common = induct + hiss + mech + clatter + ping + turbo + sc + ev;
      let l, r;
      if (p.dual) { l = sigA + 0.3 * sigB; r = sigB + 0.3 * sigA; }
      else { l = sigA; r = sigA; }
      l = Math.tanh((l + common) * p.volume * 1.4);
      r = Math.tanh((r + common) * p.volume * 1.4);
      // remove DC
      this.dc += 0.0005 * (l - this.dc); this.dcR += 0.0005 * (r - this.dcR);
      L[i] = l - this.dc; R[i] = r - this.dcR;
    }
    return true;
  }
}

registerProcessor('engine-sound', EngineProcessor);
