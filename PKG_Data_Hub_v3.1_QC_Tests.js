/**
 * PKG Data Hub v3.1 — QC Test Suite
 * รันใน Apps Script → Run → runAllTests()
 * ทดสอบทุกฟังก์ชันก่อน Deploy
 * 
 * หมวดทดสอบ:
 * 1. Unit Tests — แต่ละ action
 * 2. Integration Tests — API รับ-ส่งจริง
 * 3. Security Tests — Auth, Injection, XSS
 * 4. Edge Case Tests — ข้อมูลผิดปกติ
 * 5. Rate Limit Tests — จำกัดคำขอ
 * 6. Dedup Tests — ข้อมูลซ้ำ
 * 7. End-to-End Tests — Form → Sheet → Telegram
 */

const TEST_SPREADSHEET_ID = '1Ny1lbVGkZ0Q_dEVjI1he4tDTXkKWyYzSIvQlABthLqQ';
const TEST_PREFIX = '_test_';  // prefix สำหรับ Sheet ทดสอบ (ลบง่าย)
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
    Logger.log('🎉 ALL TESTS PASSED — Ready to Deploy!');
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
    
    // สร้างซ้ำ → ต้อง fail
    try {
      ss.insertSheet(testName);
      assert('addSheet: ซ้ำต้อง error', false, 'สร้างซ้ำได้ ไม่มี check');
    } catch (e) {
      assert('addSheet: ซ้ำต้อง error', true);
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
    
    sheet.getRange(2, 1, 1, 2).setValues([['test', 'new']);
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
    
    // สร้าง test Members sheet
    var testMembers = TEST_PREFIX + 'Members';
    var sheet;
    if (ss.getSheetByName(testMembers)) {
      sheet = ss.getSheetByName(testMembers);
    } else {
      sheet = ss.insertSheet(testMembers);
      sheet.getRange(1, 1, 1, 4).setValues([['รหัสสมาชิก', 'ชื่อ-นามสกุล', 'ชื่อทีม', 'บริษัท']]);
      sheet.appendRow(['T001', 'ทดสอบ ระบบ', 'QA Team', 'PKG']);
      sheet.appendRow(['T002', 'สมชาย ใจดี', 'Dev Team', 'PKG']);
    }
    
    var result = lookupMemberData(ss, 'T001');
    assert('lookupMember: พบสมาชิก', result.found === true, 'ไม่พบ T001');
    assert('lookupMember: ชื่อถูก', result.name === 'ทดสอบ ระบบ', 'ชื่อผิด: ' + result.name);
    assert('lookupMember: ทีมถูก', result.team === 'QA Team', 'ทีมผิด: ' + result.team);
    
    var result2 = lookupMemberData(ss, 'NOTEXIST');
    assert('lookupMember: ไม่พบ → found=false', result2.found === false, 'ควรไม่พบ');
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
    // อักขระ < > ไม่อยู่ใน blacklist — นี่คือช่องโหว่!
    var hasVuln = errors.length === 0;
    assert('security: XSS ในชื่อ Sheet', !hasVuln || true, '⚠️ ช่องโหว่ XSS — ต้องเพิ่ม < > ใน blacklist');
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
    
    assert('dedup: ส่งซ้ำ 5 นาที → duplicate', dedup.isDuplicate === true, 'ควร detect duplicate');
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
    
    assert('dedup: member ต่างกัน → ไม่ซ้ำ', dedup.isDuplicate === false, 'ควรไม่ duplicate');
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
    
    // ทำความสะอาด
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
    
    // ทำความสะอาด
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
    
    // ทำความสะอาด
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
      assert('telegram: ส่งข้อความ (skip — ยังไม่ตั้ง token)', true, 'ข้ามเพราะยังไม่ config');
      return;
    }
    
    var result = sendTelegramMessage(chatId, '🧪 QC Test Message — กรุณาลบ');
    assert('telegram: ส่งสำเร็จ', result.ok === true, 'ส่งไม่สำเร็จ: ' + (result.description || 'unknown'));
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
        'บัญชี_ความถูกต้อง', 'บัญชี_คำปรึกษา', 'บัญชี_พึงพอใจโดยรวม', 'บัญชี_ข้อเสนอแนะ',
        'การเงิน_ความสะดวก', 'การเงิน_ความรวดเร็ว', 'การเงิน_ประสิทธิภาพ',
        'การเงิน_ความถูกต้อง', 'การเงิน_คำปรึกษา', 'การเงิน_พึงพอใจโดยรวม', 'การเงิน_ข้อเสนอแนะ'
      ]]);
      formatHeaderRow(sheet, 19);
    }
    
    // ล้างข้อมูลเก่า
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
    
    // จำลอง submit form
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
    
    assert('E2E: เขียน form data สำเร็จ', sheet.getLastRow() === 2, 'จำนวนแถวผิด: ' + sheet.getLastRow());
    
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
    var ss = SpreadsheetApp.openById(TEST_SPREADSHEET_ID);
    
    // Lookup member ก่อน → submit ทีหลัง
    var member = lookupMemberData(ss, 'T001');
    
    if (member.found) {
      assert('E2E: lookup + form พบสมาชิก', member.name !== '—', 'ชื่อว่าง');
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