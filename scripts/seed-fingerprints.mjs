import path from "node:path";

import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to seed fingerprints.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const coreTechs = [
  {
    slug: "shopify",
    name: "Shopify",
    category: "ecommerce",
    website: "https://www.shopify.com",
    fingerprints: [
      { signalType: "script", pattern: "cdn\\.shopify\\.com", weight: 0.5 },
      { signalType: "meta", pattern: "generator:shopify", weight: 0.25 },
      { signalType: "header", pattern: "x-shopid:.+", weight: 0.25 },
    ],
  },
  {
    slug: "wordpress",
    name: "WordPress",
    category: "cms",
    website: "https://wordpress.org",
    fingerprints: [
      { signalType: "meta", pattern: "generator:wordpress", weight: 0.4 },
      { signalType: "script", pattern: "wp-content|wp-includes", weight: 0.3 },
      { signalType: "cookie", pattern: "wordpress_", weight: 0.3 },
    ],
  },
  {
    slug: "wix",
    name: "Wix",
    category: "cms",
    website: "https://www.wix.com",
    fingerprints: [
      { signalType: "script", pattern: "static\\.wixstatic\\.com", weight: 0.45 },
      { signalType: "meta", pattern: "generator:wix", weight: 0.3 },
      { signalType: "header", pattern: "x-wix-request-id:.+", weight: 0.25 },
    ],
  },
  {
    slug: "webflow",
    name: "Webflow",
    category: "cms",
    website: "https://webflow.com",
    fingerprints: [
      { signalType: "meta", pattern: "generator:webflow", weight: 0.45 },
      { signalType: "script", pattern: "webflow\\.js|webflow\\.com", weight: 0.35 },
      { signalType: "cookie", pattern: "wf-order-id|wf-csrf", weight: 0.2 },
    ],
  },
  {
    slug: "hubspot",
    name: "HubSpot",
    category: "marketing_automation",
    website: "https://www.hubspot.com",
    fingerprints: [
      { signalType: "script", pattern: "js\\.hs-scripts\\.com", weight: 0.45 },
      { signalType: "cookie", pattern: "hubspotutk|__hssc|__hstc", weight: 0.35 },
      { signalType: "script", pattern: "hsforms\\.net", weight: 0.2 },
    ],
  },
  {
    slug: "segment",
    name: "Segment",
    category: "analytics",
    website: "https://segment.com",
    fingerprints: [
      { signalType: "script", pattern: "cdn\\.segment\\.com/analytics\\.js", weight: 0.55 },
      { signalType: "script", pattern: "api\\.segment\\.io", weight: 0.25 },
      { signalType: "cookie", pattern: "ajs_anonymous_id", weight: 0.2 },
    ],
  },
  {
    slug: "google-analytics",
    name: "Google Analytics",
    category: "analytics",
    website: "https://marketingplatform.google.com/about/analytics/",
    fingerprints: [
      { signalType: "script", pattern: "googletagmanager\\.com/gtag/js", weight: 0.4 },
      { signalType: "script", pattern: "google-analytics\\.com/analytics\\.js", weight: 0.35 },
      { signalType: "cookie", pattern: "_ga", weight: 0.25 },
    ],
  },
  {
    slug: "google-tag-manager",
    name: "Google Tag Manager",
    category: "tag_management",
    website: "https://tagmanager.google.com",
    fingerprints: [
      { signalType: "script", pattern: "googletagmanager\\.com/gtm\\.js", weight: 0.5 },
      { signalType: "meta", pattern: "google-site-verification:.+", weight: 0.2 },
      { signalType: "script", pattern: "dataLayer", weight: 0.3 },
    ],
  },
  {
    slug: "hotjar",
    name: "Hotjar",
    category: "analytics",
    website: "https://www.hotjar.com",
    fingerprints: [
      { signalType: "script", pattern: "static\\.hotjar\\.com", weight: 0.5 },
      { signalType: "script", pattern: "hj\\('", weight: 0.3 },
      { signalType: "cookie", pattern: "_hjSession", weight: 0.2 },
    ],
  },
  {
    slug: "intercom",
    name: "Intercom",
    category: "chat",
    website: "https://www.intercom.com",
    fingerprints: [
      { signalType: "script", pattern: "widget\\.intercom\\.io", weight: 0.5 },
      { signalType: "script", pattern: "api-iam\\.intercom\\.io", weight: 0.25 },
      { signalType: "cookie", pattern: "intercom-session", weight: 0.25 },
    ],
  },
  {
    slug: "zendesk-chat",
    name: "Zendesk Chat",
    category: "chat",
    website: "https://www.zendesk.com",
    fingerprints: [
      { signalType: "script", pattern: "static\\.zopim\\.com", weight: 0.45 },
      { signalType: "script", pattern: "zdassets\\.com", weight: 0.35 },
      { signalType: "cookie", pattern: "_zendesk", weight: 0.2 },
    ],
  },
  {
    slug: "drift",
    name: "Drift",
    category: "chat",
    website: "https://www.drift.com",
    fingerprints: [
      { signalType: "script", pattern: "js\\.drift\\.com", weight: 0.5 },
      { signalType: "script", pattern: "driftt\\.com", weight: 0.3 },
      { signalType: "cookie", pattern: "drift_", weight: 0.2 },
    ],
  },
  {
    slug: "mixpanel",
    name: "Mixpanel",
    category: "analytics",
    website: "https://mixpanel.com",
    fingerprints: [
      { signalType: "script", pattern: "cdn\\.mxpnl\\.com", weight: 0.5 },
      { signalType: "script", pattern: "mixpanel\\.init", weight: 0.3 },
      { signalType: "cookie", pattern: "mp_\\w+_mixpanel", weight: 0.2 },
    ],
  },
  {
    slug: "amplitude",
    name: "Amplitude",
    category: "analytics",
    website: "https://amplitude.com",
    fingerprints: [
      { signalType: "script", pattern: "cdn\\.amplitude\\.com", weight: 0.5 },
      { signalType: "script", pattern: "amplitude\\.getInstance", weight: 0.3 },
      { signalType: "cookie", pattern: "amp_", weight: 0.2 },
    ],
  },
  {
    slug: "stripe",
    name: "Stripe",
    category: "payments",
    website: "https://stripe.com",
    fingerprints: [
      { signalType: "script", pattern: "js\\.stripe\\.com", weight: 0.6 },
      { signalType: "script", pattern: "checkout\\.stripe\\.com", weight: 0.25 },
      { signalType: "cookie", pattern: "__stripe_mid|__stripe_sid", weight: 0.15 },
    ],
  },
  {
    slug: "paypal",
    name: "PayPal",
    category: "payments",
    website: "https://www.paypal.com",
    fingerprints: [
      { signalType: "script", pattern: "paypal\\.com/sdk/js", weight: 0.6 },
      { signalType: "script", pattern: "paypalobjects\\.com", weight: 0.25 },
      { signalType: "cookie", pattern: "tsrce|x-pp-s", weight: 0.15 },
    ],
  },
  {
    slug: "klaviyo",
    name: "Klaviyo",
    category: "marketing_automation",
    website: "https://www.klaviyo.com",
    fingerprints: [
      { signalType: "script", pattern: "static\\.klaviyo\\.com", weight: 0.5 },
      { signalType: "script", pattern: "_learnq", weight: 0.3 },
      { signalType: "cookie", pattern: "__kla_id", weight: 0.2 },
    ],
  },
  {
    slug: "mailchimp",
    name: "Mailchimp",
    category: "marketing_automation",
    website: "https://mailchimp.com",
    fingerprints: [
      { signalType: "script", pattern: "list-manage\\.com|mcjs", weight: 0.5 },
      { signalType: "script", pattern: "chimpstatic\\.com", weight: 0.3 },
      { signalType: "meta", pattern: "mailchimp", weight: 0.2 },
    ],
  },
  {
    slug: "salesforce",
    name: "Salesforce",
    category: "crm",
    website: "https://www.salesforce.com",
    fingerprints: [
      { signalType: "script", pattern: "force\\.com|salesforce\\.com", weight: 0.45 },
      { signalType: "header", pattern: "set-cookie:BrowserId", weight: 0.25 },
      { signalType: "meta", pattern: "salesforce", weight: 0.3 },
    ],
  },
  {
    slug: "marketo",
    name: "Marketo",
    category: "marketing_automation",
    website: "https://business.adobe.com/products/marketo.html",
    fingerprints: [
      { signalType: "script", pattern: "munchkin\\.js", weight: 0.5 },
      { signalType: "script", pattern: "mktoResp", weight: 0.3 },
      { signalType: "cookie", pattern: "_mkto_trk", weight: 0.2 },
    ],
  },
  {
    slug: "pardot",
    name: "Pardot",
    category: "marketing_automation",
    website: "https://www.salesforce.com/products/marketing-cloud/marketing-automation/",
    fingerprints: [
      { signalType: "script", pattern: "pi\\.pardot\\.com", weight: 0.55 },
      { signalType: "script", pattern: "pardot", weight: 0.25 },
      { signalType: "cookie", pattern: "visitor_id\\d+", weight: 0.2 },
    ],
  },
  {
    slug: "hubspot-forms",
    name: "HubSpot Forms",
    category: "forms",
    website: "https://www.hubspot.com/products/forms",
    fingerprints: [
      { signalType: "script", pattern: "hsforms\\.net", weight: 0.6 },
      { signalType: "script", pattern: "hbspt\\.forms\\.create", weight: 0.2 },
      { signalType: "meta", pattern: "hs-form", weight: 0.2 },
    ],
  },
  {
    slug: "typeform",
    name: "Typeform",
    category: "forms",
    website: "https://www.typeform.com",
    fingerprints: [
      { signalType: "script", pattern: "embed\\.typeform\\.com", weight: 0.6 },
      { signalType: "script", pattern: "typeform-widget", weight: 0.2 },
      { signalType: "meta", pattern: "typeform", weight: 0.2 },
    ],
  },
];

const extendedTechNames = [
  ["woocommerce", "WooCommerce", "ecommerce"],
  ["bigcommerce", "BigCommerce", "ecommerce"],
  ["magento", "Magento", "ecommerce"],
  ["prestashop", "PrestaShop", "ecommerce"],
  ["squarespace", "Squarespace", "cms"],
  ["ghost", "Ghost", "cms"],
  ["contentful", "Contentful", "cms"],
  ["sanity", "Sanity", "cms"],
  ["prismic", "Prismic", "cms"],
  ["contentstack", "Contentstack", "cms"],
  ["adobe-analytics", "Adobe Analytics", "analytics"],
  ["heap", "Heap", "analytics"],
  ["fullstory", "FullStory", "analytics"],
  ["crazy-egg", "Crazy Egg", "analytics"],
  ["matomo", "Matomo", "analytics"],
  ["clicky", "Clicky", "analytics"],
  ["segment-personas", "Segment Personas", "analytics"],
  ["vwo", "VWO", "analytics"],
  ["optimizely", "Optimizely", "experimentation"],
  ["google-optimize", "Google Optimize", "experimentation"],
  ["unbounce", "Unbounce", "landing_pages"],
  ["instapage", "Instapage", "landing_pages"],
  ["leadpages", "Leadpages", "landing_pages"],
  ["activecampaign", "ActiveCampaign", "marketing_automation"],
  ["brevo", "Brevo", "marketing_automation"],
  ["omnisend", "Omnisend", "marketing_automation"],
  ["constant-contact", "Constant Contact", "marketing_automation"],
  ["customer-io", "Customer.io", "marketing_automation"],
  ["iterable", "Iterable", "marketing_automation"],
  ["convertkit", "ConvertKit", "marketing_automation"],
  ["braze", "Braze", "marketing_automation"],
  ["ontraport", "Ontraport", "marketing_automation"],
  ["zoho-crm", "Zoho CRM", "crm"],
  ["pipedrive", "Pipedrive", "crm"],
  ["freshsales", "Freshsales", "crm"],
  ["close-crm", "Close CRM", "crm"],
  ["monday-sales-crm", "monday Sales CRM", "crm"],
  ["aircall", "Aircall", "crm"],
  ["calendly", "Calendly", "scheduling"],
  ["acuity-scheduling", "Acuity Scheduling", "scheduling"],
  ["salesloft", "Salesloft", "sales_engagement"],
  ["outreach", "Outreach", "sales_engagement"],
  ["gong", "Gong", "sales_engagement"],
  ["clearbit", "Clearbit", "data_enrichment"],
  ["apollo", "Apollo", "data_enrichment"],
  ["6sense", "6sense", "intent_data"],
  ["demandbase", "Demandbase", "intent_data"],
  ["terminus", "Terminus", "abm"],
  ["rollworks", "RollWorks", "abm"],
  ["insider", "Insider", "personalization"],
  ["dynamic-yield", "Dynamic Yield", "personalization"],
  ["nosto", "Nosto", "personalization"],
  ["yotpo", "Yotpo", "reviews"],
  ["trustpilot", "Trustpilot", "reviews"],
  ["judge-me", "Judge.me", "reviews"],
  ["okendo", "Okendo", "reviews"],
  ["gorgias", "Gorgias", "support"],
  ["zendesk", "Zendesk", "support"],
  ["freshdesk", "Freshdesk", "support"],
  ["helpscout", "Help Scout", "support"],
  ["intercom-help", "Intercom Help Center", "support"],
  ["livechat", "LiveChat", "chat"],
  ["tawk-to", "Tawk.to", "chat"],
  ["crisp", "Crisp", "chat"],
  ["olark", "Olark", "chat"],
  ["smartsupp", "Smartsupp", "chat"],
  ["recharge", "Recharge", "subscriptions"],
  ["bold-subscriptions", "Bold Subscriptions", "subscriptions"],
  ["chargebee", "Chargebee", "billing"],
  ["recurly", "Recurly", "billing"],
  ["paddle", "Paddle", "payments"],
  ["adyen", "Adyen", "payments"],
  ["braintree", "Braintree", "payments"],
  ["klarna", "Klarna", "payments"],
  ["afterpay", "Afterpay", "payments"],
  ["affirm", "Affirm", "payments"],
  ["segment-cdp", "Segment CDP", "cdp"],
  ["rudderstack", "RudderStack", "cdp"],
  ["snowplow", "Snowplow", "analytics"],
  ["posthog", "PostHog", "analytics"],
  ["sentry", "Sentry", "error_tracking"],
  ["rollbar", "Rollbar", "error_tracking"],
  ["new-relic-browser", "New Relic Browser", "monitoring"],
  ["datadog-rum", "Datadog RUM", "monitoring"],
  ["cloudflare", "Cloudflare", "cdn"],
  ["akamai", "Akamai", "cdn"],
  ["fastly", "Fastly", "cdn"],
];

function simpleFingerprints(slug) {
  const token = slug.replace(/-/g, "[\\._-]?");
  return [
    { signalType: "script", pattern: token, weight: 0.45 },
    { signalType: "meta", pattern: token, weight: 0.25 },
    { signalType: "header", pattern: `server:${token}|x-powered-by:${token}`, weight: 0.3 },
  ];
}

async function ensureTechnology(client, tech) {
  const result = await client.query(
    `
      INSERT INTO technologies (slug, name, category, website, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        website = EXCLUDED.website,
        updated_at = NOW()
      RETURNING id
    `,
    [tech.slug, tech.name, tech.category, tech.website ?? null],
  );
  return result.rows[0].id;
}

async function clearTechnologyFingerprints(client, technologyId) {
  await client.query(`DELETE FROM fingerprints WHERE technology_id = $1`, [technologyId]);
}

async function insertFingerprint(client, technologyId, fp) {
  await client.query(
    `
      INSERT INTO fingerprints (
        technology_id,
        signal_type,
        pattern,
        confidence_weight,
        version_capture,
        implies_json,
        requires_json,
        excludes_json,
        active,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, TRUE, NOW())
    `,
    [technologyId, fp.signalType, fp.pattern, fp.weight],
  );
}

async function run() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const tech of coreTechs) {
      const technologyId = await ensureTechnology(client, tech);
      await clearTechnologyFingerprints(client, technologyId);
      for (const fp of tech.fingerprints) {
        await insertFingerprint(client, technologyId, fp);
      }
    }

    for (const [slug, name, category] of extendedTechNames) {
      const technologyId = await ensureTechnology(client, {
        slug,
        name,
        category,
        website: null,
      });
      await clearTechnologyFingerprints(client, technologyId);
      for (const fp of simpleFingerprints(slug)) {
        await insertFingerprint(client, technologyId, fp);
      }
    }

    await client.query("COMMIT");
    console.log(
      `Seeded ${coreTechs.length + extendedTechNames.length} technologies and fingerprint rules.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Fingerprint seed failed:", error);
  process.exit(1);
});
