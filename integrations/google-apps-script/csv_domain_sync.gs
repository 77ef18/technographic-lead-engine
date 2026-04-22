/**
 * Technographic Lead Engine - Google Sheet Domain Sync
 *
 * Sheet format:
 * - Sheet name: Domains (default below)
 * - Column A: domain values (example.com)
 *
 * Add a trigger as needed:
 * - hourly / daily / manual
 */

const APP_BASE_URL = 'https://YOUR_APP_URL.vercel.app';
const API_KEY = 'YOUR_RAW_API_KEY';
const SHEET_NAME = 'Domains';
const STATUS = 'active';

function syncDomainsFromSheet() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error('Missing sheet: ' + SHEET_NAME);
  }

  const values = sheet
    .getRange(1, 1, sheet.getLastRow(), 1)
    .getValues()
    .flat()
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  if (!values.length) {
    Logger.log('No domains found to sync.');
    return;
  }

  const csv = values.join('\n');
  const url = APP_BASE_URL.replace(/\/$/, '') + '/api/domains/import';

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': API_KEY
    },
    payload: JSON.stringify({
      csv: csv,
      status: STATUS
    }),
    muteHttpExceptions: true
  });

  Logger.log('Status: ' + response.getResponseCode());
  Logger.log(response.getContentText());
}
