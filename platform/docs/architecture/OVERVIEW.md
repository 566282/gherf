# Architecture Overview

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **State Management**: Zustand (auth), React Query (data)
- **Backend**: Supabase (Auth + PostgreSQL + Storage)
- **Deployment**: Netlify
- **Version Control**: GitHub

## Project Structure

```
platform/
├── src/
│   ├── app/
│   │   ├── router/          # Route definitions with role guards
│   │   ├── providers/       # Global context providers
│   │   └── layouts/         # Page layouts (PublicLayout, AppLayout, AdminLayout)
│   ├── features/
│   │   ├── auth/            # Authentication pages & forms
│   │   ├── dashboard/       # User dashboard
│   │   ├── campaigns/       # Campaign browsing & management
│   │   ├── rewards/         # Reward pages
│   │   ├── admin/           # Admin pages
│   │   └── errors/          # Error pages (404, 403, etc)
│   ├── components/
│   │   └── ui/              # Reusable UI components (Button, Card, etc)
│   ├── services/
│   │   ├── supabase.ts      # Supabase client init & auth ops
│   │   └── auth.ts          # Profile & RBAC operations
│   ├── stores/
│   │   └── auth.ts          # Zustand auth state store
│   ├── hooks/
│   │   ├── useAuth.ts       # Auth & permissions hooks
│   │   └── ProtectedRoute.tsx  # Route protection wrapper
│   ├── types/
│   │   └── index.ts         # All TypeScript types & enums
│   ├── lib/                 # Utility functions (validation, constants)
│   └── styles/              # Global CSS & Tailwind config
├── supabase/
│   ├── migrations/          # Database schema migrations
│   ├── policies/            # RLS policy definitions
│   └── seed.sql             # Initial data seed
├── docs/
│   ├── architecture/        # Design docs
│   └── database/            # Schema & RLS docs
├── index.html               # Entry point
├── package.json
├── vite.config.ts
├── tsconfig.*.json
├── tailwind.config.ts
├── eslint.config.js
├── netlify.toml             # Netlify deployment config
├── .env.example
└── .env.setup.md            # Environment setup guide
```

## Data Flow

### Authentication
1. User signs up/logs in via Supabase Auth
2. Auth trigger creates profile record in `profiles` table
3. Frontend fetches user profile & role from `profiles` table
4. Zustand store caches auth state
5. React Router guards enforce role-based access

### Campaign Creation
1. Advertiser creates campaign via Business Dashboard
2. Campaign rules stored in database (not hardcoded)
3. Admin can modify rules/settings without code deployment
4. Campaign status transitions trigger audit log entries

### Task Completion & Rewards
1. User completes task, submits data
2. Task submission stored with status `pending`
3. Moderator/admin reviews & approves
4. Upon approval, reward is issued to `rewards` table
5. Reward ledger entry created for audit trail
6. User can view/claim rewards in Rewards page

## Authentication & Authorization

### Session Management
- Supabase Auth manages authentication (email/password)
- Session token stored in localStorage (Supabase SDK handles)
- `subscribeToAuthChanges()` keeps app state in sync with auth

### Role-Based Access Control (RBAC)
- Roles stored in `profiles.role` (enum)
- Routes protected by `ProtectedRoute` component
- UI elements conditionally rendered via `usePermissions()` hook
- Database enforces RLS policies at all table levels

### Roles
| Role | Capabilities |
|------|--------------|
| **super_admin** | Full platform control, user management, settings, audit logs |
| **campaign_manager** | Create/manage campaigns, review submissions, view analytics |
| **moderator** | Review task submissions, approve/reject, manage restrictions |
| **advertiser** | Create businesses, manage campaigns, view results |
| **registered_user** | Browse campaigns, complete tasks, claim rewards |
| **guest** | Public-only, no auth required |

## State Management

### Auth State (Zustand)
- Centralized auth store in `src/stores/auth.ts`
- Global hooks: `useAuth()`, `useIsAdmin()`, `useHasRole()`, etc.
- Persists session across page reloads (Supabase SDK)

### Server State (React Query)
- For campaigns, submissions, rewards (in later phases)
- Queries cached and synced with backend

### Local State (React Hooks)
- Form inputs, UI toggles, modal states

## API Layer

All API calls go through Supabase:
- **Queries**: `supabase.from('table').select()`
- **Mutations**: `.insert()`, `.update()`, `.delete()`
- **Auth**: `supabase.auth.signIn()`, `signUp()`, etc.

Typed service functions wrap Supabase calls:
- `src/services/supabase.ts` - Raw auth operations
- `src/services/auth.ts` - Profile & role operations
- Typed return values enforce consistency

## Security

### Row-Level Security (RLS)
- ALL tables have RLS enabled
- Policies define who can SELECT/INSERT/UPDATE/DELETE
- Users can only see their own data by default
- Admins have broader access via role checks in policies

### Environment Secrets
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`
- Never commit `.env.local` to Git
- Netlify dashboard stores production secrets

### Database-Driven Configuration
- All campaign rules, settings, thresholds in DB
- Admins modify via UI without code/deployment
- Prevents hard-coded values and keeps flexibility high

## Performance Optimizations

- Code splitting via Vite
- Lazy loading of route components
- Memoization of role/permission checks
- Database indexes on frequently queried columns
- Supabase caching (client-side SDK)

## Error Handling

- Global error boundary (in phase 2)
- Form validation via Zod
- API error messages from Supabase
- User-friendly error pages (404, 403, 500)

## Testing Strategy

- **Unit**: Utils, validators, hooks
- **Integration**: Auth flows, RLS policies, data mutations
- **E2E**: Full user journeys (signup → campaign → task → reward)
- Tools: Vitest, React Testing Library, Supabase local testing

## Deployment Pipeline

1. Push to GitHub
2. Netlify detects changes
3. Runs `npm run build` (includes `npm run typecheck`)
4. Deploys to edge network
5. Environment variables injected at build time

## Next Phases

- **Phase 2**: Auth UI implementation (login, signup, password reset)
- **Phase 3**: Campaign management UI
- **Phase 4**: Task completion & reward mechanics
- **Phase 5**: Admin control plane & full configurability
