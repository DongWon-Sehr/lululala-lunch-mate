/**
 * General-purpose utility functions for Google Apps Script.
 */

// All helpers live inside the Util object to avoid global name collisions.

const Util = {

  getSpreadsheet: function () {
    return SpreadsheetApp.getActiveSpreadsheet();
  },

  /**
   * Read all rows of a sheet (using its header row) as an array of objects.
   */
  getSheetData: function (sheetName) {
    const sheet = Util.getSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return [];

    const range = sheet.getDataRange();
    if (range.getNumRows() <= 1) return [];

    const values = range.getValues();
    const headers = values[0];
    const data = [];

    for (let i = 1; i < values.length; i++) {
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        let val = values[i][j];
        // Convert Dates to ISO strings to avoid serialization errors when sent to the client
        if (val instanceof Date) {
          val = Util.safeDateIsoString(val);
        }
        row[headers[j]] = val;
      }
      data.push(row);
    }
    return data;
  },

  /**
   * Build the standard response object.
   */
  response: function (success, data, message) {
    return { success, data, message: message || (success ? 'Success' : 'Error') };
  },

  /**
   * Generate a UUID.
   */
  getUuid: function () {
    return Utilities.getUuid();
  },

  /**
   * Escape characters (newline, tab) that break Google Sheet cells.
   */
  escapeTextForSheet: function (text) {
    if (typeof text !== 'string') return text;
    return text.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  },

  /**
   * Restore escaped characters (newline, tab) in text read back from a Sheet.
   */
  unescapeTextFromSheet: function (text) {
    if (typeof text !== 'string') return text;
    return text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  },

  /**
   * Convert the various date value shapes a Sheet can return into an ISO 8601 string.
   */
  safeDateIsoString: function (val) {
    if (!val) return null;
    try {
      if (val instanceof Date) return val.toISOString();

      // Numbers are Sheets date serials
      if (typeof val === 'number') {
        // 25569 is the Excel/Sheets serial value for 1970-01-01
        const sheetDate = new Date((val - 25569) * 86400 * 1000);
        return sheetDate.toISOString();
      }

      const d = new Date(val);
      if (isNaN(d.getTime())) return null;

      return d.toISOString();
    } catch (e) {
      return null;
    }
  }
};