import { describe, expect, it } from "vitest";
import { DEFAULT_THRESHOLDS } from "../../config/thresholds";
import { SessionRecorder } from "../session";
import { SitToStandAnalyzer } from "../sitToStand";
import type { PoseFrame } from "../types";

/** สร้างท่าจำลอง: มุมเข่า (องศา) และความกว้างเข่า (เมตร) */
function pose(kneeAngle: number, kneeHalfWidth = 0.1): PoseFrame {
  const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  const rad = (kneeAngle * Math.PI) / 180;
  for (const [hip, knee, ankle, sign] of [
    [23, 25, 27, -1],
    [24, 26, 28, 1],
  ] as const) {
    world[knee] = { x: sign * kneeHalfWidth, y: 0, z: 0, visibility: 1 };
    world[ankle] = { x: sign * 0.1, y: 0.45, z: 0, visibility: 1 };
    world[hip] = { x: sign * 0.1, y: 0.45 * Math.cos(rad), z: 0.45 * Math.sin(rad), visibility: 1 };
  }
  const image = world.map((p) => ({ ...p, x: 0.5, y: 0.5 }));
  return { world, image };
}

/** เคลื่อนมุมเข่าจาก a ไป b ใน n เฟรม (30 fps) */
function* move(a: number, b: number, n: number, width?: number) {
  for (let i = 0; i <= n; i++) yield pose(a + ((b - a) * i) / n, width);
}

function run(frames: Iterable<PoseFrame>) {
  const an = new SitToStandAnalyzer({ thresholds: DEFAULT_THRESHOLDS, postOp: false });
  const rec = new SessionRecorder("sit_to_stand", 10);
  rec.start(0);
  let t = 0;
  const results = [];
  for (const f of frames) {
    t += 1000 / 30;
    const r = an.update(f, t);
    rec.onFrame(r);
    results.push(r);
  }
  return { results, summary: rec.finish(t) };
}

function* slowReps(count: number, width?: number) {
  yield* move(90, 90, 20, width);
  for (let i = 0; i < count; i++) {
    yield* move(90, 172, 45, width); // ลุก 1.5 วิ
    yield* move(172, 172, 15, width);
    yield* move(172, 90, 60, width); // นั่ง 2 วิ
    yield* move(90, 90, 15, width);
  }
}

describe("SitToStandAnalyzer", () => {
  it("แยกสีเขียว เหลือง และแดงตามเกณฑ์ที่กำหนด", () => {
    const th = { ...DEFAULT_THRESHOLDS, debounceFrames: 1, yellowConfirmFrames: 1, redConfirmFrames: 1 };
    const an = new SitToStandAnalyzer({ thresholds: th, postOp: false });

    const safe = an.update(pose(130), 100);
    expect(safe.state).toBe("G");

    const warning = an.update(pose(130, 0.075), 133);
    expect(warning.rawState).toBe("Y");

    const danger = an.update(pose(130, 0.05), 166);
    expect(danger.rawState).toBe("R");
  });
  it("นับครั้งได้ถูกต้องเมื่อทำท่าช้าๆ", () => {
    const { summary } = run(slowReps(5));
    expect(summary.completedReps).toBe(5);
    expect(summary.correctReps).toBe(5);
    expect(summary.romMin).toBeLessThanOrEqual(92);
    expect(summary.romMax).toBeGreaterThanOrEqual(168);
  });

  it("เตือนเข่าบิดเข้าใน", () => {
    const { results, summary } = run(slowReps(2, 0.05)); // เข่าห่างครึ่งหนึ่งของข้อเท้า
    expect(results.some((r) => r.state === "R" && r.primaryIssue === "valgus")).toBe(true);
    expect(summary.alerts.valgus).toBeGreaterThan(0);
    expect(summary.correctReps).toBe(0);
  });

  it("เตือนเมื่อทิ้งตัวนั่งเร็ว", () => {
    const frames = function* () {
      yield* move(90, 90, 20);
      yield* move(90, 172, 45);
      yield* move(172, 172, 15);
      yield* move(172, 90, 6); // นั่งลงใน 0.2 วิ
      yield* move(90, 90, 20);
    };
    const { summary } = run(frames());
    expect(summary.completedReps).toBe(1);
    expect(summary.alerts.tooFast).toBeGreaterThan(0);
    expect(summary.correctReps).toBe(0);
    expect(summary.reps[0].issues).toContain("tooFast");
  });

  it("ไม่นับและไม่เตือนเมื่อมองไม่เห็นตัว", () => {
    const hidden = pose(120);
    hidden.image = hidden.image!.map((p) => ({ ...p, visibility: 0.1 }));
    const { results } = run(Array(30).fill(hidden));
    expect(results.at(-1)!.state).toBe("O");
    expect(results.at(-1)!.repCount).toBe(0);
  });
});
