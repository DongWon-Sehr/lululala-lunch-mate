const MenuService = {
  // 1. 전체 메뉴 조회 (캐싱용)
  getAllMenus: function () {
    try {
      const rawData = Util.getSheetData('menu');

      // [수정 1] 데이터가 없으면 바로 빈 배열을 담아 Util.response 객체로 반환
      if (!rawData || rawData.length === 0) {
        return Util.response(true, [], null);
      }

      const menus = rawData
        .filter(r => {
          const enabled = (typeof r.enabled === 'object' && r.enabled) ? r.enabled.text : r.enabled;
          return enabled === true || enabled === 'TRUE' || enabled === 'true';
        })
        .map(r => {
          let name = (typeof r.name === 'object' && r.name) ? r.name.text : r.name;
          let price = (typeof r.price === 'object' && r.price) ? (r.price.numberValue || r.price.text) : r.price;
          let rId = (typeof r.restaurant_id === 'object' && r.restaurant_id) ? r.restaurant_id.text : r.restaurant_id;

          let isSig = (typeof r.is_signature === 'object' && r.is_signature) ? r.is_signature.text : r.is_signature;
          const isSignature = (isSig === true || isSig === 'TRUE' || isSig === 'true');

          return {
            id: (typeof r.id === 'object' && r.id) ? r.id.text : r.id,
            restaurant_id: String(rId),
            name: Util.unescapeTextFromSheet(name),
            price: Number(price) || 0,
            is_signature: isSignature
          };
        });

      // [수정 2] 성공 시, 가공된 메뉴 목록을 Util.response 객체로 반환
      return Util.response(true, menus, null);

    } catch (e) {
      console.error('getAllMenus Error', e);
      // [수정 3] 에러 발생 시에도 안전한 실패 응답 객체를 반환
      return Util.response(false, [], '메뉴 목록 조회 중 오류: ' + e.toString());
    }
  },

  getMenusByRestaurantId: function (restaurantId) {
    // getAllMenus가 이제 Util.response 객체를 반환하므로, 이를 처리해야 함
    const allRes = this.getAllMenus();
    if (!allRes.success) return allRes; // 실패 시 에러 객체 반환

    const all = allRes.data; // 성공 시 데이터 배열
    const targetMenus = all.filter(m => m.restaurant_id === String(restaurantId));

    // [추가] 특정 식당 메뉴 조회도 Util.response를 통해 반환
    return Util.response(true, targetMenus, null);
  },

  // 2. 메뉴 업데이트 (Overwrite 전략 + is_signature 저장)
  updateMenus: function (restaurantId, menuForms) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('menu');

    try { // [추가] updateMenus 전체를 try-catch로 감싸서 안전한 응답 보장
      // [수정] 초기 시트 생성 시 is_signature 위치 조정
      if (!sheet) {
        sheet = ss.insertSheet('menu');
        sheet.appendRow(['id', 'restaurant_id', 'name', 'price', 'is_signature', 'enabled', 'created_at', 'updated_at']);
      }

      // ... (기존 로직 유지) ...

      // 헤더 인덱스 동적 탐색 (컬럼 위치 변경에 대응)
      const headers = sheet.getDataRange().getValues()[0];
      const rIdIdx = headers.indexOf('restaurant_id');
      const nameIdx = headers.indexOf('name');
      const priceIdx = headers.indexOf('price');
      const enabledIdx = headers.indexOf('enabled');
      const updatedIdx = headers.indexOf('updated_at');
      const isSigIdx = headers.indexOf('is_signature');

      const data = sheet.getDataRange().getValues();

      // 해당 식당의 행(Row) 인덱스 찾기
      const targetRowIndices = [];
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][rIdIdx]) === String(restaurantId)) {
          targetRowIndices.push(i + 1); // 1-based index
        }
      }

      const validNewMenus = (menuForms || []).filter(m => m.name && m.name.trim() !== '');
      const now = new Date();

      // A. Overwrite (기존 행 덮어쓰기)
      const reuseCount = Math.min(targetRowIndices.length, validNewMenus.length);
      for (let i = 0; i < reuseCount; i++) {
        const rowIndex = targetRowIndices[i];
        const menu = validNewMenus[i];

        let validPrice = Number(menu.price);
        if (isNaN(validPrice) || validPrice < 0) validPrice = 0;

        sheet.getRange(rowIndex, nameIdx + 1).setValue(Util.escapeTextForSheet(menu.name));
        sheet.getRange(rowIndex, priceIdx + 1).setValue(validPrice);
        sheet.getRange(rowIndex, enabledIdx + 1).setValue(true);
        sheet.getRange(rowIndex, updatedIdx + 1).setValue(now);

        if (isSigIdx !== -1) {
          sheet.getRange(rowIndex, isSigIdx + 1).setValue(menu.is_signature === true);
        }
      }

      // B. Soft Delete (남는 행 비활성화)
      if (targetRowIndices.length > validNewMenus.length) {
        for (let i = validNewMenus.length; i < targetRowIndices.length; i++) {
          const rowIndex = targetRowIndices[i];
          sheet.getRange(rowIndex, enabledIdx + 1).setValue(false);
          sheet.getRange(rowIndex, updatedIdx + 1).setValue(now);

          if (isSigIdx !== -1) {
            sheet.getRange(rowIndex, isSigIdx + 1).setValue(false);
          }
        }
      }

      // C. Insert (모자란 행 추가)
      if (validNewMenus.length > targetRowIndices.length) {
        const rowsToAdd = [];
        for (let i = targetRowIndices.length; i < validNewMenus.length; i++) {
          const menu = validNewMenus[i];
          let validPrice = Number(menu.price);
          if (isNaN(validPrice) || validPrice < 0) validPrice = 0;

          const rowData = new Array(headers.length).fill('');

          if (headers.indexOf('id') !== -1) rowData[headers.indexOf('id')] = Util.getUuid();
          if (rIdIdx !== -1) rowData[rIdIdx] = restaurantId;
          if (nameIdx !== -1) rowData[nameIdx] = Util.escapeTextForSheet(menu.name);
          if (priceIdx !== -1) rowData[priceIdx] = validPrice;
          if (enabledIdx !== -1) rowData[enabledIdx] = true;
          if (headers.indexOf('created_at') !== -1) rowData[headers.indexOf('created_at')] = now;
          if (updatedIdx !== -1) rowData[updatedIdx] = now;
          if (isSigIdx !== -1) rowData[isSigIdx] = (menu.is_signature === true);

          rowsToAdd.push(rowData);
        }

        if (rowsToAdd.length > 0) {
          const lastRow = sheet.getLastRow();
          sheet.getRange(lastRow + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
        }
      }

      // D. 평균 가격 계산 후 반환 (updateMenus는 RestaurantService에 의해 호출되며 평균 가격을 반환해야 함)
      return this.calculateAveragePrice(validNewMenus);

    } catch (e) {
      console.error('updateMenus Error', e);
      // [추가] 에러 시에는 0을 반환 (RestaurantService가 이 값을 받아서 처리해야 함)
      return 0;
    }
  },

  // 3. 평균 가격 계산 (0원 제외)
  calculateAveragePrice: function (menus) {
    if (!menus || menus.length === 0) return 0;

    let sum = 0;
    let count = 0;

    menus.forEach(m => {
      if (!m.name || !m.name.trim()) return;
      const p = Number(m.price);
      if (!isNaN(p) && p > 0) {
        sum += p;
        count++;
      }
    });

    if (count === 0) return 0;
    return Math.round(sum / count);
  }
};