import { Activity, Footprints, Play, Smile } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertBoxButton } from "../components/AlertBoxButton";
import { Badge, EmptyState, GlassCard, ProgressRing, SectionTitle } from "../components/ui";
import { EXERCISES } from "../config/exercises";
import { PAIN_FACES } from "../config/messages";
import { useData, useSessions } from "../data/DataContext";
import { todayStats } from "../data/stats";

export default function Home() {
  const { profile, plan } = useData();
  const { sessions, loading } = useSessions(1);
  if (!profile || !plan) return null;

  const t = todayStats(sessions, plan);
  const exercise = EXERCISES[plan.exercise];
  const minutes = Math.ceil((plan.targetReps * plan.sets * exercise.secondsPerRep) / 60);
  const remaining = Math.max(0, t.sessionsGoal - t.sessionsDone);
  const today = new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      {/* ---------- แถบบน ---------- */}
      <header className="flex items-center justify-between pt-2">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/25 text-2xl">🦵</div>
        <div className="flex gap-2">
          <AlertBoxButton compact />
          <Link
            to="/profile"
            className="grid h-14 w-14 place-items-center rounded-full bg-ink text-xl font-semibold text-white"
            aria-label="โปรไฟล์"
          >
            {profile.nickname.trim().charAt(0)}
          </Link>
        </div>
      </header>

      {/* ---------- ทักทาย ---------- */}
      <section className="mt-6">
        <p className="text-[28px] leading-tight text-white/90">
          สวัสดีค่ะ <b className="text-white">{profile.nickname}</b>
        </p>
        <p className="text-[28px] font-semibold leading-tight text-white">วันนี้พร้อมฝึกไหมคะ</p>
        <p className="mt-2 text-white/85">{today}</p>
      </section>

      {/* ---------- สถิติวันนี้ ---------- */}
      <SectionTitle action={<Link to="/stats" className="text-ink-soft">ดูเพิ่ม</Link>}>สถิติวันนี้</SectionTitle>
      <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
        <StatCard
          title="ทำวันนี้"
          value={`${t.repsDone}`}
          unit={`/ ${t.repsGoal} ครั้ง`}
          badge={levelLabel(t.repsGoal ? t.repsDone / t.repsGoal : 0)}
          progress={t.repsGoal ? t.repsDone / t.repsGoal : 0}
          icon={<Footprints className="text-white" size={22} />}
        />
        <StatCard
          title="ท่าถูก"
          value={t.correctPercent === null ? "–" : `${t.correctPercent}`}
          unit="%"
          badge={t.correctPercent === null ? "ยังไม่ฝึก" : levelLabel(t.correctPercent / 100)}
          progress={(t.correctPercent ?? 0) / 100}
          icon={<Activity className="text-white" size={22} />}
        />
        <StatCard
          title="ความปวดล่าสุด"
          value={t.lastPain === null ? "–" : `${t.lastPain}`}
          unit="/ 10"
          badge={t.lastPain === null ? "ยังไม่มีข้อมูล" : t.lastPain >= 7 ? "ปวดมาก" : t.lastPain >= 4 ? "ปานกลาง" : "น้อย"}
          progress={(t.lastPain ?? 0) / 10}
          icon={
            t.lastPain === null ? (
              <Smile className="text-white" size={22} />
            ) : (
              <span className="text-2xl">{PAIN_FACES[Math.min(5, Math.round(t.lastPain / 2))]}</span>
            )
          }
        />
      </div>

      {/* ---------- โปรแกรมวันนี้ ---------- */}
      <SectionTitle action={<Link to="/program" className="text-ink-soft">ดูเพิ่ม</Link>}>โปรแกรมวันนี้</SectionTitle>
      <GlassCard strong className="relative overflow-hidden">
        <h3 className="text-2xl font-semibold leading-tight text-ink">{exercise.shortName}</h3>
        <p className="mt-1 text-ink-soft">
          {plan.targetReps} ครั้ง × {plan.sets} เซต · ประมาณ {minutes} นาที
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-4 py-2 text-ink">
            วันนี้ {t.sessionsDone}/{t.sessionsGoal} รอบ
          </span>
        </div>
        <Link
          to="/session"
          aria-label="เริ่มฝึก"
          className="absolute bottom-5 right-5 grid h-16 w-16 place-items-center rounded-full bg-ink text-white shadow-lg"
        >
          <Play size={28} fill="currentColor" />
        </Link>
      </GlassCard>

      {!loading && (
        <div className="mt-4">
          {remaining > 0 ? (
            <EmptyState>วันนี้ยังฝึกได้อีก {remaining} รอบนะคะ</EmptyState>
          ) : (
            <EmptyState>วันนี้ฝึกครบตามโปรแกรมแล้ว เก่งมากค่ะ 🎉</EmptyState>
          )}
        </div>
      )}
    </>
  );
}

function levelLabel(ratio: number) {
  if (ratio >= 0.8) return "ดี";
  if (ratio >= 0.5) return "ปานกลาง";
  return "ทำต่อได้อีก";
}

function StatCard(props: {
  title: string;
  value: string;
  unit: string;
  badge: string;
  progress: number;
  icon: ReactNode;
}) {
  return (
    <GlassCard strong className="flex w-[180px] shrink-0 flex-col gap-3">
      <div>
        <p className="text-ink-soft">{props.title}</p>
        <p className="text-ink">
          <span className="text-3xl font-semibold">{props.value}</span> <span className="text-base">{props.unit}</span>
        </p>
      </div>
      <div className="flex items-end justify-between">
        <Badge>{props.badge}</Badge>
        <ProgressRing value={props.progress} size={64}>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-flame">{props.icon}</span>
        </ProgressRing>
      </div>
    </GlassCard>
  );
}
