#!/bin/bash
# ============================================================
# P5 Dashboard Auto-Update Script (v0.4)
# ดึงข้อมูลจาก Google Sheet → บันทึก data.json
# ใช้ได้ทั้ง manual (รันเอง) และ auto (ผ่าน HEARTBEAT.md 07:30)
# ============================================================
# v0.4: ไม่ generate HTML ทับ — index.html เขียนเอง (dark theme)
# แค่ parse CSV → save data.json ให้ JavaScript fetch
# ============================================================
# สร้างโดย: AliClaw (ตี๋)
# วันที่: 12 มิ.ย. 2569 (อัปเดต: 17 มิ.ย. 2569)
# แหล่งข้อมูล: Google Sheet "P5 - PlanTraining 69"
# ปลายทาง: projects/p5-admin-pad/dashboard/data.json
# ============================================================

set -e  # หยุดทันทีถ้าเกิด error

# --- Config (แก้ได้ถ้า URL เปลี่ยน) ---
SHEET_ID="15a8s_tLpuwBdIqJqwEv0be8Sy8162gnYti6kTggngh0"
GID="1104115053"
CSV_URL="https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}"
SHEET_URL="https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${GID}#gid=${GID}"

WORKSPACE="/home/admin/.openclaw/workspace"
PROJECT_DIR="${WORKSPACE}/projects/p5-admin-pad"
DASHBOARD_DIR="${PROJECT_DIR}/dashboard"
HTML_FILE="${DASHBOARD_DIR}/index.html"
DATA_FILE="${DASHBOARD_DIR}/data.json"
CSV_TMP="/tmp/p5_dashboard_$$.csv"

# เวลาปัจจุบัน (ภาษาไทย)
TIMESTAMP=$(date "+%d %B %Y เวลา %H:%M น." | sed 's/January/มกราคม/;s/February/กุมภาพันธ์/;s/March/มีนาคม/;s/April/เมษายน/;s/May/พฤษภาคม/;s/June/มิถุนายน/;s/July/กรกฎาคม/;s/August/สิงหาคม/;s/September/กันยายน/;s/October/ตุลาคม/;s/November/พฤศจิกายน/;s/December/ธันวาคม/')

# --- Step 1: ดึง CSV ---
echo "🔄 [1/4] กำลังดึงข้อมูลจาก Google Sheet..."
HTTP_CODE=$(curl -sL -o "$CSV_TMP" -w "%{http_code}" "$CSV_URL")
if [ "$HTTP_CODE" != "200" ] || [ ! -s "$CSV_TMP" ]; then
    echo "❌ ERROR: ดึงข้อมูลไม่สำเร็จ (HTTP $HTTP_CODE)"
    rm -f "$CSV_TMP"
    exit 1
fi
echo "✅ ดึงข้อมูลสำเร็จ ($(wc -l < "$CSV_TMP" | tr -d ' ') บรรทัด)"

# --- Step 2: แปลง CSV → Python parse → บันทึก data.json ---
# v0.4: ไม่ generate HTML ทับ — index.html เขียนเอง (dark theme)
echo "🔄 [2/4] กำลังประมวลผลข้อมูล → data.json..."

python3 << PYEOF
import csv
import json
import sys

CSV_FILE = "$CSV_TMP"
DATA_FILE = "$DATA_FILE"
TIMESTAMP = "$TIMESTAMP"
SHEET_URL = "$SHEET_URL"
LAST_UPDATED_ISO = "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# อ่าน CSV
with open(CSV_FILE, "r", encoding="utf-8") as f:
    reader = csv.reader(f)
    rows = list(reader)

# Row 0 = header, Row 1 = sub-header, Row 2+ = data
# A=บริษัท, B=สมาชิก, C=ครบ 44 หน่วย, D=ยังไม่ครบ, E=%หน่วยกิต
# F=GPA ผ่าน, G=GPA ไม่ผ่าน, H=%GPA
# (I, J, K เป็น "สถานะ" — ยังไม่มีข้อมูล)

companies = []
for row in rows[2:]:
    if len(row) < 8 or not row[0].strip():
        continue
    try:
        companies.append({
            "name": row[0].strip(),
            "members": int(row[1]) if row[1].strip() else 0,
            "credit_done": int(row[2]) if row[2].strip() else 0,
            "credit_remain": int(row[3]) if row[3].strip() else 0,
            "credit_pct": float(row[4].replace("%","")) if row[4].strip() else 0.0,
            "gpa_pass": int(row[5]) if row[5].strip() else 0,
            "gpa_fail": int(row[6]) if row[6].strip() else 0,
            "gpa_pct": float(row[7].replace("%","")) if row[7].strip() else 0.0,
        })
    except (ValueError, IndexError) as e:
        print(f"⚠️ skip row {row[0]}: {e}", file=sys.stderr)
        continue

if not companies:
    print("❌ ERROR: ไม่มีข้อมูลบริษัท", file=sys.stderr)
    sys.exit(1)

# คำนวณภาพรวม
total_members = sum(c["members"] for c in companies)
total_credit_done = sum(c["credit_done"] for c in companies)
total_credit_remain = sum(c["credit_remain"] for c in companies)
avg_credit_pct = (total_credit_done / total_members * 100) if total_members > 0 else 0
total_gpa_pass = sum(c["gpa_pass"] for c in companies)
avg_gpa_pct = (total_gpa_pass / total_members * 100) if total_members > 0 else 0
# บริษัทเสี่ยง = % หน่วยกิต < 90%
risky_count = sum(1 for c in companies if c["credit_pct"] < 90 and c["members"] > 0)

# จัดเรียงตาม % หน่วยกิต (มาก→น้อย)
companies_sorted = sorted(companies, key=lambda c: c["credit_pct"], reverse=True)

def status_class(pct, members=1):
    if members == 0: return "zero"
    if pct >= 90: return "good"
    if pct >= 50: return "warn"
    return "bad"

def status_text(pct, members=1):
    if members == 0: return "ยังไม่เริ่ม"
    if pct >= 90: return "✅ ดี"
    if pct >= 50: return "⚠️ เสี่ยง"
    return "🚨 วิกฤต"

# บันทึก data.json สำหรับ JavaScript fetch
data_for_frontend = {
    "timestamp": TIMESTAMP,
    "last_updated_iso": LAST_UPDATED_ISO,
    "sheet_url": SHEET_URL,
    "summary": {
        "total_members": total_members,
        "total_credit_done": total_credit_done,
        "total_credit_remain": total_credit_remain,
        "avg_credit_pct": round(avg_credit_pct, 2),
        "total_gpa_pass": total_gpa_pass,
        "avg_gpa_pct": round(avg_gpa_pct, 2),
        "risky_count": risky_count,
        "company_count": len(companies),
    },
    "companies": [
        {
            "name": c["name"],
            "members": c["members"],
            "credit_done": c["credit_done"],
            "credit_remain": c["credit_remain"],
            "credit_pct": c["credit_pct"],
            "gpa_pass": c["gpa_pass"],
            "gpa_fail": c["gpa_fail"],
            "gpa_pct": c["gpa_pct"],
            "status_class": status_class(c["credit_pct"], c["members"]),
            "status_text": status_text(c["credit_pct"], c["members"]),
        } for c in companies_sorted
    ],
}

with open(DATA_FILE, "w", encoding="utf-8") as f:
    json.dump(data_for_frontend, f, ensure_ascii=False, indent=2)

print(f"✅ บันทึก data.json สำเร็จ ({len(companies_sorted)} บริษัท)")

# เก็บสรุปไว้ใน /tmp (ให้ AI นำไป summarize ได้)
summary = {
    "timestamp": TIMESTAMP,
    "total_members": total_members,
    "total_credit_done": total_credit_done,
    "avg_credit_pct": round(avg_credit_pct, 2),
    "total_gpa_pass": total_gpa_pass,
    "avg_gpa_pct": round(avg_gpa_pct, 2),
    "risky_count": risky_count,
    "companies": [{"name": c["name"], "members": c["members"], "credit_pct": c["credit_pct"], "gpa_pct": c["gpa_pct"]} for c in companies_sorted]
}
with open("/tmp/p5_summary.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)
PYEOF

if [ $? -ne 0 ]; then
    echo "❌ ERROR: สร้าง data.json ไม่สำเร็จ"
    rm -f "$CSV_TMP"
    exit 1
fi

# --- Step 3: Verify ---
echo "🔄 [3/4] ตรวจสอบไฟล์..."
if [ ! -f "$DATA_FILE" ]; then
    echo "❌ ERROR: ไม่พบไฟล์ data.json"
    rm -f "$CSV_TMP"
    exit 1
fi
DATA_SIZE=$(stat -c%s "$DATA_FILE" 2>/dev/null || stat -f%z "$DATA_FILE")
if [ "$DATA_SIZE" -lt 200 ]; then
    echo "❌ ERROR: ไฟล์ data.json เล็กเกินไป ($DATA_SIZE bytes)"
    rm -f "$CSV_TMP"
    exit 1
fi
echo "✅ data.json: $DATA_SIZE bytes"

# เช็ค HTML ว่ามีอยู่ (ไม่ generate ใหม่)
if [ ! -f "$HTML_FILE" ]; then
    echo "⚠️ ไม่พบ index.html — กรุณาสร้างไฟล์ HTML ก่อน"
fi

# --- Step 4: Cleanup ---
rm -f "$CSV_TMP"
echo "🔄 [4/4] เสร็จสิ้น! ✨"
echo ""
echo "📊 สรุป:"
cat /tmp/p5_summary.json
echo ""
echo ""
echo "📂 ไฟล์ HTML: $HTML_FILE"
echo "📊 Data: $DATA_FILE"
echo "🌐 เปิดดู: file://$HTML_FILE"
