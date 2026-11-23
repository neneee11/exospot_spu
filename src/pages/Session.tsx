import { Check, Mic, MicOff, Pause, Play, Square, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertBoxButton, LedMirror, useLedBox } from "../components/AlertBoxButton";
import { CircleButton, GlassCard, PainPicker, PrimaryButton, SecondaryButton } from "../components/ui";
import { EXERCISES } from "../config/exercises";
import { ISSUE_LABEL, STATE_BANNER, STATE_COLOR } from "../config/messages";
import { PERSONAS } from "../coach/personas";
import { useData, useSessions } from "../data/DataContext";
import type { CoachFacts, ExercisePlan, Profile, Repository, SessionRecord } from "../data/types";
import type { SessionSummary } from "../pose/types";
import { usePoseSession } from "../pose/usePoseSession";

export interface SummaryRouteState {
  summary: SessionSummary;
  painBefore: number | null;
  /** ประโยคสรุปสำเร็จรูปของโค้ช (ใช้ถ้า LLM ไม่ตอบ) */
  fallbackLine: string;
}

export default function Session() {
  const { profile, plan, repo } = useData();
  const { sessions, loading } = useSessions(14);
  if (!profile || !plan || loading) return null;
  return <SessionScreen profile={profile} plan={plan} repo={repo} history={sessions} />;
}

/** ข้อมูลตัวเลขสำหรับให้ LLM แต่งคำทักทาย (ไม่มีชื่อหรือข้อมูลระบุตัวตน) */
function greetingFacts(history: SessionRecord[], profile: Profile): CoachFacts {
  const last = history[0];
  const today = new Date().toDateString();
  return {
    hour: new Date().getHours(),
    patientGroup: profile.group,
    sessionsToday: history.filter((s) => new Date(s.startedAt).toDateString() === today).length,
    daysSinceLast: last ? Math.floor((Date.now() - new Date(last.startedAt).getTime()) / 86_400_000) : null,
    lastCorrectPercent: last?.correctPercent ?? null,
    lastPainAfter: last?.painAfter ?? null,
  };
}

function SessionScreen({
  profile,
  plan,
  repo,
  history,
}: {
  profile: Profile;
  plan: ExercisePlan;
  repo: Repository;
  history: SessionRecord[];
}) {
  const navigate = useNavigate();
  const [painBefore, setPainBefore] = useState<number | null>(null);
  const { status: box } = useLedBox();

  const s = usePoseSession({
    plan,
    profile,
    repo,
    greetingFacts: greetingFacts(history, profile),
    canStart: () => !!s.frame?.visible && painBefore !== null,
    onFinish: (summary, coach) =>
      navigate("/summary", {
        replace: true,
        state: { summary, painBefore, fallbackLine: coach.finish(summary).text } satisfies SummaryRouteState,
      }),
  });

  const f = s.frame;
  const exercise = EXERCISES[plan.exercise];
  const visible = !!f?.visible;
  const live = s.stage === "live";
  const state = live && f ? f.state : null;
  const bannerText =
    state === "Y" || state === "R"
      ? f?.primaryIssue
        ? `${state === "R" ? "หยุดก่อน! " : "ระวัง: "}${ISSUE_LABEL[f.primaryIssue]}`
        : STATE_BANNER[state]
      : state
        ? STATE_BANNER[state]
        : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <CircleButton aria-label="ออก" onClick={() => navigate("/")}>
          <X size={26} />
        </CircleButton>
        <h1 className="text-center text-2xl font-semibold text-ink">{exercise.shortName}</h1>
        <span className="w-14 text-right text-sm text-ink-soft">{s.fps ? `${s.fps} fps` : ""}</span>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---------- ภาพกล้อง + โครงกระดูก ---------- */}
        <div className="relative overflow-hidden rounded-[28px] border border-white/50 bg-black/80 shadow-xl">
          <video ref={s.videoRef} className="hidden" playsInline muted />
          <canvas ref={s.canvasRef} className="block aspect-video w-full object-contain" />

          {s.stage === "loading" && <Overlay>กำลังโหลดโมเดลและเปิดกล้อง…</Overlay>}
          {s.stage === "error" && <Overlay>{s.error}</Overlay>}

          {bannerText && (
            <div
              className="absolute left-4 top-4 rounded-full px-5 py-2 text-xl font-semibold text-white shadow-lg"
              style={{ background: STATE_COLOR[state!] }}
            >
              {bannerText}
            </div>
          )}
          {(live || s.stage === "rest") && f && (
            <div className="absolute right-4 top-4 rounded-3xl bg-ink/85 px-5 py-2 text-center text-white">
              <div className="text-5xl font-bold leading-none">
                {f.repCount}
                <span className="text-2xl font-medium text-white/70"> / {s.totalReps}</span>
              </div>
              <div className="text-sm text-white/80">
                เซต {Math.min(s.currentSet, plan.sets)} / {plan.sets}
              </div>
            </div>
          )}
        </div>

        {/* ---------- แผงควบคุม ---------- */}
        <div className="space-y-4">
          {s.coachText && (
            <GlassCard strong className="!p-4">
              <p className="text-sm text-ink-soft">โค้ช{PERSONAS[profile.settings.persona].label}</p>
              <p className="text-lg text-ink">“{s.coachText}”</p>
            </GlassCard>
          )}
          {profile.settings.voiceCommands && (
            <div className="flex items-center gap-3 rounded-full bg-white/45 px-4 py-2 text-ink">
              {s.micError ? <MicOff size={20} className="text-danger" /> : <Mic size={20} className="text-ok" />}
              <span className="text-sm">
                {s.micError ??
                  (s.heard ? `ได้ยินว่า: “${s.heard}”` : "พูดสั่งได้: เริ่ม · พัก · ต่อ · จบ · ได้กี่ครั้งแล้ว")}
              </span>
            </div>
          )}
          {s.stage === "setup" && (
            <>
              <GlassCard className="space-y-3">
                <h2 className="text-xl font-semibold text-ink">เตรียมพร้อม</h2>
                <CheckItem ok={visible}>
                  {visible ? "กล้องเห็นทั้งตัวแล้ว" : "ถอยให้กล้องเห็นตั้งแต่สะโพกถึงเท้า"}
                </CheckItem>
                <CheckItem ok={box === "connected"} optional>
                  กล่องไฟ LED {box === "connected" ? "พร้อม" : "(ไม่บังคับ)"}
                </CheckItem>
                <AlertBoxButton />
                <LedMirror />
                <p className="text-sm text-ink-soft">{exercise.cameraSetup}</p>
              </GlassCard>

              <GlassCard className="space-y-3">
                <h2 className="text-xl font-semibold text-ink">ก่อนฝึก ปวดเข่าระดับไหนคะ</h2>
                <PainPicker value={painBefore} onChange={setPainBefore} />
                {painBefore !== null && painBefore >= 8 && (
                  <p className="rounded-2xl bg-danger/15 p-3 text-danger">
                    วันนี้ปวดมาก ควรพักหรือปรึกษานักกายภาพก่อนนะคะ
                  </p>
                )}
              </GlassCard>

              <PrimaryButton className="w-full" disabled={!visible || painBefore === null} onClick={s.start}>
                <Play size={22} fill="currentColor" /> เริ่มฝึก
              </PrimaryButton>
            </>
          )}

          {(live || s.stage === "rest") && (
            <>
              <LedMirror />
              <GlassCard className="grid grid-cols-2 gap-3">
                <Metric label="มุมเข่าซ้าย" value={f?.kneeAngle ? `${Math.round(f.kneeAngle.left)}°` : "–"} />
                <Metric label="มุมเข่าขวา" value={f?.kneeAngle ? `${Math.round(f.kneeAngle.right)}°` : "–"} />
                <Metric label="ระยะเข่า/ข้อเท้า" value={f?.valgusRatio ? f.valgusRatio.toFixed(2) : "–"} />
                <Metric label="ท่าทาง" value={f ? PHASE_LABEL[f.phase] : "–"} />
              </GlassCard>

              {s.stage === "rest" ? (
                <GlassCard strong className="space-y-3 text-center">
                  <p className="text-xl font-semibold text-ink">พักสักครู่ค่ะ</p>
                  <PrimaryButton className="w-full" onClick={s.resume}>
                    <Play size={22} fill="currentColor" /> ฝึกต่อ
                  </PrimaryButton>
                </GlassCard>
              ) : (
                <SecondaryButton className="w-full" onClick={s.pause}>
                  <Pause size={22} /> พัก
                </SecondaryButton>
              )}
              <SecondaryButton className="w-full" onClick={s.finish}>
                <Square size={20} /> จบการฝึก
              </SecondaryButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const PHASE_LABEL = { UNKNOWN: "–", SITTING: "นั่ง", STANDING: "ยืน" } as const;

function Overlay({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 grid place-items-center p-8 text-center text-xl text-white">{children}</div>;
}

function CheckItem({ ok, optional, children }: { ok: boolean; optional?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid h-8 w-8 place-items-center rounded-full ${
          ok ? "bg-ok text-white" : optional ? "bg-white/50 text-ink-soft" : "bg-warn text-white"
        }`}
      >
        {ok ? <Check size={18} /> : "!"}
      </span>
      <span className="text-ink">{children}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/40 p-3">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
