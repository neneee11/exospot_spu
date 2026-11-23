import { Home, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { GlassCard, PainPicker, PrimaryButton, ProgressRing, Segmented, SecondaryButton } from "../components/ui";
import { FEELING_LABEL, options } from "../config/labels";
import { ISSUE_LABEL } from "../config/messages";
import { PERSONAS } from "../coach/personas";
import { useData } from "../data/DataContext";
import { voice } from "../io/voice";
import { sumAlerts } from "../data/stats";
import type { Feeling, SessionRecord } from "../data/types";
import type { IssueKey } from "../pose/types";
import type { SummaryRouteState } from "./Session";

export default function Summary() {
  const { repo, profile } = useData();
  const navigate = useNavigate();
  const state = useLocation().state as SummaryRouteState | null;

  const [painAfter, setPainAfter] = useState<number | null>(null);
  const [feeling, setFeeling] = useState<Feeling>("ok");
  const [saved, setSaved] = useState<SessionRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [coachLine, setCoachLine] = useState<string | null>(null);

  // โค้ชพูดสรุปผล: ให้ LLM แต่ง ถ้าไม่ได้ใช้ประโยคสำเร็จรูป
  useEffect(() => {
    if (!state || !profile) return;
    let cancelled = false;
    const { summary: s, painBefore: before } = state;
    const topIssue = (Object.entries(s.alerts) as [IssueKey, number][]).sort((a, b) => b[1] - a[1])[0];
    repo
      .coachLine("summary", profile.settings.persona, {
        completedReps: s.completedReps,
        targetReps: s.targetReps,
        correctPercent: s.correctPercent,
        mostFrequentIssue: topIssue && topIssue[1] > 0 ? ISSUE_LABEL[topIssue[0]] : null,
        avgSecondsPerRep: s.avgRepSec,
        painBefore: before,
      })
      .then((llm) => {
        if (cancelled) return;
        const line = llm ? llm.replaceAll("{name}", profile.nickname) : state.fallbackLine;
        setCoachLine(line);
        voice.setPersona(profile.settings.persona);
        voice.enabled = profile.settings.voice;
        voice.say(line);
      });
    return () => {
      cancelled = true;
      voice.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state || !profile) return <Navigate to="/" replace />;
  const { summary, painBefore } = state;
  const issues = (Object.keys(summary.alerts) as IssueKey[]).filter((k) => summary.alerts[k] > 0);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { reps, ...rest } = summary;
      const record = await repo.saveSession({ ...rest, reps, painBefore, painAfter, feeling });
      setSaved(record);
      if (profile.settings.autoNotify) setMessage((await repo.notifyCaregiver(record.id)).message);
      else setMessage("บันทึกผลแล้ว");
    } catch (e) {
      setMessage(e instanceof Error ? `บันทึกไม่สำเร็จ: ${e.message}` : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const sendLine = async () => {
    if (!saved) return;
    setBusy(true);
    setMessage((await repo.notifyCaregiver(saved.id)).message);
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-[480px] space-y-4 px-5 pb-16 pt-8">
      <div className="text-center">
        <p className="text-4xl">🎉</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">เก่งมากค่ะ {profile.nickname}</h1>
        <p className="text-lg text-ink-soft">
          วันนี้ทำได้ {summary.completedReps} จาก {summary.targetReps} ครั้ง
        </p>
      </div>

      {coachLine && (
        <GlassCard strong className="!p-4">
          <p className="text-sm text-ink-soft">โค้ช{PERSONAS[profile.settings.persona].label}</p>
          <p className="text-lg text-ink">“{coachLine}”</p>
        </GlassCard>
      )}

      <GlassCard strong className="flex items-center gap-5">
        <ProgressRing value={summary.correctPercent / 100} size={110} stroke={10}>
          <span className="text-3xl font-bold text-ink">{summary.correctPercent}%</span>
        </ProgressRing>
        <div>
          <p className="text-xl font-semibold text-ink">ท่าถูก</p>
          <p className="text-ink-soft">
            {summary.correctReps} จาก {summary.completedReps} ครั้ง
          </p>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3">
        <Tile label="เวลาเฉลี่ยต่อครั้ง" value={`${summary.avgRepSec} วิ`} />
        <Tile label="เวลาฝึกทั้งหมด" value={`${Math.round(summary.durationSec / 60)} นาที`} />
        <Tile
          label="ช่วงมุมเข่า"
          value={summary.romMin !== null ? `${summary.romMin}°–${summary.romMax}°` : "–"}
        />
        <Tile label="จำนวนการเตือน" value={`${sumAlerts(summary.alerts)} ครั้ง`} />
      </div>

      <GlassCard>
        <p className="mb-2 font-semibold text-ink">จุดที่ต้องระวัง</p>
        {issues.length ? (
          <ul className="space-y-1">
            {issues.map((k) => (
              <li key={k} className="flex justify-between text-ink">
                <span>{ISSUE_LABEL[k]}</span>
                <b>{summary.alerts[k]} ครั้ง</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink">ไม่มีท่าที่ต้องระวังเลยค่ะ 👍</p>
        )}
      </GlassCard>

      {!saved ? (
        <>
          <GlassCard className="space-y-4">
            <p className="font-semibold text-ink">
              หลังฝึก ปวดเข่าระดับไหนคะ {painBefore !== null && <span className="font-normal">(ก่อนฝึก {painBefore})</span>}
            </p>
            <PainPicker value={painAfter} onChange={setPainAfter} />
            <p className="font-semibold text-ink">รู้สึกอย่างไร</p>
            <Segmented options={options(FEELING_LABEL)} value={feeling} onChange={setFeeling} />
          </GlassCard>
          <PrimaryButton className="w-full" disabled={painAfter === null || busy} onClick={save}>
            {busy ? "กำลังบันทึก…" : "บันทึกผล"}
          </PrimaryButton>
        </>
      ) : (
        <>
          {!profile.settings.autoNotify && repo.mode === "supabase" && (
            <SecondaryButton className="w-full" disabled={busy} onClick={sendLine}>
              <Send size={20} /> ส่งผลให้ลูกหลานทาง LINE
            </SecondaryButton>
          )}
          <PrimaryButton className="w-full" onClick={() => navigate("/", { replace: true })}>
            <Home size={22} /> กลับหน้าหลัก
          </PrimaryButton>
        </>
      )}
      {message && <p className="text-center text-ink">{message}</p>}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard className="!p-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="text-2xl font-semibold text-ink">{value}</p>
    </GlassCard>
  );
}
