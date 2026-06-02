import json
import random
import os
from datetime import datetime

# Config
OUTPUT_DIR = "/home/admin/.openclaw/workspace/exams"
HISTORY_FILE = os.path.join(OUTPUT_DIR, "exam_history.json")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Initialize history
if not os.path.exists(HISTORY_FILE):
    with open(HISTORY_FILE, 'w') as f:
        json.dump({"sent_ids": []}, f)

def load_history():
    with open(HISTORY_FILE, 'r') as f:
        return set(json.load(f)["sent_ids"])

def save_history(new_ids):
    with open(HISTORY_FILE, 'r') as f:
        data = json.load(f)
    data["sent_ids"].extend(new_ids)
    with open(HISTORY_FILE, 'w') as f:
        json.dump(data, f)

def get_subject_for_today():
    day = datetime.now().weekday() # 0=Mon, 1=Tue...
    subjects = ["Math", "Science", "English", "Thai", "Social", "Science", "Math"]
    return subjects[day]

# --- QUESTION BANKS (Science Sample) ---
SCIENCE_BANK = [
    {"id": "S01", "q": "อวัยวะใดทำหน้าที่กำจัดของเสียในรูปของแก๊สคาร์บอนไดออกไซด์?", "o": ["ปอด", "ไต", "ผิวหนัง", "ลำไส้ใหญ่"], "a": 0, "exp": "ปอดทำหน้าที่แลกเปลี่ยนแก๊ส ขจัด CO2 ออกจากเลือด"},
    {"id": "S02", "q": "ข้อใดเป็นการเปลี่ยนแปลงทางเคมี?", "o": ["น้ำแข็งละลาย", "เทียนไขละลาย", "เหล็กเป็นสนิม", "การฉีกกระดาษ"], "a": 2, "exp": "เหล็กเป็นสนิม เกิดสารใหม่คือออกไซด์ของเหล็ก"},
    {"id": "S03", "q": "ดาวเคราะห์ดวงใดอยู่ห่างจากดวงอาทิตย์มากที่สุด?", "o": ["ดาวเสาร์", "ดาวยูเรนัส", "ดาวเนปจูน", "ดาวพลูโต"], "a": 2, "exp": "ดาวเนปจูนเป็นดาวเคราะห์ลำดับที่ 8 (ไกลสุดในระบบสุริยะ)"},
    {"id": "S04", "q": "แสงเดินทางผ่านตัวกลางใดได้ช้าที่สุด?", "o": ["สุญญากาศ", "อากาศ", "น้ำ", "เพชร"], "a": 3, "exp": "เพชรมีความหนาแน่นมากที่สุด แสงจึงเดินทางช้าที่สุด"},
    {"id": "S05", "q": "พืชในข้อใดมีการคายน้ำน้อยที่สุด?", "o": ["ผักบุ้ง", "กระบองเพชร", "ข้าว", "บัว"], "a": 1, "exp": "กระบองเพชรปรับตัวโดยเปลี่ยนใบเป็นหนามเพื่อลดการคายน้ำ"},
    {"id": "S06", "q": "แรงเสียดทานมีทิศทางอย่างไร?", "o": ["ทิศเดียวกับการเคลื่อนที่", "ทิศตรงข้ามกับการเคลื่อนที่", "ทิศตั้งฉากกับพื้น", "ทิศลงสู่พื้น"], "a": 1, "exp": "แรงเสียดทานจะต้านการเคลื่อนที่เสมอ"},
    {"id": "S07", "q": "สารละลายใดมีค่า pH น้อยกว่า 7?", "o": ["น้ำสบู่", "น้ำมะนาว", "น้ำกลั่น", "น้ำยาล้างจาน"], "a": 1, "exp": "น้ำมะนาวเป็นกรด (pH < 7)"},
    {"id": "S08", "q": "ขั้นตอนแรกในกระบวนการทางวิทยาศาสตร์คืออะไร?", "o": ["ตั้งสมมติฐาน", "กำหนดปัญหา", "ทดลอง", "สรุปผล"], "a": 1, "exp": "ต้องระบุปัญหา/ข้อสงสัย ก่อนทำขั้นตอนอื่น"},
    {"id": "S09", "q": "อวัยวะใดสร้างน้ำย่อยและกรดเกลือ?", "o": ["ปาก", "กระเพาะอาหาร", "ลำไส้เล็ก", "ตับ"], "a": 1, "exp": "กระเพาะอาหารหลั่งกรด HCl และเปปซิน"},
    {"id": "S10", "q": "พลังงานแสงอาทิตย์เปลี่ยนเป็นพลังงานความร้อนได้ด้วยอุปกรณ์ใด?", "o": ["เซลล์สุริยะ", "เครื่องทำน้ำอุ่นแสงอาทิตย์", "พัดลม", "แบตเตอรี่"], "a": 1, "exp": "แผงรับความร้อนทำหน้าที่ดูดกลืนแสงเป็นความร้อน"},
    {"id": "S11", "q": "หินชนิดใดเกิดจากลาวาเย็นตัวลง?", "o": ["หินชั้น", "หินแปร", "หินอัคนี", "หินปูน"], "a": 2, "exp": "หินอัคนีเกิดจากการเย็นตัวของหินหลอมเหลว"},
    {"id": "S12", "q": "ระบบนิเวศใดมีความหลากหลายทางชีวภาพมากที่สุด?", "o": ["ป่าดิบชื้น", "ป่าผลัดใบ", "ทุ่งหญ้า", "ทะเลทราย"], "a": 0, "exp": "ป่าดิบชื้นอุดมสมบูรณ์ที่สุด"},
    {"id": "S13", "q": "ข้อใดคือผู้บริโภคอันดับที่ 1?", "o": ["เสือ", "กระต่าย", "หญ้า", "นกอินทรี"], "a": 1, "exp": "กระต่ายกินพืช (ผู้ผลิต) จึงเป็นผู้บริโภคอันดับ 1"},
    {"id": "S14", "q": "หน่วยวัดความต่างศักย์ไฟฟ้าคืออะไร?", "o": ["แอมแปร์", "โอห์ม", "โวลต์", "วัตต์"], "a": 2, "exp": "โวลต์ (Volt) คือหน่วยความต่างศักย์"},
    {"id": "S15", "q": "แม่เหล็กดูดวัตถุใดได้?", "o": ["ทองแดง", "พลาสติก", "ตะปูเหล็ก", "ไม้"], "a": 2, "exp": "เหล็กเป็นสารแม่เหล็ก"},
    {"id": "S16", "q": "น้ำเปลี่ยนสถานะเป็นไอที่อุณหภูมิเท่าใด?", "o": ["0 องศา", "50 องศา", "100 องศา", "200 องศา"], "a": 2, "exp": "จุดเดือดของน้ำคือ 100 องศาเซลเซียส"},
    {"id": "S17", "q": "ดาวฤกษ์ที่อยู่ใกล้โลกที่สุดคือ?", "o": ["ดาวซิริอุส", "ดวงอาทิตย์", "ดาวเหนือ", "ดาวพร็อกซิมา"], "a": 1, "exp": "ดวงอาทิตย์เป็นดาวฤกษ์ที่อยู่ใกล้โลกที่สุด"},
    {"id": "S18", "q": "แก๊สใดทำให้เกิดภาวะเรือนกระจกมากที่สุด?", "o": ["ออกซิเจน", "ไนโตรเจน", "คาร์บอนไดออกไซด์", "ฮีเลียม"], "a": 2, "exp": "CO2 กักเก็บความร้อนทำให้เกิดภาวะเรือนกระจก"},
    {"id": "S19", "q": "ส่วนประกอบใดไม่พบในเซลล์สัตว์?", "o": ["นิวเคลียส", "ผนังเซลล์", "ไซโทพลาซึม", "เยื่อหุ้มเซลล์"], "a": 1, "exp": "ผนังเซลล์พบในเซลล์พืช ไม่พบในสัตว์"},
    {"id": "S20", "q": "เสียงเดินทางผ่านตัวกลางใดได้เร็วที่สุด?", "o": ["อากาศ", "น้ำ", "เหล็ก", "สุญญากาศ"], "a": 2, "exp": "เสียงเดินทางในของแข็ง (เหล็ก) ได้ดีกว่าของเหลวและแก๊ส"},
    {"id": "S21", "q": "ปรากฏการณ์น้ำขึ้นน้ำลงเกิดจากแรงดึงดูดของอะไร?", "o": ["ดวงอาทิตย์", "ดวงจันทร์", "โลก", "ดาวอังคาร"], "a": 1, "exp": "ดวงจันทร์มีอิทธิพลต่อน้ำขึ้นน้ำลงมากที่สุด"},
    {"id": "S22", "q": "การถ่ายละอองเรณูหมายถึงอะไร?", "o": ["สเปิร์มผสมไข่", "ละอองเรณูร่วงลงบนยอดเกสรเพศเมีย", "ผลแตกออก", "เมล็ดงอก"], "a": 1, "exp": "คือการที่เรณูตกลงบนยอดเกสรตัวเมีย"},
    {"id": "S23", "q": "อาหารหมู่ใดให้พลังงานมากที่สุดต่อ 1 กรัม?", "o": ["คาร์โบไฮเดรต", "โปรตีน", "ไขมัน", "วิตามิน"], "a": 2, "exp": "ไขมันให้พลังงาน 9 แคลอรี/กรัม (สูงสุด)"},
    {"id": "S24", "q": "โรคใดเกิดจากเชื้อไวรัส?", "o": ["อหิวาตกโรค", "ไข้หวัดใหญ่", "วัณโรค", "บิด"], "a": 1, "exp": "ไข้หวัดใหญ่เกิดจากไวรัส Influenza"},
    {"id": "S25", "q": "ชั้นบรรยากาศใดมีแก๊สโอโซนหนาแน่น?", "o": ["โทรโพสเฟียร์", "สตราโตสเฟียร์", "มีโซสเฟียร์", "เทอร์โมสเฟียร์"], "a": 1, "exp": "ชั้นโอโซนอยู่ในสตราโตสเฟียร์"},
    {"id": "S26", "q": "อุปกรณ์ใดใช้ต่อวงจรไฟฟ้าเพื่อเปิด-ปิดกระแส?", "o": ["ฟิวส์", "สวิตช์", "ตัวต้านทาน", "หม้อแปลง"], "a": 1, "exp": "สวิตช์ใช้ตัดต่อวงจร"},
    {"id": "S27", "q": "รากทำหน้าที่หลักอะไร?", "o": ["สังเคราะห์แสง", "ดูดน้ำและแร่ธาตุ", "สืบพันธุ์", "ลำเลียงอาหาร"], "a": 1, "exp": "รากดูดน้ำและแร่ธาตุจากดิน"},
    {"id": "S28", "q": "สัตว์ใดเป็นสัตว์เลือดเย็น?", "o": ["นกเพนกวิน", "จระเข้", "ปลาวาฬ", "ค้างคาว"], "a": 1, "exp": "จระเข้เป็นสัตว์เลื้อยคลาน เลือดเย็น"},
    {"id": "S29", "q": "ปฏิกิริยาเคมีประเภทใดมีการปล่อยความร้อนออกมา?", "o": ["ดูดความร้อน", "คายความร้อน", "สมดุล", "การระเหย"], "a": 1, "exp": "ปฏิกิริยาคายความร้อนจะปล่อยพลังงานความร้อนออกมา"},
    {"id": "S30", "q": "ข้อใดคือทรัพยากรธรรมชาติที่ใช้แล้วหมดไป?", "o": ["แสงแดด", "ลม", "แร่ธาตุ", "น้ำ"], "a": 2, "exp": "แร่ธาตุใช้แล้วหมดไป สร้างใหม่ไม่ได้ในระยะสั้น"},
    {"id": "S31", "q": "เซลล์เม็ดเลือดขาวทำหน้าที่อะไร?", "o": ["ลำเลียง O2", "จับตัวเป็นลิ่ม", "ทำลายเชื้อโรค", "ลำเลียงอาหาร"], "a": 2, "exp": "เม็ดเลือดขาวทำลายเชื้อโรค"},
    {"id": "S32", "q": "ดวงจันทร์ใช้เวลากี่วันในการโคจรรอบโลก?", "o": ["1 วัน", "7 วัน", "27.3 วัน", "365 วัน"], "a": 2, "exp": "ใช้เวลาประมาณ 27.3 วัน"},
    {"id": "S33", "q": "ข้อใดคือการใช้ทรัพยากรธรรมชาติอย่างคุ้มค่า?", "o": ["ตัดไม้ทำลายป่า", "ทิ้งขยะลงแม่น้ำ", "การใช้ถุงผ้า", "ล่าสัตว์ป่า"], "a": 2, "exp": "การใช้ถุงผ้าช่วยลดขยะ"},
    {"id": "S34", "q": "แรงโน้มถ่วงของโลกมีค่าเท่าใด?", "o": ["1.6 m/s2", "9.8 m/s2", "15.2 m/s2", "25.0 m/s2"], "a": 1, "exp": "ค่า g บนผิวโลกประมาณ 9.8 m/s2"},
    {"id": "S35", "q": "น้ำแข็งลอยน้ำได้เพราะเหตุใด?", "o": ["เบากว่าน้ำ", "ความหนาแน่นน้อยกว่าน้ำ", "มีฟองอากาศ", "แข็งกว่าน้ำ"], "a": 1, "exp": "น้ำแข็งมีความหนาแน่นน้อยกว่าน้ำเหลว"},
    {"id": "S36", "q": "ระบบย่อยอาหารเริ่มทำงานที่อวัยวะใด?", "o": ["ปาก", "กระเพาะ", "ลำไส้เล็ก", "ลำไส้ใหญ่"], "a": 0, "exp": "เริ่มที่ปาก (ฟันบดเคี้ยว น้ำลายย่อยแป้ง)"},
    {"id": "S37", "q": "พลังงานลมเปลี่ยนเป็นพลังงานไฟฟ้าด้วยอุปกรณ์ใด?", "o": ["กังหันลม", "เซลล์สุริยะ", "แบตเตอรี่", "ไดนาโมรถยนต์"], "a": 0, "exp": "กังหันลมหมุนไดนาโมผลิตไฟฟ้า"},
    {"id": "S38", "q": "หินอ่อนจัดเป็นหินชนิดใด?", "o": ["หินอัคนี", "หินชั้น", "หินแปร", "หินทราย"], "a": 2, "exp": "หินอ่อนเกิดจากหินปูนแปรสภาพ"},
    {"id": "S39", "q": "พืชชนิดใดขยายพันธุ์ด้วยหน่อ?", "o": ["ข้าวโพด", "กล้วย", "มะละกอ", "มังคุด"], "a": 1, "exp": "กล้วยแตกหน่อได้"},
    {"id": "S40", "q": "ดาวเคราะห์ใดมีขนาดใหญ่ที่สุด?", "o": ["โลก", "ดาวเสาร์", "ดาวพฤหัสบดี", "ดาวอังคาร"], "a": 2, "exp": "ดาวพฤหัสบดีใหญ่ที่สุด"}
]

# Select 30 unique questions
today_subject = get_subject_for_today()
bank = SCIENCE_BANK 
history = load_history()

# Filter unused
unused = [q for q in bank if q["id"] not in history]

# Pick 30
num_to_pick = min(30, len(unused))
selected = random.sample(unused, num_to_pick)

# Save history
save_history([q["id"] for q in selected])

# Generate HTML
html_content = f"""<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Daily Exam: {today_subject}</title>
<style>
body{{font-family:sans-serif;background:#f0f2f5;padding:20px;}}
.box{{max-width:600px;margin:0 auto;background:#fff;padding:20px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);}}
h1{{text-align:center;color:#333;}}
.info{{text-align:center;color:#666;margin-bottom:20px;}}
.q-card{{background:#f9f9f9;padding:15px;margin-bottom:15px;border-radius:8px;border-left:5px solid #4CAF50;}}
.q-text{{font-size:1.1em;font-weight:bold;margin-bottom:10px;}}
.opts{{display:flex;flex-direction:column;gap:5px;}}
.btn{{padding:10px;border:1px solid #ddd;background:#fff;text-align:left;cursor:pointer;border-radius:5px;}}
.btn:hover{{background:#e8f5e9;}}
.correct{{background:#d4edda;border-color:#28a745;}}
.wrong{{background:#f8d7da;border-color:#dc3545;}}
.exp{{display:none;margin-top:10px;padding:10px;background:#fff3cd;border-radius:5px;font-size:0.9em;}}
.res{{display:none;text-align:center;padding:20px;background:#e8f5e9;border-radius:10px;}}
</style>
</head>
<body>
<div class="box">
    <h1>📝 Daily Exam: {today_subject}</h1>
    <div class="info">📅 {datetime.now().strftime("%d/%m/%Y")} | 🎯 30 ข้อ | ⏱️ 30 นาที</div>
    <div id="quiz-area">
        <!-- Questions will be loaded here -->
    </div>
    <div class="res" id="result">
        <h2>🎉 จบการทดสอบ!</h2>
        <p>คุณทำถูก <span id="score" style="font-size:2em;color:#28a745;font-weight:bold;"></span> / 30</p>
    </div>
</div>
<script>
const questions = {json.dumps(selected, ensure_ascii=False)};
let current = 0;
let score = 0;

function loadQuiz() {{
    const area = document.getElementById('quiz-area');
    area.innerHTML = '';
    questions.forEach((q, i) => {{
        const card = document.createElement('div');
        card.className = 'q-card';
        card.innerHTML = `
            <div class="q-text">${{i+1}}. ${{q.q}}</div>
            <div class="opts" id="opts-${{i}}">
                ${{q.o.map((opt, idx) => `<div class="btn" onclick="check(${{i}}, ${{idx}})">${{['ก','ข','ค','ง'][idx]}}. ${{opt}}</div>`).join('')}}
            </div>
            <div class="exp" id="exp-${{i}}">💡 เฉลย: ${{['ก','ข','ค','ง'][q.a]}} - ${{q.exp}}</div>
        `;
        area.appendChild(card);
    }});
}}

function check(qIdx, optIdx) {{
    const q = questions[qIdx];
    const opts = document.getElementById(`opts-${{qIdx}}`).children;
    const exp = document.getElementById(`exp-${{qIdx}}`);
    
    for(let btn of opts) btn.onclick = null;

    if(optIdx === q.a) {{
        opts[optIdx].classList.add('correct');
        score++;
    }} else {{
        opts[optIdx].classList.add('wrong');
        opts[q.a].classList.add('correct');
    }}
    exp.style.display = 'block';

    const allDone = Array.from(document.querySelectorAll('.q-card')).every(c => c.querySelector('.exp').style.display === 'block');
    if(allDone) {{
        document.getElementById('result').style.display = 'block';
        document.getElementById('score').innerText = score;
        document.getElementById('result').scrollIntoView({{behavior:'smooth'}});
    }}
}}

loadQuiz();
</script>
</body>
</html>"""

filename = f"{today_subject}_Exam_{datetime.now().strftime('%Y%m%d')}.html"
filepath = os.path.join(OUTPUT_DIR, filename)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(html_content)

print(f"Exam generated: {filepath}")