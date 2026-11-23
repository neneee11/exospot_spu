// ส่งสรุปผลการฝึกให้ลูกหลานทาง LINE
// เรียกจากแอปหลังบันทึก session: supabase.functions.invoke("notify-line", { body: { sessionId } })
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { pushText } from "../_shared/line.ts";

const ISSUE_LABEL: Record<string, string> = {
  valgus: "เข่าบิดเข้าใน",
  tooFast: "นั่งลงเร็ว",
  asymmetry: "ลงน้ำหนักไม่เท่ากัน",
  overFlex: "งอเข่าลึกเกิน",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { sessionId } = await req.json();
    if (!sessionId) return json({ ok: false, message: "ไม่มี sessionId" }, 400);

    // ใช้สิทธิ์ของผู้ใช้ที่เรียก (RLS บังคับว่าอ่านได้เฉพาะข้อมูลตัวเอง)
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data: s, error } = await db.from("sessions").select("*").eq("id", sessionId).single();
    if (error || !s) return json({ ok: false, message: "ไม่พบข้อมูลการฝึก" }, 404);

    const { data: p } = await db
      .from("profiles")
      .select("nickname, caregiver_line_user_id")
      .eq("id", s.user_id)
      .single();
    if (!p?.caregiver_line_user_id) {
      return json({ ok: false, message: "ลูกหลานยังไม่ได้เชื่อม LINE (ดูรหัสเชื่อมในหน้าโปรไฟล์)" });
    }

    const issues = Object.entries(s.alerts as Record<string, number>)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${ISSUE_LABEL[k] ?? k} ${n} ครั้ง`);

    const lines = [
      `🦵 ExoSpot: ${p.nickname}ฝึก "ลุกจากเก้าอี้" ${s.completed_reps}/${s.target_reps} ครั้ง`,
      `ท่าถูก ${s.correct_percent}%`,
      issues.length ? `ควรระวัง: ${issues.join(", ")}` : "ไม่มีท่าที่ต้องระวัง 👍",
    ];
    if (s.pain_before !== null && s.pain_after !== null) {
      lines.push(`ความปวด ก่อน ${s.pain_before} → หลัง ${s.pain_after} (เต็ม 10)`);
    }
    if ((s.pain_after ?? 0) >= 7) lines.push("⚠️ ปวดค่อนข้างมาก แนะนำให้ปรึกษานักกายภาพค่ะ");

    await pushText(p.caregiver_line_user_id, lines.join("\n"));
    return json({ ok: true, message: "ส่งสรุปผลให้ลูกหลานทาง LINE แล้ว" });
  } catch (e) {
    console.error(e);
    return json({ ok: false, message: "ส่ง LINE ไม่สำเร็จ" }, 500);
  }
});
