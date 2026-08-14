const AdminService = {
  getAdminEmails: function() {
    const data = Util.getSheetData('admin') || [];
    let adminEmails = data.map(row => row.email).filter(e => e);
    
    return Util.response(true, [...new Set(adminEmails)], "조회 완료");
  },

  saveAdminEmails: function(emails) {
    if (!Array.isArray(emails)) {
      return Util.response(false, null, "유효하지 않은 이메일 목록입니다.");
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('admin');
    if (!sheet) return Util.response(false, null, "admin 시트가 존재하지 않습니다.");

    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
    
    if (emails.length > 0) {
      const now = new Date();
      const rows = emails.map(email => [Util.getUuid(), email, now]);
      sheet.getRange(2, 1, rows.length, 3).setValues(rows);
    }
    return Util.response(true, AdminService.getAdminEmails().data, "관리자 권한이 저장되었습니다.");
  },

  getGuests: function() {
    return Util.response(true, Util.getSheetData('guest') || [], "조회 완료");
  },

  addGuest: function(guest) {
    if (!guest || !guest.email || !guest.name) {
      return Util.response(false, null, "필수 정보가 누락되었습니다.");
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('guest');
    if (!sheet) return Util.response(false, null, "guest 시트가 존재하지 않습니다.");

    const existingGuests = Util.getSheetData('guest') || [];
    if (existingGuests.some(g => g.email === guest.email)) {
      return Util.response(false, null, "이미 등록된 게스트입니다.");
    }
    
    const id = Util.getUuid();
    const createdAt = new Date();
    
    sheet.appendRow([id, guest.name, guest.email, guest.department || 'Guest', createdAt]);
    return Util.response(true, AdminService.getGuests().data, "게스트가 추가되었습니다.");
  },

  deleteGuest: function(email) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('guest');
    if (!sheet) return Util.response(false, null, "guest 시트가 존재하지 않습니다.");

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return Util.response(false, null, "게스트를 찾을 수 없습니다.");
    
    const headers = data[0];
    const emailIndex = headers.indexOf('email');
    
    if (emailIndex === -1) return Util.response(false, null, "데이터 구조 오류(email 컬럼 없음).");

    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIndex] === email) {
        sheet.deleteRow(i + 1);
        return Util.response(true, AdminService.getGuests().data, "게스트가 삭제되었습니다.");
      }
    }
    return Util.response(false, null, "게스트를 찾을 수 없습니다.");
  },

  getExcludedEmails: function() {
    const data = Util.getSheetData('excluded') || [];
    let excludedEmails = data.map(row => row.email).filter(e => e);
    
    return Util.response(true, [...new Set(excludedEmails)], "조회 완료");
  },

  saveExcludedEmails: function(emails) {
    if (!Array.isArray(emails)) {
      return Util.response(false, null, "유효하지 않은 이메일 목록입니다.");
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('excluded');
    if (!sheet) return Util.response(false, null, "excluded 시트가 존재하지 않습니다.");

    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
    
    if (emails.length > 0) {
      const now = new Date();
      const rows = emails.map(email => [Util.getUuid(), email, now]);
      sheet.getRange(2, 1, rows.length, 3).setValues(rows);
    }
    return Util.response(true, AdminService.getExcludedEmails().data, "기본 제외 인원이 저장되었습니다.");
  }
};
