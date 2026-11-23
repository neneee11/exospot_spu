/**
 * One Euro Filter – ลดอาการสั่นของค่าที่วัดได้ โดยหน่วงน้อยตอนเคลื่อนไหวเร็ว
 * อ้างอิง: Casiez et al., CHI 2012
 */
export class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(
    private minCutoff = 1.0,
    private beta = 0.01,
    private dCutoff = 1.0,
  ) {}

  private alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  /** @param tMs เวลาเป็นมิลลิวินาที */
  filter(x: number, tMs: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.tPrev = tMs;
      return x;
    }
    const dt = Math.max((tMs - this.tPrev) / 1000, 1e-3);
    const dx = (x - this.xPrev) / dt;
    const dxHat = this.dxPrev + this.alpha(this.dCutoff, dt) * (dx - this.dxPrev);
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const xHat = this.xPrev + this.alpha(cutoff, dt) * (x - this.xPrev);
    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = tMs;
    return xHat;
  }

  reset() {
    this.xPrev = null;
    this.tPrev = null;
    this.dxPrev = 0;
  }
}

/** ยืนยันค่าใหม่ก็ต่อเมื่อเกิดซ้ำติดกันครบ N ครั้ง */
export class Debouncer<T> {
  private committed: T;
  private candidate: T;
  private count = 0;

  constructor(
    initial: T,
    private frames: number,
  ) {
    this.committed = initial;
    this.candidate = initial;
  }

  push(value: T, frames = this.frames): T {
    if (value === this.candidate) this.count++;
    else {
      this.candidate = value;
      this.count = 1;
    }
    if (this.candidate !== this.committed && this.count >= frames) {
      this.committed = this.candidate;
    }
    return this.committed;
  }

  get value() {
    return this.committed;
  }

  setFrames(frames: number) {
    this.frames = frames;
  }

  reset(value: T) {
    this.committed = value;
    this.candidate = value;
    this.count = 0;
  }
}
