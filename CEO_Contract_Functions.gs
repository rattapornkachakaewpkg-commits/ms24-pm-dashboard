// ===== CEO CONTRACT FUNCTIONS + READ/WRITE DATA =====
// เพิ่มในไฟล์ .gs ของ #ceo-dashboard

// ===== บันทึก CEO Contract จากฟอร์ม =====
function submitCEOContract(formData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // บันทึกลง CEO_Contract Sheet
  var contractSheet = ss.getSheetByName('CEO_Contract');
  var contractId = 'CEO-' + Date.now();
  var row = [
    contractId,
    formData.name || '',
    formData.bu || '',
    formData.team || '',
    formData.role || '',
    formData.purpose || '',
    formData.vision || '',
    formData.accountability || '',
    'Pending',
    new Date(),
    new Date()
  ];
  contractSheet.appendRow(row);
  
  // บันทึกลง OKRs Sheet (Business Growth)
  var okrSheet = ss.getSheetByName('OKRs');
  if (formData.okr1_objective) {
    okrSheet.appendRow([
      'OKR-' + Date.now() + '-B',
      contractId,
      'BU',
      formData.okr1_objective,
      (formData.okr1_kr1 || '') + '; ' + (formData.okr1_kr2 || ''),
      (formData.okr1_target1 || '') + '; ' + (formData.okr1_target2 || ''),
      '',
      'On Track',
      ''
    ]);
  }
  // บันทึกลง OKRs Sheet (Team Growth)
  if (formData.okr2_objective) {
    okrSheet.appendRow([
      'OKR-' + Date.now() + '-T',
      contractId,
      'Team',
      formData.okr2_objective,
      (formData.okr2_kr1 || '') + '; ' + (formData.okr2_kr2 || ''),
      (formData.okr2_target1 || '') + '; ' + (formData.okr2_target2 || ''),
      '',
      'On Track',
      ''
    ]);
  }
  
  // บันทึกลง Team Growth
  var teamSheet = ss.getSheetByName('Team Growth');
  if (formData.team_growth_type || formData.okr2_objective) {
    teamSheet.appendRow([
      'TG-' + Date.now(),
      contractId,
      formData.team || '',
      formData.team_growth_type || 'OKR',
      formData.okr2_objective || '',
      (formData.okr2_target1 || '') + '; ' + (formData.okr2_target2 || ''),
      '',
      (formData.okr2_kr1 || '') + '; ' + (formData.okr2_kr2 || ''),
      new Date(),
      new Date()
    ]);
  }
  
  // บันทึกลง Personal Growth
  var personalSheet = ss.getSheetByName('Personal Growth');
  if (formData.personal_target) {
    personalSheet.appendRow([
      'PG-' + Date.now(),
      contractId,
      formData.personal_type || '',
      formData.personal_desc || '',
      formData.personal_target || '',
      formData.personal_progress || '0%',
      '',
      new Date(),
      new Date()
    ]);
  }
  
  // บันทึกลง Operational Excellence (WI) / KPIs
  var kpiSheet = ss.getSheetByName('Operational Excellence (WI)');
  if (!kpiSheet) kpiSheet = ss.getSheetByName('KPIs');
  var now = new Date();
  if (formData.kpi1_name) {
    kpiSheet.appendRow([
      'KPI-' + Date.now() + '-1',
      contractId,
      formData.kpi1_name,
      formData.kpi1_target,
      '',
      formData.kpi1_freq || '',
      'On Track',
      now.getMonth() + 1,
      now.getFullYear(),
      new Date(),
      new Date()
    ]);
  }
  if (formData.kpi2_name) {
    kpiSheet.appendRow([
      'KPI-' + Date.now() + '-2',
      contractId,
      formData.kpi2_name,
      formData.kpi2_target,
      '',
      formData.kpi2_freq || '',
      'On Track',
      now.getMonth() + 1,
      now.getFullYear(),
      new Date(),
      new Date()
    ]);
  }
  
  // ส่ง Telegram แจ้งเตือน
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

// ===== แสดงฟอร์ม CEO Contract =====
function serveCEOContract() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var membersSheet = ss.getSheetByName('Members');
  var data = membersSheet.getDataRange().getValues();
  var headers = data[0];
  
  var idCol = headers.indexOf('รหัสสมาชิก');
  var nameCol = headers.indexOf('ชื่อ');
  var surnameCol = headers.indexOf('นามสกุล');
  var teamCol = headers.indexOf('ทีม') !== -1 ? headers.indexOf('ทีม') : headers.indexOf('division_name');
  var buCol = headers.indexOf('BU') !== -1 ? headers.indexOf('BU') : headers.indexOf('company_management');
  
  var members = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][idCol]) continue;
    members.push({
      'รหัสสมาชิก': data[i][idCol],
      'ชื่อ': data[i][nameCol],
      'นามสกุล': data[i][surnameCol],
      'ทีม': data[i][teamCol],
      'BU': data[i][buCol]
    });
  }
  
  var htmlContent = HtmlService.createHtmlOutputFromFile('CEO_Contract_Form').getContent();
  htmlContent = htmlContent.replace('<!-- MEMBERS_DATA_PLACEHOLDER -->', JSON.stringify(members));
  
  return HtmlService.createHtmlOutput(htmlContent)
    .setTitle('CEO Contract of Extreme Ownership')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ===== READ DATA FROM SHEETS (for form display) =====
function readSheetData(sheetName, bu) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var results = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    var buCol = -1;
    for (var h = 0; h < headers.length; h++) {
      if (headers[h] === 'BU' || headers[h] === 'company_management') { buCol = h; break; }
    }
    if (buCol >= 0 && bu && row[buCol].toString().trim().toLowerCase() !== bu.toString().trim().toLowerCase()) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    results.push(obj);
  }
  return results;
}

// ===== SAVE DATA TO SHEETS (for form edit/save) =====
function saveSheetData(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var action = data.action || '';
  
  if (action === 'savePurpose') {
    var sheet = ss.getSheetByName('Purpose');
    if (!sheet) { sheet = ss.insertSheet('Purpose'); sheet.getRange(1,1,1,4).setValues([['BU','Purpose_Vision','Created_Date','Updated_Date']]; }
    var bu = data.bu || '';
    var rows = sheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toString().trim().toLowerCase() === bu.toLowerCase()) {
        sheet.getRange(i+1, 2).setValue(data.purpose || data.vision || '');
        sheet.getRange(i+1, 4).setValue(new Date());
        found = true; break;
      }
    }
    if (!found) { sheet.appendRow([bu, data.purpose || data.vision || '', new Date(), new Date()]); }
    return {status: 'ok', message: 'บันทึก Purpose สำเร็จ'};
  }
  
  if (action === 'saveAccountability') {
    var sheet = ss.getSheetByName('Accountability');
    if (!sheet) { sheet = ss.insertSheet('Accountability'); sheet.getRange(1,1,1,4).setValues([['BU','Accountability_Items','Created_Date','Updated_Date']]; }
    var bu = data.bu || '';
    var rows = sheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toString().trim().toLowerCase() === bu.toLowerCase()) {
        sheet.getRange(i+1, 2).setValue(data.items || '');
        sheet.getRange(i+1, 4).setValue(new Date());
        found = true; break;
      }
    }
    if (!found) { sheet.appendRow([bu, data.items || '', new Date(), new Date()]); }
    return {status: 'ok', message: 'บันทึก Accountability สำเร็จ'};
  }
  
  if (action === 'saveOKR') {
    var sheet = ss.getSheetByName('OKRs');
    if (!sheet) return {status: 'error', message: 'ไม่พบ Sheet OKRs'};
    var mid = data.member_id || '';
    var level = data.level || 'BU';
    var krText = (data.kr1 || '') + '; ' + (data.kr2 || '');
    var tgtText = (data.target1 || '') + '; ' + (data.target2 || '');
    sheet.appendRow(['OKR-'+Date.now()+'-'+level.charAt(0), mid, level, data.objective || '', krText, tgtText, '', 'On Track', '']);
    return {status: 'ok', message: 'บันทึก OKR สำเร็จ'};
  }
  
  return {status: 'error', message: 'action ไม่รองรับ: ' + action};
}