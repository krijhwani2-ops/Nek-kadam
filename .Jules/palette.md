## 2024-08-28 - TokenQueue.tsx ARIA Labels
**Learning:** Found multiple icon-only action buttons (Start, Skip, Urgent, etc.) in `TokenQueue.tsx` that lacked `aria-label` attributes, making them inaccessible to screen readers despite having `title` attributes.
**Action:** Always mirror `title` attributes into `aria-label` attributes for icon-only buttons to ensure they are properly read by screen readers while maintaining hover tooltips.
