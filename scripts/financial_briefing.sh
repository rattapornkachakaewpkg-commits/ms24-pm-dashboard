#!/bin/bash
# Daily Finance Briefing (l&g) - runs at 6:00 AM daily
# Sources: Coinbase API, NerdWallet, Investopedia

BOT_TOKEN="8737838944:AAGGINzL4LzPK6QjrvixcKUnUnT5-78cujY"
CHAT_ID="5050203997"
DATE=$(date +%d/%m/%Y)
DAY=$(date +%u)

# Fetch real prices from Coinbase API
BTC=$(curl -s "https://api.coinbase.com/v2/prices/BTC-USD/spot" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['amount'])" 2>/dev/null || echo "N/A")
ETH=$(curl -s "https://api.coinbase.com/v2/prices/ETH-USD/spot" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['amount'])" 2>/dev/null || echo "N/A")
SOL=$(curl -s "https://api.coinbase.com/v2/prices/SOL-USD/spot" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['amount'])" 2>/dev/null || echo "N/A")
XAU=$(curl -s "https://api.coinbase.com/v2/prices/XAU-USD/spot" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['amount'])" 2>/dev/null || echo "N/A")

# Format prices
BTC_FMT=$(printf "%.2f" $BTC 2>/dev/null || echo "N/A")
ETH_FMT=$(printf "%.2f" $ETH 2>/dev/null || echo "N/A")
SOL_FMT=$(printf "%.2f" $SOL 2>/dev/null || echo "N/A")
XAU_FMT=$(printf "%.2f" $XAU 2>/dev/null || echo "N/A")

# Rotate through different finance topics by day
case $DAY in
    1) TIP="กฎ 50/30/20"
       DESC="• 50% ของรายได้ = ค่าใช้จ่ายจำเป็น (ที่อยู่ อาหาร ค่าไฟ)
• 30% = ค่าใช้จ่ายส่วนตัว (ความบันเทิง ช้อปปิ้ง)
• 20% = ออม + ลงทุน
-- ที่มา: NerdWallet (nerdwallet.com)"
       RETIRE="• ออมก่อนใช้! หักเงินออมทันทีที่เงินเดือนออก
• มีเงินสำรองฉุกเฉิน 3-6 เดือนของค่าใช้จ่าย
-- ที่มา: Investopedia (investopedia.com)"
       CHALLENGE="ตั้งโอนเงินอัตโนมัติ 500 บาทเข้าบัญชีออมทรัพย์ ทุกวันที่เงินเดือนออก"
       ;;
    2) TIP="DCA (Dollar Cost Averaging)"
       DESC="• ลงทุนจำนวนเงินเท่ากัน ทุกเดือน โดยไม่สนใจราคา
• ลดความเสี่ยงจากการลงทุนจังหวะผิด
• เหมาะกับ: Bitcoin, ETF, กองทุนดัชนี
-- ที่มา: Investopedia"
       RETIRE="• เริ่มออม越早越好 - เงิน 1,000 บาท/เดือน เริ่มตอนอายุ 25 = 3.2 ล้านบาทตอน 60 (ดอกเบี้ย 7%)
-- ที่มา: NerdWallet"
       CHALLENGE="เริ่ม DCA ในกองทุนดัชนี 500 บาท/เดือน เดือนนี้เลย"
       ;;
    3) TIP="กฎ 72 - เงินคูณสอง"
       DESC="• เงินคูณสอง ใช้เวลา = 72 ÷ อัตราดอกเบี้ย (%)
• ตัวอย่าง: ดอกเบี้ย 7% = เงินคูณสองใน 10.3 ปี
• ดอกเบี้ย 10% = เงินคูณสองใน 7.2 ปี
-- ที่มา: Investopedia"
       RETIRE="• กระจายลงทุน: หุ้น 40%, พันธบัตร 30%, ทองคำ 20%, เงินสด 10%
-- ที่มา: NerdWallet"
       CHALLENGE="คำนวณว่าเงินคุณจะคูณสองในกี่ปี ด้วยกฎ 72"
       ;;
    4) TIP="เงินสำรองฉุกเฉิน"
       DESC="• อย่างน้อย 3-6 เดือนของค่าใช้จ่ายรายเดือน
• เก็บในบัญชีที่ถอนได้ทันที
• แยกจากบัญชีใช้จ่ายปกติ
-- ที่มา: NerdWallet"
       RETIRE="• จ่ายหนี้ดอกเบี้ยสูงก่อน (บัตรเครดิต)
• แล้วค่อยลงทุนระยะยาว
-- ที่มา: Investopedia"
       CHALLENGE="เช็คว่ามีเงินสำรองฉุกเฉินกี่เดือนแล้ว ถ้ายังไม่พอ เริ่มออมเพิ่ม"
       ;;
    5) TIP="ดอกเบี้ยทบต้น"
       DESC="• ไอน์สไตน์: ดอกเบี้ยทบต้น = สิ่งมหัศจรรย์อันดับ 8 ของโลก
• เงิน 1,000 บาท/เดือน ดอกเบี้ย 7%/ปี = 1.2 ล้านบาทใน 20 ปี
-- ที่มา: Investopedia"
       RETIRE="• เริ่มออมเร็ว = ได้เปรียบมาก
• อายุ 25 เริ่มออม = 3.2 ล้านบาทตอน 60
• อายุ 35 เริ่มออม = 1.5 ล้านบาทตอน 60
-- ที่มา: NerdWallet"
       CHALLENGE="คำนวณเงินเกษียณของตัวเองด้วยสูตรดอกเบี้ยทบต้น"
       ;;
    6) TIP="ลงทุนในตัวเอง"
       DESC="• การลงทุนที่ให้ผลตอบแทนสูงสุด = ลงทุนในตัวเอง
• เรียนทักษะใหม่ = เพิ่มรายได้ตลอดชีวิต
• สุขภาพดี = ลดค่าใช้จ่ายรักษาพยาบาล
-- ที่มา: Warren Buffett"
       RETIRE="• ประกันสุขภาพ = ป้องกันเงินเกษียณหมด
• ออกกำลังกาย = ลงทุนสุขภาพที่คุ้มค่าที่สุด
-- ที่มา: Harvard Health"
       CHALLENGE="ลงทะเบียนเรียนทักษะใหม่ 1 อย่างเดือนนี้"
       ;;
    7) TIP="ติดตามพอร์ตลงทุน"
       DESC="• ตรวจสอบพอร์ตลงทุนทุกไตรมาส
• Rebalance ปีละ 1 ครั้ง ให้ตรงกับเป้าหมาย
• อย่าตื่นตระหนกเมื่อตลาดลง
-- ที่มา: NerdWallet"
       RETIRE="• ตั้งเป้าหมายเกษียณ = จำนวนเงินที่ต้องการใช้ต่อปี × 25
• ตัวอย่าง: ใช้ปีละ 600,000 บาท = ต้องมี 15 ล้านบาท
-- ที่มา: 4% Rule (Trinity Study)"
       CHALLENGE="เช็คว่าตอนนี้มีเงินเกษียณแล้วกี่เปอร์เซ็นต์ของเป้าหมาย"
       ;;
esac

BODY="💰 Daily Finance Briefing - l&g
━━━━━━━━━━━━━━━━━━

📅 ${DATE}

📊 ราคาตลาดวันนี้ (ข้อมูลจริงจาก Coinbase API)

🥇 ทองคำ (XAU/USD): \$${XAU_FMT}/oz
🟠 Bitcoin (BTC): \$${BTC_FMT}
🔵 Ethereum (ETH): \$${ETH_FMT}
🟣 Solana (SOL): \$${SOL_FMT}

📎 แหล่งข้อมูล: https://api.coinbase.com/v2/prices/

━━━━━━━━━━━━━━━━━━

💡 ทริคการออมส่วนบุคคล

${TIP}

${DESC}

━━━━━━━━━━━━━━━━━━

🏦 เทคนิคเกษียณมั่งคั่ง

${RETIRE}

━━━━━━━━━━━━━━━━━━

🪙 คริปโตน่าสนใจ - วิธีนำไปใช้จริง

Bitcoin (BTC) - \$${BTC_FMT}
• เหมาะกับ: ลงทุนระยะยาว (ถืออย่างน้อย 4 ปี)
• วิธีใช้: ซื้อเก็บเรื่อยๆ ทุกเดือน (DCA)

Ethereum (ETH) - \$${ETH_FMT}
• เหมาะกับ: คนที่สนใจเทคโนโลยี Blockchain, DeFi
• วิธีใช้: ใช้ ETH ในแอปพลิเคชัน DeFi เพื่อรับดอกเบี้ย

Solana (SOL) - \$${SOL_FMT}
• เหมาะกับ: คนที่รับความเสี่ยงได้สูง
• วิธีใช้: ลงทุนจำนวนเล็กน้อย (ไม่เกิน 5% ของพอร์ต)

━━━━━━━━━━━━━━━━━━

🎯 Challenge วันนี้:
${CHALLENGE}

💎 ความมั่งคั่ง เริ่มจากวินัยการเงิน

📚 แหล่งข้อมูล:
- Coinbase API: https://api.coinbase.com/v2/prices/
- NerdWallet: https://www.nerdwallet.com/
- Investopedia: https://www.investopedia.com/"

# Send to Telegram
ESCAPED=$(echo "$BODY" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g')

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{
        \"chat_id\": \"${CHAT_ID}\",
        \"text\": \"${ESCAPED}\",
        \"parse_mode\": \"HTML\"
    }" 2>/dev/null

echo "Finance briefing sent at $(date)"
