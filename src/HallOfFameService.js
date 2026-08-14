const HallOfFameService = {
  // Bayesian shrinkage constant: ratings converge to the global mean under this many reviews
  BAYESIAN_M: 5,
  MIN_REVIEWS_FOR_RESTAURANT_STATS: 3,
  MIN_REVIEWS_FOR_REVIEWER_STATS: 3,

  getHallOfFameData: function () {
    try {
      const isEnabled = (r) => {
        const v = (typeof r.enabled === 'object' && r.enabled) ? r.enabled.text : r.enabled;
        return v === true || v === 'TRUE' || v === 'true';
      };
      const cellText = (v) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') return String(v.text || v.value || '');
        return String(v);
      };

      const allRestaurants = Util.getSheetData('restaurant');
      const restaurants = allRestaurants.filter(isEnabled);
      const deletedRestaurants = allRestaurants.filter(r => !isEnabled(r));
      const menus = Util.getSheetData('menu').filter(isEnabled);
      const reviews = Util.getSheetData('review').filter(isEnabled);
      const likes = Util.getSheetData('like').filter(isEnabled);

      // --- Per-user contribution aggregation (SYSTEM and blank authors excluded) ---
      const contrib = {};
      const touch = (email) => {
        const key = cellText(email).trim().toLowerCase();
        if (!key || key === 'system') return null;
        if (!contrib[key]) {
          contrib[key] = { email: key, restaurantCount: 0, menuCount: 0, reviewCount: 0, likeCount: 0, ratingSum: 0 };
        }
        return contrib[key];
      };

      restaurants.forEach(r => { const c = touch(r.created_by); if (c) c.restaurantCount++; });
      menus.forEach(m => { const c = touch(m.created_by); if (c) c.menuCount++; });
      reviews.forEach(rv => {
        const c = touch(rv.user_email);
        if (c) {
          c.reviewCount++;
          c.ratingSum += Number(cellText(rv.rate)) || 0;
        }
      });
      likes.forEach(l => { const c = touch(l.user_email); if (c) c.likeCount++; });

      const users = Object.values(contrib).map(c => ({
        email: c.email,
        restaurantCount: c.restaurantCount,
        menuCount: c.menuCount,
        reviewCount: c.reviewCount,
        likeCount: c.likeCount,
        avgRateGiven: c.reviewCount > 0 ? c.ratingSum / c.reviewCount : null,
        // Internal ranking score; the UI never displays it
        score: c.restaurantCount * 10 + c.reviewCount * 5 + c.menuCount * 2 + c.likeCount * 0.5
      }));

      users.sort((a, b) =>
        (b.score - a.score) ||
        (b.restaurantCount - a.restaurantCount) ||
        (b.reviewCount - a.reviewCount) ||
        a.email.localeCompare(b.email)
      );

      // --- Restaurant rating stats with Bayesian shrinkage toward global mean/variance ---
      const ratesByRestaurant = {};
      let globalSum = 0, globalCount = 0;
      reviews.forEach(rv => {
        const rId = cellText(rv.restaurant_id);
        const rate = Number(cellText(rv.rate)) || 0;
        if (!ratesByRestaurant[rId]) ratesByRestaurant[rId] = [];
        ratesByRestaurant[rId].push(rate);
        globalSum += rate;
        globalCount++;
      });
      const globalMean = globalCount > 0 ? globalSum / globalCount : 0;
      let globalVarSum = 0;
      reviews.forEach(rv => {
        const d = (Number(cellText(rv.rate)) || 0) - globalMean;
        globalVarSum += d * d;
      });
      const globalVariance = globalCount > 0 ? globalVarSum / globalCount : 0;

      const m = this.BAYESIAN_M;
      const buildStats = (restaurantList) => restaurantList
        .map(r => {
          const rId = cellText(r.id);
          const rates = ratesByRestaurant[rId] || [];
          const v = rates.length;
          if (v < this.MIN_REVIEWS_FOR_RESTAURANT_STATS) return null;

          const mean = rates.reduce((s, x) => s + x, 0) / v;
          const variance = rates.reduce((s, x) => s + (x - mean) * (x - mean), 0) / v;
          const weightedRate = (v / (v + m)) * mean + (m / (v + m)) * globalMean;
          const weightedStdDev = Math.sqrt((v / (v + m)) * variance + (m / (v + m)) * globalVariance);

          return {
            id: rId,
            name: Util.unescapeTextFromSheet(cellText(r.name)),
            category: Util.unescapeTextFromSheet(cellText(r.category)),
            reviewCount: v,
            avgRate: mean,
            weightedRate: weightedRate,
            weightedStdDev: weightedStdDev
          };
        })
        .filter(r => r !== null);

      const restaurantStats = buildStats(restaurants);

      const topRated = [...restaurantStats]
        .sort((a, b) => (b.weightedRate - a.weightedRate) || (b.reviewCount - a.reviewCount))
        .slice(0, 3);
      const controversial = [...restaurantStats]
        .sort((a, b) => (b.weightedStdDev - a.weightedStdDev) || (b.reviewCount - a.reviewCount))
        .slice(0, 3);

      // Soft-deleted restaurants that were highly rated while they lasted
      const memories = buildStats(deletedRestaurants)
        .sort((a, b) => (b.weightedRate - a.weightedRate) || (b.reviewCount - a.reviewCount))
        .slice(0, 3);

      // Most-reviewed active restaurants over the trailing 30 days
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentCounts = {};
      reviews.forEach(rv => {
        const created = new Date(cellText(rv.created_at)).getTime();
        if (!isNaN(created) && created >= cutoff) {
          const rId = cellText(rv.restaurant_id);
          recentCounts[rId] = (recentCounts[rId] || 0) + 1;
        }
      });
      const trending = restaurants
        .map(r => {
          const rId = cellText(r.id);
          const count = recentCounts[rId] || 0;
          if (count === 0) return null;
          return {
            id: rId,
            name: Util.unescapeTextFromSheet(cellText(r.name)),
            category: Util.unescapeTextFromSheet(cellText(r.category)),
            recentReviewCount: count
          };
        })
        .filter(r => r !== null)
        .sort((a, b) => b.recentReviewCount - a.recentReviewCount)
        .slice(0, 3);

      return Util.response(true, {
        users: users,
        globalMeanRate: globalMean,
        topRated: topRated,
        controversial: controversial,
        memories: memories,
        trending: trending
      }, null);
    } catch (e) {
      console.error('getHallOfFameData Error', e);
      return Util.response(false, null, '명예의 전당 집계 중 오류: ' + e.toString());
    }
  }
};
