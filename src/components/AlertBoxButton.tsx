import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { STATE_COLOR } from "../config/messages";
import { ledBox, type BoxSnapshot, type BoxStatus } from "../io/serial";

const LABEL: Record<BoxStatus, string> = {
  unsupported: "เบราว์เซอร์นี้เชื่อมกล่องไม่ได้ (ใช้ Chrome/Edge บนคอม)",
  disconnected: "เชื่อมกล่องไฟ LED",
  connecting: "กำลังเชื่อมต่อ…",
  connected: "กล่องไฟพร้อม",
  unresponsive: "กล่องไฟไม่ตอบสนอง",
};

const LED_NAME = { G: "เขียว", Y: "เหลือง", R: "แดง", O: "ดับ" } as const;

export function useLedBox() {
  const [snap, setSnap] = useState<BoxSnapshot>(ledBox.snapshot);
  useEffect(() => ledBox.subscribe(setSnap), []);
  return snap;
}

const dotClass = (s: BoxStatus) =>
  s === "connected" ? "bg-ok" : s === "connecting" ? "bg-warn" : s === "unresponsive" ? "bg-danger" : "bg-white/70";

/** ปุ่มเชื่อม / แสดงสถานะกล่องไฟ ESP32 */
export function AlertBoxButton({ compact = false }: { compact?: boolean }) {
  const { status } = useLedBox();
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    if (status === "connected" || status === "unresponsive") return ledBox.disconnect();
    try {
      await ledBox.connect();
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotFoundError") return; // ผู้ใช้กดยกเลิก
      setError("เชื่อมต่อไม่สำเร็จ ลองปิด Serial Monitor ของ Arduino แล้วลองใหม่");
    }
  };

  if (compact) {
    return (
      <button
        onClick={onClick}
        disabled={status === "unsupported"}
        aria-label={LABEL[status]}
        title={LABEL[status]}
        className="relative grid h-14 w-14 place-items-center rounded-full border border-white/60 bg-white/15 text-ink"
      >
        <Lightbulb size={22} />
        <span className={`absolute right-2.5 top-2.5 h-3 w-3 rounded-full ${dotClass(status)}`} />
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={onClick}
        disabled={status === "unsupported" || status === "connecting"}
        className="flex min-h-14 w-full items-center gap-3 rounded-full bg-white/45 px-4 text-left disabled:opacity-60"
      >
        <span className={`h-3.5 w-3.5 rounded-full ${dotClass(status)}`} />
        <span className="flex-1 font-semibold text-ink">{LABEL[status]}</span>
        {(status === "connected" || status === "unresponsive") && (
          <span className="text-sm text-ink-soft">กดเพื่อตัดการเชื่อมต่อ</span>
        )}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

/** ไฟจำลองที่แสดงสถานะ "จริง" ตามที่ ESP32 รายงานกลับมา */
export function LedMirror() {
  const { status, led } = useLedBox();
  if (status !== "connected" && status !== "unresponsive") return null;
  return (
    <div className="flex items-center gap-3 rounded-full bg-white/45 px-4 py-2">
      <span className="text-ink-soft">ไฟบนกล่อง</span>
      <div className="flex gap-2">
        {(["G", "Y", "R"] as const).map((c) => (
          <span
            key={c}
            className="h-6 w-6 rounded-full border border-white/70 transition"
            style={{
              background: led === c ? STATE_COLOR[c] : "rgb(255 255 255 / .35)",
              boxShadow: led === c ? `0 0 12px ${STATE_COLOR[c]}` : undefined,
            }}
          />
        ))}
      </div>
      <span className="ml-auto font-semibold text-ink">
        {status === "unresponsive" ? "ไม่ตอบสนอง" : led ? LED_NAME[led] : "รอสัญญาณ…"}
      </span>
    </div>
  );
}
