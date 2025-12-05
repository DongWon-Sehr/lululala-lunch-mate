function doGet(e) {
  const webAppUrl = ScriptApp.getService().getUrl();
  const template = HtmlService.createTemplateFromFile('index');
  template.BASE_WEBAPP_URL = webAppUrl;
  return template
    .evaluate()
    .setTitle('뉴슐랭 가이드')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function apiGetCurrentUser() {
  const email = Session.getActiveUser().getEmail();
  const isAdmin = Config.ADMIN_EMAILS.includes(email);
  return Util.response(true, { email: email, isAdmin: isAdmin }, null);
}

function apiGetRestaurants() { return RestaurantService.getAllRestaurants(); }
function apiGetAllReviews() { return ReviewService.getAllReviews(); }
function apiAddReview(form) { return ReviewService.addReview(form); }
function apiUpdateReview(form) { return ReviewService.updateReview(form); }
function apiDeleteReview(id) { return ReviewService.deleteReview(id); }
function apiAddRestaurant(form) { return RestaurantService.addRestaurant(form); }
function apiUpdateRestaurant(form) { return RestaurantService.updateRestaurant(form); }
function apiDeleteRestaurant(id) { return RestaurantService.deleteRestaurant(id); }

// [NEW] 좋아요 관련 API
function apiGetUserLikes() { return LikeService.getUserLikes(); }
function apiToggleLike(id) { return LikeService.toggleLike(id); }