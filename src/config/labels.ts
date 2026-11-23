import type { Feeling, PatientGroup, Sex, Side, WalkingAid } from "../data/types";

/** ป้ายภาษาไทยของค่าต่างๆ ในโปรไฟล์ */
export const SEX_LABEL: Record<Sex, string> = { female: "หญิง", male: "ชาย", other: "อื่นๆ" };

export const SIDE_LABEL: Record<Side, string> = { left: "เข่าซ้าย", right: "เข่าขวา", both: "ทั้งสองข้าง" };

export const GROUP_LABEL: Record<PatientGroup, string> = {
  pre_op: "ยังไม่ผ่าตัด (ระหว่างรักษาตัว)",
  post_op: "ผ่าตัดแล้ว (ระยะฟื้นตัว)",
};

export const AID_LABEL: Record<WalkingAid, string> = { none: "ไม่ใช้", cane: "ไม้เท้า", walker: "Walker" };

export const FEELING_LABEL: Record<Feeling, string> = { easy: "ง่าย", ok: "พอดี", tired: "เหนื่อย" };

export const COMORBIDITY_OPTIONS = ["เบาหวาน", "ความดันโลหิตสูง", "น้ำหนักเกิน / โรคอ้วน", "โรคหัวใจ", "กระดูกพรุน"];

export const options = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
