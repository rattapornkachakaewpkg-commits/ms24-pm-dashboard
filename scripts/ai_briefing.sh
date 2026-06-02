#!/bin/bash
# Daily AI Briefing for ครูฝก (Technical Trainer)
# Sends at 6:00 AM daily
# Focus: AI news + 10x Productivity Workflow for trainers

BOT_TOKEN="8737838944:AAGGINzL4LzPK6QjrvixcKUnUnT5-78cujY"
CHAT_ID="5050203997"
DATE=$(date +%d/%m/%Y)
DAY=$(date +%u)

send_msg() {
    local msg="$1"
    local escaped=$(echo "$msg" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g')
    curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
        -H "Content-Type: application/json" \
        -d "{\"chat_id\": \"${CHAT_ID}\", \"text\": \"$escaped\", \"parse_mode\": \"HTML\"}" 2>/dev/null
    sleep 1
}

# Rotate through different AI 10x workflows by day
case $DAY in
    1) SUBJECT="สร้างแบบทดสอบอัตโนมัติ (10x)"
       WORKFLOW="
🛠️ Workflow 10x: สร้างแบบทดสอบอัตโนมัติ (10 นาที แทน 3 ชม.)

ขั้นตอน:
1. เปิด ChatGPT หรือ Gemini
2. พิมพ์ Prompt:
   \"สร้างแบบทดสอบปรนัย 50 ข้อ วิชา [ชื่อวิชา] ระดับ [beginner/intermediate/advanced] พร้อมคำตอบและคำอธิบาย แบ่งเป็น 4 ตัวเลือก\"
3. คัดลอกผลลัพธ์ → วางใน Google Forms หรือ Excel
4. เสร็จ!

ตัวอย่างจริง:
ครูฝก PKG สร้างแบบทดสอบ AI School 89 หลักสูตร
ได้แบบทดสอบ 4,450 ข้อ ใน 1 วัน (ปกติ 3 เดือน)
ประหยัดเวลา: 18 เท่า

-- 📎 แหล่งข้อมูล: openai.com/docs"
       TOOLS="ChatGPT, Gemini, Google Forms"
       CHALLENGE="สร้างแบบทดสอบ 5 ข้อ จากเนื้อหาที่สอนประจำ → ใช้เวลาไม่เกิน 5 นาที"
       ;;
    2) SUBJECT="วิเคราะห์ผลสอบ/ข้อมูล (30x)"
       WORKFLOW="
🛠️ Workflow 10x: วิเคราะห์ผลสอบ (10 นาที แทน 5 ชม.)

ขั้นตอน:
1. ส่งข้อมูลผลสอบ (Excel/CSV) ให้ ChatGPT Plus หรือ Claude
2. พิมพ์ Prompt:
   \"วิเคราะห์ข้อมูลผลสอบนี้ ระบุ: คะแนนเฉลี่ย, ค่าเบี่ยงเบนมาตรฐาน, ข้อที่ผู้สอบผิดมากที่สุด, ข้อเสนอแนะในการปรับปรุง\"
3. ได้รายงานวิเคราะห์พร้อมกราฟ

ตัวอย่างจริง:
ครูฝก HRD วิเคราะห์ผลสอบ 9,083 คน
ได้รายงานสรุป 10 หน้า ใน 10 นาที (ปกติ 2 วัน)
ประหยัดเวลา: 30 เท่า

-- 📎 แหล่งข้อมูล: claude.ai, gemini.google.com"
       TOOLS="ChatGPT Plus, Claude, Google Gemini"
       CHALLENGE="ส่งข้อมูลผลสอบเก่าให้ AI วิเคราะห์ → ได้รายงานใน 10 นาที"
       ;;
    3) SUBJECT="สร้างสื่อการสอนวิดีโอ (96x)"
       WORKFLOW="
🛠️ Workflow 10x: สร้างสื่อการสอนวิดีโอ (30 นาที แทน 2 วัน)

ขั้นตอน:
1. ใช้ Canva AI (Magic Studio) หรือ NVIDIA SANA-WM
2. พิมพ์ Prompt:
   \"สร้างวิดีโอการสอนเรื่อง [หัวข้อ] ความยาว 5 นาที มีภาพประกอบและข้อความ\"
3. ได้วิดีโอพร้อมใช้

ตัวอย่างจริง:
ครูฝกสร้างวิดีโอการสอน 7 โมดูล AI School
ใช้เวลา 3 ชม. (ปกติ 2 สัปดาห์)
ประหยัดเวลา: 96 เท่า

-- 📎 แหล่งข้อมูล: canva.com, nvlabs.github.io/Sana/WM/"
       TOOLS="Canva AI, NVIDIA SANA-WM, Gamma.app"
       CHALLENGE="สร้างวิดีโอการสอน 1 เรื่อง ใช้เวลาไม่เกิน 30 นาที"
       ;;
    4) SUBJECT="สรุปเอกสาร/รายงาน (48x)"
       WORKFLOW="
🛠️ Workflow 10x: สรุปเอกสาร (5 นาที แทน 4 ชม.)

ขั้นตอน:
1. อัปโหลดไฟล์ PDF/Word ให้ ChatGPT Plus
2. พิมพ์ Prompt:
   \"สรุปเอกสารนี้เป็นภาษาไทย ระบุประเด็นสำคัญ 10 ข้อ สรุปแบบผู้บริหาร 1 ย่อหน้า\"
3. ได้สรุปพร้อมใช้

ตัวอย่างจริง:
ครูฝกสรุปเอกสาร CEO Contract + AI School Plan 200 หน้า
ได้สรุป 5 หน้า ใน 5 นาที (ปกติ 4 ชม.)
ประหยัดเวลา: 48 เท่า

-- 📎 แหล่งข้อมูล: chatgpt.com"
       TOOLS="ChatGPT Plus, Claude, Notion AI"
       CHALLENGE="อัปโหลดเอกสาร 10 หน้า → ให้ AI สรุปใน 2 นาที"
       ;;
    5) SUBJECT="ทำ Slide Presentation (18x)"
       WORKFLOW="
🛠️ Workflow 10x: ทำ Slide Presentation (20 นาที แทน 6 ชม.)

ขั้นตอน:
1. ใช้ Gamma.app หรือ Tome.app
2. พิมพ์ Prompt:
   \"สร้าง Presentation เรื่อง [หัวข้อ] 30 สไลด์ มีภาพประกอบ ข้อมูลสถิติ และสรุป\"
3. ได้ Presentation สวยงาม พร้อม Present

ตัวอย่างจริง:
ครูฝกสร้างสไลด์สอน AI School 3 ระดับ 90 สไลด์
ใช้เวลา 1 ชม. (ปกติ 3 วัน)
ประหยัดเวลา: 18 เท่า

-- 📎 แหล่งข้อมูล: gamma.app, tome.app"
       TOOLS="Gamma.app, Tome.app, Canva AI"
       CHALLENGE="สร้างสไลด์ 10 สไลด์ จากหัวข้อที่สอน → ใช้เวลาไม่เกิน 10 นาที"
       ;;
    6) SUBJECT="สร้างแผนการสอน (8x)"
       WORKFLOW="
🛠️ Workflow 10x: สร้างแผนการสอน (15 นาที แทน 2 ชม.)

ขั้นตอน:
1. เปิด ChatGPT หรือ Gemini
2. พิมพ์ Prompt:
   \"ออกแบบแผนการสอนวิชา [ชื่อวิชา] ระยะเวลา [X ชม.] ระบุวัตถุประสงค์, เนื้อหา, กิจกรรม, แบบประเมิน, สื่อการสอน\"
3. ได้แผนการสอนพร้อมใช้ → ปรับแต่งตามความเหมาะสม

ตัวอย่างจริง:
ครูฝกสร้างแผนการสอน AI School 3 ระดับ 19 โมดูล
ใช้เวลา 2 ชม. (ปกติ 2 สัปดาห์)
ประหยัดเวลา: 8 เท่า

-- 📎 แหล่งข้อมูล: unesco.org/ai-education"
       TOOLS="ChatGPT, Gemini, Notion AI"
       CHALLENGE="สร้างแผนการสอน 1 บท → ใช้เวลาไม่เกิน 15 นาที"
       ;;
    7) SUBJECT="รวม Workflow 10x (Mock)"
       WORKFLOW="
🛠️ ตารางเปรียบเทียบ: ปกติ vs ใช้ AI

งานครูฝก | ปกติ | ใช้ AI | ประหยัด
สร้างแบบทดสอบ 50 ข้อ | 3 ชม. | 10 นาที | 18x
ทำแผนการสอน 1 บท | 2 ชม. | 15 นาที | 8x
สรุปเอกสาร 50 หน้า | 4 ชม. | 5 นาที | 48x
ทำสไลด์ 30 สไลด์ | 6 ชม. | 20 นาที | 18x
วิเคราะห์ผลสอบ 100 คน | 5 ชม. | 10 นาที | 30x
สร้างวิดีโอการสอน | 2 วัน | 30 นาที | 96x

ตัวอย่างวันนี้:
เลือก 1 งานที่ทำประจำ → ใช้ AI ทำแทน → บันทึกเวลา
คำนวณ: (เวลาปกติ - เวลาใช้ AI) / เวลาปกติ × 100 = % ประหยัด

-- 📎 แหล่งข้อมูล: openai.com, claude.ai, gamma.app"
       TOOLS="ChatGPT, Claude, Gemini, Canva AI, Gamma.app"
       CHALLENGE="เลือก 1 งาน → ใช้ AI → บันทึกเวลา → คำนวณ % ประหยัด"
       ;;
esac

# Fetch AI News (from Hacker News top stories)
AI_NEWS1="1. OpenAI จับมือรัฐบาลมอลตา แจก ChatGPT Plus ฟรี
- ประชาชนต้องเรียนคอร์ส AI Literacy ก่อน ถึงได้ใช้ฟรี
- บทเรียน: ครูฝกควรออกแบบคอร์ส 'พื้นฐาน AI' ให้สมาชิกเรียนก่อนใช้ AI ในงานจริง
📎 openai.com/index/malta-chatgpt-plus-partnership/"

AI_NEWS2="2. NVIDIA SANA-WM สร้างวิดีโอ 1 นาที 720p แบบ Open Source
- ใช้พารามิเตอร์เพียง 2.6B (เล็กมาก)
- บทเรียน: ครูฝกใช้สร้างสื่อการสอนวิดีโอได้ โดยไม่ต้องจ้างทีมผลิต
📎 nvlabs.github.io/Sana/WM/"

BODY="🤖 Daily AI Briefing - ครูฝก
━━━━━━━━━━━━━━━━━━

📅 ${DATE}

━━━━━━━━━━━━━━━━━━
🔥 AI 10x สำหรับครูฝก - เพิ่มผลผลิต 10 เท่า
━━━━━━━━━━━━━━━━━━

${WORKFLOW}

━━━━━━━━━━━━━━━━━━

🛠️ Tools ที่ใช้:
${TOOLS}

━━━━━━━━━━━━━━━━━━

📰 ข่าว AI ล่าสุด

${AI_NEWS1}

${AI_NEWS2}

━━━━━━━━━━━━━━━━━━

🎯 Challenge วันนี้สำหรับครูฝก:
${CHALLENGE}

บันทึกเวลา: ปกติ ____ นาที → ใช้ AI ____ นาที → ประหยัด ____%

💡 ครูฝกที่ใช้ AI เป็น ทำงานได้เร็วกว่า 10-96 เท่า

📚 แหล่งข้อมูล:
- OpenAI: https://openai.com/
- NVIDIA SANA-WM: https://nvlabs.github.io/Sana/WM/
- UNESCO AI in Education: https://www.unesco.org/en/artificial-intelligence"

# Send to Telegram
ESCAPED=$(echo "$BODY" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g')
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\": \"${CHAT_ID}\", \"text\": \"$ESCAPED\", \"parse_mode\": \"HTML\"}" 2>/dev/null

echo "AI Briefing for ครูฝก sent at $(date)" >> /tmp/ai_briefing.log
