# Phase 10: Analytics and Reporting

## Scope Delivered

This phase adds an admin analytics suite with export-ready reporting for:

- User growth
- Active users
- Revenue
- Campaign performance
- Reward distribution
- Withdrawal statistics
- Referral performance
- Geographic statistics
- Device statistics
- Browser statistics
- Conversion funnels

## Frontend Surface

### Admin page

- Route: /admin/analytics
- File: src/features/admin/pages/AnalyticsReportingPage.tsx
- Features:
  - Time range controls (7, 30, 90 days)
  - KPI summary cards
  - Dashboard sections for all requested analytics domains
  - Export scope selector (single dashboard or full suite)
  - Export buttons for CSV, Excel, and PDF

### Navigation

- Admin sidebar entry:
  - Analytics -> /admin/analytics

## API Layer

### Analytics aggregation

- File: src/services/api/analytics.ts
- Function: listAnalyticsReport(rangeDays)
- Data sources:
  - profiles
  - campaigns
  - campaign_tasks
  - task_submissions
  - rewards
  - withdrawal_requests
  - wallet_transactions
- Output:
  - Unified AnalyticsReport object containing all Phase 10 dashboard collections

### Report export utilities

- File: src/services/export/reportExport.ts
- Function: exportAnalyticsReport(report, format, dataset)
- Supports:
  - CSV export
  - Excel export (XLSX workbook)
  - PDF export (table summaries)

## Operational Notes

- Export supports either one dashboard or the entire suite.
- Dataset-level exports use normalized column names for compatibility with BI tools.
- Geographic, device, and browser dimensions are inferred from submission payload metadata when present.
- When some source tables are empty, dashboards still render with safe empty states.
