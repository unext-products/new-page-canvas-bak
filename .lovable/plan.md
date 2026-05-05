
# Pending Approvals Report Page (Admin Only)

## Overview
A new page under the "Analytics" sidebar group showing a table of all users who have pending approvals under them, with columns: **Name, Role, Vertical, Count of Pending Approvals** — sorted descending by pending count. Visible only to Admin and Super Admin roles.

## Implementation

### 1. New page: `src/pages/PendingApprovals.tsx`
- Access restricted to Admin and Super Admin only
- Query all `timesheet_entries` with `status = 'submitted'` (these are pending approval)
- For each submitted entry, determine the approver by looking up the entry owner's manager in `reporting_hierarchy`
- Aggregate pending counts per approver
- Join with `profiles` for name, `user_roles` for role, and `user_verticals`/`verticals` for vertical name
- Display table: Name, Role (using custom role labels), Vertical, Pending Count
- Sort descending by pending count
- Super Admin gets an org filter dropdown

### 2. Sidebar update: `src/components/AppSidebar.tsx`
- Add nav item for Admin and Super Admin role blocks only:
  `{ to: "/pending-approvals", icon: ClipboardList, label: "Pending Approvals", group: "Analytics" }`

### 3. Route: `src/App.tsx`
- Add `/pending-approvals` as a protected route

### Technical notes
- Uses existing RLS policies — Admin can see all entries in their org, Super Admin can see all
- Uses `reporting_hierarchy` to map submitters to their approvers
- Uses `fetchAllRows` pagination pattern for high-volume queries
- Uses custom role labels from `organization_role_labels`
