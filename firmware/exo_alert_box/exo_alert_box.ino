/*
  ExoSpot – LED Alert Box (ESP32)  v0.3
  แจ้งเตือนด้วยไฟ LED 3 สีเท่านั้น (ไม่มี buzzer) และรายงานสถานะไฟกลับไปที่แอป
  เสียงแจ้งเตือนทั้งหมดอยู่ในแอป (โค้ชเสียงพูด)

  ---------- แอป → ESP32 (1 ตัวอักษร) ----------
    G = ท่าถูก       -> LED เขียว
    Y = เริ่มเสี่ยง    -> LED เหลือง
    R = อันตราย      -> LED แดงกะพริบเร็ว (ดึงความสนใจแทนเสียง)
    O = หยุด/ไม่พบคน  -> ดับทั้งหมด
    C = นับครั้งได้    -> ไฟ 3 ดวงกะพริบพร้อมกัน 1 ครั้ง แล้วกลับสถานะเดิม
    P = ping         -> ตอบสถานะปัจจุบัน (แอปใช้ตอนเพิ่งเชื่อมต่อ)

  ---------- ESP32 → แอป (1 บรรทัดต่อข้อความ) ----------
    READY            บอร์ดพร้อมใช้งาน (หลังเปิดเครื่อง)
    LED:<G|Y|R|O>    สถานะไฟจริงบนกล่อง ส่งทุกครั้งที่ได้รับคำสั่ง (ใช้เป็น ACK)
    TIMEOUT          ไม่ได้รับคำสั่งเกิน 3 วินาที ดับไฟแล้ว

  Failsafe: ไม่ได้รับคำสั่งเกิน 3 วินาที (เว็บปิด/สายหลุด) -> ดับทั้งหมด

  ---------- การต่อขา ----------
    GPIO25 -> 220Ω -> LED เขียว  (ขายาว) / ขาสั้น -> GND
    GPIO26 -> 220Ω -> LED เหลือง
    GPIO27 -> 220Ω -> LED แดง
*/

#define LED_G 25
#define LED_Y 26
#define LED_R 27

const unsigned long TIMEOUT_MS     = 3000;  // failsafe
const unsigned long RED_BLINK_MS   = 200;   // จังหวะกะพริบตอนสถานะแดง
const unsigned long CELEBRATE_MS   = 150;   // ความยาวไฟกะพริบตอนนับครั้ง

char state = 'O';
unsigned long lastCmd = 0;
unsigned long lastBlink = 0;
bool redOn = true;
unsigned long celebrateUntil = 0;           // 0 = ไม่ได้กะพริบฉลอง

void setLeds(bool g, bool y, bool r) {
  digitalWrite(LED_G, g);
  digitalWrite(LED_Y, y);
  digitalWrite(LED_R, r);
}

void showState() {
  setLeds(state == 'G', state == 'Y', state == 'R' && redOn);
}

void report() {
  Serial.print("LED:");
  Serial.println(state);
}

void selfTest() {
  int leds[] = {LED_G, LED_Y, LED_R};
  for (int i = 0; i < 3; i++) {
    digitalWrite(leds[i], HIGH); delay(200); digitalWrite(leds[i], LOW);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_Y, OUTPUT);
  pinMode(LED_R, OUTPUT);
  selfTest();
  showState();
  Serial.println("READY");
}

void loop() {
  unsigned long now = millis();

  // ---------- 1) อ่านคำสั่งจากแอป ----------
  while (Serial.available()) {
    char c = Serial.read();

    if (c == 'G' || c == 'Y' || c == 'R' || c == 'O') {
      lastCmd = now;
      if (c != state) {
        state = c;
        redOn = true;
        lastBlink = now;
      }
      if (!celebrateUntil) showState();
      report();                                  // ACK ทุกคำสั่ง (รวม heartbeat)
    } else if (c == 'C') {
      lastCmd = now;
      setLeds(true, true, true);
      celebrateUntil = now + CELEBRATE_MS;
      report();
    } else if (c == 'P') {
      report();
    }
  }

  // ---------- 2) จบไฟกะพริบฉลอง ----------
  if (celebrateUntil && now >= celebrateUntil) {
    celebrateUntil = 0;
    showState();
  }

  // ---------- 3) Failsafe ----------
  if (state != 'O' && now - lastCmd > TIMEOUT_MS) {
    state = 'O';
    showState();
    Serial.println("TIMEOUT");
    report();
  }

  // ---------- 4) ไฟแดงกะพริบ (non-blocking) ----------
  if (state == 'R' && !celebrateUntil && now - lastBlink > RED_BLINK_MS) {
    lastBlink = now;
    redOn = !redOn;
    showState();
  }
}
