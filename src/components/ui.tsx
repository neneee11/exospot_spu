import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PAIN_FACES } from "../config/messages";

/* ---------- การ์ดกระจกฝ้า ---------- */
export function GlassCard({
  children,
  className = "",
  strong = false,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return <div className={`${strong ? "glass-strong" : "glass"} rounded-[28px] p-5 ${className}`}>{children}</div>;
}

/* ---------- ปุ่มวงกลมโปร่ง (ปุ่มย้อนกลับ / แก้ไข) ---------- */
export function CircleButton({ children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border border-white/60 bg-white/15 text-ink backdrop-blur transition active:scale-95 ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------- หัวหน้าเพจ: ปุ่มย้อน + ชื่อ + ปุ่มขวา ---------- */
export function PageHeader({ title, right, back = true }: { title: string; right?: ReactNode; back?: boolean }) {
  const navigate = useNavigate();
  return (
    <header className="flex items-center justify-between gap-3 pb-4 pt-2">
      {back ? (
        <CircleButton aria-label="ย้อนกลับ" onClick={() => navigate(-1)}>
          <ChevronLeft size={26} />
        </CircleButton>
      ) : (
        <span className="w-14" />
      )}
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      {right ?? <span className="w-14" />}
    </header>
  );
}

/* ---------- ปุ่มหลัก ---------- */
export function PrimaryButton({ children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`flex min-h-14 items-center justify-center gap-2 rounded-full bg-ink px-6 text-lg font-semibold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`flex min-h-14 items-center justify-center gap-2 rounded-full bg-white/80 px-6 text-lg font-semibold text-ink transition active:scale-[0.98] disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------- วงแหวน progress สีส้ม ---------- */
export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  children,
}: {
  value: number; // 0–1
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / .6)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-flame)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/* ---------- ป้ายเล็กสีเข้ม (Good / Average) ---------- */
export function Badge({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap rounded-full bg-ink px-3 py-1 text-sm text-white">{children}</span>;
}

/* ---------- แถวเมนูในหน้าโปรไฟล์ ---------- */
export function MenuRow({
  icon,
  label,
  onClick,
  right,
  hint,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  right?: ReactNode;
  hint?: string;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-4 rounded-full bg-white/35 px-3 py-2 text-left transition active:bg-white/50"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/50 text-ink-soft">{icon}</span>
      <span className="flex-1">
        <span className="block font-semibold text-ink">{label}</span>
        {hint && <span className="block text-sm text-ink-soft">{hint}</span>}
      </span>
      {right ?? (onClick && <ChevronRight className="mr-2 text-ink" />)}
    </Comp>
  );
}

/* ---------- Toggle ---------- */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-9 w-16 rounded-full transition ${checked ? "bg-white" : "bg-white/40"}`}
    >
      <span
        className={`absolute top-1 h-7 w-7 rounded-full transition-all ${checked ? "left-8 bg-ink" : "left-1 bg-white"}`}
      />
    </button>
  );
}

/* ---------- เลือกคะแนนปวด 0–10 ---------- */
export function PainPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const options = [0, 2, 4, 6, 8, 10];
  return (
    <div className="grid grid-cols-6 gap-2">
      {options.map((v, i) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex flex-col items-center rounded-2xl py-2 transition ${
            value === v ? "bg-ink text-white" : "bg-white/50 text-ink"
          }`}
        >
          <span className="text-3xl">{PAIN_FACES[i]}</span>
          <span className="text-base font-semibold">{v}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- เลือก 1 ตัวเลือก (แบบปุ่มแคปซูล) ---------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex min-h-12 items-center gap-2 rounded-full border px-4 transition ${
            value === o.value ? "border-white bg-white font-semibold text-ink" : "border-white/60 bg-white/10 text-ink"
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-end justify-between">
      <h2 className="text-xl font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-3xl bg-white/30 p-5 text-center text-ink-soft">{children}</p>;
}
