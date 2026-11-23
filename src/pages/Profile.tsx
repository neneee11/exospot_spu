import { Database, Link2, Megaphone, Mic, Pencil, Play, ShieldAlert, UserRound, Volume2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AlertBoxButton } from "../components/AlertBoxButton";
import { CircleButton, GlassCard, MenuRow, PageHeader, SectionTitle, Toggle } from "../components/ui";
import { GROUP_LABEL, SIDE_LABEL } from "../config/labels";
import { voiceCommandsSupported } from "../coach/commands";
import { Phrasebook } from "../coach/nlg";
import { PERSONAS, type PersonaId } from "../coach/personas";
import { useData } from "../data/DataContext";
import { voice } from "../io/voice";
import type { ProfileSettings } from "../data/types";

export default function Profile() {
  const { repo, profile, plan, setProfile } = useData();
  const navigate = useNavigate();
  if (!profile || !plan) return null;

  const updateSetting = async <K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) => {
    const { id: _id, lineLinkCode: _c, caregiverLinked: _l, ...input } = profile;
    setProfile(await repo.saveProfile({ ...input, settings: { ...profile.settings, [key]: value } }));
  };

  const lineOa = import.meta.env.VITE_LINE_OA_ID;

  return (
    <>
      <PageHeader
        title="โปรไฟล์"
        back={false}
        right={
          <CircleButton aria-label="แก้ไขข้อมูล" onClick={() => navigate("/profile/edit")}>
            <Pencil size={22} />
          </CircleButton>
        }
      />

      {/* ---------- การ์ดผู้ใช้ ---------- */}
      <GlassCard strong>
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-ink text-3xl font-semibold text-white">
            {profile.nickname.trim().charAt(0)}
          </div>
          <div>
            <p className="text-2xl font-semibold text-ink">{profile.nickname}</p>
            <p className="text-ink-soft">{GROUP_LABEL[profile.group]}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <InfoTile label="อายุ" value={profile.age} unit="ปี" />
          <InfoTile label="ส่วนสูง" value={profile.heightCm} unit="ซม." />
          <InfoTile label="น้ำหนัก" value={profile.weightKg} unit="กก." />
        </div>
      </GlassCard>

      {/* ---------- ตั้งค่า ---------- */}
      <SectionTitle>ตั้งค่าบัญชี</SectionTitle>
      <GlassCard className="space-y-2 !p-3">
        <MenuRow icon={<UserRound size={20} />} label="ข้อมูลส่วนตัว" onClick={() => navigate("/profile/edit")} />
        <MenuRow
          icon={<Volume2 size={20} />}
          label="โค้ชเสียงพูด"
          right={<Toggle label="โค้ชเสียงพูด" checked={profile.settings.voice} onChange={(v) => updateSetting("voice", v)} />}
        />
        <MenuRow
          icon={<Mic size={20} />}
          label="สั่งงานด้วยเสียง"
          hint={
            voiceCommandsSupported
              ? "พูดว่า เริ่ม / พัก / ต่อ / จบ (เสียงถูกส่งไปแปลงข้อความที่ Google)"
              : "เบราว์เซอร์นี้ไม่รองรับ ใช้ Chrome"
          }
          right={
            <Toggle
              label="สั่งงานด้วยเสียง"
              checked={profile.settings.voiceCommands}
              onChange={(v) => updateSetting("voiceCommands", v && voiceCommandsSupported)}
            />
          }
        />
      </GlassCard>

      <SectionTitle>บุคลิกโค้ชเสียง</SectionTitle>
      <GlassCard className="space-y-2 !p-3">
        {(Object.keys(PERSONAS) as PersonaId[]).map((id) => {
          const p = PERSONAS[id];
          const selected = profile.settings.persona === id;
          return (
            <div
              key={id}
              className={`flex min-h-16 items-center gap-3 rounded-full px-3 py-2 ${selected ? "bg-white" : "bg-white/35"}`}
            >
              <button className="flex flex-1 items-center gap-3 text-left" onClick={() => updateSetting("persona", id)}>
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full border-2 ${selected ? "border-ink" : "border-white"}`}
                >
                  {selected && <span className="h-3.5 w-3.5 rounded-full bg-ink" />}
                </span>
                <span>
                  <span className="block font-semibold text-ink">{p.label}</span>
                  <span className="block text-sm text-ink-soft">{p.description}</span>
                </span>
              </button>
              <button
                aria-label={`ลองฟังเสียง ${p.label}`}
                onClick={() => {
                  voice.enabled = true;
                  voice.setPersona(id);
                  voice.say(new Phrasebook(id).say("sample"));
                }}
                className="grid h-11 w-11 place-items-center rounded-full bg-ink text-white"
              >
                <Play size={18} fill="currentColor" />
              </button>
            </div>
          );
        })}
      </GlassCard>

      <SectionTitle>การฝึก</SectionTitle>
      <GlassCard className="space-y-2 !p-3">
        <MenuRow
          icon={<ShieldAlert size={20} />}
          label="จุดที่ต้องระวัง"
          hint={`${SIDE_LABEL[profile.affectedSide]} · เกณฑ์${plan.approvedBy ? `โดย ${plan.approvedBy}` : "ค่าเริ่มต้น"}`}
          onClick={() => navigate("/safety")}
        />
        <AlertBoxButton />
      </GlassCard>

      {/* ---------- ลูกหลาน / LINE ---------- */}
      <SectionTitle>ลูกหลาน (LINE)</SectionTitle>
      <GlassCard className="space-y-3 !p-3">
        <MenuRow
          icon={<Link2 size={20} />}
          label={profile.caregiverLinked ? "เชื่อม LINE ลูกหลานแล้ว" : "ยังไม่ได้เชื่อม LINE ลูกหลาน"}
          hint={
            profile.caregiverLinked
              ? undefined
              : `เพิ่มเพื่อน ${lineOa ?? "LINE OA"} แล้วพิมพ์รหัส ${profile.lineLinkCode}`
          }
        />
        <MenuRow
          icon={<Megaphone size={20} />}
          label="ส่งสรุปผลอัตโนมัติ"
          right={
            <Toggle label="ส่งสรุปผลอัตโนมัติ" checked={profile.settings.autoNotify} onChange={(v) => updateSetting("autoNotify", v)} />
          }
        />
      </GlassCard>

      <p className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-soft">
        <Database size={16} />
        {repo.mode === "supabase" ? "บันทึกข้อมูลบน Supabase" : "บันทึกข้อมูลในเครื่องนี้ (ยังไม่ได้ตั้งค่า Supabase)"}
      </p>
    </>
  );
}

function InfoTile({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-3xl bg-white/45 py-3 text-center">
      <p className="text-ink-soft">{label}</p>
      <p className="text-ink">
        <span className="text-2xl font-semibold">{value}</span> <span className="text-sm">{unit}</span>
      </p>
    </div>
  );
}
