import { Camera, CheckCircle2, Play, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { GlassCard, PageHeader, SectionTitle } from "../components/ui";
import { EXERCISES } from "../config/exercises";
import { useData, useSessions } from "../data/DataContext";
import { todayStats } from "../data/stats";

export default function Program() {
  const { plan } = useData();
  const { sessions } = useSessions(1);
  if (!plan) return null;

  const ex = EXERCISES[plan.exercise];
  const t = todayStats(sessions, plan);
  const done = t.sessionsDone >= t.sessionsGoal;

  return (
    <>
      <PageHeader title="โปรแกรม" back={false} />

      <GlassCard strong>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-ink">{ex.name}</h2>
            <p className="mt-1 text-ink-soft">
              {plan.targetReps} ครั้ง × {plan.sets} เซต · วันละ {plan.perDay} รอบ
            </p>
          </div>
          {done && <CheckCircle2 className="shrink-0 text-ok" size={32} />}
        </div>
        <p className="mt-3 text-ink">{ex.description}</p>
        {plan.approvedBy && <p className="mt-2 text-sm text-ink-soft">โปรแกรมโดย {plan.approvedBy}</p>}
        <Link
          to="/session"
          className="mt-5 flex min-h-14 items-center justify-center gap-2 rounded-full bg-ink text-lg font-semibold text-white"
        >
          <Play size={22} fill="currentColor" /> เริ่มฝึก
        </Link>
      </GlassCard>

      <SectionTitle>วิธีทำ</SectionTitle>
      <GlassCard>
        <ol className="space-y-3">
          {ex.steps.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-white">{i + 1}</span>
              <span className="text-ink">{s}</span>
            </li>
          ))}
        </ol>
      </GlassCard>

      <SectionTitle>ตั้งกล้อง</SectionTitle>
      <GlassCard className="flex gap-3">
        <Camera className="shrink-0 text-ink" />
        <p className="text-ink">{ex.cameraSetup}</p>
      </GlassCard>

      <SectionTitle>ข้อควรระวัง</SectionTitle>
      <GlassCard>
        <ul className="space-y-2">
          {ex.safetyTips.map((s) => (
            <li key={s} className="flex gap-3 text-ink">
              <ShieldAlert className="shrink-0 text-flame" /> {s}
            </li>
          ))}
        </ul>
      </GlassCard>
    </>
  );
}
