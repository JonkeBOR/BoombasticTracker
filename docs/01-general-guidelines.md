# General Guidelines

## Comments

Never add comments. Write code that is self-documenting through clear naming and
structure instead of explaining it with comments.

## CSS

Never use inline CSS (`style="..."` attributes or inline `style` objects). Styling
belongs in stylesheets/CSS modules, not inline on elements.

## Strings in HTML

Never expose bare strings directly in HTML/markup. Route user-facing text through
a proper source (e.g. constants or a translation/i18n layer) instead of hardcoding
it inline.
