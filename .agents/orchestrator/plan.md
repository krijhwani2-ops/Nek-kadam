# Execution Plan: Nek Kadam OS Improvements

## Overview
Implement UX, UI accessibility, and performance improvements to Nek Kadam OS screens.

## Phase 1: Milestone R1 - Patient Profile & History Timeline Redesign
1. Dispatch 3 Explorers (`teamwork_preview_explorer`) to investigate codebase, locate Patient Profile components, Timeline Card components, and styling configurations.
2. Collect Explorer handoffs and formulate concrete implementation tasks.
3. Dispatch Worker (`teamwork_preview_worker`) to refactor Patient Profile layout, timeline card, font sizes, expandable notes, and responsive input wrapping.
4. Dispatch 2 Reviewers (`teamwork_preview_reviewer`) to review code changes and test UI rendering.
5. Dispatch 2 Challengers (`teamwork_preview_challenger`) and 1 Forensic Auditor (`teamwork_preview_auditor`) to verify implementation integrity and test cases.

## Phase 2: Milestone R2 - UI/UX & Bug Sweep
1. Dispatch Explorers to investigate Medicine Queue hard-reset blank screen issue, Attendance search debounce logic, Chat message capping logic, and Light/Dark theme rendering.
2. Dispatch Worker to implement loading state for Medicine Queue, 300ms debounce for Attendance, 500 message cap for Chat, and theme fixes.
3. Dispatch Reviewers, Challengers, and Forensic Auditor.

## Phase 3: Milestone R3 - Build Verification & Final Acceptance
1. Dispatch Worker to run `npm run build` and run test suite.
2. Verify all acceptance criteria:
   - Medicine names >= 14px
   - No blank screen on Medicine Queue reset
   - `npm run build` succeeds cleanly
   - Attendance search debounced by 300ms
3. Dispatch Forensic Auditor for final verification.
4. Present victory summary to parent/Sentinel.
