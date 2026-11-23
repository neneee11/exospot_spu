import { DEFAULT_THRESHOLDS } from "../config/thresholds";
import type { RepEvent } from "../pose/types";
import { DEFAULT_PLAN, DEFAULT_SETTINGS, newLinkCode } from "./defaults";
import type { ExercisePlan, NewSession, Profile, ProfileInput, Repository, SessionRecord } from "./types";

/**
 * เก็บข้อมูลใน localStorage ของเบราว์เซอร์
 * ใช้ตอนยังไม่ได้ตั้งค่า Supabase (ข้อมูลอยู่เครื่องเดียว ส่ง LINE ไม่ได้)
 */
const KEY = {
  profile: "exospot.profile",
  plan: "exospot.plan",
  sessions: "exospot.sessions",
  reps: (id: string) => `exospot.reps.${id}`,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage เต็มหรือถูกปิด */
  }
}

export class LocalRepository implements Repository {
  readonly mode = "local" as const;

  async init() {}

  async getProfile() {
    const p = read<Profile | null>(KEY.profile, null);
    return p && { ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } };
  }

  async saveProfile(input: ProfileInput) {
    const existing = await this.getProfile();
    const profile: Profile = {
      ...input,
      id: existing?.id ?? crypto.randomUUID(),
      lineLinkCode: existing?.lineLinkCode ?? newLinkCode(),
      caregiverLinked: false,
    };
    write(KEY.profile, profile);
    return profile;
  }

  async getPlan() {
    const plan = read<ExercisePlan>(KEY.plan, DEFAULT_PLAN);
    return { ...plan, thresholds: { ...DEFAULT_THRESHOLDS, ...plan.thresholds } };
  }

  async savePlan(plan: ExercisePlan) {
    write(KEY.plan, plan);
    return plan;
  }

  async listSessions(sinceIso: string) {
    return read<SessionRecord[]>(KEY.sessions, [])
      .filter((s) => s.startedAt >= sinceIso)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async getReps(sessionId: string) {
    return read<RepEvent[]>(KEY.reps(sessionId), []);
  }

  async saveSession({ reps, ...s }: NewSession) {
    const record: SessionRecord = { ...s, id: crypto.randomUUID() };
    write(KEY.sessions, [...read<SessionRecord[]>(KEY.sessions, []), record]);
    write(KEY.reps(record.id), reps);
    return record;
  }

  async notifyCaregiver() {
    return { ok: false, message: "โหมดบันทึกในเครื่องส่ง LINE ไม่ได้ ต้องตั้งค่า Supabase ก่อน" };
  }

  async coachLine() {
    return null; // ไม่มี LLM ในโหมดนี้ → ใช้ประโยคสำเร็จรูป
  }
}
