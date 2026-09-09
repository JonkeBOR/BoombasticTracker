# React and Next.js Conventions

These conventions follow the architecture in `Specs/FitnessTracker/Architecture/Architecture-Auth`
and the constitution's Server-Mediated Data Access and Session/Identity Separation principles.

## Server Components are the default

Every component is a Server Component unless it needs otherwise. `'use client'` is justified only
by one of:

- Interaction state (`useState`, `useReducer`) or effects (`useEffect`).
- Event handlers bound to user input.
- Browser-only APIs — storage, service worker registration, the install prompt.
- A charting or UI library that requires the client.

## Push `'use client'` down

Put the directive on the smallest component that needs it, not on a page or layout. A client
boundary near the root drags the whole subtree into the browser bundle. A page stays a Server
Component that fetches data and renders small interactive leaves.

## Data access

The client never talks to Google Sheets. It calls application endpoints — `GET /api/workouts`,
`POST /api/bodyweight` — and reasons about fitness data, never about spreadsheet ranges or the
Sheets API shape.

- Server Components read data by calling the server-side data module directly. Do not `fetch` the
  app's own route handlers from a Server Component.
- Client Components fetch through `/api/*` route handlers.
- Sheets access lives in one server-only module. Route handlers and Server Components call that
  module; nothing else knows the storage provider.

## Route handlers

A route handler validates its input, calls the data module, and maps the result to a response. It
holds no business logic and no Sheets-specific code.

Every handler that touches fitness data first resolves the application session and rejects an
unauthenticated request with 401. The Google access token stays server-side; the browser only ever
holds the application session cookie.

Return `Response.json(...)` with an explicit status. Errors return a stable shape and never leak a
provider message, stack trace or token to the client.

## Folder structure

    src/
      app/            routes, layouts, and route handlers under app/api/
      components/     shared presentational components
      features/       feature folders, each owning its components and logic
      lib/            shared non-UI code
      lib/server/     server-only modules (sheets, session, google auth)
      lib/strings/    user-facing text constants

Code used by one feature lives in that feature's folder until a second consumer appears.

## Components

Components are functions, typed by their props type, with props destructured in the signature.
Keep them small enough to read at a glance. A component that both fetches and renders complex UI is
two components.

## Hooks

`react-hooks` rules are errors, not warnings. Do not silence the dependency array rule — a
suppressed dependency is a stale-data bug. If a dependency is a problem, the effect is usually the
problem: move the value into state, derive it during render, or drop the effect entirely.

Effects are for synchronising with something outside React. Data that can be computed during render
is computed during render, not stored in state and updated in an effect.

## Accessibility

`jsx-a11y` recommended rules are on. The app is a Home Screen PWA driven by touch: interactive
elements are real `button` and `a` elements, every input has a label, and tap targets are not
smaller than the surrounding text implies.
