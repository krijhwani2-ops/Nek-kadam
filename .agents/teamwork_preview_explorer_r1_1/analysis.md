# Technical Analysis: Milestone R1 — Patient Profile and History Timeline Redesign

## Overview
This document provides a detailed technical analysis of the existing codebase for **Milestone R1**, focusing on:
1. Patient Profile component structure, layout hierarchy, priority medical history column, and collapsible prescription builder form.
2. History Timeline card component layout, hero Date presentation, medicine name typography (>=14px), and secondary/expandable doctor & notes structure.
3. Responsive input field layout wrapping in the prescription builder form on mobile devices.

---

## 1. Patient Profile Layout & Component Structure

### File Location
- **Primary Component File**: `src/pages/PatientProfile.tsx` (1265 lines)
- **App Route Entry**: `src/App.tsx` (Line 734: `<Route path="/patients/:id" element={<PatientProfile />} />`)

### Current Layout Architecture
Currently, `PatientProfile.tsx` manages view states using tabbed navigation (`activeTab` state at line 46):
```typescript
const [activeTab, setActiveTab] = useState<'history' | 'new-visit'>('history');
```

- **Tabs Header** (lines 616-638):
  - Renders two tab buttons: "Clinical History (N)" and "Write New Prescription".
- **Conditional Rendering** (line 641):
  ```tsx
  {activeTab === 'history' ? (
    /* Clinical History Timeline (Lines 642 - 750) */
  ) : (
    /* Write New Prescription Card (Lines 753 - 980) */
  )}
  ```

### Key Issues Identified
1. **Context Loss During Prescription Writing**:
   When writing a new visit (`activeTab === 'new-visit'`), the patient's entire clinical history timeline is hidden. Practitioners cannot view historical visits, previous diagnoses, or prior dosages without switching tabs.
2. **Lack of Layout Flexibility**:
   The current implementation forces a binary choice between viewing history OR prescribing, rather than prioritizing medical history alongside a collapsible prescription tool.

### Recommended Fix Strategy
- **Restructure `PatientProfile.tsx` Layout**:
  Replace mutually exclusive tabs with a **Priority Medical History Layout** featuring a **Collapsible Prescription Builder**:
  1. **State Addition**:
     ```typescript
     const [isPrescriptionCollapsed, setIsPrescriptionCollapsed] = useState(false);
     ```
  2. **Grid / Stack Layout**:
     - **Desktop (`lg:grid lg:grid-cols-3 gap-6`)**:
       - **Left / Main Column (`lg:col-span-2`)**: Priority Clinical History Timeline (always visible).
       - **Right Column (`lg:col-span-1`)**: Collapsible Prescription Builder card.
     - **Mobile View**:
       - Top section: Collapsible Prescription Builder card with a clean toggle header (`[+ New Prescription / Collapse]`).
       - Main section: Priority Clinical History Timeline directly below.
  3. **Prescription Builder Collapsible Header**:
     Add an expandable/collapsible trigger card header allowing the user to toggle the builder open or closed without obscuring medical history.

---

## 2. History Timeline Card Component Analysis

### Component Location
- **Timeline Loop**: `src/pages/PatientProfile.tsx` (lines 642–750)
- **Card Wrapper**: Lines 660–745 using `<Card variant="glass">`

### Current Elements & Formatting

#### A. Date Display
- **Current Code** (lines 667–669):
  ```tsx
  <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
    {new Date(visit.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
  </h3>
  ```
- **Issue**: The date shares header spacing with the Doctor name badge (`<Badge variant="success">Dr. ...</Badge>`) and observation badge (lines 670–673).
- **Hero Date Redesign**:
  - Elevate Date into the prominent **Hero** element: large, bold typography (`text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight`).
  - Isolate Date in the card header for maximum clarity.

#### B. Medicine Names & Typography (>=14px Requirement)
- **Current Code** (lines 700–705):
  ```tsx
  <div key={mIdx} className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-150 flex justify-between items-center">
    <span>{med.medicine_name || med.medicine_code}</span>
    <span className="text-xs text-slate-400 font-bold">Qty: {med.quantity || 1}</span>
  </div>
  ```
- **Issue**:
  While `text-sm` (14px) and `text-base` (16px) are used in the timeline view, sub-labels or tags in combination badges (e.g. line 696 `text-[9px]`, line 943 `text-xs` (12px) in selected combinations) drop below 14px.
- **Recommended Redesign**:
  - Standardize all medicine name displays to be **>= 14px** (minimum `text-sm` / `text-base` / `text-14px`) across mobile and desktop.
  - Ensure high-contrast font weights (`font-black` or `font-bold`) so medicine names are easily readable by elderly users.

#### C. Doctor & Notes (Secondary / Expandable)
- **Current Code**:
  - Doctor Name is rendered in the header next to Date (line 671).
  - Notes are inside `{isExpanded && ( ... )}` (lines 718–723).
- **Secondary/Expandable Redesign**:
  - Remove Doctor Name from the hero Date header.
  - Move Doctor Name ("Attending Practitioner: Dr. Vibhuti Kori") into the expandable details section (`isExpanded`) alongside Clinical Notes/Observations, print options, and record editing buttons.
  - This keeps the card header focused cleanly on the Hero Date + Medicine summary count.

---

## 3. Responsive Layout Wrapping in Prescription Builder

### Component Location
- **Prescription Builder Inputs**: `src/pages/PatientProfile.tsx` (lines 832–932)

### Current Input Layout Structure (lines 833–932)
```tsx
<div className="flex flex-col md:flex-row flex-wrap lg:flex-nowrap items-center gap-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 shadow-sm relative" ref={searchRef}>
  <select className="w-full md:w-28 ..." /> {/* Power Select */}
  <select className="w-full md:w-36 ..." /> {/* Dosage Select */}
  <input className="w-full md:w-24 ..." />  {/* Code Input */}
  <input className="flex-grow ..." />        {/* Medicine Name Search */}
  <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
    <input type="number" className="w-16 ..." /> {/* Quantity Input */}
    <Button className="px-4 py-2 h-9 w-9 shrink-0">...</Button> {/* Plus Button */}
  </div>
</div>
```

### Mobile Defects Identified
1. **Vertical Overflow & Excessive Height**:
   On mobile screens (`< 768px`), `flex-col` causes every field to stack full-width into 5 tall rows, consuming vertical real estate.
2. **Autocomplete Dropdown Detached from Name Input**:
   - `ref={searchRef}` is placed on the parent `flex-col` container (line 833).
   - Autocomplete dropdown (line 911) uses `absolute z-50 left-0 right-0 top-full mt-2`.
   - On mobile, `top-full` places the search popup at the bottom of the entire form block (below Quantity & Plus button), far away from the Medicine Name input field!
3. **Quantity & Add Button Misalignment**:
   The Quantity input (`w-16`) sits inside a `w-full` flex row on mobile, leading to uneven alignment and awkward empty spacing next to the add button.

### Recommended Responsive Grid Fix Strategy
Replace the `flex-col md:flex-row` container with a clean responsive **CSS Grid** (`grid grid-cols-2 md:grid-cols-12 gap-3`):
```tsx
<div className="grid grid-cols-2 md:grid-cols-12 gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
  {/* Power Select: 1 col on mobile, 2 cols on desktop */}
  <div className="col-span-1 md:col-span-2">
    <select className="w-full px-2 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-black">...</select>
  </div>

  {/* Dosage Select: 1 col on mobile, 2 cols on desktop */}
  <div className="col-span-1 md:col-span-2">
    <select className="w-full px-2 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-black">...</select>
  </div>

  {/* Code Input: 1 col on mobile, 2 cols on desktop */}
  <div className="col-span-1 md:col-span-2">
    <input className="w-full px-2 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-black uppercase text-center" placeholder="CODE" />
  </div>

  {/* Medicine Name Search with Direct Relative Autocomplete Dropdown: 2 cols on mobile, 4 cols on desktop */}
  <div className="col-span-2 md:col-span-4 relative" ref={searchRef}>
    <input className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-black" placeholder="Search medicine..." />
    {showResults && searchResults.length > 0 && (
      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-60 overflow-y-auto">
        {/* Results */}
      </div>
    )}
  </div>

  {/* Quantity & Add Button: 1 col on mobile (flex row), 2 cols on desktop */}
  <div className="col-span-1 md:col-span-2 flex items-center gap-2">
    <input type="number" min="1" className="w-16 md:w-full px-2 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-black text-center" />
    <Button type="button" className="px-3 py-2.5 h-10 w-10 shrink-0">
      <Plus size={16} strokeWidth={3} />
    </Button>
  </div>
</div>
```

---

## Code Change Summary Table

| Component / Feature | Relevant File | Lines | Proposed Change |
|---------------------|---------------|-------|-----------------|
| **Patient Profile Layout** | `src/pages/PatientProfile.tsx` | 46, 616–641, 642–980 | Change from mutually exclusive tabs to priority Clinical History layout with collapsible Prescription Builder panel. |
| **Hero Date Header** | `src/pages/PatientProfile.tsx` | 662–675 | Remove Doctor badge from header; elevate Date to hero styling (`text-2xl sm:text-3xl font-black text-emerald-700`). |
| **Medicine Names Typography** | `src/pages/PatientProfile.tsx` | 700–705 | Enforce font size >= 14px (`text-sm`/`text-base` font-black) on all screen sizes. |
| **Doctor & Notes Expansion** | `src/pages/PatientProfile.tsx` | 671, 716–724 | Move Doctor Name and Clinical Notes into the expandable accordion details (`isExpanded`). |
| **Prescription Builder Responsive Inputs** | `src/pages/PatientProfile.tsx` | 832–932 | Replace `flex-col md:flex-row` with 12-col responsive CSS Grid (`grid-cols-2 md:grid-cols-12`). Attach `searchRef` and autocomplete dropdown directly to Medicine Name input wrapper. |

---

## Verification Plan

### Test Commands
1. **Compilation Check**:
   Run `npm run build` or `npx tsc --noEmit` to verify type safety and layout integrity.
2. **Visual & Responsive Inspection**:
   - Check desktop layout (`>= 1024px`): Verify Clinical History is main column and Prescription Builder is collapsible side panel/card.
   - Check mobile layout (`< 768px`): Verify inputs wrap cleanly using CSS Grid (Power & Dosage side-by-side, Code & Name below, Quantity & Add button aligned), and check that autocomplete popup appears attached directly below the Medicine Name field.
   - Check Timeline cards: Confirm Hero Date is large and bold, medicine names are >=14px, and doctor name + notes are expandable.
