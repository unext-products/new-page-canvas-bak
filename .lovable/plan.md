

## Plan: Add Delete Option for Applied Leaves

### What will change

Users (L1, L2, L3) will be able to delete leaves they applied for **today or future dates only**. Past leaves remain locked and cannot be deleted.

### Changes

**1. Timesheet Page (`src/pages/Timesheet.tsx`)**

- Add a `handleDeleteLeave` function that deletes from the `leave_days` table by ID, then refreshes leave data via `loadLeaveDays()` and entries via `loadEntries()`
- In the leave entry rendering block (around line 1166-1183), add a delete button (Trash2 icon) that appears **only when the leave date is today or in the future**
- The date check: `item.leave_date >= formatLocalDate(new Date())`

**2. Calendar Page (`src/pages/Calendar.tsx`)**

- Add state for a "delete leave" confirmation dialog (`deleteLeaveDialogOpen`, `leaveToDelete`)
- Modify `handleDayClick` (line 231): when a user clicks on a leave day that is today or future, instead of just showing a toast saying "Cannot add entries on leave days", open a confirmation dialog asking "Delete this leave?" with the leave type and date shown
- Past leave days still show the existing toast (no delete option)
- Add a `handleDeleteLeave` function that deletes from `leave_days` and calls `loadMonthData()` to refresh
- Add a simple AlertDialog for delete confirmation

### Technical Details

**Delete function (shared logic in both pages):**
```typescript
const handleDeleteLeave = async (leaveId: string) => {
  const { error } = await supabase
    .from('leave_days' as any)
    .delete()
    .eq('id', leaveId);
  
  if (error) {
    toast({ title: "Error", description: "Failed to delete leave", variant: "destructive" });
  } else {
    toast({ title: "Success", description: "Leave deleted successfully" });
    // refresh data
  }
};
```

**Date guard (Timesheet page rendering):**
```typescript
// Show delete button only for today or future leaves
const canDeleteLeave = item.leave_date >= formatLocalDate(new Date());
```

**Calendar month view click handler change:**
- If leave day and date >= today: open delete confirmation dialog
- If leave day and date < today: show "Leave Day - cannot modify past leaves" toast
- All other existing click behavior unchanged

### Files to modify

| File | Change |
|------|--------|
| `src/pages/Timesheet.tsx` | Add `handleDeleteLeave`, add delete button on leave entries for today/future dates |
| `src/pages/Calendar.tsx` | Add delete leave dialog state, modify leave day click to offer delete for today/future, add AlertDialog |

### What stays the same

- Leave application flow (Mark Leave dialog) -- unchanged
- Timesheet entry CRUD -- unchanged
- Past leave entries -- no delete option, fully locked
- RLS policies -- `leave_days` already allows users to delete their own rows
- All approval flows and syncing -- deleting from `leave_days` table is the single source of truth, so dashboards, reports, and approver views will automatically reflect the deletion

