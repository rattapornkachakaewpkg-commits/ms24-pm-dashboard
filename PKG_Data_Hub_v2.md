# PKG Data Hub v2.0 - Google Apps Script

รองรับ: GET (อ่าน) + POST (เขียน/สร้าง/แก้ไข/ลบ)
รวมฟีเจอร์ทั้งหมดจาก v1.0 + เพิ่มความสามารถเขียนข้อมูล

---

```javascript
/**
 * PKG Data Hub v2.0
 * รองรับ: GET (อ่าน) + POST (เขียน/สร้าง/แก้ไข/ลบ)
 * รวมฟีเจอร์ทั้งหมดจาก v1.0 + เพิ่มความสามารถเขียนข้อมูล
 */

const SPREADSHEET_ID = '1Ny1lbVGkZ0Q_dEVjI1he4tDTXkKWyYzSIvQlABthLqQ';

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
    
    // รองรับทั้ง POST (JSON body) และ GET (query params)
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      data = {
        action: e.parameter.action || 'listSheets',
        sheetName: e.parameter.sheetName || null,
        rowData: e.parameter.rowData ? JSON.parse(e.parameter.rowData) : null,
        rows: e.parameter.rows ? JSON.parse(e.parameter.rows) : null,
        headers: e.parameter.headers ? JSON.parse(e.parameter.headers) : null,
        row: e.parameter.row ? parseInt(e.parameter.row) : null,
        col: e.parameter.col ? parseInt(e.parameter.col) : null,
        value: e.parameter.value || null
      };
    }
    
    const action = data.action || 'listSheets';
    const result = { status: 'ok', data: {} };
    
    switch (action) {
      
      // ===== อ่านข้อมูล (GET) =====
      
      case 'listSheets':
        result.data = {
          sheets: ss.getSheets().map(s => s.getName()),
          total: ss.getSheets().length
        };
        break;
        
      case 'readSheet':
        if (!data.sheetName) return error('ต้องระบุ sheetName');
        const sheetRead = getSheet(ss, data.sheetName);
        const lastRow = sheetRead.getLastRow();
        const lastCol = sheetRead.getLastColumn();
        if (lastRow === 0) {
          result.data = { rows: [], total: 0, headers: [] };
        } else {
          const values = sheetRead.getRange(1, 1, lastRow, lastCol).getValues();
          result.data = {
            headers: values[0],
            rows: values.slice(1),
            total: lastRow - 1
          };
        }
        break;
        
      case 'getCell':
        if (!data.sheetName || !data.row || !data.col) return error('ต้องระบุ sheetName, row, col');
        const sheetGetCell = getSheet(ss, data.sheetName);
        result.data = { value: sheetGetCell.getRange(data.row, data.col).getValue() };
        break;
        
      case 'getSheetInfo':
        if (!data.sheetName) return error('ต้องระบุ sheetName');
        const sheetInfo = getSheet(ss, data.sheetName);
        result.data = {
          name: sheetInfo.getName(),
          index: sheetInfo.getIndex(),
          lastRow: sheetInfo.getLastRow(),
          lastColumn: sheetInfo.getLastColumn(),
          frozenRows: sheetInfo.getFrozenRows(),
          frozenColumns: sheetInfo.getFrozenColumns()
        };
        break;
      
      // ===== เขียนข้อมูล (POST) =====
      
      case 'addSheet':
        if (!data.sheetName) return error('ต้องระบุ sheetName');
        const existingSheet = ss.getSheetByName(data.sheetName);
        if (existingSheet) {
          return error('Sheet "' + data.sheetName + '" มีอยู่แล้ว');
        }
        const newSheet = ss.insertSheet(data.sheetName);
        if (data.headers) {
          newSheet.getRange(1, 1, 1, data.headers.length).setValues([data.headers]);
          newSheet.getRange(1, 1, 1, data.headers.length).setFontWeight('bold').setBackground('#003366').setFontColor('#ffffff');
          newSheet.setFrozenRows(1);
        }
        result.data = { message: 'สร้าง Sheet "' + data.sheetName + '" สำเร็จ' };
        break;
        
      case 'setHeaders':
        if (!data.sheetName || !data.headers) return error('ต้องระบุ sheetName และ headers');
        const sheetHeaders = getSheet(ss, data.sheetName);
        sheetHeaders.getRange(1, 1, 1, data.headers.length).setValues([data.headers]);
        sheetHeaders.getRange(1, 1, 1, data.headers.length).setFontWeight('bold').setBackground('#003366').setFontColor('#ffffff');
        sheetHeaders.setFrozenRows(1);
        result.data = { message: 'ตั้งค่า Headers สำเร็จ' };
        break;
        
      case 'writeRow':
        if (!data.sheetName || !data.rowData) return error('ต้องระบุ sheetName และ rowData');
        const sheetWrite = getSheet(ss, data.sheetName);
        sheetWrite.appendRow(data.rowData);
        result.data = { message: 'เพิ่ม 1 แถวใน "' + data.sheetName + '" สำเร็จ', row: sheetWrite.getLastRow() };
        break;
        
      case 'writeRows':
        if (!data.sheetName || !data.rows) return error('ต้องระบุ sheetName และ rows');
        const sheetWriteRows = getSheet(ss, data.sheetName);
        if (data.rows.length > 0) {
          const startRow = sheetWriteRows.getLastRow() + 1;
          sheetWriteRows.getRange(startRow, 1, data.rows.length, data.rows[0].length).setValues(data.rows);
        }
        result.data = { message: 'เพิ่ม ' + data.rows.length + ' แถวใน "' + data.sheetName + '" สำเร็จ' };
        break;
        
      case 'setCell':
        if (!data.sheetName || !data.row || !data.col) return error('ต้องระบุ sheetName, row, col');
        const sheetSetCell = getSheet(ss, data.sheetName);
        sheetSetCell.getRange(data.row, data.col).setValue(data.value !== undefined ? data.value : '');
        result.data = { message: 'ตั้งค่าเซลล์สำเร็จ' };
        break;
        
      case 'setRange':
        if (!data.sheetName || !data.row || !data.col || !data.values) return error('ต้องระบุ sheetName, row, col, values');
        const sheetSetRange = getSheet(ss, data.sheetName);
        sheetSetRange.getRange(data.row, data.col, data.values.length, data.values[0].length).setValues(data.values);
        result.data = { message: 'ตั้งค่าช่วงเซลล์สำเร็จ' };
        break;
        
      case 'insertRowAt':
        if (!data.sheetName || !data.row || !data.rowData) return error('ต้องระบุ sheetName, row, rowData');
        const sheetInsertRow = getSheet(ss, data.sheetName);
        sheetInsertRow.insertRowBefore(data.row);
        sheetInsertRow.getRange(data.row, 1, 1, data.rowData.length).setValues([data.rowData]);
        result.data = { message: 'แทรกแถวที่ตำแหน่ง ' + data.row + ' สำเร็จ' };
        break;
        
      case 'updateRow':
        if (!data.sheetName || !data.row || !data.rowData) return error('ต้องระบุ sheetName, row, rowData');
        const sheetUpdateRow = getSheet(ss, data.sheetName);
        sheetUpdateRow.getRange(data.row, 1, 1, data.rowData.length).setValues([data.rowData]);
        result.data = { message: 'อัปเดตแถว ' + data.row + ' สำเร็จ' };
        break;
      
      // ===== ลบ/ล้างข้อมูล =====
      
      case 'clearSheet':
        if (!data.sheetName) return error('ต้องระบุ sheetName');
        const sheetClear = getSheet(ss, data.sheetName);
        const lastRowClear = sheetClear.getLastRow();
        const lastColClear = sheetClear.getLastColumn();
        if (lastRowClear > 1) {
          sheetClear.getRange(2, 1, lastRowClear - 1, lastColClear).clearContent();
        }
        result.data = { message: 'ล้างข้อมูลใน "' + data.sheetName + '" สำเร็จ' };
        break;
        
      case 'deleteSheet':
        if (!data.sheetName) return error('ต้องระบุ sheetName');
        const sheetDel = getSheet(ss, data.sheetName);
        ss.deleteSheet(sheetDel);
        result.data = { message: 'ลบ Sheet "' + data.sheetName + '" สำเร็จ' };
        break;
        
      case 'deleteRow':
        if (!data.sheetName || !data.row) return error('ต้องระบุ sheetName และ row');
        const sheetDelRow = getSheet(ss, data.sheetName);
        sheetDelRow.deleteRow(data.row);
        result.data = { message: 'ลบแถว ' + data.row + ' สำเร็จ' };
        break;
        
      case 'clearRange':
        if (!data.sheetName || !data.row || !data.col || !data.numRows || !data.numCols) return error('ต้องระบุ sheetName, row, col, numRows, numCols');
        const sheetClearRange = getSheet(ss, data.sheetName);
        sheetClearRange.getRange(data.row, data.col, data.numRows, data.numCols).clearContent();
        result.data = { message: 'ล้างช่วงเซลล์สำเร็จ' };
        break;
      
      // ===== จัดรูปแบบ =====
      
      case 'formatHeader':
        if (!data.sheetName) return error('ต้องระบุ sheetName');
        const sheetFormat = getSheet(ss, data.sheetName);
        const headers = data.headers || sheetFormat.getRange(1, 1, 1, sheetFormat.getLastColumn()).getValues()[0];
        sheetFormat.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#003366').setFontColor('#ffffff');
        sheetFormat.setFrozenRows(1);
        result.data = { message: 'จัดรูปแบบ Header สำเร็จ' };
        break;
        
      case 'autoResize':
        if (!data.sheetName) return error('ต้องระบุ sheetName');
        const sheetResize = getSheet(ss, data.sheetName);
        const colCount = sheetResize.getLastColumn();
        for (let i = 1; i <= colCount; i++) {
          sheetResize.autoResizeColumn(i);
        }
        result.data = { message: 'ปรับขนาดคอลัมน์อัตโนมัติสำเร็จ' };
        break;
        
      default:
        return error('action ไม่รองรับ: ' + action + '\naction ที่รองรับ: listSheets, readSheet, getCell, getSheetInfo, addSheet, setHeaders, writeRow, writeRows, setCell, setRange, insertRowAt, updateRow, clearSheet, deleteSheet, deleteRow, clearRange, formatHeader, autoResize');
    }
    
    return success(result);
    
  } catch (err) {
    return error(err.toString());
  }
}

function getSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error('ไม่พบ Sheet "' + name + '"');
  }
  return sheet;
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
```

---

## 📋 Action ทั้งหมดที่รองรับ (20 ฟังก์ชัน)

| หมวด | Action | หน้าที่ |
|:---|:---|:---|
| **อ่าน** | `listSheets` | ดู Sheet ทั้งหมด |
| | `readSheet` | อ่านข้อมูลทั้ง Sheet |
| | `getCell` | อ่านค่าเซลล์เดียว |
| | `getSheetInfo` | ข้อมูล Sheet (จำนวนแถว/คอลัมน์) |
| **เขียน** | `addSheet` | สร้าง Sheet ใหม่ + Headers |
| | `setHeaders` | ตั้งค่า Header |
| | `writeRow` | เพิ่ม 1 แถว |
| | `writeRows` | เพิ่มหลายแถวพร้อมกัน |
| | `setCell` | ตั้งค่า 1 เซลล์ |
| | `setRange` | ตั้งค่าช่วงเซลล์ |
| | `insertRowAt` | แทรกแถวที่ตำแหน่ง |
| | `updateRow` | แก้ไขแถวที่มีอยู่ |
| **ลบ** | `clearSheet` | ล้างข้อมูลทั้งหมด (เก็บ Header) |
| | `deleteSheet` | ลบ Sheet |
| | `deleteRow` | ลบแถว |
| | `clearRange` | ล้างช่วงเซลล์ |
| **จัดรูปแบบ** | `formatHeader` | จัด Header (สีน้ำเงิน ตัวหนา) |
| | `autoResize` | ปรับขนาดคอลัมน์อัตโนมัติ |

---

## วิธีติดตั้ง

1. เปิด Google Sheets → Extensions → Apps Script
2. ลบโค้ดเก่าทั้งหมด
3. วางโค้ดด้านบน
4. Deploy → New deployment → Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy URL มาส่งให้ AliClaw
