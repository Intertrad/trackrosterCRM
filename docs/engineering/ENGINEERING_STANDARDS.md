# TrackRoster Engineering Standards

**Status:** Proposed team standard

## 1. General principles

- Prefer clarity over cleverness.
- Keep domain language consistent with product documentation.
- Keep business logic out of React components and HTTP controllers.
- Keep infrastructure details out of core domain rules where practical.
- Do not duplicate authoritative rules between frontend and backend.
- Make illegal states difficult to represent.
- Fail explicitly rather than silently.
- Keep pull requests focused and reviewable.

## 2. Language

Code, file names, comments, commits, PRs, and technical documentation use English.

User-facing product localization can be handled separately.

## 3. TypeScript

- Enable strict TypeScript settings.
- Avoid `any` unless there is a documented reason.
- Prefer precise domain types.
- Prefer `unknown` over `any` for untrusted values.
- Validate external input at boundaries.
- Avoid large union types when a domain object would be clearer.

## 4. Layer responsibilities

### Controller

- parse HTTP context;
- call application service;
- return HTTP response.

### Application service

- orchestrate a use case;
- enforce authorization / business workflow;
- coordinate repositories and domain services.

### Domain service

- implement reusable domain decisions such as collision evaluation.

### Repository

- persistence access;
- query composition;
- database-specific behavior.

### Infrastructure adapter

- email;
- object storage;
- external APIs;
- queue;
- cache.

## 5. Frontend responsibilities

React components should focus on:

- presentation;
- interaction;
- local UI state.

Business policy decisions must come from backend responses.

## 6. Dependency direction

Prefer:

```text
UI / Controller
      ↓
Application
      ↓
Domain
      ↓
Ports / Repository contracts
      ↓
Infrastructure
```

Do not create circular module dependencies.

## 7. Domain modules

Organize backend code by business domain rather than one global folder per technical
type.

Preferred:

```text
modules/prospects/
modules/reservations/
modules/actions/
```

Avoid a root-only structure such as:

```text
controllers/
services/
repositories/
```

## 8. Shared code

Create shared packages only when code is truly shared.

Do not create catch-all packages named:

- `common`;
- `helpers`;
- `utils`;

unless scope is tightly defined.

## 9. Configuration

- validate required environment variables on startup;
- no environment-specific values hard-coded in application code;
- no secrets in Git;
- configuration names use clear prefixes.

## 10. Comments

Comments should explain **why**, not restate obvious code.

Bad:

```ts
// increment i
i++;
```

Better:

```ts
// Keep one extra retry because the provider occasionally acknowledges late.
```

## 11. Functions

Prefer small functions with one responsibility.

Avoid deeply nested conditionals.

Use early returns for invalid / blocked cases where it improves readability.

## 12. Error handling

- never swallow errors silently;
- use stable application error codes;
- preserve causal errors for logs;
- return safe messages to clients.

## 13. Logging

- use structured logs;
- include correlation / request IDs;
- include tenant ID where safe and useful;
- never log secrets;
- avoid logging full sensitive request bodies.

## 14. Testing

Every business-critical rule requires automated tests.

Priority areas:

- tenant isolation;
- collision decisions;
- reservation concurrency;
- immutable action history;
- authorization;
- manager overrides;
- import deduplication logic.

## 15. Documentation

A pull request must update documentation when it changes:

- a business rule;
- API behavior;
- architecture;
- environment variable;
- operational process;
- security behavior.
