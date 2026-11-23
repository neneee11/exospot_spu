import type { IssueKey, SafetyState } from "../pose/types";

/** ข้อความบนจอ (ประโยคเสียงพูดอยู่ใน src/coach/personas.ts) */
export const ISSUE_LABEL: Record<IssueKey, string> = {
  valgus: "เข่าบิดเข้าใน",
  tooFast: "นั่งลงเร็วเกินไป",
  asymmetry: "ลงน้ำหนักไม่เท่ากัน",
  overFlex: "งอเข่าลึกเกินที่กำหนด",
};

export const STATE_BANNER: Record<SafetyState, string> = {
  G: "ดีมากค่ะ ทำต่อได้เลย",
  Y: "ระวังท่านิดนึงค่ะ",
  R: "หยุดก่อน ปรับท่าค่ะ",
  O: "กรุณาถอยให้กล้องเห็นทั้งตัวค่ะ",
};

export const STATE_COLOR: Record<SafetyState, string> = {
  G: "#22c55e",
  Y: "#eab308",
  R: "#ef4444",
  O: "#94a3b8",
};

export const PAIN_FACES = ["😀", "🙂", "😐", "😕", "😣", "😫"];
