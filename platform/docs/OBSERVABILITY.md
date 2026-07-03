# Observability

## Current State

- Runtime errors are logged through a centralized helper.
- The app has a global render error boundary with a recovery UI.
- GitHub Actions captures CI failures during validation and deploy steps.

## Recommended Production Setup

- Send client error logs to a real error tracking service once one is selected.
- Keep deployment notifications visible in the release channel.
- Track Web Vitals and key auth/checkout-style flows in a dashboard.
- Correlate frontend failures with Supabase and Netlify release timestamps.

## Logging Rules

- Do not log secrets, tokens, or raw credential payloads.
- Log the error message, context, and enough metadata to reproduce the issue.
- Prefer structured logs over free-form strings when a sink supports them.
