// Repeatable Google Sheets schema migration. Existing rows are preserved.
function setupSpreadsheet() {
  let id = APP.properties.getProperty('SPREADSHEET_ID');
  let ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('ระบบตารางคลินิกนอกเวลา');
  if (!id) APP.properties.setProperty('SPREADSHEET_ID', ss.getId());
  Object.keys(APP.headers).forEach(function(name) {
    let sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, APP.headers[name].length).setValues([APP.headers[name]]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, APP.headers[name].length).setFontWeight('bold').setBackground('#d8eee9');
    } else {
      const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
      const missing = APP.headers[name].filter(function(header) { return !existing.includes(header); });
      if (missing.length) sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
    }
  });
  let defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) ss.deleteSheet(defaultSheet);
  seedDemoData();
  Logger.log('Spreadsheet ready: ' + ss.getUrl());
  return ss.getUrl();
}
