import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Coach } from "../coach/coach";
import { VoiceCommands, type Intent } from "../coach/commands";
import { STATE_COLOR } from "../config/messages";
import type { CoachFacts, ExercisePlan, Profile, Repository } from "../data/types";
import { ledBox } from "../io/serial";
import { voice } from "../io/voice";
import { drawFrame } from "./draw";
import { closeCamera, createPoseLandmarker, openCamera } from "./landmarker";
import { SessionRecorder } from "./session";
import { SitToStandAnalyzer } from "./sitToStand";
import type { FrameResult, SessionSummary } from "./types";

export type Stage = "loading" | "setup" | "live" | "rest" | "done" | "error";

/** ความถี่ในการอัปเดตตัวเลขบนจอ (ms) – วาดภาพทุกเฟรม แต่ไม่ re-render React ทุกเฟรม */
const UI_INTERVAL = 100;

/**
 * รวม pipeline ทั้งหมดของหน้าฝึก:
 * กล้อง → MediaPipe → Analyzer → วาดผล → โค้ชเสียง + กล่องไฟ LED → บันทึก session
 * และฟังคำสั่งเสียง (ถ้าเปิดไว้)
 */
export function usePoseSession(params: {
  plan: ExercisePlan;
  profile: Profile;
  repo: Repository;
  /** ข้อมูลที่ให้ LLM ใช้แต่งคำทักทาย */
  greetingFacts: CoachFacts;
  /** เงื่อนไขเริ่มฝึกด้วยคำสั่งเสียง (เช่น ต้องเลือกคะแนนปวดก่อน) */
  canStart: () => boolean;
  onFinish: (summary: SessionSummary, coach: Coach) => void;
}) {
  const { plan, profile } = params;
  const { persona, voice: voiceOn, voiceCommands } = profile.settings;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stage, setStageState] = useState<Stage>("loading");
  const stageRef = useRef<Stage>("loading");
  const setStage = (s: Stage) => {
    stageRef.current = s;
    setStageState(s);
  };

  const [frame, setFrame] = useState<FrameResult | null>(null);
  const frameRef = useRef<FrameResult | null>(null);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentSet, setCurrentSet] = useState(1);
  const setRef = useRef(1);
  const [coachText, setCoachText] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const totalReps = plan.targetReps * plan.sets;
  const analyzer = useMemo(
    () => new SitToStandAnalyzer({ thresholds: plan.thresholds, postOp: profile.group === "post_op" }),
    [plan.thresholds, profile.group],
  );
  const recorder = useMemo(() => new SessionRecorder(plan.exercise, totalReps), [plan.exercise, totalReps]);
  const coach = useMemo(() => new Coach(persona, profile.nickname, totalReps), [persona, profile.nickname, totalReps]);

  const latest = useRef(params);
  latest.current = params;

  /** พูดและแสดงข้อความโค้ชบนจอ */
  const speak = useCallback((u: ReturnType<Coach["start"]>) => {
    voice.speak(u);
    setCoachText(u.text);
  }, []);

  /* ---------- คำสั่ง ---------- */
  const start = useCallback(() => {
    analyzer.reset();
    recorder.start(performance.now());
    setRef.current = 1;
    setCurrentSet(1);
    speak(coach.start());
    setStage("live");
  }, [analyzer, recorder, coach, speak]);

  const pause = useCallback(() => {
    ledBox.setState("O");
    speak(coach.paused());
    setStage("rest");
  }, [coach, speak]);

  const resume = useCallback(() => {
    analyzer.resumeCounting(performance.now());
    speak(coach.resume());
    setStage("live");
  }, [analyzer, coach, speak]);

  const finish = useCallback(() => {
    if (stageRef.current === "done") return;
    const summary = recorder.finish(performance.now());
    ledBox.setState("O");
    setStage("done");
    latest.current.onFinish(summary, coach);
  }, [recorder, coach]);

  /* ---------- ตอบสนองผลแต่ละเฟรมระหว่างฝึก ---------- */
  const handleLive = (f: FrameResult) => {
    recorder.onFrame(f);
    ledBox.setState(f.state);
    coach.onFrame(f).forEach(speak);

    if (f.completedRep) {
      ledBox.celebrate();
      if (f.repCount >= totalReps) return finish();
      if (f.repCount >= plan.targetReps * setRef.current) {
        speak(coach.setDone(setRef.current));
        setRef.current++;
        setCurrentSet(setRef.current);
        ledBox.setState("O");
        setStage("rest");
      }
    }
  };
  const handleLiveRef = useRef(handleLive);
  handleLiveRef.current = handleLive;

  /* ---------- คำสั่งเสียง ---------- */
  const onIntent = (intent: Intent, text: string) => {
    setHeard(text);
    const s = stageRef.current;
    if (intent === "start" && s === "setup" && latest.current.canStart()) start();
    else if (intent === "pause" && s === "live") pause();
    else if ((intent === "resume" || intent === "start") && s === "rest") resume();
    else if (intent === "finish" && (s === "live" || s === "rest")) finish();
    else if (intent === "count" && (s === "live" || s === "rest")) speak(coach.countReport(frameRef.current?.repCount ?? 0));
  };
  const onIntentRef = useRef(onIntent);
  onIntentRef.current = onIntent;

  useEffect(() => {
    if (!voiceCommands || stage === "loading" || stage === "error" || stage === "done") return;
    const vc = new VoiceCommands(
      (i, t) => onIntentRef.current(i, t),
      () => voice.speaking,
      setMicError,
    );
    vc.start();
    return () => vc.stop();
    // เริ่มฟังครั้งเดียวเมื่อพร้อม ไม่ต้องสร้างใหม่ทุกครั้งที่ stage เปลี่ยน
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceCommands, stage === "loading" || stage === "error" || stage === "done"]);

  /* ---------- ตั้งค่าเสียง ---------- */
  useEffect(() => {
    voice.enabled = voiceOn;
    voice.setPersona(persona);
  }, [voiceOn, persona]);

  /* ---------- โหลดโมเดล + เปิดกล้อง + วนลูปทุกเฟรม ---------- */
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let landmarker: PoseLandmarker | null = null;
    let raf = 0;

    // ขอคำทักทายจาก LLM ไปพร้อมกับโหลดโมเดล (ไม่ได้ก็ใช้ประโยคสำเร็จรูป)
    const { repo, greetingFacts } = latest.current;
    const greeting = repo.coachLine("greeting", persona, greetingFacts);

    (async () => {
      try {
        const created = await createPoseLandmarker("lite");
        landmarker = created.landmarker;
        if (cancelled) return landmarker.close();

        const video = videoRef.current!;
        const canvas = canvasRef.current!;
        stream = await openCamera(video);
        if (cancelled) return;
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext("2d")!;
        setStage("setup");

        const llmText = await greeting;
        if (!cancelled && stageRef.current === "setup") {
          speak(
            llmText
              ? { text: llmText.replaceAll("{name}", profile.nickname), priority: "normal", key: "greet", cooldownMs: 0 }
              : coach.greet(),
          );
        }

        let lastVideoTime = -1;
        let lastUi = 0;
        let frames = 0;
        let fpsStart = performance.now();

        const loop = () => {
          raf = requestAnimationFrame(loop);
          if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
          lastVideoTime = video.currentTime;

          const now = performance.now();
          const res = landmarker!.detectForVideo(video, now);
          const pose = { image: res.landmarks[0], world: res.worldLandmarks[0] };
          const live = stageRef.current === "live";
          const out = analyzer.update(pose, now, live);
          frameRef.current = out;

          // แสดงสถานะไฟจาก AI อัตโนมัติ ไม่ต้องกดเลือก G/Y/R/O
          ledBox.setState(out.visible ? out.state : "O");

          const color = live ? STATE_COLOR[out.state] : STATE_COLOR[out.visible ? "G" : "O"];
          drawFrame(ctx, video, pose.image, color, out.kneeAngle);
          if (live) handleLiveRef.current(out);

          frames++;
          if (now - fpsStart >= 1000) {
            setFps(Math.round((frames * 1000) / (now - fpsStart)));
            frames = 0;
            fpsStart = now;
          }
          if (now - lastUi >= UI_INTERVAL) {
            setFrame(out);
            lastUi = now;
          }
        };
        raf = requestAnimationFrame(loop);
      } catch (e) {
        if (cancelled) return;
        setError(describeError(e));
        setStage("error");
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      closeCamera(stream);
      landmarker?.close();
      ledBox.setState("O");
      voice.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzer]);

  return {
    videoRef,
    canvasRef,
    stage,
    frame,
    fps,
    error,
    currentSet,
    totalReps,
    coachText,
    heard,
    micError,
    start,
    pause,
    resume,
    finish,
  };
}

function describeError(e: unknown) {
  if (e instanceof DOMException) {
    if (e.name === "NotAllowedError") return "ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณากดอนุญาตที่แถบที่อยู่ของเบราว์เซอร์";
    if (e.name === "NotFoundError") return "ไม่พบกล้องในเครื่องนี้";
    if (e.name === "NotReadableError") return "กล้องถูกใช้งานโดยโปรแกรมอื่นอยู่";
  }
  return "โหลดโมเดลหรือเปิดกล้องไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่";
}
