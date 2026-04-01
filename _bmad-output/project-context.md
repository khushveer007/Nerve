---
project_name: 'Nerve'
user_name: 'Opsa'
date: '2026-04-02T04:27:20+05:30'
sections_completed: ['technology_stack']
existing_patterns_found: 8
status: 'discovery_complete'
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- Frontend: `Vite 5.4.19`, `React 18.3.1`, `TypeScript 5.8.3`, `React Router 6.30.1`, `TanStack React Query 5.83.0`
- UI: `Tailwind CSS 3.4.17`, `tailwindcss-animate 1.0.7`, Radix UI primitives, shadcn/ui-style components under `src/components/ui`, `Lucide React 0.462.0`
- Server/API: `Express 4.21.2`, `express-session 1.18.1`, `connect-pg-simple 10.0.0`, `pg 8.16.3`, `Zod 3.25.76`
- Database/runtime: PostgreSQL 16 via `pgvector/pgvector:pg16`; current frontend runtime is local-first and browser-driven; retained Supabase schema/functions remain in-repo but `src/integrations/supabase/client.ts` is currently stubbed/disconnected
- Testing/tooling: `Vitest 3.2.4`, `@testing-library/react 16.0.0`, `jsdom 20.0.3`, `Playwright 1.57.0`, `ESLint 9.32.0`, `@vitejs/plugin-react-swc 3.11.0`, `tsx 4.20.3`

## Critical Implementation Rules

_Discovery complete. Detailed implementation rules will be added in the next workflow step._
