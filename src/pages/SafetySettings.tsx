import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassCard, PageHeader, PrimaryButton, SecondaryButton, SectionTitle } from "../components/ui";
import { DEFAULT_THRESHOLDS, THRESHOLD_FIELDS, type Thresholds } from "../config/thresholds";
import { useData } from "../data/DataContext";
import type { ExercisePlan } from "../data/types";

/**
 * หน้าสำหรับนักกายภาพ: ตั้งโปรแกรมและเกณฑ์ความปลอดภัยรายบุคคล (Human-in-the-loop)
 */
export default function SafetySettings() {
  const { repo, plan, profile, setPlan } = useData();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ExercisePlan | null>(plan);
  const [saving, setSaving] = useState(false);
  if (!draft || !profile) return null;

  const setTh = <K extends keyof Thresholds>(k: K, v: Thresholds[K]) =>
    setDraft({ ...draft, thresholds: { ...draft.thresholds, [k]: v } });

  const save = async () => {
    setSaving(true);
    try {
      setPlan(await repo.savePlan(draft));
      navigate(-1);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[480px] px-5 pb-16 pt-4">
      <PageHeader title="จุดที่ต้องระวัง" />
      <p className="mb-4 text-ink-soft">
        สำหรับนักกายภาพ: ปรับโปรแกรมและเกณฑ์ให้เหมาะกับผู้ฝึกแต่ละคน AI จะตรวจท่าตามเกณฑ์นี้
      </p>

      <SectionTitle>โปรแกรมฝึก</SectionTitle>
      <GlassCard className="grid grid-cols-3 gap-3">
        <NumberField label="ครั้ง/เซต" value={draft.targetReps} min={1} max={50} onChange={(v) => setDraft({ ...draft, targetReps: v })} />
        <NumberField label="เซต" value={draft.sets} min={1} max={10} onChange={(v) => setDraft({ ...draft, sets: v })} />
        <NumberField label="รอบ/วัน" value={draft.perDay} min={1} max={6} onChange={(v) => setDraft({ ...draft, perDay: v })} />
      </GlassCard>

      <SectionTitle>เกณฑ์ความปลอดภัย</SectionTitle>
      <GlassCard className="space-y-5">
        {THRESHOLD_FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="flex justify-between text-ink">
              <span>{f.label}</span>
              <b>
                {draft.thresholds[f.key]} {f.unit}
              </b>
            </span>
            <input
              type="range"
              min={f.min}
              max={f.max}
              step={f.step}
              value={draft.thresholds[f.key] as number}
              onChange={(e) => setTh(f.key, Number(e.target.value))}
              className="mt-2 w-full accent-[var(--color-ink)]"
            />
          </label>
        ))}

        {profile.group === "post_op" && (
          <label className="block">
            <span className="text-ink">มุมเข่าต่ำสุดที่แพทย์อนุญาต (ผู้ผ่าตัดแล้ว)</span>
            <input
              type="number"
              placeholder="ไม่จำกัด"
              value={draft.thresholds.minKneeAngle ?? ""}
              onChange={(e) => setTh("minKneeAngle", e.target.value === "" ? null : Number(e.target.value))}
              className="mt-2 min-h-14 w-full rounded-2xl bg-white/70 px-4 text-lg text-ink outline-none"
            />
          </label>
        )}
      </GlassCard>

      <SectionTitle>ผู้อนุมัติเกณฑ์</SectionTitle>
      <GlassCard>
        <input
          value={draft.approvedBy ?? ""}
          placeholder="ชื่อนักกายภาพ"
          onChange={(e) => setDraft({ ...draft, approvedBy: e.target.value || null })}
          className="min-h-14 w-full rounded-2xl bg-white/70 px-4 text-lg text-ink outline-none"
        />
      </GlassCard>

      <div className="mt-6 space-y-3">
        <PrimaryButton className="w-full" disabled={saving} onClick={save}>
          บันทึก
        </PrimaryButton>
        <SecondaryButton
          className="w-full"
          onClick={() => setDraft({ ...draft, thresholds: { ...DEFAULT_THRESHOLDS } })}
        >
          <RotateCcw size={20} /> คืนค่าเริ่มต้น
        </SecondaryButton>
      </div>
    </div>
  );
}

function NumberField(props: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-center">
      <span className="text-sm text-ink-soft">{props.label}</span>
      <input
        type="number"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(e) => props.onChange(Math.min(props.max, Math.max(props.min, Number(e.target.value) || props.min)))}
        className="mt-1 min-h-14 w-full rounded-2xl bg-white/70 text-center text-2xl font-semibold text-ink outline-none"
      />
    </label>
  );
}
