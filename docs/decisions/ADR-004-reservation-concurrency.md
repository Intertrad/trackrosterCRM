# ADR-004 — Reservation Concurrency

**Status:** Accepted as core system invariant  
**Date:** 2026-09

Architecture Decision Records capture the context, decision, and consequences of
important technical choices. Status changes should be recorded rather than silently
rewriting history.

## Context

TrackRoster's differentiator depends on preventing incompatible simultaneous contact
attempts.

Frontend-only checks cannot prevent race conditions.

## Decision

Reservation claims are server-side transactional operations.

The persistence design must guarantee that two incompatible concurrent claims cannot
both succeed.

## Implementation direction

The exact database mechanism may use:

- transaction isolation;
- row locking;
- advisory locking;
- unique or exclusion constraints;
- a combination of these.

Redis may assist with short-lived coordination, but the authoritative correctness model
must not depend only on a best-effort cache lock.

## Required behavior

1. Client requests reservation.
2. Server evaluates collision rules.
3. Server attempts atomic claim.
4. Exactly one incompatible concurrent claim may succeed.
5. Loser receives a stable business conflict result.
6. Claim has an expiration policy.
7. Operation supports duplicate-request protection.

## Testing requirement

Automated concurrency tests are mandatory before the MVP is considered complete.
