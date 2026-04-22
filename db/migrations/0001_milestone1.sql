CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived'))
);

CREATE TABLE IF NOT EXISTS crawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL CHECK (trigger IN ('manual', 'schedule', 'api')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'retrying')),
  attempts INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS technologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technology_id UUID NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('html', 'script', 'header', 'cookie', 'meta', 'dns', 'tls', 'dom', 'js')),
  pattern TEXT NOT NULL,
  confidence_weight NUMERIC(3,2) NOT NULL CHECK (confidence_weight >= 0 AND confidence_weight <= 1),
  version_capture TEXT,
  implies_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  requires_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  excludes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crawl_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_job_id UUID NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  html_hash TEXT,
  headers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  cookies_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  scripts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  crawl_job_id UUID NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  technology_id UUID NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  version TEXT,
  matched_signals_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_current BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  crawl_job_id UUID NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  language TEXT,
  country TEXT,
  region TEXT,
  linkedin_url TEXT,
  x_url TEXT,
  facebook_url TEXT,
  dns_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  tls_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  filter_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_list_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_list_id UUID NOT NULL REFERENCES lead_lists(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_list_id, domain_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  rate_limit_per_min INTEGER NOT NULL DEFAULT 60,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_domain_status_created ON crawl_jobs(domain_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_detections_domain_current_conf ON detections(domain_id, is_current, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_detections_tech_current ON detections(technology_id, is_current);
CREATE INDEX IF NOT EXISTS idx_enrichments_domain_created ON enrichments(domain_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_detections_domain_tech_current_unique ON detections(domain_id, technology_id) WHERE is_current = TRUE;
