## 2024-03-24 - Ensure Focus States and ARIA Labels on Icon-Only Buttons
**Learning:** Icon-only buttons (like token queue action buttons and refresh buttons) frequently lack accessible names (`aria-label`) and visible focus states. This makes them difficult to use for keyboard-only users and completely opaque to screen readers.
**Action:** When adding or updating icon-only buttons, always ensure they have an `aria-label` for screen readers and `focus-visible:ring-*` styling (or equivalent focus rings) so keyboard navigation produces a clear visible state.
