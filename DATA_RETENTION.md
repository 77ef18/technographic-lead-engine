# Data Retention Policy

## Retention Window

- Crawl artifacts (`crawl_pages`): 12 months
- Detection records (`detections`): 12 months
- Enrichment snapshots (`enrichments`): 12 months
- Lead lists and entries: retained until deletion request
- API key metadata (`api_keys`): retained while account active

## Deletion Strategy

- Domain deletion should cascade to crawl jobs, pages, detections, and enrichments.
- Archived domains can be excluded from scheduled recrawls.

## Compliance Boundaries

- Only public web metadata/signals are collected.
- No authenticated or private content scraping.
