/**
 * PKG Data Hub v3.2 — CEO Contract Backend (แยกไฟล์)
 * สำหรับวางใน Apps Script ควบกับไฟล์ CEO_Contract_Form.html
 * 
 * ฟังก์ชันหลัก:
 * - doGet: routing (page=ceo → ฟอร์ม, action=memberData → ข้อมูลสมาชิก)
 * - serveCEOContract: เสิร์ฟ HTML ฟอร์ม + inject MEMBERS
 * - submitCEOContract: บันทึกเมื่อกด "ส่งสัญญา"
 * - saveAllData: บันทึกเมื่อกด "💾 บันทึกข้อมูล" (ทุกส่วน)
 * - readSheetData: อ่านข้อมูลจาก Sheet (Purpose, Accountability, OKRs)
 * - getMemberData: ส่ง MEMBERS เป็น JS สำหรับ autocomplete
 */

var SPREADSHEET_ID = '1E9wn_4vgWTpOvBxcztMkEmUmlj66MqOIt0RWpSRWGZY';

function getSpreadsheetId() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (!id) {
    id = SPREADSHEET_ID;
    props.setProperty('SPREADSHEET_ID', id);
  }
  return id;
}

// ===== ROUTING =====

function doGet(e) {
  // ป้องกัน e เป็น undefined (กรณีทดสอบจาก Editor)
  if (!e || !e.parameter) {
    return serveCEOContract();
  }
  if (e.parameter.page === 'ceo') {
    return serveCEOContract();
  }
  if (e.parameter.action === 'memberData') {
    return getMemberData();
  }
  // default = CEO Contract form
  return serveCEOContract();
}

function doPost(e) {
  return ContentService.createTextOutput(JSON.stringify({status:'error',message:'POST not supported. Use google.script.run instead.'})).setMimeType(ContentService.MimeType.JSON);
}

// ===== SERVE CEO CONTRACT FORM =====

function serveCEOContract() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var membersSheet = ss.getSheetByName('Members');
  var data = membersSheet.getDataRange().getValues();
  
  // Members columns: A=0(รหัส), B=1(ชื่อ), C=2(นามสกุล), D=3(วันเกิด),
  // E=4(ประเภท), F=5(บทบาท), G=6(หน้าที่), H=7(ชื่อทีม), I=8(รหัสทีม), J=9(BU), K=10(ชื่อเล่น), L=11(เบอร์โทร), M=12(รหัส ชื่อ นามสกุล)
  
  var ID=0, NAME=1, SURNAME=2, ROLE=5, TEAMNAME=7, BU=9;
  
  var members = [];
  for (var i = 0; i < data.length; i++) {
    if (!data[i][ID]) continue;
    var idStr = String(data[i][ID]).trim();
    if (idStr === 'รหัสสมาชิก' || idStr === 'ID' || idStr === 'member_id' || idStr === 'id') continue;
    var fullName = ((data[i][NAME]||'') + ' ' + (data[i][SURNAME]||'')).trim();
    members.push({
      id: idStr,
      name: fullName,
      team: String(data[i][TEAMNAME]||'').trim(),
      bu: String(data[i][BU]||'').trim(),
      role: String(data[i][ROLE]||'').trim()
    });
  }
  
  var membersData = JSON.stringify(members);
  
  var htmlTemplate = HtmlService.createHtmlOutputFromFile('CEO_Contract_Form');
  var htmlContent = htmlTemplate.getContent();
  htmlContent = htmlContent.replace('<!-- MEMBERS_DATA_PLACEHOLDER -->', membersData);
  
  var output = HtmlService.createHtmlOutput(htmlContent);
  return output
    .setTitle('CEO Contract of Extreme Ownership')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ===== GET MEMBER DATA (สำหรับ autocomplete) =====

function getMemberData() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var sheet = ss.getSheetByName('Members');
  if (!sheet || sheet.getLastRow() < 2) {
    return ContentService.createTextOutput('var MEMBERS = [];')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idCol = -1, nameCol = -1, surnameCol = -1, roleCol = -1, teamCol = -1, buCol = -1;
  
  for (var h = 0; h < headers.length; h++) {
    var header = String(headers[h]).trim();
    var hl = header.toLowerCase();
    if (idCol === -1 && (header === 'รหัสสมาชิก' || hl === 'member_id' || hl === 'id' || hl === 'รหัส')) idCol = h;
    if (nameCol === -1 && (header === 'ชื่อ-นามสกุล' || header === 'ชื่อ' || hl === 'name' || hl === 'fullname' || hl === 'full_name')) nameCol = h;
    if (surnameCol === -1 && (header === 'นามสกุล' || hl === 'surname' || hl === 'surname_th')) surnameCol = h;
    if (roleCol === -1 && (header === 'บทบาท' || hl === 'role' || hl === 'บทบาท/role')) roleCol = h;
    if (teamCol === -1 && (header === 'ชื่อทีม' || hl === 'team' || hl === 'team_name' || hl === 'division_name')) teamCol = h;
    if (buCol === -1 && (header === 'BU' || hl === 'bu' || header === 'กลุ่มบริษัท')) buCol = h;
  }
  
  // Fallback: ใช้คอลัมน์ตามลำดับถ้าหา header ไม่เจอ
  if (idCol === -1) idCol = 0;
  if (nameCol === -1) nameCol = 1;
  if (surnameCol === -1) surnameCol = 2;
  if (roleCol === -1) roleCol = 5;
  if (teamCol === -1) teamCol = 7;
  if (buCol === -1) buCol = 9;
  
  var js = 'var MEMBERS = [';
  for (var r = 1; r < values.length; r++) {
    var id = idCol >= 0 ? values[r][idCol] : '';
    var name = nameCol >= 0 ? values[r][nameCol] : '';
    var surname = surnameCol >= 0 ? values[r][surnameCol] : '';
    var role = roleCol >= 0 ? values[r][roleCol] : '';
    var team = teamCol >= 0 ? values[r][teamCol] : '';
    var bu = buCol >= 0 ? values[r][buCol] : '';
    if (!id || String(id).trim() === '') continue;
    var idStr = String(id).trim();
    if (idStr === 'ID' || idStr === 'รหัสสมาชิก' || idStr === 'member_id') continue;
    var fullName = String(name).trim();
    if (surname && String(surname).trim()) fullName += ' ' + String(surname).trim();
    js += '{id:' + JSON.stringify(idStr) + ',name:' + JSON.stringify(fullName) + ',team:' + JSON.stringify(String(team).trim()) + ',bu:' + JSON.stringify(String(bu).trim()) + ',role:' + JSON.stringify(String(role).trim()) + '},';
  }
  js += '];';
  
  return ContentService.createTextOutput(js)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// ===== READ DATA FROM SHEETS (สำหรับฟอร์มโหลดข้อมูลตาม BU) =====

function readSheetData(sheetName, bu) {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var results = [];
  
  // หาคอลัมน์ BU
  var buCol = -1;
  for (var h = 0; h < headers.length; h++) {
    var hdr = String(headers[h]).trim();
    if (hdr === 'BU' || hdr === 'bu' || hdr === 'company_management') { buCol = h; break; }
  }
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    // กรองตาม BU ถ้ามี
    if (buCol >= 0 && bu && String(row[buCol]).trim().toLowerCase() !== bu.toLowerCase()) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[String(headers[j]).trim()] = row[j];
    }
    results.push(obj);
  }
  return results;
}

// ===== SAVE ALL DATA (เมื่อกด 💾 บันทึกข้อมูล) =====

function saveAllData(formData) {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var contractSheet = ss.getSheetByName('CEO_Contract');
  var now = new Date();
  
  // ตรวจสอบว่ามีสมาชิก ID หรือไม่
  if (!formData.member_id && !formData.name) {
    return {status: 'error', message: 'กรุณาเลือกสมาชิกก่อนบันทึก'};
  }
  
  // ตรวจสอบว่ามีแถวเดิมหรือยัง (อัปเดต) หรือสร้างใหม่
  var contractId = '';
  var existingRow = -1;
  
  if (contractSheet) {
    var contractData = contractSheet.getDataRange().getValues();
    // หาแถวที่มี member_id ตรงกัน
    for (var r = 1; r < contractData.length; r++) {
      if (String(contractData[r][0]).trim() === String(formData.member_id).trim()) {
        existingRow = r + 1; // 1-indexed
        contractId = String(contractData[r][1] || 'CEO-' + Date.now());
        break;
      }
    }
  }
  
  if (!contractId) {
    contractId = 'CEO-' + Date.now();
  }
  
  // สร้างหรืออัปเดต CEO_Contract row
  var row = [
    formData.member_id || '',       // A: รหัสสมาชิก
    contractId,                      // B: Contract ID
    formData.name || '',             // C: ชื่อ-นามสกุล
    formData.bu || '',               // D: BU
    formData.team || '',             // E: ทีม
    formData.role || '',             // F: บทบาท
    formData.service_leader || '',   // G: ผู้รับใช้ทีม
    formData.mentor1 || '',          // H: พี่เลี้ยง 1
    formData.mentor2 || '',          // I: พี่เลี้ยง 2
    formData.mentor3 || '',          // J: พี่เลี้ยง 3
    formData.accountability || '',   // K: Accountability
    formData.purpose || '',          // L: Purpose
    formData.vision || '',           // M: Vision
    formData.personal_type || '',    // N: Personal Growth Type
    formData.personal_target || '',  // O: Personal Growth Target
    formData.personal_desc || '',    // P: Personal Growth Desc
    formData.personal_progress || '', // Q: Personal Progress
    'Saved',                         // R: Status
    now,                             // S: Created_Date
    now                              // T: Updated_Date
  ];
  
  // สร้าง CEO_Contract sheet ถ้ายังไม่มี
  if (!contractSheet) {
    contractSheet = ss.insertSheet('CEO_Contract');
    var headers = ['member_id','contract_id','name','bu','team','role','service_leader','mentor1','mentor2','mentor3','accountability','purpose','vision','personal_type','personal_target','personal_desc','personal_progress','status','created_date','updated_date'];
    contractSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    contractSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1a237e').setFontColor('#ffffff');
    contractSheet.setFrozenRows(1);
    contractSheet.appendRow(row);
  } else if (existingRow > 0) {
    // อัปเดตแถวเดิม
    row[row.length - 1] = now; // Updated_Date
    contractSheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    // เพิ่มแถวใหม่ — ตรวจสอบ headers ก่อน
    var existingHeaders = contractSheet.getDataRange().getValues()[0];
    if (existingHeaders.length < row.length) {
      // เพิ่ม columns ที่ขาด
      for (var c = existingHeaders.length; c < row.length; c++) {
        contractSheet.insertColumnAfter(c);
      }
    }
    contractSheet.appendRow(row);
  }
  
  // ===== บันทึก OKRs (Business Growth) =====
  var okrSheet = ss.getSheetByName('OKRs');
  if (okrSheet && formData.bu_objectives) {
    // formData.bu_objectives = [{objective:'', kr1:'', kr2:'', kr3:''}, ...]
    var buObjs = formData.bu_objectives;
    for (var b = 0; b < buObjs.length; b++) {
      if (buObjs[b].objective) {
        okrSheet.appendRow([
          'OKR-' + Date.now() + '-B' + (b+1), contractId, 'BU',
          buObjs[b].objective || '',
          (buObjs[b].kr1 || '') + ';' + (buObjs[b].kr2 || '') + ';' + (buObjs[b].kr3 || ''),
          '', '', 'On Track', now, now
        ]);
      }
    }
  }
  
  // ===== บันทึก OKRs (Team Growth) =====
  if (okrSheet && formData.team_objectives) {
    var teamObjs = formData.team_objectives;
    for (var t = 0; t < teamObjs.length; t++) {
      if (teamObjs[t].objective) {
        okrSheet.appendRow([
          'OKR-' + Date.now() + '-T' + (t+1), contractId, 'Team',
          teamObjs[t].objective || '',
          (teamObjs[t].kr1 || '') + ';' + (teamObjs[t].kr2 || '') + ';' + (teamObjs[t].kr3 || ''),
          '', '', 'On Track', now, now
        ]);
      }
    }
  }
  
  // ===== บันทึก Personal Growth =====
  var personalSheet = ss.getSheetByName('Personal Growth');
  if (personalSheet && formData.personal_target) {
    personalSheet.appendRow([
      'PG-' + Date.now(), contractId,
      formData.personal_type || '',
      formData.personal_desc || '',
      formData.personal_target || '',
      formData.personal_progress || '0%',
      '',
      now, now
    ]);
  }
  
  // ===== บันทึก KPI (Operational Excellence) =====
  var kpiSheet = ss.getSheetByName('Operational Excellence (WI)');
  if (kpiSheet) {
    var kpis = formData.kpis || [];
    for (var k = 0; k < kpis.length; k++) {
      if (kpis[k].name) {
        kpiSheet.appendRow([
          'KPI-' + Date.now() + '-' + (k+1), contractId,
          kpis[k].name, kpis[k].target || '',
          '', kpis[k].freq || '', 'On Track',
          now.getMonth() + 1, now.getFullYear(), now, now
        ]);
      }
    }
  }
  
  // ===== ส่ง Telegram แจ้งเตือน =====
  try {
    var props = PropertiesService.getScriptProperties();
    var botToken = props.getProperty('TELEGRAM_BOT_TOKEN');
    var chatId = props.getProperty('TELEGRAM_CHAT_ID');
    if (botToken && chatId) {
      var msg = '💾 CEO Contract บันทึกข้อมูล\n' +
        '👤 ' + (formData.name || '-') + '\n' +
        '🏢 ' + (formData.bu || '-') + ' / ' + (formData.team || '-') + '\n' +
        '🎭 ' + (formData.role || '-') + '\n' +
        '📋 Status: Saved\n' +
        '🕐 ' + now.toLocaleString('th-TH');
      UrlFetchApp.fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
        method: 'post',
        payload: { chat_id: chatId, text: msg }
      });
    }
  } catch(e) {}
  
  return {
    status: 'ok',
    contractId: contractId,
    message: 'บันทึกข้อมูลสำเร็จ',
    timestamp: now.toLocaleString('th-TH')
  };
}

// ===== SUBMIT CEO CONTRACT (เมื่อกด "ส่งสัญญา ✉️") =====

function submitCEOContract(formData) {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var contractSheet = ss.getSheetByName('CEO_Contract');
  var now = new Date();
  var contractId = 'CEO-' + Date.now();
  
  // ===== บันทึกลง CEO_Contract Sheet =====
  if (!contractSheet) {
    contractSheet = ss.insertSheet('CEO_Contract');
    var headers = ['member_id','contract_id','name','bu','team','role','service_leader','mentor1','mentor2','mentor3','accountability','purpose','vision','personal_type','personal_target','personal_desc','personal_progress','status','created_date','updated_date'];
    contractSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    contractSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1a237e').setFontColor('#ffffff');
    contractSheet.setFrozenRows(1);
  }
  
  var row = [
    formData.member_id || '',
    contractId,
    formData.name || '',
    formData.bu || '',
    formData.team || '',
    formData.role || '',
    formData.service_leader || '',
    formData.mentor1 || '',
    formData.mentor2 || '',
    formData.mentor3 || '',
    formData.accountability || '',
    formData.purpose || '',
    formData.vision || '',
    formData.personal_type || '',
    formData.personal_target || '',
    formData.personal_desc || '',
    formData.personal_progress || '',
    'Pending',
    now,
    now
  ];
  
  // ตรวจสอบว่ามีแถวเดิมหรือไม่ → อัปเดต
  var existingData = contractSheet.getDataRange().getValues();
  var existingRow = -1;
  for (var r = 1; r < existingData.length; r++) {
    if (String(existingData[r][0]).trim() === String(formData.member_id).trim()) {
      existingRow = r + 1;
      break;
    }
  }
  
  if (existingRow > 0) {
    // อัปเดตสถานะเป็น Pending และข้อมูลใหม่
    row[row.length - 2] = 'Pending'; // status
    row[row.length - 1] = now; // updated_date
    contractSheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    contractSheet.appendRow(row);
  }
  
  // ===== บันทึก OKRs (Business Growth) =====
  var okrSheet = ss.getSheetByName('OKRs');
  if (okrSheet && formData.bu_objectives) {
    var buObjs = formData.bu_objectives;
    for (var b = 0; b < buObjs.length; b++) {
      if (buObjs[b].objective) {
        okrSheet.appendRow([
          'OKR-' + Date.now() + '-B' + (b+1), contractId, 'BU',
          buObjs[b].objective || '',
          (buObjs[b].kr1 || '') + ';' + (buObjs[b].kr2 || '') + ';' + (buObjs[b].kr3 || ''),
          '', '', 'On Track', now, now
        ]);
      }
    }
  }
  
  // ===== บันทึก OKRs (Team Growth) =====
  if (okrSheet && formData.team_objectives) {
    var teamObjs = formData.team_objectives;
    for (var t = 0; t < teamObjs.length; t++) {
      if (teamObjs[t].objective) {
        okrSheet.appendRow([
          'OKR-' + Date.now() + '-T' + (t+1), contractId, 'Team',
          teamObjs[t].objective || '',
          (teamObjs[t].kr1 || '') + ';' + (teamObjs[t].kr2 || '') + ';' + (teamObjs[t].kr3 || ''),
          '', '', 'On Track', now, now
        ]);
      }
    }
  }
  
  // ===== บันทึก Personal Growth =====
  var personalSheet = ss.getSheetByName('Personal Growth');
  if (personalSheet && formData.personal_target) {
    personalSheet.appendRow([
      'PG-' + Date.now(), contractId,
      formData.personal_type || '',
      formData.personal_desc || '',
      formData.personal_target || '',
      formData.personal_progress || '0%',
      '',
      now, now
    ]);
  }
  
  // ===== บันทึก KPI (Operational Excellence) =====
  var kpiSheet = ss.getSheetByName('Operational Excellence (WI)');
  if (kpiSheet && formData.kpis) {
    var kpis = formData.kpis;
    for (var k = 0; k < kpis.length; k++) {
      if (kpis[k].name) {
        kpiSheet.appendRow([
          'KPI-' + Date.now() + '-' + (k+1), contractId,
          kpis[k].name, kpis[k].target || '',
          '', kpis[k].freq || '', 'On Track',
          now.getMonth() + 1, now.getFullYear(), now, now
        ]);
      }
    }
  }
  
  // ===== ส่ง Telegram แจ้งเตือน =====
  try {
    var props = PropertiesService.getScriptProperties();
    var botToken = props.getProperty('TELEGRAM_BOT_TOKEN');
    var chatId = props.getProperty('TELEGRAM_CHAT_ID');
    if (botToken && chatId) {
      var msg = '📝 CEO Contract ใหม่\n' +
        '👤 ' + (formData.name || '-') + '\n' +
        '🏢 ' + (formData.bu || '-') + ' / ' + (formData.team || '-') + '\n' +
        '🎭 ' + (formData.role || '-') + '\n' +
        '📋 ' + (formData.accountability || '-') + '\n' +
        '⏳ รออนุมัติ Mentor';
      UrlFetchApp.fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
        method: 'post',
        payload: { chat_id: chatId, text: msg }
      });
    }
  } catch(e) {}
  
  return { status: 'ok', contractId: contractId };
}

// ===== SAVE DATA TO SHEETS (บันทึกส่วนต่างๆ แยก) =====

function saveSheetData(data) {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var action = data.action || '';
  
  // ===== บันทึก Purpose/Vision =====
  if (action === 'savePurpose') {
    var sheet = ss.getSheetByName('Purpose');
    if (!sheet) {
      sheet = ss.insertSheet('Purpose');
      sheet.getRange(1,1,1,4).setValues([['BU','Purpose_Vision','Created_Date','Updated_Date']]);
      sheet.getRange(1,1,1,4).setFontWeight('bold').setBackground('#7c3aed').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
    var bu = data.bu || '';
    var rows = sheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] && String(rows[i][0]).trim().toLowerCase() === bu.toLowerCase()) {
        sheet.getRange(i+1, 2).setValue(data.purpose || data.vision || '');
        sheet.getRange(i+1, 4).setValue(new Date());
        found = true; break;
      }
    }
    if (!found) { sheet.appendRow([bu, data.purpose || data.vision || '', new Date(), new Date()]); }
    return {status: 'ok', message: 'บันทึก Purpose/Vision สำเร็จ'};
  }
  
  // ===== บันทึก Accountability =====
  if (action === 'saveAccountability') {
    var sheet = ss.getSheetByName('Accountability');
    if (!sheet) {
      sheet = ss.insertSheet('Accountability');
      sheet.getRange(1,1,1,4).setValues([['BU','Accountability_Items','Created_Date','Updated_Date']]);
      sheet.getRange(1,1,1,4).setFontWeight('bold').setBackground('#7c3aed').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
    var bu = data.bu || '';
    var rows = sheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] && String(rows[i][0]).trim().toLowerCase() === bu.toLowerCase()) {
        sheet.getRange(i+1, 2).setValue(data.items || '');
        sheet.getRange(i+1, 4).setValue(new Date());
        found = true; break;
      }
    }
    if (!found) { sheet.appendRow([bu, data.items || '', new Date(), new Date()]); }
    return {status: 'ok', message: 'บันทึก Accountability สำเร็จ'};
  }
  
  // ===== บันทึก OKR =====
  if (action === 'saveOKR') {
    var sheet = ss.getSheetByName('OKRs');
    if (!sheet) return {status: 'error', message: 'ไม่พบ Sheet OKRs'};
    var mid = data.member_id || '';
    var level = data.level || 'BU';
    var krs = [];
    if (data.kr1) krs.push(data.kr1);
    if (data.kr2) krs.push(data.kr2);
    if (data.kr3) krs.push(data.kr3);
    sheet.appendRow(['OKR-'+Date.now()+'-'+level.charAt(0), mid, level, data.objective || '', krs.join(';'), '', '', 'On Track', new Date(), new Date()]);
    return {status: 'ok', message: 'บันทึก OKR สำเร็จ'};
  }
  
  return {status: 'error', message: 'action ไม่รองรับ: ' + action};
}

// ===== LOAD CEO CONTRACT DATA (โหลดข้อมูลสมาชิกที่เคยบันทึก) =====

function loadCEOContract(memberId) {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var sheet = ss.getSheetByName('CEO_Contract');
  if (!sheet) return null;
  
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  
  // หาแถวที่มี member_id ตรงกัน (คอลัมน์ A)
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0]).trim() === String(memberId).trim()) {
      var headers = data[0];
      var result = {};
      for (var c = 0; c < headers.length; c++) {
        result[String(headers[c]).trim()] = data[r][c];
      }
      return result;
    }
  }
  return null;
}