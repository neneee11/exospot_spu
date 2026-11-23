import { describe, expect, it } from "vitest";
import type { FrameResult } from "../../pose/types";
import { Coach } from "../coach";
import { parseIntent } from "../commands";
import { Phrasebook, fill } from "../nlg";

const frame = (p: Partial<FrameResult>): FrameResult => ({
  visible: true,
  state: "G",
  rawState: "G",
  stateChanged: false,
  issues: [],
  primaryIssue: null,
  kneeAngle: null,
  valgusRatio: null,
  velocity: null,
  asymmetry: null,
  phase: "SITTING",
  repCount: 0,
  completedRep: null,
  ...p,
});

const rep = (n: number, worst: "G" | "Y" | "R" = "G") =>
  frame({ repCount: n, completedRep: { rep: n, durationSec: 3, minKneeAngle: 90, maxKneeAngle: 170, worstState: worst, issues: [] } });

describe("NLG", () => {
  it("แทนค่า slot และคำลงท้ายตามบุคลิก", () => {
    expect(fill("สวัสดี{p} {name}", { p: "ครับ", name: "ยาย" })).toBe("สวัสดีครับ ยาย");
    expect(new Phrasebook("coach", () => 0).say("resume")).toContain("ครับ");
    expect(new Phrasebook("warm", () => 0).say("resume")).toContain("ค่ะ");
  });

  it("ไม่พูดประโยคเดิมซ้ำติดกัน", () => {
    const book = new Phrasebook("warm", () => 0); // สุ่มได้ index 0 ตลอด
    expect(book.say("praise")).not.toBe(book.say("praise"));
  });
});

describe("Coach", () => {
  it("นับครั้ง บอกครึ่งทาง และบอกครั้งสุดท้าย", () => {
    const c = new Coach("warm", "ยาย", 10, () => 0);
    expect(c.onFrame(rep(1))[0].text).toBe("1");
    expect(c.onFrame(rep(5))[0].text).toMatch(/ครึ่งทาง/);
    expect(c.onFrame(rep(8))[0].text).toMatch(/อีก 2 ครั้ง/);
  });

  it("เตือนครั้งแรกสั้นๆ ผิดซ้ำให้วิธีแก้ และอันตรายพูดแทรกทันที", () => {
    const c = new Coach("warm", "ยาย", 10, () => 0);
    const first = c.onFrame(frame({ state: "Y", stateChanged: true, primaryIssue: "valgus" }))[0];
    const again = c.onFrame(frame({ state: "R", stateChanged: true, primaryIssue: "valgus" }))[0];
    expect(first.text).toMatch(/เข่า/);
    expect(again.text).toMatch(/ปลายเท้า|นิ้วเท้า/);
    expect(again.priority).toBe("high");
  });

  it("ชมเมื่อแก้ท่าได้หลังจากครั้งก่อนผิด", () => {
    const c = new Coach("fun", "ยาย", 10, () => 0);
    c.onFrame(rep(1, "Y"));
    expect(c.onFrame(rep(2))[0].text.length).toBeGreaterThan(1);
  });
});

describe("Voice command intent", () => {
  it.each([
    ["พักก่อนนะ", "pause"],
    ["ทำต่อ", "resume"],
    ["จบแล้ว", "finish"],
    ["พอแล้ว", "finish"],
    ["ได้กี่ครั้งแล้ว", "count"],
    ["เริ่มเลย", "start"],
    ["วันนี้อากาศดี", null],
  ])("%s → %s", (text, intent) => {
    expect(parseIntent(text)).toBe(intent);
  });
});
