# Milestone R2: UI/UX & Bug Sweep Analysis Report

## Overview
This document presents a comprehensive technical investigation of the UI/UX issues and bugs identified for Milestone R2 in the Nek Kadam application codebase. All findings include exact file locations, line numbers, root cause explanations, and proposed code fix strategies.

---

## 1. Task 1: Medicine Queue Component & Workbench Reset Logic

### File Paths & Locations
- Primary File: `src/pages/MedicineQueue.tsx` (Lines 44-507)
- Related Telemetry File: `src/pages/MedicineDashboard.tsx` (Lines 38-381)

### Observations
1. In `src/pages/MedicineQueue.tsx` lines 255-266, the **Hard Reset** button handler is defined as:
```tsx
<button 
  onClick={() => {
    setLoading(true);
    setIsRefreshing(true);
    lastSyncRef.current = '';
    setTasks([]);
  }} 
  className="..."
>
  <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
  <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">Hard Reset</span>
</button>
```
2. The polling fetch function `poll()` (lines 91-139) is defined inside a `useEffect` hook with an empty dependency array `[]` (lines 88-148).
3. The `poll()` function is **NOT** exposed or called when clicking the **Hard Reset** button.
4. When **Hard Reset** is clicked:
   - `setLoading(true)` sets `loading = true`.
   - `setTasks([])` clears all tasks from state (`tasks.length === 0`).
   - `lastSyncRef.current = ''` resets the delta sync ref.
   - The UI condition (line 270): `{loading && tasks.length === 0 ? (<FullPageLoadingSpinner />) : (<WorkbenchGrid />)}` replaces the workbench UI with a full-page loading spinner.
   - However, since `poll()` is not triggered by the click handler, the UI remains stuck showing the loading screen or empty screen for up to 4 seconds until `setInterval` triggers `poll()`.
5. In `poll()` lines 110-128:
   ```tsx
   if (updatedTasks.length > 0) {
     setTasks(prev => { ... });
   }
   ```
   If the API response returns `updatedTasks.length === 0` (e.g. no pending tasks), `setTasks` is never called to update `tasks`. In `finally` (line 133), `setLoading(false)` is set. Since `tasks` was cleared to `[]`, the screen switches to an empty queue UI with 0 tasks and loses workbench context without notifying the user why.

### Proposed Fix Strategy
1. Extract `fetchTasks` out of the `useEffect` body into a `useCallback` or `useRef` function so that it can be invoked both by the 4-second interval and directly by the **Hard Reset** button handler.
2. In the **Hard Reset** click handler, call `await fetchTasks()` immediately so data is fetched instantly without waiting for the 4-second interval.
3. Handle empty task lists explicitly in `fetchTasks` during a hard reset so `setTasks([])` is updated gracefully.
4. Keep the workbench UI visible with an inline loading overlay on the reset button (`isRefreshing`) rather than unmounting the entire workbench UI to show a blank/loading screen.

#### Code Patch Snippet (`src/pages/MedicineQueue.tsx`)
```tsx
// Before (Line 88-148):
useEffect(() => {
  let active = true;
  async function poll() { ... }
  poll();
  const interval = setInterval(poll, 4000);
  return () => { active = false; clearInterval(interval); };
}, []);

// After (Refactored):
const fetchTasks = useCallback(async (isHardReset = false) => {
  try {
    const url = new URL(`${getBaseUrl()}/api/queue/tasks`);
    if (!isHardReset && lastSyncRef.current) {
      url.searchParams.append('updatedAfter', lastSyncRef.current);
    }
    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}` }
    });
    if (!res.ok) throw new Error('Failed to fetch tasks');
    const result = await res.json();
    const updatedTasks: MedicineTask[] = result.data || [];

    setTasks(prev => {
      const map = isHardReset ? new Map() : new Map(prev.map(t => [t.id, t]));
      updatedTasks.forEach(task => map.set(task.id, task));
      const latest = updatedTasks.reduce((latestStr, t) => {
        return (!latestStr || t.updatedAt > latestStr) ? t.updatedAt : latestStr;
      }, isHardReset ? '' : lastSyncRef.current);
      lastSyncRef.current = latest;
      return Array.from(map.values()).sort(
        (a, b) => safeParseDate(b.createdAt).getTime() - safeParseDate(a.createdAt).getTime()
      );
    });
    setError(null);
  } catch (err) {
    console.error('[POLL ERROR]', err);
    setError('Connection lost. Reconnecting...');
  } finally {
    setLoading(false);
    setIsRefreshing(false);
  }
}, []);

const handleHardReset = async () => {
  setIsRefreshing(true);
  lastSyncRef.current = '';
  await fetchTasks(true);
};
```

---

## 2. Task 2: Attendance Screen & Search Input Debounce

### File Paths & Locations
- Primary File: `src/pages/Attendance.tsx` (Lines 27, 31-34, 133-153, 396-401)
- Related Service: `src/lib/tokenService.ts` (Lines 169-171)

### Observations
1. In `src/pages/Attendance.tsx` (lines 133-153), `searchPatients` is defined as:
```tsx
function searchPatients(query: string) {
  setPatientSearch(query);
  if (searchTimeoutRef.current) {
    clearTimeout(searchTimeoutRef.current);
  }
  if (query.length < 2) {
    setPatientResults([]);
    setSearchingPatients(false);
    return;
  }
  searchTimeoutRef.current = setTimeout(async () => {
    setSearchingPatients(true);
    try {
      const res = await searchPatientsApi(query);
      setPatientResults(res.data || []);
    } catch (e) {
      console.error('Search error:', e);
    }
    setSearchingPatients(false);
  }, 300);
}
```
2. `searchPatients` is passed directly to the `onChange` event of the input field in the Add Child modal (lines 396-401):
```tsx
<input 
  autoFocus
  value={patientSearch}
  onChange={(e) => searchPatients(e.target.value)}
  placeholder="Search child name or card..." 
  className="..."
/>
```
3. Issues identified with current implementation:
   - Defining `searchPatients` as an inline function triggered directly on `onChange` mixes input state management with debounced async side effects.
   - If the modal is closed (`showEnroll = false`) while `searchTimeoutRef.current` is running, the timeout callback attempts to call `setSearchingPatients(false)` and `setPatientResults(...)` on an unmounted modal component, causing a memory leak warning.
   - There is no cleanup function tied to component unmounting or `patientSearch` state changes in a `useEffect`.

### Proposed Fix Strategy
1. Decouple input value state (`setPatientSearch(e.target.value)`) from the debounced side effect.
2. Implement a clean `useEffect` hook watching `patientSearch` with a `300ms` `setTimeout` and cleanup function `return () => clearTimeout(timer);`.

#### Code Patch Snippet (`src/pages/Attendance.tsx`)
```tsx
// Replace inline searchPatients function with useEffect hook:
useEffect(() => {
  if (!patientSearch || patientSearch.length < 2) {
    setPatientResults([]);
    setSearchingPatients(false);
    return;
  }

  setSearchingPatients(true);
  const timer = setTimeout(async () => {
    try {
      const res = await searchPatientsApi(patientSearch);
      setPatientResults(res.data || []);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setSearchingPatients(false);
    }
  }, 300);

  return () => clearTimeout(timer);
}, [patientSearch]);

// Input onChange becomes:
<input 
  autoFocus
  value={patientSearch}
  onChange={(e) => setPatientSearch(e.target.value)}
  placeholder="Search child name or card..." 
  className="..."
/>
```

---

## 3. Task 3: Chat Component & Message List 500-Cap Memory Leak

### File Paths & Locations
- Primary File: `src/pages/Chat.tsx` (Lines 25, 49-56, 64-81)

### Observations
1. In `src/pages/Chat.tsx` lines 49-56, the Socket.io real-time message handler caps the message array to 500 messages:
```tsx
socket.on('receive_chat_message', (msg: ChatMessage) => {
  if (!msg.recipientId) {
    setMessages(prev => {
      if (prev.some(p => p.id === msg.id)) return prev;
      return [...prev, msg].slice(-500);
    });
  }
});
```
2. However, in `loadHistory` (lines 64-81), when historical chat messages are fetched from the server endpoint `/api/chat/history`:
```tsx
const loadHistory = async () => {
  setLoadingHistory(true);
  try {
    const res = await fetch(`${getBaseUrl()}/api/chat/history`, { ... });
    const json = await res.json();
    if (json.data) {
      setMessages(json.data); // <--- UNBOUNDED ARRAY SETTING!
    }
  } catch (err) { ... }
};
```
3. `setMessages(json.data)` does **NOT** slice the history array. If the database history contains more than 500 messages (or messages containing base64 `fileData` attachments up to 3MB each), all of them are loaded directly into React state and rendered in DOM.
4. Over time, as chat history grows, this causes exponential memory consumption, UI lag, and browser freezes.

### Proposed Fix Strategy
1. Modify `loadHistory` to slice the fetched array to the most recent 500 messages: `setMessages((json.data || []).slice(-500));`.
2. Optionally strip or lazy-load heavy base64 `fileData` strings in state when rendering message lists, retrieving attachments only on demand.

#### Code Patch Snippet (`src/pages/Chat.tsx`)
```tsx
// Before (Line 73-75):
if (json.data) {
  setMessages(json.data);
}

// After (Line 73-75):
if (json.data) {
  setMessages(json.data.slice(-500));
}
```

---

## 4. Task 4: Theme Provider & Light/Dark Theme Audit

### File Paths & Locations
- Context Provider: `src/contexts/AppContext.tsx` (Lines 143-176)
- App Root: `src/main.tsx` (Lines 7-13) and `src/App.tsx` (Lines 650-755)
- Affected Screens:
  - `src/pages/MedicineQueue.tsx` (Lines 231-467)
  - `src/pages/MedicineDashboard.tsx` (Lines 147-378)
  - `src/pages/Chat.tsx` (Lines 158-323)
  - `src/pages/Attendance.tsx` (Lines 228-577)
  - `src/pages/Medicines.tsx` (Lines 121-279)

### Observations
1. `AppContext.tsx` implements theme state (`light` / `dark`) and toggles the `dark` class on `document.documentElement` (`root.classList.add('dark')`).
2. **Audit of Screen Components**:
   - **`MedicineQueue.tsx`**: Hardcoded dark slate classes (`bg-slate-900 text-slate-100`, `bg-slate-950`, `border-slate-800`). Does not support Light Mode theme; stays pitch dark when app is in Light Mode.
   - **`MedicineDashboard.tsx`**: Hardcoded light classes (`bg-slate-50 text-slate-800`, `bg-white`, `border-slate-200`). Does not support Dark Mode theme; stays glaring white when app is in Dark Mode.
   - **`Chat.tsx`**: Hardcoded WhatsApp light background (`bg-[#efeae2]`, `bg-[#f0f2f5]`, `bg-white text-[#111b21]`). Does not support Dark Mode theme.
   - **`Attendance.tsx`**: Header, cards, and student lists use `bg-white`, `border-slate-200`, `bg-slate-50` without `dark:` variants.
   - **`Medicines.tsx`**: Master header card and input backgrounds use fixed light classes without `dark:` variants.

### Proposed Fix Strategy
1. Refactor screen top-level container and card elements to use paired Tailwind color classes (`bg-white dark:bg-slate-900`, `text-slate-800 dark:text-slate-100`, `border-slate-200 dark:border-slate-800`, `bg-slate-50 dark:bg-slate-950`).
2. In `Chat.tsx`, set dark mode background and bubble variants:
   - Outer container: `bg-[#efeae2] dark:bg-slate-950`
   - Top & bottom bars: `bg-[#f0f2f5] dark:bg-slate-900 border-slate-200 dark:border-slate-800`
   - Message bubbles: `bg-white dark:bg-slate-800 text-[#111b21] dark:text-slate-100`

---

## Summary Matrix

| Milestone Task | Impacted File | Issue Description | Recommended Fix |
|---|---|---|---|
| 1. Medicine Queue Reset | `src/pages/MedicineQueue.tsx` | Hard reset does not call fetch function, causing 4s blank/stuck screen | Extract `fetchTasks` into callback, call immediately on Hard Reset |
| 2. Attendance Search | `src/pages/Attendance.tsx` | Patient search lacks clean `useEffect` 300ms debounce with unmount cleanup | Use `useEffect` hook watching `patientSearch` with 300ms timer & cleanup |
| 3. Chat Message Cap | `src/pages/Chat.tsx` | `loadHistory` sets unbounded array without slicing to 500 messages | Apply `.slice(-500)` to `loadHistory` response payload |
| 4. Light/Dark Theme Sweep | Multiple pages (`MedicineQueue`, `MedicineDashboard`, `Chat`, `Attendance`, `Medicines`) | Screens use hardcoded light or dark colors without matching `dark:` classes | Audit and add dual theme Tailwind classes (`bg-white dark:bg-slate-900`, etc.) |
