# 01 · AI / Computer Vision Pipeline
**ExoSpot – ระบบตรวจท่ากายภาพเข่าด้วยกล้อง (Camera-only)**

> หน้าที่: ตรวจหาจุด hip, knee, ankle จากกล้อง → คำนวณ knee angle → ตัดสินว่าท่าเสี่ยงไหม → ส่งสถานะให้ Application และกล่องแจ้งเตือน (Hardware)
> ทำงานบนเครื่องผู้ใช้ทั้งหมด (Edge AI) ภาพไม่ถูกส่งขึ้น server

---

## 1. ภาพรวม Pipeline

```
[Webcam]
   │ video frame 1280×720 @30fps
   ▼
[1. Capture & Preprocess]
   ▼
[2. Pose Detection]  MediaPipe PoseLandmarker → 33 จุด (2D + 3D world)
   ▼
[3. Landmark Extraction]  hip / knee / ankle / heel / toe (ซ้าย-ขวา)
   ▼
[4. Quality Gate]  visibility ≥ 0.5 ? ถ้าไม่ผ่าน → สถานะ O + เสียงเตือนให้ถอยออก
   ▼
[5. Smoothing]  One Euro Filter / moving average
   ▼
[6. Feature Calculation]  knee angle, valgus ratio, angular velocity, asymmetry
   ▼
[7. Rep State Machine]  นั่ง ↔ ยืน → นับครั้ง
   ▼
[8. Risk Rules]  เทียบเกณฑ์ → G / Y / R
   ▼
[9. Debounce]  ค้างครบ N เฟรมจึงเปลี่ยนสถานะ
   ▼
[10. Output]
   ├─ สถานะ real-time → Application (UI + โค้ชเสียง) และ Hardware (ไฟ LED บน ESP32)
   ├─ Rep event → เก็บใน session
   └─ Session summary → บันทึกฐานข้อมูล / ส่งลูกหลาน
```

---

## 2. Input (ข้อมูลที่ Pipeline ต้องได้รับ)

**จากกล้อง**
- Video stream จาก webcam ผ่าน `getUserMedia` ความละเอียด 1280×720, 30 fps
- ตำแหน่งกล้อง: ด้านหน้าเฉียงประมาณ 45° ห่าง 2–3 เมตร สูงระดับเอว เห็นทั้งตัวรวมเก้าอี้

**จาก Application (ค่าตั้งของผู้ป่วยแต่ละคน)**
- กลุ่มผู้ป่วย: `pre_op` (ยังไม่ผ่าตัด) หรือ `post_op` (ผ่าตัดแล้ว ระยะฟื้นตัว)
- ข้างที่เป็น: ซ้าย / ขวา / ทั้งสองข้าง
- ท่าที่ฝึก: `sit_to_stand` (ท่าหลักของ demo)
- จำนวนครั้งเป้าหมาย เช่น 10 ครั้ง
- เกณฑ์ความปลอดภัย (ค่าเริ่มต้นด้านล่าง นักกายภาพปรับรายบุคคลได้)

---

## 3. รายละเอียดแต่ละขั้น

### Step 1 · Capture & Preprocess
- เปิดกล้องด้วย `navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })`
- ประมวลผลเฉพาะเฟรมใหม่ (`video.currentTime` เปลี่ยน) กันการคำนวณซ้ำ
- แสดงภาพแบบ mirror ให้เหมือนส่องกระจก แต่คำนวณจากพิกัดจริง

### Step 2 · Pose Detection
- Library: `@mediapipe/tasks-vision` → `PoseLandmarker`
- Model: `pose_landmarker_lite.task` (เร็ว) หรือ `full` (แม่นกว่า ถ้าเครื่องแรงพอ)
- ตั้งค่า: `runningMode: "VIDEO"`, `numPoses: 1`, `delegate: "GPU"` (fallback เป็น `"CPU"`)
- เรียก `detectForVideo(video, timestamp)` ทุกเฟรม
- ผลลัพธ์ที่ใช้:
  - `landmarks` = พิกัดบนภาพ (0–1) ใช้วาดโครงกระดูก
  - `worldLandmarks` = พิกัด 3 มิติหน่วยเมตร ใช้คำนวณมุม (แม่นกว่าเมื่อกล้องไม่ตั้งฉาก)

### Step 3 · Landmark Extraction
ใช้ 10 จุดจาก 33 จุดของ MediaPipe:

- ซ้าย: hip `23`, knee `25`, ankle `27`, heel `29`, toe (foot index) `31`
- ขวา: hip `24`, knee `26`, ankle `28`, heel `30`, toe (foot index) `32`

### Step 4 · Quality Gate
- ถ้าค่า `visibility` ของ hip, knee หรือ ankle ข้างใดข้างหนึ่งต่ำกว่า 0.5:
  - สถานะ = `O` (ไม่ประเมิน)
  - ไม่นับครั้ง ไม่เตือนผิดท่า
  - เสียงพูด: "กรุณาถอยให้กล้องเห็นทั้งตัวค่ะ" (cooldown 5 วินาที)
- ถ้าไม่พบคนเกิน 10 วินาที → หยุด session ชั่วคราว (Pause)

### Step 5 · Smoothing
- ใช้ **One Euro Filter** กับพิกัดแต่ละจุด หรือใช้ moving average 5–7 เฟรมกับค่ามุม
- เป้าหมาย: ลดอาการโครงกระดูกสั่น โดยหน่วงไม่เกินประมาณ 100 ms

### Step 6 · Feature Calculation

**Knee angle (3D)** – มุมที่เข่า ระหว่างเวกเตอร์ เข่า→สะโพก และ เข่า→ข้อเท้า
```
v1 = hip − knee
v2 = ankle − knee
angle = acos( (v1·v2) / (|v1|·|v2|) ) × 180/π
```
- ประมาณ 180° = เหยียดตรง, ประมาณ 90° = นั่งเก้าอี้

**Knee valgus ratio** (เข่าบิดเข้าใน)
```
valgus_ratio = ระยะห่างเข่าซ้าย-ขวา / ระยะห่างข้อเท้าซ้าย-ขวา
```
- ประมาณ 1.0 = ปกติ, ค่าน้อยลง = เข่าหุบเข้าหากัน

**Angular velocity** (ความเร็วการลุก/นั่ง)
```
velocity = (angle_now − angle_prev) / (t_now − t_prev)   หน่วย °/วินาที
```
- ค่าติดลบมากๆ = ทิ้งตัวนั่งเร็ว

**Asymmetry** (ลงน้ำหนักขาข้างเดียว)
```
asymmetry = |knee_angle_left − knee_angle_right|
```
- ผู้ป่วยข้อเข่าเสื่อมมักเลี่ยงลงน้ำหนักขาข้างที่ปวด

### Step 7 · Rep State Machine (นับครั้ง Sit-to-Stand)
```
SITTING ──(knee angle > 160°)──▶ STANDING ──(knee angle < 100°)──▶ SITTING
                                                     └─ นับ +1 ครั้ง
```
- นับ 1 ครั้งเมื่อครบรอบ นั่ง → ยืน → นั่ง
- ใช้มุมเฉลี่ยของสองขา
- เก็บเวลาที่ใช้ต่อครั้ง และมุมต่ำสุด/สูงสุดของแต่ละครั้ง

### Step 8 · Risk Rules (ค่าเริ่มต้น – ให้นักกายภาพปรับ)

| ตรวจอะไร | เหลือง (Y) | แดง (R) | เสียงพูด |
|---|---|---|---|
| เข่าบิดเข้าใน (valgus ratio) | < 0.85 | < 0.70 | "ระวังเข่าบิดเข้าในค่ะ" |
| นั่งลงเร็วเกินไป (velocity) | < −120°/s | < −200°/s | "นั่งลงช้าๆ ค่ะ" |
| ลงน้ำหนักไม่เท่ากัน (asymmetry) | > 20° | > 35° | "ลงน้ำหนักสองขาเท่าๆ กันค่ะ" |
| งอเข่าเกินช่วงที่กำหนด (เฉพาะ post_op) | ต่ำกว่าขีดจำกัด + 10° | ต่ำกว่าขีดจำกัด | "อย่างอเข่าลึกเกินไปค่ะ" |

- สถานะสุดท้าย = ระดับที่แย่ที่สุดจากทุกกฎ
- ถ้าผ่านทุกกฎ = `G` (ท่าถูกต้อง)
- ตรวจ valgus เฉพาะตอนเข่างอ (มุม < 160°) เพราะตอนยืนตรงไม่มีความหมาย

### Step 9 · Debounce
- สถานะใหม่ต้องเกิดติดต่อกัน **6 เฟรม** (ประมาณ 0.2 วินาที) จึงยืนยัน
- ข้อความที่โค้ชพูดจริงขึ้นกับบุคลิกและประวัติการผิดท่า (ดู `05-voice-coach.md`) ตารางด้านบนเป็นตัวอย่าง

### Step 10 · Output

**Real-time (ทุกเฟรม ไม่บันทึก)**
```json
{
  "state": "G | Y | R | O",
  "kneeAngle": { "left": 142.5, "right": 138.0 },
  "valgusRatio": 0.91,
  "velocity": -45.2,
  "asymmetry": 4.5,
  "phase": "SITTING | STANDING",
  "repCount": 4,
  "fps": 28
}
```

**Rep event (ทุกครั้งที่นับได้ เก็บใน session)**
```json
{
  "rep": 4,
  "durationSec": 3.2,
  "minKneeAngle": 92,
  "maxKneeAngle": 171,
  "worstState": "Y",
  "issues": ["valgus"]
}
```

**Session summary (จบ session ส่งให้ Application บันทึก)**
```json
{
  "exercise": "sit_to_stand",
  "startedAt": "2026-11-23T09:00:00+07:00",
  "durationSec": 210,
  "targetReps": 10,
  "completedReps": 10,
  "correctReps": 8,
  "correctPercent": 80,
  "alerts": { "valgus": 2, "tooFast": 1, "asymmetry": 0, "overFlex": 0 },
  "avgRepSec": 3.4,
  "kneeROM": { "min": 90, "max": 172 }
}
```

---

## 4. เป้าหมายประสิทธิภาพ
- FPS ≥ 20 บน laptop ทั่วไป
- Latency จากท่าผิดถึงไฟ/เสียงเตือน < 300 ms
- นับครั้งถูกต้อง ≥ 95% (ทดสอบ 50 ครั้ง)

## 5. Privacy (PDPA)
- ประมวลผลภาพในเบราว์เซอร์เท่านั้น ไม่บันทึกและไม่ส่งวิดีโอ
- ส่งออกเฉพาะตัวเลขสรุป (session summary)

## 6. แผนทดสอบ
- ทดสอบนับครั้ง: ทำ sit-to-stand 10 ครั้ง × 5 รอบ เทียบกับคนนับ
- ทดสอบ valgus: แกล้งหุบเข่า 10 ครั้ง นับว่าระบบเตือนกี่ครั้ง
- ทดสอบแสงน้อย / ใส่กางเกงสีเดียวกับพื้นหลัง / มีคนเดินผ่าน
- ทดสอบตอนถอยออกนอกกล้อง ต้องขึ้นสถานะ `O` ไม่ใช่เตือนแดง

## 7. Tech Stack
- `@mediapipe/tasks-vision` (PoseLandmarker)
- TypeScript + Vite
- Canvas 2D + `DrawingUtils` สำหรับวาดโครงกระดูก
- โค้ดคำนวณ geometry, filter, state machine เขียนเอง ไม่ใช้ library เพิ่ม

## 8. โครงไฟล์
```
src/pose/
  landmarker.ts    โหลดโมเดล + detect ทุกเฟรม
  geometry.ts      knee angle, valgus, velocity, asymmetry
  filters.ts       One Euro Filter, debounce
  sitToStand.ts    state machine นับครั้ง + risk rules
  session.ts       รวม rep events → session summary
```
