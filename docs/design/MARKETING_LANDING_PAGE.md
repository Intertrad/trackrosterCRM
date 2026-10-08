# Public marketing landing page

**Status:** implemented on `dev-v2`  
**Last updated:** 8 October 2026

The public landing page introduces TrackRoster before authentication. It translates
the supplied desktop landing-page reference into responsive HTML and shared brand
tokens instead of using the reference image as a background. The page explains the
anti-collision product, its roles, security model and pricing, then directs a visitor
toward a demo or the sign-in flow.

## Routes and authentication behavior

- `GET /landing` renders the public page directly.
- An unauthenticated `GET /` renders the same page through `AppShell`.
- An authenticated `GET /` continues to redirect to the user's role home.
- Other unauthenticated application routes continue to redirect to `/login`.

The marketing page does not read tenant data and does not call the API. Its copy,
illustrative preview rows and pricing examples are intentionally static and are not
product records or usage metrics. “Book a demo” uses the existing `mailto:` handoff;
the CTA can move to a public lead endpoint when one is provisioned.

## Implementation ownership

| Concern                                            | Owner                                                |
| -------------------------------------------------- | ---------------------------------------------------- |
| Page composition, copy, FAQ state and mobile menu  | `apps/web/src/components/marketing/landing-page.tsx` |
| Direct route metadata and `/landing` entry point   | `apps/web/src/app/landing/page.tsx`                  |
| Anonymous root behavior and authenticated redirect | `apps/web/src/components/layout/app-shell.tsx`       |
| Responsive layout, colors, cards and motion        | `apps/web/src/app/marketing.css`                     |
| Shared logo and brand mark                         | `apps/web/src/components/ui/brand-mark.tsx`          |

## Visual and responsive approach

The page keeps the TrackRoster visual language: navy hero and footer, blue primary
actions, lime confirmation accents, pale alternating sections, white bordered cards
and the bundled Inter font. The CSS uses fluid `clamp()` sizing and three responsive
stages:

- Desktop uses the two-column hero, three-column content cards and a four-column footer.
- At `760px` and below, navigation becomes a menu button, the hero stacks, card grids
  become single-column where needed, and the statistics band reflows.
- At `480px` and below, page gutters, heading sizes, buttons and preview rows tighten
  for a 390px phone viewport without horizontal overflow.

All interactive controls keep visible focus states and mobile action targets. The FAQ
is an actual disclosure interaction, and the mobile navigation exposes the same
section anchors and conversion actions as desktop.

## Motion and accessibility

Motion is deliberately lightweight and supports hierarchy rather than adding a
continuous visual distraction:

- Hero copy, supporting text, actions and proof points rise in with short staggered
  entrances.
- The product preview enters with the hero and then floats by a few pixels on a long
  cycle.
- The preview’s “Start” state has a restrained pulse to draw attention to the
  coordination decision.
- Outline, role and pricing cards lift slightly on pointer hover when hover is
  available.

The `prefers-reduced-motion: reduce` media query disables animations and reduces
transition duration. This keeps the page readable for OS-level reduced-motion users
without requiring a separate preference or API call.

## Validation

The landing page was checked at desktop, tablet and phone widths in the local browser.
The validation covered:

- full section rendering from hero through footer;
- responsive navigation and no horizontal overflow on mobile;
- FAQ disclosure behavior;
- anonymous root rendering and authenticated route ownership;
- browser console state with no captured errors or warnings;
- TypeScript, targeted ESLint, Prettier and `git diff --check`.

The detailed visual record is in [design-qa.md](../../design-qa.md).
