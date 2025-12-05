const Util = {
  // [Mod] Google Sheets API를 사용하여 값(text)과 메타데이터(url) 함께 조회
  // * 중요: Apps Script 좌측 '서비스'에서 'Google Sheets API'를 추가해야 작동합니다.
  getSheetData: function (sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet || sheet.getLastRow() === 0) return [];

    const spreadsheetId = ss.getId();

    try {
      // Advanced Sheets API 호출 (값과 메타데이터 함께 조회)
      const response = Sheets.Spreadsheets.get(spreadsheetId, {
        ranges: [sheetName],
        fields: "sheets(data(rowData(values(effectiveValue,chipRuns))))"
      });

      const sheetData = response.sheets[0].data[0];
      const rowData = sheetData.rowData;

      if (!rowData || rowData.length === 0) return [];

      // 1. 헤더 추출
      const headers = [];
      if (rowData[0].values) {
        rowData[0].values.forEach(cell => {
          const val = cell.effectiveValue;
          if (val && val.stringValue) headers.push(val.stringValue);
          else headers.push("");
        });
      }

      // 2. 데이터 매핑
      const result = [];
      for (let i = 1; i < rowData.length; i++) {
        const row = rowData[i];
        if (!row.values) continue;

        let obj = {};
        headers.forEach((header, index) => {
          const cell = row.values[index];
          let textVal = ""; // 변수명은 textVal이지만 실제로는 any 타입 저장
          let urlVal = "";

          if (cell) {
            // A. 값 추출 (텍스트, 숫자, 불리언)
            if (cell.effectiveValue) {
              const val = cell.effectiveValue;
              if (val.stringValue !== undefined) {
                textVal = val.stringValue;
              }
              // [수정됨] 숫자는 문자열로 바꾸지 않고 그대로 숫자(Number)로 저장
              else if (val.numberValue !== undefined) {
                textVal = val.numberValue;
              }
              else if (val.boolValue !== undefined) {
                textVal = val.boolValue;
              }
            }

            // B. 스마트칩 URL (구글맵 링크)
            if (cell.chipRuns) {
              for (const run of cell.chipRuns) {
                if (run.chip && run.chip.richLinkProperties && run.chip.richLinkProperties.uri) {
                  urlVal = run.chip.richLinkProperties.uri;
                  break;
                }
              }
            }
          }

          // URL이 있으면 { text, url } 객체로, 없으면 값만 반환
          if (urlVal) {
            // URL이 있는 경우 보통 텍스트이므로 그대로 둠 (필요시 String 변환)
            obj[header] = { text: String(textVal), url: urlVal };
          } else {
            // URL이 없으면 원본 타입(숫자, 문자 등) 그대로 반환
            obj[header] = textVal;
          }
        });
        result.push(obj);
      }

      return result;

    } catch (e) {
      // API 서비스가 추가되지 않았을 때를 대비한 로그
      console.error("Sheets API Error (서비스 추가 필요): " + e.toString());
      return this.getSheetDataFallback(sheetName);
    }
  },

  // [Backup] 기존 방식 (API 에러 시)
  getSheetDataFallback: function (sheetName) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    return data.map(row => {
      let obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
  },

  // [NEW] 시트 저장을 위해 텍스트 앞에 작은따옴표를 붙이는 함수 (수식 방지)
  escapeTextForSheet: function (comment) {
    if (typeof comment !== 'string') {
      comment = String(comment || '');
    }
    // 코멘트가 +, -, = 중 하나로 시작하면 앞에 작은따옴표를 추가
    if (comment.startsWith('+') || comment.startsWith('-') || comment.startsWith('=')) {
      return "'" + comment;
    }
    return comment;
  },

  // [NEW] 시트에서 불러온 텍스트에서 불필요한 작은따옴표를 제거하는 함수
  unescapeTextFromSheet: function (sheetText) {
    if (typeof sheetText !== 'string' || sheetText.length < 2) {
      return sheetText;
    }

    // 1. 작은따옴표로 시작하는지 확인
    if (sheetText.startsWith("'")) {
      const secondChar = sheetText.charAt(1);

      // 2. 두 번째 문자가 수식 시작 기호인지 확인 (우리가 의도적으로 넣었는지 판단)
      if (secondChar === '+' || secondChar === '-' || secondChar === '=') {
        // 3. 삽입된 작은따옴표로 판단하고 제거 후 반환
        return sheetText.substring(1);
      }
    }

    // 조건에 해당하지 않으면 원본 텍스트 그대로 반환
    return sheetText;
  },

  getUuid: function () {
    return Utilities.getUuid();
  },

  getNow: function () {
    return new Date();
  },

  response: function (success, data, message) {
    return { success: success, data: data, message: message };
  }
};