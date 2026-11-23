import type { AlertCounts } from "../pose/types";
import type { ExercisePlan, SessionRecord } from "./types";

/** คีย์วันที่แบบ YYYY-MM-DD ตามเวลาเครื่อง */
export const dayKey = (d: Date | string) => new Date(d).toLocaleDateString("en-CA");

export const sumAlerts = (a: AlertCounts) => a.valgus + a.tooFast + a.asymmetry + a.overFlex;

export interface TodayStats {
  sessionsDone: number;
  sessionsGoal: number;
  repsDone: number;
  repsGoal: number;
  correctPercent: number | null;
  lastPain: number | null;
}

export function todayStats(sessions: SessionRecord[], plan: ExercisePlan): TodayStats {
  const today = dayKey(new Date());
  const list = sessions.filter((s) => dayKey(s.startedAt) === today);
  const reps = list.reduce((n, s) => n + s.completedReps, 0);
  const correct = list.reduce((n, s) => n + s.correctReps, 0);
  const latest = list[0]; // เรียงใหม่ → เก่า
  return {
    sessionsDone: list.length,
    sessionsGoal: plan.perDay,
    repsDone: reps,
    repsGoal: plan.targetReps * plan.sets * plan.perDay,
    correctPercent: reps ? Math.round((correct / reps) * 100) : null,
    lastPain: latest ? (latest.painAfter ?? latest.painBefore) : null,
  };
}

const WEEKDAY = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export type Metric = "reps" | "correct" | "pain";

export interface DayPoint {
  key: string;
  label: string;
  value: number | null;
  isToday: boolean;
}

/** ค่ารายวันย้อนหลัง N วัน สำหรับกราฟแท่ง */
export function dailySeries(sessions: SessionRecord[], days: number, metric: Metric): DayPoint[] {
  const today = dayKey(new Date());
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const list = sessions.filter((s) => dayKey(s.startedAt) === key);
    out.push({
      key,
      label: days <= 7 ? WEEKDAY[d.getDay()] : String(d.getDate()),
      value: metricOf(list, metric),
      isToday: key === today,
    });
  }
  return out;
}

function metricOf(list: SessionRecord[], metric: Metric): number | null {
  if (!list.length) return null;
  const reps = list.reduce((n, s) => n + s.completedReps, 0);
  if (metric === "reps") return reps;
  if (metric === "correct") {
    const correct = list.reduce((n, s) => n + s.correctReps, 0);
    return reps ? Math.round((correct / reps) * 100) : null;
  }
  const pains = list.map((s) => s.painAfter ?? s.painBefore).filter((p): p is number => p !== null);
  return pains.length ? Math.round((pains.reduce((a, b) => a + b, 0) / pains.length) * 10) / 10 : null;
}

/** ค่าเฉลี่ยของวันที่มีข้อมูล */
export function averageOf(points: DayPoint[]): number | null {
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null);
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
}

/**
 * เปรียบเทียบจำนวนการเตือนต่อครั้งที่ทำ ระหว่างครึ่งหลังกับครึ่งแรกของช่วงเวลา
 * คืนค่าเปอร์เซ็นต์ที่เปลี่ยน (ติดลบ = ดีขึ้น)
 */
export function alertTrend(sessions: SessionRecord[], days: number): number | null {
  const cut = new Date();
  cut.setDate(cut.getDate() - Math.floor(days / 2));
  const rate = (list: SessionRecord[]) => {
    const reps = list.reduce((n, s) => n + s.completedReps, 0);
    return reps ? list.reduce((n, s) => n + sumAlerts(s.alerts), 0) / reps : null;
  };
  const recent = rate(sessions.filter((s) => new Date(s.startedAt) >= cut));
  const earlier = rate(sessions.filter((s) => new Date(s.startedAt) < cut));
  if (recent === null || earlier === null || earlier === 0) return null;
  return Math.round(((recent - earlier) / earlier) * 100);
}
