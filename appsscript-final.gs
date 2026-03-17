// Pilvo Dūmas – Google Apps Script (FINAL)
const PRODUCTS_SHEET = 'Prekės';
const ORDERS_SHEET   = 'Užsakymai';
const OWNER_EMAIL    = 'mariuskrisiulevicius@gmail.com';

function doGet(e) {
  try {
    if (e.parameter.action === 'getProducts') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRODUCTS_SHEET);
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Sheet not found' })).setMimeType(ContentService.MimeType.JSON);
      const data     = sheet.getDataRange().getValues();
      const headers  = data[0];
      const products = data.slice(1)
        .filter(row => row[0] !== '' && row[0] !== null)
        .map(row => { const obj = {}; headers.forEach((h, i) => obj[String(h).trim()] = row[i]); return obj; });
      return ContentService.createTextOutput(JSON.stringify({ ok: true, products })).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'addOrder') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName(ORDERS_SHEET);
      if (!sheet) {
        sheet = ss.insertSheet(ORDERS_SHEET);
        sheet.appendRow(['ID','Data','Vardas','Tel','El. paštas','Pristatymas','Adresas','Prekės','Suma (€)','Pristatymo kaina','Statusas','Pastabos']);
        sheet.getRange(1,1,1,12).setFontWeight('bold').setBackground('#1a1008').setFontColor('#faf5ed');
      }
      const o     = body.order;
      const items = o.items.map(i => i.name + ' x' + i.qty + ' = ' + (i.price*i.qty).toFixed(2) + '€').join(', ');
      sheet.appendRow([o.id, o.date, o.name, o.tel, o.email, o.method==='post'?'Paštomatas':'Kurjeris', o.address, items, o.total, o.deliveryCost||'-', 'Naujas', o.notes||'']);

      // Atnaujinti likučius
      const stockSheet = ss.getSheetByName(PRODUCTS_SHEET);
      if (stockSheet) {
        const data    = stockSheet.getDataRange().getValues();
        const headers = data[0].map(h => String(h).trim().toLowerCase());
        const idCol   = headers.indexOf('id');
        const sCol    = headers.indexOf('likutis');
        if (idCol >= 0 && sCol >= 0) {
          o.items.forEach(item => {
            for (let i = 1; i < data.length; i++) {
              if (String(data[i][idCol]) === String(item.id)) {
                stockSheet.getRange(i+1, sCol+1).setValue(Math.max(0, Number(data[i][sCol]||0) - item.qty));
                break;
              }
            }
          });
        }
      }
      sendOwnerEmail(o);
      sendClientEmail(o);
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function sendOwnerEmail(o) {
  const method = o.method === 'post' ? 'Paštomatas' : 'Kurjeris į duris';
  const rows = o.items.map(i =>
    '<tr><td style="padding:8px 12px;border-bottom:1px solid #eee">' + i.name + '</td>' +
    '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">' + i.qty + '</td>' +
    '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">' + (i.price*i.qty).toFixed(2) + ' €</td></tr>'
  ).join('');
  const html =
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">' +
    '<div style="background:#1a1008;padding:28px;text-align:center"><h1 style="color:#e8540a;margin:0">Pilvo Dūmas</h1><p style="color:#e8c87a;margin:8px 0 0">Naujas užsakymas!</p></div>' +
    '<div style="background:#fff;padding:32px">' +
    '<h2 style="margin:0 0 20px;color:#1a1008">Užsakymas #' + o.id + '</h2>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">' +
    '<tr><td style="padding:7px 0;color:#888;width:150px">Vardas:</td><td style="font-weight:bold">' + o.name + '</td></tr>' +
    '<tr><td style="padding:7px 0;color:#888">Tel.:</td><td>' + o.tel + '</td></tr>' +
    '<tr><td style="padding:7px 0;color:#888">El. paštas:</td><td>' + o.email + '</td></tr>' +
    '<tr><td style="padding:7px 0;color:#888">Pristatymas:</td><td>' + method + '</td></tr>' +
    '<tr><td style="padding:7px 0;color:#888">Adresas:</td><td>' + o.address + '</td></tr>' +
    '<tr><td style="padding:7px 0;color:#888">Pristatymo kaina:</td><td style="font-weight:bold">' + (o.deliveryCost||'-') + '</td></tr>' +
    (o.notes ? '<tr><td style="padding:7px 0;color:#888">Pastabos:</td><td>' + o.notes + '</td></tr>' : '') +
    '</table>' +
    '<h3 style="border-bottom:3px solid #e8540a;padding-bottom:8px;color:#1a1008">Užsakytos prekės</h3>' +
    '<table style="width:100%;border-collapse:collapse">' +
    '<tr style="background:#f9f9f9"><th style="padding:8px 12px;text-align:left">Prekė</th><th style="padding:8px 12px;text-align:center">Kiekis</th><th style="padding:8px 12px;text-align:right">Suma</th></tr>' +
    rows +
    '<tr style="background:#1a1008"><td colspan="2" style="padding:10px 12px;color:#e8c87a;font-weight:bold">IŠ VISO</td>' +
    '<td style="padding:10px 12px;color:#e8540a;font-weight:bold;text-align:right">' + o.total.toFixed(2) + ' €</td></tr>' +
    '</table></div></div>';
  GmailApp.sendEmail(OWNER_EMAIL, 'Naujas užsakymas #' + o.id + ' – ' + o.name + ' (' + o.total.toFixed(2) + ' €)', '', { htmlBody: html, name: 'Pilvo Dūmas' });
}

function sendClientEmail(o) {
  const method = o.method === 'post' ? 'Pašto punktas / Paštomatas' : 'Kurjeris į duris';
  const days   = o.method === 'post' ? '2–3 darbo dienos' : '1–2 darbo dienos';
  const rows = o.items.map(i =>
    '<tr><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0">' + i.name + '</td>' +
    '<td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:center">' + i.qty + ' vnt.</td>' +
    '<td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold">' + (i.price*i.qty).toFixed(2) + ' €</td></tr>'
  ).join('');
  const html =
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f8f8;padding:20px">' +
    '<div style="background:#1a1008;padding:32px;text-align:center;border-radius:8px 8px 0 0"><h1 style="color:#e8540a;margin:0">Pilvo Dūmas</h1><p style="color:#e8c87a;margin:10px 0 0">Ačiū už užsakymą!</p></div>' +
    '<div style="background:#2a7a3a;padding:20px;text-align:center"><p style="color:#fff;margin:0;font-weight:bold">Jūsų užsakymas #' + o.id + ' priimtas!</p></div>' +
    '<div style="background:#fff;padding:32px;border-radius:0 0 8px 8px">' +
    '<p style="font-size:16px;color:#1a1008">Sveiki, <strong>' + o.name + '</strong>!</p>' +
    '<p style="color:#555;line-height:1.7">Gavome jūsų užsakymą ir susisieksime per <strong>1 darbo valandą</strong>.</p>' +
    '<table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9f9f9;border-radius:6px;overflow:hidden">' +
    '<tr style="background:#1a1008"><th colspan="3" style="padding:12px 16px;color:#e8c87a;text-align:left">Užsakytos prekės</th></tr>' +
    rows +
    '<tr style="background:#1a1008"><td colspan="2" style="padding:10px 16px;color:#e8c87a;font-weight:bold">IŠ VISO</td><td style="padding:10px 16px;color:#e8540a;font-weight:bold;text-align:right">' + o.total.toFixed(2) + ' €</td></tr>' +
    '</table>' +
    '<p style="color:#555"><strong>Pristatymas:</strong> ' + method + '<br><strong>Adresas:</strong> ' + o.address + '<br><strong>Laikas:</strong> ' + days + '</p>' +
    '<div style="background:#fff8f0;border-left:4px solid #e8540a;padding:14px 20px;margin:20px 0">' +
    '<p style="margin:0;color:#555;font-size:13px"><strong>Kas toliau?</strong><br>1. Susisieksime per 1 val.<br>2. Aptarsime apmokėjimą<br>3. Išsiųsime tą pačią dieną (jei iki 14:00)</p></div>' +
    '<p style="text-align:center;color:#555">Klausimai? <a href="mailto:' + OWNER_EMAIL + '" style="color:#e8540a">' + OWNER_EMAIL + '</a></p>' +
    '</div></div>';
  GmailApp.sendEmail(o.email, 'Jūsų užsakymas #' + o.id + ' priimtas – Pilvo Dūmas', '', { htmlBody: html, name: 'Pilvo Dūmas', replyTo: OWNER_EMAIL });
}
