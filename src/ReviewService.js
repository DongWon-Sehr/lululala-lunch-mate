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
          r.created_at = Util.safeDateIsoString(rawCreated);
          r.updated_at = Util.safeDateIsoString(rawUpdated);

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

  /**
   * 현재 접속자가 어드민인지 확인
   * - getAdminEmails()는 표준 응답 객체를 반환하므로 data 배열을 꺼내서 비교해야 함
   */
  _isAdmin: function (email) {
    try {
      const adminEmails = AdminService.getAdminEmails().data || [];
      return adminEmails.includes(email);
    } catch (e) {
      console.warn('관리자 목록 조회 실패:', e);
      return false;
    }
  },

  /**
   * 리뷰 수정
   * - 권한: 어드민 여부와 무관하게 '본인이 작성한 리뷰'만 수정 가능
   */
  updateReview: function (form) {
    try {
      if (!form.id) throw new Error("리뷰 ID 없음");
      if (!form.rate || isNaN(form.rate) || form.rate < 1 || form.rate > 5) throw new Error("별점 오류");
      if (!form.comment) throw new Error("코멘트 누락");

      const currentUserEmail = Session.getActiveUser().getEmail();

      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('review');
      const data = sheet.getDataRange().getValues();
      const headers = data[0];

      const idIndex = headers.indexOf('id');
      const rateIndex = headers.indexOf('rate');
      const commentIndex = headers.indexOf('comment');
      const userNameIndex = headers.indexOf('user_name');
      const emailIndex = headers.indexOf('user_email');
      const restaurantIdIndex = headers.indexOf('restaurant_id');
      const updatedAtIndex = headers.indexOf('updated_at');

      let targetRowIndex = -1;
      let restaurantId = null;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIndex]) === String(form.id)) {
          // 수정은 어드민에게도 예외를 두지 않음 (본인 리뷰만)
          if (String(data[i][emailIndex]) !== String(currentUserEmail)) {
            throw new Error("권한 없음: 본인이 작성한 리뷰만 수정할 수 있습니다.");
          }

          targetRowIndex = i + 1;
          restaurantId = data[i][restaurantIdIndex];
          break;
        }
      }

      if (targetRowIndex === -1) throw new Error("리뷰 없음");

      // [핵심 변경] 코멘트 저장 전 처리 로직 적용 -> Util 호출 (escape로 변경)
      const preparedComment = Util.escapeTextForSheet(form.comment);

      const now = new Date(); // [추가] 현재 시간 캡처

      // 시트에 값 설정 (user_name은 수정 폼에 없으므로 기존 값 유지)
      sheet.getRange(targetRowIndex, rateIndex + 1).setValue(parseInt(form.rate));
      sheet.getRange(targetRowIndex, commentIndex + 1).setValue(preparedComment);
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

  /**
   * 리뷰 삭제 (Soft Delete)
   * - 권한: 본인이 작성한 리뷰, 어드민은 모든 리뷰 삭제 가능
   */
  deleteReview: function (reviewId) {
    try {
      const currentUserEmail = Session.getActiveUser().getEmail();
      const isAdmin = this._isAdmin(currentUserEmail);

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
          const reviewOwnerEmail = String(data[i][emailIndex]);
          if (!isAdmin && reviewOwnerEmail !== String(currentUserEmail)) {
            throw new Error("권한 없음: 본인이 작성한 리뷰만 삭제할 수 있습니다.");
          }

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