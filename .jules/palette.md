## 2024-08-17 - Added ARIA Label to Dashboard Refresh Button
**Learning:** Found an icon-only button (RefreshCw) in `Dashboard.tsx` lacking an accessible name.
**Action:** Always verify icon-only buttons have an `aria-label` or visually hidden text for screen readers. Added `aria-label="Refresh Dashboard"`.
