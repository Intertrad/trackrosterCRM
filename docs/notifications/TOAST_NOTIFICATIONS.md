# Centralized in-app toast notifications

**Status:** Phase 11 implementation on `dev-v2`
**Owner:** Web platform
**Last updated:** 2026-10-09

## Why this exists

TrackRoster previously communicated most mutation results through page-local
success banners. That made feedback easy to miss when a drawer closed, caused
different screens to use different wording, and left some successful actions
silent. Field validation, authorization failures, and safety-critical details
still belong next to the form or operation; a toast is a short confirmation of
an operation that already completed.

The existing inline `Alert` component remains the source of truth for loading
failures, validation errors, conflicts, and durable safety information. Toasts
are a complementary presentation layer and never replace API error
normalization.

## Implementation

- `sonner` is installed once in `apps/web`.
- `AppToaster` in `apps/web/src/components/notifications/app-toaster.tsx`
  is mounted once by the root layout. It follows the account `data-theme`,
  supports light and dark surfaces, limits visible notices, and uses an
  accessible live region with a dismiss button.
- `notify` in `apps/web/src/lib/notifications/notify.ts` is the only application
  wrapper callers should use. It exposes `success`, `error`, `warning`, `info`,
  `loading`, `promise`, and `dismiss` with consistent durations and stable IDs.
- Stable IDs update an existing notice instead of stacking duplicates. A safe
  request reference can be shown as a correlation reference; tokens, response
  bodies, and credentials must never be passed to the wrapper.
- `browserJson` and `ApiError` continue to normalize backend failures. A caller
  chooses the safe user-facing message and keeps the technical error separate.

## Migrated workflows

The first migration covers high-value confirmations while preserving their
inline error states:

| Workflow                                        | Confirmation                                |
| ----------------------------------------------- | ------------------------------------------- |
| Invite a user / create an invite team           | Invitation or team created                  |
| Account preferences                             | Preferences saved                           |
| Profile and workspace switch                    | Profile saved or workspace switched         |
| MFA enable, recovery-code rotation, and disable | Security change completed                   |
| Prospect assignment                             | Assignment committed                        |
| Prospector action completion                    | Action completed, optionally with follow-up |
| Manager export queue                            | Export request queued                       |

Background polling errors remain inline and are not converted into repeated
toasts. Long-running workflows should use `notify.promise` or a loading ID when
they need progress feedback; the current export list continues to show its
live state inline while the queue request confirms through a toast.

## Design and accessibility rules

- Use a short verb-led title and add a description only when it helps the next
  decision.
- Use `success` only after the server confirms the mutation. Use `error` for a
  recoverable operation failure and keep the retry action safe and idempotent.
- Give repeatable operations a stable ID, such as `profile-saved` or
  `prospect-assignment-completed`.
- Keep destructive, validation, conflict, and permission details in the
  adjacent inline `Alert` so the explanation remains available after the toast
  expires.
- Never include invitation tokens, passwords, personal contact data, raw API
  payloads, or stack traces in a toast.
- Toasts use the account theme tokens, readable contrast, a compact mobile
  offset, keyboard-dismissable close controls, and reduced-motion behavior from
  the underlying component/browser settings.

## Verification

`apps/web/src/lib/notifications/notify.test.ts` covers each notification type,
default durations, descriptions and safe request references, actions, duplicate
IDs, promise transitions, and the rule that raw error objects are not rendered.
Run the web unit suite, typecheck, lint, production build, and rendered QA
before merging to `main`.

## Remaining migration work

The audit found many page-local `Alert` states by design. They should only be
migrated when a success result is otherwise difficult to see. The remaining
candidate areas are import completion, campaign/rule saves, message sends, and
secondary admin forms. Keep their current inline errors and migrate one
workflow at a time with an explicit success assertion and a stable ID.
