# Project architecture
- Report aggregation batches and paginates member-related lookups, with bounded concurrency, to avoid per-member network waterfalls while preserving target-resolution fallbacks.
- Reports use the shared report-level resolver for member levels so on-screen tables and CSV/PDF exports agree, including legacy roles.
- Detailed report tables paginate rendering only; summary metrics and downloads always use the full fetched report.
- Authentication emails use the scaffolded managed email SDK handler; do not add queues or custom delivery infrastructure because this project uses platform-managed sending.
