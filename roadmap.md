# Report updates
- [x] Reduce report-loading requests and large table rendering.
- [x] Add member Level to screen tables and CSV/PDF reports.
- [x] Test role values and verify signed-in report generation and exports.

# Approval timestamps
- [x] Verify approval timestamps are stored by every approval action.
- [x] Show subtle approval timestamps beside entry statuses across views and exports for all levels.
- [x] Test timestamp rules and verify signed-in displays and downloads.

# Dashboard reportees
- [x] Add direct reportee card and names/status popup for every dashboard role; retain existing access restrictions per user decision.
- [x] Test mapping/count rules and verify signed-in admin view-as-manager popup and layout (22 reportees, four inactive); direct-manager authentication not exercised.

# Ramya approval visibility
- [x] Identify why mapped L1 reportees were excluded and enable MAB L3 approval of L1 while retaining L2 access.
- [x] Verify the approval workflow setting and Ramya's three reportees in the signed-in Approvals view; retain a live regression test.

# Direct manager scope
- [x] Limit manager views to direct mappings, removing indirect and program/vertical fallback visibility.
- [x] Enforce direct-only, same-organization access for manager data reads and entry updates.
- [x] Test Ramya's three-person scope across Approvals, Team, Reports and Dashboard; verify unrelated data stays hidden.