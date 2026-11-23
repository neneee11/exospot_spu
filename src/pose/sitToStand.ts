import type { Thresholds } from "../config/thresholds";
import { Debouncer, OneEuroFilter } from "./filters";
import { LM, REQUIRED_POINTS, angleAt, valgusRatio } from "./geometry";
import type {
  FrameResult,
  Issue,
  IssueKey,
  Phase,
  PoseFrame,
  RepEvent,
  SafetyState,
} from "./types";

const TOO_FAST_HOLD_MS = 1000;

const RANK: Record<SafetyState, number> = { O: 0, G: 1, Y: 2, R: 3 };
const worse = (a: SafetyState, b: SafetyState) => (RANK[a] >= RANK[b] ? a : b);

export interface AnalyzerOptions {
  thresholds: Thresholds;
  /** true = ผู้ป่วยผ่าตัดแล้ว ใช้กฎ minKneeAngle */
  postOp: boolean;
}

/**
 * วิเคราะห์ท่า Sit-to-Stand ทีละเฟรม
 * Pipeline: Quality gate → Smoothing → Features → Rep state machine → Risk rules → Debounce
 */
export class SitToStandAnalyzer {
  private th: Thresholds;
  private postOp: boolean;

  private fLeft = new OneEuroFilter(1.0, 0.01);
  private fRight = new OneEuroFilter(1.0, 0.01);
  private fVel = new OneEuroFilter(2.0, 0.0);
  private debouncer: Debouncer<SafetyState>;

  /** การนั่งลงเร็วเกิดแค่ช่วงสั้นๆ จึง "ค้าง" คำเตือนไว้ช่วงหนึ่ง ไม่ให้ debounce กลืนหาย */
  private tooFastHold: { level: "Y" | "R"; until: number } | null = null;

  private prevAvg: number | null = null;
  private prevT: number | null = null;

  private phase: Phase = "UNKNOWN";
  private repCount = 0;
  private cycleStart: number | null = null;
  private cycleMin = 180;
  private cycleMax = 0;
  private cycleWorst: SafetyState = "G";
  private cycleIssues = new Set<IssueKey>();
  private seenStanding = false;

  constructor(opts: AnalyzerOptions) {
    this.th = opts.thresholds;
    this.postOp = opts.postOp;
    this.debouncer = new Debouncer<SafetyState>("O", this.th.debounceFrames);
  }

  reset() {
    this.fLeft.reset();
    this.fRight.reset();
    this.fVel.reset();
    this.debouncer.reset("O");
    this.prevAvg = null;
    this.prevT = null;
    this.tooFastHold = null;
    this.phase = "UNKNOWN";
    this.repCount = 0;
    this.resetCycle(null);
  }

  /** เริ่มนับต่อหลังพัก (ไม่นับเวลาพักรวมในครั้งถัดไป) */
  resumeCounting(tMs: number) {
    this.resetCycle(tMs);
    this.seenStanding = this.phase === "STANDING";
  }

  /**
   * @param frame ผลจาก MediaPipe ของเฟรมนี้
   * @param tMs เวลา (ms)
   * @param counting false = ยังไม่เริ่มฝึก (ใช้แค่เช็กกล้อง) ไม่นับครั้ง
   */
  update(frame: PoseFrame, tMs: number, counting = true): FrameResult {
    const prevState = this.debouncer.value;

    // ---------- 1) Quality gate ----------
    const visible =
      !!frame.image &&
      !!frame.world &&
      REQUIRED_POINTS.every((i) => (frame.image![i]?.visibility ?? 0) >= this.th.minVisibility);

    if (!visible) {
      const state = this.debouncer.push("O");
      return this.result({ visible: false, state, rawState: "O", prevState });
    }

    // ---------- 2) Features (คำนวณจากพิกัด 3 มิติ) ----------
    const w = frame.world!;
    const rawLeft = angleAt(w[LM.leftHip], w[LM.leftKnee], w[LM.leftAnkle]);
    const rawRight = angleAt(w[LM.rightHip], w[LM.rightKnee], w[LM.rightAnkle]);
    const left = this.fLeft.filter(rawLeft, tMs);
    const right = this.fRight.filter(rawRight, tMs);
    const avg = (left + right) / 2;

    const valgus = valgusRatio(w[LM.leftKnee], w[LM.rightKnee], w[LM.leftAnkle], w[LM.rightAnkle]);
    const asymmetry = Math.abs(left - right);

    let velocity = 0;
    if (this.prevAvg !== null && this.prevT !== null && tMs > this.prevT) {
      velocity = this.fVel.filter((avg - this.prevAvg) / ((tMs - this.prevT) / 1000), tMs);
    }
    this.prevAvg = avg;
    this.prevT = tMs;

    // ---------- 3) Risk rules ----------
    const issues = this.evaluate(avg, valgus, velocity, asymmetry, tMs);
    const rawState = issues.reduce<SafetyState>((s, i) => worse(s, i.level), "G");
    const confirmFrames =
      rawState === "R"
        ? this.th.redConfirmFrames
        : rawState === "Y"
          ? this.th.yellowConfirmFrames
          : this.th.debounceFrames;
    const state = this.debouncer.push(rawState, confirmFrames);

    // ---------- 4) Rep state machine ----------
    let completedRep: RepEvent | null = null;
    if (counting) completedRep = this.trackRep(avg, state, issues, tMs);
    else this.updatePhase(avg);

    return this.result({
      visible: true,
      state,
      rawState,
      prevState,
      issues,
      kneeAngle: { left, right, avg },
      valgusRatio: valgus,
      velocity,
      asymmetry,
      completedRep,
    });
  }

  private evaluate(avg: number, valgus: number, velocity: number, asymmetry: number, tMs: number): Issue[] {
    const th = this.th;
    const issues: Issue[] = [];
    const bent = avg < th.standAngle;

    // เข่าบิดเข้าใน: ตรวจเฉพาะตอนงอเข่า
    if (bent) {
      if (valgus < th.valgusDanger) issues.push({ key: "valgus", level: "R" });
      else if (valgus < th.valgusWarn) issues.push({ key: "valgus", level: "Y" });
    }

    // นั่งลงเร็วเกินไป: ความเร็วติดลบ = มุมเข่าลดลง
    const sitSpeed = -velocity;
    const level = sitSpeed > th.sitSpeedDanger ? "R" : sitSpeed > th.sitSpeedWarn ? "Y" : null;
    if (level && (!this.tooFastHold || tMs > this.tooFastHold.until || level === "R")) {
      this.tooFastHold = { level, until: tMs + TOO_FAST_HOLD_MS };
    }
    if (this.tooFastHold && tMs <= this.tooFastHold.until) {
      issues.push({ key: "tooFast", level: this.tooFastHold.level });
    }

    // ลงน้ำหนักขาไม่เท่ากัน: ตรวจเฉพาะตอนงอเข่า
    if (bent) {
      if (asymmetry > th.asymmetryDanger) issues.push({ key: "asymmetry", level: "R" });
      else if (asymmetry > th.asymmetryWarn) issues.push({ key: "asymmetry", level: "Y" });
    }

    // งอเข่าลึกเกินที่แพทย์อนุญาต (เฉพาะผู้ผ่าตัดแล้ว)
    if (this.postOp && th.minKneeAngle !== null) {
      if (avg < th.minKneeAngle) issues.push({ key: "overFlex", level: "R" });
      else if (avg < th.minKneeAngle + 10) issues.push({ key: "overFlex", level: "Y" });
    }

    // เรียงจากรุนแรงมากไปน้อย
    return issues.sort((a, b) => RANK[b.level] - RANK[a.level]);
  }

  /** อัปเดต phase ด้วย hysteresis (ต้องเลยเกณฑ์จริงจึงเปลี่ยน) */
  private updatePhase(avg: number): Phase {
    const prev = this.phase;
    if (avg <= this.th.sitAngle) this.phase = "SITTING";
    else if (avg >= this.th.standAngle) this.phase = "STANDING";
    return prev;
  }

  /** นับ 1 ครั้งเมื่อครบรอบ นั่ง → ยืน → นั่ง */
  private trackRep(avg: number, state: SafetyState, issues: Issue[], tMs: number): RepEvent | null {
    const prev = this.updatePhase(avg);

    if (this.cycleStart !== null) {
      this.cycleMin = Math.min(this.cycleMin, avg);
      this.cycleMax = Math.max(this.cycleMax, avg);
      this.cycleWorst = worse(this.cycleWorst, state);
      if (state === "Y" || state === "R") issues.forEach((i) => this.cycleIssues.add(i.key));
    }

    if (this.phase === "STANDING" && prev !== "STANDING") this.seenStanding = true;

    if (this.phase === "SITTING" && prev !== "SITTING") {
      let rep: RepEvent | null = null;
      if (this.cycleStart !== null && this.seenStanding) {
        // คำเตือนนั่งลงเร็วเกิดตอนท้ายครั้งพอดี อาจยังไม่ผ่าน debounce → นับรวมในครั้งนี้
        if (this.tooFastHold && tMs <= this.tooFastHold.until) {
          this.cycleWorst = worse(this.cycleWorst, this.tooFastHold.level);
          this.cycleIssues.add("tooFast");
        }
        this.repCount++;
        rep = {
          rep: this.repCount,
          durationSec: round((tMs - this.cycleStart) / 1000, 1),
          minKneeAngle: Math.round(this.cycleMin),
          maxKneeAngle: Math.round(this.cycleMax),
          worstState: this.cycleWorst,
          issues: [...this.cycleIssues],
        };
      }
      this.resetCycle(tMs);
      return rep;
    }
    return null;
  }

  private resetCycle(tMs: number | null) {
    this.cycleStart = tMs;
    this.cycleMin = 180;
    this.cycleMax = 0;
    this.cycleWorst = "G";
    this.cycleIssues = new Set();
    this.seenStanding = false;
  }

  private result(p: {
    visible: boolean;
    state: SafetyState;
    rawState: SafetyState;
    prevState: SafetyState;
    issues?: Issue[];
    kneeAngle?: FrameResult["kneeAngle"];
    valgusRatio?: number;
    velocity?: number;
    asymmetry?: number;
    completedRep?: RepEvent | null;
  }): FrameResult {
    const issues = p.issues ?? [];
    return {
      visible: p.visible,
      state: p.state,
      rawState: p.rawState,
      stateChanged: p.state !== p.prevState,
      issues,
      primaryIssue: issues[0]?.key ?? null,
      kneeAngle: p.kneeAngle ?? null,
      valgusRatio: p.valgusRatio ?? null,
      velocity: p.velocity ?? null,
      asymmetry: p.asymmetry ?? null,
      phase: this.phase,
      repCount: this.repCount,
      completedRep: p.completedRep ?? null,
    };
  }
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
