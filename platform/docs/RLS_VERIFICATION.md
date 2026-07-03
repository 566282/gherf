# RLS Verification Guide

## Objective

Confirm Supabase Row Level Security is enforced for every user-facing table and that the frontend never depends on unrestricted access.

## What To Verify

- Tables with user-owned data only return the current user's rows.
- Admin roles can access only the rows their policies explicitly allow.
- Insert, update, and delete actions fail without the matching policy.
- Direct SQL access from the client fails if the policy is missing.

## Manual Checks

1. Sign in as a regular user and confirm only your records are visible.
2. Sign in as an admin and confirm policy-bounded elevated access works.
3. Attempt to read another user's record from the browser console and confirm it fails.
4. Attempt to write to a protected table without the proper role and confirm it fails.

## Release Gate

- Review the SQL migration files before each deployment.
- Confirm indexes exist for the most common filters and sort orders.
- Re-run verification when a new table or role is added.
