import type { AlertCounts, FrameResult, RepEvent, SessionSummary } from "./types";

const emptyAlerts = (): AlertCounts => ({ valgus: 0, tooFast: 0, asymmetry: 0, overFlex: 0 });

/** รวมผลทุกเฟรมระหว่างฝึก → สรุปผลหนึ่ง session */
export class SessionRecorder {
  private startMs = 0;
  private startedAt = new Date();
  private reps: RepEvent[] = [];
  private alerts = emptyAlerts();

  constructor(
    private exercise: string,
    private targetReps: number,
  ) {}

  start(tMs: number) {
    this.startMs = tMs;
    this.startedAt = new Date();
    this.reps = [];
    this.alerts = emptyAlerts();
  }

  onFrame(f: FrameResult) {
    // นับการเตือน 1 ครั้งทุกครั้งที่สถานะเปลี่ยนเข้า เหลือง/แดง
    if (f.stateChanged && (f.state === "Y" || f.state === "R") && f.primaryIssue) {
      this.alerts[f.primaryIssue]++;
    }
    if (f.completedRep) this.reps.push(f.completedRep);
  }

  finish(tMs: number): SessionSummary {
    const completed = this.reps.length;
    const correct = this.reps.filter((r) => r.worstState === "G").length;
    const totalRepSec = this.reps.reduce((s, r) => s + r.durationSec, 0);
    return {
      exercise: this.exercise,
      startedAt: this.startedAt.toISOString(),
      durationSec: Math.round((tMs - this.startMs) / 1000),
      targetReps: this.targetReps,
      completedReps: completed,
      correctReps: correct,
      correctPercent: completed ? Math.round((correct / completed) * 100) : 0,
      alerts: { ...this.alerts },
      avgRepSec: completed ? Math.round((totalRepSec / completed) * 10) / 10 : 0,
      romMin: completed ? Math.min(...this.reps.map((r) => r.minKneeAngle)) : null,
      romMax: completed ? Math.max(...this.reps.map((r) => r.maxKneeAngle)) : null,
      reps: [...this.reps],
    };
  }
}
