---
version: alpha
name: TrackRoster application
description: Coordinated prospecting with clear ownership, timing and authority.
colors:
  navy: '#05124A'
  brand: '#0F59FA'
  lime: '#A7DC41'
  line: '#D7DCE7'
typography:
  sans:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
rounded:
  DEFAULT: '10px'
  lg: '14px'
spacing:
  mobile-page: '16px'
  desktop-page: '32px'
components:
  button: {}
  input: {}
  table: {}
  drawer: {}
  dialog: {}
---

# TrackRoster application design

The user-selected GitHub frontend at `libehon/TrackRoster`, revision `a8a5455`, is the current visual authority. The earlier product dossier and HTML walkthrough provide workflow context. Together they establish a navy coordination workspace, blue primary actions, lime confirmation accents and Inter typography. The operational signature is a clear availability/ownership decision before contacting a prospect. Additional administration screens preserve that identity and use quiet, readable tables and right-side editing panels. This implementation extends the existing app; the offline design ZIP remains a separate reference artifact.

Audience: French field and desk teams, managers, directors, tenant administrators, scoped auditors and separately authorized platform administrators. Desktop supports setup/comparison; mobile supports daily action. French is the default interface language; an authenticated member or workspace administrator can switch to English from the language dropdown, and the choice persists through the account API. Identifiers and provider settings are shown only where needed for administration. No sample records or invented metrics are included in the connected screens.

## Token ownership

`src/app/globals.css` is the canonical runtime token source (model B). Tailwind semantic utilities resolve those tokens. Preserve its six dossier brand colors. Do not copy independent hex palettes into screen components. Account theme, density, contrast and motion preferences are adapted once by `components/account/runtime-preferences.tsx`. Dark-theme overrides live alongside the base tokens; navy navigation remains navy while text tokens adapt. Reduced motion respects both the OS and the account setting.

## Layout and typography

Reference-aligned shell: 220px desktop sidebar (76px collapsed), mobile header and four primary bottom destinations plus More. The desktop content is at most 1280px wide, with 32px top spacing and clamp(30px, 3vw, 44px) gutters. Main titles use 35.2px extra-bold Inter; mobile titles scale down. Operational text is 14–15px. Labels use 13.12px bold text. Numbers use tabular figures. The pale canvas (`--color-canvas: #f6f8fc`), white cards with 14px corners and #d7dce7 borders follow the GitHub source. Inputs use 9px corners, buttons 10px, and status labels use pills. Preserve 44px mobile action targets.

Lists scroll horizontally inside their own positioned container. Detail/edit drawers use the maintained 520px maximum width; the named `prospect` variant uses 720px for the connected record panel. Both become full width on mobile, and retain reachable footer actions. Forms use natural height within the drawer's content scroller. Do not put a form inside a table viewport.

## Components and states

Shared owners are listed in UX-CONTRACT.md. Preserve semantic button intent, status text with color, focus outlines, loading dimensions, empty-state instructions, persistent inline errors and server conflict recovery. Native single-select/date popups are an explicit platform-owned choice. Do not recreate ARIA comboboxes or calendars at screen level. Use record pickers for available relations; backend authority remains definitive.

## Localization, accessibility and responsive QA

French is the default interface language. User-facing copy in role-specific pages must be selected
through `useTranslation`/`text`, and dates and numbers must use the active account locale; never
rely on the browser default locale. A row that opens a detail panel owns a native button or link
inside a table cell so keyboard and assistive-technology users have an equivalent path. Horizontal
data tables keep a visible, token-based scrollbar on narrow screens. Global scrollbar styling is
owned by `globals.css` and uses the same light/dark surface and line tokens. Marketing styles may
alias the canonical tokens but must not introduce a second brand palette.

## Verification and limits

See `../../docs/frontend/INTEGRATION.md` and `../../output/frontend-integration-qa/` for actual checks and deployment dependencies. Generated form metadata is maintained from registered Nest DTOs; server validation is authoritative. Free-form provider configuration, GeoJSON boundaries and filter dictionaries are advanced structured inputs because their backend contracts are open-ended. This is not a claim that third-party delivery or production readiness is certified.

## Attached admin and prospector reference — 29 September 2026

The user supplied `TrackRoster-apercu (2).html` as a visual reference. Its retained copy is [TrackRoster-apercu.html](../../docs/design/reference/TrackRoster-apercu.html), SHA-256 `382e7aafc714fbb098137dfe21af1ad97a438d629e25093002146cb436ad204d`. It is identical to the previously documented walkthrough: 22 admin screens and 15 prospector screens/states. Use its navy navigation, blue actions, lime accents, table/filter composition, mobile daily workflow and desktop detail panels when refining these experiences. The walkthrough's example data and captions do not authorize changing roles, removing working manager/director screens, or inventing backend workflows.

See [current route mapping](../../docs/design/ATTACHED_REFERENCE_STATUS.md) for implemented destinations and remaining differences. This is a reference adoption, not a claim that all 37 screenshots have been reproduced.

## Prospect-base assignment and daily entry

The administrative base uses URL-restorable filters and list/map modes. Selection contains at most 100 explicit active establishment IDs across pages; changing filters clears it. The map plots the current page only and says how many rows have coordinates. It does not imply contact availability. Existing navy/brand/lime tokens and shared fields, buttons, drawer, record picker and map remain canonical.

The assignment drawer separates enrollment confirmation from assignment confirmation. It retains successful enrollment after an assignment error, explains conflicts without replacing existing assignments, and retries the same mutation with its original idempotency key. The prospector day banner reports actual follow-up totals, not session goals or fictitious progress. Assigned records refresh in place and lead into the existing contact-availability workflow.

## Reference visual implementation

The sign-in page uses the reference’s 220px navy sidebar, centered form and muted background logo. `components/ui/brand-mark.tsx` renders the original GitHub PNG assets from `public/brand/`. The same shared brand owner supplies navigation. The admin sidebar groups overview/live/base/team/activity/messages before configuration and other existing tools. Prospectors have four primary destinations: My day, Follow-ups, History and Messages. Link tabs use a shared pale segmented treatment; local record sections use the same treatment without inventing new routes.

Overview uses five compact metrics, a 14-day activity chart, team rows and attention/data-quality panels. Chart dates are aggregated on the server in Europe/Paris; the caption discloses that timezone. Empty data remains empty. Live activity reports actual started actions and active reservations, with bounded-list counts. Companies use stacked full-width cards with organization-coloured left borders and the canonical authenticated create/edit drawer. Settings compose existing reservation-rule, objective and workspace-setting modules. Admin activity uses a dense table; prospector history uses compact action rows. Both retain the existing action history/correction drawer.

My day uses the navy/lime daily banner and separately numbered assignment rows. The grid represents real follow-up progress, not an invented daily quota. Selecting a row opens the canonical campaign prospect detail in a 720px side panel; its original URL still supports opening in another tab. Contact rules, reservations, permissions, outcomes and follow-ups keep their existing backend authority. Escape affects only the top overlay; pending outcome/permission drafts require discard confirmation. The reference's session controller, authored script library and per-company contact matrix remain backend gaps documented in the route inventory.

## GitHub design adoption — 29 September 2026

The user explicitly selected [this frontend](https://github.com/libehon/TrackRoster/tree/main/TrackRoster). Its pinned source and screen mapping are in [GITHUB_REFERENCE.md](../../docs/design/GITHUB_REFERENCE.md). It replaces the earlier HTML reference wherever visual composition differs. The reference was run and inspected at desktop sizes; source CSS and assets were used to reconcile the shared controls.

Messages initially show the full conversation list. Opening a conversation changes to a 380px list column and thread on desktop; mobile shows one panel at a time with a back action. Opening the inbox does not select or mark an arbitrary conversation read. In-memory drafts survive switching panels during the visit. Conversation states remain the backend’s active/archived states.

The reference uses browser-local demo workflow models. The connected app retains real authentication, scoped server reads, editable forms, permission checks and protected drafts. Unsupported session controls, template editing and company cooldown policies are not rendered as working controls. This adoption is not pixel-identical parity for those screens or workflows.

## Public marketing surface

The public product introduction lives at `/landing` and is also rendered for
anonymous visitors at `/`. Its composition is owned by
`components/marketing/landing-page.tsx`; its responsive styling and motion are kept
in `app/marketing.css`. It uses the same TrackRoster brand mark and color direction,
but its preview rows, pricing examples and metrics are static explanatory content,
not tenant data. Authenticated visitors retain the role-home redirect from `/`.

The landing page uses short staggered entrances, a restrained preview float and
pointer hover lifts. `prefers-reduced-motion: reduce` disables those animations and
shortens transitions. Keep public marketing effects CSS-only and lightweight; do not
introduce API reads, customer data or a second token palette into this surface.

## Role completion and opt-in Beta samples — 29 September 2026

Manager and director pages extend the same GitHub-derived shell and canonical controls. Dedicated destinations expose objectives, territories, director companies, company detail, teams, campaigns and performance. Director organization and team views are read-only and use the authenticated organization, campaign and team-capacity APIs; organization and coordination mutations remain administrator-only. Observer and platform now have their own overview, navigation and detail destinations. Observer audit remains read-only. The observer shell also has dedicated audit, masked prospects, action summaries and evidence-export pages backed by the scoped audit, prospect and action reads. Platform authority alone does not grant a tenant workspace or observer access. Team/territory creation is offered only to tenant administrators, matching the server guards.

The requested local Beta examples live in PostgreSQL and are explicitly prefixed `[DÉMO]`. Their source is `scripts/seed-beta-demo.mjs`, an opt-in, idempotent transaction restricted to the local Beta database. It adds 16 fictional prospects, follow-ups, action history, routes and objectives; it does not replace imported records. Sample contact addresses use the reserved `.invalid` domain. No outreach is performed. Empty states in other datasets remain truthful.
