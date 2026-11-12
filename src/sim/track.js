// Estrada à beira-mar: começa com uma reta plana (arrancada de 400 m) e depois vira morros.
export class Track {
  constructor() {
    this.flatEnd = 700;
  }
  height(x) {
    if (x < this.flatEnd) return 0;
    const t = x - this.flatEnd;
    const ramp = Math.min(1, t / 250);
    return ramp * (6 * Math.sin(t / 90) + 3 * Math.sin(t / 37 + 1.3) - 3 * Math.sin(1.3) * Math.cos(t / 400)
      + 16 * Math.sin(t / 420) + 3 * Math.sin(1.3));
  }
  slope(x) {
    const h = 0.5;
    return Math.atan2(this.height(x + h) - this.height(x - h), 2 * h);
  }
}
