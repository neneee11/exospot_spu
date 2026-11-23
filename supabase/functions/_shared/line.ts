// ฟังก์ชันช่วยเรียก LINE Messaging API (ใช้ร่วมกันใน Edge Functions)

const LINE_API = "https://api.line.me/v2/bot/message";

function token() {
  const t = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!t) throw new Error("ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN");
  return t;
}

async function call(path: "push" | "reply", body: unknown) {
  const res = await fetch(`${LINE_API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LINE ${path} ${res.status}: ${await res.text()}`);
}

export const pushText = (to: string, text: string) => call("push", { to, messages: [{ type: "text", text }] });

export const replyText = (replyToken: string, text: string) =>
  call("reply", { replyToken, messages: [{ type: "text", text }] });

/** ตรวจลายเซ็น webhook ว่ามาจาก LINE จริง (HMAC-SHA256 ด้วย Channel secret) */
export async function verifySignature(body: string, signature: string) {
  const secret = Deno.env.get("LINE_CHANNEL_SECRET");
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return expected === signature;
}
