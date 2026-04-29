const Migration = {
  /**
   * 애플리케이션 초기 설정 (시트 생성 및 필요 컬럼 동기화)
   * 삭제된 컬럼은 무시하고, 누락된 필수 컬럼만 시트 맨 우측에 추가합니다.
   */
  setup: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 시트별 필수 컬럼 정의
    const requiredSheets = {
      'restaurant': [
        'id', 'name', 'category', 'tag', 'signature_menu', 'price', 
        'location', 'rate', 'like_count', 'review_count', 'enabled', 
        'created_at', 'updated_at'
      ],
      'review': [
        'id', 'restaurant_id', 'rate', 'comment', 'user_name', 
        'user_email', 'enabled', 'created_at', 'updated_at'
      ],
      'menu': [
        'id', 'restaurant_id', 'name', 'price', 'is_signature', 
        'enabled', 'created_at', 'updated_at'
      ],
      'like': [
        'id', 'restaurant_id', 'user_email', 'enabled', 
        'created_at', 'updated_at'
      ],
      'admin': [
        'email'
      ],
      'guest': [
        'name', 'email', 'department'
      ]
    };

    for (const [sheetName, expectedColumns] of Object.entries(requiredSheets)) {
      let sheet = ss.getSheetByName(sheetName);
      
      // 1. 시트가 없는 경우 생성 후 전체 헤더 추가
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(expectedColumns);
        Logger.log(`[생성] '${sheetName}' 시트가 생성되었습니다.`);
        continue;
      }

      // 2. 시트가 존재하는 경우 헤더 구조 확인 후 누락된 컬럼 추가
      const lastCol = sheet.getLastColumn();
      let currentHeaders = [];
      
      if (lastCol > 0) {
        currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      } else {
        // 시트는 존재하지만 아무 데이터(헤더)도 없는 경우
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
  }
};

/**
 * 에디터에서 직접 실행하기 위한 글로벌 래퍼 함수
 * 실행 방법: 에디터 상단 드롭다운에서 이 함수(setup)를 선택하고 '실행' 버튼 클릭
 */
function setup() {
  Migration.setup();
}
