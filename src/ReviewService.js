const ReviewService = {
  getAllReviews: function () {
    try {
      const rawData = Util.getSheetData('review');

      const reviewCountMap = {};

      const reviews = rawData
        .filter(r => {
          const enabledVal = (typeof r.enabled === 'object' && r.enabled) ? r.enabled.text : r.enabled;
          return enabledVal === true || enabledVal === 'TRUE' || enabledVal === 'true';
        })
        .map(r => {
          // Dates may arrive as {value, text} objects; unwrap before conversion
          let rawCreated = r.created_at;
          let rawUpdated = r.updated_at;

          if (typeof rawCreated === 'object' && rawCreated !== null && !(rawCreated instanceof Date)) {
            rawCreated = rawCreated.value || rawCreated.text;
          }
          if (typeof rawUpdated === 'object' && rawUpdated !== null && !(rawUpdated instanceof Date)) {
            rawUpdated = rawUpdated.value || rawUpdated.text;
          }

          r.created_at = Util.safeDateIsoString(rawCreated);
          r.updated_at = Util.safeDateIsoString(rawUpdated);

          if (typeof r.user_email === 'object' && r.user_email) r.user_email = r.user_email.text || r.user_email.value;
          if (typeof r.comment === 'object' && r.comment) r.comment = r.comment.text || r.comment.value;
          if (typeof r.user_name === 'object' && r.user_name) r.user_name = r.user_name.text || r.user_name.value;

          r.comment = Util.unescapeTextFromSheet(r.comment);
          r.user_name = Util.unescapeTextFromSheet(r.user_name);

          r.user_email = r.user_email ? String(r.user_email) : '';

          const rId = String(r.restaurant_id);
          reviewCountMap[rId] = (reviewCountMap[rId] || 0) + 1;

          return r;
        })
        .sort((a, b) => {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          if (timeA !== timeB) return timeB - timeA;
          return 0;
        });

      return Util.response(true, { reviews: reviews, reviewCountMap: reviewCountMap }, null);
    } catch (e) {
      return Util.response(false, null, e.toString());
    }
  },


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

      const newId = Util.getUuid();
      const preparedComment = Util.escapeTextForSheet(form.comment);
      const preparedUserName = Util.escapeTextForSheet(form.user_name);
      const now = new Date();

      const newRow = [
        newId, form.restaurant_id, parseInt(form.rate), preparedComment,
        preparedUserName, currentUserEmail, true, now, now
      ];

      sheet.appendRow(newRow);
      this.recalculateRestaurantRate(form.restaurant_id);

      const reviewDataToReturn = {
        id: newId,
        restaurant_id: String(form.restaurant_id),
        rate: parseInt(form.rate),
        comment: Util.unescapeTextFromSheet(preparedComment), // unescape so the client receives the restored text
        user_name: Util.unescapeTextFromSheet(preparedUserName),
        user_email: currentUserEmail,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      return Util.response(true, reviewDataToReturn, "리뷰 등록 완료");
    } catch (e) {
      return Util.response(false, null, e.toString());
    }
  },

  /**
   * Check whether the given email belongs to an admin.
   * getAdminEmails() returns the standard response object, so compare against its data array.
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
   * Update a review.
   * Permission: only the author may edit — admins get no exception.
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
          // No admin exception for edits: only the author may modify
          if (String(data[i][emailIndex]) !== String(currentUserEmail)) {
            throw new Error("권한 없음: 본인이 작성한 리뷰만 수정할 수 있습니다.");
          }

          targetRowIndex = i + 1;
          restaurantId = data[i][restaurantIdIndex];
          break;
        }
      }

      if (targetRowIndex === -1) throw new Error("리뷰 없음");

      const preparedComment = Util.escapeTextForSheet(form.comment);

      const now = new Date();

      // user_name is not part of the edit form, so the existing value is kept
      sheet.getRange(targetRowIndex, rateIndex + 1).setValue(parseInt(form.rate));
      sheet.getRange(targetRowIndex, commentIndex + 1).setValue(preparedComment);
      sheet.getRange(targetRowIndex, updatedAtIndex + 1).setValue(now);

      if (restaurantId) this.recalculateRestaurantRate(restaurantId);

      // Return only the fields the client needs to update its state
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
   * Soft-delete a review.
   * Permission: authors may delete their own reviews; admins may delete any.
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