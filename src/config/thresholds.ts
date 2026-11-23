/**
 * เกณฑ์ความปลอดภัยของท่า Sit-to-Stand
 * ค่าด้านล่างเป็น "ค่าเริ่มต้น" เท่านั้น นักกายภาพปรับรายบุคคลได้ในหน้า "จุดที่ต้องระวัง"
 * (ค่าที่ปรับแล้วจะถูกเก็บใน exercise_plans.thresholds)
 */
export interface Thresholds {
  /** มุมเข่าที่ถือว่า "ยืนตรง" (องศา) */
  standAngle: number;
  /** มุมเข่าที่ถือว่า "นั่ง" (องศา) */
  sitAngle: number;
  /** อัตราส่วน ระยะเข่า/ระยะข้อเท้า ต่ำกว่านี้ = เข่าบิดเข้าใน (เหลือง) */
  valgusWarn: number;
  /** ต่ำกว่านี้ = เข่าบิดเข้าในมาก (แดง) */
  valgusDanger: number;
  /** ความเร็วนั่งลง (°/วินาที) เร็วกว่านี้ = เหลือง (ใส่เป็นค่าบวก) */
  sitSpeedWarn: number;
  /** เร็วกว่านี้ = แดง */
  sitSpeedDanger: number;
  /** มุมเข่าซ้าย-ขวาต่างกันเกินนี้ = ลงน้ำหนักไม่เท่ากัน (เหลือง) */
  asymmetryWarn: number;
  /** ต่างกันเกินนี้ = แดง */
  asymmetryDanger: number;
  /**
   * มุมเข่าต่ำสุดที่แพทย์อนุญาต (เฉพาะกลุ่มผ่าตัดแล้ว)
   * null = ไม่จำกัด
   */
  minKneeAngle: number | null;
  /** จำนวนเฟรมที่ต้องค้างก่อนเปลี่ยนสถานะ (กันเตือนมั่ว) */
  debounceFrames: number;
  /** จำนวนเฟรมที่เสถียรสำหรับยืนยันสถานะเหลือง */
  yellowConfirmFrames: number;
  /** จำนวนเฟรมที่เสถียรสำหรับยืนยันสถานะแดง กะพริบไฟแดง */
  redConfirmFrames: number;
  /** ค่าความมั่นใจขั้นต่ำว่ามองเห็นจุดข้อต่อ */
  minVisibility: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  standAngle: 160,
  sitAngle: 100,
  valgusWarn: 0.85,
  valgusDanger: 0.7,
  sitSpeedWarn: 120,
  sitSpeedDanger: 200,
  asymmetryWarn: 20,
  asymmetryDanger: 35,
  minKneeAngle: null,
  debounceFrames: 6,
  yellowConfirmFrames: 3,
  redConfirmFrames: 6,
  minVisibility: 0.5,
};

/** ป้ายชื่อและหน่วย สำหรับแสดงในหน้าตั้งค่า */
export const THRESHOLD_FIELDS: {
  key: keyof Thresholds;
  label: string;
  unit: string;
  step: number;
  min: number;
  max: number;
}[] = [
  { key: "standAngle", label: "มุมเข่าที่นับว่ายืนตรง", unit: "°", step: 1, min: 140, max: 180 },
  { key: "sitAngle", label: "มุมเข่าที่นับว่านั่ง", unit: "°", step: 1, min: 70, max: 130 },
  { key: "valgusWarn", label: "เข่าบิดเข้าใน – เตือนเหลือง ต่ำกว่า", unit: "", step: 0.01, min: 0.5, max: 1.1 },
  { key: "valgusDanger", label: "เข่าบิดเข้าใน – เตือนแดง ต่ำกว่า", unit: "", step: 0.01, min: 0.4, max: 1 },
  { key: "sitSpeedWarn", label: "นั่งลงเร็ว – เตือนเหลือง เกิน", unit: "°/วิ", step: 5, min: 40, max: 300 },
  { key: "sitSpeedDanger", label: "นั่งลงเร็ว – เตือนแดง เกิน", unit: "°/วิ", step: 5, min: 60, max: 400 },
  { key: "asymmetryWarn", label: "ลงน้ำหนักไม่เท่ากัน – เหลือง เกิน", unit: "°", step: 1, min: 5, max: 60 },
  { key: "asymmetryDanger", label: "ลงน้ำหนักไม่เท่ากัน – แดง เกิน", unit: "°", step: 1, min: 10, max: 80 },
  { key: "debounceFrames", label: "กันสั่น (จำนวนเฟรม)", unit: "เฟรม", step: 1, min: 1, max: 20 },
];
