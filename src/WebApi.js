/**
 * Web app entry point (serves the HTML).
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
 * HTML include helper.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Runs an API action with unified request/success/failure/error logging.
 * @param {string} apiName - API function name used in logs
 * @param {Function} action - service logic to execute
 * @param {Object} [params] - request parameters (logging only)
 */
function _executeApi(apiName, action, params = null) {
  const paramLog = params ? JSON.stringify(params) : 'No Params';
  console.log(`▶ [${apiName}] 요청: ${paramLog}`);

  const startTime = new Date().getTime();

  try {
    const result = action();
    const duration = new Date().getTime() - startTime;

    if (result && result.success) {
      // Log only a summary; full payloads can be too large
      let dataSummary = 'Data';
      if (Array.isArray(result.data)) {
        dataSummary = `Array(${result.data.length})`;
      } else if (typeof result.data === 'object' && result.data !== null) {
        dataSummary = 'Object';
      }
      console.log(`✅ [${apiName}] 성공 (${duration}ms): ${dataSummary}`);
    } else {
      console.warn(`❌ [${apiName}] 실패 (${duration}ms): ${result ? result.message : 'No Response'}`);
      if (result) console.warn(`   └ 상세: ${JSON.stringify(result)}`);
    }

    return result;

  } catch (err) {
    const duration = new Date().getTime() - startTime;
    console.error(`🔥 [${apiName}] 에러 (${duration}ms): ${err.toString()}`);
    console.error(err.stack);

    // Response built inline instead of via Util.response in case Util is not loaded
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

function apiGetExcludedEmails() {
  return _executeApi('apiGetExcludedEmails', () => AdminService.getExcludedEmails());
}

function apiSaveExcludedEmails(emails) {
  return _executeApi('apiSaveExcludedEmails', () => AdminService.saveExcludedEmails(emails), { emails });
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
// Tutorial API
// ==========================================

function apiGetMyTutorials() {
  return _executeApi('apiGetMyTutorials', () => TutorialService.getMyDismissed());
}

function apiDismissTutorial(feature) {
  return _executeApi('apiDismissTutorial', () => TutorialService.dismiss(feature), feature);
}

// ==========================================
// Hall of Fame API
// ==========================================

function apiGetHallOfFame() {
  return _executeApi('apiGetHallOfFame', () => HallOfFameService.getHallOfFameData());
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
// Like API
// ==========================================

function apiGetUserLikes() {
  return _executeApi('apiGetUserLikes', () => LikeService.getUserLikes());
}

function apiToggleLike(id) {
  return _executeApi('apiToggleLike', () => LikeService.toggleLike(id), { id });
}