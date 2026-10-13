# TrackRoster frontend UI/UX audit

**Audit date:** 2026-10-09  
**Branch:** `dev-v2`  
**Scope:** Next.js application routes, shared UI components, theme tokens,
navigation, feedback states, responsive CSS, accessibility conventions, and
the API client boundary.

This is an evidence-based implementation audit. It separates verified defects
from design recommendations and does not change role permissions or backend
contracts.

## Current architecture and design-system inventory

- **Framework:** Next.js 16.3.4 App Router, React 19.2.8, TypeScript 5.x,
  Tailwind CSS 4 through `@import 'tailwindcss'` and an `@theme` token block.
- **Typography:** bundled Inter variable font loaded by
  `apps/web/src/app/layout.tsx`; `--font-sans` and `--font-display` are shared
  tokens.
- **Theme:** token-driven light mode with persisted account preferences and a
  `data-theme="dark"` adapter in `apps/web/src/app/globals.css`; high-contrast,
  compact-density, reduced-motion, and system reduced-motion selectors exist.
- **Shared UI:** `apps/web/src/components/ui` contains Button, LinkButton,
  TextField, SelectField, Checkbox, OTP input, Badge, Card, StatTile, Tabs,
  Alert, Dialog, ConfirmDialog, Drawer, Menu, FilterSelect, SearchInput,
  charts, skeleton-adjacent loaders, and branding primitives. Lucide React is
  the icon source.
- **Notifications:** Sonner is mounted once by the root layout. The application
  wrapper and tests are in
  `apps/web/src/lib/notifications/notify.ts` and
  `apps/web/src/lib/notifications/notify.test.ts`.
- **API boundary:** browser requests are normalized by `browserJson` into
  `ApiError`; route clients remain separate from presentation. This is the
  correct boundary for contextual toasts and inline errors.
- **Navigation:** `apps/web/src/lib/auth/navigation.ts` provides role-aware
  workspace menus and feature-readiness gates. `AppShell` owns desktop sidebar,
  mobile header/bottom navigation, route redirects, and workspace scope.
- **Roles:** platform super administrator; tenant client administrator;
  director; manager; prospector; observer/auditor. Effective access also
  depends on tenant, organization, team, campaign, and territory.
- **UI libraries:** no Radix or shadcn dependency is installed. The repository
  has a coherent custom component layer; adding a second component system would
  increase drift.

## What is already working well

1. The role-aware navigation is a real authorization-aware presentation layer,
   while backend authorization remains authoritative.
2. The design tokens cover brand, surface, text, status, elevation, motion, and
   dark-mode overrides instead of scattering most application colors in JSX.
3. Buttons, fields, alerts, dialogs, drawers, and menus are reusable and have
   loading, disabled, focus, or keyboard behavior in the shared layer.
4. Dialog and drawer focus trapping, Escape handling, focus restoration, and
   safe destructive-button ordering have dedicated tests.
5. The application has meaningful skeleton, inline error, empty, retry, and
   background-refresh patterns on the primary data pages.
6. The language provider, French default, account persistence, and localized
   navigation keys are already part of the root architecture.
7. The recent centralized toast implementation preserves field/page errors and
   avoids turning every failed background request into a disruptive toast.

## Verified findings

| ID     | Area                 | Verified finding                                                                                                                                      | Severity | Recommendation                                                                                                                                       | Effort | Status    |
| ------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------- |
| UI-001 | Feedback             | Success confirmations were previously page-local and inconsistent across mutations.                                                                   | High     | Use one Sonner host and `notify` wrapper with stable IDs.                                                                                            | Medium | Completed |
| UI-002 | Forms / a11y         | `TextField` associated an error through `aria-describedby` but its error text had no live alert role.                                                 | High     | Mark field errors as `role="alert"`; retain inline placement.                                                                                        | Small  | Completed |
| UI-003 | Dialogs              | The shared `Dialog` uses a fixed description ID, which can collide when more than one dialog is mounted.                                              | Medium   | Generate a description ID with `useId`.                                                                                                              | Small  | Pending   |
| UI-004 | Design tokens        | Application surfaces use tokens, but the marketing stylesheet contains intentional hardcoded colors and independent marketing status colors.          | Medium   | Document the marketing exception and map reusable status colors to semantic tokens where practical.                                                  | Medium | Pending   |
| UI-005 | Components           | Shared controls cover the main workflows, but there is no shared radio/switch/date-picker/tooltip/pagination primitive.                               | Medium   | Add only when a verified workflow needs it; do not introduce a second UI system.                                                                     | Medium | Pending   |
| UI-006 | Responsive tables    | Large prospect, audit, export, and activity tables depend on per-page overflow/column choices.                                                        | High     | Establish a shared responsive table contract: minimum width, scroll hint, sticky first column only where needed, and compact mobile row alternative. | Large  | Pending   |
| UI-007 | Loading/error states | Page implementations have good local patterns, but wording and retry placement vary across route families.                                            | Medium   | Standardize page-state components and error copy by route family.                                                                                    | Medium | Pending   |
| UI-008 | Navigation           | Desktop collapse state is persisted and mobile navigation exists; tooltip/help behavior for collapsed icon-only items is not yet a shared primitive.  | Medium   | Add accessible labels/tooltips and test every role menu at narrow widths.                                                                            | Medium | Pending   |
| UI-009 | Typography           | The token font is consistent, but many pages use one-off fractional Tailwind sizes (`13.12px`, `14.4px`, `19px`).                                     | Low      | Define named typography utilities and migrate incrementally when touching a page.                                                                    | Medium | Pending   |
| UI-010 | Focus management     | Dialog and drawer focus behavior is tested; first-invalid-field focus is not standardized across forms.                                               | High     | Add an opt-in form helper that focuses the first invalid control without clearing drafts.                                                            | Medium | Pending   |
| UI-011 | Dark mode            | Dark tokens and focus overrides exist, but marketing CSS is intentionally light-on-navy and should be reviewed separately from authenticated screens. | Medium   | Run a dark-mode contrast sweep for authenticated routes and a separate marketing review.                                                             | Medium | Pending   |
| UI-012 | Performance          | The app has route-level App Router boundaries, but no current bundle or Web Vitals baseline is stored with the frontend audit.                        | Medium   | Capture a production build budget and representative route performance before optimizing.                                                            | Medium | Pending   |

## Ten highest-impact improvements

1. Complete the shared responsive table contract for prospects, activity, audit,
   exports, and team views.
2. Standardize first-invalid-field focus and recovery for shared forms.
3. Replace the fixed Dialog description ID with a generated ID.
4. Add a route-state component with consistent loading, empty, retry, and
   permission-denied variants.
5. Run a contrast and text-resize sweep across dark authenticated screens.
6. Add accessible labels/tooltips for collapsed sidebar icons and test mobile
   bottom navigation with keyboard and screen-reader semantics.
7. Establish named typography utilities and remove new fractional one-off sizes.
8. Add component coverage for TextField, SelectField, Menu, Drawer, and the
   responsive table contract.
9. Capture bundle/Web Vitals baselines before adding performance dependencies.
10. Migrate remaining high-value mutation confirmations (imports, campaign and
    rules saves, messaging) to `notify` one workflow at a time.

## Design-system specification

### Typography

Use Inter with the existing `--font-sans` token. The recommended scale is:

| Token        | Size / line height     | Use                                       |
| ------------ | ---------------------- | ----------------------------------------- |
| `display`    | 30px / 1.15, 800       | Authenticated page title on large screens |
| `heading`    | 20px / 1.25, 800       | Card and section headings                 |
| `subheading` | 16px / 1.4, 700        | Table groups and form sections            |
| `body`       | 14–16px / 1.5, 400–600 | Product copy and controls                 |
| `table`      | 13–14px / 1.4          | Dense data rows                           |
| `label`      | 13–14px / 1.35, 700    | Field labels                              |
| `helper`     | 12–13px / 1.45         | Hints, timestamps, secondary metadata     |

Existing page-specific values remain valid until the page is deliberately
migrated; new work should use these semantic names rather than inventing a
fractional size.

### Color and elevation

Use `canvas`, `surface`, `surface-muted`, `ink`, `ink-soft`, `ink-muted`,
`line`, `brand`, and the complete success/warning/danger/info triples already in
`globals.css`. Status components must pair color with text or an icon. Cards use
the existing 14px radius and low-elevation border; overlays use
`--shadow-overlay`. Avoid new gradients and raw colors in authenticated UI.

### Spacing, radius, and controls

- Use a 4px rhythm: 4, 8, 12, 16, 20, 24, 32, 40.
- Inputs and buttons keep a minimum 44px touch target on small screens.
- Default card radius is 14px; control radius is 9–10px; badges are fully
  rounded.
- Focus rings remain visible in both themes and must not rely on color alone.
- Loading controls use `aria-busy`, disable only the submitted operation, and
  preserve drafts on failure.

### Responsive breakpoints

Validate representative widths 320, 375, 768, 1024, 1280, 1440, and 1920px.
The current shell switches desktop navigation at `lg`; page-specific tables
should use overflow or a compact row layout rather than clipping essential data.

## Page-by-page audit

The route inventory below groups pages that share a template; dynamic detail
routes inherit the parent route's role and state requirements.

| Route family                                                                                                                                                                                                                                                                                                                       | Authorized role(s)                                       | Existing components / API surface                                                   | Verified UX issues                                                                                                                | Priority |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `/login`, `/accept-invitation`, `/forgot-password`, `/reset-password/{token}`, `/mfa`, `/select-workspace`                                                                                                                                                                                                                         | Unauthenticated users / authenticated account chooser    | `AuthShell`, auth forms, MFA, workspace selector, API auth clients                  | Strong responsive shell and validation; form first-error focus should be standardized.                                            | P0       |
| `/`, `/work-queue`, `/work-queue/{campaignId}/{prospectId}`, `/follow-ups`, `/actions`, `/map`                                                                                                                                                                                                                                     | Prospector; scoped manager/admin where navigation allows | `AppShell`, work queue, action drawer, map, follow-up clients                       | Core operating flow is implemented; large tables and detail drawers need a common mobile contract.                                | P0       |
| `/messages`, `/notifications`, `/workspace/notifications`                                                                                                                                                                                                                                                                          | Tenant roles by effective permission                     | Messaging, notification bell, notification APIs                                     | Background refresh feedback is intentionally quiet; empty/error copy should be standardized.                                      | P1       |
| `/manager/overview`, `/manager/team`, `/manager/assignments`, `/manager/assignments/active`, `/manager/approvals`, `/manager/approvals/{requestId}`, `/manager/collisions`, `/manager/follow-up-reviews`, `/manager/exports`, `/manager/reports`, `/manager/objectives`, `/manager/territories`, `/manager/campaigns/{campaignId}` | Manager                                                  | Manager cards, assignment drawers, review/approval components, exports/reports APIs | High data density and responsive tables are the main risk; preserve scope filters and server pagination.                          | P0       |
| `/admin/overview`, `/admin/live`, `/admin/prospects`, `/admin/prospects/{prospectId}`, `/admin/prospects/{prospectId}/history`, `/admin/prospects/{prospectId}/complement`, `/admin/prospects/{prospectId}/script`, `/admin/prospects/assign`, `/admin/prospects/map`                                                              | Client administrator                                     | Admin prospect base, map, assignment drawer, detail panels                          | Assignment feedback is now centralized; map/list selection and detail panels need narrow viewport verification.                   | P0       |
| `/admin/users`, `/admin/equipe`, `/admin/equipe/nouveau-membre`, `/admin/equipe/identifiants`                                                                                                                                                                                                                                      | Client administrator                                     | Membership tables, invite drawer, access drawers                                    | Invite workflow is connected and confirmed; tables need the shared responsive contract.                                           | P0       |
| `/admin/organizations`, `/admin/entreprises`, `/admin/campaigns`, `/admin/scripts`, `/admin/scripts/preview`, `/admin/settings`, `/admin/parametres`, `/admin/import`, `/admin/imports`, `/admin/imports/{importId}`, `/admin/journal`, `/admin/audit`, `/admin/activite`, `/admin/messages`, `/admin/direct`                      | Client administrator                                     | Configuration pages, imports, audit/activity, scripts, API clients                  | Many local success/error states remain; migrate only completed mutation confirmations and keep critical audit information inline. | P1       |
| `/director/overview`, `/director/performance`, `/director/companies`, `/director/companies/{organizationId}`, `/director/campaigns`, `/director/campaigns/{campaignId}`, `/director/teams`, `/director/territories`, `/director/objectives`, `/director/reports`, `/director/exports`                                              | Director                                                 | `DirectorWorkspace`, dashboard/report/export clients                                | Read-oriented hierarchy is appropriate; KPI/card loading and table density need cross-width evidence.                             | P1       |
| `/observer/overview`, `/observer/prospects`, `/observer/actions`, `/observer/audit`, `/observer/exports`, `/observer/assignments`, `/observer/security`                                                                                                                                                                            | Observer/auditor                                         | Observer workspace and masked read-only tables                                      | Masking and scope notices are product-critical; validate contrast, copy, and table overflow without exposing data.                | P0       |
| `/platform/overview`, `/platform/tenants`, `/platform/access`, `/platform/health`                                                                                                                                                                                                                                                  | Super administrator / platform grant                     | Platform navigation and control-plane pages                                         | Must remain separate from tenant data; audit platform shell and empty/error states independently.                                 | P0       |
| `/profile`, `/routes`, `/routes/new`, `/routes/{routeId}`, `/performance`, `/search`, `/workspace`, `/workspace/{module}`                                                                                                                                                                                                          | Role-dependent                                           | Account tabs, routes, search, workspace module router                               | Shared shell is sound; page-state and form conventions vary by module.                                                            | P1       |

## Prioritized implementation backlog

### UI-001 — Centralized mutation feedback

**Priority:** P0  
**Status:** Completed on `dev-v2` (`55e90a5`)  
**Scope:** Sonner host, `notify` wrapper, migrated invitation, profile,
preferences, MFA, assignment, action, and export confirmations.  
**Acceptance:** one global host, stable IDs, light/dark support, safe messages,
tests, and no replacement of inline validation.  
**Verification:** 759 web tests, typecheck, lint, production build, CI, and
rendered local shell check passed.

### UI-002 — Announce shared field errors

**Priority:** P0  
**Status:** Completed in the current audit patch  
**Scope:** `apps/web/src/components/ui/text-field.tsx`.  
**Implementation:** add `role="alert"` to the already-associated error text.  
**Acceptance:** a screen reader receives the error, the input remains linked by
`aria-describedby`, and drafts are preserved.  
**Verification:** `text-field.test.tsx` plus the full web suite.

### UI-003 — Make dialog description IDs unique

**Priority:** P0  
**Status:** Pending  
**Scope:** `apps/web/src/components/ui/dialog.tsx`.  
**Implementation:** use `useId` for `aria-describedby` and add a regression test
with two mounted dialog instances.  
**Acceptance:** every open dialog references its own description.  
**Dependencies:** none.

### UI-004 — Shared responsive data-table contract

**Priority:** P0  
**Status:** Pending  
**Scope:** prospect, activity, audit, export, team, director, and observer
table templates.  
**Implementation:** shared overflow/scroll hint, compact row fallback, and
consistent sticky behavior; preserve server pagination.  
**Acceptance:** no essential column is clipped at 320–768px and desktop density
remains stable.  
**Dependencies:** representative screenshot/keyboard QA.

### UI-005 — First-invalid-field focus helper

**Priority:** P0  
**Status:** Pending  
**Scope:** shared form submissions and auth/configuration forms.  
**Implementation:** focus the first `aria-invalid="true"` control after submit;
do not clear failed drafts.  
**Acceptance:** keyboard users land on the first error and can correct/retry.  
**Dependencies:** inventory form submit handlers.

### UI-006 — Standard page states

**Priority:** P0  
**Status:** Pending  
**Scope:** loading, empty, retry, offline, permission, and no-results states.  
**Implementation:** shared state components and role-safe copy; preserve page
specific guidance.  
**Acceptance:** every data route has initial, failure, empty, and retry states.  
**Dependencies:** route inventory and API error mapping.

### UI-007 — Dark-mode contrast sweep

**Priority:** P0  
**Status:** Pending  
**Scope:** authenticated route families and overlay components.  
**Implementation:** inspect token pairs at dark mode and high contrast; fix
semantic token definitions rather than individual pages.  
**Acceptance:** text, status, focus, controls, and overlays remain readable at
all required widths.  
**Dependencies:** visual QA capture.

### UI-008 — Collapsed navigation accessibility

**Priority:** P1  
**Status:** Pending  
**Scope:** `AppShell`, sidebar items, mobile bottom bar.  
**Implementation:** shared accessible tooltip/label treatment and keyboard tests.  
**Acceptance:** every icon-only control has an accessible name and visible focus.  
**Dependencies:** UI-003 dialog/overlay conventions.

### UI-009 — Typography utility migration

**Priority:** P1  
**Status:** Pending  
**Scope:** shared UI and pages touched by P0 work.  
**Implementation:** named type utilities backed by Inter tokens; migrate
fractional one-offs incrementally.  
**Acceptance:** new UI uses named scale values and retains visual hierarchy.  
**Dependencies:** no blocking dependency.

### UI-010 — Performance baseline

**Priority:** P1  
**Status:** Pending  
**Scope:** production build, representative role routes, bundle and Web Vitals.  
**Implementation:** record baseline before dependency or rendering changes.  
**Acceptance:** regressions are measurable and tied to a route/bundle change.  
**Dependencies:** authenticated QA fixture.

## Progress tracker

| Ticket | Priority | Status    | Verification                                    | Dependencies          |
| ------ | -------- | --------- | ----------------------------------------------- | --------------------- |
| UI-001 | P0       | Completed | Local + CI tests/build and rendered shell check | None                  |
| UI-002 | P0       | Completed | New TextField test plus full web suite          | None                  |
| UI-003 | P0       | Pending   | Not run                                         | None                  |
| UI-004 | P0       | Pending   | Not run                                         | Responsive QA         |
| UI-005 | P0       | Pending   | Not run                                         | Form inventory        |
| UI-006 | P0       | Pending   | Not run                                         | Route inventory       |
| UI-007 | P0       | Pending   | Not run                                         | Visual contrast QA    |
| UI-008 | P1       | Pending   | Not run                                         | Overlay conventions   |
| UI-009 | P1       | Pending   | Not run                                         | Incremental page work |
| UI-010 | P1       | Pending   | Not run                                         | Authenticated fixture |

## Before/after evidence and limits

- **Notifications:** page-local success banners now use a global themed host and
  stable IDs for the migrated workflows; inline validation and safety alerts are
  unchanged.
- **Field errors:** shared `TextField` errors now announce through an alert role
  while retaining their existing visual position and input association.
- **Rendered evidence:** local rendered QA confirmed the French landing page,
  language selector, and mounted global notification region. A complete visual
  screenshot sweep of every authenticated role was not performed in this audit;
  it requires authenticated role fixtures and is tracked by UI-004/UI-007.
- **Performance:** no optimization claim is made yet; UI-010 must establish the
  baseline before adding dependencies or changing client boundaries.

## Regression strategy

For each ticket, run the affected component tests, full web unit tests, typecheck,
ESLint, production build, and `git diff --check`. Use authenticated browser QA
for the role-specific route family, test 320/375/768/1024/1280/1440/1920px,
keyboard navigation, light/dark/high-contrast modes, reduced motion, and API
failure/retry states. Backend contracts and role authorization tests remain
unchanged unless a verified frontend integration defect requires a contract
fix.
