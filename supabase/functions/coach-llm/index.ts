// โค้ชเสียง: ให้ LLM แต่งประโยคทักทายก่อนฝึก และสรุปผลหลังฝึก ให้เป็นธรรมชาติและไม่ซ้ำเดิม
// แอปส่งมาเฉพาะตัวเลข (ไม่มีชื่อหรือข้อมูลระบุตัวตน) แล้วแอปแทน {name} เองฝั่งเครื่อง
// ต้องตั้ง secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
import { corsHeaders, json } from "../_shared/cors.ts";

const MODEL = Deno.env.get("COACH_MODEL") ?? "claude-haiku-5-5";

const PERSONA: Record<string, string> = {
  warm: "หลานสาวใจดี พูดนุ่มนวล อบอุ่น ใช้คำลงท้าย 'ค่ะ' แทนตัวเองว่า 'หนู'",
  coach: "โค้ชฟิตเนสสายเชียร์ กระตือรือร้น ปลุกพลัง ใช้คำลงท้าย 'ครับ' แทนตัวเองว่า 'ผม'",
  fun: "เพื่อนขี้เล่น มีมุกเบาๆ ชวนยิ้ม สุภาพกับผู้สูงอายุ ใช้คำลงท้าย 'ค่ะ'",
};

const TASK: Record<string, string> = {
  greeting:
    "แต่งคำทักทายก่อนเริ่มฝึกท่าลุกจากเก้าอี้ ถ้ามีผลการฝึกครั้งก่อนให้พูดถึงสั้นๆ อย่างให้กำลังใจ",
  summary:
    "แต่งคำสรุปผลหลังฝึกท่าลุกจากเก้าอี้ ชมสิ่งที่ทำได้ดี และให้คำแนะนำ 1 ข้อจากท่าที่ผิดบ่อยที่สุด (ถ้ามี)",
};

const SYSTEM = `คุณคือโค้ชเสียงในแอปช่วยผู้สูงอายุข้อเข่าเสื่อมทำกายภาพที่บ้าน ข้อความของคุณจะถูกอ่านออกเสียงด้วย Text-to-Speech ภาษาไทย
กติกา:
- ตอบเป็นภาษาไทยภาษาพูด ยาวไม่เกิน 2 ประโยค และไม่เกิน 35 คำ
- เรียกผู้ฝึกด้วย {name} เท่านั้น (ห้ามเดาชื่อ)
- ห้ามใช้อีโมจิ สัญลักษณ์ หรือ markdown
- ห้ามวินิจฉัยโรค ห้ามแนะนำยา ห้ามสัญญาผลการรักษา
- ถ้าคะแนนปวดหลังฝึกตั้งแต่ 7 ขึ้นไป ให้แนะนำพักและปรึกษานักกายภาพ
- ตอบเฉพาะข้อความที่จะพูด ไม่ต้องอธิบายเพิ่ม`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { kind, persona, facts } = await req.json();
    if (!TASK[kind]) return json({ error: "unknown kind" }, 400);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not set" }, 500);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `บุคลิก: ${PERSONA[persona] ?? PERSONA.warm}\nงาน: ${TASK[kind]}\nข้อมูล (JSON): ${JSON.stringify(facts ?? {})}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const text = (data.content ?? [])
      .filter((c: { type: string }) => c.type === "text")
      .map((c: { text: string }) => c.text)
      .join(" ")
      .replace(/[*_#`>]/g, "")
      .trim()
      .slice(0, 300);

    return json({ text });
  } catch (e) {
    console.error(e);
    return json({ error: "coach failed" }, 500);
  }
});
