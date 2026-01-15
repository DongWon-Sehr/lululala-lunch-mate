const UserService = {
  /**
   * 현재 접속한 사용자 정보 및 관리자 여부 확인
   * Admin SDK를 사용하여 프로필 이미지도 함께 조회 시도
   */
  getCurrentUser: function () {
    try {
      const email = Session.getActiveUser().getEmail();
      const isAdmin = Config.ADMIN_EMAILS.includes(email);

      let profileUrl = '';
      try {
        // AdminDirectory 서비스가 활성화되어 있어야 동작함
        const user = AdminDirectory.Users.get(email, { viewType: "domain_public" });
        if (user && user.thumbnailPhotoUrl) {
          profileUrl = user.thumbnailPhotoUrl;
        }
      } catch (err) {
        console.warn('프로필 이미지 조회 실패 (Admin SDK 권한 또는 설정 확인 필요):', err);
        // 프로필 조회 실패해도 기본 기능은 동작해야 하므로 에러는 로그로만 남김
      }

      return Util.response(true, { email: email, profileUrl: profileUrl, isAdmin: isAdmin }, null);
    } catch (e) {
      console.error('getCurrentUser Error', e);
      return Util.response(false, { email: '', isAdmin: false }, e.toString());
    }
  },

  /**
   * Google Workspace 전체 사용자 조회 (Admin Directory API)
   * - 실행 권한: 관리자 계정만 실행 가능
   * - 필수 설정: Apps Script 서비스 > 'Admin Directory API' 추가 필요
   */
  getAllUsers: function () {
    try {
      // 1. GWS 사용자 목록 조회
      let users = [];
      let pageToken;
      do {
        const page = AdminDirectory.Users.list({
          customer: 'my_customer',
          maxResults: 500,
          orderBy: 'email',
          projection: 'full', // [NEW] 상세 정보 포함
          pageToken: pageToken
        });
        if (page.users && page.users.length > 0) {
          const simplifiedUsers = [];
          
          page.users.forEach(u => {
            // 0. 정지된 사용자(Suspended)는 필터링 (제외)
            if (u.suspended) {
              return; // skip
            }

            let dept = '';
            
            // 1. organizations 필드에서 department 우선 조회
            if (u.organizations && u.organizations.length > 0) {
              // primary가 true인 것 우선, 없으면 첫 번째 것
              const primaryOrg = u.organizations.find(o => o.primary) || u.organizations[0];
              if (primaryOrg && primaryOrg.department) {
                dept = primaryOrg.department;
              }
            }

            // 2. 값이 없으면 Not Assigned
            if (!dept) dept = 'Not Assigned';

            // 3. "뉴 아이디/Common"인 공용 계정은 필터링 (제외)
            if (dept === '뉴 아이디/Common') {
              return; // skip
            }

            simplifiedUsers.push({
              name: u.name.fullName,
              email: u.primaryEmail,
              thumbnailPhotoUrl: u.thumbnailPhotoUrl || '',
              department: dept
            });
          });
          
          users = users.concat(simplifiedUsers);
        }
        pageToken = page.nextPageToken;
      } while (pageToken);

      // 2. 리뷰 카운트 집계
      const reviewsRes = ReviewService.getAllReviews();
      const reviewCountMap = {};
      if (reviewsRes.success) {
        reviewsRes.data.reviews.forEach(r => {
          if (r.user_email) {
            reviewCountMap[r.user_email] = (reviewCountMap[r.user_email] || 0) + 1;
          }
        });
      }

      // 3. 찜(좋아요) 카운트 집계
      const likesData = Util.getSheetData('like');
      const likeCountMap = {};
      if (likesData) {
        likesData.forEach(l => {
          const enabledVal = (typeof l.enabled === 'object' && l.enabled) ? l.enabled.text : l.enabled;
          const isEnabled = enabledVal === true || enabledVal === 'TRUE' || enabledVal === 'true';
          const email = (typeof l.user_email === 'object' && l.user_email) ? l.user_email.text : l.user_email;

          if (isEnabled && email) {
            likeCountMap[email] = (likeCountMap[email] || 0) + 1;
          }
        });
      }

      // 4. 데이터 병합
      users.forEach(u => {
        u.reviewCount = reviewCountMap[u.email] || 0;
        u.likeCount = likeCountMap[u.email] || 0;
      });

      return Util.response(true, users, `총 ${users.length}명의 사용자 조회 완료`);

    } catch (e) {
      console.error('getAllUsers Error', e);
      return Util.response(false, [], "사용자 목록 조회 실패: " + e.toString());
    }
  }
};