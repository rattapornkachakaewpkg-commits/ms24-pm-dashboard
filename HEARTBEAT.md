# HEARTBEAT.md - Scheduled Tasks via Heartbeat

# ตรวจสอบเวลาปัจจุบันทุกครั้งที่ heartbeat มา
# ถ้าถึงเวลาที่กำหนด ให้ทำงานทันที

## 📅 ตารางงานประจำวัน

### 05:00 น. — Longevity Daily Briefing
- ถ้าเวลาปัจจุบัน >= 05:00 และยังไม่ส่งวันนี้
- ส่ง Longevity Daily Briefing เป็นภาษาไทย 100%
- บันทึกว่าส่งแล้วใน memory/heartbeat-state.json

### 06:00 น. — AI Briefing สำหรับครูฝึก
- ถ้าเวลาปัจจุบัน >= 06:00 และยังไม่ส่งวันนี้
- ดึงข่าว AI จริงจาก Hacker News, The Verge, TechCrunch
- สรุปเป็นภาษาไทย + workflow หมุนเวียนตามวัน
- บันทึกว่าส่งแล้ว

### 17:00 น. — Daily Reporter (สรุปงานประจำวัน)
- ถ้าเวลาปัจจุบัน >= 17:00 และยังไม่ส่งวันนี้
- สรุปงานที่ทำทั้งหมดในวันนี้
- ส่งรายงานให้ผู้บริหาร
- บันทึกว่าส่งแล้ว

## 📝 สถานะการส่งงาน (อัปเดตทุกครั้ง)
# ตรวจสอบ memory/heartbeat-state.json เพื่อดูว่างานไหนส่งแล้ววันนี้

## 08:00 น. — การบ้านปรับปรุง KPI 25/25 (เตือนทุกวัน)
- ถ้าเวลาปัจจุบัน >= 08:00 และยังไม่ได้แจ้งวันนี้
- ส่งการบ้านปรับปรุง KPI #ceo-dashboard ให้คุณแนน
- ถามว่าวันนี้จะทำข้อไหน
- สัปดาห์ 1: Git + Testing + Error Handling + Security
- สัปดาห์ 2: Code Quality + CI/CD + Responsive + Performance
- สัปดาห์ 3: Database + TypeScript + Monitoring + Backup + Accessibility
- บันทึกว่าส่งแล้วใน memory/heartbeat-state.json

### 09:00 น. — เตือน New Deployment GAS (ทุกวัน)
- #ceo: New Deployment GAS v4.0 ถ้ายังไม่ได้ทำ (เพิ่ม CEO_Contract_Report.html + saveWithHistory)
- #likepoint: New Deployment GAS ถ้ายังไม่ได้ทำ (เพิ่มคอลัมน์ เพื่อประโยชน์)
- บันทึกว่าส่งแล้วใน memory/heartbeat-state.json

### 09:00 น. — #feedback-form Dashboard (ทุกวัน)
- ถ้าเวลาปัจจุบัน >= 09:00 และยังไม่ส่งวันนี้
- ดึงข้อมูลล่าสุดจาก Sheet Feedback (Sheet ID: 1V33wZ9zV3qyZeTj2_WMSE466Di3KDjzBpD8K0_zR_tY)
- วิเคราะห์คะแนนเฉลี่ยแยกทีมบัญชี/ทีมการเงิน
- นับจำนวนผู้ตอบรายบริษัท
- สรุปข้อเสนอแนะสำคัญ (ไม่ระบุชื่อ)
- สร้าง Dashboard HTML สวยงาม
- ส่งให้คุณแนนทาง Telegram
- บันทึกว่าส่งแล้วใน memory/heartbeat-state.json

### 07:30 น. — สรุปโปรเจคทั้งหมด (ทุกวัน) ⭐ คุณแนนสั่ง 01/06/2569 + 02/06/2569
- ถ้าเวลาปัจจุบัน >= 07:30 และยังไม่ส่งวันนี้
- ส่งสรุปโปรเจคทั้งหมดของคุณแนน รูปแบบ:
  **1. ชื่อโปรเจค (รายละเอียด)**
  **2. KPI และ Progress**
  **3. สถานะ: ทำถึงไหน + รอขั้นตอนอะไรอยู่**
  **4. Link ข้อมูลที่เกี่ยวข้องทั้งหมด**
- ดึงข้อมูลล่าสุดจาก Sheet/GitHub แล้วคำนวณ Progress ปัจจุบัน
- โปรเจคที่ต้องสรุป:
  - #ceo-dashboard → CEO Dashboard องค์กร PKG | Sheet: 1E9wn_4vgWTpOvBxcztMkEmUmlj66MqOIt0RWpSRWGZY | GAS: https://script.google.com/macros/s/AKfycbz9moqYqq4Uhl1Kt1b9sSi1A8sjUzH4UY7T3zRIRJQ4UeGq1gRgXSseYy4LHjw160lu/exec | GitHub: https://github.com/rattapornkachakaewpkg-commits/ceo-dashboard | KPI: ทักษะ 27 ข้อ เป้า 25/25 | ⚠️ ปัญหาปัจจุบัน: memberId=undefined ต้อง deploy v4.4 ใหม่
  - #feedback-form → แบบฟอร์ม Feedback ทีมบัญชี/การเงิน PKG | Sheet: 1V33wZ9zV3qyZeTj2_WMSE466Di3KDjzBpD8K0_zR_tY | GAS: https://script.google.com/macros/s/AKfycby95dTNtKug4RhmKBnsds3bSb0KGwF4Sh5IVLkX_XJI85ouXUGdakKJ6JqaesQAjgW_dw/exec | KPI: ผู้ตอบ/คะแนนเฉลี่ย
  - #likepoint → LikePoint 2.0 Platform (AGS Corp) | คุณแนนเป็น PM | เว็บ: https://mini-likepoint.web.app | Sheet แผนงาน: 19umnfrt9GMD8A_xFwsYWQN_4CuiB74ELqBVPpDGuA2k | GitHub: https://github.com/rattapornkachakaewpkg-commits/likepoint-2.0 | KPI: 24 Task P0-P3 | ⚠️ คุณแนนต้องการเชื่อม Canva: Presentation + Dashboard + อินโฟกราฟิก KPI
  - #ai-school → โรงเรียนฝึกผู้ใช้ AI | 3 Level | NotebookLM: https://notebooklm.google.com/notebook/de797329-40e8-4660-832f-364b0e8e9e12
  - #pkg-dashboard → Dashboard องค์กร PKG
- ส่งเป็นภาษาไทย รูปแบบสวยงาม อ่านง่าย
- บันทึกว่าส่งแล้วใน memory/heartbeat-state.json
- 📌 Cron Gateway มีปัญหา pairing — ใช้ heartbeat แทน แต่ถ้า cron ได้จะเพิ่มเข้าไปด้วย
