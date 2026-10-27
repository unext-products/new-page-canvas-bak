# Project architecture
- Report aggregation batches and paginates member-related lookups, with bounded concurrency, to avoid per-member network waterfalls while preserving target-resolution fallbacks.
- Reports use the shared report-level resolver for member levels so on-screen tables and CSV/PDF exports agree, including legacy roles.
- Detailed report tables paginate rendering only; summary metrics and downloads always use the full fetched report.
- Entry approval timestamps use the shared formatter and display component across views and exports; only approved statuses expose approved_at as an approval time because rejections share that field.
- Authentication emails use the scaffolded managed email SDK handler; do not add queues or custom delivery infrastructure because this project uses platform-managed sending.
- Dashboard reportee cards use a separate effective-user-scoped, paginated direct-mapping lookup and shared card across all roles, so they do not change team metrics or approval scopes.
- Manager views use the shared direct-reportee resolver with no membership fallback, and restrictive per-user RLS enforces the same scope; explicit frontend scope also preserves isolation during admin impersonation.
- Keep the text Bun lockfile's public package tarballs on registry.npmjs.org and omit the legacy binary lockfile so hosted installs do not depend on sandbox-only download hosts.
