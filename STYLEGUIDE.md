# Style Guide

> Code style and conventions for the AG Synergy Platform.

## Language: TypeScript
All production code is TypeScript. No plain JavaScript outside of build scripts.

## Formatting
- **Formatter:** Prettier
- **Line width:** 100 characters
- **Indentation:** 2 spaces
- **Quotes:** Single quotes (`'`)
- **Semicolons:** Required
- **Trailing commas:** Always (ES5)

## Naming
| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `user-service.ts` |
| Components | PascalCase | `DashboardView.tsx` |
| Functions | camelCase | `getUserById()` |
| Constants | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| Types/Interfaces | PascalCase | `UserProfile` |
| Database tables | snake_case | `user_profiles` |
| API endpoints | kebab-case | `/api/user-profiles` |

## Imports
- Library imports first, then local imports
- No circular imports
- Prefer named exports over default exports

## React
- Functional components only (no class components)
- Hooks for state and side effects
- One component per file (except small helpers)
- Props interfaces exported

## Git
- **Branch:** `main` (trunk-based)
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`)
- **PRs:** Required for all changes; squash merge

## Linting
- ESLint with TypeScript rules
- CI enforces lint on all PRs