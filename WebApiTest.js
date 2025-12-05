// #WebApiTest.gs

/**
 * WebApi 및 서비스 로직 테스트용 파일
 */

// 1. 식당 리스트 조회 테스트
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

// 2. 리뷰 등록 및 평점 재계산 테스트 (주의: 실제 데이터가 추가됩니다)
function testAddReview() {
  // 테스트를 위해 첫 번째 식당 ID 가져오기 (없으면 실행 불가)
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
 * [마이그레이션] restaurant 시트의 빈 ID 컬럼을 UUID로 일괄 업데이트
 * 실행 방법: 에디터 상단 드롭다운에서 이 함수를 선택하고 '실행' 버튼 클릭
 */
function fillEmptyRestaurantIds() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('restaurant');
  const lastRow = sheet.getLastRow();

  // 데이터가 헤더만 있거나 없는 경우 중단
  if (lastRow <= 1) {
    Logger.log('업데이트할 데이터가 없습니다.');
    return;
  }

  // 전체 데이터 가져오기 (헤더 포함)
  // ID 컬럼이 A열(인덱스 1)이라고 가정
  // 범위: 2행 1열부터 마지막 행까지 ID 컬럼만 가져옴
  const idRange = sheet.getRange(2, 1, lastRow - 1, 1);
  const idValues = idRange.getValues();
  let updateCount = 0;

  // 빈 값 확인 및 UUID 생성
  const newIdValues = idValues.map(row => {
    if (row[0] === '' || row[0] === null) {
      updateCount++;
      return [Utilities.getUuid()]; // 2차원 배열 형태 유지
    }
    return row; // 이미 값이 있으면 그대로 유지
  });

  // 업데이트된 데이터가 있다면 시트에 반영
  if (updateCount > 0) {
    idRange.setValues(newIdValues);
    Logger.log('총 ' + updateCount + '개의 빈 ID를 업데이트했습니다.');
  } else {
    Logger.log('업데이트할 빈 ID가 없습니다.');
  }
}

/**
 * [마이그레이션] 데이터 보정 도구
 * 1. restaurant 시트의 빈 ID를 UUID로 채움
 * 2. restaurant 시트의 enabled 컬럼이 비어있거나 false면 true로 설정 (활성화)
 * 3. restaurant 시트의 created_at 컬럼이 비어있으면 현재 시간으로 설정
 * 실행 방법: 에디터 상단 드롭다운에서 이 함수를 선택하고 '실행' 버튼 클릭
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

  // 전체 데이터 범위 가져오기
  const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const values = range.getValues();
  let updateCount = 0;

  const newValues = values.map(row => {
    let changed = false;

    // 1. ID 생성
    if (!row[idIndex]) {
      row[idIndex] = Utilities.getUuid();
      changed = true;
    }

    // 2. Enabled 활성화 (빈 값이거나 false인 경우 true로 변경)
    if (row[enabledIndex] !== true) {
      row[enabledIndex] = true;
      changed = true;
    }

    const now = new Date();
    // 3. Created_at 생성 (빈 값인 경우 현재 시간)
    if (!row[createdAtIndex]) {
      row[createdAtIndex] = now;
      changed = true;
    }

    // 3. Created_at 생성 (빈 값인 경우 현재 시간)
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
  // 1. 테스트할 식당 ID 확보를 위해 식당 목록 조회
  const restaurants = RestaurantService.getAllRestaurants();
  if (!restaurants.success || restaurants.data.length === 0) {
    Logger.log('테스트할 식당 데이터가 없습니다.');
    return;
  }

  Logger.log(`--- [${id}] 식당 리뷰 조회 테스트 시작 ---`);

  // 2. 리뷰 조회 API 호출
  const result = apiGetReviews(id);

  Logger.log('성공 여부: ' + result.success);
  if (result.success) {
    Logger.log('조회된 리뷰 수: ' + result.data.length);
    if (result.data.length > 0) {
      // 첫 번째 리뷰 샘플 출력
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

  // 상위 5개만 샘플링하여 검사
  const sampleCount = Math.min(reviews.length, 5);

  for (let i = 0; i < sampleCount; i++) {
    const r = reviews[i];
    Logger.log('------------------------------------------------');
    Logger.log(`[Review ${i}] ID: ${r.id}`);
    Logger.log(`[Review ${i}] 작성자: ${r.user_name}`);

    // 1. 값 자체 출력
    Logger.log(`[Review ${i}] created_at (Value): ${r.created_at}`);

    // 2. 타입 확인 (String이어야 정상)
    Logger.log(`[Review ${i}] created_at (Type): ${typeof r.created_at}`);

    // 3. Date 객체로 변환 가능한지 테스트
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
    // 첫 번째 데이터의 모든 키(컬럼명)를 출력합니다.
    Logger.log('✅ 실제 데이터의 키 목록: ' + Object.keys(rawData[0]).join(', '));

    // 첫 번째 데이터의 'created_at'이나 'Datetime' 값이 날짜 객체인지 확인
    const firstRow = rawData[0];
    Logger.log('Sample Data: ' + JSON.stringify(firstRow));
  } else {
    Logger.log('❌ 데이터를 가져오지 못했습니다.');
  }
}