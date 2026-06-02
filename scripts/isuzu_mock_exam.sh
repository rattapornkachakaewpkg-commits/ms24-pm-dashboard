#!/bin/bash
# Isuzu Auto Mechanic Skills Competition - Mock Exam 60 Questions
# Based on competition structure: Internal → Regional → National
# Reference: Isuzu Service Standards, Automotive Technician Standards

BOT_TOKEN="8737838944:AAGGINzL4LzPK6QjrvixcKUnUnT5-78cujY"
CHAT_ID="5050203997"
DATE=$(date +%d/%m/%Y)
HTML_DIR="/home/admin/.openclaw/workspace/isuzu_exam"

mkdir -p "$HTML_DIR"
HTML_FILE="$HTML_DIR/isuzu_mock_exam.html"

send_msg() {
    local msg="$1"
    local escaped=$(echo "$msg" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g')
    curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
        -H "Content-Type: application/json" \
        -d "{\"chat_id\": \"${CHAT_ID}\", \"text\": \"$escaped\", \"parse_mode\": \"HTML\"}" 2>/dev/null
    sleep 1
}

# Generate HTML with 60 questions covering all levels
cat > "$HTML_FILE" << 'HTMLSTART'
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Isuzu Auto Mechanic Skills Competition - Mock Exam</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Segoe UI',Tahoma,sans-serif;background:#1a1a2e;min-height:100vh;display:flex;justify-content:center;align-items:flex-start;padding:10px;}
        .quiz-container{max-width:700px;width:100%;background:#16213e;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.3);overflow:hidden;}
        .header{background:linear-gradient(135deg,#e94560 0%,#0f3460 100%);color:white;padding:16px;}
        .header h1{font-size:15px;margin-bottom:4px;}
        .header .subtitle{font-size:11px;opacity:0.9;}
        .progress-bar{background:#333;height:8px;border-radius:4px;margin:10px 0 6px;overflow:hidden;}
        .progress-fill{height:100%;background:#4fc3f7;border-radius:4px;transition:width 0.3s;}
        .progress-info{display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,0.8);}
        .score-display{display:flex;gap:8px;}
        .score-item{padding:2px 6px;border-radius:8px;font-size:10px;}
        .score-correct{background:rgba(76,175,80,0.3);color:#81c784;}
        .score-wrong{background:rgba(244,67,54,0.3);color:#e57373;}
        .level-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;margin-bottom:8px;}
        .level-beginner{background:#4caf50;color:white;}
        .level-intermediate{background:#ff9800;color:white;}
        .level-advanced{background:#f44336;color:white;}
        .question-area{padding:16px;}
        .question-number{font-size:12px;color:#888;margin-bottom:6px;}
        .question-text{font-size:15px;color:#e0e0e0;line-height:1.6;margin-bottom:16px;font-weight:500;}
        .options{display:flex;flex-direction:column;gap:8px;}
        .option-btn{display:flex;align-items:center;gap:10px;padding:12px;background:#1a1a2e;border:2px solid #333;border-radius:8px;cursor:pointer;transition:all 0.2s;width:100%;font-size:14px;color:#e0e0e0;text-align:left;}
        .option-btn:hover:not(.disabled){background:#0f3460;border-color:#e94560;}
        .option-btn.correct{background:#1b5e20;border-color:#4caf50;}
        .option-btn.wrong{background:#b71c1c;border-color:#f44336;}
        .option-btn.disabled{cursor:default;opacity:0.6;}
        .option-label{width:26px;height:26px;border-radius:50%;background:#333;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;flex-shrink:0;}
        .option-btn.correct .option-label{background:#4caf50;color:white;}
        .option-btn.wrong .option-label{background:#f44336;color:white;}
        .explanation{display:none;margin-top:14px;padding:12px;background:#0f3460;border-radius:8px;border-left:4px solid #e94560;}
        .explanation.show{display:block;}
        .explanation h4{color:#e94560;margin-bottom:6px;font-size:12px;}
        .explanation p{color:#ccc;line-height:1.6;font-size:12px;}
        .next-btn{display:none;width:100%;padding:12px;background:linear-gradient(135deg,#e94560 0%,#0f3460 100%);color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-top:14px;}
        .next-btn.show{display:block;}
        .results{display:none;padding:20px 16px;text-align:center;}
        .results.show{display:block;}
        .results .score-circle{width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,#e94560 0%,#0f3460 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 14px;color:white;}
        .results .score-circle .score-num{font-size:26px;font-weight:700;}
        .results .score-circle .score-total{font-size:11px;opacity:0.9;}
        .results h2{font-size:18px;color:#e0e0e0;margin-bottom:6px;}
        .results .grade{font-size:13px;color:#888;margin-bottom:16px;}
        .results .summary{text-align:left;background:#1a1a2e;border-radius:8px;padding:10px;margin-bottom:14px;max-height:300px;overflow-y:auto;}
        .results .summary h3{font-size:12px;color:#e0e0e0;margin-bottom:8px;}
        .result-item{display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px;color:#aaa;}
        .restart-btn{width:100%;padding:12px;background:linear-gradient(135deg,#e94560 0%,#0f3460 100%);color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;}
        @media(max-width:480px){.question-text{font-size:14px;}.option-btn{padding:10px;font-size:13px;}}
    </style>
</head>
<body>
    <div class="quiz-container">
        <div class="header">
            <h1>🔧 Isuzu Auto Mechanic Skills Competition</h1>
            <div class="subtitle">การแข่งขันทักษะช่างรถยนต์อีซูซุ | ระดับภายใน → ระดับประเทศ</div>
            <div class="progress-bar"><div class="progress-fill" id="progressFill" style="width:0%"></div></div>
            <div class="progress-info">
                <span id="qNum">1 / 60</span>
                <div class="score-display">
                    <span class="score-item score-wrong">✗ <span id="wrongCount">0</span></span>
                    <span class="score-item score-correct">✓ <span id="correctCount">0</span></span>
                </div>
            </div>
        </div>
        <div class="question-area" id="questionArea">
            <span class="level-badge" id="levelBadge">ระดับพื้นฐาน</span>
            <div class="question-number" id="questionNumber"></div>
            <div class="question-text" id="questionText"></div>
            <div class="options" id="optionsContainer"></div>
            <div class="explanation" id="explanation"><h4>💡 คำอธิบาย</h4><p id="explanationText"></p></div>
            <button class="next-btn" id="nextBtn" onclick="nextQuestion()">ถัดไป →</button>
        </div>
        <div class="results" id="resultsArea">
            <div class="score-circle"><span class="score-num" id="finalScore">0</span><span class="score-total">/ 60</span></div>
            <h2 id="resultTitle">เสร็จสิ้น!</h2>
            <div class="grade" id="resultGrade"></div>
            <div class="summary"><h3>📝 สรุปคำตอบ</h3><div id="summaryList"></div></div>
            <button class="restart-btn" onclick="restartQuiz()">🔄 ทำข้อสอบใหม่</button>
        </div>
    </div>
    <script>
HTMLSTART

# Generate all 60 questions covering all levels and positions
cat >> "$HTML_FILE" << 'QEOF'
        const questions = [
            // ============================================
            // LEVEL 1: BEGINNER - Internal Competition (ข้อ 1-20)
            // ============================================
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"เครื่องยนต์",question:"เครื่องยนต์ดีเซล Isuzu 4JJ1-TCX มีความจุกระบอกสูบเท่าใด?",options:["1,898 cc","2,499 cc","2,999 cc","3,000 cc"],answer:1,explain:"Isuzu 4JJ1-TCX มีความจุ 2,499 cc (2.5 ลิตร) เป็นเครื่องยนต์ดีเซลเทอร์โบ 4 สูบ แถวเรียง"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"เครื่องยนต์",question:"น้ำมันเครื่องที่เหมาะสมสำหรับเครื่องยนต์ Isuzu 4JJ1 คือข้อใด?",options:["SAE 5W-30","SAE 10W-30","SAE 15W-40","SAE 20W-50"],answer:2,explain:"เครื่องยนต์ดีเซล Isuzu 4JJ1 ใช้น้ำมันเครื่อง SAE 15W-40 API CI-4 ขึ้นไป (คู่มือแนะนำให้ใช้ Isuzu Genuine Oil)"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"ระบบส่งกำลัง",question:"เกียร์อัตโนมัติ Isuzu มีกี่สปีด?",options:["4 สปีด","5 สปีด","6 สปีด","8 สปีด"],answer:2,explain:"เกียร์อัตโนมัติ Isuzu รุ่นใหม่มี 6 สปีด (6-speed automatic transmission)"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"ระบบไฟฟ้า",question:"แบตเตอรี่รถยนต์ Isuzu D-Max มีแรงดันไฟฟ้าเท่าใด?",options:["6 โวลต์","12 โวลต์","24 โวลต์","48 โวลต์"],answer:1,explain:"รถยนต์ Isuzu D-Max ใช้แบตเตอรี่ 12 โวลต์ (เหมือนรถยนต์ทั่วไป)"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"ช่วงล่าง",question:"ระบบกันสะเทือนหลังของ Isuzu D-Max เป็นแบบใด?",options:["สปริงแผ่นเหล็ก (Leaf Spring)","คอยล์สปริง","ถุงลม","ไม่มี"},answer:0,explain:"Isuzu D-Max ใช้ระบบกันสะเทือนหลังแบบสปริงแผ่นเหล็ก (Leaf Spring) สำหรับรับน้ำหนักบรรทุก"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"เครื่องยนต์",question:"ระบบฉีดเชื้อเพลิงของ Isuzu 4JJ1 เป็นแบบใด?",options:["คาร์บูเรเตอร์","หัวฉีดธรรมดา","Common Rail","Direct Injection แบบกลไก"],answer:2,explain:"Isuzu 4JJ1 ใช้ระบบ Common Rail Direct Injection (CRDi) ฉีดเชื้อเพลิงแรงดันสูงผ่านหัวฉีดอิเล็กทรอนิกส์"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"ระบบเบรก",question:"ระบบเบรกของ Isuzu D-Max เป็นแบบใด?",options:["ดรัมเบรก 4 ล้อ","ดิสก์เบรก 4 ล้อ","ดิสก์หน้า-ดรัมหลัง","ดิสก์หน้า-ดิสก์หลัง"],answer:3,explain:"Isuzu D-Max รุ่นใหม่ใช้ดิสก์เบรกทั้ง 4 ล้อ พร้อมระบบ ABS"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"ระบบปรับอากาศ",question:"น้ำยาแอร์ที่ใช้ใน Isuzu D-Max รุ่นใหม่คือข้อใด?",options:["R-12","R-134a","R-1234yf","R-22"],answer:1,explain:"Isuzu D-Max ใช้น้ำยาแอร์ R-134a (บางรุ่นใหม่ใช้ R-1234yf)"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"เครื่องมือช่าง",question:"ประแจทอร์ค (Torque Wrench) ใช้สำหรับอะไร?",options:["ขันน็อตให้แน่นตามค่าที่กำหนด","วัดแรงดันยาง","วัดความหนาผ้าเบรก","วัดระดับน้ำมัน"],answer:0,explain:"ประแจทอร์คใช้ขันน็อต/โบลต์ให้ได้แรงบิดตามที่กำหนด (สำคัญมากสำหรับงานช่าง)"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"ความปลอดภัย",question:"ก่อนยกตัวรถด้วยแม่แรง ต้องทำอย่างไร?",options:["สตาร์ทเครื่องยนต์","ดึงเบรกมือและใส่ล้อรอง","เปิดแอร์","เติมน้ำมัน"],answer:1,explain:"ก่อนยกตัวรถ ต้องดึงเบรกมือ ใส่เกียร์ P (ออโต้) หรือเกียร์ 1 (ธรรมดา) และใส่ล้อรอง (Wheel Chock)"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"เครื่องยนต์",question:"เทอร์โบชาร์จเจอร์ทำหน้าที่อะไร?",options:["กรองอากาศ","อัดอากาศเข้ากระบอกสูบ","ระบายความร้อน","กรองน้ำมัน"],answer:1,explain:"เทอร์โบชาร์จเจอร์อัดอากาศเข้ากระบอกสูบเพิ่มกำลังเครื่องยนต์ โดยใช้ไอเสียหมุนกังหัน"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"ระบบระบายความร้อน",question:"เทอร์โมสตัททำหน้าที่อะไร?",options:["กรองน้ำ","ควบคุมอุณหภูมิน้ำหล่อเย็น","ปั๊มน้ำ","ระบายน้ำ"],answer:1,explain:"เทอร์โมสตัทควบคุมอุณหภูมิน้ำหล่อเย็น โดยเปิด-ปิดตามอุณหภูมิที่กำหนด (ปกติ ~82-88°C)"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"ระบบส่งกำลัง",question:"คลัตช์ (Clutch) ทำหน้าที่อะไร?",options:["เปลี่ยนเกียร์","ตัด-ต่อ กำลังจากเครื่องยนต์สู่เกียร์","เบรก","บังคับเลี้ยว"],answer:1,explain:"คลัตช์ตัด-ต่อ กำลังจากเครื่องยนต์สู่ระบบส่งกำลัง ใช้ตอนเปลี่ยนเกียร์หรือหยุดรถ"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"ระบบไฟฟ้า",question:"ไดชาร์จ (Alternator) ทำหน้าที่อะไร?",options:["สตาร์ทเครื่องยนต์","ผลิตไฟฟ้าชาร์จแบตเตอรี่","จุดระเบิด","จ่ายน้ำมัน"],answer:1,explain:"ไดชาร์จผลิตไฟฟ้าจากแรงหมุนเครื่องยนต์ เพื่อชาร์จแบตเตอรี่และจ่ายไฟฟ้าให้ระบบต่างๆ"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"เครื่องมือช่าง",question:"มัลติมิเตอร์ (Multimeter) วัดอะไรได้บ้าง?",options:["แรงดันไฟฟ้า, กระแสไฟฟ้า, ความต้านทาน","อุณหภูมิ, ความชื้น","แรงดันน้ำมัน, แรงดันลม","ความเร็ว, ระยะทาง"],answer:0,explain:"มัลติมิเตอร์วัดแรงดันไฟฟ้า (V), กระแสไฟฟ้า (A), ความต้านทาน (Ω) และอื่นๆ"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"ยางรถยนต์",question:"ความลึกดอกยางขั้นต่ำตามกฎหมายคือเท่าใด?",options:["0.5 มม.","1.0 มม.","1.6 มม.","2.0 มม."],answer:2,explain:"กฎหมายกำหนดความลึกดอกยางขั้นต่ำ 1.6 มม. (ควรเปลี่ยนเมื่อเหลือ 3 มม.)"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"น้ำมันหล่อลื่น",question:"API CI-4 หมายถึงอะไร?",options:["เกรดน้ำมันเกียร์","เกรดน้ำมันเครื่องดีเซล","เกรดน้ำมันเบรก","เกรดน้ำมันพวงมาลัย"],answer:1,explain:"API CI-4 คือเกรดน้ำมันเครื่องสำหรับเครื่องยนต์ดีเซล (C = Commercial/Diesel, I-4 = รุ่นที่ 4)"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"ระบบไอเสีย",question:"DPF (Diesel Particulate Filter) ทำหน้าที่อะไร?",options:["กรองน้ำมัน","กรองอนุภาคเขม่าจากไอเสีย","กรองอากาศ","กรองน้ำ"],answer:1,explain:"DPF กรองอนุภาคเขม่า (Soot) จากไอเสียเครื่องยนต์ดีเซล เพื่อลดมลพิษ"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"ระบบขับเคลื่อน",question:"ระบบขับเคลื่อน 4 ล้อของ Isuzu D-Max เรียกว่าอะไร?",options:["4WD","AWD","FWD","RWD"],answer:0,explain:"Isuzu D-Max ใช้ระบบขับเคลื่อน 4 ล้อ (4WD) สามารถเลือก 2H/4H/4L ได้"},
            {level:"beginner",levelText:"ระดับพื้นฐาน - แข่งขันภายในศูนย์",subject:"การบำรุงรักษา",question:"ระยะเปลี่ยนน้ำมันเครื่องครั้งแรกของ Isuzu D-Max ใหม่คือเท่าใด?",options:["1,000 กม.","5,000 กม.","10,000 กม.","15,000 กม."],answer:0,explain:"เปลี่ยนน้ำมันเครื่องครั้งแรกที่ 1,000 กม. (หรือ 1 เดือน) สำหรับรถใหม่ จากนั้นทุก 10,000 กม."},

            // ============================================
            // LEVEL 2: INTERMEDIATE - Regional Competition (ข้อ 21-40)
            // ============================================
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"เครื่องยนต์",question:"ค่า Compression ของเครื่องยนต์ Isuzu 4JJ1 ควรอยู่ที่ประมาณเท่าใด?",options:["100-150 PSI","200-250 PSI","300-350 PSI","400-450 PSI"],answer:2,explain:"เครื่องยนต์ดีเซล Isuzu 4JJ1 มีค่า Compression ประมาณ 300-350 PSI (20-24 bar)"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"ระบบฉีดเชื้อเพลิง",question:"แรงดันน้ำมันเชื้อเพลิงในระบบ Common Rail ของ Isuzu 4JJ1 สูงสุดเท่าใด?",options:["500 bar","1,000 bar","1,600 bar","2,000 bar"],answer:2,explain:"ระบบ Common Rail ของ Isuzu 4JJ1 มีแรงดันสูงสุด 1,600 bar (ประมาณ 23,200 PSI)"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"ระบบไฟฟ้า",question:"ECU ย่อมาจากอะไร?",options:["Engine Control Unit","Electronic Control Unit","Electric Current Unit","Energy Conversion Unit"],answer:1,explain:"ECU = Electronic Control Unit เป็นคอมพิวเตอร์ควบคุมการทำงานของเครื่องยนต์และระบบต่างๆ"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"ระบบเบรก",question:"ระบบ ABS ย่อมาจากอะไร?",options:["Auto Brake System","Anti-lock Braking System","Advanced Brake Sensor","Automatic Braking Support"],answer:1,explain:"ABS = Anti-lock Braking System ป้องกันล้อล็อกขณะเบรก ช่วยควบคุมทิศทางรถได้"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"เครื่องยนต์",question:"EGR (Exhaust Gas Recirculation) ทำหน้าที่อะไร?",options:["เพิ่มกำลังเครื่องยนต์","ลดอุณหภูมิไอเสีย","ลดการเกิด NOx โดยหมุนเวียนไอเสียกลับ","กรองไอเสีย"],answer:2,explain:"EGR หมุนเวียนไอเสียบางส่วนกลับเข้ากระบอกสูบ เพื่อลดอุณหภูมิการเผาไหม้และลดการเกิด NOx"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"ระบบส่งกำลัง",question:"เกียร์ธรรมดา Isuzu มีกี่สปีด?",options:["4 สปีด","5 สปีด","6 สปีด","7 สปีด"],answer:2,explain:"เกียร์ธรรมดา Isuzu D-Max รุ่นใหม่มี 6 สปีด (6-speed manual transmission)"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"ระบบปรับอากาศ",question:"คอมเพรสเซอร์แอร์ทำหน้าที่อะไร?",options:["กรองอากาศ","อัดน้ำยาแอร์ให้เป็นของเหลว","เป่าลมเย็น","ดูดความชื้น"],answer:1,explain:"คอมเพรสเซอร์อัดน้ำยาแอร์ (R-134a) จากแก๊สให้เป็นของเหลวแรงดันสูง เพื่อถ่ายเทความร้อน"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"เครื่องมือช่าง",question:"OBD-II Scanner ใช้สำหรับอะไร?",options:["วัดแรงดันยาง","อ่านโค้ดผิดพลาด (DTC) ของ ECU","วัดระดับน้ำมัน","วัดอุณหภูมิ"],answer:1,explain:"OBD-II Scanner อ่าน Diagnostic Trouble Code (DTC) จาก ECU เพื่อวินิจฉัยปัญหาเครื่องยนต์"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"เครื่องยนต์",question:"Intercooler ทำหน้าที่อะไร?",options:["กรองอากาศ","ลดอุณหภูมิอากาศที่อัดโดยเทอร์โบ","กรองน้ำมัน","ระบายความร้อนเครื่องยนต์"],answer:1,explain:"Intercooler ลดอุณหภูมิอากาศที่อัดโดยเทอร์โบcharger ทำให้อากาศหนาแน่นขึ้น เพิ่มกำลังเครื่องยนต์"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"ระบบไฟฟ้า",question:"เซ็นเซอร์ MAP ย่อมาจากอะไร?",options:["Manifold Absolute Pressure","Motor Acceleration Position","Main Air Pump","Maximum Air Pressure"],answer:0,explain:"MAP = Manifold Absolute Pressure วัดความดันในท่อร่วมไอดี เพื่อ ECU คำนวณปริมาณน้ำมันเชื้อเพลิง"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"ช่วงล่าง",question:"ระบบ EPS ย่อมาจากอะไร?",options:["Engine Power System","Electric Power Steering","Electronic Performance System","Emergency Power Supply"],answer:1,explain:"EPS = Electric Power Steering ระบบพวงมาลัยเพาเวอร์ไฟฟ้า ช่วยลดแรงหมุนพวงมาลัย"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"เครื่องยนต์",question:"VGS Turbo ย่อมาจากอะไร?",options:["Variable Geometry System Turbo","Very Good Speed Turbo","Variable Gas Supply Turbo","Vacuum Generated System"],answer:0,explain:"VGS = Variable Geometry System Turbo เป็นเทอร์โบแบบปรับครีบได้ เพิ่มแรงบิดในรอบต่ำและกำลังในรอบสูง"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"ระบบส่งกำลัง",question:"Differential (เฟืองท้าย) ทำหน้าที่อะไร?",options:["เปลี่ยนเกียร์","แบ่งกำลังขับสู่ล้อซ้าย-ขวา","เบรก","พวงมาลัย"],answer:1,explain:"เฟืองท้ายแบ่งกำลังขับจากเพลาขับสู่ล้อซ้าย-ขวา และอนุญาตให้ล้อหมุนด้วยความเร็วต่างกันได้เวลาเลี้ยว"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"ระบบเบรก",question:"ระบบ ESC ย่อมาจากอะไร?",options:["Engine Speed Control","Electronic Stability Control","Emergency Stop Control","Electric System Check"],answer:1,explain:"ESC = Electronic Stability Control ควบคุมการทรงตัวของรถ โดยเบรกแต่ละล้อและลดกำลังเครื่องยนต์อัตโนมัติ"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"เครื่องยนต์",question:"AdBlue/DEF คืออะไร?",options:["น้ำมันเครื่อง","น้ำยาเติมในระบบ SCR เพื่อลด NOx","น้ำยาแอร์","น้ำมันเบรก"],answer:1,explain:"AdBlue/DEF (Diesel Exhaust Fluid) เป็นสารละลาย Urea 32.5% เติมในระบบ SCR เพื่อลดก๊าซ NOx ในไอเสีย"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"ระบบไฟฟ้า",question:"เซ็นเซอร์ CKP ย่อมาจากอะไร?",options:["Crankshaft Position","Camshaft Key Point","Coolant Knowledge Point","Current Knowledge Program"],answer:0,explain:"CKP = Crankshaft Position Sensor วัดตำแหน่งและความเร็วของเพลาข้อเหวี่ยง ส่งสัญญาณให้ ECU"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"เครื่องยนต์",question:"ค่าแรงบิดสูงสุดของ Isuzu 4JJ1-TCX คือเท่าใด?",options:["280 Nm","320 Nm","360 Nm","400 Nm"],answer:2,explain:"Isuzu 4JJ1-TCX ให้แรงบิดสูงสุด 360 Nm ที่ 1,800-2,800 rpm"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"ระบบระบายความร้อน",question:"พัดลมระบายความร้อนเครื่องยนต์ทำงานเมื่อใด?",options:["ตลอดเวลา","เมื่อน้ำหล่อเย็นร้อนเกินกำหนด","เมื่อเปิดแอร์","เมื่อสตาร์ทเครื่อง"],answer:1,explain:"พัดลมระบายความร้อนทำงานเมื่อน้ำหล่อเย็นร้อนเกินอุณหภูมิที่กำหนด (ปกติ ~90-95°C) หรือเมื่อเปิดแอร์"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"เครื่องมือช่าง",question:"Borescope ใช้สำหรับอะไร?",options:["วัดแรงดัน","ส่องดูภายในกระบอกสูบ/ท่อ","วัดอุณหภูมิ","วัดแรงบิด"],answer:1,explain:"Borescope เป็นกล้องส่องดูภายในกระบอกสูบ วาล์ว ท่อไอเสีย โดยไม่ต้องถอดเครื่องยนต์"},
            {level:"intermediate",levelText:"ระดับกลาง - แข่งขันระดับภูมิภาค",subject:"การบำรุงรักษา",question:"ระยะตรวจเช็คสายพานไทม์มิ่งของ Isuzu D-Max คือเท่าใด?",options:["ทุก 20,000 กม.","ทุก 40,000 กม.","ทุก 60,000 กม.","ทุก 100,000 กม."],answer:2,explain:"ตรวจเช็คสายพานไทม์มิ่งทุก 60,000 กม. หรือ 4 ปี (เปลี่ยนเมื่อพบรอยแตกหรือสึก)"},

            // ============================================
            // LEVEL 3: ADVANCED - National Competition (ข้อ 41-60)
            // ============================================
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"เครื่องยนต์",question:"ค่า Injection Timing ของเครื่องยนต์ Isuzu 4JJ1 คือข้อใด?",options:["BTDC 5°","BTDC 10°","ควบคุมโดย ECU อัตโนมัติ","BTDC 15°"],answer:2,explain:"เครื่องยนต์ Common Rail ควบคุม Injection Timing โดย ECU อัตโนมัติ ตามสภาวะการทำงาน (ไม่ได้ตั้งค่าตายตัว)"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"ระบบฉีดเชื้อเพลิง",question:"Injector ในระบบ Common Rail ทำงานอย่างไร?",options:["เปิดด้วยสุญญากาศ","เปิดด้วยสัญญาณไฟฟ้าจาก ECU","เปิดด้วยแรงดันน้ำมัน","เปิดด้วยกลไก"],answer:1,explain:"หัวฉีด Common Rail เปิด-ปิดด้วยสัญญาณไฟฟ้าจาก ECU (Solenoid หรือ Piezo) แม่นยำสูง"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"ระบบไฟฟ้า",question:"CAN Bus ย่อมาจากอะไร?",options:["Central Area Network","Controller Area Network","Computer Access Node","Current Allocation Network"],answer:1,explain:"CAN Bus = Controller Area Network ระบบสื่อสารระหว่าง ECU ต่างๆ ในรถยนต์"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"เครื่องยนต์",question:"DPF Regeneration มีกี่แบบ?",options:["1 แบบ","2 แบบ (Passive และ Active)","3 แบบ","4 แบบ"],answer:1,explain:"DPF Regeneration มี 2 แบบ: Passive (เผาเขม่าขณะขับขี่ปกติ) และ Active (ECU สั่งฉีดน้ำมันเพิ่มเพื่อเผาเขม่า)"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"ระบบส่งกำลัง",question:"ระบบ Shift-by-Wire คืออะไร?",options:["เกียร์ธรรมดา","เกียร์อัตโนมัติแบบควบคุมด้วยไฟฟ้า","เกียร์ CVT","เกียร์ DCT"],answer:1,explain:"Shift-by-Wire เป็นระบบเปลี่ยนเกียร์ด้วยสัญญาณไฟฟ้า (แทนสายเกียร์กลไก) พบในเกียร์อัตโนมัติรุ่นใหม่"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"เครื่องยนต์",question:"ค่า AFR (Air-Fuel Ratio) ที่เหมาะสมสำหรับเครื่องยนต์ดีเซลคือเท่าใด?",options:["14.7:1","18-20:1","25-30:1","40-50:1"],answer:2,explain:"เครื่องยนต์ดีเซลทำงานที่ AFR 25-30:1 (lean burn) ขณะที่เครื่องยนต์เบนซิน 14.7:1 (stoichiometric)"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"ระบบเบรก",question:"ระบบ Brake Assist ทำหน้าที่อะไร?",options:["เพิ่มแรงเบรกอัตโนมัติเมื่อเหยียบแรง","ลดแรงเบรก","เบรกอัตโนมัติ","ตรวจสอบผ้าเบรก"],answer:0,explain:"Brake Assist ตรวจจับการเหยียบเบรกฉุกเฉิน และเพิ่มแรงดันน้ำมันเบรกอัตโนมัติ ให้หยุดรถได้เร็วขึ้น"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"เครื่องยนต์",question:"Turbo Lag คืออะไร?",options:["เทอร์โบเสีย","ความล่าช้าในการตอบสนองของเทอร์โบ","เทอร์โบทำงานเร็วเกินไป","เทอร์โบไม่มี"],answer:1,explain:"Turbo Lag คือความล่าช้าในการตอบสนองของเทอร์โบcharger ขณะเร่งเครื่องยนต์ (กว่าเทอร์โบจะหมุนทัน)"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"ระบบไฟฟ้า",question:"เซ็นเซอร์ Lambda (O₂ Sensor) ทำหน้าที่อะไร?",options:["วัดอุณหภูมิ","วัดปริมาณออกซิเจนในไอเสีย","วัดแรงดัน","วัดความเร็ว"],answer:1,explain:"เซ็นเซอร์ Lambda วัดปริมาณออกซิเจนในไอเสีย เพื่อ ECU ปรับส่วนผสมน้ำมันเชื้อเพลิงให้เหมาะสม"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"เครื่องยนต์",question:"EGR Cooler ทำหน้าที่อะไร?",options:["ทำความร้อนไอเสีย","ลดอุณหภูมิไอเสียก่อนกลับเข้ากระบอกสูบ","กรองไอเสีย","เพิ่มแรงดันไอเสีย"],answer:1,explain:"EGR Cooler ลดอุณหภูมิไอเสียก่อนกลับเข้ากระบอกสูบ เพื่อลดอุณหภูมิการเผาไหม้และลด NOx"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"ระบบส่งกำลัง",question:"ระบบ Hill Start Assist ทำหน้าที่อะไร?",options:["ช่วยสตาร์ทบนเนิน","ป้องกันรถไหลถอยหลังขณะออกตัวบนเนิน","เพิ่มกำลังเครื่องยนต์","ลดแรงเสียดทาน"],answer:1,explain:"Hill Start Assist ค้างแรงดันเบรกชั่วคราว (~2 วินาที) ขณะย้ายเท้าจากเบรกไปคันเร่ง บนทางชัน"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"เครื่องยนต์",question:"ค่า Cetane Number ของน้ำมันดีเซลที่เหมาะสมคือเท่าใด?",options:["30-35","40-45","51 ขึ้นไป","60 ขึ้นไป"],answer:2,explain:"น้ำมันดีเซลควรมีค่า Cetane Number ≥ 51 (ยิ่งสูง จุดระเบิด越好 สตาร์ทง่าย)"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"ระบบไฟฟ้า",question:"Immobilizer System ทำหน้าที่อะไร?",options:["ล็อครถ","ป้องกันไม่ให้สตาร์ทโดยไม่ใช้กุญแจที่ถูกต้อง","ตรวจสอบแบตเตอรี่","ควบคุมความเร็ว"],answer:1,explain:"Immobilizer ป้องกันการขโมยรถ โดยไม่อนุญาตให้สตาร์ทเครื่องยนต์หากไม่ใช้กุญแจ/สมาร์ทคีย์ที่ถูกต้อง"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"เครื่องยนต์",question:"VNT Turbo ย่อมาจากอะไร?",options:["Variable Nozzle Turbo","Very New Turbo","Vacuum Neutral Turbo","Variable Noise Turbo"],answer:0,explain:"VNT = Variable Nozzle Turbo เป็นเทอร์โบแบบปรับครีบ (Nozzle) ได้ เหมือน VGS ของ Isuzu"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"ระบบเบรก",question:"ระบบ AEB ย่อมาจากอะไร?",options:["Auto Emergency Brake","Advanced Engine Brake","Automatic Electric Brake","All Emergency Brake"],answer:0,explain:"AEB = Autonomous Emergency Braking ระบบเบรกฉุกเฉินอัตโนมัติ ตรวจจับวัตถุข้างหน้าและเบรกอัตโนมัติ"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"เครื่องยนต์",question:"ค่า Blow-by คืออะไร?",options:["แรงดันน้ำมัน","ก๊าซที่รั่วจากกระบอกสูบสู่แคร้งค์เคส","แรงดันไอเสีย","อุณหภูมิไอเสีย"],answer:1,explain:"Blow-by คือก๊าซที่รั่วจากกระบอกสูบผ่านแหวนลูกสูบลงสู่แคร้งค์เคส บ่งบอกสภาพแหวนลูกสูบ"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"ระบบไฟฟ้า",question:"ระบบ Start-Stop ทำหน้าที่อะไร?",options:["สตาร์ทอัตโนมัติ","ดับเครื่องยนต์อัตโนมัติขณะจอด ลดการสิ้นเปลือง","เร่งความเร็ว","เบรกอัตโนมัติ"],answer:1,explain:"Start-Stop ดับเครื่องยนต์อัตโนมัติขณะจอด (เช่น ไฟแดง) และสตาร์ทใหม่เมื่อปล่อยเบรก ลดการสิ้นเปลืองน้ำมัน"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"เครื่องยนต์",question:"ค่า Back Pressure ของท่อไอเสียสูงเกินไป ส่งผลอย่างไร?",options:["กำลังเครื่องยนต์ลดลง","กำลังเครื่องยนต์เพิ่มขึ้น","ไม่ส่งผล","ประหยัดน้ำมันขึ้น"],answer:0,explain:"Back Pressure สูงเกินไป = ไอเสียออกยาก = เครื่องยนต์อืด กำลังลดลง ประหยัดน้ำมันลดลง"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"ระบบส่งกำลัง",question:"ระบบ Torque Converter ทำหน้าที่อะไร?",options:["เปลี่ยนเกียร์","ส่งกำลังจากเครื่องยนต์สู่เกียร์อัตโนมัติด้วยของไหล","เบรก","พวงมาลัย"],answer:1,explain:"Torque Converter ส่งกำลังจากเครื่องยนต์สู่เกียร์อัตโนมัติ โดยใช้ของไหล (Transmission Fluid) แทนคลัตช์"},
            {level:"advanced",levelText:"ระดับสูง - แข่งขันระดับประเทศ",subject:"การวินิจฉัย",question:"เมื่อพบ DTC P0401 หมายความว่าอย่างไร?",options:["ปัญหาเทอร์โบ","ปัญหา EGR Flow Insufficient","ปัญหาหัวฉีด","ปัญหาแบตเตอรี่"],answer:1,explain:"P0401 = EGR Flow Insufficient Detected (การไหลของ EGR ไม่เพียงพอ) อาจเกิดจากท่ออุดตัน วาล์วเสีย"}
        ];
QEOF

# Add JavaScript for quiz functionality
cat >> "$HTML_FILE" << 'JSSTART'
        let currentQ = 0;
        let correct = 0;
        let wrong = 0;
        let answered = false;
        let userAnswers = [];

        function loadQuestion() {
            answered = false;
            const q = questions[currentQ];
            
            // Update level badge
            const badge = document.getElementById('levelBadge');
            badge.textContent = q.levelText;
            badge.className = 'level-badge level-' + q.level;
            
            document.getElementById('questionNumber').textContent = `ข้อที่ ${currentQ + 1}/60 [${q.subject}]`;
            document.getElementById('questionText').textContent = q.question;
            document.getElementById('qNum').textContent = `${currentQ + 1} / 60`;
            document.getElementById('progressFill').style.width = `${(currentQ / 60) * 100}%`;
            
            const container = document.getElementById('optionsContainer');
            container.innerHTML = '';
            const labels = ['ก', 'ข', 'ค', 'ง'];
            q.options.forEach((opt, i) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.innerHTML = `<span class="option-label">${labels[i]}</span><span>${opt}</span>`;
                btn.onclick = () => selectAnswer(i);
                container.appendChild(btn);
            });
            
            document.getElementById('explanation').classList.remove('show');
            document.getElementById('nextBtn').classList.remove('show');
        }

        function selectAnswer(index) {
            if (answered) return;
            answered = true;
            const q = questions[currentQ];
            const btns = document.querySelectorAll('.option-btn');
            
            btns.forEach((btn, i) => {
                btn.classList.add('disabled');
                if (i === q.answer) btn.classList.add('correct');
                else if (i === index && i !== q.answer) btn.classList.add('wrong');
            });
            
            if (index === q.answer) {
                correct++;
                document.getElementById('correctCount').textContent = correct;
            } else {
                wrong++;
                document.getElementById('wrongCount').textContent = wrong;
            }
            
            userAnswers.push({question: q.question, user: index, correct: q.answer, isCorrect: index === q.answer, subject: q.subject, level: q.level});
            document.getElementById('explanationText').textContent = q.explain;
            document.getElementById('explanation').classList.add('show');
            document.getElementById('nextBtn').classList.add('show');
        }

        function nextQuestion() {
            currentQ++;
            if (currentQ < questions.length) loadQuestion();
            else showResults();
        }

        function showResults() {
            document.getElementById('questionArea').style.display = 'none';
            document.getElementById('resultsArea').classList.add('show');
            document.getElementById('finalScore').textContent = correct;
            
            const percent = (correct / 60) * 100;
            let grade = '';
            if (percent >= 80) grade = '🏆 ผ่านเกณฑ์ระดับประเทศ! พร้อมแข่งขัน!';
            else if (percent >= 60) grade = '👍 ผ่านเกณฑ์ระดับภูมิภาค ควรฝึกเพิ่ม';
            else if (percent >= 40) grade = '📚 ผ่านเกณฑ์ระดับภายใน ต้องทบทวนเพิ่ม';
            else grade = '💪 ต้องฝึกอีกมาก! อ่านคู่มือ Isuzu เพิ่ม';
            
            document.getElementById('resultGrade').textContent = grade;
            
            const labels = ['ก', 'ข', 'ค', 'ง'];
            let summary = '';
            userAnswers.forEach((a, i) => {
                const icon = a.isCorrect ? '✅' : '❌';
                summary += `<div class="result-item"><span class="icon">${icon}</span> ข้อ ${i+1} (${a.subject} - ${a.level}): ตอบ ${labels[a.user]} / เฉลย ${labels[a.correct]}</div>`;
            });
            document.getElementById('summaryList').innerHTML = summary;
        }

        function restartQuiz() {
            currentQ = 0; correct = 0; wrong = 0; userAnswers = [];
            document.getElementById('correctCount').textContent = '0';
            document.getElementById('wrongCount').textContent = '0';
            document.getElementById('questionArea').style.display = 'block';
            document.getElementById('resultsArea').classList.remove('show');
            loadQuestion();
        }

        loadQuestion();
JSSTART

cat >> "$HTML_FILE" << 'HTMLEND'
    </script>
</body>
</html>
HTMLEND

# Send message with instructions
send_msg "🔧 Isuzu Auto Mechanic Skills Competition
━━━━━━━━━━━━━━━━━━

📅 $DATE | 60 ข้อ
🎯 มาตรฐาน: แข่งขันทักษะช่างอีซูซุ
📊 ระดับ: ภายในศูนย์ → ระดับภูมิภาค → ระดับประเทศ

📌 วิธีทำ:
1. ดาวน์โหลดไฟล์ HTML ด้านล่าง
2. เปิดในเบราว์เซอร์ (Chrome/Safari)
3. ทำข้อสอบ 60 ข้อ แบบ Interactive
4. กดเลือกคำตอบ → รู้ผลทันที + คำอธิบาย
5. ดูสรุปผลท้ายข้อสอบ

⏱️ เวลา: 90 นาที (ข้อละ 1.5 นาที)
🎯 เกณฑ์ผ่าน:
• 80%+ = ผ่านระดับประเทศ 🏆
• 60%+ = ผ่านระดับภูมิภาค 👍
• 40%+ = ผ่านระดับภายใน 📚

 เป้าหมาย: สอบแข่งขันช่างอีซูซุ!"

sleep 1

# Send HTML file
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendDocument" \
    -F "chat_id=${CHAT_ID}" \
    -F "document=@${HTML_FILE}" \
    -F "caption=🔧 Isuzu Mock Exam 60 ข้อ
📊 3 ระดับ: Beginner → Intermediate → Advanced
📌 ดาวน์โหลดและเปิดในเบราว์เซอร์" 2>/dev/null

echo "Isuzu Mock Exam 60 questions sent at $(date)"