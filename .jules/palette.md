## 2023-10-25 - ARIA Labels & Focus States on Floating/Icon-Only Action Buttons
**Learning:** Icon-only floating buttons (like modal or form close "X" buttons) are often invisible to screen readers without ARIA labels, and frequently lack visible focus states. This makes them highly inaccessible to keyboard and assistive technology users.
**Action:** Always ensure that icon-only buttons include an `aria-label` and `focus-visible:ring-2 focus-visible:outline-none` classes (or equivalent) to guarantee they are discoverable and navigable.
