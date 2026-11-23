import type { Utterance } from "../coach/coach";
import { PERSONAS, type PersonaId } from "../coach/personas";

/**
 * Text-to-Speech ภาษาไทยด้วย Web Speech API
 * - high   = ตัดเสียงที่พูดอยู่แล้วพูดทันที (คำเตือนอันตราย)
 * - normal = ต่อคิว
 * - low    = ข้ามถ้ากำลังพูดอยู่
 */
class Voice {
  enabled = true;
  private persona: PersonaId = "warm";
  private lastSpoken = new Map<string, number>();
  private thaiVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (!("speechSynthesis" in window)) return;
    const pick = () => {
      this.thaiVoice = speechSynthesis.getVoices().find((v) => v.lang.startsWith("th")) ?? null;
    };
    pick();
    speechSynthesis.addEventListener("voiceschanged", pick);
  }

  setPersona(p: PersonaId) {
    this.persona = p;
  }

  get speaking() {
    return "speechSynthesis" in window && speechSynthesis.speaking;
  }

  speak(u: Utterance) {
    if (!this.enabled || !("speechSynthesis" in window)) return;
    const now = performance.now();
    if (u.cooldownMs && now - (this.lastSpoken.get(u.key) ?? -Infinity) < u.cooldownMs) return;
    if (u.priority === "low" && speechSynthesis.speaking) return;
    this.lastSpoken.set(u.key, now);

    if (u.priority === "high") speechSynthesis.cancel();
    const p = PERSONAS[this.persona];
    const utter = new SpeechSynthesisUtterance(u.text);
    utter.lang = "th-TH";
    utter.rate = p.rate;
    utter.pitch = p.pitch;
    if (this.thaiVoice) utter.voice = this.thaiVoice;
    speechSynthesis.speak(utter);
  }

  /** พูดข้อความธรรมดา (เช่น ประโยคจาก LLM) */
  say(text: string, priority: Utterance["priority"] = "high") {
    this.speak({ text, priority, key: "say", cooldownMs: 0 });
  }

  stop() {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }
}

export const voice = new Voice();
