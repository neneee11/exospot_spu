import { DrawingUtils, PoseLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import { LM } from "./geometry";

const LEGS: [number, number, number][] = [
  [LM.leftHip, LM.leftKnee, LM.leftAnkle],
  [LM.rightHip, LM.rightKnee, LM.rightAnkle],
];

/**
 * วาดภาพกล้อง (แบบกระจก) + โครงกระดูก + ไฮไลต์ขาตามสีสถานะ + มุมเข่า
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  landmarks: NormalizedLandmark[] | undefined,
  color: string,
  angles: { left: number; right: number } | null,
) {
  const { width: W, height: H } = ctx.canvas;
  ctx.save();
  ctx.setTransform(-1, 0, 0, 1, W, 0); // mirror
  ctx.drawImage(video, 0, 0, W, H);

  if (landmarks) {
    const du = new DrawingUtils(ctx);
    du.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: "rgba(255,255,255,0.55)", lineWidth: 3 });
    du.drawLandmarks(landmarks, { color: "#ffffff", fillColor: "#0f3b3a", radius: 3 });

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    for (const [a, b, c] of LEGS) {
      ctx.beginPath();
      ctx.moveTo(landmarks[a].x * W, landmarks[a].y * H);
      ctx.lineTo(landmarks[b].x * W, landmarks[b].y * H);
      ctx.lineTo(landmarks[c].x * W, landmarks[c].y * H);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(landmarks[b].x * W, landmarks[b].y * H, 13, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // ตัวเลขมุมเข่า (วาดหลังยกเลิก mirror เพื่อให้อ่านได้)
  if (landmarks && angles) {
    ctx.font = "600 30px 'IBM Plex Sans Thai', sans-serif";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.fillStyle = "#fff";
    const label = (idx: number, deg: number) => {
      const x = W - landmarks[idx].x * W + 22;
      const y = landmarks[idx].y * H + 10;
      const t = `${Math.round(deg)}°`;
      ctx.strokeText(t, x, y);
      ctx.fillText(t, x, y);
    };
    label(LM.leftKnee, angles.left);
    label(LM.rightKnee, angles.right);
  }
}
