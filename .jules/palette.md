## 2026-09-18 - Found unlabelled close buttons
**Learning:** Some custom modal close buttons in the system (like in FaceEnrollmentModal) lack ARIA labels, making them inaccessible to screen readers.
**Action:** Always check custom dialogs and modals for close buttons and add `aria-label="Close modal_name"` to icon-only buttons.
