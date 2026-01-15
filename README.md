# 룰루랄라 뉴슐랭 가이드 (Newchelin Guide) 🍚

> 사내 점심/회식 식당 의사결정 지원 및 정보 공유를 위한 웹 애플리케이션

![Vue.js](https://img.shields.io/badge/Vue.js-3.x-4FC08D?style=flat&logo=vue.js&logoColor=white)
![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-GAS-4285F4?style=flat&logo=google&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?style=flat&logo=tailwind-css&logoColor=white)

## 📌 프로젝트 개요

**뉴슐랭 가이드**는 회사 근처 맛집 정보를 공유하고, "오늘 뭐 먹지?"라는 직장인들의 영원한 난제를 해결하기 위해 개발된 사내 서비스입니다. Google Workspace 환경(Google Sheets + Google Apps Script) 위에서 동작하며, 별도의 서버 비용 없이 운영 가능합니다.

## ✨ 주요 기능

### 1. 📋 식당 리스트 (List)
- **정보 공유**: 사내 구성원 누구나 식당 정보를 열람하고 검색할 수 있습니다.
- **필터 & 정렬**: 카테고리, 태그, 평점, 가격대 등 다양한 필터와 정렬 기능을 제공합니다.
- **좋아요 & 리뷰**: 찜하기(❤️)와 별점 리뷰를 통해 인기 맛집을 한눈에 파악할 수 있습니다.
- **관리자 기능**: 어드민 권한자는 식당 정보를 수정하거나 삭제할 수 있습니다.

### 2. 🎡 오늘 뭐먹지? (Wheel)
- **랜덤 추첨**: 결정 장애가 올 때, 필터링된 후보 리스트 중 하나를 랜덤으로 뽑아줍니다.
- **물리 애니메이션**: 룰렛이 돌아가는 쫀득한 애니메이션 효과로 재미를 더했습니다.
- **빠른 추가**: '찜한 매장', '한식', '배달' 등 테마별로 후보를 빠르게 구성할 수 있습니다.

### 3. 🤝 누구랑 먹지? (Lunch Mate)
- **랜덤 조 편성**: 점심 식사 파티(조)를 랜덤으로 구성해줍니다.
- **GWS 연동**: Google Workspace 조직도와 연동되어 부서별 인원 현황을 그룹핑하여 보여줍니다.
- **시각적 재미**: 멤버가 한 명씩 날아가 조에 배정되는 카드 애니메이션 효과로 긴장감을 더했습니다.
- **개발 좋아 모드**: 개발팀과 비개발팀이 골고루 섞이도록 지능적으로 배분하는 'Dev Mix' 셔플 모드를 기본으로 지원합니다.
- **커스텀 인원**: 외부 게스트나 인턴 등 조직도에 없는 인원도 직접 텍스트로 입력하여 추가할 수 있습니다.

### 4. 👤 마이페이지 (MyPage)
- **활동 내역**: 내가 쓴 리뷰와 찜한 식당 목록을 모아봅니다.
- **랭킹 시스템**: 리뷰 활동량에 따라 '아이언'부터 '블랙 다이아몬드'까지 등급(Tier)이 부여됩니다.

## 🛠 기술 스택

- **Frontend**:
    - Vue.js 3 (Composition API) via CDN
    - Tailwind CSS (CDN)
    - Phosphor Icons (UI 아이콘)
- **Backend**:
    - Google Apps Script (GAS)
    - Google Admin SDK (사용자 조회)
- **Database**:
    - Google Sheets (Restaurant, Review, Like, Menu 데이터 저장)

## 📂 프로젝트 구조

```
src/
├── Config.js           # 환경 설정 (관리자 이메일 등)
├── javascript.html     # Vue.js 애플리케이션 로직 (Main Logic)
├── ViewList.html       # 식당 리스트 탭 UI
├── ViewWheel.html      # 오늘 뭐먹지? 탭 UI
├── ViewLunchMate.html  # 누구랑 먹지? 탭 UI
├── ViewMyPage.html     # 마이페이지 탭 UI
├── ModalRestaurant.html# 식당 상세/추가/수정 모달
├── LayoutHeader.html   # 공통 헤더
├── WebApi.js           # GAS 백엔드 API 진입점 (doGet 등)
├── RestaurantService.js# 식당 데이터 CRUD 로직
├── UserService.js      # 사용자 및 조직도 조회 로직
└── ...
```

## 🚀 설치 및 배포

1. **Google Sheet 준비**: `restaurant`, `menu`, `review`, `like` 시트를 생성합니다.
2. **Apps Script 프로젝트 생성**: 구글 시트에서 `확장 프로그램 > Apps Script`를 실행합니다.
3. **코드 배포**: `src` 폴더 내의 파일들을 Apps Script 에디터에 복사합니다.
    - `.js` 파일은 `.gs` 파일로 저장합니다.
    - `.html` 파일은 `.html` 파일로 저장합니다.
4. **서비스 추가**: 에디터 좌측 '서비스' 탭에서 `Admin SDK API`를 추가합니다.
5. **배포**: `배포 > 새 배포`를 클릭하고 '웹 앱' 유형으로 배포합니다.
    - 엑세스 권한: '도메인 내의 모든 사용자' (사내용)

## 📝 라이선스

This project is licensed under the MIT License.
