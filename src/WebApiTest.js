/**
 * Tests for WebApi and service logic.
 */

function testGetRestaurants() {
  const result = apiGetRestaurants();
  Logger.log('--- 식당 리스트 조회 결과 ---');
  Logger.log('성공 여부: ' + result.success);
  if (result.success) {
    Logger.log('조회된 식당 수: ' + result.data.length);
    if (result.data.length > 0) {
      Logger.log('첫 번째 식당: ' + JSON.stringify(result.data[0]));
    }
  } else {
    Logger.log('에러 메시지: ' + result.message);
  }
}

// WARNING: inserts real review data
function testAddReview() {
  const restaurants = RestaurantService.getAllRestaurants();
  if (!restaurants.success || restaurants.data.length === 0) {
    Logger.log('테스트할 식당 데이터가 없습니다.');
    return;
  }

  const targetId = restaurants.data[0].id;
  const testForm = {
    restaurant_id: targetId,
    rate: 5,
    user_name: '테스트봇',
    comment: '시스템 테스트 중입니다.'
  };

  Logger.log('--- 리뷰 등록 테스트 시작 ---');
  const result = apiAddReview(testForm);
  Logger.log('결과: ' + JSON.stringify(result));
}

/**
 * Migration: fill empty id cells in the restaurant sheet with UUIDs.
 * Run this function directly from the Apps Script editor.
 */
function fillEmptyRestaurantIds() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('restaurant');
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    Logger.log('업데이트할 데이터가 없습니다.');
    return;
  }

  // Assumes the id column is column A
  const idRange = sheet.getRange(2, 1, lastRow - 1, 1);
  const idValues = idRange.getValues();
  let updateCount = 0;

  const newIdValues = idValues.map(row => {
    if (row[0] === '' || row[0] === null) {
      updateCount++;
      return [Utilities.getUuid()]; // keep 2D array shape
    }
    return row;
  });

  if (updateCount > 0) {
    idRange.setValues(newIdValues);
    Logger.log('총 ' + updateCount + '개의 빈 ID를 업데이트했습니다.');
  } else {
    Logger.log('업데이트할 빈 ID가 없습니다.');
  }
}

/**
 * Migration: restaurant data repair tool.
 * 1. Fills empty ids with UUIDs.
 * 2. Sets enabled to true when empty or false.
 * 3. Fills empty created_at/updated_at with the current time.
 * Run this function directly from the Apps Script editor.
 */
function fixRestaurantData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('restaurant');
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    Logger.log('업데이트할 데이터가 없습니다.');
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idIndex = headers.indexOf('id');
  const enabledIndex = headers.indexOf('enabled');
  const createdAtIndex = headers.indexOf('created_at');
  const updatedAtIndex = headers.indexOf('updated_at');

  if (idIndex === -1 || enabledIndex === -1 || createdAtIndex === -1) {
    Logger.log('필수 헤더(id, enabled, created_at) 중 일부를 찾을 수 없습니다.');
    return;
  }

  const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const values = range.getValues();
  let updateCount = 0;

  const newValues = values.map(row => {
    let changed = false;

    if (!row[idIndex]) {
      row[idIndex] = Utilities.getUuid();
      changed = true;
    }

    if (row[enabledIndex] !== true) {
      row[enabledIndex] = true;
      changed = true;
    }

    const now = new Date();
    if (!row[createdAtIndex]) {
      row[createdAtIndex] = now;
      changed = true;
    }

    if (!row[updatedAtIndex]) {
      row[updatedAtIndex] = now;
      changed = true;
    }

    if (changed) updateCount++;
    return row;
  });

  if (updateCount > 0) {
    range.setValues(newValues);
    Logger.log('총 ' + updateCount + '개의 행 데이터를 보정했습니다 (ID, Enabled, CreatedAt).');
  } else {
    Logger.log('보정할 데이터가 없습니다. 모든 데이터가 정상입니다.');
  }
}

function testGetReviews(id = 'e8b605c7-7678-471b-ba54-9b94d3a4ab77') {
  const restaurants = RestaurantService.getAllRestaurants();
  if (!restaurants.success || restaurants.data.length === 0) {
    Logger.log('테스트할 식당 데이터가 없습니다.');
    return;
  }

  Logger.log(`--- [${id}] 식당 리뷰 조회 테스트 시작 ---`);

  const result = apiGetReviews(id);

  Logger.log('성공 여부: ' + result.success);
  if (result.success) {
    Logger.log('조회된 리뷰 수: ' + result.data.length);
    if (result.data.length > 0) {
      Logger.log('최신 리뷰 샘플: ' + JSON.stringify(result.data[0]));
    } else {
      Logger.log('등록된 리뷰가 없습니다.');
    }
  } else {
    Logger.log('에러 메시지: ' + result.message);
  }
}

function testGetWebappUrl() {
  const webAppUrl = ScriptApp.getService().getUrl();
  Logger.log(webAppUrl);
}

function testReviewDateParsing() {
  Logger.log('=== [테스트 시작] ReviewService.getAllReviews() 날짜 데이터 검증 ===');

  const response = ReviewService.getAllReviews();

  if (!response.success) {
    Logger.log('❌ API 호출 실패: ' + response.message);
    return;
  }

  const reviews = response.data;
  Logger.log('✅ 데이터 로드 성공. 총 리뷰 개수: ' + reviews.length);

  if (reviews.length === 0) {
    Logger.log('⚠️ 리뷰 데이터가 없습니다.');
    return;
  }

  const sampleCount = Math.min(reviews.length, 5);

  for (let i = 0; i < sampleCount; i++) {
    const r = reviews[i];
    Logger.log('------------------------------------------------');
    Logger.log(`[Review ${i}] ID: ${r.id}`);
    Logger.log(`[Review ${i}] 작성자: ${r.user_name}`);

    Logger.log(`[Review ${i}] created_at (Value): ${r.created_at}`);

    Logger.log(`[Review ${i}] created_at (Type): ${typeof r.created_at}`);

    if (r.created_at) {
      const d = new Date(r.created_at);
      const isValid = !isNaN(d.getTime());
      Logger.log(`[Review ${i}] 유효한 날짜인가?: ${isValid ? 'O' : 'X'} (Timestamp: ${d.getTime()})`);
    } else {
      Logger.log(`[Review ${i}] ❌ 날짜 값이 비어있습니다 (null/undefined/empty string).`);
    }
  }

  Logger.log('=== [테스트 종료] ===');
}

function checkColumnNames() {
  const rawData = Util.getSheetData('review');
  if (rawData && rawData.length > 0) {
    Logger.log('✅ 실제 데이터의 키 목록: ' + Object.keys(rawData[0]).join(', '));

    const firstRow = rawData[0];
    Logger.log('Sample Data: ' + JSON.stringify(firstRow));
  } else {
    Logger.log('❌ 데이터를 가져오지 못했습니다.');
  }
}

function createMenuSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('menu');

  if (sheet) {
    Logger.log('이미 menu 시트가 존재합니다.');
  } else {
    sheet = ss.insertSheet('menu');
    sheet.appendRow(['id', 'restaurant_id', 'name', 'price', 'enabled', 'created_at', 'updated_at']);
    Logger.log('menu 시트가 생성되었습니다.');
  }
}

/**
 * Migration: backfill the review_count column from existing review data.
 * Depends on ReviewService and RestaurantService.
 */
function _migration_updateReviewCounts() {
  console.log("▶ [MIGRATION] review_count 컬럼 데이터 채우기 시작 (0 포함)");

  const reviewRes = ReviewService.getAllReviews();
  const restaurantRes = RestaurantService.getAllRestaurants();

  if (!reviewRes.success || !restaurantRes.success) {
    console.error("🔥 [MIGRATION] 데이터 로드 실패. 리뷰 또는 식당 데이터 조회 오류.");
    return false;
  }

  const reviewCountMap = reviewRes.data.reviewCountMap;
  const allRestaurants = restaurantRes.data;
  let updateCount = 0;

  // Restaurants missing from the map get an explicit 0
  allRestaurants.forEach(rest => {
    const restaurantId = rest.id;
    const count = reviewCountMap[restaurantId] || 0;

    RestaurantService.updateReviewCount(restaurantId, count);
    updateCount++;
  });

  console.log(`✅ [MIGRATION] 총 ${updateCount}개 식당의 review_count 컬럼 업데이트 완료 (0개 포함).`);
  return true;
}

/**
 * Runs the review_count migration and verifies the result.
 * Run this function directly from the Apps Script editor.
 */
function testMigrationReviewCount() {
  console.log("--- Migration Test: review_count 채우기 ---");
  const success = _migration_updateReviewCounts();
  console.log(`--- Migration 결과: ${success ? '성공' : '실패'} ---`);

  if (success) {
    const restaurantsRes = RestaurantService.getAllRestaurants();
    if (restaurantsRes.success && restaurantsRes.data.length > 0) {
      const top3 = restaurantsRes.data.slice(0, 3).map(r =>
        `[${r.name}] review_count: ${r.review_count || r.reviewCount}`
      );
      console.log("\n[Migration 검증] 상위 3개 식당 데이터:");
      top3.forEach(log => console.log(log));
      console.log("--- 검증 완료 (스프레드시트에서 수동 확인 필요) ---");
    }
  }
}

function testGetUser() {
  const email = Session.getActiveUser().getEmail();
  const user = AdminDirectory.Users.get(email, {
    viewType: "domain_public"
  });

  if (user.thumbnailPhotoUrl) {
    console.log("Profile image URL:", user.thumbnailPhotoUrl);
    return user.thumbnailPhotoUrl;
  }

  return null;
}

function testGetAllUsers() {
  Logger.log('--- 전체 사용자 목록 조회 테스트 시작 ---');
  const result = apiGetAllUsers();
  Logger.log('성공 여부: ' + result.success);
  if (result.success) {
    Logger.log('조회된 사용자 수: ' + result.data.length);
    if (result.data.length > 0) {
      const sample = result.data[0];
      Logger.log('사용자 샘플: ' + JSON.stringify(sample));
      Logger.log(`샘플 유저 통계 - 리뷰: ${sample.reviewCount}, 찜: ${sample.likeCount}`);
    }
  } else {
    Logger.log('에러 메시지: ' + result.message);
  }
}