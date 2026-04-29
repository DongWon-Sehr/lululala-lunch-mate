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
      const rows = emails.map(email => [email]);
      sheet.getRange(2, 1, rows.length, 1).setValues(rows);
    }
    return Util.response(true, this.getAdminEmails().data, "관리자 권한이 저장되었습니다.");
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

    // 중복 체크
    const data = sheet.getDataRange().getValues();
    for(let i=1; i<data.length; i++) {
      if(data[i][1] === guest.email) {
        return Util.response(false, null, "이미 등록된 게스트입니다.");
      }
    }
    sheet.appendRow([guest.name, guest.email, guest.department || 'Guest']);
    return Util.response(true, this.getGuests().data, "게스트가 추가되었습니다.");
  },

  deleteGuest: function(email) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('guest');
    if (!sheet) return Util.response(false, null, "guest 시트가 존재하지 않습니다.");

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === email) {
        sheet.deleteRow(i + 1);
        return Util.response(true, this.getGuests().data, "게스트가 삭제되었습니다.");
      }
    }
    return Util.response(false, null, "게스트를 찾을 수 없습니다.");
  }
};
