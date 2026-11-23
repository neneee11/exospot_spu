# ExoSpot – ระบบฝึกกายภาพเข่าที่บ้านด้วย AI

ระบบช่วยผู้สูงอายุข้อเข่าเสื่อมทำกายภาพท่า **ลุกจากเก้าอี้ (Sit-to-Stand)** ที่บ้าน โดยไม่ต้องใส่อุปกรณ์
ใช้กล้องตรวจจับข้อต่อ (MediaPipe Pose) คำนวณมุมเข่า ตรวจท่าเสี่ยง แล้วเตือนทันทีด้วย **โค้ชเสียงพูดภาษาไทย (NLP)** และ **กล่องไฟ LED ESP32** (ไม่มี buzzer)
จบการฝึกแล้วบันทึกผลและส่งสรุปให้ลูกหลานทาง LINE

```
กล้อง → MediaPipe (33 จุด) → มุมเข่า / เข่าบิด / ความเร็ว / น้ำหนักซ้าย-ขวา → นับครั้ง → G/Y/R
     → จอ + โค้ชเสียง (NLP) + กล่องไฟ LED ⇄ รายงานสถานะไฟกลับ (real-time)
     → จบ session → Supabase → LINE ลูกหลาน
```

---

## โครงสร้างโปรเจกต์

```
exospot/
├─ src/
│  ├─ config/           ค่าที่แก้บ่อย: เกณฑ์ความปลอดภัย, ท่าฝึก, ข้อความเสียง, ป้ายภาษาไทย
│  ├─ pose/             AI pipeline
│  │  ├─ landmarker.ts      โหลดโมเดล MediaPipe + เปิดกล้อง
│  │  ├─ geometry.ts        คำนวณมุมเข่า 3D, valgus ratio
│  │  ├─ filters.ts         One Euro Filter (ลดสั่น), Debouncer (กันเตือนมั่ว)
│  │  ├─ sitToStand.ts      Analyzer: quality gate → features → กฎความเสี่ยง → นับครั้ง
│  │  ├─ session.ts         รวมผลเป็น session summary
│  │  ├─ draw.ts            วาดโครงกระดูกบน canvas
│  │  ├─ usePoseSession.ts  React hook รวมทุกอย่างของหน้าฝึก
│  │  └─ __tests__/         unit test ของ Analyzer
│  ├─ coach/            โค้ชเสียง (NLP)
│  │  ├─ personas.ts        บุคลิก 3 แบบ + คลังประโยค
│  │  ├─ nlg.ts             เลือกประโยคไม่ซ้ำ + เติมค่า {name} {n} ...
│  │  ├─ coach.ts           ตัดสินใจว่าจะพูดอะไรเมื่อไหร่ (นับ/เตือน/ชม/สรุป)
│  │  └─ commands.ts        สั่งงานด้วยเสียง: Speech-to-Text + จับคำสั่ง
│  ├─ io/
│  │  ├─ serial.ts          เชื่อมกล่องไฟ LED ผ่าน Web Serial (ส่ง-รับ 2 ทาง)
│  │  └─ voice.ts           Text-to-Speech ภาษาไทย + ลำดับความสำคัญของเสียง
│  ├─ data/             ชั้นข้อมูล (สลับ localStorage ↔ Supabase อัตโนมัติ)
│  │  ├─ types.ts           โครงข้อมูล + interface Repository
│  │  ├─ localRepo.ts       เก็บในเครื่อง (ใช้ตอนยังไม่ตั้งค่า Supabase)
│  │  ├─ supabaseRepo.ts    เก็บบน Supabase
│  │  ├─ stats.ts           คำนวณสถิติรายวัน / แนวโน้ม
│  │  └─ DataContext.tsx    React context + hook useSessions
│  ├─ components/       UI ที่ใช้ซ้ำ (การ์ดกระจก, เมนูล่าง, วงแหวน, ปุ่ม)
│  └─ pages/            หน้าจอ: Onboarding, Home, Program, Session, Summary, Statistic, Profile, SafetySettings
├─ supabase/
│  ├─ migrations/       SQL สร้างตาราง + Row Level Security
│  └─ functions/
│     ├─ coach-llm/         ให้ LLM (Claude) แต่งคำทักทาย / สรุปผลของโค้ช
│     ├─ notify-line/       ส่งสรุปผลให้ลูกหลานทาง LINE
│     └─ line-webhook/      ให้ลูกหลานเชื่อมบัญชีด้วยรหัส 6 หลัก
├─ firmware/exo_alert_box/  โค้ด Arduino ของกล่องไฟ LED ESP32
└─ docs/                    เอกสาร pipeline (AI / Hardware / Application / Tech stack / Voice coach)
```

ไม่มีข้อมูลตัวอย่างฝังในโค้ด ทุกหน้าดึงจากฐานข้อมูลจริง ถ้ายังไม่มีข้อมูลจะแสดงข้อความว่างแทน

---

## 1. รันบนเครื่อง (ไม่ต้องตั้งค่าอะไร)

ต้องมี Node.js 20 ขึ้นไป

```bash
npm install
npm run dev          # เปิด http://localhost:5173 ด้วย Chrome หรือ Edge
npm test             # รัน unit test ของ AI analyzer และโค้ชเสียง
npm run build        # build สำหรับ deploy
```

ถ้ายังไม่มีไฟล์ `.env.local` แอปจะใช้ **โหมดบันทึกในเครื่อง** (localStorage) ใช้เดโมได้ครบ ยกเว้นการส่ง LINE

> กล้องและ Web Serial ใช้ได้บน `localhost` หรือ `https://` เท่านั้น และ Web Serial รองรับเฉพาะ Chrome / Edge บนคอม

---

## 2. Database: Supabase (PostgreSQL)

**เหตุผลที่เลือก:** เป็น PostgreSQL จริง มี Auth, Row Level Security, Realtime และ Edge Functions ในที่เดียว และ free tier พอสำหรับ hackathon

1. สมัครที่ https://supabase.com → New project (เลือก region Singapore)
2. **Authentication → Sign In / Providers → เปิด "Allow anonymous sign-ins"**
   (ผู้สูงอายุไม่ต้องสมัครสมาชิก ระบบสร้างบัญชีให้อัตโนมัติต่อเครื่อง)
3. **SQL Editor** → วางเนื้อหาไฟล์ `supabase/migrations/20261123000000_init.sql` → Run
4. **Project Settings → API** → คัดลอก `Project URL` และ `anon public key`
5. สร้างไฟล์ `.env.local` จาก `.env.example` แล้วใส่ค่า

ตารางที่ได้:

- `profiles` ข้อมูลผู้ป่วย, รหัสเชื่อม LINE, การตั้งค่า
- `exercise_plans` โปรแกรมและเกณฑ์ความปลอดภัยจากนักกายภาพ
- `sessions` ผลการฝึกแต่ละรอบ
- `rep_events` รายละเอียดรายครั้ง

ทุกตารางเปิด RLS ให้แต่ละคนเห็นเฉพาะข้อมูลตัวเอง **ไม่มีการเก็บภาพหรือวิดีโอ**

---

## 3. LINE Messaging API (แจ้งลูกหลาน)

> LINE Notify ปิดบริการแล้ว ต้องใช้ LINE Official Account + Messaging API

1. https://developers.line.biz → Create provider → **Create a Messaging API channel** (จะได้ LINE OA มาด้วย)
2. แท็บ **Basic settings** → คัดลอก `Channel secret`
3. แท็บ **Messaging API** → Issue `Channel access token (long-lived)` และจด `Basic ID` (เช่น `@123abcde`) ใส่ใน `VITE_LINE_OA_ID`
4. ใน LINE Official Account Manager → ปิด **Auto-reply messages** และเปิด **Webhooks**
5. Deploy Edge Functions (ต้องติดตั้ง [Supabase CLI](https://supabase.com/docs/guides/cli)):

```bash
supabase login
supabase link --project-ref <project-ref>
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=xxx LINE_CHANNEL_SECRET=yyy
supabase functions deploy notify-line
supabase functions deploy line-webhook --no-verify-jwt
```

6. กลับไปแท็บ Messaging API → **Webhook URL** = `https://<project-ref>.supabase.co/functions/v1/line-webhook` → Verify → เปิด Use webhook

**วิธีที่ลูกหลานเชื่อมบัญชี:** เพิ่มเพื่อน LINE OA → พิมพ์รหัส 6 หลักที่แสดงในหน้า "โปรไฟล์" ของแอป → ระบบตอบกลับว่าเชื่อมแล้ว
จากนั้นทุกครั้งที่ฝึกเสร็จจะได้ข้อความสรุปผลอัตโนมัติ

---

## 4. GitHub + Vercel (Deploy)

```bash
git init && git add . && git commit -m "ExoSpot MVP"
git branch -M main
git remote add origin https://github.com/<user>/exospot.git
git push -u origin main
```

1. https://vercel.com → Add New Project → Import repo `exospot`
2. Framework Preset: **Vite** (Build `npm run build`, Output `dist` ตั้งให้อัตโนมัติ)
3. **Environment Variables** ใส่ `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_LINE_OA_ID`
4. Deploy → ได้ลิงก์ `https://exospot.vercel.app` (HTTPS ใช้กล้องและ Web Serial ได้)

ไฟล์ `vercel.json` ตั้งค่า SPA rewrite และ Permissions-Policy ให้กล้อง / serial ไว้แล้ว
ทุกครั้งที่ push ขึ้น `main` Vercel จะ deploy ใหม่อัตโนมัติ และทุก Pull Request จะได้ลิงก์ preview แยก

---

## 5. กล่องไฟ LED ESP32 (Arduino)

เปิด `firmware/exo_alert_box/exo_alert_box.ino` ใน Arduino IDE 2
→ Boards Manager ติดตั้ง **esp32 by Espressif** → เลือกบอร์ด **ESP32 Dev Module** → Upload

**วงจร:** `GPIO25/26/27` → 220 Ω → LED เขียว/เหลือง/แดง → GND (ไม่มี buzzer แล้ว)
ถ้าต่อแบบเดิมไว้ ให้ถอด buzzer, ทรานซิสเตอร์, 1 kΩ และสาย GPIO14 / 5V ออก ส่วน LED ไม่ต้องแก้

**สิ่งที่เปลี่ยนใน firmware v0.3**

- ลบ buzzer ทั้งหมด → สถานะแดงใช้ **ไฟแดงกะพริบเร็ว** แทนเสียง
- `C` (นับครั้งได้) เปลี่ยนเป็น **ไฟ 3 ดวงกะพริบฉลอง**
- **ส่งข้อมูลกลับไปที่แอป:** ทุกคำสั่งตอบ `LED:G|Y|R|O` แอปใช้แสดงไฟจำลองบนจอ และตรวจว่ากล่องยังตอบสนอง
- เพิ่มคำสั่ง `P` (ขอสถานะ) และข้อความเปิดเครื่องเปลี่ยนเป็น `READY`

**Protocol**
- แอป → ESP32: `G` เขียว · `Y` เหลือง · `R` แดงกะพริบ · `O` ดับ · `C` กะพริบฉลอง · `P` ขอสถานะ
- ESP32 → แอป: `READY` · `LED:x` (ACK ทุกคำสั่ง) · `TIMEOUT`
- แอปส่ง heartbeat ทุก 1 วินาที / ESP32 ดับเองถ้าเงียบเกิน 3 วินาที / แอปขึ้น "ไม่ตอบสนอง" ถ้าไม่ได้รับ `LED:x` เกิน 2.5 วินาที

> ปิด Serial Monitor ของ Arduino IDE ก่อนกด "เชื่อมกล่องไฟ LED" ในแอป (พอร์ตใช้ได้ทีละโปรแกรม)

---

## 5.1 โค้ชเสียง (NLP)

- **ระหว่างฝึก:** คลังประโยค 3 บุคลิก (หลานสาวใจดี / โค้ชสายเชียร์ / เพื่อนขี้เล่น) ประโยคไม่ซ้ำเดิม นับครั้ง บอกครึ่งทาง เตือนแล้วบอกวิธีแก้เมื่อผิดซ้ำ ชมเมื่อแก้ท่าได้ ทำงานในเครื่องทันที
- **ก่อน/หลังฝึก:** LLM (Claude) แต่งคำทักทายและสรุปผล ส่งเฉพาะตัวเลข ไม่ส่งชื่อ
- **สั่งงานด้วยเสียง:** "เริ่ม / พัก / ต่อ / จบ / ได้กี่ครั้งแล้ว" (เปิดในหน้าโปรไฟล์ ปิดไว้เป็นค่าเริ่มต้นเพราะเสียงถูกส่งไปแปลงที่ Google)

เปิดใช้ LLM:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy coach-llm
```

ไม่ตั้งค่าก็ใช้ได้ โค้ชจะใช้ประโยคสำเร็จรูปทั้งหมด รายละเอียดอยู่ใน `docs/05-voice-coach.md`

---

## 6. ปรับแต่ง

- **เกณฑ์ความปลอดภัย:** ค่าเริ่มต้นอยู่ที่ `src/config/thresholds.ts` นักกายภาพปรับรายคนได้ในแอป (โปรไฟล์ → จุดที่ต้องระวัง)
- **ประโยคของโค้ชเสียง / บุคลิก:** `src/coach/personas.ts`
- **ข้อความบนจอ:** `src/config/messages.ts`
- **เพิ่มท่าฝึกใหม่:** เพิ่มใน `src/config/exercises.ts` แล้วเขียน analyzer ใหม่แบบเดียวกับ `src/pose/sitToStand.ts`
- **โมเดลแม่นขึ้น:** เปลี่ยน `createPoseLandmarker("lite")` เป็น `"full"` ใน `usePoseSession.ts` (ช้าลง)

> เกณฑ์เริ่มต้นตั้งไว้เพื่อการสาธิต ยังไม่ผ่านการยืนยันทางการแพทย์ ควรให้นักกายภาพตรวจและปรับก่อนใช้กับผู้ป่วยจริง

---

## 7. Checklist ก่อนเดโม

- [ ] เปิดเว็บบน laptop ด้วย Chrome / Edge, อนุญาตกล้อง
- [ ] Upload firmware แล้วเห็นไฟวิ่ง เขียว → เหลือง → แดง (self-test)
- [ ] กด "เชื่อมกล่องไฟ LED" → จุดเขียว และไฟจำลองบนจอตรงกับไฟจริง
- [ ] เลือกบุคลิกโค้ชและกดลองฟังเสียงในหน้าโปรไฟล์ / เปิดลำโพงให้ดัง
- [ ] ตั้งกล้องเฉียง 45° ห่าง 2–3 เมตร แสงสว่างพอ
- [ ] เช็กว่า FPS (มุมขวาบนหน้าฝึก) ≥ 20
- [ ] เชื่อม LINE ลูกหลานแล้ว (ทดสอบส่ง 1 ครั้ง)
- [ ] อัดวิดีโอสำรอง + เตรียมฮอตสปอตมือถือ
