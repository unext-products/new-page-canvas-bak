

# Only Count Approved Entries in Completion Rate

## Problem
Completion rate currently counts both "submitted" and "approved" entries (and in some places, ALL entries regardless of status). The user expects completion rate to reflect only **approved** entries, since unapproved work shouldn't count toward progress.

This affects L1 dashboard, HOD/Admin dashboard, and all Reports views.

## Changes

### 1. `src/components/dashboard/EnhancedCompletionCard.tsx`
- Line 86: Change filter from `status === "approved" || status === "submitted"` to only `status === "approved"`

### 2. `src/pages/Dashboard.tsx`
- **L1 today's hours** (line 242): Filter only `approved` entries
- **L1 weekly completion** (line 281): Filter only `approved` entries  
- **HOD weekly minutes** (line 475): Filter only `approved` entries (currently no status filter at all)
- **HOD per-member minutes** (~line 500-530): Filter only `approved` entries
- **Admin weekly minutes** (~line 666): Filter only `approved` entries
- **Admin vertical performance** (~line 700): Filter only `approved` entries

### 3. `src/lib/reportQueries.ts`
- **Member view totalMinutes** (line 286): Filter `entries` to only `approved` before summing
- **Department view totalMinutes** (line 543): Same filter
- **Per-faculty userMinutes** (line 594): Filter only `approved` entries
- **All-members totalMinutes** (line 710): Same filter
- **Activity breakdown** (line 845): Only count `approved` entries in breakdown

### Impact
All completion rates, actual hours, and activity breakdowns across Dashboard and Reports will only reflect approved entries. Pending/submitted entries will still show in pending counts but won't inflate progress metrics.

### Files changed
- `src/components/dashboard/EnhancedCompletionCard.tsx`
- `src/pages/Dashboard.tsx`
- `src/lib/reportQueries.ts`

