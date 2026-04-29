/**
 * WebApp 진입점 (HTML 서빙)
 */
function doGet(e) {
  try {
    console.log("▶ [doGet] 웹앱 로딩 시작");
    const webAppUrl = ScriptApp.getService().getUrl();
    const template = HtmlService.createTemplateFromFile('index');
    template.BASE_WEBAPP_URL = webAppUrl;

    const output = template
      .evaluate()
      .setTitle('뉴슐랭 가이드')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

    console.log("✅ [doGet] HTML 템플릿 서빙 완료");
    return output;
  } catch (err) {
    console.error("🔥 [doGet] 로딩 실패", err);
    return HtmlService.createHtmlOutput("웹앱 로딩 중 오류가 발생했습니다: " + err.toString());
  }
}

/**
 * HTML include 헬퍼
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * [공통] API 실행 및 로깅 헬퍼 함수
 * - 모든 API 요청의 진입/성공/실패/에러를 통일된 포맷으로 로깅합니다.
 * * @param {string} apiName - 로그에 찍힐 API 함수명
 * @param {Function} action - 실제 실행할 서비스 로직 함수
 * @param {Object} [params] - 요청 파라미터 (로그용)
 */
function _executeApi(apiName, action, params = null) {
  // 1. 요청 로그 (파라미터가 있으면 JSON 문자열로 변환하여 출력)
  const paramLog = params ? JSON.stringify(params) : 'No Params';
  console.log(`▶ [${apiName}] 요청: ${paramLog}`);

  const startTime = new Date().getTime();

  try {
    // 2. 서비스 로직 실행
    const result = action();
    const duration = new Date().getTime() - startTime;

    // 3. 결과 로그
    if (result && result.success) {
      // 데이터가 너무 클 수 있으므로 성공 여부와 데이터 개수/요약 정보만 로그에 남김
      let dataSummary = 'Data';
      if (Array.isArray(result.data)) {
        dataSummary = `Array(${result.data.length})`;
      } else if (typeof result.data === 'object' && result.data !== null) {
        dataSummary = 'Object';
      }
      console.log(`✅ [${apiName}] 성공 (${duration}ms): ${dataSummary}`);
    } else {
      // 로직 실패 (예: 유효성 검사 실패 등)
      console.warn(`❌ [${apiName}] 실패 (${duration}ms): ${result ? result.message : 'No Response'}`);
      if (result) console.warn(`   └ 상세: ${JSON.stringify(result)}`);
    }

    return result;

  } catch (err) {
    // 4. 시스템 에러 로그 (예외 발생)
    const duration = new Date().getTime() - startTime;
    console.error(`🔥 [${apiName}] 에러 (${duration}ms): ${err.toString()}`);
    console.error(err.stack); // 스택 트레이스 출력

    // Config.gs 파일에 Util이 정의되어 있지 않으므로 임시로 직접 응답 객체 생성
    // (실제 코드에서는 Util.response를 사용해야 함)
    return { success: false, data: null, message: `시스템 오류: ${err.toString()}` };
  }
}

// ==========================================
// Admin API
// ==========================================

function apiGetAdminEmails() {
  return _executeApi('apiGetAdminEmails', () => AdminService.getAdminEmails());
}

function apiSaveAdminEmails(emails) {
  return _executeApi('apiSaveAdminEmails', () => AdminService.saveAdminEmails(emails), { emails });
}

function apiGetGuests() {
  return _executeApi('apiGetGuests', () => AdminService.getGuests());
}

function apiAddGuest(guest) {
  return _executeApi('apiAddGuest', () => AdminService.addGuest(guest), { guest });
}

function apiDeleteGuest(email) {
  return _executeApi('apiDeleteGuest', () => AdminService.deleteGuest(email), { email });
}

// ==========================================
// User & Auth API
// ==========================================

function apiGetCurrentUser() {
  return _executeApi('apiGetCurrentUser', () => UserService.getCurrentUser());
}

function apiGetAllUsers() {
  return _executeApi('apiGetAllUsers', () => UserService.getAllUsers());
}

// ==========================================
// Restaurant API
// ==========================================

function apiGetRestaurants() {
  return _executeApi('apiGetRestaurants', () => RestaurantService.getAllRestaurants());
}

function apiAddRestaurant(form) {
  return _executeApi('apiAddRestaurant', () => RestaurantService.addRestaurant(form), form);
}

function apiUpdateRestaurant(form) {
  return _executeApi('apiUpdateRestaurant', () => RestaurantService.updateRestaurant(form), form);
}

function apiDeleteRestaurant(id) {
  return _executeApi('apiDeleteRestaurant', () => RestaurantService.deleteRestaurant(id), { id });
}

function apiGetRestaurantMenus(restaurantId) {
  return _executeApi('apiGetRestaurantMenus', () => RestaurantService.getRestaurantMenus(restaurantId), { restaurantId });
}


// ==========================================
// Menu API
// ==========================================

function apiGetAllMenus() {
  return _executeApi('apiGetAllMenus', () => MenuService.getAllMenus());
}

// ==========================================
// Review API
// ==========================================

function apiGetAllReviews() {
  return _executeApi('apiGetAllReviews', () => ReviewService.getAllReviews());
}

function apiAddReview(form) {
  return _executeApi('apiAddReview', () => ReviewService.addReview(form), form);
}

function apiUpdateReview(form) {
  return _executeApi('apiUpdateReview', () => ReviewService.updateReview(form), form);
}

function apiDeleteReview(id) {
  return _executeApi('apiDeleteReview', () => ReviewService.deleteReview(id), { id });
}

// ==========================================
// Like (찜하기) API
// ==========================================

function apiGetUserLikes() {
  return _executeApi('apiGetUserLikes', () => LikeService.getUserLikes());
}

function apiToggleLike(id) {
  return _executeApi('apiToggleLike', () => LikeService.toggleLike(id), { id });
}