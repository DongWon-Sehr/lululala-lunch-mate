const Migration = {
  /**
   * Initial application setup: creates missing sheets and syncs required columns.
   * Removed columns are ignored; missing required columns are appended at the far right.
   */
  setup: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const requiredSheets = {
      'restaurant': [
        'id', 'name', 'category', 'tag', 'signature_menu', 'price',
        'location', 'rate', 'like_count', 'review_count', 'enabled',
        'created_at', 'updated_at', 'created_by'
      ],
      'review': [
        'id', 'restaurant_id', 'rate', 'comment', 'user_name', 
        'user_email', 'enabled', 'created_at', 'updated_at'
      ],
      'menu': [
        'id', 'restaurant_id', 'name', 'price', 'is_signature',
        'enabled', 'created_at', 'updated_at', 'created_by'
      ],
      'like': [
        'id', 'restaurant_id', 'user_email', 'enabled', 
        'created_at', 'updated_at'
      ],
      'admin': [
        'id', 'email', 'created_at'
      ],
      'guest': [
        'id', 'name', 'email', 'department', 'created_at'
      ],
      'excluded': [
        'id', 'email', 'created_at'
      ]
    };

    for (const [sheetName, expectedColumns] of Object.entries(requiredSheets)) {
      let sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(expectedColumns);
        Logger.log(`[생성] '${sheetName}' 시트가 생성되었습니다.`);
        continue;
      }

      const lastCol = sheet.getLastColumn();
      let currentHeaders = [];
      
      if (lastCol > 0) {
        currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      } else {
        // Sheet exists but has no header row yet
        sheet.appendRow(expectedColumns);
        Logger.log(`[초기화] '${sheetName}' 시트에 기본 헤더가 추가되었습니다.`);
        continue;
      }
      
      let addedCount = 0;
      for (const expectedCol of expectedColumns) {
        if (!currentHeaders.includes(expectedCol)) {
          const nextColIndex = sheet.getLastColumn() + 1;
          sheet.getRange(1, nextColIndex).setValue(expectedCol);
          addedCount++;
          Logger.log(`[추가] '${sheetName}' 시트에 '${expectedCol}' 컬럼이 추가되었습니다.`);
        }
      }

      if (addedCount === 0) {
        Logger.log(`[유지] '${sheetName}' 시트는 이미 최신 구조입니다.`);
      }
    }

    Logger.log('✅ 모든 시트 초기화 및 동기화가 완료되었습니다.');
  },

  /**
   * One-time backfill: fills blank created_by cells with 'SYSTEM'
   * on the restaurant and menu sheets. Run setup() first so the column exists.
   */
  migrateCreatedBy: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    ['restaurant', 'menu'].forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        Logger.log(`[스킵] '${sheetName}' 시트가 없습니다.`);
        return;
      }

      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const colIndex = headers.indexOf('created_by');
      if (colIndex === -1) {
        Logger.log(`[스킵] '${sheetName}' 시트에 created_by 컬럼이 없습니다. setup()을 먼저 실행하세요.`);
        return;
      }

      let filledCount = 0;
      const colValues = [];
      for (let i = 1; i < data.length; i++) {
        const current = String(data[i][colIndex] || '').trim();
        if (current === '') {
          colValues.push(['SYSTEM']);
          filledCount++;
        } else {
          colValues.push([current]);
        }
      }

      if (colValues.length > 0 && filledCount > 0) {
        sheet.getRange(2, colIndex + 1, colValues.length, 1).setValues(colValues);
      }
      Logger.log(`[완료] '${sheetName}' 시트: ${filledCount}건 SYSTEM 처리 (전체 ${colValues.length}행)`);
    });

    Logger.log('✅ created_by 마이그레이션이 완료되었습니다.');
  }
};

/**
 * Global wrapper so setup can be run directly from the Apps Script editor.
 */
function setup() {
  Migration.setup();
}

/**
 * Global wrapper: run from the Apps Script editor to backfill created_by.
 */
function migrateCreatedBy() {
  Migration.migrateCreatedBy();
}
