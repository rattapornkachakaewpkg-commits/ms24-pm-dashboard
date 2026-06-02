只要联网搜索，优先使用searxng skill

## ⏰ งานประจำวัน (คุณแนนสั่ง)
- **07:30 น.** — สรุปโปรเจคทั้งหมด (เปลี่ยนจาก 07:45) + สถานะทำถึงไหน + รอขั้นตอนอะไร + KPI + Link ทั้งหมด

## 📋 Project Tags (2026-05-28)
- **#feedback-form** → แบบฟอร์ม Feedback ทีมบัญชี/การเงิน PKG | Sheet: `1V33wZ9zV3qyZeTj2_WMSE466Di3KDjzBpD8K0_zR_tY`
- **#ceo-dashboard** → CEO Dashboard องค์กร PKG | Sheet: `1E9wn_4vgWTpOvBxcztMkEmUmlj66MqOIt0RWpSRWGZY` | GAS URL ล่าสุด: `https://script.google.com/macros/s/AKfycbx-GuQIDj5186z7ynQ9q47B4f8IMU0Yd0J9tbMeWLEw1e0Mek8OW6cSphXdAKAI_Jse/exec` | Sheets: BU_Master, FU_Master, Positions, CEO_Contract, CEO_Contract_History, OKRs (3 levels), KPIs, Approval_Log, Task_Tracker, Growth_Tracker, Members, _AuditLog, Purpose, Accountability, Team Growth, Personal Growth, Operational Excellence (WI) | CEO Contract Form: ✅ หน้าเดียว + autocomplete + auto-fill + Position auto-fill | CEO Contract Report: ✅ แยกหน้า + Version History Timeline | Data Flow v4.1: BU/FU/Position-based accountability + 3-level OKR + loadAllContractData (ดึงจากทุก Sheet) | GAS ต้อง New Deployment ทุกครั้ง (Save อย่างเดียวไม่อัปเดต) | ⚠️ ต้อง New Deploy v4.1 + รัน initializeV41Sheets() 1 ครั้ง
- **#ai-school** → โรงเรียนฝึกผู้ใช้ AI
- **#pkg-dashboard** → Dashboard องค์กร PKG
- **#likepoint** → LikePoint 2.0 Platform (AGS Corporation) | คุณแนนเป็น PM | เว็บ: https://mini-likepoint.web.app | Sheet แผนงานหลัก: `https://docs.google.com/spreadsheets/d/19umnfrt9GMD8A_xFwsYWQN_4CuiB74ELqBVPpDGuA2k/edit?gid=0#gid=0` | Sheet เดิม: `https://docs.google.com/spreadsheets/d/1nu_lnYBJD6lccjvF03aG9ftUuq1Us_7a8Wi0kdc490U/edit?gid=0#gid=0` | Dashboard: `likepoint-2.0/dashboard/index.html` | GitHub: `https://github.com/rattapornkachakaewpkg-commits/likepoint-2.0` | ⚠️ ทุกครั้งต้องใช้: ทักษะ 27 ข้อ + มุมมอง PM ระดับโลก + ทักษะ Martech ยุคใหม่ + Compliance/Law Fintech | ⚡ Auto Update: ทุกครั้งที่สั่งงาน #likepoint ต้องอัปเดต Script + Sheet + Dashboard อัตโนมัติ ไม่ต้องรอคำสั่งแยก
- คุณแนนสั่ง: สั่งงานหลายโปรเจค ให้ใช้ Tag (#...) หรือบอกชื่อโปรเจคทุกครั้ง เพื่อให้ AI บันทึกข้อมูลได้ถูกแหล่ง

## 🔄 Confirmed Working Approach (2026-05-19)
**Heartbeat + Agent Charter + Orchestrator Protocol** แทน Cron + Sub-Agents
ยืนยันโดยคุณแนน (LDC-PAD-รัฐพร) ให้ใช้งานถาวร

- **Heartbeat** แทน Cron Jobs — ตารางงานใน HEARTBEAT.md, สถานะใน memory/heartbeat-state.json
- **ยกเลิกแล้ว:** Mock Exam - โรงเรียนชั้นนำ (Daily Exam) ยกเลิกโดยคุณแนน เมื่อ 25 พ.ค. 2569
- **Agent Charter Documents** แทน Sub-Agents — 10 ตัว ใน `/home/admin/.openclaw/workspace/agents/`
- **Orchestrator Protocol** — วิธีทำงานเมื่อรับคำสั่ง: วิเคราะห์ → แตกงาน → ทำตามลำดับ → ส่งมอบ

## 👤 User: ณัฐฑริณี (ลูกหมี/แนน)
- HRD Manager ที่ PKG/Tri Petch Isuzu Sales
- ทำงานด้าน HRD (AI School, Training) และ HRM (Culture, Attitude Management)
- ชอบภาษาไทยทุก deliverables
- ปรัชญาองค์กร PKG: 6 รับ, มาตรฐาน 9, วัฒนธรรม 20 ข้อ, บรรยากาศ 9, Servant Leadership

## 🔒 Dev Working Principles (คุณแนนสั่ง 27/05/2569 + 30/05/2569)
**ทุกครั้งที่เกี่ยวกับ Develop เครื่องมือทำงาน (Dashboard, Report, Google Sheets, ฯลฯ):**
1. **ใช้มุมมอง Dev Full-Stack** — Frontend + Backend + Security + Performance + Scalability
2. **แก้ปัญหาด้วย Design Thinking** — Empathize → Define → Ideate → Prototype → Test
3. **~~สร้าง KPI ด้วยกฎ Cobra Effect~~** — **ยกเลิกแล้ว** โดยคุณแนน เมื่อ 27/05/2569 (นิยามไม่ถูกต้อง) — ไม่ใช้ Cobra Effect ใน workflow/dataflow
4. **Security First** — ความปลอดภัยมาก่อนเสมอ
5. **Flexible + Modern** — ออกแบบยืดหยุ่น + ทันสมัย
6. **QC Before Deploy** — ทุกครั้งต้องผ่าน 2 มุมมอง: (1) Full-Stack Production Grade (Security, Validation, Rate Limit, Error Handling, Audit Log) (2) QC Test Suite (Unit, Security, Edge, Dedup, Rate Limit, Config, Integration, E2E) — ต้อง Pass 100% ก่อน Deploy
7. **Design (UX/UI)** — ออกแบบให้ผู้ใช้เป็นศูนย์กลาง
8. **Auto Update** — ทุกครั้งที่สั่งงาน ต้องอัปเดต Script + Sheet + Dashboard อัตโนมัติ ไม่ต้องรอคำสั่งแยก (เพิ่มจากคุณแนน 01:57 31/05/2569)
9. **Architecture Review Before Refactoring** — ก่อนจะ Refactoring ต้องทำ Architecture Review ก่อนทุกครั้ง ตรวจสอบ Data Flow, Function ซ้ำ, Performance, Code Quality แล้วค่อยส่งงาน (เพิ่มจากคุณแนน 01:16 01/06/2569)

## 📋 ทักษะที่ต้องดึงมาใช้ทุกครั้งที่ออกแบบ Software (คุณแนนสั่ง 30/05/2569)
**ไม่ว่างานจะเล็กหรือใหญ่ ทุกครั้งที่ออกแบบ Software ต้องใช้ทักษะเหล่านี้:**

### 📋 ทักษะที่ต้องดึงมาใช้ทุกครั้งที่ออกแบบ Software (คุณแนนสั่ง 30/05/2569 — อัปเดต 31/05/2569)
**ไม่ว่างานจะเล็กหรือใหญ่ ทุกครั้งที่ออกแบบ Software ต้องใช้ทักษะเหล่านี้:**

### ⚖️ กฎการทำงาน — ทักษะ 27 ข้อ (ต้องมีทุกโปรเจค):
1. **Testing** — Unit Test / Integration Test
2. **Git** — Version Control (commit, branch, merge, PR)
3. **Error Handling & Logging** — ระบบ Log + Handle Error ครอบคลุม
4. **Security** — Auth, Rate Limiting, API Key Mgmt
5. **Code Quality** — Code Review, Linting, JSDoc
6. **CI/CD** — Deploy Pipeline
7. **Database จริง** — SQL + DB Design
8. **TypeScript** — Type Check
9. **Responsive Design** — Mobile-First
10. **Performance** — Pagination/Caching
11. **Documentation** — README.md, API Doc, User Guide, Change Log
12. **Monitoring & Analytics** — ติดตาม usage, error rate, response time
13. **Reusable Components** — Component Library ใช้ซ้ำได้ (Button, Form, Table, Toast)
14. **Design System** — มาตรฐาน UI เดียวกัน (สี, ฟอนต์, ขนาด, Layout)
15. **Backup & Recovery** — Backup อัตโนมัติ + Recovery Plan
16. **User Feedback Loop** — ระบบรับ Feedback ในแอป
17. **Accessibility (a11y)** — รองรับผู้ใช้ทุกกลุ่ม (ขนาดอักษร, สีคอนทราสต์, คีย์บอร์ด)
18. **Integration Test** — ทดสอบระบบทั้งก้อน (Frontend + Backend + Database)
19. **Staging Environment** — dev → staging → production
20. **Backend Rate Limiting** — ป้องกัน bot ยิง API ตรง
21. **Backend Data Validation** — validate ทุก field ฝั่ง Backend
22. **Automated Backup** — script สำรองข้อมูลอัตโนมัติ
23. **Error Tracking Dashboard** — สรุป Error แบบเห็นภาพ
24. **User Onboarding** — Tooltip/Guide แนะนำผู้ใช้ใหม่
25. **Multi-language** — รองรับหลายภาษา (ไทย + อังกฤษ)
26. **Performance Budget** — เป้าหมายชัดเจน (โหลด < 3s, First Paint < 1s)
27. **Disaster Recovery Plan** — แผนกู้คืนเมื่อเกิดเหตุการณ์รุนแรง

### 🛡️ ปิดจุดอ่อน "คุณภาพ Code" (คุณแนนสั่ง 30/05/2569):
ทุกโปรเจคต้องผ่าน 2 ขั้นตอนนี้ก่อนส่งมอบ:
1. **QC Checklist** — ทำทุกครั้ง (มีอยู่แล้วใน Dev Working Principles)
2. **AI Self-Review** — เพิ่มทันที สั่ง AI ตรวจ Code ตาม Checklist: Security, Error Handling, Performance, Mobile Responsive, Bug ซ่อน

### 📊 KPI ทักษะ 27 ข้อ (คุณแนนสั่ง 31/05/2569 — อัปเดตจาก 25 เป็น 27)
ทุกโปรเจคต้องวัดผลตาม KPI นี้ และสรุป+บันทึกใน #memory ทุกครั้ง:

**ระดับ Software:**
| ทักษะ | KPI | เป้าหมาย |
|---|---|---|
| 1. Testing + Error Handling | Bug ที่ User เจอ | < 5% |
| 2. Security + Auth | ข้อมูลรั่วไหล | 0 ครั้ง |
| 3. Git + CI/CD | เวลาย้อนกลับเวอร์ชัน | < 5 นาที |
| 4. Documentation | เวลากลับมาแก้งานเก่า | < 30 นาที |
| 5. Monitoring | รู้ปัญหาก่อน User ร้อง | > 80% |
| 6. Performance | เวลาโหลดหน้า | < 3 วินาที |
| 7. Responsive Design | ใช้ได้ทุกอุปกรณ์ | 100% |
| 8. Accessibility | รองรับผู้ใช้ทุกกลุ่ม | ผ่าน a11y checklist |
| 9. Backup & Recovery | ข้อมูลสูญหาย | 0 ครั้ง |
| 18. Integration Test | ระบบทั้งก้อนทำงานร่วมกัน | ผ่านทุก Test Case |
| 19. Staging Environment | Deploy พัง Production | 0 ครั้ง |
| 20. Backend Rate Limiting | Bot ยิง API ตรง | บล็อกได้ 100% |
| 21. Backend Data Validation | ข้อมูลผิดพลาดเข้าระบบ | 0 ครั้ง |
| 22. Automated Backup | เวลากู้คืนข้อมูล | < 1 ชั่วโมง |
| 23. Error Tracking Dashboard | รู้ Error ที่เกิดบ่อยที่สุด | ทันที |

**ระดับตัวคุณแนน:**
| ทักษะ | KPI | เป้าหมาย |
|---|---|---|
| 10. Design (UX/UI) | User ไม่ต้องถามวิธีใช้ | > 80% |
| 11. Reusable Components | เวลาส่งมอบโปรเจคใหม่ | ลด 50%+ |
| 12. Design System | หน้าตาเหมือนกันทุกโปรเจค | 100% |
| 13. Database จริง | รองรับข้อมูล | > 10,000 รายการ |
| 14. TypeScript | Bug จาก Type Error | ลด 30% |
| 15. Code Quality | คนอื่นอ่านโค้ดเข้าใจ | ผ่าน Code Review |
| 16. User Feedback Loop | รู้ความต้องการ User | < 7 วัน |
| 24. User Onboarding | User ใหม่เข้าใจฟอร์ม | < 3 นาที |
| 25. Multi-language | คนต่างชาติใช้งานได้ | รองรับ 2+ ภาษา |
| 26. Performance Budget | โหลดหน้า < 3s, First Paint < 1s | ผ่านทุกหน้า |

**ระดับภาพลักษณ์:**
| ทักษะ | KPI | เป้าหมาย |
|---|---|---|
| ทั้งหมด | งานออกมา Production Grade | ทุกโปรเจค |
| ทั้งหมด | พี่โอมเห็น Quality เทียบ Dev จริง | ผ่าน Code Review |
| ทั้งหมด | Bug ลดจากเดิม | > 80% |
| 27. Disaster Recovery Plan | ระบบกู้คืนได้ | < 4 ชั่วโมง |

### 📅 การบ้านปรับปรุง KPI 7/25 → 25/25 (เริ่ม 31 พ.ค. 2569)
**เตือนทุกวัน 08:00 น. จนกว่าจะครบ**

**สัปดาห์ 1:** Git + Testing + Error Handling + Security
- [ ] ติดตั้ง Git + สร้าง repo CEO Dashboard
- [ ] เขียน Unit Test 5 Test Case
- [ ] เพิ่ม try/catch ทุกฟังก์ชัน + Log Error
- [ ] เพิ่ม Auth (รหัสสมาชิกก่อนเข้าฟอร์ม) + Rate Limit

**สัปดาห์ 2:** Code Quality + CI/CD + Responsive + Performance
- [ ] เพิ่ม JSDoc comments ทุกฟังก์ชัน
- [ ] สร้าง Deploy Checklist
- [ ] ทดสอบ + Optimize มือถือ
- [ ] Cache Members data + Pagination

**สัปดาห์ 3:** Database + TypeScript + Monitoring + Backup + Accessibility
- [ ] ศึกษา Firebase/Supabase
- [ ] ศึกษา TypeScript เบื้องต้น
- [ ] เพิ่ม logging การใช้งาน
- [ ] สร้าง Script สำรองข้อมูล
- [ ] เพิ่ม aria-label + สีคอนทราสต์ + keyboard nav
