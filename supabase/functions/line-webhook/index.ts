// Webhook ของ LINE OA: ให้ลูกหลานเชื่อมบัญชีด้วยการพิมพ์รหัส 6 หลักจากหน้าโปรไฟล์ในแอป
// ตั้งค่า Webhook URL ใน LINE Developers: https://<project>.supabase.co/functions/v1/line-webhook
// deploy ด้วย: supabase functions deploy line-webhook --no-verify-jwt
import { createClient } from "jsr:@supabase/supabase-js@2";
import { replyText, verifySignature } from "../_shared/line.ts";

const HELP = "สวัสดีค่ะ 🙏 พิมพ์รหัส 6 หลักจากหน้าโปรไฟล์ในแอป ExoSpot เพื่อรับสรุปผลการฝึกของผู้สูงอายุในบ้าน\nเช่น: 123456";

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
}

Deno.serve(async (req) => {
  const body = await req.text();
  if (!(await verifySignature(body, req.headers.get("x-line-signature") ?? ""))) {
    return new Response("invalid signature", { status: 401 });
  }

  // ใช้ service role เพราะต้องค้นหาโปรไฟล์จากรหัส (ผู้ส่งไม่ได้ login ใน Supabase)
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { events = [] } = JSON.parse(body) as { events?: LineEvent[] };

  for (const ev of events) {
    if (!ev.replyToken) continue;
    try {
      if (ev.type === "follow") {
        await replyText(ev.replyToken, HELP);
        continue;
      }
      if (ev.type !== "message" || ev.message?.type !== "text") continue;

      const code = ev.message.text?.match(/\b(\d{6})\b/)?.[1];
      if (!code || !ev.source?.userId) {
        await replyText(ev.replyToken, HELP);
        continue;
      }

      const { data } = await admin
        .from("profiles")
        .update({ caregiver_line_user_id: ev.source.userId })
        .eq("line_link_code", code)
        .select("nickname")
        .maybeSingle();

      await replyText(
        ev.replyToken,
        data
          ? `เชื่อมบัญชีกับ ${data.nickname} เรียบร้อยแล้วค่ะ ✅\nจากนี้จะได้รับสรุปผลทุกครั้งที่ฝึกเสร็จ`
          : "ไม่พบรหัสนี้ค่ะ ลองตรวจรหัสในหน้าโปรไฟล์ของแอปอีกครั้ง",
      );
    } catch (e) {
      console.error(e);
    }
  }
  return new Response("ok");
});
