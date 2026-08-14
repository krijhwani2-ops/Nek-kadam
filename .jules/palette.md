## 2024-05-18 - Added ARIA Labels to Icon-Only Close Buttons
**Learning:** Icon-only buttons used for closing modals (like in the Medicines page) lack inherent screen reader context, making them difficult for visually impaired users to navigate.
**Action:** Always add descriptive `aria-label` attributes (e.g., `aria-label="Close"`) to icon-only buttons to ensure they are accessible.
