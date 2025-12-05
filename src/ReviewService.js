const ReviewService = {
  getAllReviews: function () {
    try {
      const rawData = Util.getSheetData('review');

      // [NEW] 리뷰 개수 카운트 및 임시 저장용 맵
      const reviewCountMap = {};

      const reviews = rawData
        .filter(r => {
          const enabledVal = (typeof r.enabled === 'object' && r.enabled) ? r.enabled.text : r.enabled;
          return enabledVal === true || enabledVal === 'TRUE' || enabledVal === 'true';
        })
        .map(r => {
          // [수정 1] 날짜 데이터도 객체({value:..., text:...})일 수 있으므로 먼저 풀어줌
          let rawCreated = r.created_at;
          let rawUpdated = r.updated_at;

          if (typeof rawCreated === 'object' && rawCreated !== null && !(rawCreated instanceof Date)) {
            rawCreated = rawCreated.value || rawCreated.text;
          }
          if (typeof rawUpdated === 'object' && rawUpdated !== null && !(rawUpdated instanceof Date)) {
            rawUpdated = rawUpdated.value || rawUpdated.text;
          }

          // [수정 2] 안전한 변환 함수 호출
          r.created_at = this.safeDateIsoString(rawCreated);
          r.updated_at = this.safeDateIsoString(rawUpdated);

          // 객체 필드 처리
          if (typeof r.user_email === 'object' && r.user_email) r.user_email = r.user_email.text || r.user_email.value;
          if (typeof r.comment === 'object' && r.comment) r.comment = r.comment.text || r.comment.value;
          if (typeof r.user_name === 'object' && r.user_name) r.user_name = r.user_name.text || r.user_name.value;

          // [핵심 변경] 불러온 코멘트 복원 로직 적용 -> Util 호출
          r.comment = Util.unescapeTextFromSheet(r.comment);
          // [추가 변경] 불러온 유저 이름 복원 로직 적용 -> Util 호출
          r.user_name = Util.unescapeTextFromSheet(r.user_name);

          r.user_email = r.user_email ? String(r.user_email) : '';

          // [NEW] 리뷰 개수 카운트
          const rId = String(r.restaurant_id);
          reviewCountMap[rId] = (reviewCountMap[rId] || 0) + 1;

          return r;
        })
        // 서버측 1차 정렬 (날짜 -> ID)
        .sort((a, b) => {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          if (timeA !== timeB) return timeB - timeA;
          return 0;
        });

      // [수정] 리뷰 데이터와 리뷰 개수 맵을 함께 반환
      return Util.response(true, { reviews: reviews, reviewCountMap: reviewCountMap }, null);
    } catch (e) {
      return Util.response(false, null, e.toString());
    }
  },

  // [수정 3] 에러 시 '현재 시간'이 아닌 'null' 반환으로 변경 (정렬 왜곡 방지)
  safeDateIsoString: function (val) {
    if (!val) return null; // 값이 없으면 null
    try {
      // 구글 시트 날짜 포맷(숫자) 처리
      if (typeof val === 'number') {
        const sheetDate = new Date((val - 25569) * 86400 * 1000);
        return sheetDate.toISOString();
      }
      // 일반 날짜 처리
      const d = new Date(val);
      // 유효하지 않은 날짜(Invalid Date)면 null 반환
      if (isNaN(d.getTime())) return null;

      return d.toISOString();
    } catch (e) {
      return null; // 에러 발생 시 null
    }
  },

  // [수정] 특정 식당 리뷰만 필터링하여 반환
  getReviewsByRestaurant: function (restaurantId) {
    const allReviewsRes = this.getAllReviews();
    if (!allReviewsRes.success) return allReviewsRes;

    const allReviews = allReviewsRes.data.reviews;
    const targetReviews = allReviews.filter(r => String(r.restaurant_id) === String(restaurantId));

    return Util.response(true, targetReviews, null);
  },

  addReview: function (form) {
    try {
      if (!form.rate || isNaN(form.rate) || form.rate < 1 || form.rate > 5) throw new Error("별점 오류");
      if (!form.restaurant_id || !form.user_name || !form.comment) throw new Error("필수 정보 누락");

      const currentUserEmail = Session.getActiveUser().getEmail();
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('review');

      const newId = Util.getUuid(); // [추가] ID를 미리 생성
      const preparedComment = Util.escapeTextForSheet(form.comment);
      const preparedUserName = Util.escapeTextForSheet(form.user_name);
      const now = new Date(); // [추가] 현재 시간 캡처

      const newRow = [
        newId, form.restaurant_id, parseInt(form.rate), preparedComment, // newId 사용
        preparedUserName, currentUserEmail, true, now, now
      ];

      sheet.appendRow(newRow);
      this.recalculateRestaurantRate(form.restaurant_id);

      // [수정] 성공 시, 새로 등록된 리뷰의 핵심 정보를 객체로 구성하여 반환
      const reviewDataToReturn = {
        id: newId,
        restaurant_id: String(form.restaurant_id),
        rate: parseInt(form.rate),
        comment: Util.unescapeTextFromSheet(preparedComment), // 클라이언트가 복원된 텍스트를 사용하도록 unescape
        user_name: Util.unescapeTextFromSheet(preparedUserName),
        user_email: currentUserEmail,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        // enabled: true (기본값)
      };

      return Util.response(true, reviewDataToReturn, "리뷰 등록 완료");
    } catch (e) {
      return Util.response(false, null, e.toString());
    }
  },

  updateReview: function (form) {
    try {
      if (!form.id) throw new Error("리뷰 ID 없음");

      // ... (데이터 및 인덱스 찾기 로직 생략) ...

      if (targetRowIndex === -1) throw new Error("리뷰 없음");

      // [핵심 변경] 코멘트 저장 전 처리 로직 적용 -> Util 호출 (escape로 변경)
      const preparedComment = Util.escapeTextForSheet(form.comment);
      // [추가 변경] 유저 이름은 수정 폼에 없으므로 기존 값 사용 또는 가정
      // 이 예시에서는 form에 user_name이 없다고 가정하고, preparedUserName 정의 로직은 제거합니다.

      const now = new Date(); // [추가] 현재 시간 캡처

      // 시트에 값 설정
      sheet.getRange(targetRowIndex, rateIndex + 1).setValue(parseInt(form.rate));
      sheet.getRange(targetRowIndex, commentIndex + 1).setValue(preparedComment);
      // user_name은 수정되지 않으므로, 이 라인은 주석 처리하거나 해당 로직을 생략합니다.
      // sheet.getRange(targetRowIndex, userNameIndex + 1).setValue(preparedUserName);
      sheet.getRange(targetRowIndex, updatedAtIndex + 1).setValue(now);

      if (restaurantId) this.recalculateRestaurantRate(restaurantId);

      // [수정] 수정된 리뷰의 핵심 정보를 객체로 구성하여 반환
      // (Vue가 상태를 업데이트하는 데 필요한 필드만 포함)
      // user_name과 user_email은 data[targetRowIndex - 1]에서 기존 값을 가져와야 정확함
      const reviewDataToReturn = {
        id: String(form.id),
        restaurant_id: String(restaurantId),
        rate: parseInt(form.rate),
        comment: Util.unescapeTextFromSheet(preparedComment),
        user_name: String(data[targetRowIndex - 1][userNameIndex]),
        user_email: String(data[targetRowIndex - 1][emailIndex]),
        updated_at: now.toISOString(),
      };

      return Util.response(true, reviewDataToReturn, "리뷰 수정 완료");
    } catch (e) {
      return Util.response(false, null, e.toString());
    }
  },

  deleteReview: function (reviewId) {
    try {
      const currentUserEmail = Session.getActiveUser().getEmail();
      const isAdmin = Config.ADMIN_EMAILS.includes(currentUserEmail);

      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('review');
      const data = sheet.getDataRange().getValues();
      const headers = data[0];

      const idIndex = headers.indexOf('id');
      const emailIndex = headers.indexOf('user_email');
      const enabledIndex = headers.indexOf('enabled');
      const restaurantIdIndex = headers.indexOf('restaurant_id');

      let targetRowIndex = -1;
      let restaurantId = null;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIndex]) === String(reviewId)) {
          const reviewOwnerEmail = data[i][emailIndex];
          if (!isAdmin && reviewOwnerEmail !== currentUserEmail) throw new Error("권한 없음");

          targetRowIndex = i + 1;
          restaurantId = data[i][restaurantIdIndex];
          break;
        }
      }

      if (targetRowIndex === -1) throw new Error("리뷰 없음");
      sheet.getRange(targetRowIndex, enabledIndex + 1).setValue(false);
      if (restaurantId) this.recalculateRestaurantRate(restaurantId);

      return Util.response(true, null, "삭제됨");
    } catch (e) {
      return Util.response(false, null, e.toString());
    }
  },

  recalculateRestaurantRate: function (restaurantId) {
    const rawData = Util.getSheetData('review');
    const targetReviews = rawData.filter(r =>
      String(r.restaurant_id) === String(restaurantId) && (r.enabled === true || r.enabled === 'TRUE')
    );

    // [NEW] 리뷰 개수 업데이트
    const count = targetReviews.length;
    RestaurantService.updateReviewCount(restaurantId, count);

    if (count === 0) {
      RestaurantService.updateRate(restaurantId, 0);
      return;
    }
    const sum = targetReviews.reduce((acc, curr) => {
      let rate = curr.rate;
      if (typeof rate === 'object') rate = rate.numberValue || rate.text;
      return acc + Number(rate);
    }, 0);
    const avg = parseFloat((sum / count).toFixed(1));
    RestaurantService.updateRate(restaurantId, avg);
  }
};