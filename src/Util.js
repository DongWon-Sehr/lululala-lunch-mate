/**
 * Google Apps Script에서 사용되는 범용 유틸리티 함수들을 모아둔 파일입니다.
 */

// 전역 변수 충돌을 막기 위해 모든 기능을 const Util 객체 내부에 통합 정의합니다.

const Util = {

  // Helper: 현재 활성된 Google Sheet를 가져옵니다.
  getSpreadsheet: function () {
    return SpreadsheetApp.getActiveSpreadsheet();
  },

  /**
   * 지정된 시트에서 헤더를 포함한 전체 데이터를 JSON 배열로 읽어옵니다.
   */
  getSheetData: function (sheetName) {
    const sheet = Util.getSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return [];

    const range = sheet.getDataRange();
    if (range.getNumRows() <= 1) return [];

    const values = range.getValues();
    const headers = values[0];
    const data = [];

    for (let i = 1; i < values.length; i++) {
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[i][j];
      }
      data.push(row);
    }
    return data;
  },

  /**
   * 표준 응답 포맷을 생성합니다.
   */
  response: function (success, data, message) {
    return { success, data, message: message || (success ? 'Success' : 'Error') };
  },

  /**
   * UUID (Universally Unique Identifier)를 생성합니다.
   */
  getUuid: function () {
    return Utilities.getUuid();
  },

  /**
   * Google Sheet 입력 시 문제를 일으킬 수 있는 문자(탭, 개행 등)를 처리합니다.
   */
  escapeTextForSheet: function (text) {
    if (typeof text !== 'string') return text;
    return text.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  },

  /**
   * Sheet에서 읽은 문자열에서 이스케이프된 문자(탭, 개행 등)를 복원합니다.
   */
  unescapeTextFromSheet: function (text) {
    if (typeof text !== 'string') return text;
    return text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  },

  /**
   * Sheet에서 읽어온 다양한 형태의 날짜 값을 표준 ISO 8601 문자열로 변환합니다.
   */
  safeDateIsoString: function (val) {
    if (!val) return null; // [수정] 값이 없으면 null
    try {
      // GAS에서 Date 객체로 읽어오는 경우 처리
      if (val instanceof Date) return val.toISOString();

      // 구글 시트 날짜 시리얼 번호(숫자) 처리
      if (typeof val === 'number') {
        // 25569는 1970-01-01을 의미하는 Excel 날짜 시리얼 값
        const sheetDate = new Date((val - 25569) * 86400 * 1000);
        return sheetDate.toISOString();
      }

      // 일반 날짜/문자열 처리
      const d = new Date(val);
      // 유효하지 않은 날짜(Invalid Date)면 null 반환
      if (isNaN(d.getTime())) return null;

      return d.toISOString();
    } catch (e) {
      return null; // [수정] 에러 발생 시 null
    }
  }
};