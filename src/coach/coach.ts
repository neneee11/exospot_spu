import type { FrameResult, IssueKey, SessionSummary } from "../pose/types";
import { Phrasebook } from "./nlg";
import { DANGER_PREFIX, ISSUE_PHRASES, type PersonaId } from "./personas";

export type Priority = "high" | "normal" | "low";

export interface Utterance {
  text: string;
  priority: Priority;
  /** ข้อความประเภทเดียวกันพูดซ้ำได้หลังจากกี่ ms */
  cooldownMs: number;
  key: string;
}

/**
 * โค้ชเสียง: ตัดสินใจว่าจะ "พูดอะไร" และ "พูดเมื่อไหร่" จากผลของ AI แต่ละเฟรม
 * - นับครั้ง + บอกความคืบหน้าแบบเป็นธรรมชาติ (ครึ่งทาง, เหลืออีกกี่ครั้ง)
 * - ชมเมื่อทำถูกติดกัน และชมเมื่อแก้ท่าได้
 * - เตือนครั้งแรกสั้นๆ ถ้าผิดซ้ำจะบอกวิธีแก้
 * - ประโยคไม่ซ้ำเดิม และเปลี่ยนตามบุคลิกที่เลือก
 * คลาสนี้ไม่เรียกเสียงเอง แค่คืนข้อความ (ทดสอบได้ง่าย)
 */
export class Coach {
  private book: Phrasebook;
  private issueCount: Record<IssueKey, number> = { valgus: 0, tooFast: 0, asymmetry: 0, overFlex: 0 };
  private goodStreak = 0;
  private prevRepHadIssue = false;

  constructor(
    persona: PersonaId,
    private name: string,
    private totalReps: number,
    random?: () => number,
  ) {
    this.book = new Phrasebook(persona, random);
  }

  greet(): Utterance {
    return this.u(this.book.say("greet", { name: this.name }), "normal", "greet");
  }

  start(): Utterance {
    this.goodStreak = 0;
    this.prevRepHadIssue = false;
    return this.u(this.book.say("start"), "high", "start");
  }

  /** เรียกทุกเฟรมระหว่างฝึก คืนข้อความที่ควรพูด (ถ้ามี) */
  onFrame(f: FrameResult): Utterance[] {
    const out: Utterance[] = [];

    if (f.stateChanged) {
      if (f.state === "O") out.push(this.u(this.book.say("notVisible"), "normal", "notVisible", 6000));
      else if ((f.state === "Y" || f.state === "R") && f.primaryIssue) out.push(this.warn(f.primaryIssue, f.state));
    }

    if (f.completedRep) out.push(this.rep(f));
    return out;
  }

  private warn(issue: IssueKey, level: "Y" | "R"): Utterance {
    const n = ++this.issueCount[issue];
    const bank = ISSUE_PHRASES[issue];
    // ผิดซ้ำตั้งแต่ครั้งที่ 2 → บอกวิธีแก้
    let text = this.book.pickFrom(`issue:${issue}:${n > 1 ? "tip" : "first"}`, n > 1 ? bank.tip : bank.first);
    if (level === "R") text = this.book.pickFrom("danger", DANGER_PREFIX) + text;
    return this.u(text, level === "R" ? "high" : "normal", `issue:${issue}`, 3500);
  }

  private rep(f: FrameResult): Utterance {
    const n = f.repCount;
    const left = this.totalReps - n;
    const good = f.completedRep!.worstState === "G";
    const half = Math.ceil(this.totalReps / 2);

    let text: string;
    if (left > 0 && left <= 3) text = this.book.say("lastFew", { n, left });
    else if (n === half && this.totalReps >= 6) text = this.book.say("half", { n });
    else text = String(n);

    // เติมคำชม: แก้ท่าได้หลังจากครั้งก่อนผิด หรือทำถูกติดกัน 3 ครั้ง
    if (good) {
      this.goodStreak++;
      if (this.prevRepHadIssue) text += " " + this.book.say("recovered");
      else if (this.goodStreak % 3 === 0) text += " " + this.book.say("praise");
    } else this.goodStreak = 0;
    this.prevRepHadIssue = !good;

    return this.u(text, "normal", `rep:${n}`, 0);
  }

  setDone(set: number) {
    return this.u(this.book.say("setDone", { set }), "high", "setDone");
  }

  paused() {
    return this.u(this.book.say("paused"), "high", "paused");
  }

  resume() {
    return this.u(this.book.say("resume"), "high", "resume");
  }

  countReport(n: number) {
    return this.u(this.book.say("countReport", { n, left: Math.max(0, this.totalReps - n) }), "high", "countReport");
  }

  /** ประโยคสรุปผลตอนจบ (ใช้เป็นค่าสำรองถ้าไม่มี LLM) */
  finish(s: SessionSummary): Utterance {
    const key = s.correctPercent >= 80 ? "finishGreat" : "finishOk";
    return this.u(this.book.say(key, { name: this.name, correct: s.correctPercent }), "high", "finish");
  }

  private u(text: string, priority: Priority, key: string, cooldownMs = 0): Utterance {
    return { text, priority, key, cooldownMs };
  }
}
