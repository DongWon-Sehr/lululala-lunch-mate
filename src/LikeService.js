const LikeService = {
  // 사용자가 좋아요 누른 식당 ID 목록 조회
  getUserLikes: function () {
    try {
      const userEmail = Session.getActiveUser().getEmail();
      if (!userEmail) return Util.response(true, [], "이메일 정보 없음");

      const rawData = Util.getSheetData('like');
      const myLikes = rawData
        .filter(r => {
          const enabledVal = (typeof r.enabled === 'object' && r.enabled) ? r.enabled.text : r.enabled;
          const isEnabled = enabledVal === true || enabledVal === 'TRUE' || enabledVal === 'true';
          const rEmail = (typeof r.user_email === 'object' && r.user_email) ? r.user_email.text : r.user_email;
          return String(rEmail) === String(userEmail) && isEnabled;
        })
        .map(r => String((typeof r.restaurant_id === 'object' && r.restaurant_id) ? r.restaurant_id.text : r.restaurant_id));

      return Util.response(true, myLikes, null);
    } catch (e) {
      return Util.response(false, [], e.toString());
    }
  },

  // 좋아요 토글 (ON/OFF)
  toggleLike: function (restaurantId) {
    try {
      const userEmail = Session.getActiveUser().getEmail();
      if (!userEmail) throw new Error("로그인이 필요합니다.");

      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('like');
      
      const data = sheet.getDataRange().getValues();
      // 데이터가 없으면 헤더 생성 (첫 실행 시)
      if (data.length === 0) {
        sheet.appendRow(['id', 'restaurant_id', 'user_email', 'enabled', 'created_at', 'updated_at']);
      }

      // 다시 데이터 로드 (헤더 포함)
      const freshData = sheet.getDataRange().getValues();
      const headers = freshData[0];
      const restIdIdx = headers.indexOf('restaurant_id');
      const emailIdx = headers.indexOf('user_email');
      const enabledIdx = headers.indexOf('enabled');
      const updatedIdx = headers.indexOf('updated_at');

      let targetRow = -1;
      let currentStatus = false;

      // 기존 좋아요 기록 찾기
      for (let i = 1; i < freshData.length; i++) {
        if (String(freshData[i][restIdIdx]) === String(restaurantId) &&
          String(freshData[i][emailIdx]) === String(userEmail)) {
          targetRow = i + 1;
          currentStatus = freshData[i][enabledIdx] === true || freshData[i][enabledIdx] === 'TRUE';
          break;
        }
      }

      const newStatus = !currentStatus;

      if (targetRow !== -1) {
        // 기존 기록 업데이트
        sheet.getRange(targetRow, enabledIdx + 1).setValue(newStatus);
        sheet.getRange(targetRow, updatedIdx + 1).setValue(new Date());
      } else {
        // 신규 생성
        if (newStatus) { // true로 켜는 경우만 생성
          sheet.appendRow([
            Util.getUuid(), restaurantId, userEmail, true, new Date(), new Date()
          ]);
        }
      }

      // [수정] Restaurant 테이블의 like_count 업데이트 요청을 RestaurantService에 위임
      RestaurantService.updateLikeCountWrapper(restaurantId);

      return Util.response(true, { liked: newStatus }, newStatus ? "찜했습니다." : "찜을 해제했습니다.");

    } catch (e) {
      return Util.response(false, null, e.toString());
    }
  },

  // 식당의 총 좋아요 수 계산 및 Restaurant 시트 업데이트
  updateRestaurantLikeCount: function (restaurantId) {
    const rawData = Util.getSheetData('like');
    const count = rawData.filter(r => {
      const enabled = (typeof r.enabled === 'object' && r.enabled) ? r.enabled.text : r.enabled;
      const rId = (typeof r.restaurant_id === 'object' && r.restaurant_id) ? r.restaurant_id.text : r.restaurant_id;
      return String(rId) === String(restaurantId) && (enabled === true || enabled === 'TRUE' || enabled === 'true');
    }).length;

    // [수정] 이제 RestaurantService에 구현된 함수를 호출합니다.
    RestaurantService.updateLikeCount(restaurantId, count); 
  }
};