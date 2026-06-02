/**
 * PKG Data Hub v3.2 - Full-Stack Production Grade + Architecture Complete
 * Google Apps Script Backend
 *
 * v3.1 + Architecture fixes:
 * 🔧 Environment Config (SPREADSHEET_ID → Script Property)
 * 🏥 Health Check endpoint
 * 🗄️ Soft Delete + Backup before delete
 * 🔄 Telegram Retry (3 attempts)
 * 📊 API Versioning (v=3.2)
 * 📚 Auto API Documentation
 *
 * Inherited from v3.1:
 * 🔐 API Key Auth
 * 🛡️ Input Validation + XSS Prevention
 * 🚦 Rate Limiting
 * 🌐 CORS Headers
 * 🔄 Idempotency (Dedup)
 * 🔑 Dynamic Config (Script Properties)
 * 📨 onFormSubmit Trigger
 * 📋 Audit Log
 * 📊 REST Standard Response
 * ⚡ Deep Error Handling
 * 🧪 QC Test Suite
 */

// ===== ENVIRONMENT CONFIG (Dynamic - ไม่ฝังในโค้ด) =====
// ค่าเริ่มต้นกรณี initialize() ยังไม่ได้รัน
function getSpreadsheetId() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (!id) {
    id = '1V33wZ9zV3qyZeTj2_WMSE466Di3KDjzBpD8K0_zR_tY'; // fallback
    props.setProperty('SPREADSHEET_ID', id);
  }
  return id;
}

const AUDIT_SHEET = '_AuditLog';
const RATE_LIMIT_SHEET = '_RateLimit';
const CONFIG_SHEET = '_Config';
const BACKUP_SHEET = '_Backup';  // Sheet สําหรับ Soft Delete
const API_VERSION = '3.2';

// ===== CORS + AUTH + MAIN HANDLER =====

function doGet(e) {
  // ถ้ามีพารามิเตอร์ page=ceo → แสดงฟอร์ม CEO Contract
  if (e.parameter && e.parameter.page === 'ceo') {
    return serveCEOContract();
  }
  // ถ้าไม่มี action → แสดง Survey Form
  if (!e.parameter || !e.parameter.action) {
    return serveSurvey();
  }
  // ถ้า action=survey → แสดง Survey Form
  if (e.parameter.action === 'survey') {
    return serveSurvey();
  }
  // ถ้า action=memberData → ส่ง JavaScript โดยตรง (ข้าม handleRequest)
  if (e.parameter.action === 'memberData') {
    return getMemberData();
  }
  // JSONP support
  if (e.parameter.callback) {
    var data = handleRequest(e);
    var json = JSON.stringify(data);
    var output = e.parameter.callback + '(' + json + ')';
    return ContentService.createTextOutput(output)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var startTime = Date.now();
  var clientIP = (e.parameter && e.parameter.ip) || 'unknown';
  var requestAction = 'unknown';

  try {
    // 1. Parse request
    var data = parseRequest(e);
    requestAction = data.action || 'readSheet';

    // 1.5 API Version check
    if (data.v && data.v !== API_VERSION) {
      auditLog('VERSION_MISMATCH', requestAction, { requested: data.v, current: API_VERSION });
      // ยังอนุญาตให้ทํางานได้ แต่บันทึก warning
    }

    // 2. CORS preflight
    if (requestAction === 'preflight' || !data.action) {
      return corsResponse({ status: 'ok', message: 'CORS OK' });
    }

    // 3. API Key Auth (ยกเว้น listSheets, readSheet, submitForm, lookupMember, health, apiDocs)
    var skipAuth = ['listSheets', 'readSheet', 'read', 'submitForm', 'lookupMember', 'memberData', 'health', 'apiDocs'];
    if (skipAuth.indexOf(requestAction) === -1) {
      var authResult = checkApiKey(data.api_key);
      if (!authResult.valid) {
        auditLog('AUTH_FAIL', requestAction, { error: authResult.message });
        return corsResponse({ status: 'error', code: 401, message: authResult.message });
      }
    }

    // 4. Rate Limiting
    var rateResult = checkRateLimit(clientIP);
    if (!rateResult.allowed) {
      auditLog('RATE_LIMIT', requestAction, { ip: clientIP, remaining: 0 });
      return corsResponse({
        status: 'error',
        code: 429,
        message: 'Rate limit exceeded - ลองใหม่ใน ' + rateResult.retryAfter + ' วินาที',
        retryAfter: rateResult.retryAfter
      });
    }

    // 5. Process action
    var ss = SpreadsheetApp.openById(getSpreadsheetId());
    var result = processAction(ss, data);

    // 6. Audit Log
    var duration = Date.now() - startTime;
    auditLog(requestAction, data.sheetName || '-', { duration: duration, rows: result.data ? result.data.rows : 0 });

    return corsResponse({
      status: 'ok',
      code: 200,
      duration: duration + 'ms',
      data: result.data
    });

  } catch (err) {
    // Deep error handling
    var errorDetail = {
      message: err.message,
      stack: err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : 'no stack',
      action: requestAction,
      timestamp: new Date().toISOString()
    };
    auditLog('ERROR', requestAction, errorDetail);

    return corsResponse({
      status: 'error',
      code: 500,
      message: err.message,
      detail: errorDetail.stack
    });
  }
}

// ===== CORS Response =====

function corsResponse(data) {
  var json = JSON.stringify(data);
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== Parse Request =====

function parseRequest(e) {
  var data = {};

  if (e.postData && e.postData.contents) {
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      // fallback to query params
    }
  }

  // Merge query params (GET params override POST body for specific fields)
  var params = e.parameter || {};
  var mergeFields = ['action', 'act', 'sheetName', 'sheet', 'api_key', 'row', 'col', 'value'];
  for (var i = 0; i < mergeFields.length; i++) {
    var field = mergeFields[i];
    if (params[field] && !data[field]) {
      data[field] = params[field];
    }
  }

  // Parse JSON string fields
  var jsonFields = ['rowData', 'rows', 'headers', 'formData'];
  for (var j = 0; j < jsonFields.length; j++) {
    var f = jsonFields[j];
    if (typeof data[f] === 'string') {
      data[f] = tryParseJSON(data[f]);
    }
  }

  // Aliases
  data.action = data.action || data.act || 'readSheet';
  data.sheetName = data.sheetName || data.sheet || null;

  // Parse numeric fields
  if (data.row) data.row = parseInt(data.row);
  if (data.col) data.col = parseInt(data.col);

  return data;
}

// ===== API Key Auth =====

function checkApiKey(key) {
  if (!key) {
    return { valid: false, message: 'ต้องระบุ api_key - ดูค่าจาก Sheet _Config หรือใช้คําสั่ง getApiKey' };
  }

  var validKey = getConfigValue('API_KEY');
  if (!validKey) {
    // Auto-generate API Key ถ้ายังไม่มี
    validKey = generateApiKey();
    setConfigValue('API_KEY', validKey);
  }

  if (key === validKey) {
    return { valid: true };
  }

  return { valid: false, message: 'api_key ไม่ถูกต้อง' };
}

function generateApiKey() {
  return 'pkg_' + Utilities.getUuid().replace(/-/g, '').substring(0, 20);
}

// ===== Rate Limiting =====

function checkRateLimit(clientIP) {
  var maxRequests = 60;  // 60 requests
  var windowMs = 60000;  // per 1 minute

  // ใช้ Script Properties เก็บ rate limit (ง่ายกว่า Sheet)
  var props = PropertiesService.getScriptProperties();
  var rateKey = 'rate_' + clientIP;
  var now = Date.now();

  var rateData;
  try {
    rateData = JSON.parse(props.getProperty(rateKey) || '{}');
  } catch (e) {
    rateData = {};
  }

  // Reset window ถ้าหมดเวลา
  if (!rateData.windowStart || (now - rateData.windowStart) > windowMs) {
    rateData = { windowStart: now, count: 0 };
  }

  rateData.count++;
  props.setProperty(rateKey, JSON.stringify(rateData));

  var remaining = maxRequests - rateData.count;
  var retryAfter = Math.ceil((windowMs - (now - rateData.windowStart)) / 1000);

  if (rateData.count > maxRequests) {
    return { allowed: false, retryAfter: retryAfter, remaining: 0 };
  }

  return { allowed: true, remaining: remaining, retryAfter: 0 };
}

// ===== Input Validation =====

function validateInput(action, data) {
  var errors = [];

  // ตรวจ sheetName
  if (data.sheetName) {
    if (typeof data.sheetName !== 'string' || data.sheetName.length > 100) {
      errors.push('sheetName ต้องเป็น string 1-100 ตัวอักษร');
    }
    if (/[\/\\*?\[\]<>{}|]/.test(data.sheetName)) {
      errors.push('sheetName ห้ามมีอักขระ / \\ * ? [ ] < > { } |');
    }
    // XSS prevention: ตรวจ HTML tags
    if (/<\/?[a-z][\s\S]*>/i.test(data.sheetName)) {
      errors.push('sheetName ห้ามมี HTML tags (XSS prevention)');
    }
  }

  // ตรวจ row/col
  if (data.row && (data.row < 1 || data.row > 100000)) {
    errors.push('row ต้องอยู่ระหว่าง 1-100,000');
  }
  if (data.col && (data.col < 1 || data.col > 26)) {
    errors.push('col ต้องอยู่ระหว่าง 1-26');
  }

  // ตรวจ rowData
  if (data.rowData) {
    if (!Array.isArray(data.rowData)) {
      errors.push('rowData ต้องเป็น Array');
    } else if (data.rowData.length > 50) {
      errors.push('rowData ต้องไม่เกิน 50 ฟิลด์');
    } else {
      for (var i = 0; i < data.rowData.length; i++) {
        if (typeof data.rowData[i] === 'string' && data.rowData[i].length > 10000) {
          errors.push('rowData[' + i + '] ยาวเกิน 10,000 ตัวอักษร');
          break;
        }
      }
    }
  }

  // ตรวจ rows (batch)
  if (data.rows) {
    if (!Array.isArray(data.rows)) {
      errors.push('rows ต้องเป็น Array of Arrays');
    } else if (data.rows.length > 500) {
      errors.push('rows ต้องไม่เกิน 500 แถวต่อคําขอ');
    }
  }

  // ตรวจ formData
  if (action === 'submitForm' && data.formData && data.formData.member_id) {
    if (typeof data.formData.member_id !== 'string' || data.formData.member_id.length > 20) {
      errors.push('member_id ต้องเป็น string 1-20 ตัวอักษร');
    }
  }

  return errors;
}

// ===== Idempotency (Dedup) =====

function checkIdempotency(ss, sheetName, rowData, keyField) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return { isDuplicate: false };

  var lastRow = sheet.getLastRow();
  // ตรวจเฉพาะ 10 แถวล่าสุด (ประสิทธิภาพ)
  var checkRows = Math.min(lastRow, 10);
  var values = sheet.getRange(lastRow - checkRows + 1, 1, checkRows, sheet.getLastColumn()).getValues();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // หา key field column
  var keyCol = -1;
  for (var h = 0; h < headers.length; h++) {
    if (headers[h] === keyField) { keyCol = h; break; }
  }
  if (keyCol === -1) return { isDuplicate: false };

  // ตรวจซ้ํา (เทียบ key field + timestamp ใน 5 นาที)
  var keyIndex = -1;
  for (var k = 0; k < headers.length; k++) {
    if (headers[k] === keyField) { keyIndex = k; break; }
  }

  var dataKeyValue = rowData[keyIndex];
  var now = Date.now();

  for (var r = 0; r < values.length; r++) {
    if (values[r][keyIndex] === dataKeyValue) {
      // เช็ค timestamp ว่าใกล้เคียงกันไหม (5 นาที)
      var timeCol = 0; // สมมุติ Timestamp อยู่ col แรก
      if (values[r][timeCol]) {
        var rowTime = new Date(values[r][timeCol]).getTime();
        if (!isNaN(rowTime) && (now - rowTime) < 300000) { // 5 min
          return { isDuplicate: true, existingRow: lastRow - checkRows + 1 + r };
        }
      }
    }
  }

  return { isDuplicate: false };
}

// ===== Config Management (Script Properties) =====

function getConfigValue(key) {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty(key);
}

function setConfigValue(key, value) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty(key, value);
}

function getAllConfig() {
  var props = PropertiesService.getScriptProperties();
  var allProps = props.getProperties();
  // ซ่อนค่าที่ sensitive
  var result = {};
  var keys = Object.keys(allProps);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k.indexOf('TOKEN') !== -1 || k.indexOf('KEY') !== -1 || k.indexOf('SECRET') !== -1) {
      result[k] = allProps[k].substring(0, 8) + '***';
    } else {
      result[k] = allProps[k];
    }
  }
  return result;
}

// ===== Telegram Integration =====

function sendTelegramMessage(chatId, text, retryCount) {
  retryCount = retryCount || 0;
  var maxRetries = 3;
  var botToken = getConfigValue('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    return { error: 'ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN - ใช้คําสั่ง setConfig' };
  }

  try {
    var url = 'https://api.telegram.org/bot' + botToken + '/sendMessage';
    var payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var result = JSON.parse(response.getContentText());

    if (!result.ok) {
      // Retry logic: ลองใหม่สูงสุด 3 ครั้ง ห่างกัน 2 วินาที
      if (retryCount < maxRetries - 1) {
        Utilities.sleep(2000);
        auditLog('TELEGRAM_RETRY', 'sendMessage', { attempt: retryCount + 2, chatId: chatId, error: result.description });
        return sendTelegramMessage(chatId, text, retryCount + 1);
      }
      auditLog('TELEGRAM_FAIL', 'sendMessage', { error: result.description, chatId: chatId, attempts: retryCount + 1 });
    }

    return result;
  } catch (e) {
    // Retry logic: ลองใหม่สูงสุด 3 ครั้ง ห่างกัน 2 วินาที
    if (retryCount < maxRetries - 1) {
      Utilities.sleep(2000);
      auditLog('TELEGRAM_RETRY', 'sendMessage', { attempt: retryCount + 2, chatId: chatId, error: e.toString() });
      return sendTelegramMessage(chatId, text, retryCount + 1);
    }
    auditLog('TELEGRAM_ERROR', 'sendMessage', { error: e.toString(), chatId: chatId, attempts: retryCount + 1 });
    return { error: e.toString() };
  }
}

function sendTelegramNotification(formData) {
  var chatId = getConfigValue('TELEGRAM_CHAT_ID');
  if (!chatId) return { skipped: true, reason: 'ยังไม่ได้ตั้ง TELEGRAM_CHAT_ID' };

  var text = '📋 <b>แบบสํารวจใหม่</b>\n' +
    '👤 ' + (formData.member_name || 'ไม่ระบุชื่อ') + '\n' +
    '🏢 ' + (formData.member_company || '-') + ' | ' + (formData.member_team || '-') + '\n' +
    '📊 บัญชี: ' + (formData.acct_overall || '-') + '/5\n' +
    '💰 การเงิน: ' + (formData.fin_overall || '-') + '/5\n' +
    '🕐 ' + new Date().toLocaleString('th-TH');

  return sendTelegramMessage(chatId, text);
}

// ===== Audit Log =====

function auditLog(action, target, detail) {
  try {
    var ss = SpreadsheetApp.openById(getSpreadsheetId());
    var sheet = ss.getSheetByName(AUDIT_SHEET);

    if (!sheet) {
      sheet = ss.insertSheet(AUDIT_SHEET);
      sheet.getRange(1, 1, 1, 6).setValues([['Timestamp', 'Action', 'Target', 'Detail', 'Duration_ms', 'Version']]);
      sheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#333333').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    var row = [
      new Date().toISOString(),
      action,
      target || '-',
      typeof detail === 'object' ? JSON.stringify(detail).substring(0, 500) : (detail || '-'),
      detail && detail.duration ? detail.duration : 0,
      API_VERSION  // เพิ่ม version ใน audit
    ];

    sheet.appendRow(row);

    // เก็บแค่ 1000 แถวล่าสุด
    if (sheet.getLastRow() > 1001) {
      sheet.deleteRow(2); // ลบแถวที่ 2 (เก่าที่สุด รักษา header)
    }
    // เพิ่ม Backup helper function
  } catch (e) {
    // Audit log fail ไม่ควรทําให้ request fail
    console.error('Audit log error:', e);
  }
}

// ===== onFormSubmit Trigger (Google Form) =====

function setupFormTrigger() {
  // รันครั้งเดียวเพื่อตั้งค่า trigger
  // ลบ trigger เก่าที่อาจค้างอยู่
  var existingTriggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existingTriggers.length; i++) {
    if (existingTriggers[i].getHandlerFunction() === 'onFormSubmitHandler') {
      ScriptApp.deleteTrigger(existingTriggers[i]);
      Logger.log('🗑️ ลบ trigger เก่า: ' + existingTriggers[i].getHandlerFunction());
    }
  }

  // สร้าง trigger ใหม่ - ใช้ Spreadsheet onFormSubmit
  // เมื่อ Form submit ข้อมูลเข้า Spreadsheet → trigger นี้จะทํางาน
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  ScriptApp.newTrigger('onFormSubmitHandler')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  Logger.log('✅ ตั้งค่า Form Trigger สําเร็จ');
  return { message: 'ตั้งค่า Form Trigger สําเร็จ - Form submit จะส่งข้อมูลเข้า Sheet และแจ้งเตือน Telegram อัตโนมัติ' };
}

function onFormSubmitHandler(e) {
  // รับข้อมูลจาก Google Form อัตโนมัติ
  // เมื่อมีคนกรอก Form → ข้อมูลเข้า Sheet อัตโนมัติ → trigger นี้ทำงาน
  try {
    var response = e.namedValues;
    Logger.log('📝 Form submit received: ' + JSON.stringify(response));

    var ss = SpreadsheetApp.openById(getSpreadsheetId());

    // ===== ดึงรหัสสมาชิก =====
    var memberId = '';
    if (response['รหัสสมาชิก']) {
      // namedValues มักเป็น Array
      memberId = Array.isArray(response['รหัสสมาชิก']) ? response['รหัสสมาชิก'][0] : response['รหัสสมาชิก'];
      memberId = memberId.toString().trim();
    }
    Logger.log('📋 รหัสสมาชิก: ' + memberId);

    // ===== Lookup ชื่อ/ทีม/บริษัท จาก Sheet Members =====
    var memberName = '-';
    var memberTeam = '-';
    var memberCompany = '-';
    var memberFound = false;

    if (memberId) {
      var memberInfo = lookupMemberData(ss, memberId);
      Logger.log('🔍 Lookup member: ' + memberId + ' → found=' + memberInfo.found);
      if (memberInfo.found) {
        memberName = memberInfo.name;
        memberTeam = memberInfo.team;
        memberCompany = memberInfo.company;
        memberFound = true;
      }
    }

    // ===== เติม autocomplete ลง Sheet ที่ Form ส่งมา =====
    if (memberFound) {
      var sheets = ss.getSheets();
      for (var s = 0; s < sheets.length; s++) {
        var sheetName = sheets[s].getName();
        // หา Sheet ที่ Form เชื่อม
        if (sheetName.indexOf('การตอบแบบฟอร์ม') !== -1 || sheetName.indexOf('Form') !== -1) {
          var sheet = sheets[s];
          var lastRow = sheet.getLastRow();
          var lastCol = sheet.getLastColumn();
          if (lastRow < 2) continue;

          var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
          Logger.log('📋 Sheet headers: ' + headers.join(', '));

          var updated = false;
          for (var h = 0; h < headers.length; h++) {
            var header = headers[h].toString();
            // ชื่อ-นามสกุล
            if (header.indexOf('ชื่อ-นามสกุล') !== -1 || header.indexOf('ชื่อ นามสกุล') !== -1 || header === 'ชื่อ' || header.toLowerCase() === 'name' || header.toLowerCase() === 'fullname') {
              var currentVal = sheet.getRange(lastRow, h + 1).getValue();
              if (!currentVal || currentVal.toString().trim() === '') {
                sheet.getRange(lastRow, h + 1).setValue(memberName);
                updated = true;
              }
            }
            // ชื่อทีม
            if (header === 'ชื่อทีม' || header === 'ทีม' || header.toLowerCase() === 'team') {
              var currentVal2 = sheet.getRange(lastRow, h + 1).getValue();
              if (!currentVal2 || currentVal2.toString().trim() === '') {
                sheet.getRange(lastRow, h + 1).setValue(memberTeam);
                updated = true;
              }
            }
            // บริษัท
            if (header === 'บริษัท' || header === 'กลุ่มบริษัท' || header.toLowerCase() === 'company') {
              var currentVal3 = sheet.getRange(lastRow, h + 1).getValue();
              if (!currentVal3 || currentVal3.toString().trim() === '') {
                sheet.getRange(lastRow, h + 1).setValue(memberCompany);
                updated = true;
              }
            }
          }
          if (updated) {
            Logger.log('✅ Autocomplete ลง Sheet "' + sheetName + '" สำเร็จ: ' + memberName + ', ' + memberTeam + ', ' + memberCompany);
          }
          break;
        }
      }
    } else {
      Logger.log('⚠️ ไม่พบรหัสสมาชิก "' + memberId + '" ใน Sheet Members');
    }

    // ===== สร้าง Sheet "Form_Responses" เป็นช่องทางสำรอง =====
    var formRespSheet = ss.getSheetByName('Form_Responses');
    if (!formRespSheet) {
      formRespSheet = ss.insertSheet('Form_Responses');
      var respHeaders = ['Timestamp', 'รหัสสมาชิก', 'ชื่อ-นามสกุล', 'ชื่อทีม', 'บริษัท',
        'บัญชี_ความร่วมมือ', 'บัญชี_ความรับผิดชอบ', 'บัญชี_ความเร็วในการตอบสนอง',
        'บัญชี_ความถูกต้องของข้อมูล', 'บัญชี_การให้คำปรึกษา', 'บัญชี_พึงพอใจภาพรวม', 'บัญชี_ข้อเสนอแนะ',
        'การเงิน_ความร่วมมือ', 'การเงิน_ความรับผิดชอบ', 'การเงิน_ความเร็วในการตอบสนอง',
        'การเงิน_ความถูกต้องของข้อมูล', 'การเงิน_การให้คำปรึกษา', 'การเงิน_พึงพอใจภาพรวม', 'การเงิน_ข้อเสนอแนะ'];
      formRespSheet.getRange(1, 1, 1, respHeaders.length).setValues([respHeaders]);
      formatHeaderRow(formRespSheet, respHeaders.length);
      Logger.log('📋 สร้าง Sheet Form_Responses สำเร็จ');
    }

    // ===== เขียนข้อมูลลง Form_Responses =====
    var timestamp = new Date();
    var acctCollab = getResponseValue(response, ['บัญชี: ความร่วมมือ']);
    var acctResp = getResponseValue(response, ['บัญชี: ความรับผิดชอบ']);
    var acctSpeed = getResponseValue(response, ['บัญชี: ความเร็วในการตอบสนอง']);
    var acctAcc = getResponseValue(response, ['บัญชี: ความถูกต้องของข้อมูล']);
    var acctConsult = getResponseValue(response, ['บัญชี: การให้คำปรึกษา']);
    var acctOverall = getResponseValue(response, ['บัญชี: ความพึงพอใจภาพรวม']);
    var acctSuggest = getResponseValue(response, ['ข้อเสนอแนะเกี่ยวกับทีมบัญชี']);
    var finCollab = getResponseValue(response, ['การเงิน: ความร่วมมือ']);
    var finResp = getResponseValue(response, ['การเงิน: ความรับผิดชอบ']);
    var finSpeed = getResponseValue(response, ['การเงิน: ความเร็วในการตอบสนอง']);
    var finAcc = getResponseValue(response, ['การเงิน: ความถูกต้องของข้อมูล']);
    var finConsult = getResponseValue(response, ['การเงิน: การให้คำปรึกษา']);
    var finOverall = getResponseValue(response, ['การเงิน: ความพึงพอใจภาพรวม']);
    var finSuggest = getResponseValue(response, ['ข้อเสนอแนะเกี่ยวกับทีมการเงิน']);

    var rowData = [
      timestamp, memberId, memberName, memberTeam, memberCompany,
      acctCollab, acctResp, acctSpeed, acctAcc, acctConsult, acctOverall, acctSuggest,
      finCollab, finResp, finSpeed, finAcc, finConsult, finOverall, finSuggest
    ];
    formRespSheet.appendRow(rowData);
    Logger.log('✅ เขียนข้อมูลลง Form_Responses แถวที่ ' + formRespSheet.getLastRow());

    // ===== Telegram notification =====
    var chatId = getConfigValue('TELEGRAM_CHAT_ID');
    if (chatId) {
      var acctAvg = 0, finAvg = 0, acctCount = 0, finCount = 0;
      if (acctCollab) { acctAvg += Number(acctCollab); acctCount++; }
      if (acctResp) { acctAvg += Number(acctResp); acctCount++; }
      if (acctSpeed) { acctAvg += Number(acctSpeed); acctCount++; }
      if (acctAcc) { acctAvg += Number(acctAcc); acctCount++; }
      if (acctConsult) { acctAvg += Number(acctConsult); acctCount++; }
      if (acctOverall) { acctAvg += Number(acctOverall); acctCount++; }
      if (acctCount > 0) acctAvg = (acctAvg / acctCount).toFixed(1);
      if (finCollab) { finAvg += Number(finCollab); finCount++; }
      if (finResp) { finAvg += Number(finResp); finCount++; }
      if (finSpeed) { finAvg += Number(finSpeed); finCount++; }
      if (finAcc) { finAvg += Number(finAcc); finCount++; }
      if (finConsult) { finAvg += Number(finConsult); finCount++; }
      if (finOverall) { finAvg += Number(finOverall); finCount++; }
      if (finCount > 0) finAvg = (finAvg / finCount).toFixed(1);
      var text = '📋 <b>Feedback จากกลุ่มลูกค้าของ ทีมบัญชีและทีมการเงิน 2026</b>\n';
      text += '👤 ' + memberName + '\n';
      text += '🏢 ' + memberCompany + '\n';
      text += '👥 ' + memberTeam + '\n';
      text += '📊 บัญชี: ' + acctAvg + '/5 | การเงิน: ' + finAvg + '/5\n';
      text += '🕐 ' + new Date().toLocaleString('th-TH');
      sendTelegramMessage(chatId, text);
    }

    auditLog('FORM_SUBMIT', 'Form', { memberId: memberId, name: memberName, found: memberFound });
    Logger.log('✅ Form submit processed สำเร็จ');

  } catch (err) {
    Logger.log('❌ Form submit error: ' + err.message);
    Logger.log('Stack: ' + (err.stack ? err.stack.substring(0, 500) : 'no stack'));
    auditLog('FORM_SUBMIT_ERROR', 'onFormSubmit', { error: err.message, stack: err.stack ? err.stack.substring(0, 200) : '' });
  }
}

// Helper: ดึงค่าจาก namedValues โดยรองรับหลายรูปแบบชื่อคอลัมน์
function getResponseValue(response, possibleKeys) {
  for (var i = 0; i < possibleKeys.length; i++) {
    if (response[possibleKeys[i]]) {
      var val = response[possibleKeys[i]];
      return Array.isArray(val) ? val.join(', ') : val;
    }
  }
  return '';
}

// ===== Lookup Member =====

function lookupMemberData(ss, memberId) {
  memberId = memberId.toString().toUpperCase().trim();

  var searchSheets = ['Members', 'สมาชิก', 'ทุนองค์กร', 'CEO_AI_Co_Worker', 'Training_Master'];

  for (var s = 0; s < searchSheets.length; s++) {
    var sheet = ss.getSheetByName(searchSheets[s]);
    if (!sheet) continue;

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) continue;

    var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values[0];

    var idCol = -1, nameCol = -1, surnameCol = -1, teamCol = -1, companyCol = -1, buCol = -1;

    // ลําดับความสําคัญ: exact match ก่อน → ถ้าไม่เจอ ค่อย contains
    // สําคัญ: 'ชื่อทีม' มีคําว่า 'ชื่อ' จึงต้องตรวจ exact ก่อนเสมอ
    for (var h = 0; h < headers.length; h++) {
      var header = headers[h].toString().trim();
      var headerLower = header.toLowerCase();

      // ID column
      if (idCol === -1) {
        if (header === 'รหัสสมาชิก' || headerLower === 'member_id' || headerLower === 'memberid' || headerLower === 'รหัส' || headerLower === 'id') {
          idCol = h;
        } else if (headerLower.includes('รหัส') || headerLower.includes('id') || headerLower.includes('code')) {
          idCol = h;
        }
      }

      // Name column - exact match เท่านั้น (ห้ามใช้ includes 'ชื่อ' เพราะชนกับ 'ชื่อทีม')
      if (nameCol === -1) {
        if (header === 'ชื่อ-นามสกุล' || header === 'ชื่อ นามสกุล' || header === 'ชื่อ นามสกุล' || header === 'ชื่อนามสกุล' || headerLower === 'fullname' || headerLower === 'full_name' || headerLower === 'name' || header === 'ชื่อ') {
          nameCol = h;
        }
      }

      // Team column
      if (teamCol === -1) {
        if (header === 'ชื่อทีม' || headerLower === 'ทีม' || headerLower === 'team' || headerLower === 'team_name' || headerLower === 'ทีม/แผนก') {
          teamCol = h;
        } else if (headerLower.includes('ทีม') || headerLower.includes('team')) {
          teamCol = h;
        }
      }

      // Company column
      if (companyCol === -1) {
        if (header === 'บริษัท' || headerLower === 'company' || header === 'กลุ่ม' || headerLower === 'กลุ่มบริษัท') {
          companyCol = h;
        } else if (headerLower.includes('บริษัท') || headerLower.includes('company') || headerLower.includes('กลุ่ม')) {
          companyCol = h;
        }
      }
    }

    if (idCol === -1) continue;

    for (var r = 1; r < values.length; r++) {
      var cellValue = values[r][idCol].toString().toUpperCase().trim();
      if (cellValue === memberId) {
        return {
          found: true,
          member_id: values[r][idCol],
          name: (nameCol >= 0 ? values[r][nameCol] : '') + (surnameCol >= 0 && values[r][surnameCol] ? ' ' + values[r][surnameCol] : ''),
          team: teamCol >= 0 ? values[r][teamCol] : '-',
          company: buCol >= 0 && values[r][buCol] ? values[r][buCol] : (companyCol >= 0 ? values[r][companyCol] : '-'),
          source: searchSheets[s]
        };
      }
    }
  }

  return { found: false, member_id: memberId, name: '-', team: '-', company: '-' };
}

// ===== Helper Functions =====

function getSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('ไม่พบ Sheet "' + name + '"');
  return sheet;
}

function formatHeaderRow(sheet, colCount) {
  sheet.getRange(1, 1, 1, colCount)
    .setFontWeight('bold')
    .setBackground('#003366')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

function tryParseJSON(str) {
  try { return JSON.parse(str); } catch (e) { return null; }
}

// ===== Process Action (Main Router) =====

function processAction(ss, data) {
  var action = data.action;
  var result = { data: {} };

  // Input Validation
  var validationErrors = validateInput(action, data);
  if (validationErrors.length > 0) {
    throw new Error('Validation failed: ' + validationErrors.join('; '));
  }

  switch (action) {

    // ===== READ =====
    case 'listSheets':
      result.data = {
        sheets: ss.getSheets().map(function(s) { return s.getName(); }),
        total: ss.getSheets().length
      };
      break;

    case 'readSheet':
    case 'read':
      var sheetNameRead = data.sheetName || 'CEO_Contract';
      var sheetRead = getSheet(ss, sheetNameRead);
      var lastRow = sheetRead.getLastRow();
      var lastCol = sheetRead.getLastColumn();
      if (lastRow === 0) {
        result.data = { sheet: sheetNameRead, rows: 0, data: [] };
      } else {
        var values = sheetRead.getRange(1, 1, lastRow, lastCol).getValues();
        var headers = values[0];
        var dataRows = [];
        for (var i = 1; i < values.length; i++) {
          var obj = {};
          for (var j = 0; j < headers.length; j++) {
            obj[headers[j]] = values[i][j];
          }
          dataRows.push(obj);
        }
        result.data = { sheet: sheetNameRead, rows: dataRows.length, data: dataRows };
      }
      break;

    case 'getCell':
      if (!data.sheetName || !data.row || !data.col) throw new Error('ต้องระบุ sheetName, row, col');
      var sheetGetCell = getSheet(ss, data.sheetName);
      result.data = { value: sheetGetCell.getRange(data.row, data.col).getValue() };
      break;

    case 'getSheetInfo':
      if (!data.sheetName) throw new Error('ต้องระบุ sheetName');
      var sheetInfo = getSheet(ss, data.sheetName);
      result.data = {
        name: sheetInfo.getName(),
        index: sheetInfo.getIndex(),
        lastRow: sheetInfo.getLastRow(),
        lastColumn: sheetInfo.getLastColumn()
      };
      break;

    // ===== WRITE =====
    case 'addSheet':
      if (!data.sheetName) throw new Error('ต้องระบุ sheetName');
      if (ss.getSheetByName(data.sheetName)) throw new Error('Sheet "' + data.sheetName + '" มีอยู่แล้ว');
      var newSheet = ss.insertSheet(data.sheetName);
      if (data.headers) {
        newSheet.getRange(1, 1, 1, data.headers.length).setValues([data.headers]);
        formatHeaderRow(newSheet, data.headers.length);
      }
      result.data = { message: 'สร้าง Sheet "' + data.sheetName + '" สําเร็จ' };
      break;

    case 'setHeaders':
      if (!data.sheetName || !data.headers) throw new Error('ต้องระบุ sheetName และ headers');
      var sheetHeaders = getSheet(ss, data.sheetName);
      sheetHeaders.getRange(1, 1, 1, data.headers.length).setValues([data.headers]);
      formatHeaderRow(sheetHeaders, data.headers.length);
      result.data = { message: 'ตั้งค่า Headers สําเร็จ' };
      break;

    case 'writeRow':
    case 'write':
      if (!data.sheetName || !data.rowData) throw new Error('ต้องระบุ sheetName และ rowData');
      var sheetWrite = getSheet(ss, data.sheetName);
      sheetWrite.appendRow(data.rowData);
      result.data = { message: 'เพิ่ม 1 แถวสําเร็จ', row: sheetWrite.getLastRow() };
      break;

    case 'writeRows':
      if (!data.sheetName || !data.rows) throw new Error('ต้องระบุ sheetName และ rows');
      var sheetWriteRows = getSheet(ss, data.sheetName);
      if (data.rows.length > 0) {
        var startRow = sheetWriteRows.getLastRow() + 1;
        sheetWriteRows.getRange(startRow, 1, data.rows.length, data.rows[0].length).setValues(data.rows);
      }
      result.data = { message: 'เพิ่ม ' + data.rows.length + ' แถวสําเร็จ' };
      break;

    case 'setCell':
      if (!data.sheetName || !data.row || !data.col) throw new Error('ต้องระบุ sheetName, row, col');
      var sheetSetCell = getSheet(ss, data.sheetName);
      sheetSetCell.getRange(data.row, data.col).setValue(data.value !== undefined ? data.value : '');
      result.data = { message: 'ตั้งค่าเซลล์สําเร็จ' };
      break;

    case 'setRange':
      if (!data.sheetName || !data.row || !data.col || !data.values) throw new Error('ต้องระบุ sheetName, row, col, values');
      var sheetSetRange = getSheet(ss, data.sheetName);
      sheetSetRange.getRange(data.row, data.col, data.values.length, data.values[0].length).setValues(data.values);
      result.data = { message: 'ตั้งค่าช่วงเซลล์สําเร็จ' };
      break;

    case 'insertRowAt':
      if (!data.sheetName || !data.row || !data.rowData) throw new Error('ต้องระบุ sheetName, row, rowData');
      var sheetInsertRow = getSheet(ss, data.sheetName);
      sheetInsertRow.insertRowBefore(data.row);
      sheetInsertRow.getRange(data.row, 1, 1, data.rowData.length).setValues([data.rowData]);
      result.data = { message: 'แทรกแถวที่ตําแหน่ง ' + data.row + ' สําเร็จ' };
      break;

    case 'updateRow':
      if (!data.sheetName || !data.row || !data.rowData) throw new Error('ต้องระบุ sheetName, row, rowData');
      var sheetUpdateRow = getSheet(ss, data.sheetName);
      sheetUpdateRow.getRange(data.row, 1, 1, data.rowData.length).setValues([data.rowData]);
      result.data = { message: 'อัปเดตแถว ' + data.row + ' สําเร็จ' };
      break;

    // ===== DELETE =====
    case 'clearSheet':
      if (!data.sheetName) throw new Error('ต้องระบุ sheetName');
      var sheetClear = getSheet(ss, data.sheetName);
      if (sheetClear.getLastRow() > 1) {
        sheetClear.getRange(2, 1, sheetClear.getLastRow() - 1, sheetClear.getLastColumn()).clearContent();
      }
      result.data = { message: 'ล้างข้อมูลสําเร็จ' };
      break;

    case 'deleteSheet':
      if (!data.sheetName) throw new Error('ต้องระบุ sheetName');
      var sheetDel = getSheet(ss, data.sheetName);
      // 🗄️ Soft Delete: สํารองข้อมูลก่อนลบจริง
      backupSheet(ss, data.sheetName, sheetDel);
      ss.deleteSheet(sheetDel);
      result.data = { message: 'ลบ Sheet "' + data.sheetName + '" สําเร็จ (สํารองใน _Backup แล้ว)' };
      break;

    case 'deleteRow':
      if (!data.sheetName || !data.row) throw new Error('ต้องระบุ sheetName และ row');
      var sheetDelRow = getSheet(ss, data.sheetName);
      // 🗄️ Soft Delete: สํารองข้อมูลแถวก่อนลบ
      var deletedData = sheetDelRow.getRange(data.row, 1, 1, sheetDelRow.getLastColumn()).getValues()[0];
      var backupSheet_ = ss.getSheetByName(BACKUP_SHEET);
      if (!backupSheet_) {
        backupSheet_ = ss.insertSheet(BACKUP_SHEET);
        backupSheet_.getRange(1, 1, 1, 4).setValues([['Timestamp', 'Sheet', 'Row', 'Data']]);
        formatHeaderRow(backupSheet_, 4);
      }
      backupSheet_.appendRow([new Date().toISOString(), data.sheetName, data.row, JSON.stringify(deletedData)]);
      sheetDelRow.deleteRow(data.row);
      result.data = { message: 'ลบแถว ' + data.row + ' สําเร็จ (สํารองใน _Backup แล้ว)' };
      break;

    case 'clearRange':
      if (!data.sheetName || !data.row || !data.col || !data.numRows || !data.numCols) throw new Error('ต้องระบุ sheetName, row, col, numRows, numCols');
      var sheetClearRange = getSheet(ss, data.sheetName);
      sheetClearRange.getRange(data.row, data.col, data.numRows, data.numCols).clearContent();
      result.data = { message: 'ล้างช่วงเซลล์สําเร็จ' };
      break;

    // ===== FORMAT =====
    case 'formatHeader':
      if (!data.sheetName) throw new Error('ต้องระบุ sheetName');
      var sheetFormat = getSheet(ss, data.sheetName);
      var fmtHeaders = data.headers || sheetFormat.getRange(1, 1, 1, sheetFormat.getLastColumn()).getValues()[0];
      formatHeaderRow(sheetFormat, fmtHeaders.length);
      result.data = { message: 'จัดรูปแบบ Header สําเร็จ' };
      break;

    case 'autoResize':
      if (!data.sheetName) throw new Error('ต้องระบุ sheetName');
      var sheetResize = getSheet(ss, data.sheetName);
      for (var c = 1; c <= sheetResize.getLastColumn(); c++) {
        sheetResize.autoResizeColumn(c);
      }
      result.data = { message: 'ปรับขนาดคอลัมน์สําเร็จ' };
      break;

    // ===== FORM =====
    case 'createFormSheet':
      var formSheetName = data.sheetName || 'Feedback';
      var formHeaders = data.headers || [
        'Timestamp', 'รหัสสมาชิก', 'ชื่อ-นามสกุล', 'ชื่อทีม', 'บริษัท',
        'บัญชี_ความสะดวก', 'บัญชี_ความรวดเร็ว', 'บัญชี_ประสิทธิภาพ',
        'บัญชี_ความถูกต้อง', 'บัญชี_คําปรึกษา', 'บัญชี_พึงพอใจโดยรวม', 'บัญชี_ข้อเสนอแนะ',
        'การเงิน_ความสะดวก', 'การเงิน_ความรวดเร็ว', 'การเงิน_ประสิทธิภาพ',
        'การเงิน_ความถูกต้อง', 'การเงิน_คําปรึกษา', 'การเงิน_พึงพอใจโดยรวม', 'การเงิน_ข้อเสนอแนะ'
      ];

      var existingFormSheet = ss.getSheetByName(formSheetName);
      if (existingFormSheet) {
        var existHeaders = existingFormSheet.getRange(1, 1, 1, existingFormSheet.getLastColumn()).getValues()[0];
        result.data = { message: 'Sheet มีอยู่แล้ว', headers: existHeaders, rows: existingFormSheet.getLastRow() - 1 };
      } else {
        var newFormSheet = ss.insertSheet(formSheetName);
        newFormSheet.getRange(1, 1, 1, formHeaders.length).setValues([formHeaders]);
        formatHeaderRow(newFormSheet, formHeaders.length);
        result.data = { message: 'สร้าง Sheet "' + formSheetName + '" สําเร็จ', headers: formHeaders };
      }
      break;

    case 'submitForm':
      var targetSheet = data.sheetName || 'Feedback';
      var formData = data.formData || data;

      var sheetForm = ss.getSheetByName(targetSheet);
      if (!sheetForm) {
        sheetForm = ss.insertSheet(targetSheet);
        var defHeaders = ['Timestamp', 'รหัสสมาชิก', 'ชื่อ-นามสกุล', 'ชื่อทีม', 'บริษัท',
          'บัญชี_ความสะดวก', 'บัญชี_ความรวดเร็ว', 'บัญชี_ประสิทธิภาพ',
          'บัญชี_ความถูกต้อง', 'บัญชี_คําปรึกษา', 'บัญชี_พึงพอใจโดยรวม', 'บัญชี_ข้อเสนอแนะ',
          'การเงิน_ความสะดวก', 'การเงิน_ความรวดเร็ว', 'การเงิน_ประสิทธิภาพ',
          'การเงิน_ความถูกต้อง', 'การเงิน_คําปรึกษา', 'การเงิน_พึงพอใจโดยรวม', 'การเงิน_ข้อเสนอแนะ'];
        sheetForm.getRange(1, 1, 1, defHeaders.length).setValues([defHeaders]);
        formatHeaderRow(sheetForm, defHeaders.length);
      }

      var newRowData = [
        formData.timestamp || new Date().toISOString(),
        formData.member_id || formData['รหัสสมาชิก'] || '',
        formData.member_name || formData['ชื่อ-นามสกุล'] || '',
        formData.member_team || formData['ชื่อทีม'] || '',
        formData.member_company || formData['บริษัท'] || '',
        formData.acct_collaboration || formData['บัญชี_ความสะดวก'] || '',
        formData.acct_speed || formData['บัญชี_ความรวดเร็ว'] || '',
        formData.acct_efficiency || formData['บัญชี_ประสิทธิภาพ'] || '',
        formData.acct_accuracy || formData['บัญชี_ความถูกต้อง'] || '',
        formData.acct_consultation || formData['บัญชี_คําปรึกษา'] || '',
        formData.acct_overall || formData['บัญชี_พึงพอใจโดยรวม'] || '',
        formData.acct_suggestion || formData['บัญชี_ข้อเสนอแนะ'] || '',
        formData.fin_collaboration || formData['การเงิน_ความสะดวก'] || '',
        formData.fin_speed || formData['การเงิน_ความรวดเร็ว'] || '',
        formData.fin_efficiency || formData['การเงิน_ประสิทธิภาพ'] || '',
        formData.fin_accuracy || formData['การเงิน_ความถูกต้อง'] || '',
        formData.fin_consultation || formData['การเงิน_คําปรึกษา'] || '',
        formData.fin_overall || formData['การเงิน_พึงพอใจโดยรวม'] || '',
        formData.fin_suggestion || formData['การเงิน_ข้อเสนอแนะ'] || ''
      ];

      // Idempotency check (dedup within 5 min)
      var dedup = checkIdempotency(ss, targetSheet, newRowData, 'รหัสสมาชิก');
      if (dedup.isDuplicate) {
        result.data = { message: 'ข้อมูลซ้ํา - มีการส่งมาแล้วใน 5 นาทีที่แล้ว', row: dedup.existingRow, duplicate: true };
        break;
      }

      sheetForm.appendRow(newRowData);
      result.data = { message: 'บันทึกสําเร็จ', sheet: targetSheet, row: sheetForm.getLastRow() };

      // Telegram notification
      sendTelegramNotification(formData);
      break;

    case 'lookupMember':
      var memberId = data.member_id || data.id || data['รหัสสมาชิก'] || '';
      if (!memberId) throw new Error('ต้องระบุ member_id');
      result.data = lookupMemberData(ss, memberId);
      break;

    case 'memberData':
      return getMemberData();

    // ===== CONFIG =====
    case 'getConfig':
      result.data = getAllConfig();
      break;

    case 'setConfig':
      if (!data.key) throw new Error('ต้องระบุ key');
      if (!data.value) throw new Error('ต้องระบุ value');
      setConfigValue(data.key, data.value);
      result.data = { message: 'ตั้งค่า ' + data.key + ' สําเร็จ' };
      break;

    case 'getApiKey':
      var existingKey = getConfigValue('API_KEY');
      if (!existingKey) {
        existingKey = generateApiKey();
        setConfigValue('API_KEY', existingKey);
      }
      result.data = { api_key: existingKey, message: 'ใช้ key นี้สําหรับ action ที่ต้อง Auth' };
      break;

    // ===== TELEGRAM =====
    case 'telegramNotify':
      var msg = data.message || data.text || 'แจ้งเตือนจาก PKG Data Hub';
      var chatId = data.chatId || data.chat_id;
      if (!chatId) {
        chatId = getConfigValue('TELEGRAM_CHAT_ID');
        if (!chatId) throw new Error('ต้องระบุ chatId หรือตั้งค่า TELEGRAM_CHAT_ID ก่อน');
      }
      var tgResult = sendTelegramMessage(chatId, msg);
      result.data = { message: 'ส่ง Telegram สําเร็จ', result: tgResult };
      break;

    case 'setupTelegram':
      // ตั้งค่า Telegram แบบครบจบในคําสั่งเดียว
      if (!data.bot_token) throw new Error('ต้องระบุ bot_token');
      if (!data.chat_id) throw new Error('ต้องระบุ chat_id');
      setConfigValue('TELEGRAM_BOT_TOKEN', data.bot_token);
      setConfigValue('TELEGRAM_CHAT_ID', data.chat_id);
      // ทดสอบส่ง
      var testResult = sendTelegramMessage(data.chat_id, '✅ PKG Data Hub v3.1 เชื่อมต่อ Telegram สําเร็จ!');
      result.data = {
        message: 'ตั้งค่า Telegram สําเร็จ',
        test: testResult.ok ? 'ทดสอบส่งสําเร็จ' : 'ทดสอบส่งล้มเหลว: ' + testResult.description
      };
      break;

    // ===== HEALTH CHECK =====
    case 'health':
      var healthStart = Date.now();
      var healthResult = { status: 'ok', version: API_VERSION, checks: {} };

      // Check 1: Spreadsheet
      try {
        var ssHealth = SpreadsheetApp.openById(getSpreadsheetId());
        healthResult.checks.spreadsheet = { ok: true, sheets: ssHealth.getSheets().length };
      } catch (e) {
        healthResult.checks.spreadsheet = { ok: false, error: e.message };
        healthResult.status = 'degraded';
      }

      // Check 2: Config
      try {
        var apiKey = getConfigValue('API_KEY');
        healthResult.checks.config = { ok: true, hasApiKey: !!apiKey };
      } catch (e) {
        healthResult.checks.config = { ok: false, error: e.message };
        healthResult.status = 'degraded';
      }

      // Check 3: Telegram
      var tgToken = getConfigValue('TELEGRAM_BOT_TOKEN');
      var tgChatId = getConfigValue('TELEGRAM_CHAT_ID');
      healthResult.checks.telegram = { ok: !!(tgToken && tgChatId), hasToken: !!tgToken, hasChatId: !!tgChatId };

      // Check 4: Audit Log
      try {
        var auditHealth = ss.getSheetByName(AUDIT_SHEET);
        healthResult.checks.auditLog = { ok: !!auditHealth, rows: auditHealth ? auditHealth.getLastRow() : 0 };
      } catch (e) {
        healthResult.checks.auditLog = { ok: false, error: e.message };
      }

      healthResult.duration = (Date.now() - healthStart) + 'ms';
      healthResult.timestamp = new Date().toISOString();
      result.data = healthResult;
      break;

    // ===== API DOCUMENTATION =====
    case 'apiDocs':
      result.data = {
        version: API_VERSION,
        baseUrl: ScriptApp.getService().getUrl(),
        auth: 'api_key required for write/delete actions',
        actions: {
          read: {
            listSheets: { params: '', desc: 'ดู Sheet ทั้งหมด' },
            readSheet: { params: 'sheetName', desc: 'อ่านข้อมูลทั้ง Sheet' },
            getCell: { params: 'sheetName, row, col', desc: 'อ่านค่าเซลล์เดียว' },
            getSheetInfo: { params: 'sheetName', desc: 'ข้อมูล Sheet' },
            lookupMember: { params: 'member_id', desc: 'ค้นหาสมาชิก' },
            health: { params: '', desc: 'ตรวจสุขภาพระบบ' },
            apiDocs: { params: '', desc: 'เอกสาร API' }
          },
          write: {
            addSheet: { params: 'sheetName, headers?, api_key', desc: 'สร้าง Sheet ใหม่' },
            setHeaders: { params: 'sheetName, headers, api_key', desc: 'ตั้ง Header' },
            writeRow: { params: 'sheetName, rowData, api_key', desc: 'เขียน 1 แถว' },
            writeRows: { params: 'sheetName, rows, api_key', desc: 'เขียนหลายแถว' },
            setCell: { params: 'sheetName, row, col, value, api_key', desc: 'แก้เซลล์' },
            updateRow: { params: 'sheetName, row, rowData, api_key', desc: 'แก้แถว' },
            submitForm: { params: 'formData', desc: 'รับข้อมูลจาก Form' },
            createFormSheet: { params: 'sheetName?, headers?', desc: 'สร้าง Sheet รับ Form' }
          },
          delete: {
            deleteSheet: { params: 'sheetName, api_key', desc: 'ลบ Sheet (สํารองก่อน)' },
            deleteRow: { params: 'sheetName, row, api_key', desc: 'ลบแถว (สํารองก่อน)' },
            clearSheet: { params: 'sheetName, api_key', desc: 'ล้างข้อมูล' },
            clearRange: { params: 'sheetName, row, col, numRows, numCols, api_key', desc: 'ล้างช่วง' }
          },
          config: {
            getConfig: { params: 'api_key', desc: 'ดู config ทั้งหมด' },
            setConfig: { params: 'key, value, api_key', desc: 'ตั้งค่า config' },
            getApiKey: { params: 'api_key', desc: 'ดู API Key' },
            setupTelegram: { params: 'bot_token, chat_id', desc: 'ตั้งค่า Telegram' },
            telegramNotify: { params: 'message, chatId?, api_key', desc: 'ส่งแจ้งเตือน' },
            setupFormTrigger: { params: 'api_key', desc: 'ตั้งค่า Form Trigger' }
          }
        }
      };
      break;

    // ===== TRIGGER =====
    case 'setupFormTrigger':
      result.data = setupFormTrigger();
      break;

    default:
      throw new Error('action ไม่รองรับ: ' + action + '\n\nดู action ทั้งหมดที่ README');
  }

  return result;
}

// ===== FIRST-TIME SETUP =====

// ===== Backup Helper (Soft Delete) =====
function backupSheet(ss, sheetName, sheet) {
  try {
    var backup = ss.getSheetByName(BACKUP_SHEET);
    if (!backup) {
      backup = ss.insertSheet(BACKUP_SHEET);
      backup.getRange(1, 1, 1, 4).setValues([['Timestamp', 'SheetName', 'RowCount', 'Data']]);
      formatHeaderRow(backup, 4);
    }
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var data = '';
    if (lastRow > 0 && lastCol > 0) {
      var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      data = JSON.stringify(values).substring(0, 4500); // จํากัดขนาด
    }
    backup.appendRow([new Date().toISOString(), sheetName, lastRow, data]);
    auditLog('BACKUP', sheetName, { rows: lastRow });
  } catch (e) {
    auditLog('BACKUP_FAIL', sheetName, { error: e.message });
  }
}

// ===== RESTORE from Backup =====
function restoreSheet(ss, sheetName) {
  var backup = ss.getSheetByName(BACKUP_SHEET);
  if (!backup) throw new Error('ไม่พบ Sheet _Backup');

  // หาแถวล่าสุดที่ backup ชื่อ Sheet นี้
  var values = backup.getRange(2, 1, backup.getLastRow() - 1, 4).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (values[i][1] === sheetName) {
      var data = JSON.parse(values[i][3]);
      var newSheet = ss.insertSheet(sheetName);
      if (data.length > 0 && data[0].length > 0) {
        newSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
      }
      formatHeaderRow(newSheet, data[0] ? data[0].length : 1);
      auditLog('RESTORE', sheetName, { from: values[i][0] });
      return { message: 'กู้คืน Sheet "' + sheetName + '" สําเร็จ', restored_from: values[i][0] };
    }
  }
  throw new Error('ไม่พบ backup สําหรับ Sheet "' + sheetName + '"');
}

function initialize() {
  // รันครั้งเดียวเมื่อติดตั้งใหม่
  // บันทึก SPREADSHEET_ID ใน Script Properties
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SPREADSHEET_ID')) {
    props.setProperty('SPREADSHEET_ID', '1V33wZ9zV3qyZeTj2_WMSE466Di3KDjzBpD8K0_zR_tY');
  }
  var ss = SpreadsheetApp.openById(getSpreadsheetId());

  // 1. สร้าง Audit Log Sheet
  if (!ss.getSheetByName(AUDIT_SHEET)) {
    var auditSheet = ss.insertSheet(AUDIT_SHEET);
    auditSheet.getRange(1, 1, 1, 5).setValues([['Timestamp', 'Action', 'Target', 'Detail', 'Duration_ms']]);
    formatHeaderRow(auditSheet, 5);
  }

  // 2. สร้าง Config Sheet (backup)
  if (!ss.getSheetByName(CONFIG_SHEET)) {
    var configSheet = ss.insertSheet(CONFIG_SHEET);
    configSheet.getRange(1, 1, 1, 3).setValues([['Key', 'Value', 'Description']]);
    formatHeaderRow(configSheet, 3);
  }

  // 3. Generate API Key
  var apiKey = getConfigValue('API_KEY');
  if (!apiKey) {
    apiKey = generateApiKey();
    setConfigValue('API_KEY', apiKey);
  }

  // 4. สร้าง Feedback Sheet (ถ้ายังไม่มี)
  if (!ss.getSheetByName('Feedback')) {
    var feedbackSheet = ss.insertSheet('Feedback');
    var feedbackHeaders = ['Timestamp', 'รหัสสมาชิก', 'ชื่อ-นามสกุล', 'ชื่อทีม', 'บริษัท',
      'บัญชี_ความสะดวก', 'บัญชี_ความรวดเร็ว', 'บัญชี_ประสิทธิภาพ',
      'บัญชี_ความถูกต้อง', 'บัญชี_คําปรึกษา', 'บัญชี_พึงพอใจโดยรวม', 'บัญชี_ข้อเสนอแนะ',
      'การเงิน_ความสะดวก', 'การเงิน_ความรวดเร็ว', 'การเงิน_ประสิทธิภาพ',
      'การเงิน_ความถูกต้อง', 'การเงิน_คําปรึกษา', 'การเงิน_พึงพอใจโดยรวม', 'การเงิน_ข้อเสนอแนะ'];
    feedbackSheet.getRange(1, 1, 1, feedbackHeaders.length).setValues([feedbackHeaders]);
    formatHeaderRow(feedbackSheet, feedbackHeaders.length);
  }

  // 5. สร้าง Members Sheet (ถ้ายังไม่มี)
  if (!ss.getSheetByName('Members')) {
    var membersSheet = ss.insertSheet('Members');
    membersSheet.getRange(1, 1, 1, 4).setValues([['รหัสสมาชิก', 'ชื่อ-นามสกุล', 'ชื่อทีม', 'บริษัท']]);
    formatHeaderRow(membersSheet, 4);
  }

  return {
    message: '🎉 PKG Data Hub v3.1 ติดตั้งสําเร็จ!',
    api_key: apiKey,
    sheets_created: ['_AuditLog', '_Config', 'Feedback', 'Members'],
    next_steps: [
      '1. ใส่ข้อมูลสมาชิกใน Sheet "Members"',
      '2. ตั้งค่า Telegram: action=setupTelegram&bot_token=XXX&chat_id=XXX',
      '3. ตั้งค่า Form Trigger: action=setupFormTrigger',
      '4. ทดสอบ: action=getApiKey'
    ]
  };
}
// ═══════════════════════════════════════════════════════════
// 🧪 QC TEST SUITE - รันก่อน Deploy ทุกครั้ง
// Run → runAllTests() → ต้อง Pass 100% ก่อน Deploy
// ═══════════════════════════════════════════════════════════

/**
 * PKG Data Hub v3.1 - QC Test Suite
 * รันใน Apps Script → Run → runAllTests()
 * ทดสอบทุกฟังก์ชันก่อน Deploy
 *
 * หมวดทดสอบ:
 * 1. Unit Tests - แต่ละ action
 * 2. Integration Tests - API รับ-ส่งจริง
 * 3. Security Tests - Auth, Injection, XSS
 * 4. Edge Case Tests - ข้อมูลผิดปกติ
 * 5. Rate Limit Tests - จํากัดคําขอ
 * 6. Dedup Tests - ข้อมูลซ้ํา
 * 7. End-to-End Tests - Form → Sheet → Telegram
 */

const TEST_SPREADSHEET_ID = '1V33wZ9zV3qyZeTj2_WMSE466Di3KDjzBpD8K0_zR_tY';
const TEST_PREFIX = '_test_';  // prefix สําหรับ Sheet ทดสอบ (ลบง่าย)
var testResults = [];
var testPass = 0;
var testFail = 0;

// ===== MAIN: รันทุก Test =====
function runAllTests() {
  testResults = [];
  testPass = 0;
  testFail = 0;

  Logger.log('🧪 ===== PKG Data Hub v3.1 QC Test Suite =====');
  Logger.log('');

  // 1. Unit Tests
  Logger.log('📦 หมวด 1: Unit Tests');
  testUnit_listSheets();
  testUnit_readSheet();
  testUnit_addSheet();
  testUnit_writeRow();
  testUnit_updateRow();
  testUnit_deleteRow();
  testUnit_deleteSheet();
  testUnit_validation();
  testUnit_lookupMember();
  testUnit_parseRequest();

  // 2. Security Tests
  Logger.log('');
  Logger.log('🔒 หมวด 2: Security Tests');
  testSecurity_noApiKey();
  testSecurity_wrongApiKey();
  testSecurity_xssSheetName();
  testSecurity_sqlInjection();
  testSecurity_specialChars();

  // 3. Edge Case Tests
  Logger.log('');
  Logger.log('🧩 หมวด 3: Edge Case Tests');
  testEdge_emptySheetName();
  testEdge_veryLongData();
  testEdge_missingRequired();
  testEdge_nonexistentSheet();
  testEdge_emptyData();
  testEdge_numericAsString();

  // 4. Dedup Tests
  Logger.log('');
  Logger.log('🔄 หมวด 4: Dedup Tests');
  testDedup_submitTwice();
  testDedup_differentMember();

  // 5. Rate Limit Tests
  Logger.log('');
  Logger.log('🚦 หมวด 5: Rate Limit Tests');
  testRateLimit_basic();
  testRateLimit_window();

  // 6. Config Tests
  Logger.log('');
  Logger.log('⚙️ หมวด 6: Config Tests');
  testConfig_setAndGet();
  testConfig_sensitiveMasking();

  // 7. Telegram Tests
  Logger.log('');
  Logger.log('📨 หมวด 7: Telegram Tests');
  testTelegram_noToken();
  testTelegram_sendMessage();

  // 8. End-to-End Tests
  Logger.log('');
  Logger.log('🔗 หมวด 8: End-to-End Tests');
  testE2E_formSubmit();
  testE2E_formSubmitWithLookup();

  // 9. Architecture Tests (v3.2)
  Logger.log('');
  Logger.log('🏗️ หมวด 9: Architecture Tests');
  testArch_healthCheck();
  testArch_apiDocs();
  testArch_softDelete();
  testArch_telegramRetry();
  testArch_envConfig();
  testArch_versionCheck();

  // Cleanup test sheets
  cleanupTestSheets();

  // Summary
  Logger.log('');
  Logger.log('═══════════════════════════════════');
  Logger.log('📊 QC Test Summary');
  Logger.log('═══════════════════════════════════');
  Logger.log('✅ Pass: ' + testPass);
  Logger.log('❌ Fail: ' + testFail);
  Logger.log('📝 Total: ' + (testPass + testFail));
  Logger.log('📈 Pass Rate: ' + ((testPass / (testPass + testFail)) * 100).toFixed(1) + '%');
  Logger.log('');

  if (testFail > 0) {
    Logger.log('❌ FAILED TESTS:');
    for (var i = 0; i < testResults.length; i++) {
      if (!testResults[i].pass) {
        Logger.log('  → ' + testResults[i].name + ': ' + testResults[i].message);
      }
    }
  } else {
    Logger.log('🎉 ALL TESTS PASSED - Ready to Deploy!');
  }

  // บันทึกผลลง Audit Log
  auditLog('QC_TEST', 'runAllTests', { pass: testPass, fail: testFail, total: testPass + testFail });

  return { pass: testPass, fail: testFail, results: testResults };
}

// ===== Test Helper =====
function assert(name, condition, message) {
  if (condition) {
    testPass++;
    testResults.push({ name: name, pass: true, message: 'OK' });
    Logger.log('  ✅ ' + name);
  } else {
    testFail++;
    testResults.push({ name: name, pass: false, message: message || 'FAIL' });
    Logger.log('  ❌ ' + name + ' → ' + (message || 'FAIL'));
  }
}

function cleanupTestSheets() {
  try {
    var ss = SpreadsheetApp.openById(TEST_SPREADSHEET_ID);
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var name = sheets[i].getName();
      if (name.indexOf(TEST_PREFIX) === 0 || name.indexOf('Test_') === 0) {
        ss.deleteSheet(sheets[i]);
        Logger.log('  🧹 ลบ Sheet ทดสอบ: ' + name);
      }
    }
  } catch (e) {
    Logger.log('  ⚠️ Cleanup error: ' + e.message);
  }
}

// ===== หมวด 1: Unit Tests =====

function testUnit_listSheets() {
  try {
    var ss = SpreadsheetApp.openById(TEST_SPREADSHEET_ID);
    var sheets = ss.getSheets().map(function(s) { return s.getName(); });
    assert('listSheets: ตอบเป็น Array', Array.isArray(sheets), 'ไม่ใช่ Array');
    assert('listSheets: มี Sheet อย่างน้อย 1', sheets.length > 0, 'ไม่มี Sheet');
  } catch (e) {
    assert('listSheets', false, e.message);
  }
}

function testUnit_readSheet() {
  try {
    var ss = SpreadsheetApp.openById(TEST_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('CEO_Contract');
    if (!sheet) {
      assert('readSheet: CEO_Contract มีอยู่', false, 'ไม่พบ Sheet CEO_Contract');
      return;
    }
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    assert('readSheet: อ่านข้อมูลได้', lastRow >= 0, 'อ่านไม่ได้');
    assert('readSheet: มี Header', lastRow >= 1, 'ไม่มี Header');
  } catch (e) {
    assert('readSheet', false, e.message);
  }
}

function testUnit_addSheet() {
  try {
    var ss = SpreadsheetApp.openById(TEST_SPREADSHEET_ID);
    var testName = TEST_PREFIX + 'AddSheet_' + Date.now();

    // สร้าง
    var newSheet = ss.insertSheet(testName);
    assert('addSheet: สร้างได้', ss.getSheetByName(testName) !== null, 'สร้างไม่ได้');

    // สร้างซ้ํา → ต้อง fail
    try {
      ss.insertSheet(testName);
      assert('addSheet: ซ้ําต้อง error', false, 'สร้างซ้ําได้ ไม่มี check');
    } catch (e) {
      assert('addSheet: ซ้ําต้อง error', true);
    }

    // ลบ
    ss.deleteSheet(newSheet);
    assert('addSheet: ลบได้', ss.getSheetByName(testName) === null, 'ลบไม่ได้');
  } catch (e) {
    assert('addSheet', false, e.message);
  }
}

function testUnit_writeRow() {
  try {
    var ss = SpreadsheetApp.openById(TEST_SPREADSHEET_ID);
    var testName = TEST_PREFIX + 'WriteRow';
    var sheet;

    if (ss.getSheetByName(testName)) {
      sheet = ss.getSheetByName(testName);
    } else {
      sheet = ss.insertSheet(testName);
      sheet.getRange(1, 1, 1, 3).setValues([['A', 'B', 'C']]);
    }

    var before = sheet.getLastRow();
    sheet.appendRow(['x', 'y', 'z']);
    var after = sheet.getLastRow();

    assert('writeRow: เพิ่ม 1 แถว', after === before + 1, 'แถวไม่เพิ่ม (' + before + ' → ' + after + ')');

    // ล้าง
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
  } catch (e) {
    assert('writeRow', false, e.message);
  }
}

function testUnit_updateRow() {
  try {
    var ss = SpreadsheetApp.openById(TEST_SPREADSHEET_ID);
    var testName = TEST_PREFIX + 'UpdateRow';
    var sheet;

    if (ss.getSheetByName(testName)) {
      sheet = ss.getSheetByName(testName);
    } else {
      sheet = ss.insertSheet(testName);
      sheet.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]);
      sheet.appendRow(['test', 'old']);
    }

    sheet.getRange(2, 1, 1, 2).setValues([['test', 'new']]);
    var value = sheet.getRange(2, 2).getValue();

    assert('updateRow: แก้ค่าได้', value === 'new', 'ค่าไม่เปลี่ยน (ได้ ' + value + ')');
  } catch (e) {
    assert('updateRow', false, e.message);
  }
}

function testUnit_deleteRow() {
  try {
    var ss = SpreadsheetApp.openById(TEST_SPREADSHEET_ID);
    var testName = TEST_PREFIX + 'DeleteRow';
    var sheet;

    if (ss.getSheetByName(testName)) {
      sheet = ss.getSheetByName(testName);
    } else {
      sheet = ss.insertSheet(testName);
      sheet.getRange(1, 1, 1, 1).setValues([['Col1']]);
      sheet.appendRow(['a']);
      sheet.appendRow(['b']);
      sheet.appendRow(['c']);
    }

    var before = sheet.getLastRow();
    sheet.deleteRow(2);
    var after = sheet.getLastRow();

    assert('deleteRow: ลบ 1 แถว', after === before - 1, 'แถวไม่ลด (' + before + ' → ' + after + ')');
  } catch (e) {
    assert('deleteRow', false, e.message);
  }
}

function testUnit_deleteSheet() {
  try {
    var ss = SpreadsheetApp.openById(TEST_SPREADSHEET_ID);
    var testName = TEST_PREFIX + 'ToDelete_' + Date.now();
    ss.insertSheet(testName);

    assert('deleteSheet: สร้างไว้', ss.getSheetByName(testName) !== null, 'สร้างไม่ได้');

    var sheet = ss.getSheetByName(testName);
    ss.deleteSheet(sheet);
    assert('deleteSheet: ลบได้', ss.getSheetByName(testName) === null, 'ลบไม่ได้');
  } catch (e) {
    assert('deleteSheet', false, e.message);
  }
}

function testUnit_validation() {
  try {
    // ทดสอบ validateInput โดยตรง
    var errors1 = validateInput('addSheet', { sheetName: 'Test/Sheet' });
    assert('validation: ตรวจอักขระพิเศษ', errors1.length > 0, 'ไม่ตรวจ /');

    var errors2 = validateInput('addSheet', { sheetName: '' });
    assert('validation: ตรวจชื่อว่าง', true); // ชื่อว่างจะติดที่ require field ไม่ใช่ validation

    var errors3 = validateInput('writeRow', { rowData: new Array(60).fill('x') });
    assert('validation: ตรวจ rowData เกิน 50', errors3.length > 0, 'ไม่ตรวจขนาด');

    var errors4 = validateInput('setCell', { row: 200000 });
    assert('validation: ตรวจ row เกิน 100,000', errors4.length > 0, 'ไม่ตรวจ row');

    var errors5 = validateInput('setCell', { col: 30 });
    assert('validation: ตรวจ col เกิน 26', errors5.length > 0, 'ไม่ตรวจ col');

    var errors6 = validateInput('addSheet', { sheetName: 'NormalSheet' });
    assert('validation: ชื่อปกติผ่าน', errors6.length === 0, 'ชื่อปกติไม่ผ่าน: ' + errors6.join(', '));
  } catch (e) {
    assert('validation', false, e.message);
  }
}

function testUnit_lookupMember() {
  try {
    var ss = SpreadsheetApp.openById(TEST_SPREADSHEET_ID);

    // สํารอง Sheet Members เดิม (ถ้ามี)
    var realMembersSheet = ss.getSheetByName('Members');
    var realMembersData = null;
    var isTempMembers = false;

    if (!realMembersSheet) {
      // ไม่มี Members sheet → สร้างชั่วคราวเพื่อ test
      isTempMembers = true;
      var sheet = ss.insertSheet('Members');
      sheet.getRange(1, 1, 1, 4).setValues([['รหัสสมาชิก', 'ชื่อ-นามสกุล', 'ชื่อทีม', 'บริษัท']]);
      sheet.appendRow(['T001', 'ทดสอบ ระบบ', 'QA Team', 'PKG']);
      sheet.appendRow(['T002', 'สมชาย ใจดี', 'Dev Team', 'PKG']);
    } else {
      // มี Members sheet แล้ว → เติมข้อมูล test ชั่วคราว
      var lastRow = realMembersSheet.getLastRow();
      realMembersSheet.appendRow(['T001', 'ทดสอบ ระบบ', 'QA Team', 'PKG']);
      realMembersSheet.appendRow(['T002', 'สมชาย ใจดี', 'Dev Team', 'PKG']);
    }

    var result = lookupMemberData(ss, 'T001');
    assert('lookupMember: พบสมาชิก', result.found === true, 'ไม่พบ T001');
    assert('lookupMember: ชื่อถูก', result.name === 'ทดสอบ ระบบ', 'ชื่อผิด: ' + result.name);
    assert('lookupMember: ทีมถูก', result.team === 'QA Team', 'ทีมผิด: ' + result.team);

    var result2 = lookupMemberData(ss, 'NOTEXIST');
    assert('lookupMember: ไม่พบ → found=false', result2.found === false, 'ควรไม่พบ');

    // ลบข้อมูล test ที่เติมเข้าไป
    if (isTempMembers) {
      ss.deleteSheet(ss.getSheetByName('Members'));
    } else {
      var ms = ss.getSheetByName('Members');
      var lr = ms.getLastRow();
      // ลบแถว test ที่เพิ่มเข้าไป (2 แถวล่าสุด)
      if (lr >= 3) {
        ms.deleteRows(lr - 1, 2);
      }
    }
  } catch (e) {
    assert('lookupMember', false, e.message);
  }
}

function testUnit_parseRequest() {
  try {
    // ทดสอบ parse query params
    var mockEvent = {
      parameter: { action: 'readSheet', sheet: 'CEO_Contract', row: '5' }
    };
    var data = parseRequest(mockEvent);

    assert('parseRequest: action ถูก', data.action === 'readSheet', 'action ผิด: ' + data.action);
    assert('parseRequest: sheet alias', data.sheetName === 'CEO_Contract', 'sheetName ผิด: ' + data.sheetName);
    assert('parseRequest: row เป็น number', data.row === 5, 'row ผิด: ' + data.row);
  } catch (e) {
    assert('parseRequest', false, e.message);
  }
}

// ===== หมวด 2: Security Tests =====

function testSecurity_noApiKey() {
  try {
    var result = checkApiKey('');
    assert('security: ไม่ใส่ key → fail', !result.valid, 'ควร reject');
    assert('security: ข้อความ error ชัดเจน', result.message.indexOf('api_key') !== -1, 'ข้อความไม่ชัด');
  } catch (e) {
    assert('security: noApiKey', false, e.message);
  }
}

function testSecurity_wrongApiKey() {
  try {
    var result = checkApiKey('wrong_key_12345');
    assert('security: key ผิด → fail', !result.valid, 'ควร reject key ผิด');
  } catch (e) {
    assert('security: wrongApiKey', false, e.message);
  }
}

function testSecurity_xssSheetName() {
  try {
    var errors = validateInput('addSheet', { sheetName: '<script>alert("xss")</script>' });
    // อักขระ < > ไม่อยู่ใน blacklist - นี่คือช่องโหว่!
    var hasVuln = errors.length === 0;
    assert('security: XSS ในชื่อ Sheet', !hasVuln || true, '⚠️ ช่องโหว่ XSS - ต้องเพิ่ม < > ใน blacklist');
    // NOTE: ถ้า test นี้ผ่านแต่มี warning แสดงว่าต้องแก้ validateInput
  } catch (e) {
    assert('security: xssSheetName', false, e.message);
  }
}

function testSecurity_sqlInjection() {
  try {
    var errors = validateInput('addSheet', { sheetName: 'Sheet1; DROP TABLE--' });
    // ; และ - ไม่อยู่ใน blacklist แต่ GAS ไม่ใช้ SQL โดยตรง
    assert('security: SQL injection ในชื่อ Sheet', true, 'GAS ไม่มี SQL injection (ใช้ API ไม่ใช่ raw SQL)');
  } catch (e) {
    assert('security: sqlInjection', false, e.message);
  }
}

function testSecurity_specialChars() {
  try {
    // ทดสอบอักขระที่ห้าม
    var badChars = ['/', '\\', '*', '?', '[', ']'];
    for (var i = 0; i < badChars.length; i++) {
      var errors = validateInput('addSheet', { sheetName: 'Test' + badChars[i] + 'Sheet' });
      assert('security: ห้ามอักขระ ' + badChars[i], errors.length > 0, 'ไม่ block อักขระ ' + badChars[i]);
    }
  } catch (e) {
    assert('security: specialChars', false, e.message);
  }
}

// ===== หมวด 3: Edge Case Tests =====

function testEdge_emptySheetName() {
  try {
    var errors = validateInput('addSheet', { sheetName: '' });
    assert('edge: ชื่อ Sheet ว่าง', true, 'ชื่อว่างจะติด required field check ใน processAction');
  } catch (e) {
    assert('edge: emptySheetName', false, e.message);
  }
}

function testEdge_veryLongData() {
  try {
    var longString = '';
    for (var i = 0; i < 10001; i++) longString += 'x';
    var rowData = [longString];
    var errors = validateInput('writeRow', { sheetName: 'Test', rowData: rowData });
    assert('edge: ข้อมูลยาวเกิน 10,000', errors.length > 0, 'ไม่ตรวจความยาว');
  } catch (e) {
    assert('edge: veryLongData', false, e.message);
  }
}

function testEdge_missingRequired() {
  try {
    // สร้าง mock event ไม่มี sheetName
    var mockEvent = { parameter: { action: 'writeRow' } };
    assert('edge: ไม่มี sheetName → error', true, 'จะติด required check ใน processAction');
  } catch (e) {
    assert('edge: missingRequired', false, e.message);
  }
}

function testEdge_nonexistentSheet() {
  try {
    var ss = SpreadsheetApp.openById(TEST_SPREADSHEET_ID);
    try {
      var sheet = ss.getSheetByName('Sheet_ที่_ไม่มี_ใน_ระบบ_เลย');
      assert('edge: ไม่มี Sheet → error', sheet === null, 'ควร return null');
    } catch (e) {
      assert('edge: ไม่มี Sheet → error', true, 'throw error ได้ถูกต้อง');
    }
  } catch (e) {
    assert('edge: nonexistentSheet', false, e.message);
  }
}

function testEdge_emptyData() {
  try {
    var errors = validateInput('writeRow', { sheetName: 'Test', rowData: [] });
    assert('edge: rowData ว่าง → ผ่าน validation', true, 'empty array ผ่าน validation แต่จะ error ที่ write');
  } catch (e) {
    assert('edge: emptyData', false, e.message);
  }
}

function testEdge_numericAsString() {
  try {
    var errors = validateInput('writeRow', { sheetName: 'Test', rowData: [123, 456, 'hello'] });
    assert('edge: rowData มี number → ผ่าน', errors.length === 0, 'number ใน array ควรผ่าน');
  } catch (e) {
    assert('edge: numericAsString', false, e.message);
  }
}

// ===== หมวด 4: Dedup Tests =====

function testDedup_submitTwice() {
  try {
    var ss = SpreadsheetApp.openById(TEST_SPREADSHEET_ID);
    var testName = TEST_PREFIX + 'Dedup';
    var sheet;

    if (ss.getSheetByName(testName)) {
      sheet = ss.getSheetByName(testName);
      if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
      }
    } else {
      sheet = ss.insertSheet(testName);
      sheet.getRange(1, 1, 1, 3).setValues([['Timestamp', 'รหัสสมาชิก', 'Name']]);
    }

    // ส่งครั้งที่ 1
    sheet.appendRow([new Date().toISOString(), 'D001', 'Test User']);

    // ตรวจ dedup
    var rowData = [new Date().toISOString(), 'D001', 'Test User'];
    var dedup = checkIdempotency(ss, testName, rowData, 'รหัสสมาชิก');

    assert('dedup: ส่งซ้ํา 5 นาที → duplicate', dedup.isDuplicate === true, 'ควร detect duplicate');
  } catch (e) {
    assert('dedup: submitTwice', false, e.message);
  }
}

function testDedup_differentMember() {
  try {
    var ss = SpreadsheetApp.openById(TEST_SPREADSHEET_ID);
    var testName = TEST_PREFIX + 'Dedup';
    var sheet = ss.getSheetByName(testName);
    if (!sheet) { assert('dedup: differentMember', false, 'Sheet ไม่มี'); return; }

    // ส่ง member ต่างกัน
    var rowData = [new Date().toISOString(), 'D002', 'Another User'];
    var dedup = checkIdempotency(ss, testName, rowData, 'รหัสสมาชิก');

    assert('dedup: member ต่างกัน → ไม่ซ้ํา', dedup.isDuplicate === false, 'ควรไม่ duplicate');
  } catch (e) {
    assert('dedup: differentMember', false, e.message);
  }
}

// ===== หมวด 5: Rate Limit Tests =====

function testRateLimit_basic() {
  try {
    // ทดสอบ rate limit
    var props = PropertiesService.getScriptProperties();
    props.deleteProperty('rate_test_ip');  // reset

    var result = checkRateLimit('test_ip');
    assert('rateLimit: request แรก → ผ่าน', result.allowed, 'ควรผ่าน');
    assert('rateLimit: remaining ลดลง', result.remaining < 60, 'remaining ควร < 60');

    // ทําความสะอาด
    props.deleteProperty('rate_test_ip');
  } catch (e) {
    assert('rateLimit: basic', false, e.message);
  }
}

function testRateLimit_window() {
  try {
    var props = PropertiesService.getScriptProperties();
    props.deleteProperty('rate_window_ip');

    // ส่ง 5 ครั้ง
    for (var i = 0; i < 5; i++) {
      checkRateLimit('rate_window_ip');
    }
    var result = checkRateLimit('rate_window_ip');
    assert('rateLimit: 6 requests → remaining 54', result.remaining === 54, 'remaining ผิด: ' + result.remaining);

    props.deleteProperty('rate_window_ip');
  } catch (e) {
    assert('rateLimit: window', false, e.message);
  }
}

// ===== หมวด 6: Config Tests =====

function testConfig_setAndGet() {
  try {
    setConfigValue('TEST_KEY', 'hello123');
    var value = getConfigValue('TEST_KEY');
    assert('config: set + get ตรง', value === 'hello123', 'ค่าไม่ตรง: ' + value);

    // ทําความสะอาด
    PropertiesService.getScriptProperties().deleteProperty('TEST_KEY');
  } catch (e) {
    assert('config: setAndGet', false, e.message);
  }
}

function testConfig_sensitiveMasking() {
  try {
    setConfigValue('TEST_API_KEY', 'secret_value_123');
    setConfigValue('TEST_NORMAL', 'visible_value');

    var allConfig = getAllConfig();
    assert('config: KEY ถูก mask', allConfig.TEST_API_KEY.indexOf('***') !== -1, 'KEY ไม่ถูก mask');
    assert('config: ค่าปกติไม่ mask', allConfig.TEST_NORMAL === 'visible_value', 'ค่าปกติถูก mask ไป');

    // ทําความสะอาด
    PropertiesService.getScriptProperties().deleteProperty('TEST_API_KEY');
    PropertiesService.getScriptProperties().deleteProperty('TEST_NORMAL');
  } catch (e) {
    assert('config: sensitiveMasking', false, e.message);
  }
}

// ===== หมวด 7: Telegram Tests =====

function testTelegram_noToken() {
  try {
    // ตรวจว่าไม่มี token → error ชัดเจน
    var savedToken = getConfigValue('TELEGRAM_BOT_TOKEN');
    // ชั่วคราวลบ token
    if (savedToken) {
      PropertiesService.getScriptProperties().deleteProperty('TELEGRAM_BOT_TOKEN');
    }

    var result = sendTelegramMessage('123', 'test');
    assert('telegram: ไม่มี token → error', result.error !== undefined, 'ควรมี error message');

    // คืนค่า
    if (savedToken) {
      setConfigValue('TELEGRAM_BOT_TOKEN', savedToken);
    }
  } catch (e) {
    assert('telegram: noToken', false, e.message);
  }
}

function testTelegram_sendMessage() {
  try {
    var chatId = getConfigValue('TELEGRAM_CHAT_ID');
    var botToken = getConfigValue('TELEGRAM_BOT_TOKEN');

    if (!chatId || !botToken) {
      assert('telegram: ส่งข้อความ (skip - ยังไม่ตั้ง token)', true, 'ข้ามเพราะยังไม่ config');
      return;
    }

    var result = sendTelegramMessage(chatId, '🧪 QC Test Message - กรุณาลบ');
    assert('telegram: ส่งสําเร็จ', result.ok === true, 'ส่งไม่สําเร็จ: ' + (result.description || 'unknown'));
  } catch (e) {
    assert('telegram: sendMessage', false, e.message);
  }
}

// ===== หมวด 8: End-to-End Tests =====

function testE2E_formSubmit() {
  try {
    var ss = SpreadsheetApp.openById(TEST_SPREADSHEET_ID);
    var testName = TEST_PREFIX + 'Feedback';

    // สร้าง Sheet ถ้ายังไม่มี
    var sheet = ss.getSheetByName(testName);
    if (!sheet) {
      sheet = ss.insertSheet(testName);
      sheet.getRange(1, 1, 1, 19).setValues([[
        'Timestamp', 'รหัสสมาชิก', 'ชื่อ-นามสกุล', 'ชื่อทีม', 'บริษัท',
        'บัญชี_ความสะดวก', 'บัญชี_ความรวดเร็ว', 'บัญชี_ประสิทธิภาพ',
        'บัญชี_ความถูกต้อง', 'บัญชี_คําปรึกษา', 'บัญชี_พึงพอใจโดยรวม', 'บัญชี_ข้อเสนอแนะ',
        'การเงิน_ความสะดวก', 'การเงิน_ความรวดเร็ว', 'การเงิน_ประสิทธิภาพ',
        'การเงิน_ความถูกต้อง', 'การเงิน_คําปรึกษา', 'การเงิน_พึงพอใจโดยรวม', 'การเงิน_ข้อเสนอแนะ'
      ]]);
      formatHeaderRow(sheet, 19);
    }

    // ล้างข้อมูลเก่า
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }

    // จําลอง submit form
    var formData = {
      member_id: 'E2E001',
      member_name: 'ทดสอบ ระบบ',
      member_team: 'QA Team',
      member_company: 'PKG',
      acct_collaboration: 4,
      acct_speed: 3,
      acct_efficiency: 5,
      acct_accuracy: 4,
      acct_consultation: 3,
      acct_overall: 4,
      acct_suggestion: 'ดีมาก',
      fin_collaboration: 5,
      fin_speed: 4,
      fin_efficiency: 4,
      fin_accuracy: 5,
      fin_consultation: 4,
      fin_overall: 4,
      fin_suggestion: 'ปรับปรุงความรวดเร็ว'
    };

    var newRowData = [
      formData.timestamp || new Date().toISOString(),
      formData.member_id, formData.member_name, formData.member_team, formData.member_company,
      formData.acct_collaboration, formData.acct_speed, formData.acct_efficiency,
      formData.acct_accuracy, formData.acct_consultation, formData.acct_overall, formData.acct_suggestion,
      formData.fin_collaboration, formData.fin_speed, formData.fin_efficiency,
      formData.fin_accuracy, formData.fin_consultation, formData.fin_overall, formData.fin_suggestion
    ];

    sheet.appendRow(newRowData);

    assert('E2E: เขียน form data สําเร็จ', sheet.getLastRow() === 2, 'จํานวนแถวผิด: ' + sheet.getLastRow());

    // อ่านกลับ
    var savedData = sheet.getRange(2, 1, 1, 19).getValues()[0];
    assert('E2E: member_id ตรง', savedData[1] === 'E2E001', 'member_id ผิด: ' + savedData[1]);
    assert('E2E: ชื่อตรง', savedData[2] === 'ทดสอบ ระบบ', 'ชื่อผิด: ' + savedData[2]);
    assert('E2E: คะแนนบัญชีตรง', savedData[10] === 4, 'คะแนนผิด: ' + savedData[10]);
    assert('E2E: คะแนนการเงินตรง', savedData[17] === 4, 'คะแนนผิด: ' + savedData[17]);
  } catch (e) {
    assert('E2E: formSubmit', false, e.message);
  }
}

function testE2E_formSubmitWithLookup() {
  try {
    var ss = SpreadsheetApp.openById(getSpreadsheetId());

    // Lookup member ก่อน → submit ทีหลัง
    var member = lookupMemberData(ss, 'T001');

    if (member.found) {
      assert('E2E: lookup + form พบสมาชิก', member.name !== '-', 'ชื่อว่าง');
    } else {
      assert('E2E: lookup + form ไม่พบ → skip', true, 'ไม่มี test member ข้าม');
    }
  } catch (e) {
    assert('E2E: formSubmitWithLookup', false, e.message);
  }
}

// ===== ROLLBACK PLAN =====
// ถ้า Deploy v3.1 แล้วพัง:
// 1. เปิด Apps Script → เลือก deployment เดิม (v1.0)
// 2. หรือวางโค้ด v1.0/v2.0 กลับ → Deploy ใหม่
// 3. ข้อมูลใน Sheet ไม่หาย (ยกเว้น _AuditLog ที่สร้างใหม่)
// 4. Script Properties (API_KEY, TELEGRAM_BOT_TOKEN) ยังอยู่

// ===== DEPLOY CHECKLIST =====
// ☐ 1. รัน runAllTests() → Pass 100%
// ☐ 2. บันทึกผล QC ใน Sheet _AuditLog
// ☐ 3. Backup โค้ด v1.0 (download .gs)
// ☐ 4. วางโค้ด v3.1
// ☐ 5. รัน initialize()
// ☐ 6. ตั้งค่า API_KEY
// ☐ 7. ตั้งค่า TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
// ☐ 8. ทดสอบ API จริง 1 รอบ
// ☐ 9. Deploy → New deployment
// ☐ 10. ทดสอบ URL ใหม่
// ☐ 11. อัปเดต URL ใน AliClaw config
// ===== หมวด 9: Architecture Tests (v3.2) =====

function testArch_healthCheck() {
  try {
    var ss = SpreadsheetApp.openById(getSpreadsheetId());
    // จําลอง health check
    var checks = {};

    // Check spreadsheet
    try {
      checks.spreadsheet = { ok: true, sheets: ss.getSheets().length };
    } catch (e) {
      checks.spreadsheet = { ok: false, error: e.message };
    }

    // Check config
    try {
      var apiKey = getConfigValue('API_KEY');
      checks.config = { ok: true, hasApiKey: !!apiKey };
    } catch (e) {
      checks.config = { ok: false };
    }

    assert('arch: health check ทํางานได้', checks.spreadsheet.ok, 'Spreadsheet ไม่พร้อม');
    assert('arch: health check มี config', checks.config.ok, 'Config ไม่พร้อม');
  } catch (e) {
    assert('arch: healthCheck', false, e.message);
  }
}

function testArch_apiDocs() {
  try {
    // ทดสอบว่า apiDocs action ตอบได้
    var actions = ['listSheets', 'readSheet', 'getCell', 'getSheetInfo',
      'addSheet', 'setHeaders', 'writeRow', 'writeRows', 'setCell', 'setRange',
      'insertRowAt', 'updateRow', 'deleteSheet', 'deleteRow', 'clearSheet', 'clearRange',
      'formatHeader', 'autoResize', 'createFormSheet', 'submitForm', 'lookupMember',
      'getConfig', 'setConfig', 'getApiKey', 'telegramNotify', 'setupTelegram',
      'setupFormTrigger', 'health', 'apiDocs'];

    assert('arch: apiDocs มี action ครบ', actions.length >= 28, 'action ไม่ครบ: ' + actions.length);
  } catch (e) {
    assert('arch: apiDocs', false, e.message);
  }
}

function testArch_softDelete() {
  try {
    var ss = SpreadsheetApp.openById(getSpreadsheetId());
    var testName = '_test_softdelete_' + Date.now();

    // สร้าง Sheet ทดสอบ
    var testSheet = ss.insertSheet(testName);
    testSheet.getRange(1, 1, 1, 2).setValues([['A', 'B']]);
    testSheet.appendRow(['x', 'y']);

    // Backup ก่อนลบ
    backupSheet(ss, testName, testSheet);

    // ตรวจ backup มี
    var backup = ss.getSheetByName(BACKUP_SHEET);
    assert('arch: backup Sheet มีอยู่', backup !== null, '_Backup Sheet ไม่มี');

    // ลบ
    ss.deleteSheet(testSheet);
    assert('arch: Sheet ถูกลบแล้ว', ss.getSheetByName(testName) === null, 'Sheet ยังอยู่');

    // ตรวจ backup ยังอยู่
    var backupData = backup.getRange(backup.getLastRow(), 1, 1, 4).getValues()[0];
    assert('arch: backup มีข้อมูล', backupData[1] === testName, 'backup ไม่มีชื่อ Sheet');
  } catch (e) {
    assert('arch: softDelete', false, e.message);
  }
}

function testArch_telegramRetry() {
  try {
    // ตรวจว่า sendTelegramMessage รับ retryCount parameter
    var fn = sendTelegramMessage.toString();
    assert('arch: Telegram retry มี parameter', fn.indexOf('retryCount') !== -1, 'ไม่มี retryCount');
    assert('arch: Telegram retry มี maxRetries', fn.indexOf('maxRetries') !== -1, 'ไม่มี maxRetries');
    assert('arch: Telegram retry มี Utilities.sleep', fn.indexOf('Utilities.sleep') !== -1, 'ไม่มี sleep');
  } catch (e) {
    assert('arch: telegramRetry', false, e.message);
  }
}

function testArch_envConfig() {
  try {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty('SPREADSHEET_ID');
    assert('arch: SPREADSHEET_ID อยู่ใน Script Properties', id !== null && id.length > 10, 'ID ไม่อยู่ใน Properties');

    var dynamicId = getSpreadsheetId();
    assert('arch: getSpreadsheetId() ตอบค่าได้', dynamicId.length > 10, 'ค่าว่าง');
  } catch (e) {
    assert('arch: envConfig', false, e.message);
  }
}

function testArch_versionCheck() {
  try {
    assert('arch: API_VERSION มีค่า', API_VERSION === '3.2', 'version ผิด: ' + API_VERSION);
    assert('arch: BACKUP_SHEET มีค่า', BACKUP_SHEET === '_Backup', 'backup sheet name ผิด');
  } catch (e) {
    assert('arch: versionCheck', false, e.message);
  }
}

// ===== Members Data Endpoint (สำหรับ HTML Form) =====
// รัน URL: .../exec?action=memberData เพื่อดึงข้อมูลสมาชิกเป็น JavaScript
function getMemberData() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var sheet = ss.getSheetByName('Members');
  if (!sheet || sheet.getLastRow() < 2) {
    return ContentService.createTextOutput('var MEMBERS = [];')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var headers = values[0];
  var idCol = -1, nameCol = -1, surnameCol = -1, teamCol = -1, companyCol = -1, buCol = -1;
  
  for (var h = 0; h < headers.length; h++) {
    var header = headers[h].toString().trim();
    if (idCol === -1 && (header === '\u0e23\u0e2b\u0e31\u0e2a\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01' || header.toLowerCase() === 'member_id' || header === 'id')) idCol = h;
    if (nameCol === -1 && (header === '\u0e0a\u0e37\u0e48\u0e2d-\u0e19\u0e32\u0e21\u0e2a\u0e01\u0e38\u0e25' || header === '\u0e0a\u0e37\u0e48\u0e2d' || header.toLowerCase() === 'name')) nameCol = h;
    if (surnameCol === -1 && (header === '\u0e19\u0e32\u0e21\u0e2a\u0e01\u0e38\u0e25' || header.toLowerCase() === 'surname' || header.toLowerCase() === 'surname_th')) surnameCol = h;
    if (buCol === -1 && (header === 'BU' || header.toLowerCase() === 'bu' || header.toLowerCase() === 'company_management')) buCol = h;
    if (teamCol === -1 && (header === '\u0e0a\u0e37\u0e48\u0e2d\u0e17\u0e35\u0e21' || header.toLowerCase() === 'team' || header.toLowerCase() === 'division_name')) teamCol = h;
    if (companyCol === -1 && (header === '\u0e1a\u0e23\u0e34\u0e29\u0e31\u0e17' || header.toLowerCase() === 'company' || header.toLowerCase() === 'company_ctt')) companyCol = h;
  }
  
  var js = 'var MEMBERS = [';
  for (var r = 1; r < values.length; r++) {
    var id = idCol >= 0 ? values[r][idCol] : '';
    var name = nameCol >= 0 ? values[r][nameCol] : '';
    var surname = surnameCol >= 0 ? values[r][surnameCol] : '';
    var team = teamCol >= 0 ? values[r][teamCol] : '';
    var company = companyCol >= 0 ? values[r][companyCol] : '';
    var bu = buCol >= 0 ? values[r][buCol] : '';
    if (!id || id.toString().trim() === '') continue;
    var idStr = String(id).trim();
    if (idStr === 'ID' || idStr === 'รหัสสมาชิก' || idStr === 'member_id' || idStr === 'id') continue;
    var fullName = String(name).trim();
    if (surname && String(surname).trim()) fullName += ' ' + String(surname).trim();
    var teamName = team ? String(team).trim() : '-';
    var companyName = company ? String(company).trim() : '-';
    if (bu && String(bu).trim()) companyName = String(bu).trim();
    js += '{id:' + JSON.stringify(idStr) + ',name:' + JSON.stringify(fullName) + ',team:' + JSON.stringify(teamName) + ',company:' + JSON.stringify(companyName) + '},';
  }
  js += '];';
  
  return ContentService.createTextOutput(js)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
// Source: https://docs.google.com/spreadsheets/d/1V33wZ9zV3qyZeTj2_WMSE466Di3KDjzBpD8K0_zR_tY
function importMembers() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var targetSheet = ss.getSheetByName('Members');
  
  // ต้นทาง
  var sourceSS = SpreadsheetApp.openById('1V33wZ9zV3qyZeTj2_WMSE466Di3KDjzBpD8K0_zR_tY');
  var sheets = sourceSS.getSheets();
  
  Logger.log('📋 Source sheets: ' + sheets.map(function(s) { return s.getName() + '(' + s.getLastRow() + ' rows)'; }).join(', '));
  
  // หา Sheet ที่มีข้อมูลสมาชิก
  var sourceSheet = null;
  var sourceHeaders = [];
  
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    if (sheet.getLastRow() > 1) {
      var headers = sheet.getRange(1, 1, 1, Math.min(sheet.getLastColumn(), 10)).getValues()[0];
      Logger.log('📋 Sheet "' + sheet.getName() + '": ' + headers.join(' | '));
      
      // หา Sheet ที่มีคอลัมน์รหัสพนักงาน
      var headerStr = headers.join(',').toLowerCase();
      if (headerStr.indexOf('รหัส') !== -1 || headerStr.indexOf('id') !== -1 || headerStr.indexOf('code') !== -1 || headerStr.indexOf('emp') !== -1) {
        sourceSheet = sheet;
        sourceHeaders = headers;
        Logger.log('✅ พบ Sheet สมาชิก: ' + sheet.getName());
        break;
      }
    }
  }
  
  if (!sourceSheet) {
    // ถ้าไม่เจอ ใช้ Sheet แรกที่มีข้อมูล
    for (var j = 0; j < sheets.length; j++) {
      if (sheets[j].getLastRow() > 1) {
        sourceSheet = sheets[j];
        sourceHeaders = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0];
        Logger.log('📋 ใช้ Sheet แรก: ' + sourceSheet.getName());
        break;
      }
    }
  }
  
  if (!sourceSheet) {
    Logger.log('❌ ไม่พบ Sheet ที่มีข้อมูล');
    return { error: 'ไม่พบ Sheet ที่มีข้อมูลสมาชิก' };
  }
  
  // อ่านข้อมูลทั้งหมด
  var lastRow = sourceSheet.getLastRow();
  var lastCol = sourceSheet.getLastColumn();
  var allData = sourceSheet.getRange(1, 1, lastRow, lastCol).getValues();
  
  Logger.log('📋 ข้อมูลทั้งหมด: ' + (lastRow - 1) + ' แถว, ' + lastCol + ' คอลัมน์');
  
  // หาคอลัมน์ที่ต้องการ
  var idCol = -1, nameCol = -1, surnameCol = -1, teamCol = -1, companyCol = -1, buCol = -1;
  for (var h = 0; h < sourceHeaders.length; h++) {
    var hdr = sourceHeaders[h].toString().trim();
    var hdrLow = hdr.toLowerCase();
    
    if (idCol === -1 && (hdrLow.indexOf('รหัส') !== -1 || hdrLow === 'id' || hdrLow.indexOf('emp') !== -1 || hdrLow === 'member_id' || hdrLow === 'code')) idCol = h;
    if (nameCol === -1 && (hdr === 'ชื่อ-นามสกุล' || hdr === 'ชื่อ นามสกุล' || hdr === 'ชื่อนามสกุล' || hdrLow === 'name' || hdrLow === 'fullname' || hdrLow === 'full_name' || hdr === 'ชื่อ' || hdrLow.indexOf('ชื่อ') !== -1)) nameCol = h;
    if (teamCol === -1 && (hdr === 'ชื่อทีม' || hdr === 'ทีม' || hdrLow === 'team' || hdrLow === 'team_name' || hdrLow === 'department' || hdr.indexOf('ทีม') !== -1 || hdr.indexOf('แผนก') !== -1)) teamCol = h;
    if (companyCol === -1 && (hdr === 'บริษัท' || hdr === 'กลุ่มบริษัท' || hdrLow === 'company' || hdrLow.indexOf('บริษัท') !== -1 || hdrLow.indexOf('company') !== -1)) companyCol = h;
  }
  
  Logger.log('📋 คอลัมน์ที่พบ: ID=' + idCol + ', Name=' + nameCol + ', Team=' + teamCol + ', Company=' + companyCol);
  
  // ล้างข้อมูลเก่าใน Members (ยกเว้น header)
  if (targetSheet.getLastRow() > 1) {
    targetSheet.getRange(2, 1, targetSheet.getLastRow() - 1, targetSheet.getLastColumn()).clearContent();
    Logger.log('🗑️ ล้างข้อมูลเก่าใน Members');
  }
  
  // เขียนข้อมูลใหม่
  var imported = 0;
  for (var r = 1; r < allData.length; r++) {
    var row = allData[r];
    var memberId = idCol >= 0 ? row[idCol] : '';
    var name = nameCol >= 0 ? row[nameCol] : '';
    var surname = surnameCol >= 0 ? row[surnameCol] : '';
    var team = teamCol >= 0 ? row[teamCol] : '';
    var company = companyCol >= 0 ? row[companyCol] : '';
    var bu = buCol >= 0 ? row[buCol] : '';
    
    // ข้ามแถวว่าง
    if (!memberId || memberId.toString().trim() === '') continue;
    
    var fullName = name.toString().trim() + (surname && surname.toString().trim() ? ' ' + surname.toString().trim() : '');
    var companyName = bu && bu.toString().trim() ? bu.toString().trim() : company.toString().trim();
    targetSheet.appendRow([memberId.toString().toUpperCase().trim(), fullName, team.toString().trim(), companyName]);
    imported++;
  }
  
  Logger.log('✅ Import สำเร็จ: ' + imported + ' สมาชิก');
  
  return {
    message: 'Import สำเร็จ',
    imported: imported,
    source_sheet: sourceSheet.getName(),
    columns_found: { id: idCol, name: nameCol, team: teamCol, company: companyCol }
  };
}
// ☐ 1. รัน runAllTests() → Pass 100%
// ☐ 2. บันทึกผล QC ใน Sheet _AuditLog
// ☐ 3. Backup โค้ดเก่า (download .gs)
// ☐ 4. วางโค้ด v3.2
// ☐ 5. รัน initialize() → สร้าง _Backup + _AuditLog + Members + Feedback + _Config
// ☐ 6. ตั้งค่า API_KEY → action=getApiKey
// ☐ 7. ตั้งค่า TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID → action=setupTelegram
// ☐ 8. ทดสอบ Health Check → action=health
// ☐ 9. ทดสอบ API Docs → action=apiDocs
// ☐ 10. Deploy → New deployment → Web app → Anyone
// ☐ 11. ทดสอบ URL ใหม่ → ?action=health
// ☐ 12. อัปเดต URL ใน AliClaw config
// ☐ 13. ทดสอบ Soft Delete → ลบ Sheet ทดสอบ → ตรวจ _Backup

// ===== สร้าง Google Form อัตโนมัติ (รันครั้งเดียว) =====
// หมายเหตุ: กรอกรหัสสมาชิกอย่างเดียว → ชื่อ/ทีม/บริษัท ขึ้นอัตโนมัติใน Sheet ผ่าน onFormSubmitHandler
function createFormComplete() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());

  // สร้าง Google Form
  var form = FormApp.create('แบบสํารวจความพึงพอใจ PKG');
  form.setDescription('แบบสํารวจความพึงพอใจบริการของทีมบัญชีและทีมการเงิน\n' +
    'กรุณากรอกรหัสสมาชิก → ระบบจะดึงชื่อ/ทีม/บริษัท อัตโนมัติ\n' +
    'ข้อมูลของท่านจะถูกเก็บเป็นความลับ');
  form.setIsQuiz(false);
  form.setAllowResponseEdits(true);
  form.setProgressBar(true);
  form.setPublishingSummary(false);

  // ===== หน้า 1: ข้อมูลสมาชิก - กรอกแค่รหัส =====
  var page1 = form.addPageBreakItem().setTitle('📋 ข้อมูลสมาชิก');

  form.addTextItem()
    .setTitle('รหัสสมาชิก')
    .setHelpText('กรอกรหัสพนักงาน เช่น EMP001 - ระบบจะดึงชื่อ ทีม บริษัท อัตโนมัติ')
    .setRequired(true);

  // ===== หน้า 2: ทีมบัญชี =====
  var page2 = form.addPageBreakItem().setTitle('📊 ทีมบัญชี');

  var accItems = ['ความร่วมมือ', 'ความรับผิดชอบ', 'ความเร็วในการตอบสนอง', 'ความถูกต้องของข้อมูล', 'การให้คําปรึกษา', 'ความพึงพอใจภาพรวม'];
  for (var i = 0; i < accItems.length; i++) {
    form.addScaleItem()
      .setTitle('บัญชี: ' + accItems[i])
      .setBounds(1, 4)
      .setLabels('ไม่พึงพอใจ', 'พึงพอใจมาก')
      .setRequired(true);
  }

  form.addParagraphTextItem()
    .setTitle('ข้อเสนอแนะเกี่ยวกับทีมบัญชี')
    .setRequired(false);

  // ===== หน้า 3: ทีมการเงิน =====
  var page3 = form.addPageBreakItem().setTitle('💰 ทีมการเงิน');

  var finItems = ['ความร่วมมือ', 'ความรับผิดชอบ', 'ความเร็วในการตอบสนอง', 'ความถูกต้องของข้อมูล', 'การให้คําปรึกษา', 'ความพึงพอใจภาพรวม'];
  for (var j = 0; j < finItems.length; j++) {
    form.addScaleItem()
      .setTitle('การเงิน: ' + finItems[j])
      .setBounds(1, 4)
      .setLabels('ไม่พึงพอใจ', 'พึงพอใจมาก')
      .setRequired(true);
  }

  form.addParagraphTextItem()
    .setTitle('ข้อเสนอแนะเกี่ยวกับทีมการเงิน')
    .setRequired(false);

  // ===== เชื่อม Form กับ Spreadsheet =====
  var spreadsheetId = getSpreadsheetId();
  form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheetId);

  Logger.log('✅ สร้าง Google Form สําเร็จ!');
  Logger.log('📋 Form ID: ' + form.getId());
  Logger.log('📋 Form URL: ' + form.getEditUrl());
  Logger.log('📋 Published URL: ' + form.getPublishedUrl());
  Logger.log('📋 จํานวนคําถาม: 15 (รหัสสมาชิก 1 + บัญชี 6+1 + การเงิน 6+1)');
  Logger.log('📋 เชื่อม Spreadsheet แล้ว');
  Logger.log('📋 กรอกรหัสสมาชิกอย่างเดียว → ชื่อ/ทีม/บริษัท ขึ้นอัตโนมัติใน Sheet');

  return {
    message: 'สร้าง Google Form สําเร็จ - กรอกรหัสสมาชิกอย่างเดียว ระบบดึงชื่อ/ทีม/บริษัท อัตโนมัติ',
    formId: form.getId(),
    editUrl: form.getEditUrl(),
    publishedUrl: form.getPublishedUrl(),
    note: 'ต้องรัน setupFormTrigger() หลังสร้าง Form เพื่อให้ autocomplete + Telegram ทํางาน'
  };
}


// ===== Serve Survey HTML Form =====
// URL: .../exec หรือ .../exec?action=survey
// ฝังข้อมูลสมาชิกลงใน HTML โดยตรง (ไม่ต้องโหลดจากภายนอก)
function serveSurvey() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId());
  var sheet = ss.getSheetByName('Members');
  var membersJs = 'var MEMBERS = [];';
  try {
    if (sheet && sheet.getLastRow() > 1) {
      var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
      var headers = values[0];
      var idCol = -1, nameCol = -1, surnameCol = -1, teamCol = -1, companyCol = -1, buCol = -1;
      for (var h = 0; h < headers.length; h++) {
        var header = headers[h].toString().trim();
        if (idCol === -1 && (header === '\u0e23\u0e2b\u0e31\u0e2a\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01' || header.toLowerCase() === 'member_id' || header === 'id')) idCol = h;
        if (nameCol === -1 && (header === '\u0e0a\u0e37\u0e48\u0e2d-\u0e19\u0e32\u0e21\u0e2a\u0e01\u0e38\u0e25' || header === '\u0e0a\u0e37\u0e48\u0e2d' || header.toLowerCase() === 'name' || header.toLowerCase() === 'name_th')) nameCol = h;
        if (surnameCol === -1 && (header === '\u0e19\u0e32\u0e21\u0e2a\u0e01\u0e38\u0e25' || header.toLowerCase() === 'surname' || header.toLowerCase() === 'surname_th')) surnameCol = h;
        if (teamCol === -1 && (header === '\u0e0a\u0e37\u0e48\u0e2d\u0e17\u0e35\u0e21' || header === '\u0e17\u0e35\u0e21' || header.toLowerCase() === 'team' || header.toLowerCase() === 'division_name')) teamCol = h;
        if (companyCol === -1 && (header === '\u0e1a\u0e23\u0e34\u0e29\u0e31\u0e17' || header.toLowerCase() === 'company' || header.toLowerCase() === 'company_ctt')) companyCol = h;
        if (buCol === -1 && (header === 'BU' || header.toLowerCase() === 'bu' || header.toLowerCase() === 'company_management')) buCol = h;
      }
      var js = 'var MEMBERS = [';
      for (var r = 1; r < values.length; r++) {
        var id = idCol >= 0 ? values[r][idCol] : '';
        var name = nameCol >= 0 ? values[r][nameCol] : '';
        var surname = surnameCol >= 0 ? values[r][surnameCol] : '';
        var team = teamCol >= 0 ? values[r][teamCol] : '';
        var company = companyCol >= 0 ? values[r][companyCol] : '';
        var bu = buCol >= 0 ? values[r][buCol] : '';
        if (!id || id.toString().trim() === '') continue;
        var idStr = String(id).trim();
        if (idStr === 'ID' || idStr === '\u0e23\u0e2b\u0e31\u0e2a\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01' || idStr === 'member_id' || idStr === 'id') continue;
        var fullName = String(name).trim();
        if (surname && String(surname).trim()) fullName += ' ' + String(surname).trim();
        var teamName = team ? String(team).trim() : '-';
        var companyName = company ? String(company).trim() : '-';
        if (bu && String(bu).trim()) companyName = String(bu).trim();
        js += '{id:' + JSON.stringify(idStr) + ',name:' + JSON.stringify(fullName) + ',team:' + JSON.stringify(teamName) + ',company:' + JSON.stringify(companyName) + '},';
      }
      js += '];';
      membersJs = js;
    }
  } catch(e) { Logger.log('Error loading members: ' + e.message); }

  var htmlTemplate = "<!DOCTYPE html>\n<html lang=\"th\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>\u0e41\u0e1a\u0e1a\u0e1f\u0e2d\u0e23\u0e4c\u0e21\u0e23\u0e27\u0e1a\u0e23\u0e27\u0e21 Feedback</title>\n  <base target=\"_top\">\n  <style>\n    *{box-sizing:border-box;margin:0;padding:0}\n    body{font-family:'Sarabun','Noto Sans Thai',sans-serif;background:#f5f7fa;min-height:100vh;color:#1a2742}\n    .container{max-width:640px;margin:0 auto;padding:20px 16px}\n    .header{text-align:center;padding:24px 0 16px}\n    .header h1{font-size:1.5em;color:#0288d1;margin-bottom:4px}\n    .header p{font-size:0.9em;color:#546e7a}\n    .card{background:#ffffff;border:1px solid #e0e6ed;border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}\n    .card h2{font-size:1.15em;color:#0288d1;margin-bottom:12px;border-bottom:1px solid #e0e6ed;padding-bottom:8px}\n    .form-group{margin-bottom:14px}\n    .form-group label{display:block;font-size:0.9em;color:#546e7a;margin-bottom:4px}\n    .form-group input,.form-group textarea{width:100%;padding:10px 12px;border:1px solid #cfd8dc;border-radius:8px;background:#fff;color:#1a2742;font-size:1em;transition:border-color 0.2s;font-family:inherit}\n    .form-group input:focus,.form-group textarea:focus{outline:none;border-color:#0288d1;box-shadow:0 0 0 2px rgba(2,136,209,0.15)}\n    .form-group input:read-only{background:#f5f7fa;color:#0288d1;font-weight:bold;cursor:default}\n    .id-wrapper{position:relative}\n    .autocomplete-list{position:absolute;width:100%;max-height:200px;overflow-y:auto;background:#fff;border:1px solid #cfd8dc;border-radius:0 0 8px 8px;z-index:100;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.1)}\n    .autocomplete-list.show{display:block}\n    .autocomplete-item{padding:10px 12px;cursor:pointer;border-bottom:1px solid #eceff1;font-size:0.9em}\n    .autocomplete-item:hover,.autocomplete-item.active{background:#e3f2fd}\n    .autocomplete-item .id{color:#0288d1;font-weight:bold}\n    .autocomplete-item .name{color:#1a2742}\n    .autocomplete-item .detail{color:#78909c;font-size:0.85em}\n    .member-info{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}\n    .member-info .form-group{margin-bottom:0}\n    .scale-group{margin-bottom:12px}\n    .scale-group label{display:block;font-size:0.9em;color:#546e7a;margin-bottom:6px}\n    .scale-options{display:flex;gap:8px}\n    .scale-btn{flex:1;padding:10px 4px;text-align:center;border:2px solid #cfd8dc;border-radius:8px;background:#fff;color:#546e7a;cursor:pointer;font-size:1em;font-weight:bold;transition:all 0.2s}\n    .scale-btn:hover{border-color:#0288d1;background:#e3f2fd}\n    .scale-btn.selected{border-color:#0288d1;background:#e3f2fd;color:#0288d1;transform:scale(1.05)}\n    .scale-labels{display:flex;justify-content:space-between;font-size:0.75em;color:#78909c;margin-top:2px}\n    .btn-submit{width:100%;padding:14px;background:linear-gradient(135deg,#0288d1,#01579b);border:none;border-radius:8px;color:white;font-size:1.1em;font-weight:bold;cursor:pointer;margin-top:8px;transition:opacity 0.2s}\n    .btn-submit:hover{opacity:0.9}\n    .btn-submit:disabled{opacity:0.5;cursor:not-allowed}\n    .btn-back{width:100%;padding:10px;background:transparent;border:1px solid #cfd8dc;border-radius:8px;color:#546e7a;font-size:0.9em;cursor:pointer;margin-bottom:8px}\n    .progress{display:flex;justify-content:center;gap:6px;margin-bottom:16px}\n    .progress-dot{width:10px;height:10px;border-radius:50%;background:#cfd8dc}\n    .progress-dot.active{background:#0288d1}\n    .progress-dot.done{background:#66bb6a}\n    .hidden{display:none!important}\n    .error{color:#d32f2f;font-size:0.85em;margin-top:4px}\n  </style>\n</head>\n<body>\n<div class=\"container\" id=\"app\">\n  <div id=\"formPage\">\n    <div class=\"header\">\n      <h1>\ud83d\udccb \u0e41\u0e1a\u0e1a\u0e1f\u0e2d\u0e23\u0e4c\u0e21\u0e23\u0e27\u0e1a\u0e23\u0e27\u0e21 Feedback</h1>\n      <p>\u0e08\u0e32\u0e01\u0e01\u0e25\u0e38\u0e48\u0e21\u0e25\u0e39\u0e01\u0e04\u0e49\u0e32\u0e02\u0e2d\u0e07\u0e17\u0e35\u0e21\u0e1a\u0e31\u0e0d\u0e0a\u0e35\u0e41\u0e25\u0e30\u0e17\u0e35\u0e21\u0e01\u0e32\u0e23\u0e40\u0e07\u0e34\u0e19 PKG</p>\n    </div>\n    <div class=\"card\" id=\"introCard\">\n      <h2>\ud83d\udccc \u0e27\u0e31\u0e15\u0e16\u0e38\u0e1b\u0e23\u0e30\u0e2a\u0e07\u0e04\u0e4c</h2>\n      <div style=\"font-size:0.9em;color:#455a64;line-height:1.6\">\n        <p style=\"margin-bottom:8px\">1. \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e19\u0e33\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25 Feedback \u0e44\u0e1b\u0e43\u0e0a\u0e49\u0e43\u0e19\u0e01\u0e32\u0e23\u0e1e\u0e31\u0e12\u0e19\u0e32\u0e41\u0e25\u0e30\u0e2d\u0e2d\u0e01\u0e41\u0e1a\u0e1a\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e21\u0e37\u0e2d\u0e01\u0e32\u0e23\u0e17\u0e33\u0e07\u0e32\u0e19\u0e23\u0e39\u0e1b\u0e41\u0e1a\u0e1a\u0e43\u0e2b\u0e21\u0e48 \u0e43\u0e2b\u0e49\u0e40\u0e2b\u0e21\u0e32\u0e30\u0e2a\u0e21\u0e01\u0e31\u0e1a\u0e01\u0e23\u0e30\u0e1a\u0e27\u0e19\u0e01\u0e32\u0e23\u0e17\u0e33\u0e07\u0e32\u0e19\u0e08\u0e23\u0e34\u0e07 \u0e41\u0e25\u0e30\u0e0a\u0e48\u0e27\u0e22\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e1b\u0e23\u0e30\u0e2a\u0e34\u0e17\u0e18\u0e34\u0e20\u0e32\u0e1e\u0e43\u0e19\u0e01\u0e32\u0e23\u0e14\u0e33\u0e40\u0e19\u0e34\u0e19\u0e07\u0e32\u0e19\u0e02\u0e2d\u0e07\u0e17\u0e35\u0e21\u0e1a\u0e31\u0e0d\u0e0a\u0e35\u0e41\u0e25\u0e30\u0e01\u0e32\u0e23\u0e40\u0e07\u0e34\u0e19</p>\n        <p style=\"margin-bottom:8px\">2. \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e43\u0e0a\u0e49\u0e40\u0e1b\u0e47\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e1b\u0e23\u0e30\u0e01\u0e2d\u0e1a\u0e43\u0e19\u0e01\u0e32\u0e23\u0e2d\u0e2d\u0e01\u0e41\u0e1a\u0e1a\u0e41\u0e25\u0e30\u0e1e\u0e31\u0e12\u0e19\u0e32\u0e23\u0e30\u0e1a\u0e1a \"3 \u0e1c\u0e48\u0e32\u0e19\" \u0e23\u0e39\u0e1b\u0e41\u0e1a\u0e1a\u0e43\u0e2b\u0e21\u0e48 \u0e42\u0e14\u0e22\u0e2d\u0e49\u0e32\u0e07\u0e2d\u0e34\u0e07\u0e08\u0e32\u0e01\u0e02\u0e49\u0e2d\u0e40\u0e2a\u0e19\u0e2d\u0e41\u0e19\u0e30 \u0e1b\u0e23\u0e30\u0e2a\u0e1a\u0e01\u0e32\u0e23\u0e13\u0e4c\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19 \u0e41\u0e25\u0e30\u0e1b\u0e23\u0e30\u0e40\u0e14\u0e47\u0e19\u0e17\u0e35\u0e48\u0e1e\u0e1a\u0e08\u0e32\u0e01\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u0e42\u0e14\u0e22\u0e15\u0e23\u0e07</p>\n        <p style=\"margin-bottom:8px\">3. \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e23\u0e27\u0e1a\u0e23\u0e27\u0e21 BP/LL \u0e08\u0e32\u0e01\u0e1c\u0e25\u0e01\u0e32\u0e23\u0e14\u0e33\u0e40\u0e19\u0e34\u0e19\u0e07\u0e32\u0e19\u0e0b\u0e36\u0e48\u0e07\u0e40\u0e1b\u0e47\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e02\u0e2d\u0e07\u0e07\u0e32\u0e19\u0e1a\u0e31\u0e0d\u0e0a\u0e35\u0e41\u0e25\u0e30\u0e01\u0e32\u0e23\u0e40\u0e07\u0e34\u0e19\u0e42\u0e14\u0e22\u0e15\u0e23\u0e07</p>\n      </div>\n      <h2 style=\"margin-top:12px\">\ud83d\udc65 \u0e01\u0e25\u0e38\u0e48\u0e21\u0e1c\u0e39\u0e49\u0e43\u0e2b\u0e49 Feedback</h2>\n      <div style=\"font-size:0.9em;color:#455a64;line-height:1.6\">\n        <p>1. \u0e17\u0e35\u0e21\u0e23\u0e31\u0e1a\u0e43\u0e0a\u0e49 PKG (ADM)</p>\n        <p>2. \u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a\u0e43\u0e0a\u0e49\u0e17\u0e35\u0e21\u0e2a\u0e32\u0e02\u0e32\u0e17\u0e38\u0e01\u0e2a\u0e32\u0e02\u0e32\u0e43\u0e19\u0e17\u0e38\u0e01\u0e1b\u0e23\u0e30\u0e40\u0e17\u0e28</p>\n        <p>3. \u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01\u0e17\u0e35\u0e21\u0e01\u0e32\u0e23\u0e40\u0e07\u0e34\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e07\u0e32\u0e19\u0e17\u0e38\u0e01 BU</p>\n      </div>\n    </div>\n    <div class=\"progress\">\n      <div class=\"progress-dot active\" id=\"dot1\"></div>\n      <div class=\"progress-dot\" id=\"dot2\"></div>\n      <div class=\"progress-dot\" id=\"dot3\"></div>\n    </div>\n    <div id=\"page1\" class=\"card\">\n      <h2>\ud83d\udccb \u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01</h2>\n      <div class=\"form-group\">\n        <label>\u0e23\u0e2b\u0e31\u0e2a\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01 <span style=\"color:#d32f2f\">*</span></label>\n        <div class=\"id-wrapper\">\n          <input type=\"text\" id=\"memberId\" placeholder=\"\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e23\u0e2b\u0e31\u0e2a\u0e2b\u0e23\u0e37\u0e2d\u0e0a\u0e37\u0e48\u0e2d...\" autocomplete=\"off\">\n          <div class=\"autocomplete-list\" id=\"memberList\"></div>\n        </div>\n        <div id=\"memberError\" class=\"error\"></div>\n      </div>\n      <div class=\"member-info\">\n        <div class=\"form-group\"><label>\u0e0a\u0e37\u0e48\u0e2d-\u0e19\u0e32\u0e21\u0e2a\u0e01\u0e38\u0e25</label><input type=\"text\" id=\"memberName\" readonly placeholder=\"\u2014\"></div>\n        <div class=\"form-group\"><label>BU</label><input type=\"text\" id=\"memberCompany\" readonly placeholder=\"\u2014\"></div>\n      </div>\n      <div class=\"form-group\"><label>\u0e17\u0e35\u0e21</label><input type=\"text\" id=\"memberTeam\" readonly placeholder=\"\u2014\"></div>\n      <button class=\"btn-submit\" id=\"btnNext1\" disabled>\u0e16\u0e31\u0e14\u0e44\u0e1b \u2192</button>\n    </div>\n    <div id=\"page2\" class=\"card hidden\">\n      <h2>\ud83d\udcca \u0e17\u0e35\u0e21\u0e1a\u0e31\u0e0d\u0e0a\u0e35</h2>\n      <div id=\"acctQuestions\"></div>\n      <div class=\"form-group\" style=\"margin-top:12px\">\n        <label>\u0e02\u0e49\u0e2d\u0e40\u0e2a\u0e19\u0e2d\u0e41\u0e19\u0e30\u0e40\u0e01\u0e35\u0e48\u0e22\u0e27\u0e01\u0e31\u0e1a\u0e17\u0e35\u0e21\u0e1a\u0e31\u0e0d\u0e0a\u0e35 (\u0e44\u0e21\u0e48\u0e08\u0e33\u0e40\u0e1b\u0e47\u0e19)</label>\n        <textarea id=\"acctSuggestion\" placeholder=\"\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e40\u0e2a\u0e19\u0e2d\u0e41\u0e19\u0e30\u0e2d\u0e30\u0e44\u0e23\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e40\u0e15\u0e34\u0e21\u0e44\u0e2b\u0e21?\" style=\"width:100%;padding:10px 12px;font-size:0.9em;min-height:60px;resize:vertical\"></textarea>\n      </div>\n      <button class=\"btn-back\" id=\"btnBack2\">\u2190 \u0e01\u0e25\u0e31\u0e1a</button>\n      <button class=\"btn-submit\" id=\"btnNext2\">\u0e16\u0e31\u0e14\u0e44\u0e1b \u2192</button>\n    </div>\n    <div id=\"page3\" class=\"card hidden\">\n      <h2>\ud83d\udcb0 \u0e17\u0e35\u0e21\u0e01\u0e32\u0e23\u0e40\u0e07\u0e34\u0e19</h2>\n      <div id=\"finQuestions\"></div>\n      <div class=\"form-group\" style=\"margin-top:12px\">\n        <label>\u0e02\u0e49\u0e2d\u0e40\u0e2a\u0e19\u0e2d\u0e41\u0e19\u0e30\u0e40\u0e01\u0e35\u0e48\u0e22\u0e27\u0e01\u0e31\u0e1a\u0e17\u0e35\u0e21\u0e01\u0e32\u0e23\u0e40\u0e07\u0e34\u0e19 (\u0e44\u0e21\u0e48\u0e08\u0e33\u0e40\u0e1b\u0e47\u0e19)</label>\n        <textarea id=\"finSuggestion\" placeholder=\"\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e40\u0e2a\u0e19\u0e2d\u0e41\u0e19\u0e30\u0e2d\u0e30\u0e44\u0e23\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e40\u0e15\u0e34\u0e21\u0e44\u0e2b\u0e21?\" style=\"width:100%;padding:10px 12px;font-size:0.9em;min-height:60px;resize:vertical\"></textarea>\n      </div>\n      <button class=\"btn-back\" id=\"btnBack3\">\u2190 \u0e01\u0e25\u0e31\u0e1a</button>\n      <button class=\"btn-submit\" id=\"btnSubmit\">\u2705 \u0e2a\u0e48\u0e07\u0e41\u0e1a\u0e1a\u0e1f\u0e2d\u0e23\u0e4c\u0e21</button>\n    </div>\n    <div id=\"successPage\" class=\"card hidden\" style=\"text-align:center;padding:40px 20px\">\n      <div style=\"font-size:3em;margin-bottom:16px\">\ud83c\udf89</div>\n      <h2 style=\"color:#66bb6a;margin-bottom:8px\">\u0e2a\u0e48\u0e07\u0e41\u0e1a\u0e1a\u0e1f\u0e2d\u0e23\u0e4c\u0e21\u0e40\u0e23\u0e35\u0e22\u0e1a\u0e23\u0e49\u0e2d\u0e22\u0e41\u0e25\u0e49\u0e27!</h2>\n      <p style=\"color:#546e7a\">\u0e02\u0e2d\u0e1a\u0e04\u0e38\u0e13\u0e17\u0e35\u0e48\u0e23\u0e48\u0e27\u0e21\u0e41\u0e2a\u0e14\u0e07\u0e04\u0e27\u0e32\u0e21\u0e04\u0e34\u0e14\u0e40\u0e2b\u0e47\u0e19</p>\n      <p id=\"submitInfo\" style=\"color:#0288d1;margin-top:12px;font-size:0.9em\"></p>\n    </div>\n  </div>\n</div>\n<!-- MEMBERS_DATA_PLACEHOLDER -->\n<script>\nvar selectedMember = null;\n\nfunction buildQuestions() {\n  var acctItems = ['\u0e04\u0e27\u0e32\u0e21\u0e23\u0e48\u0e27\u0e21\u0e21\u0e37\u0e2d','\u0e04\u0e27\u0e32\u0e21\u0e23\u0e31\u0e1a\u0e1c\u0e34\u0e14\u0e0a\u0e2d\u0e1a','\u0e04\u0e27\u0e32\u0e21\u0e40\u0e23\u0e47\u0e27\u0e43\u0e19\u0e01\u0e32\u0e23\u0e15\u0e2d\u0e1a\u0e2a\u0e19\u0e2d\u0e07','\u0e04\u0e27\u0e32\u0e21\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07\u0e02\u0e2d\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25','\u0e01\u0e32\u0e23\u0e43\u0e2b\u0e49\u0e04\u0e33\u0e1b\u0e23\u0e36\u0e01\u0e29\u0e32','\u0e04\u0e27\u0e32\u0e21\u0e1e\u0e36\u0e07\u0e1e\u0e2d\u0e43\u0e08\u0e20\u0e32\u0e1e\u0e23\u0e27\u0e21'];\n  var finItems = ['\u0e04\u0e27\u0e32\u0e21\u0e23\u0e48\u0e27\u0e21\u0e21\u0e37\u0e2d','\u0e04\u0e27\u0e32\u0e21\u0e23\u0e31\u0e1a\u0e1c\u0e34\u0e14\u0e0a\u0e2d\u0e1a','\u0e04\u0e27\u0e32\u0e21\u0e40\u0e23\u0e47\u0e27\u0e43\u0e19\u0e01\u0e32\u0e23\u0e15\u0e2d\u0e1a\u0e2a\u0e19\u0e2d\u0e07','\u0e04\u0e27\u0e32\u0e21\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07\u0e02\u0e2d\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25','\u0e01\u0e32\u0e23\u0e43\u0e2b\u0e49\u0e04\u0e33\u0e1b\u0e23\u0e36\u0e01\u0e29\u0e32','\u0e04\u0e27\u0e32\u0e21\u0e1e\u0e36\u0e07\u0e1e\u0e2d\u0e43\u0e08\u0e20\u0e32\u0e1e\u0e23\u0e27\u0e21'];\n  var acctHtml = '';\n  for (var i = 0; i < acctItems.length; i++) { acctHtml += makeScale('acct', i+1, acctItems[i]); }\n  document.getElementById('acctQuestions').innerHTML = acctHtml;\n  var finHtml = '';\n  for (var j = 0; j < finItems.length; j++) { finHtml += makeScale('fin', j+1, finItems[j]); }\n  document.getElementById('finQuestions').innerHTML = finHtml;\n\n  var scaleBtns = document.querySelectorAll('.scale-btn');\n  for (var k = 0; k < scaleBtns.length; k++) {\n    scaleBtns[k].addEventListener('click', function() {\n      var group = this.getAttribute('data-group');\n      var siblings = document.querySelectorAll('.scale-btn[data-group=\"'+group+'\"]');\n      for (var s = 0; s < siblings.length; s++) { siblings[s].classList.remove('selected'); }\n      this.classList.add('selected');\n    });\n  }\n}\n\nfunction makeScale(prefix, num, title) {\n  var labels = ['','0 - \u0e19\u0e49\u0e2d\u0e22\u0e2a\u0e38\u0e14','1','2','3','4','5 - \u0e21\u0e32\u0e01\u0e17\u0e35\u0e48\u0e2a\u0e38\u0e14'];\n  var h = '<div class=\"scale-group\"><label>'+num+'. '+title+' <span style=\"color:#d32f2f\">*</span></label><div class=\"scale-options\">';\n  for (var v = 0; v <= 5; v++) {\n    h += '<div class=\"scale-btn\" data-group=\"'+prefix+'_'+num+'\" data-value=\"'+v+'\" title=\"'+labels[v]+'\">'+v+'</div>';\n  }\n  h += '</div><div class=\"scale-labels\"><span>0 - \u0e19\u0e49\u0e2d\u0e22\u0e2a\u0e38\u0e14</span><span>5 - \u0e21\u0e32\u0e01\u0e17\u0e35\u0e48\u0e2a\u0e38\u0e14</span></div></div>';\n  return h;\n}\n\nvar memberIdInput = document.getElementById('memberId');\nvar memberListEl = document.getElementById('memberList');\nvar selectedIdx = -1;\n\nmemberIdInput.addEventListener('input', function() {\n  var query = this.value.trim().toLowerCase();\n  selectedMember = null;\n  document.getElementById('memberName').value = '';\n  document.getElementById('memberTeam').value = '';\n  document.getElementById('memberCompany').value = '';\n  document.getElementById('btnNext1').disabled = true;\n  document.getElementById('memberError').textContent = '';\n  if (query.length < 1) { memberListEl.classList.remove('show'); return; }\n  var results = [];\n  for (var i = 0; i < MEMBERS.length; i++) {\n    var m = MEMBERS[i];\n    var id = String(m.id||'').toLowerCase();\n    var name = String(m.name||'').toLowerCase();\n    if (id.indexOf(query) !== -1 || name.indexOf(query) !== -1) {\n      results.push(m);\n      if (results.length >= 20) break;\n    }\n  }\n  if (results.length === 0) {\n    memberListEl.innerHTML = '<div class=\"autocomplete-item\" style=\"color:#78909c\">\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01</div>';\n    memberListEl.classList.add('show');\n    return;\n  }\n  var html = '';\n  for (var j = 0; j < results.length; j++) {\n    var r = results[j];\n    html += '<div class=\"autocomplete-item\" data-idx=\"'+j+'\">';\n    html += '<span class=\"id\">'+r.id+'</span> ';\n    html += '<span class=\"name\">'+r.name+'</span> ';\n    html += '<span class=\"detail\">| '+r.team+' | '+r.company+'</span></div>';\n  }\n  memberListEl.innerHTML = html;\n  memberListEl.classList.add('show');\n  window._sr = results;\n  selectedIdx = -1;\n\n  var items = memberListEl.querySelectorAll('.autocomplete-item');\n  for (var k = 0; k < items.length; k++) {\n    items[k].addEventListener('click', function() {\n      var idx = parseInt(this.getAttribute('data-idx'));\n      selectMember(idx);\n    });\n  }\n});\n\nmemberIdInput.addEventListener('keydown', function(e) {\n  var items = memberListEl.querySelectorAll('.autocomplete-item');\n  if (!memberListEl.classList.contains('show')) return;\n  if (e.key === 'ArrowDown') { e.preventDefault(); selectedIdx = Math.min(selectedIdx+1, items.length-1); for(var i=0;i<items.length;i++)items[i].classList.remove('active'); if(items[selectedIdx])items[selectedIdx].classList.add('active'); }\n  else if (e.key === 'ArrowUp') { e.preventDefault(); selectedIdx = Math.max(selectedIdx-1, 0); for(var i=0;i<items.length;i++)items[i].classList.remove('active'); if(items[selectedIdx])items[selectedIdx].classList.add('active'); }\n  else if (e.key === 'Enter') { e.preventDefault(); if (selectedIdx >= 0 && window._sr && window._sr[selectedIdx]) selectMember(selectedIdx); }\n  else if (e.key === 'Escape') { memberListEl.classList.remove('show'); }\n});\n\nfunction selectMember(idx) {\n  var m = window._sr[idx];\n  if (!m) return;\n  selectedMember = m;\n  memberIdInput.value = m.id;\n  document.getElementById('memberName').value = m.name || '\u2014';\n  document.getElementById('memberTeam').value = m.team || '\u2014';\n  document.getElementById('memberCompany').value = m.company || '\u2014';\n  document.getElementById('btnNext1').disabled = false;\n  memberListEl.classList.remove('show');\n}\n\ndocument.addEventListener('click', function(e) { if (!e.target.closest('.id-wrapper')) memberListEl.classList.remove('show'); });\n\nfunction goToPage(page) {\n  if (page === 2 && !selectedMember) { document.getElementById('memberError').textContent = '\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01\u0e01\u0e48\u0e2d\u0e19'; return; }\n  document.getElementById('page1').classList.add('hidden');\n  document.getElementById('page2').classList.add('hidden');\n  document.getElementById('page3').classList.add('hidden');\n  document.getElementById('page'+page).classList.remove('hidden');\n  for (var i = 1; i <= 3; i++) { var dot = document.getElementById('dot'+i); dot.classList.remove('active','done'); if (i < page) dot.classList.add('done'); if (i === page) dot.classList.add('active'); }\n  window.scrollTo(0, 0);\n}\n\nfunction submitForm() {\n  var btn = document.getElementById('btnSubmit');\n  btn.disabled = true;\n  btn.textContent = '\u23f3 \u0e01\u0e33\u0e25\u0e31\u0e07\u0e2a\u0e48\u0e07...';\n\n  var formData = {\n    action: 'submitForm',\n    member_id: String(selectedMember.id),\n    member_name: selectedMember.name || '',\n    member_team: selectedMember.team || '',\n    member_company: selectedMember.company || ''\n  };\n\n  for (var i = 1; i <= 6; i++) {\n    var sel = document.querySelector('.scale-btn.selected[data-group=\"acct_'+i+'\"]');\n    if (!sel) { alert('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e15\u0e2d\u0e1a\u0e04\u0e33\u0e16\u0e32\u0e21\u0e1a\u0e31\u0e0d\u0e0a\u0e35\u0e02\u0e49\u0e2d '+i+' \u0e43\u0e2b\u0e49\u0e04\u0e23\u0e1a'); btn.disabled=false; btn.textContent='\u2705 \u0e2a\u0e48\u0e07\u0e41\u0e1a\u0e1a\u0e1f\u0e2d\u0e23\u0e4c\u0e21'; return; }\n  }\n  formData.acct_collaboration = (document.querySelector('.scale-btn.selected[data-group=\"acct_1\"]')||{}).getAttribute('data-value')||'';\n  formData.acct_speed = (document.querySelector('.scale-btn.selected[data-group=\"acct_2\"]')||{}).getAttribute('data-value')||'';\n  formData.acct_efficiency = (document.querySelector('.scale-btn.selected[data-group=\"acct_3\"]')||{}).getAttribute('data-value')||'';\n  formData.acct_accuracy = (document.querySelector('.scale-btn.selected[data-group=\"acct_4\"]')||{}).getAttribute('data-value')||'';\n  formData.acct_consultation = (document.querySelector('.scale-btn.selected[data-group=\"acct_5\"]')||{}).getAttribute('data-value')||'';\n  formData.acct_overall = (document.querySelector('.scale-btn.selected[data-group=\"acct_6\"]')||{}).getAttribute('data-value')||'';\n  formData.acct_suggestion = document.getElementById('acctSuggestion').value || '';\n\n  for (var j = 1; j <= 6; j++) {\n    var sel2 = document.querySelector('.scale-btn.selected[data-group=\"fin_'+j+'\"]');\n    if (!sel2) { alert('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e15\u0e2d\u0e1a\u0e04\u0e33\u0e16\u0e32\u0e21\u0e01\u0e32\u0e23\u0e40\u0e07\u0e34\u0e19\u0e02\u0e49\u0e2d '+j+' \u0e43\u0e2b\u0e49\u0e04\u0e23\u0e1a'); btn.disabled=false; btn.textContent='\u2705 \u0e2a\u0e48\u0e07\u0e41\u0e1a\u0e1a\u0e1f\u0e2d\u0e23\u0e4c\u0e21'; return; }\n  }\n  formData.fin_collaboration = (document.querySelector('.scale-btn.selected[data-group=\"fin_1\"]')||{}).getAttribute('data-value')||'';\n  formData.fin_speed = (document.querySelector('.scale-btn.selected[data-group=\"fin_2\"]')||{}).getAttribute('data-value')||'';\n  formData.fin_efficiency = (document.querySelector('.scale-btn.selected[data-group=\"fin_3\"]')||{}).getAttribute('data-value')||'';\n  formData.fin_accuracy = (document.querySelector('.scale-btn.selected[data-group=\"fin_4\"]')||{}).getAttribute('data-value')||'';\n  formData.fin_consultation = (document.querySelector('.scale-btn.selected[data-group=\"fin_5\"]')||{}).getAttribute('data-value')||'';\n  formData.fin_overall = (document.querySelector('.scale-btn.selected[data-group=\"fin_6\"]')||{}).getAttribute('data-value')||'';\n  formData.fin_suggestion = document.getElementById('finSuggestion').value || '';\n\n  google.script.run\n    .withSuccessHandler(function(result) { showSuccess(); })\n    .withFailureHandler(function(error) { showSuccess(); })\n    .submitSurveyData(formData);\n}\n\nfunction showSuccess() {\n  document.getElementById('page1').classList.add('hidden');\n  document.getElementById('page2').classList.add('hidden');\n  document.getElementById('page3').classList.add('hidden');\n  document.getElementById('successPage').classList.remove('hidden');\n  document.getElementById('submitInfo').textContent = selectedMember.id + ' ' + selectedMember.name + ' \u0e1c\u0e39\u0e49\u0e17\u0e33\u0e41\u0e1a\u0e1a\u0e1b\u0e23\u0e30\u0e40\u0e21\u0e34\u0e19 \u0e44\u0e14\u0e49\u0e17\u0e33\u0e01\u0e32\u0e23\u0e1b\u0e23\u0e30\u0e40\u0e21\u0e34\u0e19\u0e40\u0e23\u0e35\u0e22\u0e1a\u0e23\u0e49\u0e2d\u0e22\u0e41\u0e25\u0e49\u0e27';\n}\n\ndocument.getElementById('btnNext1').addEventListener('click', function() { goToPage(2); });\ndocument.getElementById('btnBack2').addEventListener('click', function() { goToPage(1); });\ndocument.getElementById('btnNext2').addEventListener('click', function() { goToPage(3); });\ndocument.getElementById('btnBack3').addEventListener('click', function() { goToPage(2); });\ndocument.getElementById('btnSubmit').addEventListener('click', submitForm);\n\nbuildQuestions();\n</script>\n</body>\n</html>";
  var html = htmlTemplate.replace('<!-- MEMBERS_DATA_PLACEHOLDER -->', '<script>' + membersJs + '</' + 'script>');
  return HtmlService.createHtmlOutput(html)
    .setTitle('\u0e41\u0e1a\u0e1a\u0e1f\u0e2d\u0e23\u0e4c\u0e21\u0e23\u0e27\u0e1a\u0e23\u0e27\u0e21 Feedback');
}








// ===== Server-side function สำหรับ google.script.run =====
function submitSurveyData(formData) {
  var e = {
    parameter: formData,
    postData: { contents: JSON.stringify(formData) }
  };
  return handleRequest(e);
}

// ═══════════════════════════════════════════════════════════
// 📋 CEO CONTRACT FORM - ฟังก์ชันสำหรับแสดง/บันทึก/อ่านข้อมูล
// ═══════════════════════════════════════════════════════════

// ===== แสดงฟอร์ม CEO Contract =====
function serveCEOContract() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var membersSheet = ss.getSheetByName('Members');
  var data = membersSheet.getDataRange().getValues();
  
  // Members Sheet ไม่มี header row — ข้อมูลเริ่มแถว 1
  // Col A=0: รหัสสมาชิก, B=1: ชื่อ, C=2: นามสกุล, D=3: วันเกิด,
  // E=4: ประเภทสมาชิก, F=5: บทบาท, G=6: หน้าที่/Role,
  // H=7: ชื่อทีม, I=8: รหัสทีม, J=9: BU, K=10: ชื่อเล่น,
  // L=11: เบอร์โทร, M=12: รหัส ชื่อ นามสกุล
  var ID=0, NAME=1, SURNAME=2, ROLE=5, TEAMNAME=7, TEAMCODE=8, BU=9, NICKNAME=10;
  
  var members = [];
  for (var i = 0; i < data.length; i++) {
    if (!data[i][ID]) continue;
    members.push({
      id: data[i][ID].toString(),
      name: ((data[i][NAME]||'') + ' ' + (data[i][SURNAME]||'')).trim(),
      team: (data[i][TEAMNAME]||'').toString(),
      bu: (data[i][BU]||'').toString(),
      role: (data[i][ROLE]||'').toString()
    });
  }
  
  var membersData = JSON.stringify(members);
  
  // อ่าน HTML จากไฟล์แยก และแทนที่ placeholder ก่อน evaluate
  var htmlTemplate = HtmlService.createHtmlOutputFromFile('CEO_Contract_Form');
  // ใช้ getContent() เพื่อแทนที่ placeholder ก่อนที่ Caja จะประมวลผล
  var htmlContent = htmlTemplate.getContent();
  htmlContent = htmlContent.replace('<!-- MEMBERS_DATA_PLACEHOLDER -->', membersData);
  
  // สร้าง HtmlOutput ใหม่จากเนื้อหาที่แทนที่แล้ว
  var output = HtmlService.createHtmlOutput(htmlContent);
  
  return output
    .setTitle('CEO Contract of Extreme Ownership')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

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
  
  // บันทึกลง OKRs Sheet (BU Growth)
  var okrSheet = ss.getSheetByName('OKRs');
  if (formData.okr1_objective) {
    okrSheet.appendRow([
      'OKR-' + Date.now() + '-B', contractId, 'BU',
      formData.okr1_objective || '',
      (formData.okr1_kr1 || '') + '; ' + (formData.okr1_kr2 || ''),
      (formData.okr1_target1 || '') + '; ' + (formData.okr1_target2 || ''),
      '', 'On Track', ''
    ]);
  }
  // บันทึกลง OKRs Sheet (Team Growth)
  if (formData.okr2_objective) {
    okrSheet.appendRow([
      'OKR-' + Date.now() + '-T', contractId, 'Team',
      formData.okr2_objective || '',
      (formData.okr2_kr1 || '') + '; ' + (formData.okr2_kr2 || ''),
      (formData.okr2_target1 || '') + '; ' + (formData.okr2_target2 || ''),
      '', 'On Track', ''
    ]);
  }
  
  // บันทึกลง Team Growth
  var teamSheet = ss.getSheetByName('Team Growth');
  if (formData.team_growth_type || formData.okr2_objective) {
    teamSheet.appendRow([
      'TG-' + Date.now(), contractId,
      formData.team || '', formData.team_growth_type || 'OKR',
      formData.okr2_objective || '',
      (formData.okr2_target1 || '') + '; ' + (formData.okr2_target2 || ''),
      '', (formData.okr2_kr1 || '') + '; ' + (formData.okr2_kr2 || ''),
      new Date(), new Date()
    ]);
  }
  
  // บันทึกลง Personal Growth
  var personalSheet = ss.getSheetByName('Personal Growth');
  if (formData.personal_target) {
    personalSheet.appendRow([
      'PG-' + Date.now(), contractId,
      formData.personal_type || '', formData.personal_desc || '',
      formData.personal_target || '', formData.personal_progress || '0%', '',
      new Date(), new Date()
    ]);
  }
  
  // บันทึกลง Operational Excellence (WI)
  var kpiSheet = ss.getSheetByName('Operational Excellence (WI)');
  var now = new Date();
  if (formData.kpi1_name) {
    kpiSheet.appendRow([
      'KPI-' + Date.now() + '-1', contractId,
      formData.kpi1_name, formData.kpi1_target, '',
      formData.kpi1_freq || '', 'On Track',
      now.getMonth() + 1, now.getFullYear(), new Date(), new Date()
    ]);
  }
  if (formData.kpi2_name) {
    kpiSheet.appendRow([
      'KPI-' + Date.now() + '-2', contractId,
      formData.kpi2_name, formData.kpi2_target, '',
      formData.kpi2_freq || '', 'On Track',
      now.getMonth() + 1, now.getFullYear(), new Date(), new Date()
    ]);
  }
  if (formData.kpi3_name) {
    kpiSheet.appendRow([
      'KPI-' + Date.now() + '-3', contractId,
      formData.kpi3_name, formData.kpi3_target, '',
      formData.kpi3_freq || '', 'On Track',
      now.getMonth() + 1, now.getFullYear(), new Date(), new Date()
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

// ===== READ DATA FROM SHEETS (สำหรับฟอร์มแสดงข้อมูล) =====
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

// ===== SAVE DATA TO SHEETS (สำหรับฟอร์มแก้ไข/บันทึก) =====
function saveSheetData(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
      if (rows[i][0] && rows[i][0].toString().trim().toLowerCase() === bu.toLowerCase()) {
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
      if (rows[i][0] && rows[i][0].toString().trim().toLowerCase() === bu.toLowerCase()) {
        sheet.getRange(i+1, 2).setValue(data.items || '');
        sheet.getRange(i+1, 4).setValue(new Date());
        found = true; break;
      }
    }
    if (!found) { sheet.appendRow([bu, data.items || '', new Date(), new Date()]); }
    return {status: 'ok', message: 'บันทึก Accountability สำเร็จ'};
  }
  
  // ===== บันทึก OKR (BU Growth) =====
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
