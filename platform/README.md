# Campaign Reward Platform

A modern, production-ready Business Marketing Platform where businesses create marketing campaigns and users earn rewards by completing campaign tasks.

## Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn
- Supabase account (https://supabase.com)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start development server
npm run dev
```

The app will run at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview
```

## Scripts

```bash
npm run dev           # Start dev server
npm run build         # Build for production
npm run preview       # Preview production build
npm run typecheck     # Type checking
npm run lint          # Lint code
npm run test          # Run tests
npm run test:watch    # Run tests in watch mode
npm run format        # Check code formatting
```

## Architecture

See [docs/architecture/OVERVIEW.md](docs/architecture/OVERVIEW.md) for:
- Project structure
- Tech stack details
- Authentication & authorization
- State management
- Security practices
- Deployment pipeline

## Database Schema

See [docs/database/SCHEMA_AND_RLS.md](docs/database/SCHEMA_AND_RLS.md) for:
- Complete table definitions
- Row-Level Security (RLS) policies
- Indexes and performance considerations
- Migration and seeding instructions

## Environment Setup

See [.env.setup.md](.env.setup.md) for:
- Required environment variables
- Supabase project setup
- Development & production configuration
- Security notes

## Features

### Authentication & Authorization
- ✅ Supabase Auth (email/password)
- ✅ Role-based access control (6 roles)
- ✅ Protected routes with role guards
- ✅ Row-Level Security at database level

### Campaign Management
- 🔲 Create/edit campaigns (with database-driven rules)
- 🔲 Campaign status lifecycle management
- 🔲 Task templates and generation
- 🔲 Budget tracking and limits

### User Experience
- 🔲 Browse active campaigns
- 🔲 Complete tasks and submit data
- 🔲 Earn and track rewards
- 🔲 View reward history and balance
- 🔲 Daily login, streaks, XP, achievements, and seasonal rewards

### Admin Control Plane
- 🔲 User management and role assignment
- 🔲 Campaign moderation
- 🔲 Submission review & approval
- 🔲 Platform settings (all configurable, no code changes)
- 🔲 Audit logs for compliance
- 🔲 Gamification controls for daily login, streaks, XP, wheels, missions, and events
- 🔲 Communication system (internal messaging, email/push/SMS templates, live announcements, promotional notifications)

### Data-Driven Configurability
- ✅ Campaign rules stored in database
- ✅ All settings editable via admin UI
- ✅ No hard-coded thresholds or limits
- ✅ Audit trail for all changes

## Testing

```bash
npm run test          # Run all tests once
npm run test:watch    # Run tests in watch mode
```

Test coverage includes:
- Unit tests for utilities and hooks
- Integration tests for auth and RLS
- E2E tests for critical user journeys

## Deployment

### Netlify

1. Connect your GitHub repo to Netlify
2. Set environment variables in Netlify dashboard
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy!

See `netlify.toml` for deployment configuration.

## Security

- All authentication handled by Supabase Auth
- Row-Level Security policies enforce access control at database level
- Admin actions logged and auditable
- Environment variables for all secrets
- No hard-coded credentials or API keys

## Development Phases

- ✅ **Phase 0**: Tooling, build config, Tailwind, TypeScript, ESLint
- ✅ **Phase 1**: Auth architecture, RBAC, database schema, RLS policies, protected routes
- 🔲 **Phase 2**: Auth UI (login, signup, password reset)
- 🔲 **Phase 3**: Campaign management UI
- 🔲 **Phase 4**: Task completion & rewards mechanics
- 🔲 **Phase 5**: Admin control plane & platform settings UI
- 🔲 **Phase 8**: Gamification systems (daily login, streaks, achievements, XP, levels, leaderboards, lucky wheel, mystery rewards, missions, seasonal events, daily quests)
- 🔲 **Phase 9**: Communication system (internal messaging, editable email/push/SMS templates, live announcements, promotional notifications)

## Project Structure

```
platform/
├── src/
│   ├── app/               # Router, layouts, providers
│   ├── features/          # Feature modules (auth, campaigns, etc)
│   ├── components/ui/     # Reusable UI components
│   ├── services/          # API and Supabase services
│   ├── stores/            # Zustand state management
│   ├── hooks/             # Custom React hooks
│   ├── types/             # TypeScript types & enums
│   ├── lib/               # Utilities
│   └── styles/            # Global CSS & Tailwind
├── supabase/              # Database migrations & policies
├── docs/                  # Architecture & database docs
└── [config files]
```

## Tech Stack

- **Frontend**: React 18 + TypeScript 5
- **Build**: Vite
- **Styling**: TailwindCSS 3
- **State**: Zustand + React Query (planned)
- **Backend**: Supabase (Auth + PostgreSQL + Storage)
- **Testing**: Vitest + React Testing Library
- **Deployment**: Netlify
- **Code Quality**: ESLint + Prettier + TypeScript

## Contributing

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Follow the existing code style (ESLint/Prettier)
3. Add tests for new functionality
4. Commit with clear messages: `feat: add feature description`
5. Push and create a pull request

## Troubleshooting

### Build Issues
- Clear `node_modules` and `dist`: `rm -rf node_modules dist && npm install`
- Check Node version: `node --version` (should be 20+)

### Type Errors
- Run `npm run typecheck` to see all issues
- Check that `.env.local` exists with valid Supabase keys

### Environment Variables
- Copy `.env.example` to `.env.local` (must be local, not committed)
- Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Frontend can only access variables starting with `VITE_`

## License

Private project. All rights reserved.

## Support

For issues or questions:
1. Check documentation in `docs/`
2. Review existing GitHub issues
3. Create a new issue with details
