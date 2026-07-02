# Database Schema & RLS Policies

## Overview

The Business Marketing Platform uses PostgreSQL via Supabase with Row-Level Security (RLS) enforcing all access control at the database level.

## Tables

### profiles
Extends Supabase `auth.users` with role and metadata.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, references auth.users |
| email | TEXT | From auth.users |
| full_name | TEXT | User's display name |
| avatar_url | TEXT | Optional profile picture URL |
| role | user_role enum | super_admin \| campaign_manager \| moderator \| advertiser \| registered_user \| guest |
| status | user_status enum | active \| suspended \| pending_approval |
| created_at | TIMESTAMPTZ | Auto-set |
| updated_at | TIMESTAMPTZ | Auto-updated on changes |

**RLS Policies**:
- Users can view their own profile
- Admins (super_admin, campaign_manager, moderator) can view all
- Users can update their own profile (except role/status)
- super_admin can update any profile

---

### businesses
Represents an advertiser's business entity.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| owner_id | UUID | FK to profiles (advertiser) |
| name | TEXT | Business name |
| description | TEXT | Optional description |
| logo_url | TEXT | Optional logo |
| website | TEXT | Optional website URL |
| status | TEXT | active \| suspended \| archived |
| created_at | TIMESTAMPTZ | Auto-set |
| updated_at | TIMESTAMPTZ | Auto-updated |

**RLS Policies**:
- Owners can view and update their own businesses
- Admins can view all businesses

---

### campaigns
Marketing campaigns created by advertisers.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| business_id | UUID | FK to businesses |
| title | TEXT | Campaign name |
| description | TEXT | Campaign description |
| banner_url | TEXT | Optional campaign image |
| status | campaign_status enum | draft \| scheduled \| active \| paused \| completed \| archived |
| start_date | TIMESTAMPTZ | Campaign start time |
| end_date | TIMESTAMPTZ | Campaign end time |
| budget | DECIMAL(15,2) | Total budget for campaign |
| budget_currency | TEXT | Currency code (USD, etc) |
| total_rewards_allocated | DECIMAL(15,2) | Sum of all rewards issued |
| max_participants | INTEGER | Optional max users |
| current_participants | INTEGER | Count of unique participants |
| created_at | TIMESTAMPTZ | Auto-set |
| updated_at | TIMESTAMPTZ | Auto-updated |

**RLS Policies**:
- Business owners can view their campaigns
- Admins (campaign_manager+) can view all campaigns

---

### campaign_rules
Database-driven configuration for each campaign. Allows admins to modify behavior without code.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| campaign_id | UUID | FK to campaigns |
| rule_key | TEXT | Config key (e.g., "max_tasks_per_user") |
| rule_value | JSONB | Config value (flexible type) |
| description | TEXT | Human-readable explanation |
| created_at | TIMESTAMPTZ | Auto-set |
| updated_at | TIMESTAMPTZ | Auto-updated |

**Example Rules**:
```json
{
  "campaign_id": "...",
  "rule_key": "max_tasks_per_user",
  "rule_value": 5
}
```

---

### campaign_tasks
Individual tasks within a campaign.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| campaign_id | UUID | FK to campaigns |
| title | TEXT | Task title |
| description | TEXT | Task instructions |
| task_type | TEXT | click \| survey \| video \| form \| custom |
| media_url | TEXT | Optional task media (image/video) |
| reward_amount | DECIMAL(10,2) | Amount user earns upon approval |
| max_completions | INTEGER | Optional total allowed completions |
| current_completions | INTEGER | Current completion count |
| status | task_status enum | draft \| active \| paused \| completed |
| created_at | TIMESTAMPTZ | Auto-set |
| updated_at | TIMESTAMPTZ | Auto-updated |

---

### task_submissions
User submissions for tasks (pending review or approved).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| task_id | UUID | FK to campaign_tasks |
| user_id | UUID | FK to profiles |
| submission_data | JSONB | Flexible data (answers, metadata, etc) |
| status | submission_status enum | pending \| approved \| rejected |
| reviewed_by | UUID | FK to profiles (moderator) |
| reviewed_at | TIMESTAMPTZ | Timestamp of review |
| rejection_reason | TEXT | Reason if rejected |
| created_at | TIMESTAMPTZ | Auto-set |
| updated_at | TIMESTAMPTZ | Auto-updated |

**Constraint**: UNIQUE(task_id, user_id) - one submission per user per task.

**RLS Policies**:
- Users can view their own submissions
- Admins/moderators can view all submissions
- Admins can update submissions (approve/reject)

---

### rewards
Rewards issued to users for completing approved tasks.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK to profiles |
| campaign_id | UUID | FK to campaigns |
| task_id | UUID | FK to campaign_tasks (optional, can be null) |
| amount | DECIMAL(10,2) | Reward amount |
| currency | TEXT | Currency code |
| status | reward_status enum | pending \| approved \| claimed \| refunded |
| expires_at | TIMESTAMPTZ | Optional expiry date |
| created_at | TIMESTAMPTZ | Auto-set |
| updated_at | TIMESTAMPTZ | Auto-updated |

**RLS Policies**:
- Users can view their own rewards
- Admins can view all rewards

---

### reward_ledger
Complete audit trail of all reward transactions (issued, approved, claimed, refunded).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK to profiles |
| reward_id | UUID | FK to rewards |
| action | TEXT | issued \| approved \| claimed \| refunded |
| amount | DECIMAL(10,2) | Amount in this transaction |
| reason | TEXT | Optional reason/notes |
| performed_by | UUID | FK to profiles (admin who performed action) |
| created_at | TIMESTAMPTZ | Auto-set (immutable) |

**Note**: This table is append-only (no updates/deletes) for audit integrity.

---

### admin_action_audit
Comprehensive audit trail for all admin operations (suspend user, pause campaign, etc).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| admin_id | UUID | FK to profiles (admin) |
| action | TEXT | Action performed (e.g., "user_suspend", "campaign_pause") |
| resource_type | TEXT | Resource type (e.g., "user", "campaign") |
| resource_id | UUID | ID of affected resource |
| old_values | JSONB | Previous values |
| new_values | JSONB | New values |
| reason | TEXT | Admin's reason |
| created_at | TIMESTAMPTZ | Auto-set (immutable) |

**RLS Policies**:
- Only super_admin can view

---

### platform_settings
Configurable platform-wide settings (feature flags, thresholds, limits).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| key | TEXT | Setting key (UNIQUE) |
| value | JSONB | Setting value (flexible) |
| description | TEXT | Purpose of setting |
| updated_by | UUID | FK to profiles (admin) |
| updated_at | TIMESTAMPTZ | Auto-updated |

**Example Settings**:
```json
{
  "key": "max_daily_reward_payout",
  "value": 10000,
  "description": "Max total rewards per day (in cents)"
}
```

---

## Indexes

All frequently queried columns are indexed:
- `profiles.role`
- `profiles.status`
- `businesses.owner_id`
- `campaigns.business_id`, `campaigns.status`
- `campaign_tasks.campaign_id`
- `task_submissions.task_id`, `task_submissions.user_id`, `task_submissions.status`
- `rewards.user_id`, `rewards.campaign_id`
- `reward_ledger.user_id`
- `admin_action_audit.admin_id`, `admin_action_audit.created_at`

---

## RLS Policies Summary

| Table | User Can | Campaign Manager/Admin Can | Super Admin Can |
|-------|----------|---------------------------|-----------------|
| profiles | View own | View all | CRUD all |
| businesses | View own | View all | CRUD all |
| campaigns | View own's | View all | CRUD all |
| campaign_rules | Read own's | Read all | CRUD all |
| campaign_tasks | Read active | Read all | CRUD all |
| task_submissions | View own | Review all | CRUD all, view all |
| rewards | View own | View all | CRUD all |
| reward_ledger | View own | View all | View all |
| admin_action_audit | — | — | View all |
| platform_settings | — | — | View/update all |

---

## Migration & Seeding

### Running Migrations
```bash
npm run db:migrate
```

This runs the SQL in `supabase/migrations/001_initial_schema.sql`.

### Seeding Data
```bash
npm run db:seed
```

Inserts initial admin user, test businesses, and sample campaigns (optional for development).

---

## Performance Considerations

1. **Indexing**: All FK and commonly filtered columns indexed
2. **Partitioning**: Consider partitioning `reward_ledger` and `admin_action_audit` by date if they grow large
3. **Archiving**: Old campaigns/submissions can be archived to improve query speed
4. **Query Optimization**: Use SELECT with specific columns, not SELECT *
5. **RLS Overhead**: Minimal; policies are simple index-friendly checks

---

## Security Practices

1. **RLS First**: All access controlled at DB level, not application level
2. **No Direct SQL**: Use Supabase client SDK with typed service functions
3. **Audit Trail**: All admin actions logged; reward changes tracked in ledger
4. **Immutable Ledgers**: `reward_ledger` and `admin_action_audit` are append-only
5. **Soft Deletes**: Use status/archive fields instead of hard deletes for audit trail
