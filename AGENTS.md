# AGENTS.md — campuspulse-frontend (`@campuspulse/web`)

Authoritative quick-reference for AI coding agents working inside `campuspulse-frontend`. For full UI/UX specs, design tokens, user flows, and backlog tickets, read `../docs/01-PRD-SYNTHESIS-AND-SCOPE-MATRIX.md` through `../docs/07-AI-AGENT-PLAYBOOK-AND-CONVENTIONS.md`.

## 1. Architecture & Non-Negotiable Product Rules

- **Stack**: Next.js 16 (App Router) · React 19 · TypeScript · TanStack Query · OpenAPI TypeScript (`src/lib/api-schema.d.ts`) · Vitest · Playwright.
- **Dev URL**: `http://localhost:3000` (expects `campuspulse-backend` on `http://localhost:3001`).
- **Four Non-Negotiables (PRD §5 & §6)**:
  1. **Public event pages (`/e/[slug]`) MUST server-render** within a `< 2.5s` cold budget for signed-out WhatsApp visitors—no auth wall, no client fetch waterfall.
  2. **Discovery, event pages, and Free RSVP MUST work in a plain browser tab** without requiring PWA installation.
  3. **QR tickets MUST render offline once loaded** (cache via `IndexedDB` + Service Worker; never refetch at the venue door).
  4. **Manual Check-In MUST ship as a peer tab right beside `[QR Scanner]`**—never hidden behind a scanner failure state.

## 2. Design System, API Client & Privacy Rules

- **Generated API Types Only**: Never hand-write API request/response interfaces and never manually edit `src/lib/api-schema.d.ts`. Run `npm run codegen` (from local `../campuspulse-backend/openapi.json`) and route all calls through `src/lib/api.ts` (`apiFetch`).
- **Semantic CSS Tokens Only**: Use CSS variables from `src/styles/tokens.css` (`--cp-ink`, `--cp-purple`, `--cp-lavender`, `--color-*`, `--status-*`)—never hardcode hex literals in components. Keep mobile form inputs `>= 16px` (`var(--text-base)`) to prevent iOS Safari zoom.
- **NDPA 2023 Privacy**: Never place student emails in URLs, query strings, `console.log`, or analytics payloads. Student ID images are rendered exclusively in the Super Admin portal's non-downloadable ephemeral viewer.

## 3. Git Hooks, Commit Scopes & Verification

- **Allowed Commit Scopes (`commitlint.config.cjs`)**: `events`, `identity`, `attendance`, `admin`, `health`, `contract`, `db`, `ci`, `docker`, `deps`, `config`, `docs`.
- **Zero-Warning & TODO Rules**: ESLint enforces `--max-warnings=0`. Every `TODO` or `FIXME` must cite a ticket ID (`// TODO(S4-02): ...`). No `.only` or `debugger`.
- **Pre-PR Gate**:
  ```bash
  npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
  ```
