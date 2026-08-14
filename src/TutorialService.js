const TutorialService = {
  getMyDismissed: function () {
    try {
      const email = Session.getActiveUser().getEmail();
      if (!email) return Util.response(true, [], null);

      const rows = Util.getSheetData('tutorial');
      const keys = rows
        .filter(r => {
          const dismissed = (typeof r.dismissed === 'object' && r.dismissed) ? r.dismissed.text : r.dismissed;
          return String(r.email) === String(email) &&
            (dismissed === true || dismissed === 'TRUE' || dismissed === 'true');
        })
        .map(r => String(r.feature));

      return Util.response(true, keys, null);
    } catch (e) {
      return Util.response(false, [], e.toString());
    }
  },

  dismiss: function (feature) {
    try {
      if (!feature) throw new Error("feature key가 없습니다.");
      const email = Session.getActiveUser().getEmail();
      if (!email) throw new Error("로그인이 필요합니다.");

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName('tutorial');
      if (!sheet) {
        sheet = ss.insertSheet('tutorial');
        sheet.appendRow(['id', 'email', 'feature', 'dismissed', 'created_at', 'updated_at']);
      }

      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const emailIdx = headers.indexOf('email');
      const featureIdx = headers.indexOf('feature');
      const dismissedIdx = headers.indexOf('dismissed');
      const updatedIdx = headers.indexOf('updated_at');
      const now = new Date();

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][emailIdx]) === String(email) &&
            String(data[i][featureIdx]) === String(feature)) {
          sheet.getRange(i + 1, dismissedIdx + 1).setValue(true);
          if (updatedIdx !== -1) sheet.getRange(i + 1, updatedIdx + 1).setValue(now);
          return Util.response(true, { feature: feature }, "저장 완료");
        }
      }

      sheet.appendRow([Util.getUuid(), email, feature, true, now, now]);
      return Util.response(true, { feature: feature }, "저장 완료");
    } catch (e) {
      return Util.response(false, null, e.toString());
    }
  }
};
