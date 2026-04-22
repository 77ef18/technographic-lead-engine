/**
 * Technographic Lead Engine - Daily Digest
 *
 * Configure constants below, then add a daily time-based trigger:
 * Apps Script -> Triggers -> Add Trigger -> runDailyDigest
 */

const APP_BASE_URL = 'https://YOUR_APP_URL.vercel.app';
const API_KEY = 'YOUR_RAW_API_KEY';
const ALERT_EMAIL = 'you@example.com';
const MAX_ROWS = 200;

const FILTERS = {
  hasTech: '', // e.g. 'shopify'
  techCategory: '', // e.g. 'ecommerce'
  minConfidence: 60,
  country: '',
  language: ''
};

function runDailyDigest() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const query = [
    ['lastScannedAfter', since],
    ['limit', String(MAX_ROWS)]
  ];

  if (FILTERS.hasTech) query.push(['hasTech', FILTERS.hasTech]);
  if (FILTERS.techCategory) query.push(['techCategory', FILTERS.techCategory]);
  if (FILTERS.minConfidence !== undefined && FILTERS.minConfidence !== null) {
    query.push(['minConfidence', String(FILTERS.minConfidence)]);
  }
  if (FILTERS.country) query.push(['country', FILTERS.country]);
  if (FILTERS.language) query.push(['language', FILTERS.language]);

  const url =
    APP_BASE_URL.replace(/\/$/, '') +
    '/api/search/leads?' +
    query.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'x-api-key': API_KEY
    },
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  if (status !== 200) {
    MailApp.sendEmail({
      to: ALERT_EMAIL,
      subject: '[Lead Engine] Daily Digest Failed',
      body: 'Request failed with status ' + status + '\n\n' + response.getContentText()
    });
    return;
  }

  const data = JSON.parse(response.getContentText() || '{}');
  const leads = data.leads || [];
  if (!leads.length) {
    MailApp.sendEmail({
      to: ALERT_EMAIL,
      subject: '[Lead Engine] Daily Digest - No New Matches',
      body: 'No leads matched your filter in the last 24 hours.'
    });
    return;
  }

  const csv = toCsv(leads);
  const attachment = Utilities.newBlob(csv, 'text/csv', 'daily_leads_digest.csv');

  MailApp.sendEmail({
    to: ALERT_EMAIL,
    subject: '[Lead Engine] Daily Digest - ' + leads.length + ' lead(s)',
    body:
      'Found ' +
      leads.length +
      ' lead(s) in the last 24 hours.\n\n' +
      'Filters:\n' +
      JSON.stringify(FILTERS, null, 2),
    attachments: [attachment]
  });
}

function toCsv(leads) {
  const header = [
    'domain',
    'status',
    'latest_scan_at',
    'language',
    'country',
    'region',
    'technologies',
    'top_confidence'
  ];

  const rows = leads.map((lead) => [
    lead.domain || '',
    lead.status || '',
    lead.latest_scan_at || '',
    lead.language || '',
    lead.country || '',
    lead.region || '',
    (lead.technologies || []).join('|'),
    lead.top_confidence == null ? '' : String(lead.top_confidence)
  ]);

  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

function csvEscape(value) {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}
