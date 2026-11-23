import type { PersonaId } from "../coach/personas";
import type { ExerciseId } from "../config/exercises";
import type { Thresholds } from "../config/thresholds";
import type { AlertCounts, RepEvent } from "../pose/types";

export type Sex = "female" | "male" | "other";
export type Side = "left" | "right" | "both";
export type PatientGroup = "pre_op" | "post_op";
export type WalkingAid = "none" | "cane" | "walker";
export type Feeling = "easy" | "ok" | "tired";

export interface ProfileSettings {
  /** โค้ชเสียงพูด */
  voice: boolean;
  /** บุคลิกของโค้ชเสียง */
  persona: PersonaId;
  /** สั่งงานด้วยเสียง (ส่งเสียงไปแปลงข้อความที่ Google จึงปิดไว้ก่อน) */
  voiceCommands: boolean;
  /** ส่งสรุปผลให้ลูกหลานทาง LINE อัตโนมัติ */
  autoNotify: boolean;
}

export interface Profile {
  id: string;
  nickname: string;
  fullName: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  affectedSide: Side;
  group: PatientGroup;
  surgeryDate: string | null;
  comorbidities: string[];
  walkingAid: WalkingAid;
  baselinePain: number;
  consentAt: string;
  /** รหัส 6 หลักให้ลูกหลานพิมพ์ใน LINE OA เพื่อเชื่อมบัญชี */
  lineLinkCode: string;
  caregiverLinked: boolean;
  settings: ProfileSettings;
}

export type ProfileInput = Omit<Profile, "id" | "lineLinkCode" | "caregiverLinked">;

export interface ExercisePlan {
  exercise: ExerciseId;
  targetReps: number;
  sets: number;
  perDay: number;
  thresholds: Thresholds;
  approvedBy: string | null;
}

export interface SessionRecord {
  id: string;
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
  painBefore: number | null;
  painAfter: number | null;
  feeling: Feeling | null;
}

export type NewSession = Omit<SessionRecord, "id"> & { reps: RepEvent[] };

/** ประโยคที่ให้ LLM แต่ง: ทักทายก่อนฝึก / สรุปผลหลังฝึก */
export type CoachLineKind = "greeting" | "summary";

/** ข้อมูลตัวเลขที่ส่งให้ LLM (ไม่มีชื่อหรือข้อมูลระบุตัวตน) */
export type CoachFacts = Record<string, string | number | boolean | null>;

export interface NotifyResult {
  ok: boolean;
  message: string;
}

/** ทุกที่ในแอปเรียกข้อมูลผ่าน interface นี้ (สลับ local / Supabase ได้) */
export interface Repository {
  readonly mode: "local" | "supabase";
  init(): Promise<void>;
  getProfile(): Promise<Profile | null>;
  saveProfile(input: ProfileInput): Promise<Profile>;
  getPlan(): Promise<ExercisePlan>;
  savePlan(plan: ExercisePlan): Promise<ExercisePlan>;
  /** session ตั้งแต่วันที่กำหนด เรียงจากใหม่ไปเก่า */
  listSessions(sinceIso: string): Promise<SessionRecord[]>;
  getReps(sessionId: string): Promise<RepEvent[]>;
  saveSession(s: NewSession): Promise<SessionRecord>;
  notifyCaregiver(sessionId: string): Promise<NotifyResult>;
  /** ให้ LLM แต่งประโยคโค้ช (null = ใช้ไม่ได้ ให้ใช้ประโยคสำเร็จรูปแทน) */
  coachLine(kind: CoachLineKind, persona: PersonaId, facts: CoachFacts): Promise<string | null>;
}
