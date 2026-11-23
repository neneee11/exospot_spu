import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

/** ต้องตรงกับเวอร์ชันใน package.json เพราะไฟล์ wasm โหลดจาก CDN */
const MEDIAPIPE_VERSION = "1.2.3";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

const MODEL_URL = {
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
} as const;

export type ModelVariant = keyof typeof MODEL_URL;

/** โหลดโมเดล MediaPipe Pose Landmarker (ลอง GPU ก่อน ถ้าไม่ได้ใช้ CPU) */
export async function createPoseLandmarker(variant: ModelVariant = "lite") {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const make = (delegate: "GPU" | "CPU") =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL[variant], delegate },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  try {
    return { landmarker: await make("GPU"), delegate: "GPU" as const };
  } catch {
    return { landmarker: await make("CPU"), delegate: "CPU" as const };
  }
}

/** เปิด webcam */
export async function openCamera(video: HTMLVideoElement) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
    audio: false,
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return stream;
}

export function closeCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}
