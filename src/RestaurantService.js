const RestaurantService = {
  getAllRestaurants: function () {
    try {
      const rawData = Util.getSheetData('restaurant');

      // [수정] 리뷰 정보와 개수 맵을 가져옴
      const reviewsRes = ReviewService.getAllReviews();
      const reviewCountMap = reviewsRes.success ? reviewsRes.data.reviewCountMap : {};

      const restaurants = rawData
        .filter(r => {
          const enabledVal = (typeof r.enabled === 'object' && r.enabled) ? r.enabled.text : r.enabled;
          return enabledVal === true || enabledVal === 'TRUE' || enabledVal === 'true';
        })
        .map(r => {
          let tagVal = (typeof r.tag === 'object' && r.tag) ? r.tag.text : r.tag;
          // [핵심 변경] 불러온 데이터에 unescape 적용
          tagVal = Util.unescapeTextFromSheet(tagVal);
          r.tags = tagVal ? String(tagVal).split(',').map(t => t.trim()) : [];

          let locText = '', locUrl = '';
          if (typeof r.location === 'object' && r.location !== null) {
            locText = r.location.text || '';
            locUrl = r.location.url || '';
          } else {
            locText = String(r.location || '');
          }
          r.location = locText;
          r.mapUrl = locUrl;

          if (typeof r.name === 'object' && r.name) r.name = r.name.text || r.name.value;
          if (typeof r.category === 'object' && r.category) r.category = r.category.text || r.category.value;
          if (typeof r.signature_menu === 'object' && r.signature_menu) r.signature_menu = r.signature_menu.text || r.signature_menu.value;
          if (typeof r.price === 'object' && r.price) r.price = r.price.text || r.price.value;

          // [핵심 변경] 불러온 데이터에 unescape 적용
          r.name = Util.unescapeTextFromSheet(r.name);
          r.category = Util.unescapeTextFromSheet(r.category);
          r.signature_menu = Util.unescapeTextFromSheet(r.signature_menu);
          r.price = Util.unescapeTextFromSheet(r.price);

          // [NEW] like_count 처리 (없으면 0)
          let likeCountVal = (typeof r.like_count === 'object' && r.like_count) ? r.like_count.numberValue || r.like_count.text : r.like_count;
          r.like_count = Number(likeCountVal) || 0;

          let rawCreated = r.created_at || r.createdAt || r.Date || r.date;
          let rawUpdated = r.updated_at || r.updatedAt;

          r.created_at = this.safeDateIsoString(rawCreated);
          r.updated_at = this.safeDateIsoString(rawUpdated);

          // [NEW] 리뷰 개수 추가
          r.reviewCount = reviewCountMap[String(r.id)] || 0; // 프론트와 필드명 맞춤
          r.review_count = r.reviewCount; // 내부적으로도 일관성 유지

          return r;
        });
      return Util.response(true, restaurants, null);
    } catch (e) {
      return Util.response(false, null, "식당 목록 조회 중 오류: " + e.toString());
    }
  },

  safeDateIsoString: function (val) {
    if (!val) return new Date().toISOString();
    try {
      if (val instanceof Date) return val.toISOString();
      const numericVal = Number(val);
      if (!isNaN(numericVal) && numericVal > 25569) {
        const sheetDate = new Date((numericVal - 25569) * 86400 * 1000);
        return sheetDate.toISOString();
      }
      const d = new Date(val);
      if (isNaN(d.getTime())) return new Date().toISOString();
      return d.toISOString();
    } catch (e) {
      return new Date().toISOString();
    }
  },

  updateRate: function (restaurantId, newRate) {
    this._updateColumn(restaurantId, 'rate', newRate);
  },
  
  updateReviewCount: function (restaurantId, newCount) {
    this._updateColumn(restaurantId, 'reviewCount', newCount);
  },
  
  // [NEW] 좋아요 수 업데이트 함수 (LikeService에서 count를 직접 전달받아 업데이트)
  updateLikeCount: function (restaurantId, newCount) {
    this._updateColumn(restaurantId, 'like_count', newCount);
  },
  
  // [래퍼 함수] 좋아요 수를 Like 시트에서 직접 계산 후, 위 updateLikeCount 호출
  updateLikeCountWrapper: function (restaurantId) {
    const rawData = Util.getSheetData('like');
    const count = rawData.filter(r => {
      const enabled = (typeof r.enabled === 'object' && r.enabled) ? r.enabled.text : r.enabled;
      const rId = (typeof r.restaurant_id === 'object' && r.restaurant_id) ? r.restaurant_id.text : r.restaurant_id;
      return String(rId) === String(restaurantId) && (enabled === true || enabled === 'TRUE' || enabled === 'true');
    }).length;

    this.updateLikeCount(restaurantId, count);
  },

  // [내부 전용 함수] 실제 시트 업데이트 로직
  _updateColumn: function (restaurantId, colName, value) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('restaurant');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('id');
    let colIndex = headers.indexOf(colName);

    // 컬럼이 없으면 헤더를 추가 (like_count, reviewCount 등)
    if (colIndex === -1) {
      const lastCol = sheet.getLastColumn();
      sheet.getRange(1, lastCol + 1).setValue(colName);
      // 헤더 업데이트 후 인덱스 재설정
      const newHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      colIndex = newHeaders.indexOf(colName);
    }

    if (idIndex === -1 || colIndex === -1) return;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIndex]) === String(restaurantId)) {
        sheet.getRange(i + 1, colIndex + 1).setValue(value);

        // updated_at 갱신
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

      const headers = sheet.getDataRange().getValues()[0];
      const headerMap = {};
      headers.forEach((h, i) => headerMap[h] = i);
      
      const defaultRow = {};
      defaultRow['id'] = newUuid;
      
      const preparedName = Util.escapeTextForSheet(form.name);
      const preparedCategory = Util.escapeTextForSheet(form.category || '기타');
      const preparedSignatureMenu = Util.escapeTextForSheet(form.signature_menu || '');
      const preparedPrice = Util.escapeTextForSheet(form.price || '');

      defaultRow['name'] = preparedName;
      defaultRow['category'] = preparedCategory;
      defaultRow['tag'] = preparedTagString;
      defaultRow['signature_menu'] = preparedSignatureMenu;
      defaultRow['price'] = preparedPrice;
      
      defaultRow['rate'] = 0; 
      defaultRow['like_count'] = 0; 
      defaultRow['reviewCount'] = 0; 
      defaultRow['enabled'] = true;
      defaultRow['created_at'] = now;
      defaultRow['updated_at'] = now;

      const newRow = headers.map(header => defaultRow[header] !== undefined ? defaultRow[header] : '');
      
      sheet.appendRow(newRow);
      
      // [수정] 새로 생성된 식당 객체 전체를 반환
      const restaurantDataToReturn = {
        id: newUuid,
        name: Util.unescapeTextFromSheet(preparedName),
        category: Util.unescapeTextFromSheet(preparedCategory),
        tags: form.tags, // 배열 형태로 반환
        signature_menu: Util.unescapeTextFromSheet(preparedSignatureMenu),
        price: Util.unescapeTextFromSheet(preparedPrice),
        location: '', // 위치 정보는 로컬에서 알 수 없음
        mapUrl: '',
        rate: 0,
        like_count: 0,
        reviewCount: 0,
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
      let targetRowData = null; // 기존 데이터를 가져오기 위해
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

      const setVal = (header, val) => {
        const idx = headers.indexOf(header);
        if (idx !== -1) {
          if (header === 'name' || header === 'category' || header === 'signature_menu' || header === 'price') {
             sheet.getRange(targetRow, idx + 1).setValue(Util.escapeTextForSheet(val));
          } else if (header === 'tag') {
             sheet.getRange(targetRow, idx + 1).setValue(preparedTagString);
          } else {
             sheet.getRange(targetRow, idx + 1).setValue(val);
          }
        }
      };

      setVal('name', form.name);
      setVal('category', form.category);
      setVal('tag', tagString);
      setVal('signature_menu', form.signature_menu);
      setVal('price', form.price);
      setVal('updated_at', now);
      
      // [수정] 수정된 식당 객체 전체를 반환
      const restaurantDataToReturn = {
        id: String(form.id),
        name: Util.unescapeTextFromSheet(Util.escapeTextForSheet(form.name)),
        category: Util.unescapeTextFromSheet(Util.escapeTextForSheet(form.category)),
        tags: form.tags, // 배열 형태로 반환
        signature_menu: Util.unescapeTextFromSheet(Util.escapeTextForSheet(form.signature_menu)),
        price: Util.unescapeTextFromSheet(Util.escapeTextForSheet(form.price)),
        
        // 기존 데이터에서 동적 필드 및 위치 정보 가져오기
        rate: targetRowData[headers.indexOf('rate')] || 0, 
        like_count: targetRowData[headers.indexOf('like_count')] || 0,
        reviewCount: targetRowData[headers.indexOf('reviewCount')] || 0,
        location: targetRowData[headers.indexOf('location')] || '',
        mapUrl: targetRowData[headers.indexOf('mapUrl')] || '',
        
        enabled: true,
        created_at: targetRowData[headers.indexOf('created_at')]?.toISOString() || now.toISOString(),
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
      
      // [수정] 삭제 성공 시 null 반환 (ID는 클라이언트가 이미 알고 있음)
      return Util.response(true, null, "식당 삭제 완료");
    } catch (e) {
      return Util.response(false, null, e.toString());
    }
  }
};