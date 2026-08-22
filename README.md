# campuspulse-frontend

The CampusPulse web app — attendee feed, organizer portal, and super admin.

Next.js (App Router) · React 19 · TypeScript · Deployed to [Vercel](https://vercel.com).
Stack rationale: [ADR 0001](https://github.com/CampusPulse-dev/campuspulse-backend/blob/main/docs/adr/0001-tech-stack.md).

## Quick start

```bash
git clone https://github.com/CampusPulse-dev/campuspulse-frontend.git
cd campuspulse-frontend
npm ci
cp .env.example .env.local
npm run dev
```

Runs on `http://localhost:3000`. It expects
[`campuspulse-backend`](https://github.com/CampusPulse-dev/campuspulse-backend)
on `http://localhost:3001` — start that first.

## Layout

```
src/
├── app/          App Router routes, layouts, server components
├── components/   shared UI
├── lib/          api client, hooks, utilities
└── styles/
e2e/              Playwright specs
```

## Non-negotiables from the PRD

These are product requirements, not preferences. Check them before opening a PR.

**Public event pages must server-render.** A link forwarded into a WhatsApp
group has to open a real, fast page for a signed-out visitor — no client
fetch waterfall, no auth gate. Cold load budget is **2.5s** (PRD §6).

**All three discovery steps work in a plain browser tab.** Feed, event page
and RSVP cannot require the site to be installed. Most iOS users never will.

**The QR ticket renders offline once loaded.** Cache it; do not refetch it at
the door on a saturated network.

**Manual check-in ships beside the scanner, always.** It is a peer tab, not a
hidden fallback. Never gate it behind the scanner failing.

## The API contract

Types come from
[`@campuspulse/contract`](https://github.com/CampusPulse-dev/campuspulse-contract) —
the same schemas the backend validates with. Do not hand-write a request or
response type; import it, and if the shape you need is missing, change the
contract.

All requests go through [`src/lib/api.ts`](src/lib/api.ts), which parses
responses against the contract schema. A backend change that breaks the
contract throws there loudly instead of becoming `undefined` three
components deeper.

## Commands

| Command                     | What it does                          |
| --------------------------- | ------------------------------------- |
| `npm run dev`               | Dev server                            |
| `npm run build` / `start`   | Production build and serve            |
| `npm run lint` / `lint:fix` | ESLint                                |
| `npm run typecheck`         | `tsc --noEmit`                        |
| `npm test`                  | Vitest                                |
| `npm run test:e2e`          | Playwright (Chromium + mobile Safari) |

## Conventions

**Branches:** `<type>/<ticket>-<slug>` — `feat/S2-03-story-viewer`.

**Commits:** Conventional Commits with an enforced scope, checked by a
`commit-msg` hook.

**Git hooks** (Husky, installed by `npm ci`):

| Hook         | Runs                                |
| ------------ | ----------------------------------- |
| `pre-commit` | `lint-staged` + debug-leftover scan |
| `commit-msg` | commitlint                          |
| `pre-push`   | typecheck + tests                   |

The pre-commit scan blocks `debugger`, focused tests (`.only`), and any
`TODO`/`FIXME` without a ticket reference — write `// TODO(S2-03): …`.

## Data protection

Student emails are personal data under the Nigeria Data Protection Act.
Never put one in a URL, a query string, an analytics event, or a
`console.log`. ID photos are never fetched by this app at all — only the
Super Admin portal views them, through short-lived server-rendered views.

## CI/CD

| Workflow       | Trigger          | Does                                          |
| -------------- | ---------------- | --------------------------------------------- |
| `ci.yml`       | PR, push to main | Lint, types, format, tests, build, Playwright |
| `security.yml` | PR, push, weekly | CodeQL, gitleaks, `npm audit`                 |
| `release.yml`  | `v*.*.*` tag     | Changelog from conventional commits           |

Vercel builds every PR into a preview deployment; production promotion is
manual.
