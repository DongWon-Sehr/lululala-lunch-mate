const MenuService = {
  // Fetch all menus (used for client-side caching)
  getAllMenus: function () {
    try {
      const rawData = Util.getSheetData('menu');

      if (!rawData || rawData.length === 0) {
        return Util.response(true, [], null);
      }

      const menus = rawData
        .filter(r => {
          const enabled = (typeof r.enabled === 'object' && r.enabled) ? r.enabled.text : r.enabled;
          return enabled === true || enabled === 'TRUE' || enabled === 'true';
        })
        .map(r => {
          let name = (typeof r.name === 'object' && r.name) ? r.name.text : r.name;
          let price = (typeof r.price === 'object' && r.price) ? (r.price.numberValue || r.price.text) : r.price;
          let rId = (typeof r.restaurant_id === 'object' && r.restaurant_id) ? r.restaurant_id.text : r.restaurant_id;

          let isSig = (typeof r.is_signature === 'object' && r.is_signature) ? r.is_signature.text : r.is_signature;
          const isSignature = (isSig === true || isSig === 'TRUE' || isSig === 'true');

          return {
            id: (typeof r.id === 'object' && r.id) ? r.id.text : r.id,
            restaurant_id: String(rId),
            name: Util.unescapeTextFromSheet(name),
            price: Number(price) || 0,
            is_signature: isSignature
          };
        });

      return Util.response(true, menus, null);

    } catch (e) {
      console.error('getAllMenus Error', e);
      return Util.response(false, [], '메뉴 목록 조회 중 오류: ' + e.toString());
    }
  },

  getMenusByRestaurantId: function (restaurantId) {
    const allRes = this.getAllMenus();
    if (!allRes.success) return allRes;

    const all = allRes.data;
    const targetMenus = all.filter(m => m.restaurant_id === String(restaurantId));

    return Util.response(true, targetMenus, null);
  },

  // Update menus with an overwrite strategy: reuse existing rows, soft-delete leftovers, insert the rest
  updateMenus: function (restaurantId, menuForms) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('menu');

    try {
      if (!sheet) {
        sheet = ss.insertSheet('menu');
        sheet.appendRow(['id', 'restaurant_id', 'name', 'price', 'is_signature', 'enabled', 'created_at', 'updated_at']);
      }

      // Resolve header indices dynamically to tolerate column reordering
      const headers = sheet.getDataRange().getValues()[0];
      const rIdIdx = headers.indexOf('restaurant_id');
      const nameIdx = headers.indexOf('name');
      const priceIdx = headers.indexOf('price');
      const enabledIdx = headers.indexOf('enabled');
      const updatedIdx = headers.indexOf('updated_at');
      const isSigIdx = headers.indexOf('is_signature');

      const data = sheet.getDataRange().getValues();

      const targetRowIndices = [];
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][rIdIdx]) === String(restaurantId)) {
          targetRowIndices.push(i + 1); // 1-based index
        }
      }

      const validNewMenus = (menuForms || []).filter(m => m.name && m.name.trim() !== '');
      const now = new Date();

      // A. Overwrite existing rows
      const reuseCount = Math.min(targetRowIndices.length, validNewMenus.length);
      for (let i = 0; i < reuseCount; i++) {
        const rowIndex = targetRowIndices[i];
        const menu = validNewMenus[i];

        let validPrice = Number(menu.price);
        if (isNaN(validPrice) || validPrice < 0) validPrice = 0;

        sheet.getRange(rowIndex, nameIdx + 1).setValue(Util.escapeTextForSheet(menu.name));
        sheet.getRange(rowIndex, priceIdx + 1).setValue(validPrice);
        sheet.getRange(rowIndex, enabledIdx + 1).setValue(true);
        sheet.getRange(rowIndex, updatedIdx + 1).setValue(now);

        if (isSigIdx !== -1) {
          sheet.getRange(rowIndex, isSigIdx + 1).setValue(menu.is_signature === true);
        }
      }

      // B. Soft-delete leftover rows
      if (targetRowIndices.length > validNewMenus.length) {
        for (let i = validNewMenus.length; i < targetRowIndices.length; i++) {
          const rowIndex = targetRowIndices[i];
          sheet.getRange(rowIndex, enabledIdx + 1).setValue(false);
          sheet.getRange(rowIndex, updatedIdx + 1).setValue(now);

          if (isSigIdx !== -1) {
            sheet.getRange(rowIndex, isSigIdx + 1).setValue(false);
          }
        }
      }

      // C. Insert additional rows
      if (validNewMenus.length > targetRowIndices.length) {
        const rowsToAdd = [];
        for (let i = targetRowIndices.length; i < validNewMenus.length; i++) {
          const menu = validNewMenus[i];
          let validPrice = Number(menu.price);
          if (isNaN(validPrice) || validPrice < 0) validPrice = 0;

          const rowData = new Array(headers.length).fill('');

          if (headers.indexOf('id') !== -1) rowData[headers.indexOf('id')] = Util.getUuid();
          if (rIdIdx !== -1) rowData[rIdIdx] = restaurantId;
          if (nameIdx !== -1) rowData[nameIdx] = Util.escapeTextForSheet(menu.name);
          if (priceIdx !== -1) rowData[priceIdx] = validPrice;
          if (enabledIdx !== -1) rowData[enabledIdx] = true;
          if (headers.indexOf('created_at') !== -1) rowData[headers.indexOf('created_at')] = now;
          if (updatedIdx !== -1) rowData[updatedIdx] = now;
          if (isSigIdx !== -1) rowData[isSigIdx] = (menu.is_signature === true);

          rowsToAdd.push(rowData);
        }

        if (rowsToAdd.length > 0) {
          const lastRow = sheet.getLastRow();
          sheet.getRange(lastRow + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
        }
      }

      // D. Return the average price; the RestaurantService caller relies on this return value
      return this.calculateAveragePrice(validNewMenus);

    } catch (e) {
      console.error('updateMenus Error', e);
      // Return 0 on error so RestaurantService can still proceed
      return 0;
    }
  },

  // Average price excluding zero-priced items
  calculateAveragePrice: function (menus) {
    if (!menus || menus.length === 0) return 0;

    let sum = 0;
    let count = 0;

    menus.forEach(m => {
      if (!m.name || !m.name.trim()) return;
      const p = Number(m.price);
      if (!isNaN(p) && p > 0) {
        sum += p;
        count++;
      }
    });

    if (count === 0) return 0;
    return Math.round(sum / count);
  }
};