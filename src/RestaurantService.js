const RestaurantService = {
  getAllRestaurants: function () {
    try {
      // 1. 일반 데이터 조회 (Util.getSheetData 사용)
      const rawData = Util.getSheetData('restaurant');

      // 2. Rich Text/Link 데이터 조회를 위한 Sheet API 직접 호출 (Location/MapUrl 추출용)
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('restaurant');
      const dataRange = sheet.getDataRange();
      const headers = dataRange.getValues()[0];
      const richValues = dataRange.getRichTextValues();

      const locationColIndex = headers.indexOf('location');

      const reviewsRes = ReviewService.getAllReviews();
      const reviewCountMap = reviewsRes.success ? reviewsRes.data.reviewCountMap : {};

      const restaurants = rawData
        .filter(r => {
          const enabledVal = (typeof r.enabled === 'object' && r.enabled) ? r.enabled.text : r.enabled;
          return enabledVal === true || enabledVal === 'TRUE' || enabledVal === 'true';
        })
        .map((r, index) => {

          // --- 직렬화 안정성 확보 및 Rich Text 복구 ---

          let tagVal = (typeof r.tag === 'object' && r.tag) ? r.tag.text : r.tag;
          tagVal = Util.unescapeTextFromSheet(tagVal);
          r.tags = tagVal ? String(tagVal).split(',').map(t => t.trim()) : [];

          // 위치, 텍스트 복원 및 Sheet API를 사용한 Map URL 추출
          let locText = '', locUrl = '';

          if (locationColIndex !== -1 && index + 1 < richValues.length) {
            const richCell = richValues[index + 1][locationColIndex];
            const runs = richCell?.getRuns();
            if (runs && runs.length > 0) {
              const link = runs[0].getLinkUrl();
              if (link) { locUrl = link; }
            }
          }

          if (typeof r.location === 'object' && r.location !== null) {
            locText = r.location.text || '';
            locUrl = locUrl || r.location.url || '';
          } else {
            locText = String(r.location || '');
          }

          // [FIX] 직렬화 오류 방지를 위해 순수 문자열로 강제 변환
          r.location = String(locText);
          r.mapUrl = String(locUrl);

          if (typeof r.name === 'object' && r.name) r.name = r.name.text || r.name.value;
          if (typeof r.category === 'object' && r.category) r.category = r.category.text || r.category.value;
          if (typeof r.signature_menu === 'object' && r.signature_menu) r.signature_menu = r.signature_menu.text || r.signature_menu.value;
          if (typeof r.price === 'object' && r.price) r.price = r.price.text || r.price.value;

          r.name = Util.unescapeTextFromSheet(r.name);
          r.category = Util.unescapeTextFromSheet(r.category);
          r.signature_menu = Util.unescapeTextFromSheet(r.signature_menu);
          r.price = Util.unescapeTextFromSheet(r.price);

          let likeCountVal = (typeof r.like_count === 'object' && r.like_count) ? r.like_count.numberValue || r.like_count.text : r.like_count;
          r.like_count = Number(likeCountVal) || 0;

          let rawCreated = r.created_at || r.createdAt || r.Date || r.date;
          let rawUpdated = r.updated_at || r.updatedAt;

          r.created_at = Util.safeDateIsoString(rawCreated);
          r.updated_at = Util.safeDateIsoString(rawUpdated);

          r.review_count = reviewCountMap[String(r.id)] || 0;

          return r;
        });
      return Util.response(true, restaurants, null);
    } catch (e) {
      return Util.response(false, null, "식당 목록 조회 중 오류: " + e.toString());
    }
  },

  updateRate: function (restaurantId, newRate) {
    this._updateColumn(restaurantId, 'rate', newRate);
  },

  updateReviewCount: function (restaurantId, newCount) {
    this._updateColumn(restaurantId, 'review_count', newCount);
  },

  updateLikeCount: function (restaurantId, newCount) {
    this._updateColumn(restaurantId, 'like_count', newCount);
  },

  updateLikeCountWrapper: function (restaurantId) {
    const rawData = Util.getSheetData('like');
    const count = rawData.filter(r => {
      const enabled = (typeof r.enabled === 'object' && r.enabled) ? r.enabled.text : r.enabled;
      const rId = (typeof r.restaurant_id === 'object' && r.restaurant_id) ? r.restaurant_id.text : r.restaurant_id;
      return String(rId) === String(restaurantId) && (enabled === true || enabled === 'TRUE' || enabled === 'true');
    }).length;

    this.updateLikeCount(restaurantId, count);
  },

  _updateColumn: function (restaurantId, colName, value) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('restaurant');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('id');
    let colIndex = headers.indexOf(colName);

    if (colIndex === -1) {
      const lastCol = sheet.getLastColumn();
      sheet.getRange(1, lastCol + 1).setValue(colName);
      const newHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      colIndex = newHeaders.indexOf(colName);
    }

    if (idIndex === -1 || colIndex === -1) return;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIndex]) === String(restaurantId)) {
        sheet.getRange(i + 1, colIndex + 1).setValue(value);
        const updateIndex = headers.indexOf('updated_at');
        if (updateIndex !== -1) sheet.getRange(i + 1, updateIndex + 1).setValue(new Date());
        break;
      }
    }
  },

  addRestaurant: function (form) {
    try {
      if (!form.name) throw new Error("상호명은 필수입니다.");
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('restaurant');

      const tagString = form.tags && Array.isArray(form.tags) ? form.tags.join(',') : '';
      const preparedTagString = Util.escapeTextForSheet(tagString);

      const newUuid = Util.getUuid();
      const now = new Date();

      let avgPrice = 0;
      let signatureName = '';

      if (form.menus && Array.isArray(form.menus) && form.menus.length > 0) {
        avgPrice = MenuService.calculateAveragePrice(form.menus);
        const sigMenu = form.menus.find(m => m.is_signature === true);
        if (sigMenu) signatureName = sigMenu.name;

        MenuService.updateMenus(newUuid, form.menus);
      }

      const headers = sheet.getDataRange().getValues()[0];
      const headerMap = {};
      headers.forEach((h, i) => headerMap[h] = i);

      const defaultRow = {};
      defaultRow['id'] = newUuid;

      const preparedName = Util.escapeTextForSheet(form.name);
      const preparedCategory = Util.escapeTextForSheet(form.category || '기타');

      defaultRow['name'] = preparedName;
      defaultRow['category'] = preparedCategory;
      defaultRow['tag'] = preparedTagString;
      defaultRow['signature_menu'] = Util.escapeTextForSheet(signatureName);
      defaultRow['price'] = avgPrice;

      defaultRow['rate'] = 0;
      defaultRow['like_count'] = 0;
      defaultRow['review_count'] = 0;
      defaultRow['enabled'] = true;
      defaultRow['created_at'] = now;
      defaultRow['updated_at'] = now;

      const newRow = headers.map(header => defaultRow[header] !== undefined ? defaultRow[header] : '');
      sheet.appendRow(newRow);

      const restaurantDataToReturn = {
        id: newUuid,
        name: Util.unescapeTextFromSheet(preparedName),
        category: Util.unescapeTextFromSheet(preparedCategory),
        tags: form.tags,
        signature_menu: signatureName,
        price: avgPrice,
        location: '',
        mapUrl: '',
        rate: 0,
        like_count: 0,
        review_count: 0,
        enabled: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      return Util.response(true, restaurantDataToReturn, "식당 추가 완료");
    } catch (e) {
      return Util.response(false, null, e.toString());
    }
  },

  updateRestaurant: function (form) {
    try {
      if (!form.id) throw new Error("ID가 없습니다.");
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('restaurant');
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idIndex = headers.indexOf('id');

      let targetRow = -1;
      let targetRowData = null;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIndex]) === String(form.id)) {
          targetRow = i + 1;
          targetRowData = data[i];
          break;
        }
      }
      if (targetRow === -1) throw new Error("식당을 찾을 수 없습니다.");

      const tagString = form.tags && Array.isArray(form.tags) ? form.tags.join(',') : '';
      const preparedTagString = Util.escapeTextForSheet(tagString);
      const now = new Date();

      let avgPrice = 0;
      let signatureName = '';

      if (form.menus) {
        avgPrice = MenuService.updateMenus(form.id, form.menus);
        const sigMenu = form.menus.find(m => m.is_signature === true);
        if (sigMenu) signatureName = sigMenu.name;
      } else {
        const priceIdx = headers.indexOf('price');
        const sigMenuIdx = headers.indexOf('signature_menu');
        avgPrice = Number(targetRowData[priceIdx]) || 0;
        signatureName = String(targetRowData[sigMenuIdx] || '');
      }

      const setVal = (header, val) => {
        const idx = headers.indexOf(header);
        if (idx !== -1) {
          const processedVal = (header === 'name' || header === 'category' || header === 'signature_menu')
            ? Util.escapeTextForSheet(val)
            : val;
          sheet.getRange(targetRow, idx + 1).setValue(processedVal);
        }
      };

      setVal('name', form.name);
      setVal('category', form.category);
      setVal('tag', tagString);
      setVal('signature_menu', signatureName);
      setVal('price', avgPrice);
      setVal('updated_at', now);

      const restaurantDataToReturn = {
        id: String(form.id),
        name: Util.unescapeTextFromSheet(Util.escapeTextForSheet(form.name)),
        category: Util.unescapeTextFromSheet(Util.escapeTextForSheet(form.category)),
        tags: form.tags,
        signature_menu: signatureName,
        price: avgPrice,

        rate: targetRowData[headers.indexOf('rate')] || 0,
        like_count: targetRowData[headers.indexOf('like_count')] || 0,
        review_count: targetRowData[headers.indexOf('review_count')] || 0,

        location: String(targetRowData[headers.indexOf('location')] || ''),
        mapUrl: String(targetRowData[headers.indexOf('mapUrl')] || ''),

        enabled: true,
        created_at: Util.safeDateIsoString(targetRowData[headers.indexOf('created_at')]),
        updated_at: now.toISOString(),
      };

      return Util.response(true, restaurantDataToReturn, "식당 정보 수정 완료");
    } catch (e) {
      return Util.response(false, null, e.toString());
    }
  },

  deleteRestaurant: function (restaurantId) {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('restaurant');
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idIndex = headers.indexOf('id');
      const enabledIndex = headers.indexOf('enabled');

      let targetRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIndex]) === String(restaurantId)) { targetRow = i + 1; break; }
      }
      if (targetRow === -1) throw new Error("식당을 찾을 수 없습니다.");

      sheet.getRange(targetRow, enabledIndex + 1).setValue(false);

      return Util.response(true, null, "식당 삭제 완료");
    } catch (e) {
      return Util.response(false, null, e.toString());
    }
  },

  getRestaurantMenus: function (restaurantId) {
    const menus = MenuService.getMenusByRestaurantId(restaurantId);
    return Util.response(true, menus, null);
  },
};