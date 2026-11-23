import { PERSONAS, PHRASES, type PersonaId, type PhraseKey } from "./personas";

export type Slots = Record<string, string | number>;

/** คำทักทายตามช่วงเวลาของวัน */
export function timeGreeting(date = new Date()) {
  const h = date.getHours();
  if (h < 11) return "อรุณสวัสดิ์";
  if (h < 16) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
}

/** แทนค่า {slot} ในประโยค */
export function fill(template: string, slots: Slots) {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in slots ? String(slots[k]) : m)).trim();
}

/**
 * Natural Language Generation แบบ template:
 * สุ่มประโยคจากคลัง โดยไม่ซ้ำกับประโยคที่เพิ่งพูดไปในหมวดเดียวกัน
 */
export class Phrasebook {
  private last = new Map<string, number>();

  constructor(
    public persona: PersonaId,
    private random: () => number = Math.random,
  ) {}

  /** เลือก 1 ประโยคจากรายการ (ไม่ซ้ำกับครั้งก่อนของ key เดียวกัน) */
  pickFrom(key: string, options: string[], slots: Slots = {}) {
    let i = Math.floor(this.random() * options.length);
    if (options.length > 1 && i === this.last.get(key)) i = (i + 1) % options.length;
    this.last.set(key, i);
    return fill(options[i], { p: PERSONAS[this.persona].particle, time: timeGreeting(), ...slots });
  }

  say(key: PhraseKey, slots: Slots = {}) {
    return this.pickFrom(key, PHRASES[this.persona][key], slots);
  }
}
