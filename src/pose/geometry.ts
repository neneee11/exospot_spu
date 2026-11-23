/** ฟังก์ชันคำนวณเรขาคณิตของข้อต่อ (ไม่ขึ้นกับ library) */

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** ดัชนีจุดข้อต่อของ MediaPipe Pose (33 จุด) ที่โปรเจกต์ใช้ */
export const LM = {
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

/** จุดที่ต้องมองเห็นชัดก่อนประเมินท่า */
export const REQUIRED_POINTS = [
  LM.leftHip,
  LM.rightHip,
  LM.leftKnee,
  LM.rightKnee,
  LM.leftAnkle,
  LM.rightAnkle,
];

const sub = (a: Point3, b: Point3): Point3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Point3, b: Point3) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: Point3) => Math.hypot(a.x, a.y, a.z);

export const distance = (a: Point3, b: Point3) => norm(sub(a, b));

/**
 * มุมที่จุด b (องศา) ระหว่างเวกเตอร์ b→a และ b→c
 * ใช้คำนวณมุมเข่า: angleAt(hip, knee, ankle)
 * 180° = เหยียดตรง, ~90° = นั่งเก้าอี้
 */
export function angleAt(a: Point3, b: Point3, c: Point3): number {
  const v1 = sub(a, b);
  const v2 = sub(c, b);
  const denom = norm(v1) * norm(v2);
  if (denom === 0) return 180;
  const cos = Math.min(1, Math.max(-1, dot(v1, v2) / denom));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * อัตราส่วนเข่าบิดเข้าใน (knee valgus)
 * ระยะห่างเข่าซ้าย-ขวา / ระยะห่างข้อเท้าซ้าย-ขวา
 * ~1.0 = ปกติ, น้อยกว่า 1 = เข่าหุบเข้าหากัน
 */
export function valgusRatio(lKnee: Point3, rKnee: Point3, lAnkle: Point3, rAnkle: Point3): number {
  const ankleGap = distance(lAnkle, rAnkle);
  if (ankleGap < 0.05) return 1; // เท้าชิดกันเกินไป คำนวณไม่ได้
  return distance(lKnee, rKnee) / ankleGap;
}
