#!/bin/bash
# ============================================================
# P5 Dashboard Auto-Update Script (v0.6)
# ดึงข้อมูลจาก 6 tabs ใน Google Sheet
# ใช้ได้ทั้ง manual (รันเอง) และ auto (ผ่าน HEARTBEAT.md 07:30)
# ============================================================
# สร้างโดย: AliClaw (ตี๋)
# วันที่: 17 มิ.ย. 2569 (อัปเดต 17 มิ.ย. 2569 v0.6)
# แหล่งข้อมูล: Google Sheet "P5 : Dashboard ข้อมูลอบรม AI"
# ปลายทาง: projects/p5-admin-pad/dashboard/data.json
# ============================================================
# v0.6: ดึง 6 tabs (Summary + Training + Roleplay + Mentor + Coach + LG)
#       ข้าม tab "บริษัท" (gid=0) ตามที่ลูกหมีสั่ง
# ============================================================

set -e  # หยุดทันทีถ้าเกิด error

# --- Config ---
SHEET_ID="1CkBSi_votE01b0fxFFwU1EQb_7mzEJgGvWGaegocbeM"
GID_SUMMARY="473614158"
GID_TRAINING="1727556684"
GID_ROLEPLAY="698361957"
GID_MENTOR="283294680"
GID_COACH="609300653"
GID_LG="1597413003"

WORKSPACE="/home/admin/.openclaw/workspace"
PROJECT_DIR="${WORKSPACE}/projects/p5-admin-pad"
DASHBOARD_DIR="${PROJECT_DIR}/dashboard"
HTML_FILE="${DASHBOARD_DIR}/index.html"
DATA_FILE="${DASHBOARD_DIR}/data.json"
CSV_TMP="/tmp/p5_dashboard_$$.csv"

# เวลาปัจจุบัน (ภาษาไทย)
TIMESTAMP=$(date "+%d %B %Y เวลา %H:%M น." | sed 's/January/มกราคม/;s/February/กุมภาพันธ์/;s/March/มีนาคม/;s/April/เมษายน/;s/May/พฤษภาคม/;s/June/มิถุนายน/;s/July/กรกฎาคม/;s/August/สิงหาคม/;s/September/กันยายน/;s/October/ตุลาคม/;s/November/พฤศจิกายน/;s/December/ธันวาคม/')
LAST_UPDATED_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# --- Step 1: ดึง CSV ทั้ง 6 tabs ---
echo "🔄 [1/4] กำลังดึงข้อมูลจาก 6 tabs..."

declare -A CSV_FILES=(
  ["summary"]="${CSV_TMP}.summary"
  ["training"]="${CSV_TMP}.training"
  ["roleplay"]="${CSV_TMP}.roleplay"
  ["mentor"]="${CSV_TMP}.mentor"
  ["coach"]="${CSV_TMP}.coach"
  ["lg"]="${CSV_TMP}.lg"
)
declare -A GIDS=(
  ["summary"]="${GID_SUMMARY}"
  ["training"]="${GID_TRAINING}"
  ["roleplay"]="${GID_ROLEPLAY}"
  ["mentor"]="${GID_MENTOR}"
  ["coach"]="${GID_COACH}"
  ["lg"]="${GID_LG}"
)

for key in "${!GIDS[@]}"; do
  gid="${GIDS[$key]}"
  url="https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}"
  csv_file="${CSV_FILES[$key]}"
  HTTP_CODE=$(curl -sL -o "$csv_file" -w "%{http_code}" "$url" --max-time 30)
  if [ "$HTTP_CODE" != "200" ] || [ ! -s "$csv_file" ]; then
    echo "❌ ERROR: ดึงข้อมูล $key ไม่สำเร็จ (HTTP $HTTP_CODE)"
    rm -f "${CSV_TMP}".*
    exit 1
  fi
  lines=$(wc -l < "$csv_file" | tr -d ' ')
  echo "✅ $key (gid=$gid): $lines บรรทัด"
done

# --- Step 2: แปลง CSV → Python parse → บันทึก data.json ---
echo "🔄 [2/4] กำลังประมวลผลข้อมูล → data.json..."

python3 << PYEOF
import csv
import json
import sys
import os

DATA_FILE = "$DATA_FILE"
TIMESTAMP = "$TIMESTAMP"
LAST_UPDATED_ISO = "$LAST_UPDATED_ISO"
SHEET_URL = "https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing"

CSV_FILES = {
  "summary": "${CSV_FILES[summary]}",
  "training": "${CSV_FILES[training]}",
  "roleplay": "${CSV_FILES[roleplay]}",
  "mentor": "${CSV_FILES[mentor]}",
  "coach": "${CSV_FILES[coach]}",
  "lg": "${CSV_FILES[lg]}",
}

def parse_summary_table(filepath):
    """Parse Tab สรุปรายงาน — ตาราง 6 บริษัท (members, credit_done, credit_remain, credit_pct, gpa_pass, gpa_fail, gpa_pct)"""
    rows = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row or not any(c.strip() for c in row):
                continue
            rows.append([c.strip() for c in row])
    if len(rows) < 3:
        return {"rows": []}
    # Row 0 = main header, Row 1 = sub-header, Row 2+ = data
    # Columns: [0]บริษัท, [1]สมาชิก, [2]ครบ 44 หน่วย, [3]ยังไม่ครบ, [4]%ครบ,
    #          [5]GPAผ่าน 3.5, [6]GPAไม่ผ่าน, [7]%GPA
    data_rows = []
    for row in rows[2:]:
        if len(row) < 8 or not row[0].strip():
            continue
        try:
            members = int(row[1].replace(",", "")) if row[1].strip() else 0
            credit_done = int(row[2].replace(",", "")) if row[2].strip() else 0
            credit_remain = int(row[3].replace(",", "")) if row[3].strip() else 0
            credit_pct = float(row[4].replace("%", "").replace(",", "")) if row[4].strip() else 0
            gpa_pass = int(row[5].replace(",", "")) if row[5].strip() else 0
            gpa_fail = int(row[6].replace(",", "")) if row[6].strip() else 0
            gpa_pct = float(row[7].replace("%", "").replace(",", "")) if row[7].strip() else 0
            data_rows.append({
                "name": row[0].strip(),
                "members": members,
                "credit_done": credit_done,
                "credit_remain": credit_remain,
                "credit_pct": credit_pct,
                "gpa_pass": gpa_pass,
                "gpa_fail": gpa_fail,
                "gpa_pct": gpa_pct,
            })
        except (ValueError, IndexError):
            continue
    return {"rows": data_rows}


def parse_kv(filepath):
    """Parse CSV แบบ key-value (3 columns: label, value, unit) — ใช้กับ Training/Roleplay/Mentor/Coach"""
    result = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 2:
                continue
            label = row[0].strip()
            value = row[1].strip() if len(row) > 1 else ""
            unit = row[2].strip() if len(row) > 2 else ""
            if not label:
                continue
            # แปลงตัวเลข
            try:
                value_num = float(value.replace(",", "").replace("%", "")) if value else 0
            except ValueError:
                value_num = None
            result.append({
                "label": label,
                "value": value,
                "value_num": value_num,
                "unit": unit,
            })
    return result

def parse_lg(filepath):
    """Parse Learning & Growth — มี 6 บริษัท + รวม"""
    rows = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row or not row[0].strip():
                continue
            rows.append([c.strip() for c in row])
    if not rows:
        return {"headers": [], "rows": []}
    headers = rows[0]  # ["Capital", "PKG", "PGHg", "PMSg", "AAMg", "RPLCg", "RAFCOg", "CPDg", "รวม", "อ้างอิง"]
    data_rows = []
    for row in rows[1:]:
        if len(row) < 2:
            continue
        item = {"name": row[0]}
        # บริษัทต่าง ๆ
        for i, h in enumerate(headers[1:-2] if len(headers) >= 3 else headers[1:], start=1):
            if i < len(row):
                try:
                    item[h] = int(row[i].replace(",", "")) if row[i].strip() else 0
                except ValueError:
                    item[h] = 0
        # รวม
        if len(headers) >= 2 and len(row) >= len(headers) - 1:
            try:
                item["total"] = int(row[-2].replace(",", "")) if row[-2].strip() else 0
            except (ValueError, IndexError):
                item["total"] = 0
        # อ้างอิง
        if len(row) >= len(headers):
            item["reference"] = row[-1]
        data_rows.append(item)
    return {"headers": headers, "rows": data_rows}

# ดึงข้อมูลทุก tab
data = {
    "timestamp": TIMESTAMP,
    "last_updated_iso": LAST_UPDATED_ISO,
    "sheet_url": SHEET_URL,
}

try:
    data["summary"] = parse_summary_table(CSV_FILES["summary"])
    data["training"] = parse_kv(CSV_FILES["training"])
    data["roleplay"] = parse_kv(CSV_FILES["roleplay"])
    data["mentor"] = parse_kv(CSV_FILES["mentor"])
    data["coach"] = parse_kv(CSV_FILES["coach"])
    data["lg"] = parse_lg(CSV_FILES["lg"])
except Exception as e:
    print(f"❌ ERROR: parse ล้มเหลว: {e}", file=sys.stderr)
    sys.exit(1)

# บันทึก data.json
with open(DATA_FILE, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"✅ บันทึก data.json สำเร็จ")
print(f"   Summary: {len(data['summary']['rows'])} rows (ตาราง)")
print(f"   Training: {len(data['training'])} items")
print(f"   Roleplay: {len(data['roleplay'])} items")
print(f"   Mentor: {len(data['mentor'])} items")
print(f"   Coach: {len(data['coach'])} items")
print(f"   LG: {len(data['lg']['rows'])} rows")
PYEOF

if [ $? -ne 0 ]; then
    echo "❌ ERROR: สร้าง data.json ไม่สำเร็จ"
    rm -f "${CSV_TMP}".*
    exit 1
fi

# --- Step 3: Verify ---
echo "🔄 [3/4] ตรวจสอบไฟล์..."
if [ ! -f "$DATA_FILE" ]; then
    echo "❌ ERROR: ไม่พบไฟล์ data.json"
    rm -f "${CSV_TMP}".*
    exit 1
fi
DATA_SIZE=$(stat -c%s "$DATA_FILE" 2>/dev/null || stat -f%z "$DATA_FILE")
if [ "$DATA_SIZE" -lt 200 ]; then
    echo "❌ ERROR: ไฟล์ data.json เล็กเกินไป ($DATA_SIZE bytes)"
    rm -f "${CSV_TMP}".*
    exit 1
fi
echo "✅ data.json: $DATA_SIZE bytes"

if [ ! -f "$HTML_FILE" ]; then
    echo "⚠️ ไม่พบ index.html — กรุณาสร้างไฟล์ HTML ก่อน"
fi

# --- Step 4: Cleanup ---
rm -f "${CSV_TMP}".*
echo "🔄 [4/4] เสร็จสิ้น! ✨"
echo ""
echo "📊 Data sections:"
python3 -c "
import json
d = json.load(open('$DATA_FILE'))
print(f'  - summary: {len(d.get(\"summary\", {}).get(\"rows\", []))} rows (ตาราง)')
print(f'  - training: {len(d.get(\"training\", []))} items')
print(f'  - roleplay: {len(d.get(\"roleplay\", []))} items')
print(f'  - mentor: {len(d.get(\"mentor\", []))} items')
print(f'  - coach: {len(d.get(\"coach\", []))} items')
print(f'  - lg: {len(d.get(\"lg\", {}).get(\"rows\", []))} rows')
"
echo ""
echo "📂 Data: $DATA_FILE"
