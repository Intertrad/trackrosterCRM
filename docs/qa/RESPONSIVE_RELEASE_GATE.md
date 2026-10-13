# Responsive and accessibility release gate

This gate is a repeatable smoke check for the authenticated web application.
It complements component tests; it does not replace real-device testing before
production traffic.

## Evidence captured on 2026-10-12

The local disposable backend stack and seeded admin account were used. No
production account or data was involved.

| Route                       | Viewports         | Result                                                                                          |
| --------------------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| `/admin/overview`           | 1440×900, 390×844 | French navigation rendered; no horizontal overflow; performance total 111 ms on the local stack |
| `/admin/organizations`      | 390×844           | Mobile navigation rendered; `scrollWidth === clientWidth`; no console errors                    |
| `/admin/prospects?view=map` | 390×844, 1440×900 | Map/list controls rendered; `scrollWidth === clientWidth`; no console errors                    |

The browser accessibility audit confirmed a single page heading, visible
navigation landmarks, labelled controls, and the responsive bottom navigation
at the narrow viewport. The brand image now has meaningful alternative text.

## Release procedure

1. Start the candidate web and API against a disposable or staging database.
2. Test the six role accounts, French and English language selection, invitation
   acceptance, map zoom filtering, export authorization, and message immutability.
3. Repeat the route table at 390×844, 768×1024, 1440×900, and 1920×1080.
4. Confirm `document.documentElement.scrollWidth` equals `clientWidth` on each
   route and viewport, and fail the release on new console errors.
5. Run the production configuration preflight and capture `/health/live` and
   `/health/ready` evidence before release approval.

The initial browser run contained stale development HMR connection errors from
the previous web process. After clearing the console and reloading the stable
process, the tested routes reported no console errors.
