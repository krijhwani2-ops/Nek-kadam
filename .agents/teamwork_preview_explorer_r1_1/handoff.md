# Handoff Report: Milestone R1 — Patient Profile and History Timeline Redesign

## 1. Observation

### Key Codebase Locations
- **Patient Profile Page Component**: `src/pages/PatientProfile.tsx` (1265 lines total)
- **App Route Declaration**: `src/App.tsx` (line 734: `<Route path="/patients/:id" element={<PatientProfile />} />`)

### Verbatim Code Evidence

#### Observation 1: Tabbed Layout (Priority History / Collapsible Prescription Builder)
In `src/pages/PatientProfile.tsx`:
- Line 46:
  ```typescript
  const [activeTab, setActiveTab] = useState<'history' | 'new-visit'>('history');
  ```
- Lines 616–638 (Tab Buttons):
  ```tsx
  <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 pb-px">
    <button onClick={() => setActiveTab('history')} ...>Clinical History ({visits.length})</button>
    <button onClick={() => setActiveTab('new-visit')} ...>Write New Prescription</button>
  </div>
  ```
- Line 641 (Mutually Exclusive View Rendering):
  ```tsx
  {activeTab === 'history' ? (
    /* Clinical History Timeline (Lines 642 - 750) */
  ) : (
    /* New Visit Prescription Form (Lines 753 - 980) */
  )}
  ```

#### Observation 2: History Timeline Cards & Typography
In `src/pages/PatientProfile.tsx`:
- Header Date Rendering (lines 667–673):
  ```tsx
  <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
    {new Date(visit.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
  </h3>
  <div className="flex items-center gap-2 flex-wrap">
    <Badge variant="success">Dr. {visit.doctor_name || 'NGO Doctor'}</Badge>
    {visit.notes && <span className="text-xs text-slate-400 dark:text-slate-500">| Contains Observations</span>}
  </div>
  ```
- Medicine Name Rendering (lines 700–705):
  ```tsx
  <div key={mIdx} className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-150 flex justify-between items-center">
    <span>{med.medicine_name || med.medicine_code}</span>
    <span className="text-xs text-slate-400 font-bold">Qty: {med.quantity || 1}</span>
  </div>
  ```
- Combination Tag & Sub-label Typography (lines 696 & 943):
  ```tsx
  <Badge variant="success" className="text-[9px] px-2 py-0.5">{group.dosage_code || 'BD'}</Badge>
  <p className="text-slate-800 dark:text-slate-150 text-xs font-black">{med.name}</p>
  ```
- Expandable Doctor Notes (lines 716–723):
  ```tsx
  {isExpanded && (
    <div className="pt-4 border-t border-slate-100 dark:border-slate-850 space-y-4 ...">
      {visit.notes && (
        <div className="bg-orange-50/30 dark:bg-orange-950/10 ...">
          <p className="text-[10px] font-black text-orange-600 uppercase">Observations / Notes</p>
          <p className="text-sm font-bold text-slate-700 whitespace-pre-wrap">{visit.notes}</p>
        </div>
      )}
    </div>
  )}
  ```

#### Observation 3: Prescription Builder Inputs & Mobile Layout
In `src/pages/PatientProfile.tsx`:
- Container & Search Ref (lines 833):
  ```tsx
  <div className="flex flex-col md:flex-row flex-wrap lg:flex-nowrap items-center gap-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 shadow-sm relative" ref={searchRef}>
  ```
- Input Elements (lines 834–932):
  - Power select: `w-full md:w-28`
  - Dosage select: `w-full md:w-36`
  - Code input: `w-full md:w-24`
  - Name input: `flex-grow`
  - Autocomplete dropdown (line 911): `absolute z-50 left-0 right-0 top-full mt-2`
  - Quantity & Add Button container (line 925): `w-full md:w-auto flex items-center gap-2` containing `w-16` input.

---

## 2. Logic Chain

1. **Patient Profile Layout**:
   - *Observation*: `PatientProfile.tsx` uses `activeTab` to render history and prescription form in a mutually exclusive manner (`activeTab === 'history' ? ... : ...`).
   - *Reasoning*: When `activeTab === 'new-visit'`, the timeline is hidden. Doctors cannot see past visits while writing prescriptions.
   - *Deduction*: Redesigning the page to use a **Priority History Layout** with a **Collapsible Prescription Builder** (e.g. desktop 2-column grid / mobile top collapsible card) allows history to remain visible while giving doctors full access to write prescriptions.

2. **History Timeline Cards**:
   - *Observation*: Date is currently `text-xl sm:text-2xl` sharing the header row with the Doctor badge (`Dr. Vibhuti Kori`). Medicine names are `text-sm sm:text-base`, but sub-labels in selected combinations drop to `text-xs` (12px). Notes are expandable, but Doctor Name is in header.
   - *Reasoning*:
     - Combining Date and Doctor Name in the header dilutes the hero presentation of Date.
     - Sub-labels dropping below 14px reduce legibility for elderly users.
   - *Deduction*:
     - Elevate Date into the sole Hero header element (`text-2xl sm:text-3xl font-black text-emerald-700`).
     - Standardize all medicine text sizes to be **>= 14px** (`text-sm`/`text-base` minimum).
     - Relocate Doctor Name into the expandable card section (`{isExpanded && ...}`) alongside Notes and Print options.

3. **Prescription Builder Responsive Inputs**:
   - *Observation*: The input row uses `flex flex-col md:flex-row` with `ref={searchRef}` placed on the outer flex wrapper.
   - *Reasoning*:
     - On mobile (`flex-col`), 5 full-width rows stack vertically, creating an overly tall form.
     - Since `ref={searchRef}` and `relative` are on the outer wrapper, the autocomplete popup (`top-full`) attaches to the bottom of the *entire flex block* (below Quantity & Add button), appearing disconnected from the Medicine Name input field on mobile.
   - *Deduction*:
     - Convert the input row into a 12-column responsive CSS Grid (`grid grid-cols-2 md:grid-cols-12 gap-3`).
     - Wrap Medicine Name input in a dedicated `col-span-2 md:col-span-4 relative` container with `ref={searchRef}` so autocomplete attaches directly below the name field on all devices.

---

## 3. Caveats

- **Scope Limit**: Investigation is read-only. Source code has not been modified during this explorer phase.
- **Backend API Contract**: The API payloads for `/api/visits/save-full` and `/api/visits/edit-full` accept `medicineGroups`, `doctorName`, `notes`, `date`. Layout changes in `PatientProfile.tsx` will preserve this data shape.
- **Print Layout**: The hidden printable prescription element (`.printable-prescription`) at lines 1201–1261 relies on `selectedVisit` state; changes to `PatientProfile.tsx` layout will maintain printable structure.

---

## 4. Conclusion

- `src/pages/PatientProfile.tsx` contains all relevant UI logic for Patient Profile, History Timeline cards, and Prescription Builder.
- The redesign requirements for Milestone R1 are fully mapped with actionable fix strategies in `analysis.md`:
  1. Priority Medical History layout with collapsible Prescription Builder panel.
  2. Hero Date header (`text-2xl sm:text-3xl font-black`), medicine names >=14px (`text-sm`/`text-base`), and expandable Doctor Name + Notes.
  3. 12-column responsive CSS Grid for prescription builder inputs on mobile with autocomplete attached directly to the name field.

---

## 5. Verification Method

To independently verify these findings and recommended fixes after implementation:
1. **Source Inspection**:
   - Inspect `src/pages/PatientProfile.tsx` for `grid-cols-2 md:grid-cols-12` grid layout and search wrapper placement.
   - Verify Date styling (`text-2xl sm:text-3xl font-black text-emerald-700`) and relocation of `visit.doctor_name` to `{isExpanded && ...}`.
2. **Build Verification**:
   - Run `npm run build` or `npx tsc --noEmit` from project root (`c:/Users/admin/Downloads/nekkadam (1)-20260726T145227Z-1-001/nekkadam (1)`).
3. **UI Verification**:
   - Open Patient Profile page on desktop (`>= 1024px`) and verify Clinical History is visible alongside collapsible Prescription Builder.
   - Open Patient Profile page on mobile screen size (`< 768px`) and test autocomplete search in Prescription Builder to ensure dropdown appears directly below the search box.
