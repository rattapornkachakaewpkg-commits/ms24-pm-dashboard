/**
 * PKG Data Hub v3.0 - Google Apps Script
 * รองรับ: GET/POST + สร้าง/ลบ Sheet + กรอกข้อมูล + รับจาก Form + Telegram Notification
 * 
 * Action ทั้งหมด:
 * READ: listSheets, readSheet, getCell, getSheetInfo
 * WRITE: addSheet, setHeaders, writeRow, writeRows, setCell, setRange, insertRowAt, updateRow
 * DELETE: clearSheet, deleteSheet, deleteRow, clearRange
 * FORMAT: formatHeader, autoResize
 * NEW: createFormSheet, submitForm, telegramNotify
 */

const SPREADSHEET_ID = '1Ny1lbVGkZ0Q_dEVjI1he4tDTXkKWyYzSIvQlABthLqQ';

// ===== TELEGRAM CONFIG =====
// ใส่ Bot Token และ Chat ID ของช่องทางที่ต้องการแจ้งเตือน
const TELEGRAM_BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';  // เปลี่ยนเป็น Bot Token ของคุณ
const TELEGRAM_CHAT_ID = 'YOUR_TELEGRAM_CHAT_ID';      // เปลี่ยนเป็น Chat ID ของช่องทาง

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let data;
    
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        data = { action: 'readSheet', sheetName: e.parameter.sheetName || e.parameter.sheet || null };
      }
    } else {
      data = {
        action: e.parameter.action || e.parameter.act || 'readSheet',
        sheetName: e.parameter.sheetName || e.parameter.sheet || null,
        sheet: e.parameter.sheet || null,
        rowData: e.parameter.rowData ? tryParseJSON(e.parameter.rowData) : null,
        rows: e.parameter.rows ? tryParseJSON(e.parameter.rows) : null,
        headers: e.parameter.headers ? tryParseJSON(e.parameter.headers) : null,
        row: e.parameter.row ? parseInt(e.parameter.row) : null,
        col: e.parameter.col ? parseInt(e.parameter.col) : null,
        value: e.parameter.value || null,
        formName: e.parameter.formName || null,
        member_id: e.parameter.member_id || e.parameter['รหัสสมาชิก'] || null,
        // รองรับับ parameter ภาษาไทย
      };
    }
    
    const action = data.action || 'readSheet';
    // ใช้ sheet หรือ sheetName ก็ได้
    data.sheetName = data.sheetName || data.sheet || null;
    
    const result = { status: 'ok', data: {} };
    
    switch (action) {
      
      // ===== อ่านข้อมูล (READ) =====
      case 'listSheets':
        result.data = {
          sheets: ss.getSheets().map(s => s.getName()),
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
        if (!data.sheetName || !data.row || !data.col) return error('ต้องระบุ sheetName, row, col');
        var sheetGetCell = getSheet(ss, data.sheetName);
        result.data = { value: sheetGetCell.getRange(data.row, data.col).getValue() };
        break;
        
      case 'getSheetInfo':
        if (!data.sheetName) return error('ต้องระบุ sheetName');
        var sheetInfo = getSheet(ss, data.sheetName);
        result.data = {
          name: sheetInfo.getName(),
          index: sheetInfo.getIndex(),
          lastRow: sheetInfo.getLastRow(),
          lastColumn: sheetInfo.getLastColumn(),
          frozenRows: sheetInfo.getFrozenRows(),
          frozenColumns: sheetInfo.getFrozenColumns()
        };
        break;
      
      // ===== เขียนข้อมูล (WRITE) =====
      
      case 'addSheet':
        if (!data.sheetName) return error('ต้องระบุ sheetName');
        var existingSheet = ss.getSheetByName(data.sheetName);
        if (existingSheet) {
          return error('Sheet "' + data.sheetName + '" มีอยู่แล้ว');
        }
        var newSheet = ss.insertSheet(data.sheetName);
        if (data.headers) {
          newSheet.getRange(1, 1, 1, data.headers.length).setValues([data.headers]);
          formatHeaderRow(newSheet, data.headers.length);
        }
        result.data = { message: 'สร้าง Sheet "' + data.sheetName + '" สำเร็จ' };
        break;
        
      case 'setHeaders':
        if (!data.sheetName || !data.headers) return error('ต้องระบุ sheetName และ headers');
        var sheetHeaders = getSheet(ss, data.sheetName);
        sheetHeaders.getRange(1, 1, 1, data.headers.length).setValues([data.headers]);
        formatHeaderRow(sheetHeaders, data.headers.length);
        result.data = { message: 'ตั้งค่า Headers สำเร็จ' };
        break;
        
      case 'writeRow':
      case 'write':
        if (!data.sheetName || !data.rowData) return error('ต้องระบุ sheetName และ rowData');
        var sheetWrite = getSheet(ss, data.sheetName);
        sheetWrite.appendRow(data.rowData);
        result.data = { message: 'เพิ่ม 1 แถวใน "' + data.sheetName + '" สำเร็จ', row: sheetWrite.getLastRow() };
        break;
        
      case 'writeRows':
        if (!data.sheetName || !data.rows) return error('ต้องระบุ sheetName และ rows');
        var sheetWriteRows = getSheet(ss, data.sheetName);
        if (data.rows.length > 0) {
          var startRow = sheetWriteRows.getLastRow() + 1;
          sheetWriteRows.getRange(startRow, 1, data.rows.length, data.rows[0].length).setValues(data.rows);
        }
        result.data = { message: 'เพิ่ม ' + data.rows.length + ' แถวใน "' + data.sheetName + '" สำเร็จ' };
        break;
        
      case 'setCell':
        if (!data.sheetName || !data.row || !data.col) return error('ต้องระบุ sheetName, row, col');
        var sheetSetCell = getSheet(ss, data.sheetName);
        sheetSetCell.getRange(data.row, data.col).setValue(data.value !== undefined ? data.value : '');
        result.data = { message: 'ตั้งค่าเซลล์สำเร็จ' };
        break;
        
      case 'setRange':
        if (!data.sheetName || !data.row || !data.col || !data.values) return error('ต้องระบุ sheetName, row, col, values');
        var sheetSetRange = getSheet(ss, data.sheetName);
        sheetSetRange.getRange(data.row, data.col, data.values.length, data.values[0].length).setValues(data.values);
        result.data = { message: 'ตั้งค่าช่วงเซลล์สำเร็จ' };
        break;
        
      case 'insertRowAt':
        if (!data.sheetName || !data.row || !data.rowData) return error('ต้องระบุ sheetName, row, rowData');
        var sheetInsertRow = getSheet(ss, data.sheetName);
        sheetInsertRow.insertRowBefore(data.row);
        sheetInsertRow.getRange(data.row, 1, 1, data.rowData.length).setValues([data.rowData]);
        result.data = { message: 'แทรกแถวที่ตำแหน่ง ' + data.row + ' สำเร็จ' };
        break;
        
      case 'updateRow':
        if (!data.sheetName || !data.row || !data.rowData) return error('ต้องระบุ sheetName, row, rowData');
        var sheetUpdateRow = getSheet(ss, data.sheetName);
        sheetUpdateRow.getRange(data.row, 1, 1, data.rowData.length).setValues([data.rowData]);
        result.data = { message: 'อัปเดตแถว ' + data.row + ' สำเร็จ' };
        break;
      
      // ===== ลบ/ล้างข้อมูล (DELETE) =====
      
      case 'clearSheet':
        if (!data.sheetName) return error('ต้องระบุ sheetName');
        var sheetClear = getSheet(ss, data.sheetName);
        var lastRowClear = sheetClear.getLastRow();
        var lastColClear = sheetClear.getLastColumn();
        if (lastRowClear > 1) {
          sheetClear.getRange(2, 1, lastRowClear - 1, lastColClear).clearContent();
        }
        result.data = { message: 'ล้างข้อมูลใน "' + data.sheetName + '" สำเร็จ' };
        break;
        
      case 'deleteSheet':
        if (!data.sheetName) return error('ต้องระบุ sheetName');
        var sheetDel = getSheet(ss, data.sheetName);
        ss.deleteSheet(sheetDel);
        result.data = { message: 'ลบ Sheet "' + data.sheetName + '" สำเร็จ' };
        break;
        
      case 'deleteRow':
        if (!data.sheetName || !data.row) return error('ต้องระบุ sheetName และ row');
        var sheetDelRow = getSheet(ss, data.sheetName);
        sheetDelRow.deleteRow(data.row);
        result.data = { message: 'ลบแถว ' + data.row + ' สำเร็จ' };
        break;
        
      case 'clearRange':
        if (!data.sheetName || !data.row || !data.col || !data.numRows || !data.numCols) return error('ต้องระบุ sheetName, row, col, numRows, numCols');
        var sheetClearRange = getSheet(ss, data.sheetName);
        sheetClearRange.getRange(data.row, data.col, data.numRows, data.numCols).clearContent();
        result.data = { message: 'ล้างช่วงเซลล์สำเร็จ' };
        break;
      
      // ===== จัดรูปแบบ (FORMAT) =====
      
      case 'formatHeader':
        if (!data.sheetName) return error('ต้องระบุ sheetName');
        var sheetFormat = getSheet(ss, data.sheetName);
        var headers = data.headers || sheetFormat.getRange(1, 1, 1, sheetFormat.getLastColumn()).getValues()[0];
        formatHeaderRow(sheetFormat, headers.length);
        result.data = { message: 'จัดรูปแบบ Header สำเร็จ' };
        break;
        
      case 'autoResize':
        if (!data.sheetName) return error('ต้องระบุ sheetName');
        var sheetResize = getSheet(ss, data.sheetName);
        var colCount = sheetResize.getLastColumn();
        for (var i = 1; i <= colCount; i++) {
          sheetResize.autoResizeColumn(i);
        }
        result.data = { message: 'ปรับขนาดคอลัมน์อัตโนมัติสำเร็จ' };
        break;
      
      // ===== NEW: รับจาก Form + Telegram =====
      
      case 'createFormSheet':
        // สร้าง Sheet สำหรับรับข้อมูลจาก Form
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
          // Sheet มีอยู่แล้ว ตรวจ headers
          var existingHeaders = existingFormSheet.getRange(1, 1, 1, existingFormSheet.getLastColumn()).getValues()[0];
          result.data = { 
            message: 'Sheet "' + formSheetName + '" มีอยู่แล้ว',
            headers: existingHeaders,
            rows: existingFormSheet.getLastRow() - 1
          };
        } else {
          // สร้าง Sheet ใหม่
          var newFormSheet = ss.insertSheet(formSheetName);
          newFormSheet.getRange(1, 1, 1, formHeaders.length).setValues([formHeaders]);
          formatHeaderRow(newFormSheet, formHeaders.length);
          result.data = { message: 'สร้าง Sheet "' + formSheetName + '" สำเร็จ', headers: formHeaders };
        }
        break;
        
      case 'submitForm':
        // รับข้อมูลจาก Form และบันทึกลง Sheet
        var targetSheet = data.sheetName || 'Feedback';
        var formData = data.formData || data;
        
        var sheetForm = ss.getSheetByName(targetSheet);
        if (!sheetForm) {
          // สร้าง Sheet ใหม่ถ้ายังไม่มี
          sheetForm = ss.insertSheet(targetSheet);
          var defaultHeaders = [
            'Timestamp', 'รหัสสมาชิก', 'ชื่อ-นามสกุล', 'ชื่อทีม', 'บริษัท',
            'บัญชี_ความสะดวก', 'บัญชี_ความรวดเร็ว', 'บัญชี_ประสิทธิภาพ',
            'บัญชี_ความถูกต้อง', 'บัญชี_คำปรึกษา', 'บัญชี_พึงพอใจโดยรวม', 'บัญชี_ข้อเสนอแนะ',
            'การเงิน_ความสะดวก', 'การเงิน_ความรวดเร็ว', 'การเงิน_ประสิทธิภาพ',
            'การเงิน_ความถูกต้อง', 'การเงิน_คำปรึกษา', 'การเงิน_พึงพอใจโดยรวม', 'การเงิน_ข้อเสนอแนะ'
          ];
          sheetForm.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
          formatHeaderRow(sheetForm, defaultHeaders.length);
        }
        
        // สร้างแถวข้อมูล
        var newRow = [
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
        
        sheetForm.appendRow(newRow);
        result.data = { 
          message: 'บันทึกข้อมูลสำรวจสำเร็จ',
          sheet: targetSheet,
          row: sheetForm.getLastRow()
        };
        
        // ส่ง Telegram Notification (ถ้าตั้งค่าไว้)
        if (TELEGRAM_BOT_TOKEN !== 'YOUR_TELEGRAM_BOT_TOKEN') {
          sendTelegramNotification(formData);
        }
        break;
        
      case 'telegramNotify':
        // ส่ง Telegram Notification โดยตรง
        var message = data.message || data.text || 'แจ้งเตือนจาก PKG Data Hub';
        var chatId = data.chatId || data.chat_id || TELEGRAM_CHAT_ID;
        
        if (TELEGRAM_BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN') {
          return error('ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN');
        }
        
        var telegramResult = sendTelegramMessage(chatId, message);
        result.data = { message: 'ส่ง Telegram สำเร็จ', result: telegramResult };
        break;
      
      // ===== ค้นหาสมาชิก (สำหรับ Form) =====
      
      case 'lookupMember':
        // ค้นหาข้อมูลสมาชิกจากทุก Sheet ที่มี
        var memberId = data.member_id || data.id || data['รหัสสมาชิก'] || '';
        if (!memberId) return error('ต้องระบุ member_id');
        
        var memberResult = lookupMemberData(ss, memberId);
        result.data = memberResult;
        break;
      
      default:
        return error('action ไม่รองรับ: ' + action + '\n\naction ที่รองรับ:\n' +
          'READ: listSheets, readSheet/read, getCell, getSheetInfo\n' +
          'WRITE: addSheet, setHeaders, writeRow/write, writeRows, setCell, setRange, insertRowAt, updateRow\n' +
          'DELETE: clearSheet, deleteSheet, deleteRow, clearRange\n' +
          'FORMAT: formatHeader, autoResize\n' +
          'FORM: createFormSheet, submitForm, lookupMember\n' +
          'NOTIFY: telegramNotify');
    }
    
    return success(result);
    
  } catch (err) {
    return error(err.toString());
  }
}

// ===== Helper Functions =====

function getSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error('ไม่พบ Sheet "' + name + '"');
  }
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
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

function success(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function error(msg) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: msg
  })).setMimeType(ContentService.MimeType.JSON);
}

// ===== Telegram Functions =====

function sendTelegramNotification(formData) {
  var text = '📋 แบบสำรวจใหม่\n' +
    '👤 ' + (formData.member_name || formData['ชื่อ-นามสกุล'] || 'ไม่ระบุชื่อ') + '\n' +
    '🏢 ' + (formData.member_company || formData['บริษัท'] || '-') + ' | ' + (formData.member_team || formData['ชื่อทีม'] || '-') + '\n' +
    '📊 บัญชี: ' + (formData.acct_overall || formData['บัญชี_พึงพอใจโดยรวม'] || '-') + '/5\n' +
    '💰 การเงิน: ' + (formData.fin_overall || formData['การเงิน_พึงพอใจโดยรวม'] || '-') + '/5\n' +
    '🕐 ' + new Date().toLocaleString('th-TH');
  
  return sendTelegramMessage(TELEGRAM_CHAT_ID, text);
}

function sendTelegramMessage(chatId, text) {
  try {
    var url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';
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
    return JSON.parse(response.getContentText());
  } catch (e) {
    return { error: e.toString() };
  }
}

// ===== Lookup Member Data =====

function lookupMemberData(ss, memberId) {
  memberId = memberId.toString().toUpperCase().trim();
  
  // ค้นหาจากทุก Sheet ที่น่าจะมีข้อมูลสมาชิก
  var searchSheets = ['Members', 'สมาชิก', 'ทุนองค์กร', 'CEO_AI_Co_Worker', 'Training_Master'];
  
  for (var s = 0; s < searchSheets.length; s++) {
    var sheet = ss.getSheetByName(searchSheets[s]);
    if (!sheet) continue;
    
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) continue;
    
    var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values[0];
    
    // หา column ที่เป็นรหัสสมาชิก
    var idCol = -1;
    var nameCol = -1;
    var teamCol = -1;
    var companyCol = -1;
    
    for (var h = 0; h < headers.length; h++) {
      var header = headers[h].toString().trim().toLowerCase();
      if (header.includes('รหัส') || header.includes('id') || header.includes('member') || header.includes('code')) idCol = h;
      if (header.includes('ชื่อ') || header.includes('name')) nameCol = h;
      if (header.includes('ทีม') || header.includes('team')) teamCol = h;
      if (header.includes('บริษัท') || header.includes('company') || header.includes('กลุ่ม')) companyCol = h;
    }
    
    if (idCol === -1) continue;
    
    // ค้นหา member
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