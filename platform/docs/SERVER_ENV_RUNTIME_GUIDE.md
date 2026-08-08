# Server Environment Runtime Guide

This document is the single source of truth for server-side environment behavior in local development and live deployment.

## Purpose

Avoid environment mix-ups between:
- local development server runtime
- live Netlify Functions runtime

## Local Server Runtime

Use this path for codespaces and local machines.

### Runtime entry files

- netlify/functions/create-admin-user.ts
- src/server/adminCreateUser.ts
- netlify.toml (dev section)

### Local environment files

- .env.local
- .env.example
- .env.setup.md

### Required local server variables

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

### Local behavior rules

- Client app values come from VITE_* keys.
- Server function values are read from process env first.
- In non-production runtime only, the admin create-user handler can fallback to reading .env.local and .env when process env was not injected.

## Live Server Runtime (Netlify Production/Preview)

Use this path for deployed environments.

### Runtime entry files

- netlify/functions/create-admin-user.ts
- src/server/adminCreateUser.ts
- netlify.toml (build/functions)

### Deployment wiring files

- .github/workflows/ci.yml
- .github/workflows/ci-deploy.yml
- netlify.toml

### Required live runtime variables

- SUPABASE_URL (or VITE_SUPABASE_URL)
- SUPABASE_SERVICE_ROLE_KEY

### Required live client build variables

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_APP_ENV=production
- VITE_APP_PUBLIC_URL

### Live behavior rules

- Netlify Functions must receive server variables at runtime.
- Build variables alone do not satisfy server runtime requirements.
- Do not rely on .env.local in live environments.

## Runtime Indication (No Secret Leakage)

The admin create-user function returns runtime indicators in every response.

### Response headers

- X-Admin-Create-User-Runtime-Mode
- X-Admin-Create-User-Env-Source

### Runtime mode values

- netlify:production
- netlify:deploy-preview
- netlify:branch-deploy
- production
- local

### Env source values

- process
- local-file
- missing

These values identify where configuration was loaded from without exposing any credential value.

## Quick Verification

### Local

1. Start local runtime.
2. Call /.netlify/functions/create-admin-user.
3. Verify response headers indicate local mode and expected env source.

### Live

1. Confirm Netlify environment variables exist in the correct context.
2. Deploy.
3. Call /.netlify/functions/create-admin-user.
4. Verify response headers indicate netlify:production or the expected Netlify context and process env source.

## Ownership

If environment behavior changes, update this file first, then update any linked docs.
