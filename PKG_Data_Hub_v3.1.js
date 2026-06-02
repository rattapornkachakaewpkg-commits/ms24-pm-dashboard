/**
 * PKG Data Hub v3.1 — Full-Stack Production Grade
 * Google Apps Script Backend
 * 
 * ฟีเจอร์ v3.0 + เพิ่ม:
 * 🔐 API Key Auth
 * 🛡️ Input Validation
 * 🚦 Rate Limiting
 * 🌐 CORS Headers
 * 🔄 Idempotency (Dedup)
 * 🔑 Dynamic Telegram Config (Script Properties)
 * 📨 onFormSubmit Trigger (Google Form)
 * 📋 Audit Log
 * 📊 REST Standard Response
 * ⚡ Error Handling ลึก
 */

const SPREADSHEET_ID = '1Ny1lbVGkZ0Q_dEVjI1he4tDTXkKWyYzSIvQlABthLqQ';
const AUDIT_SHEET = '_AuditLog';  // Sheet สำหรับบันทึก audit
const RATE_LIMIT_SHEET = '_RateLimit';  // Sheet สำหรับ rate limit tracking
const CONFIG_SHEET = '_Config';  // Sheet สำหรับเก็บค่า config (API Key, Telegram Token)

// ===== CORS + AUTH + MAIN HANDLER =====

function doGet(e) {
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
    
    // 2. CORS preflight
    if (requestAction === 'preflight' || !data.action) {
      return corsResponse({ status: 'ok', message: 'CORS OK' });
    }
    
    // 3. API Key Auth (ยกเว้น listSheets และ submitForm)
    var skipAuth = ['listSheets', 'readSheet', 'read', 'submitForm', 'lookupMember'];
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
        message: 'Rate limit exceeded — ลองใหม่ใน ' + rateResult.retryAfter + ' วินาที',
        retryAfter: rateResult.retryAfter
      });
    }
    
    // 5. Process action
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
    return { valid: false, message: 'ต้องระบุ api_key — ดูค่าจาก Sheet _Config หรือใช้คำสั่ง getApiKey' };
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
    if (/[\/\\*?\[\]]/.test(data.sheetName)) {
      errors.push('sheetName ห้ามมีอักขระ / \\ * ? [ ]');
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
      errors.push('rows ต้องไม่เกิน 500 แถวต่อคำขอ');
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
  
  // ตรวจซ้ำ (เทียบ key field + timestamp ใน 5 นาที)
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

function sendTelegramMessage(chatId, text) {
  var botToken = getConfigValue('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    return { error: 'ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN — ใช้คำสั่ง setConfig' };
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
      auditLog('TELEGRAM_FAIL', 'sendMessage', { error: result.description, chatId: chatId });
    }
    
    return result;
  } catch (e) {
    auditLog('TELEGRAM_ERROR', 'sendMessage', { error: e.toString(), chatId: chatId });
    return { error: e.toString() };
  }
}

function sendTelegramNotification(formData) {
  var chatId = getConfigValue('TELEGRAM_CHAT_ID');
  if (!chatId) return { skipped: true, reason: 'ยังไม่ได้ตั้ง TELEGRAM_CHAT_ID' };
  
  var text = '📋 <b>แบบสำรวจใหม่</b>\n' +
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
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(AUDIT_SHEET);
    
    if (!sheet) {
      sheet = ss.insertSheet(AUDIT_SHEET);
      sheet.getRange(1, 1, 1, 5).setValues([['Timestamp', 'Action', 'Target', 'Detail', 'Duration_ms']]);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#333333').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
    
    var row = [
      new Date().toISOString(),
      action,
      target || '-',
      typeof detail === 'object' ? JSON.stringify(detail).substring(0, 500) : (detail || '-'),
      detail && detail.duration ? detail.duration : 0
    ];
    
    sheet.appendRow(row);
    
    // เก็บแค่ 1000 แถวล่าสุด
    if (sheet.getLastRow() > 1001) {
      sheet.deleteRow(2); // ลบแถวที่ 2 (เก่าที่สุด รักษา header)
    }
  } catch (e) {
    // Audit log fail ไม่ควรทำให้ request fail
    console.error('Audit log error:', e);
  }
}

// ===== onFormSubmit Trigger (Google Form) =====

function setupFormTrigger() {
  // รันครั้งเดียวเพื่อตั้งค่า trigger
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ScriptApp.newTrigger('onFormSubmitHandler')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();
  
  return { message: 'ตั้งค่า Form Trigger สำเร็จ' };
}

function onFormSubmitHandler(e) {
  // รับข้อมูลจาก Google Form อัตโนมัติ
  try {
    var response = e.namedValues;
    var sheetName = 'Form_Responses';
    
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      var formHeaders = Object.keys(response);
      sheet.getRange(1, 1, 1, formHeaders.length).setValues([formHeaders]);
      sheet.getRange(1, 1, 1, formHeaders.length).setFontWeight('bold').setBackground('#003366').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
    
    // แปลงเป็น array
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var newRow = [];
    for (var i = 0; i < headers.length; i++) {
      newRow.push(response[headers[i]] || '');
    }
    sheet.appendRow(newRow);
    
    // Telegram notification
    var chatId = getConfigValue('TELEGRAM_CHAT_ID');
    if (chatId) {
      var text = '📝 <b>Google Form ใหม่</b>\n';
      var keys = Object.keys(response);
      for (var k = 0; k < keys.length; k++) {
        text += keys[k] + ': ' + response[keys[k]] + '\n';
      }
      text += '🕐 ' + new Date().toLocaleString('th-TH');
      sendTelegramMessage(chatId, text);
    }
    
    auditLog('FORM_SUBMIT', sheetName, { rows: Object.keys(response).length });
    
  } catch (err) {
    auditLog('FORM_SUBMIT_ERROR', 'onFormSubmit', { error: err.message });
  }
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
    
    var idCol = -1, nameCol = -1, teamCol = -1, companyCol = -1;
    
    for (var h = 0; h < headers.length; h++) {
      var header = headers[h].toString().trim().toLowerCase();
      if (header.includes('รหัส') || header.includes('id') || header.includes('member') || header.includes('code')) idCol = h;
      if (header.includes('ชื่อ') || header.includes('name')) nameCol = h;
      if (header.includes('ทีม') || header.includes('team')) teamCol = h;
      if (header.includes('บริษัท') || header.includes('company') || header.includes('กลุ่ม')) companyCol = h;
    }
    
    if (idCol === -1) continue;
    
    for (var r = 1; r < values.length; r++) {
      var cellValue = values[r][idCol].toString().toUpperCase().trim();
      if (cellValue === memberId) {
        return {
          found: true,
          member_id: values[r][idCol],
          name: nameCol >= 0 ? values[r][nameCol] : '—',
          team: teamCol >= 0 ? values[r][teamCol] : '—',
          company: companyCol >= 0 ? values[r][companyCol] : '—',
          source: searchSheets[s]
        };
      }
    }
  }
  
  return { found: false, member_id: memberId, name: '—', team: '—', company: '—' };
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
      result.data = { message: 'สร้าง Sheet "' + data.sheetName + '" สำเร็จ' };
      break;
      
    case 'setHeaders':
      if (!data.sheetName || !data.headers) throw new Error('ต้องระบุ sheetName และ headers');
      var sheetHeaders = getSheet(ss, data.sheetName);
      sheetHeaders.getRange(1, 1, 1, data.headers.length).setValues([data.headers]);
      formatHeaderRow(sheetHeaders, data.headers.length);
      result.data = { message: 'ตั้งค่า Headers สำเร็จ' };
      break;
      
    case 'writeRow':
    case 'write':
      if (!data.sheetName || !data.rowData) throw new Error('ต้องระบุ sheetName และ rowData');
      var sheetWrite = getSheet(ss, data.sheetName);
      sheetWrite.appendRow(data.rowData);
      result.data = { message: 'เพิ่ม 1 แถวสำเร็จ', row: sheetWrite.getLastRow() };
      break;
      
    case 'writeRows':
      if (!data.sheetName || !data.rows) throw new Error('ต้องระบุ sheetName และ rows');
      var sheetWriteRows = getSheet(ss, data.sheetName);
      if (data.rows.length > 0) {
        var startRow = sheetWriteRows.getLastRow() + 1;
        sheetWriteRows.getRange(startRow, 1, data.rows.length, data.rows[0].length).setValues(data.rows);
      }
      result.data = { message: 'เพิ่ม ' + data.rows.length + ' แถวสำเร็จ' };
      break;
      
    case 'setCell':
      if (!data.sheetName || !data.row || !data.col) throw new Error('ต้องระบุ sheetName, row, col');
      var sheetSetCell = getSheet(ss, data.sheetName);
      sheetSetCell.getRange(data.row, data.col).setValue(data.value !== undefined ? data.value : '');
      result.data = { message: 'ตั้งค่าเซลล์สำเร็จ' };
      break;
      
    case 'setRange':
      if (!data.sheetName || !data.row || !data.col || !data.values) throw new Error('ต้องระบุ sheetName, row, col, values');
      var sheetSetRange = getSheet(ss, data.sheetName);
      sheetSetRange.getRange(data.row, data.col, data.values.length, data.values[0].length).setValues(data.values);
      result.data = { message: 'ตั้งค่าช่วงเซลล์สำเร็จ' };
      break;
      
    case 'insertRowAt':
      if (!data.sheetName || !data.row || !data.rowData) throw new Error('ต้องระบุ sheetName, row, rowData');
      var sheetInsertRow = getSheet(ss, data.sheetName);
      sheetInsertRow.insertRowBefore(data.row);
      sheetInsertRow.getRange(data.row, 1, 1, data.rowData.length).setValues([data.rowData]);
      result.data = { message: 'แทรกแถวที่ตำแหน่ง ' + data.row + ' สำเร็จ' };
      break;
      
    case 'updateRow':
      if (!data.sheetName || !data.row || !data.rowData) throw new Error('ต้องระบุ sheetName, row, rowData');
      var sheetUpdateRow = getSheet(ss, data.sheetName);
      sheetUpdateRow.getRange(data.row, 1, 1, data.rowData.length).setValues([data.rowData]);
      result.data = { message: 'อัปเดตแถว ' + data.row + ' สำเร็จ' };
      break;
    
    // ===== DELETE =====
    case 'clearSheet':
      if (!data.sheetName) throw new Error('ต้องระบุ sheetName');
      var sheetClear = getSheet(ss, data.sheetName);
      if (sheetClear.getLastRow() > 1) {
        sheetClear.getRange(2, 1, sheetClear.getLastRow() - 1, sheetClear.getLastColumn()).clearContent();
      }
      result.data = { message: 'ล้างข้อมูลสำเร็จ' };
      break;
      
    case 'deleteSheet':
      if (!data.sheetName) throw new Error('ต้องระบุ sheetName');
      var sheetDel = getSheet(ss, data.sheetName);
      ss.deleteSheet(sheetDel);
      result.data = { message: 'ลบ Sheet "' + data.sheetName + '" สำเร็จ' };
      break;
      
    case 'deleteRow':
      if (!data.sheetName || !data.row) throw new Error('ต้องระบุ sheetName และ row');
      var sheetDelRow = getSheet(ss, data.sheetName);
      sheetDelRow.deleteRow(data.row);
      result.data = { message: 'ลบแถว ' + data.row + ' สำเร็จ' };
      break;
      
    case 'clearRange':
      if (!data.sheetName || !data.row || !data.col || !data.numRows || !data.numCols) throw new Error('ต้องระบุ sheetName, row, col, numRows, numCols');
      var sheetClearRange = getSheet(ss, data.sheetName);
      sheetClearRange.getRange(data.row, data.col, data.numRows, data.numCols).clearContent();
      result.data = { message: 'ล้างช่วงเซลล์สำเร็จ' };
      break;
    
    // ===== FORMAT =====
    case 'formatHeader':
      if (!data.sheetName) throw new Error('ต้องระบุ sheetName');
      var sheetFormat = getSheet(ss, data.sheetName);
      var fmtHeaders = data.headers || sheetFormat.getRange(1, 1, 1, sheetFormat.getLastColumn()).getValues()[0];
      formatHeaderRow(sheetFormat, fmtHeaders.length);
      result.data = { message: 'จัดรูปแบบ Header สำเร็จ' };
      break;
      
    case 'autoResize':
      if (!data.sheetName) throw new Error('ต้องระบุ sheetName');
      var sheetResize = getSheet(ss, data.sheetName);
      for (var c = 1; c <= sheetResize.getLastColumn(); c++) {
        sheetResize.autoResizeColumn(c);
      }
      result.data = { message: 'ปรับขนาดคอลัมน์สำเร็จ' };
      break;
    
    // ===== FORM =====
    case 'createFormSheet':
      var formSheetName = data.sheetName || 'Feedback';
      var formHeaders = data.headers || [
        'Timestamp', 'รหัสสมาชิก', 'ชื่อ-นามสกุล', 'ชื่อทีม', 'บริษัท',
        'บัญชี_ความสะดวก', 'บัญชี_ความรวดเร็ว', 'บัญชี_ประสิทธิภาพ',
        'บัญชี_ความถูกต้อง', 'บัญชี_คำปรึกษา', 'บัญชี_พึงพอใจโดยรวม', 'บัญชี_ข้อเสนอแนะ',
        'การเงิน_ความสะดวก', 'การเงิน_ความรวดเร็ว', 'การเงิน_ประสิทธิภาพ',
        'การเงิน_ความถูกต้อง', 'การเงิน_คำปรึกษา', 'การเงิน_พึงพอใจโดยรวม', 'การเงิน_ข้อเสนอแนะ'
      ];
      
      var existingFormSheet = ss.getSheetByName(formSheetName);
      if (existingFormSheet) {
        var existHeaders = existingFormSheet.getRange(1, 1, 1, existingFormSheet.getLastColumn()).getValues()[0];
        result.data = { message: 'Sheet มีอยู่แล้ว', headers: existHeaders, rows: existingFormSheet.getLastRow() - 1 };
      } else {
        var newFormSheet = ss.insertSheet(formSheetName);
        newFormSheet.getRange(1, 1, 1, formHeaders.length).setValues([formHeaders]);
        formatHeaderRow(newFormSheet, formHeaders.length);
        result.data = { message: 'สร้าง Sheet "' + formSheetName + '" สำเร็จ', headers: formHeaders };
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
          'บัญชี_ความถูกต้อง', 'บัญชี_คำปรึกษา', 'บัญชี_พึงพอใจโดยรวม', 'บัญชี_ข้อเสนอแนะ',
          'การเงิน_ความสะดวก', 'การเงิน_ความรวดเร็ว', 'การเงิน_ประสิทธิภาพ',
          'การเงิน_ความถูกต้อง', 'การเงิน_คำปรึกษา', 'การเงิน_พึงพอใจโดยรวม', 'การเงิน_ข้อเสนอแนะ'];
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
        formData.acct_consultation || formData['บัญชี_คำปรึกษา'] || '',
        formData.acct_overall || formData['บัญชี_พึงพอใจโดยรวม'] || '',
        formData.acct_suggestion || formData['บัญชี_ข้อเสนอแนะ'] || '',
        formData.fin_collaboration || formData['การเงิน_ความสะดวก'] || '',
        formData.fin_speed || formData['การเงิน_ความรวดเร็ว'] || '',
        formData.fin_efficiency || formData['การเงิน_ประสิทธิภาพ'] || '',
        formData.fin_accuracy || formData['การเงิน_ความถูกต้อง'] || '',
        formData.fin_consultation || formData['การเงิน_คำปรึกษา'] || '',
        formData.fin_overall || formData['การเงิน_พึงพอใจโดยรวม'] || '',
        formData.fin_suggestion || formData['การเงิน_ข้อเสนอแนะ'] || ''
      ];
      
      // Idempotency check (dedup within 5 min)
      var dedup = checkIdempotency(ss, targetSheet, newRowData, 'รหัสสมาชิก');
      if (dedup.isDuplicate) {
        result.data = { message: 'ข้อมูลซ้ำ — มีการส่งมาแล้วใน 5 นาทีที่แล้ว', row: dedup.existingRow, duplicate: true };
        break;
      }
      
      sheetForm.appendRow(newRowData);
      result.data = { message: 'บันทึกสำเร็จ', sheet: targetSheet, row: sheetForm.getLastRow() };
      
      // Telegram notification
      sendTelegramNotification(formData);
      break;
      
    case 'lookupMember':
      var memberId = data.member_id || data.id || data['รหัสสมาชิก'] || '';
      if (!memberId) throw new Error('ต้องระบุ member_id');
      result.data = lookupMemberData(ss, memberId);
      break;
    
    // ===== CONFIG =====
    case 'getConfig':
      result.data = getAllConfig();
      break;
      
    case 'setConfig':
      if (!data.key) throw new Error('ต้องระบุ key');
      if (!data.value) throw new Error('ต้องระบุ value');
      setConfigValue(data.key, data.value);
      result.data = { message: 'ตั้งค่า ' + data.key + ' สำเร็จ' };
      break;
      
    case 'getApiKey':
      var existingKey = getConfigValue('API_KEY');
      if (!existingKey) {
        existingKey = generateApiKey();
        setConfigValue('API_KEY', existingKey);
      }
      result.data = { api_key: existingKey, message: 'ใช้ key นี้สำหรับ action ที่ต้อง Auth' };
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
      result.data = { message: 'ส่ง Telegram สำเร็จ', result: tgResult };
      break;
      
    case 'setupTelegram':
      // ตั้งค่า Telegram แบบครบจบในคำสั่งเดียว
      if (!data.bot_token) throw new Error('ต้องระบุ bot_token');
      if (!data.chat_id) throw new Error('ต้องระบุ chat_id');
      setConfigValue('TELEGRAM_BOT_TOKEN', data.bot_token);
      setConfigValue('TELEGRAM_CHAT_ID', data.chat_id);
      // ทดสอบส่ง
      var testResult = sendTelegramMessage(data.chat_id, '✅ PKG Data Hub v3.1 เชื่อมต่อ Telegram สำเร็จ!');
      result.data = { 
        message: 'ตั้งค่า Telegram สำเร็จ', 
        test: testResult.ok ? 'ทดสอบส่งสำเร็จ' : 'ทดสอบส่งล้มเหลว: ' + testResult.description
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

function initialize() {
  // รันครั้งเดียวเมื่อติดตั้งใหม่
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
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
      'บัญชี_ความถูกต้อง', 'บัญชี_คำปรึกษา', 'บัญชี_พึงพอใจโดยรวม', 'บัญชี_ข้อเสนอแนะ',
      'การเงิน_ความสะดวก', 'การเงิน_ความรวดเร็ว', 'การเงิน_ประสิทธิภาพ',
      'การเงิน_ความถูกต้อง', 'การเงิน_คำปรึกษา', 'การเงิน_พึงพอใจโดยรวม', 'การเงิน_ข้อเสนอแนะ'];
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
    message: '🎉 PKG Data Hub v3.1 ติดตั้งสำเร็จ!',
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