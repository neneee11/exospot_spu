/** รายการท่าที่ระบบรองรับ (ตอนนี้มีท่าเดียวสำหรับ demo) */
export type ExerciseId = "sit_to_stand";

export interface ExerciseInfo {
  id: ExerciseId;
  name: string;
  shortName: string;
  description: string;
  steps: string[];
  safetyTips: string[];
  cameraSetup: string;
  /** เวลาโดยประมาณต่อ 1 ครั้ง (วินาที) ใช้คำนวณเวลาฝึก */
  secondsPerRep: number;
}

export const EXERCISES: Record<ExerciseId, ExerciseInfo> = {
  sit_to_stand: {
    id: "sit_to_stand",
    name: "ลุกจากเก้าอี้ (Sit-to-Stand)",
    shortName: "ลุกจากเก้าอี้",
    description: "ฝึกกล้ามเนื้อต้นขาและการทรงตัว ช่วยให้ลุกจากเตียง เก้าอี้ และห้องน้ำได้เองง่ายขึ้น",
    steps: [
      "นั่งบนเก้าอี้ที่มีพนักพิงและไม่มีล้อ เท้าวางราบ ห่างกันประมาณช่วงสะโพก",
      "โน้มตัวไปข้างหน้าเล็กน้อย แล้วลุกขึ้นช้าๆ จนยืนตรง",
      "ยืนนิ่ง 1 วินาที แล้วค่อยๆ นั่งลงช้าๆ",
      "ให้เข่าชี้ไปทางเดียวกับปลายเท้าตลอดการเคลื่อนไหว",
    ],
    safetyTips: [
      "ถ้าปวดเข่ามากขึ้นระหว่างฝึก ให้หยุดทันที",
      "ไม่ทิ้งตัวนั่งลงเก้าอี้",
      "ถ้าทรงตัวไม่ดี ให้มีคนยืนอยู่ข้างๆ",
    ],
    cameraSetup: "วางกล้องด้านหน้าเฉียงประมาณ 45° ห่าง 2–3 เมตร สูงระดับเอว ให้เห็นทั้งตัวและเก้าอี้",
    secondsPerRep: 4,
  },
};
