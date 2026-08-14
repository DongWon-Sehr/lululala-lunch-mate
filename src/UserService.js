const UserService = {
  /**
   * Get the current user's info and admin status.
   * Also attempts to fetch the profile photo via the Admin SDK.
   */
  getCurrentUser: function () {
    try {
      const email = Session.getActiveUser().getEmail();

      let adminEmails = [];
      try {
        if (typeof AdminService !== 'undefined') {
          adminEmails = AdminService.getAdminEmails().data || [];
        }
      } catch (e) {
        console.warn('AdminService 에러:', e);
      }
      const isAdmin = adminEmails.includes(email);

      let profileUrl = '';
      try {
        // Requires the AdminDirectory advanced service to be enabled
        const user = AdminDirectory.Users.get(email, { viewType: "domain_public" });
        if (user && user.thumbnailPhotoUrl) {
          profileUrl = user.thumbnailPhotoUrl;
        } else if (user && user.thumbnailPhotoEtag) {
           // fallback if only etag is available but no URL (unlikely but safe)
        }
      } catch (err) {
        console.warn('프로필 이미지 조회 실패 (Admin SDK 권한 또는 설정 확인 필요):', err);
        // Profile lookup failure must not break core functionality, so only log the error
      }

      return Util.response(true, { email: email, profileUrl: profileUrl, isAdmin: isAdmin }, null);
    } catch (e) {
      console.error('getCurrentUser Error', e);
      return Util.response(false, { email: '', isAdmin: false }, e.toString());
    }
  },

  /**
   * List all Google Workspace users (Admin Directory API).
   * Requires an admin account and the 'Admin Directory API' advanced service.
   */
  getAllUsers: function () {
    try {
      let users = [];
      let pageToken;
      do {
        const page = AdminDirectory.Users.list({
          customer: 'my_customer',
          maxResults: 500,
          orderBy: 'email',
          projection: 'full', // full projection needed to include organizations/department
          pageToken: pageToken
        });
        if (page.users && page.users.length > 0) {
          const simplifiedUsers = [];

          page.users.forEach(u => {
            if (u.suspended) {
              return;
            }

            let dept = '';

            if (u.organizations && u.organizations.length > 0) {
              const primaryOrg = u.organizations.find(o => o.primary) || u.organizations[0];
              if (primaryOrg && primaryOrg.department) {
                dept = primaryOrg.department;
              }
            }

            if (!dept) dept = 'Not Assigned';

            // Exclude shared accounts in the "뉴 아이디/Common" department
            if (dept === '뉴 아이디/Common') {
              return;
            }

            simplifiedUsers.push({
              name: u.name.fullName,
              email: u.primaryEmail,
              thumbnailPhotoUrl: u.thumbnailPhotoUrl || '',
              department: dept,
              isGuest: false
            });
          });

          users = users.concat(simplifiedUsers);
        }
        pageToken = page.nextPageToken;
      } while (pageToken);

      try {
        if (typeof AdminService !== 'undefined') {
          const guests = AdminService.getGuests().data || [];
          if (guests && guests.length > 0) {
            guests.forEach(g => {
              users.push({
                name: g.name,
                email: g.email,
                thumbnailPhotoUrl: '',
                department: g.department || 'Guest',
                isGuest: true
              });
            });
          }
        }
      } catch (e) {
        console.warn('Guest 조회 실패:', e);
      }


      const reviewsRes = ReviewService.getAllReviews();
      const reviewCountMap = {};
      if (reviewsRes.success) {
        reviewsRes.data.reviews.forEach(r => {
          if (r.user_email) {
            reviewCountMap[r.user_email] = (reviewCountMap[r.user_email] || 0) + 1;
          }
        });
      }

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