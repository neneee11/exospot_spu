import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_THRESHOLDS } from "../config/thresholds";
import type { RepEvent } from "../pose/types";
import type { PersonaId } from "../coach/personas";
import { DEFAULT_PLAN, DEFAULT_SETTINGS, newLinkCode } from "./defaults";
import type {
  CoachFacts,
  CoachLineKind,
  ExercisePlan,
  NewSession,
  Profile,
  ProfileInput,
  Repository,
  SessionRecord,
} from "./types";

/* ---------- แปลงชื่อคอลัมน์ snake_case (DB) ↔ camelCase (แอป) ---------- */

type Row = Record<string, unknown>;

function supabaseError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; code?: unknown; details?: unknown };
    const parts = [value.message, value.details, value.code].filter(
      (part): part is string => typeof part === "string" && part.length > 0,
    );
    if (parts.length) return new Error([...new Set(parts)].join(": "));
  }
  return new Error(fallback);
}

const profileFromRow = (r: Row): Profile => ({
  id: r.id as string,
  nickname: r.nickname as string,
  fullName: r.full_name as string,
  age: r.age as number,
  sex: r.sex as Profile["sex"],
  heightCm: Number(r.height_cm),
  weightKg: Number(r.weight_kg),
  affectedSide: r.affected_side as Profile["affectedSide"],
  group: r.patient_group as Profile["group"],
  surgeryDate: (r.surgery_date as string) ?? null,
  comorbidities: (r.comorbidities as string[]) ?? [],
  walkingAid: r.walking_aid as Profile["walkingAid"],
  baselinePain: r.baseline_pain as number,
  consentAt: r.consent_at as string,
  lineLinkCode: r.line_link_code as string,
  caregiverLinked: !!r.caregiver_line_user_id,
  settings: { ...DEFAULT_SETTINGS, ...(r.settings as Partial<Profile["settings"]>) },
});

const sessionFromRow = (r: Row): SessionRecord => ({
  id: r.id as string,
  exercise: r.exercise as string,
  startedAt: r.started_at as string,
  durationSec: r.duration_sec as number,
  targetReps: r.target_reps as number,
  completedReps: r.completed_reps as number,
  correctReps: r.correct_reps as number,
  correctPercent: r.correct_percent as number,
  alerts: r.alerts as SessionRecord["alerts"],
  avgRepSec: Number(r.avg_rep_sec),
  romMin: (r.rom_min as number) ?? null,
  romMax: (r.rom_max as number) ?? null,
  painBefore: (r.pain_before as number) ?? null,
  painAfter: (r.pain_after as number) ?? null,
  feeling: (r.feeling as SessionRecord["feeling"]) ?? null,
});

/**
 * เก็บข้อมูลใน Supabase (PostgreSQL)
 * ใช้ Anonymous Sign-in: ผู้ใช้ไม่ต้องสมัคร แต่ข้อมูลแยกตามเครื่องด้วย Row Level Security
 */
export class SupabaseRepository implements Repository {
  readonly mode = "supabase" as const;
  private db: SupabaseClient;
  private userId = "";

  constructor(url: string, anonKey: string) {
    this.db = createClient(url, anonKey);
  }

  async init() {
    const { data } = await this.db.auth.getSession();
    if (data.session) {
      this.userId = data.session.user.id;
      return;
    }
    const { data: signIn, error } = await this.db.auth.signInAnonymously();
    if (error || !signIn.user) throw new Error(`เข้าสู่ระบบไม่สำเร็จ: ${error?.message}`);
    this.userId = signIn.user.id;
  }

  async getProfile() {
    const { data, error } = await this.db.from("profiles").select("*").eq("id", this.userId).maybeSingle();
    if (error) throw supabaseError(error, "ไม่สามารถอ่านข้อมูลโปรไฟล์");
    return data ? profileFromRow(data) : null;
  }

  async saveProfile(p: ProfileInput) {
    const existing = await this.getProfile();
    const { data, error } = await this.db
      .from("profiles")
      .upsert({
        id: this.userId,
        nickname: p.nickname,
        full_name: p.fullName,
        age: p.age,
        sex: p.sex,
        height_cm: p.heightCm,
        weight_kg: p.weightKg,
        affected_side: p.affectedSide,
        patient_group: p.group,
        surgery_date: p.surgeryDate,
        comorbidities: p.comorbidities,
        walking_aid: p.walkingAid,
        baseline_pain: p.baselinePain,
        consent_at: p.consentAt,
        line_link_code: existing?.lineLinkCode ?? newLinkCode(),
        settings: p.settings,
      })
      .select()
      .single();
    if (error) throw supabaseError(error, "ไม่สามารถบันทึกข้อมูลโปรไฟล์");
    return profileFromRow(data);
  }

  async getPlan(): Promise<ExercisePlan> {
    const { data, error } = await this.db
      .from("exercise_plans")
      .select("*")
      .eq("user_id", this.userId)
      .eq("exercise", DEFAULT_PLAN.exercise)
      .maybeSingle();
    if (error) throw supabaseError(error, "ไม่สามารถอ่านโปรแกรมฝึก");
    if (!data) return DEFAULT_PLAN;
    return {
      exercise: data.exercise,
      targetReps: data.target_reps,
      sets: data.sets,
      perDay: data.per_day,
      thresholds: { ...DEFAULT_THRESHOLDS, ...data.thresholds },
      approvedBy: data.approved_by,
    };
  }

  async savePlan(plan: ExercisePlan) {
    const { error } = await this.db.from("exercise_plans").upsert(
      {
        user_id: this.userId,
        exercise: plan.exercise,
        target_reps: plan.targetReps,
        sets: plan.sets,
        per_day: plan.perDay,
        thresholds: plan.thresholds,
        approved_by: plan.approvedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,exercise" },
    );
    if (error) throw supabaseError(error, "ไม่สามารถบันทึกโปรแกรมฝึก");
    return plan;
  }

  async listSessions(sinceIso: string) {
    const { data, error } = await this.db
      .from("sessions")
      .select("*")
      .eq("user_id", this.userId)
      .gte("started_at", sinceIso)
      .order("started_at", { ascending: false });
    if (error) throw supabaseError(error, "ไม่สามารถอ่านประวัติการฝึก");
    return (data ?? []).map(sessionFromRow);
  }

  async getReps(sessionId: string): Promise<RepEvent[]> {
    const { data, error } = await this.db
      .from("rep_events")
      .select("*")
      .eq("session_id", sessionId)
      .order("rep");
    if (error) throw supabaseError(error, "ไม่สามารถอ่านข้อมูลรายครั้ง");
    return (data ?? []).map((r) => ({
      rep: r.rep,
      durationSec: Number(r.duration_sec),
      minKneeAngle: r.min_angle,
      maxKneeAngle: r.max_angle,
      worstState: r.worst_state,
      issues: r.issues ?? [],
    }));
  }

  async saveSession({ reps, ...s }: NewSession) {
    const { data, error } = await this.db
      .from("sessions")
      .insert({
        user_id: this.userId,
        exercise: s.exercise,
        started_at: s.startedAt,
        duration_sec: s.durationSec,
        target_reps: s.targetReps,
        completed_reps: s.completedReps,
        correct_reps: s.correctReps,
        correct_percent: s.correctPercent,
        alerts: s.alerts,
        avg_rep_sec: s.avgRepSec,
        rom_min: s.romMin,
        rom_max: s.romMax,
        pain_before: s.painBefore,
        pain_after: s.painAfter,
        feeling: s.feeling,
      })
      .select()
      .single();
    if (error) throw supabaseError(error, "ไม่สามารถบันทึกผลการฝึก");

    if (reps.length) {
      const { error: repErr } = await this.db.from("rep_events").insert(
        reps.map((r) => ({
          session_id: data.id,
          user_id: this.userId,
          rep: r.rep,
          duration_sec: r.durationSec,
          min_angle: r.minKneeAngle,
          max_angle: r.maxKneeAngle,
          worst_state: r.worstState,
          issues: r.issues,
        })),
      );
      if (repErr) throw supabaseError(repErr, "ไม่สามารถบันทึกข้อมูลรายครั้ง");
    }
    return sessionFromRow(data);
  }

  async notifyCaregiver(sessionId: string) {
    const { data, error } = await this.db.functions.invoke<{ ok: boolean; message: string }>("notify-line", {
      body: { sessionId },
    });
    if (error || !data) return { ok: false, message: "ส่ง LINE ไม่สำเร็จ ลองใหม่อีกครั้ง" };
    return data;
  }

  async coachLine(kind: CoachLineKind, persona: PersonaId, facts: CoachFacts) {
    // LLM ต้องตอบภายใน 4 วินาที ไม่อย่างนั้นใช้ประโยคสำเร็จรูป (ผู้สูงอายุไม่ต้องรอ)
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), 4000));
    const call = this.db.functions
      .invoke<{ text: string }>("coach-llm", { body: { kind, persona, facts } })
      .then(({ data, error }) => (error || !data?.text ? null : data.text))
      .catch(() => null);
    return Promise.race([call, timeout]);
  }
}
