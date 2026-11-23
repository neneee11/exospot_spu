import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { GlassCard, PageHeader, PainPicker, PrimaryButton, Segmented } from "../components/ui";
import {
  AID_LABEL,
  COMORBIDITY_OPTIONS,
  GROUP_LABEL,
  SEX_LABEL,
  SIDE_LABEL,
  options,
} from "../config/labels";
import { useData } from "../data/DataContext";
import { DEFAULT_SETTINGS } from "../data/defaults";
import type { ProfileInput } from "../data/types";

/** ค่าเริ่มต้นของฟอร์ม (ช่องตัวเลขว่างไว้ ให้ผู้ใช้กรอกเอง) */
const EMPTY: ProfileInput = {
  nickname: "",
  fullName: "",
  age: NaN,
  sex: "female",
  heightCm: NaN,
  weightKg: NaN,
  affectedSide: "both",
  group: "pre_op",
  surgeryDate: null,
  comorbidities: [],
  walkingAid: "none",
  baselinePain: 4,
  consentAt: "",
  settings: DEFAULT_SETTINGS,
};

/**
 * กรอกข้อมูลผู้ป่วย (ลูกหลานหรือนักกายภาพเป็นคนกรอก)
 * ใช้ทั้งตอนเริ่มใช้ครั้งแรก และตอนแก้ไขจากหน้าโปรไฟล์
 */
export default function Onboarding() {
  const { repo, profile, setProfile } = useData();
  const navigate = useNavigate();
  const editing = !!profile;
  const [form, setForm] = useState<ProfileInput>(profile ?? EMPTY);
  const [consent, setConsent] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const bmi = form.heightCm > 0 && form.weightKg > 0 ? form.weightKg / (form.heightCm / 100) ** 2 : null;

  const valid =
    form.nickname.trim() &&
    form.fullName.trim() &&
    form.age >= 40 &&
    form.heightCm > 0 &&
    form.weightKg > 0 &&
    (form.group === "pre_op" || form.surgeryDate) &&
    consent;

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await repo.saveProfile({ ...form, consentAt: form.consentAt || new Date().toISOString() });
      setProfile(saved);
      navigate(editing ? "/profile" : "/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[480px] px-5 pb-16 pt-4">
      <PageHeader title={editing ? "แก้ไขข้อมูล" : "ข้อมูลผู้ฝึก"} back={editing} />
      {!editing && (
        <p className="mb-4 text-ink-soft">
          ให้ลูกหลานหรือนักกายภาพช่วยกรอกข้อมูลครั้งแรก ระบบจะใช้ปรับคำแนะนำให้เหมาะกับผู้ฝึก
        </p>
      )}

      <div className="space-y-4">
        <GlassCard className="space-y-4">
          <Field label="ชื่อที่ให้แอปเรียก">
            <Input value={form.nickname} onChange={(v) => set("nickname", v)} placeholder="เช่น คุณยายสมศรี" />
          </Field>
          <Field label="ชื่อ-นามสกุล">
            <Input value={form.fullName} onChange={(v) => set("fullName", v)} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="อายุ (ปี)">
              <NumberInput value={form.age} onChange={(v) => set("age", v)} />
            </Field>
            <Field label="ส่วนสูง (ซม.)">
              <NumberInput value={form.heightCm} onChange={(v) => set("heightCm", v)} />
            </Field>
            <Field label="น้ำหนัก (กก.)">
              <NumberInput value={form.weightKg} onChange={(v) => set("weightKg", v)} />
            </Field>
          </div>
          {bmi && <p className="text-ink-soft">BMI {bmi.toFixed(1)}</p>}
          <Field label="เพศ">
            <Segmented options={options(SEX_LABEL)} value={form.sex} onChange={(v) => set("sex", v)} />
          </Field>
        </GlassCard>

        <GlassCard className="space-y-4">
          <Field label="ข้างที่เป็นข้อเข่าเสื่อม">
            <Segmented options={options(SIDE_LABEL)} value={form.affectedSide} onChange={(v) => set("affectedSide", v)} />
          </Field>
          <Field label="กลุ่ม">
            <Segmented options={options(GROUP_LABEL)} value={form.group} onChange={(v) => set("group", v)} />
          </Field>
          {form.group === "post_op" && (
            <Field label="วันที่ผ่าตัด">
              <input
                type="date"
                value={form.surgeryDate ?? ""}
                onChange={(e) => set("surgeryDate", e.target.value || null)}
                className="min-h-14 w-full rounded-2xl bg-white/70 px-4 text-lg text-ink outline-none"
              />
            </Field>
          )}
          <Field label="โรคประจำตัว (เลือกได้หลายข้อ)">
            <div className="flex flex-wrap gap-2">
              {COMORBIDITY_OPTIONS.map((c) => {
                const on = form.comorbidities.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() =>
                      set("comorbidities", on ? form.comorbidities.filter((x) => x !== c) : [...form.comorbidities, c])
                    }
                    className={`min-h-12 rounded-full border px-4 ${
                      on ? "border-white bg-white font-semibold text-ink" : "border-white/60 bg-white/10 text-ink"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="อุปกรณ์ช่วยเดิน">
            <Segmented options={options(AID_LABEL)} value={form.walkingAid} onChange={(v) => set("walkingAid", v)} />
          </Field>
          <Field label="ปกติปวดเข่าระดับไหน (0 = ไม่ปวด, 10 = ปวดมากที่สุด)">
            <PainPicker value={form.baselinePain} onChange={(v) => set("baselinePain", v)} />
          </Field>
        </GlassCard>

        {!editing && (
          <GlassCard>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-6 w-6 accent-[var(--color-ink)]"
              />
              <span className="text-ink">
                ยินยอมให้เก็บข้อมูลสุขภาพและผลการฝึกเพื่อติดตามความคืบหน้า และรับทราบว่า
                <b> ระบบไม่บันทึกและไม่ส่งภาพหรือวิดีโอจากกล้อง</b> ประมวลผลในเครื่องนี้เท่านั้น (PDPA)
              </span>
            </label>
          </GlassCard>
        )}

        {error && <p className="text-danger">{error}</p>}
        <PrimaryButton className="w-full" disabled={!valid || saving} onClick={submit}>
          {saving ? "กำลังบันทึก…" : editing ? "บันทึก" : "เริ่มใช้งาน"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-2 block font-semibold text-ink">{label}</span>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-14 w-full rounded-2xl bg-white/70 px-4 text-lg text-ink outline-none placeholder:text-ink-soft/60"
    />
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={Number.isNaN(value) ? "" : value}
      onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
      className="min-h-14 w-full rounded-2xl bg-white/70 px-4 text-lg text-ink outline-none"
    />
  );
}
