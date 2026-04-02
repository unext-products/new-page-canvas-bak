

# Role-Based Category Mapping

## Problem
All activity categories are shown to all roles (L1, L2, L3) when creating timesheet entries. The admin needs the ability to map each main category to specific roles so that only relevant categories appear for each user.

## Solution

### 1. Database Migration
Add a `role_scope` column to `activity_categories` table:
```sql
ALTER TABLE activity_categories 
ADD COLUMN role_scope text[] DEFAULT ARRAY['l1', 'l2', 'l3'];
```
Default includes all roles so existing categories continue working for everyone (backward compatible).

### 2. CategorySettings Updates (`src/components/settings/CategorySettings.tsx`)
- Add a **multi-select role picker** to the "Create New Category" dialog (only for parent categories, not child activities)
- Show role badges (e.g., L1, L2, L3 chips) on each parent category row in the list
- Allow editing role_scope on existing categories (inline or via edit action)
- Use `roleLabel()` from LabelContext so custom role names are displayed

### 3. useActivityCategories Hook (`src/hooks/useActivityCategories.ts`)
- Read `role_scope` from the fetched data
- Filter `parentCategories` (and their children) based on the current user's role
- An L1 user only sees categories where `role_scope` contains `'l1'`, etc.

### 4. Timesheet & Calendar
No changes needed — they already consume `parentCategories`/`selectableActivities` from the hook; filtering at the hook level propagates automatically.

## Technical Details

**Migration SQL:**
```sql
ALTER TABLE public.activity_categories 
  ADD COLUMN role_scope text[] NOT NULL DEFAULT ARRAY['l1','l2','l3'];
```

**Category interface update** — add `role_scope: string[]` to both `Category` (in CategorySettings) and `ActivityCategory` (in hook).

**Hook filtering logic:**
```typescript
const userRoleKey = isRole(role, 'l1', 'member', 'faculty') ? 'l1' 
  : isRole(role, 'l2', 'program_manager') ? 'l2' 
  : isRole(role, 'l3', 'manager', 'hod') ? 'l3' : null;

// Filter parents by role_scope, then only include children of visible parents
```

**Create Category dialog** — add checkboxes for L1, L2, L3 (all checked by default). The role picker only appears for parent categories (dialogMode === "category").

**Category list display** — show small colored badges next to each parent category name showing its assigned roles.

### Files to Modify
1. **Database migration** — add `role_scope` column
2. `src/hooks/useActivityCategories.ts` — add role-based filtering
3. `src/components/settings/CategorySettings.tsx` — add role picker in create dialog + display badges

