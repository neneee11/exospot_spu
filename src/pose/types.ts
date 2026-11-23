import type { Landmark, NormalizedLandmark } from "@mediapipe/tasks-vision";

/** G = ท่าถูก, Y = เริ่มเสี่ยง, R = อันตราย, O = ไม่ประเมิน (มองไม่เห็น/ไม่มีคน) */
export type SafetyState = "G" | "Y" | "R" | "O";

export type IssueKey = "valgus" | "tooFast" | "asymmetry" | "overFlex";

export type Phase = "UNKNOWN" | "SITTING" | "STANDING";

export interface PoseFrame {
  /** พิกัดบนภาพ (0–1) ใช้วาดและเช็ก visibility */
  image?: NormalizedLandmark[];
  /** พิกัด 3 มิติหน่วยเมตร ใช้คำนวณมุม */
  world?: Landmark[];
}

export interface Issue {
  key: IssueKey;
  level: "Y" | "R";
}

export interface RepEvent {
  rep: number;
  durationSec: number;
  minKneeAngle: number;
  maxKneeAngle: number;
  worstState: SafetyState;
  issues: IssueKey[];
}

/** ผลลัพธ์ของ Analyzer ในแต่ละเฟรม (real-time ไม่บันทึก) */
export interface FrameResult {
  visible: boolean;
  /** สถานะหลัง debounce (ใช้แสดงผลและส่ง ESP32) */
  state: SafetyState;
  /** สถานะก่อน debounce */
  rawState: SafetyState;
  stateChanged: boolean;
  issues: Issue[];
  /** ปัญหาที่รุนแรงที่สุดตอนนี้ */
  primaryIssue: IssueKey | null;
  kneeAngle: { left: number; right: number; avg: number } | null;
  valgusRatio: number | null;
  /** °/วินาที (ติดลบ = กำลังนั่งลง) */
  velocity: number | null;
  asymmetry: number | null;
  phase: Phase;
  repCount: number;
  /** มีค่าเฉพาะเฟรมที่นับครั้งได้ */
  completedRep: RepEvent | null;
}

export type AlertCounts = Record<IssueKey, number>;

/** สรุปผลหนึ่ง session (ส่งต่อให้ Application บันทึก) */
export interface SessionSummary {
  exercise: string;
  startedAt: string;
  durationSec: number;
  targetReps: number;
  completedReps: number;
  correctReps: number;
  correctPercent: number;
  alerts: AlertCounts;
  avgRepSec: number;
  romMin: number | null;
  romMax: number | null;
  reps: RepEvent[];
}
