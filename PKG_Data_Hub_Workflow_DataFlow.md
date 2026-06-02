# PKG Data Hub — Workflow & Data Flow Complete Design
## ออกแบบโดยใช้มุมมอง Dev Full-Stack + Design Thinking

---

## 🏗️ ภาพรวมระบบ (System Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                    👥 USERS (ผู้ใช้)                         │
│  สมาชิก 492 คน    แอดมิน (คุณแนน)    ผู้บริหาร              │
└───────┬───────────────┬───────────────┬────────────────────┘
        │               │               │
        ▼               ▼               ▼
┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
│ Google    │  │ HTML Form │  │ Telegram  │  │ Dashboard │
│ Form      │  │ (สำรวจ)  │  │ (สั่งงาน) │  │ (ดูผล)    │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │              │              │              │
      ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                  ⚙️ GAS API v3.2 (Backend)                   │
│  Auth │ Validation │ Rate Limit │ Dedup │ Audit │ Backup      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              📊 Google Sheets (Database)                     │
│  Feedback │ Members │ _AuditLog │ _Backup │ _Config         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              📨 Telegram Notification                       │
│  แจ้งเตือนทุกครั้งที่มีข้อมูลใหม่เข้า                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 โปรแกรมที่ 1: GAS API v3.2 (Backend)

### 🎯 วัตถุประสงค์
ระบบ Backend กลางที่รับ-ส่งข้อมูลระหว่าง Frontend ทุกช่องทางกับ Google Sheets

### 👤 มุมมองที่ใช้ทำงาน

| มุมมอง | ใช้ทำอะไร |
|:---|:---|
| **Dev Full-Stack** | ออกแบบ API, Security, Validation, Rate Limit, Error Handling |
| **QC Test** | ทดสอบ 9 หมวด 36+ tests ก่อน Deploy |
| **Design Thinking** | Empathize → ผู้ใช้หลายประเภท → Define → API ต้องรองรับทุกช่องทาง |

### 📊 Data Flow

```
Request เข้า → Parse → Auth Check → Rate Limit → Validation → Process → Audit Log → Response
                         │              │              │            │
                    401 ถ้าไม่มี key  429 ถ้าเกิน     400 ถ้าผิด   200 OK + data
```

### 📋 Workflow (28 Actions)

| หมวด | Actions | ต้อง Auth? |
|:---|:---|:---:|
| **READ** | listSheets, readSheet, getCell, getSheetInfo, health, apiDocs | ❌ |
| **WRITE** | addSheet, setHeaders, writeRow, writeRows, setCell, setRange, insertRowAt, updateRow | ✅ |
| **DELETE** | deleteSheet (+backup), deleteRow (+backup), clearSheet, clearRange | ✅ |
| **FORM** | createFormSheet, submitForm, lookupMember | ❌ |
| **CONFIG** | getConfig, setConfig, getApiKey, setupTelegram, telegramNotify, setupFormTrigger | ✅ |

### 🔄 สถานะ: ✅ พร้อม Deploy

---

## 📦 โปรแกรมที่ 2: Google Form (ช่องทางสมาชิก)

### 🎯 วัตถุประสงค์
ให้สมาชิก 492 คนกรอกแบบสำรวจได้ง่าย ผ่านลิงก์ใน LINE/Telegram

### 👤 มุมมองที่ใช้ทำงาน

| มุมมอง | ใช้ทำอะไร |
|:---|:---|
| **Design Thinking (Empathize)** | สมาชิกถนัด Google Form → ไม่ต้องสอนใช้ |
| **UX Designer** | ออกแบบคำถามให้ตอบง่าย ไม่ยาวเกิน |

### 📊 Data Flow

```
สมาชิกกรอก Google Form
        │
        ▼
Google Form Submit
        │
        ▼
GAS onFormSubmitHandler (Trigger อัตโนมัติ)
        │
        ├─→ เขียนข้อมูลลง Sheet "Feedback"
        ├─→ บันทึก Audit Log
        └─→ ส่ง Telegram Notification
```

### 📋 Workflow

| ขั้น | ทำอะไร | ใครทำ |
|:---:|:---|:---:|
| 1 | สร้าง Google Form (คำถาม 12 ข้อ + 2 ข้อเสนอแนะ) | คุณแนน |
| 2 | ตั้งค่า Form ส่งข้อมูลไป Spreadsheet เดิม | คุณแนน |
| 3 | รัน `setupFormTrigger` เพื่อเปิด onFormSubmit | AliClaw |
| 4 | ทดสอบกรอก 1 ครั้ง → ตรวจ Sheet + Telegram | AliClaw |
| 5 | ส่งลิงก์ Form ใน LINE กลุ่มบริษัท | คุณแนน |

### 🔄 สถานะ: ⏳ รอ Deploy GAS ก่อน แล้วสร้าง Form

---

## 📦 โปรแกรมที่ 3: HTML Form (ช่องทางแอดมิน)

### 🎯 วัตถุประสงค์
แบบสำรวจแบบอินเทอแอคทีฟ ดึงข้อมูลสมาชิกอัตโนมัติ ป้องกันส่งซ้ำ แสดงผล Real-time

### 👤 มุมมองที่ใช้ทำงาน

| มุมมอง | ใช้ทำอะไร |
|:---|:---|
| **Frontend Dev** | ออกแบบ UI/UX, Responsive, Animation, Progress Bar |
| **Full-Stack Dev** | เชื่อม API, จัดการ State, Error Handling, Loading |
| **Design Thinking** | Empathize → แอดมินต้องการความรวดเร็ว → ดึงข้อมูลอัตโนมัติ |

### 📊 Data Flow

```
แอดมินเปิด HTML Form
        │
        ├─→ กรอกรหัสสมาชิก
        │       │
        │       ▼
        │   GAS API → lookupMember → แสดง ชื่อ/ทีม/บริษัท อัตโนมัติ
        │
        ├─→ ให้คะแนน 12 ข้อ + เสนอแนะ 2 ข้อ
        │
        └─→ กด "ส่งแบบสำรวจ"
                │
                ▼
          GAS API → submitForm
                │
                ├─→ Dedup Check (5 นาที)
                ├─→ เขียนลง Sheet "Feedback"
                ├─→ Audit Log
                └─→ Telegram Notification
```

### 📋 Workflow (หน้าจอ)

```
หน้า 1: กรอกรหัสสมาชิก → ค้นหา → แสดงข้อมูลอัตโนมัติ
    │
    ▼
หน้า 2: ให้คะแนนทีมบัญชี (6 ข้อ) + เสนอแนะ
    │
    ▼
หน้า 3: ให้คะแนนทีมการเงิน (6 ข้อ) + เสนอแนะ
    │
    ▼
หน้า 4: ตรวจสอบ → ส่ง → แสดงผลสำเร็จ
```

### 🔄 สถานะ: ⏳ มีโครงแบบสำรวจเดิม → ต้องอัปเดตเชื่อม API v3.2

---

## 📦 โปรแกรมที่ 4: Dashboard (ช่องทางผู้บริหาร)

### 🎯 วัตถุประสงค์
ให้ผู้บริหารดูผลแบบสำรวจแบบ Real-time กราฟ + ตาราง + สรุป

### 👤 มุมมองที่ใช้ทำงาน

| มุมมอง | ใช้ทำอะไร |
|:---|:---|
| **Frontend Dev** | กราฟ Chart.js, ตาราง Responsive, Filter |
| **Data Analyst** | วิเคราะห์ข้อมูล, สถิติ, แนวโน้ม |
| **Design Thinking** | Empathize → ผู้บริหารต้องการเห็นภาพรวม → Dashboard สรุป |

### 📊 Data Flow

```
ผู้บริหารเปิด Dashboard
        │
        ▼
GAS API → readSheet (Feedback)
        │
        ├─→ กราฟคะแนนเฉลี่ย (บัญชี vs การเงิน)
        ├─→ ตารางผลสำรวจล่าสุด 20 รายการ
        ├─→ สรุป: จำนวนคนตอบ, คะแนนเฉลี่ย, ข้อเสนอแนะ
        └─→ Filter: ตามทีม / บริษัท / วันที่
```

### 📋 Workflow (หน้าจอ)

```
หน้า 1: ภาพรวม — กราฟคะแนนเฉลี่ย + จำนวนคนตอบ + แนวโน้ม
    │
    ▼
หน้า 2: รายละเอียด — ตารางผลทุกคน + Filter ตามทีม/บริษัท
    │
    ▼
หน้า 3: ข้อเสนอแนะ — Word Cloud + รายการทั้งหมด
```

### 🔄 สถานะ: ⏳ ยังไม่ได้สร้าง — รอหลัง Deploy

---

## 📦 โปรแกรมที่ 5: Telegram Command (ช่องทางสั่งงาน)

### 🎯 วัตถุประสงค์
ให้คุณแนนสั่งงานผ่านแชท Telegram — สร้าง/ลบ Sheet, กรอกข้อมูล, ดูผล

### 👤 มุมมองที่ใช้ทำงาน

| มุมมอง | ใช้ทำอะไร |
|:---|:---|
| **Backend Dev** | สร้าง API endpoint, AliClaw เรียกใช้ |
| **DevOps** | Monitoring, Health Check, Notification |
| **Design Thinking** | Empathize → คุณแนนต้องการสั่งงานเร็ว → คำสั่งสั้น |

### 📊 Data Flow

```
คุณแนนพิมพ์คำสั่งใน Telegram
        │
        ▼
AliClaw วิเคราะห์คำสั่ง
        │
        ├─→ "สร้าง Sheet ชื่อ XXX" → GAS addSheet + api_key
        ├─→ "ลบ Sheet ชื่อ XXX" → GAS deleteSheet + api_key
        ├─→ "กรอกข้อมูล..." → GAS writeRow + api_key
        ├─→ "อ่านผลสำรวจ" → GAS readSheet (Feedback) → สรุปให้
        └─→ "รายงาน" → GAS health → รายงานสถานะ
```

### 📋 Workflow (คำสั่ง)

| คำสั่ง | Action | ตัวอย่าง |
|:---|:---|:---|
| สร้าง Sheet | addSheet | "สร้าง Sheet ชื่อ KPI_2026" |
| ลบ Sheet | deleteSheet | "ลบ Sheet ชื่อ test" |
| กรอกข้อมูล | writeRow | "เพิ่มข้อมูลใน Sheet Members: EMP001, สมชาย, บัญชี, PKG" |
| อ่านผลสำรวจ | readSheet | "อ่านผลสำรวจ Feedback" |
| รายงานสถานะ | health | "รายงานสถานะระบบ" |
| ตั้งค่า Telegram | setupTelegram | "ตั้งค่า Telegram" |

### 🔄 สถานะ: ✅ ทำงานได้แล้ว (ผ่าน AliClaw)

---

## 📊 สรุป: ทุกโปรแกรมใช้มุมมองอะไร

| โปรแกรม | Full-Stack | QC Test | Design Thinking | สถานะ |
|:---|:---:|:---:|:---:|:---:|
| 1. GAS API v3.2 | ✅ | ✅ | ✅ | ✅ พร้อม |
| 2. Google Form | — | — | ✅ | ⏳ รอ |
| 3. HTML Form | ✅ | ✅ | ✅ | ⏳ อัปเดต |
| 4. Dashboard | ✅ | ✅ | ✅ | ⏳ สร้างใหม่ |
| 5. Telegram Command | ✅ | — | ✅ | ✅ พร้อม |

---

## 📅 ลำดับงานพรุ่งนี้

| ลำดับ | งาน | ใครทำ | เวลา |
|:---:|:---|:---:|:---:|
| 1 | Deploy GAS v3.2 | คุณแนน + AliClaw | 12 นาที |
| 2 | ทดสอบ Health Check | AliClaw | 2 นาที |
| 3 | อัปเดต HTML Form เชื่อม API v3.2 | AliClaw | 30 นาที |
| 4 | สร้าง Google Form + Trigger | คุณแนน + AliClaw | 15 นาที |
| 5 | ใส่ข้อมูลสมาชิก 492 คน | คุณแนน | — |
| 6 | สร้าง Dashboard | AliClaw | 1 ชม. |