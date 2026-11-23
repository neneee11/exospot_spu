/**
 * สั่งงานด้วยเสียง (Speech-to-Text + Intent detection)
 * ผู้สูงอายุพูดได้เลยโดยไม่ต้องแตะจอ เช่น "พัก", "ต่อ", "จบ", "ได้กี่ครั้งแล้ว"
 *
 * หมายเหตุ PDPA: Chrome ส่งเสียงไปแปลงเป็นข้อความที่เซิร์ฟเวอร์ของ Google
 * จึงปิดไว้เป็นค่าเริ่มต้น ผู้ใช้ต้องเปิดเองในหน้าโปรไฟล์
 */
export type Intent = "start" | "pause" | "resume" | "finish" | "count";

/** กติกาจับคำ เรียงตามลำดับความสำคัญ (ตรวจข้อแรกก่อน) */
const RULES: { intent: Intent; pattern: RegExp }[] = [
  { intent: "count", pattern: /(กี่ครั้ง|เท่าไหร่|เท่าไร|เหลือกี่|นับได้)/ },
  { intent: "finish", pattern: /(จบ|พอแล้ว|เลิก|หยุดฝึก|ไม่ไหวแล้ว)/ },
  { intent: "pause", pattern: /(พัก|หยุดก่อน|รอก่อน|เหนื่อย|หยุด)/ },
  { intent: "resume", pattern: /(ทำต่อ|ไปต่อ|ต่อเลย|ต่อ|พร้อมแล้ว)/ },
  { intent: "start", pattern: /(เริ่ม|ลุย|ไปกัน)/ },
];

/** แปลงข้อความที่ได้ยินเป็นคำสั่ง (null = ไม่ใช่คำสั่ง) */
export function parseIntent(text: string): Intent | null {
  const t = text.replace(/\s+/g, "").toLowerCase();
  return RULES.find((r) => r.pattern.test(t))?.intent ?? null;
}

/* ---------- Web Speech API (SpeechRecognition) ---------- */

interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => Recognition;

const w = (typeof window === "undefined" ? {} : window) as {
  SpeechRecognition?: RecognitionCtor;
  webkitSpeechRecognition?: RecognitionCtor;
};
const Ctor: RecognitionCtor | undefined = w.SpeechRecognition ?? w.webkitSpeechRecognition;

export const voiceCommandsSupported = !!Ctor;

export class VoiceCommands {
  private rec: Recognition | null = null;
  private active = false;

  constructor(
    private onIntent: (intent: Intent, heard: string) => void,
    /** คืน true ระหว่างที่แอปกำลังพูด (กันไม่ให้ฟังเสียงตัวเองเป็นคำสั่ง) */
    private isSpeaking: () => boolean,
    private onError?: (message: string) => void,
  ) {}

  start() {
    if (!Ctor || this.active) return;
    this.active = true;
    const rec = new Ctor();
    rec.lang = "th-TH";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r.isFinal || this.isSpeaking()) continue;
        const heard = r[0].transcript;
        const intent = parseIntent(heard);
        if (intent) this.onIntent(intent, heard);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.active = false;
        this.onError?.("ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน");
      }
    };
    // Chrome หยุดฟังเองเป็นระยะ → เริ่มใหม่อัตโนมัติ
    rec.onend = () => {
      if (this.active) setTimeout(() => this.active && rec.start(), 300);
    };
    this.rec = rec;
    rec.start();
  }

  stop() {
    this.active = false;
    this.rec?.stop();
    this.rec = null;
  }
}
