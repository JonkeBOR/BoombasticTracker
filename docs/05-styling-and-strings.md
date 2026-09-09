# Styling and User-Facing Strings

This expands the CSS and string rules in `01-general-guidelines.md` into how they are actually
applied, and how they are enforced.

## No inline CSS

`react/forbid-dom-props` and `react/forbid-component-props` make a `style` prop an ESLint error.
Styling belongs in a CSS Module beside the component:

    src/features/workouts/WorkoutCard.tsx
    src/features/workouts/WorkoutCard.module.css

Import it as `styles` and reference `styles.card`. Global CSS is reserved for resets, design tokens
and typography in `src/app/globals.css`.

The rule has no escape hatch for dynamic values. A value that changes with state is expressed as a
class the component picks between, or as a CSS custom property set on the element, never as an
inline style object.

## Design tokens

Colours, spacing, radii and font sizes are CSS custom properties declared once in `globals.css` and
referenced by every module. No raw hex values or pixel spacing inside a component's stylesheet.
Dark mode and the PWA's standalone display are handled by re-declaring tokens, not by branching in
components.

## No bare strings in markup

`react/jsx-no-literals` makes a string literal in JSX an ESLint error, including one wrapped in
braces. Props are exempt, so `className="card"` and `href="/workouts"` are fine — the rule targets
text a user reads.

User-facing text comes from a constants module under `src/lib/strings/`, grouped by feature:

    export const workoutStrings = {
      title: 'Workouts',
      emptyState: 'No workouts logged yet',
    } as const;

Rendered as `<h1>{workoutStrings.title}</h1>`.

This is deliberately not an i18n library. The app is single-user and English-only; the constants
give a single place to change wording and keep the door open for a translation layer later without
hunting through JSX. Introducing an i18n dependency before a second language exists would violate
Simplicity First.

Strings that are not user-facing — a test id, an aria role value, a fetch URL — are not routed
through the constants module.

## Formatting

Prettier owns all formatting, including CSS. Do not hand-align declarations or add formatting
comments; run `scripts/format.ps1 -Write`.
