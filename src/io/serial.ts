/**
 * เชื่อมกล่องไฟ LED (ESP32) ผ่าน Web Serial (USB, 115200 baud)
 *
 * แอป → ESP32 (1 ตัวอักษร)
 *   G = เขียว, Y = เหลือง, R = แดงกะพริบ, O = ดับ
 *   C = ไฟกะพริบฉลองเมื่อนับครั้งได้, P = ขอสถานะ
 *   ส่งเมื่อสถานะเปลี่ยน + ส่งซ้ำทุก 1 วินาที (heartbeat)
 *
 * ESP32 → แอป (บรรทัดละข้อความ)
 *   READY, LED:<G|Y|R|O> (ACK ทุกคำสั่ง), TIMEOUT
 *   แอปใช้ LED:x แสดง "ไฟจริงบนกล่อง" และตรวจว่ากล่องยังตอบสนองไหม
 */
export type LedState = "G" | "Y" | "R" | "O";
export type BoxStatus = "unsupported" | "disconnected" | "connecting" | "connected" | "unresponsive";

export interface BoxSnapshot {
  status: BoxStatus;
  /** สถานะไฟที่ ESP32 รายงานกลับมาล่าสุด (null = ยังไม่เคยได้รับ) */
  led: LedState | null;
  /** เวลา (performance.now) ที่ได้รับ ACK ล่าสุด */
  lastAck: number | null;
}

type Listener = (s: BoxSnapshot) => void;

const HEARTBEAT_MS = 1000;
/** ไม่ได้รับ ACK นานเกินนี้ = กล่องไม่ตอบสนอง */
const ACK_TIMEOUT_MS = 2500;

class LedBox {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private encoder = new TextEncoder();
  private wanted: LedState = "O";
  private heartbeat: number | null = null;
  private listeners = new Set<Listener>();
  private snap: BoxSnapshot = {
    status: "serial" in navigator ? "disconnected" : "unsupported",
    led: null,
    lastAck: null,
  };

  get snapshot() {
    return this.snap;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.snap);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private update(patch: Partial<BoxSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((fn) => fn(this.snap));
  }

  /** ต้องเรียกจากการกดปุ่มเท่านั้น (เบราว์เซอร์บังคับ) */
  async connect() {
    if (!("serial" in navigator) || this.port) return;
    this.update({ status: "connecting" });
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      this.port = port;
      this.writer = port.writable!.getWriter();
      this.update({ status: "connected", led: null, lastAck: null });
      navigator.serial.addEventListener("disconnect", this.handleUnplug);
      void this.readLoop(port);
      this.heartbeat = window.setInterval(this.tick, HEARTBEAT_MS);
      void this.write("P");
    } catch (err) {
      this.port = null;
      this.update({ status: "disconnected" });
      throw err;
    }
  }

  async disconnect() {
    await this.write("O");
    this.cleanup();
    try {
      await this.port?.close();
    } catch {
      /* พอร์ตอาจถูกถอดไปแล้ว */
    }
    this.port = null;
    this.update({ status: "disconnected", led: null });
  }

  /** ตั้งสถานะไฟ (ส่งทันทีเมื่อเปลี่ยน) */
  setState(led: LedState) {
    if (led === this.wanted) return;
    this.wanted = led;
    void this.write(led);
  }

  /** ไฟกะพริบฉลองเมื่อนับครั้งได้ */
  celebrate() {
    void this.write("C");
  }


  /** ส่ง heartbeat และตรวจว่ากล่องยังตอบอยู่ไหม */
  private tick = () => {
    void this.write(this.wanted);
    const { lastAck, status } = this.snap;
    const silent = lastAck === null || performance.now() - lastAck > ACK_TIMEOUT_MS;
    if (silent && status === "connected") this.update({ status: "unresponsive" });
  };

  private handleLine(line: string) {
    const m = line.match(/^LED:([GYRO])$/);
    if (m) {
      this.update({ led: m[1] as LedState, lastAck: performance.now(), status: "connected" });
    } else if (line === "READY") {
      // ESP32 เพิ่งรีเซ็ต (เกิดทุกครั้งที่เปิดพอร์ต) → ส่งสถานะปัจจุบันให้ใหม่
      void this.write(this.wanted);
    }
  }

  private handleUnplug = (e: Event) => {
    if ((e.target as SerialPort) !== this.port) return;
    this.cleanup();
    this.port = null;
    this.update({ status: "disconnected", led: null });
  };

  private cleanup() {
    if (this.heartbeat !== null) clearInterval(this.heartbeat);
    this.heartbeat = null;
    try {
      this.writer?.releaseLock();
    } catch {
      /* ignore */
    }
    this.writer = null;
    navigator.serial?.removeEventListener("disconnect", this.handleUnplug);
  }

  private async write(cmd: string) {
    if (!this.writer) return;
    try {
      await this.writer.write(this.encoder.encode(cmd));
    } catch {
      /* สายหลุดระหว่างส่ง – handleUnplug จะจัดการต่อ */
    }
  }

  private async readLoop(port: SerialPort) {
    const decoder = new TextDecoder();
    let buffer = "";
    while (port.readable && this.port === port) {
      const reader = port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value);
          let i: number;
          while ((i = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, i).trim();
            buffer = buffer.slice(i + 1);
            if (line) this.handleLine(line);
          }
        }
      } catch {
        break;
      } finally {
        reader.releaseLock();
      }
    }
  }
}

/** ใช้ตัวเดียวทั้งแอป เพื่อให้การเชื่อมต่อค้างไว้ข้ามหน้า */
export const ledBox = new LedBox();
