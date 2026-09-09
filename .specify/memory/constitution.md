<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Modified principles:
  - I. Simplicity First (NON-NEGOTIABLE) — scope broadened from a single-purpose fitness tracker
    to a personal multi-feature application; principle itself unchanged
  - II. Server-Mediated Data Access — endpoint examples marked illustrative rather than definitive
- Added sections: none
- Removed sections: none
- Other changes:
  - Product framing updated throughout: BoombasticTracker is a personal web app/PWA whose first
    feature is fitness tracking, not a fitness tracker as such
  - All references to `Specs/FitnessTracker/Architecture` repointed to `docs/architecture/`;
    the Specs directory has been removed so Spec Kit starts from a clean slate
- Templates requiring updates:
  - .specify/templates/plan-template.md — ⚠ pending manual review against new principles
  - .specify/templates/spec-template.md — ⚠ pending manual review against new principles
  - .specify/templates/tasks-template.md — ⚠ pending manual review against new principles
  (Dependent templates are read at runtime and are out of scope for this command; flagged for
  the next /speckit-plan or /speckit-tasks run to confirm alignment.)
- Follow-up TODOs: none
-->

# BoombasticTracker Constitution

## Core Principles

### I. Simplicity First (NON-NEGOTIABLE)
BoombasticTracker is a personal, low-traffic application and a learning project, not an
enterprise system. Every architecture, tooling, or infrastructure decision MUST prefer
**simple + understandable + secure enough + easy to deploy** over enterprise-style patterns.
Do not introduce a service, abstraction layer, framework, or infrastructure component unless a
concrete technical need justifies it. Decisions not yet required (e.g. schema design, testing
strategy, CI/CD) are deferred rather than solved speculatively.

**Rationale**: The project exists partly to give the developer hands-on React/Next.js experience
without the overhead of production-grade infrastructure a personal single-user app does not need.

### II. Server-Mediated Data Access
The React client (browser/PWA) MUST NOT communicate directly with Google Sheets or any future
persistence backend. All data access goes through the Next.js server acting as a
Backend-for-Frontend (BFF), exposed to the client as application-specific endpoints rather than
raw storage-provider calls. The client reasons about application data, never about the shape of a
storage provider's API.

**Rationale**: Keeps storage credentials and provider-specific logic server-side, and allows the
persistence layer (Google Sheets today) to change later without breaking the client contract.

### III. Session/Identity Separation
Google OAuth (identity and authorization) and the application's own session (a secure, persistent
HTTP cookie managed by the Next.js server) are distinct concerns and MUST be implemented as such.
The Google access token MUST NOT be stored in `localStorage` or `sessionStorage`; the browser
holds only the application session cookie. Once a session is established, the app MUST keep
working across lock/unlock, app switching, PWA close/reopen, and page reload without forcing a
new interactive Google login, re-authenticating via Google OAuth only when the session actually
expires.

**Rationale**: Prevents Google credentials from leaking into client-side JavaScript and gives a
seamless "open app → already authenticated" experience appropriate for a Home Screen PWA.

### IV. Free-Tier Hosting Constraint
Hosting and infrastructure choices MUST fit within a genuinely free service tier unless a concrete
technical reason requires otherwise. The app does not need high availability, autoscaling,
enterprise infrastructure, paid databases, or dedicated servers, and MUST NOT take on such
dependencies by default. Any hosting platform used MUST still support HTTPS, environment
variables/secrets, persistent HTTP cookies, and outbound HTTPS requests to Google's APIs.

**Rationale**: This is a personal, low-traffic application; ongoing cost and operational overhead
must stay proportionate to that reality.

### V. Self-Documenting Code
Code MUST be self-documenting through clear naming and structure. Do not add comments explaining
what code does. Do not use inline CSS (`style="..."` attributes or inline style objects) — styling
belongs in stylesheets/CSS modules. Do not hardcode bare user-facing strings directly in
HTML/markup — route them through constants or a translation/i18n layer.

**Rationale**: Consistent, explicit code style keeps a small personal codebase maintainable
without relying on comments or ad hoc styling/text conventions to compensate for unclear code.

## Technology Stack

Frontend and BFF: **React**, **Next.js**, **TypeScript**. Next.js provides both the client-side
React application and the server-side BFF in one deployable unit. Initial persistence: **Google
Sheets**, accessed exclusively server-side through the **Google Sheets API**. Authentication:
**Google OAuth**, using the developer's own Google account/Google Cloud project. Any change to
this stack (e.g. replacing Google Sheets with another datastore) is a deliberate architectural
decision and MUST be reflected here and in `docs/architecture/`.

## Incremental Decisions

The following remain intentionally undecided until actually needed, per Principle I: exact Google
OAuth library/session-management implementation, exact hosting provider, Google Sheet schema, API
endpoint design, data/repository abstraction, UI/component architecture, charting library, offline
support, error handling strategy, testing strategy, and CI/CD. Each MUST be decided incrementally,
at the point of implementation, rather than speculatively up front — and each cross-cutting
decision should be captured in `docs/architecture/` once made, while feature-scoped decisions
belong in that feature's Spec Kit documents under `specs/`.

## Governance

This constitution supersedes other informal practices for BoombasticTracker. Amendments are made
by editing `.specify/memory/constitution.md` directly, updating the Sync Impact Report at the top
of the file, and bumping the version per semantic versioning: MAJOR for backward-incompatible
principle removals/redefinitions, MINOR for new principles or materially expanded guidance, PATCH
for clarifications and wording fixes. `LAST_AMENDED_DATE` MUST be updated on every substantive
change.

Every `/speckit-plan`, `/speckit-tasks`, and `/speckit-implement` run MUST be checked against
these principles; any deviation MUST be justified in the relevant plan's Complexity Tracking (or
equivalent) section rather than silently introduced. Use the guideline documents under `docs/`
and the architecture decisions under `docs/architecture/` for detailed runtime/architecture
guidance that supplements, but does not override, this constitution.

**Version**: 1.1.0 | **Ratified**: 2026-09-09 | **Last Amended**: 2026-09-09
