import { DEFAULT_THRESHOLDS } from "../config/thresholds";
import type { ExercisePlan, ProfileSettings } from "./types";

/** โปรแกรมเริ่มต้น ก่อนนักกายภาพปรับ */
export const DEFAULT_PLAN: ExercisePlan = {
  exercise: "sit_to_stand",
  targetReps: 10,
  sets: 2,
  perDay: 2,
  thresholds: DEFAULT_THRESHOLDS,
  approvedBy: null,
};

export const DEFAULT_SETTINGS: ProfileSettings = {
  voice: true,
  persona: "warm",
  voiceCommands: false,
  autoNotify: true,
};

export const newLinkCode = () => String(Math.floor(100000 + Math.random() * 900000));
