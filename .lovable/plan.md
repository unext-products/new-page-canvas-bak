

# Replace Activity Breakdown Pie Chart with Scrollable Horizontal Bar Chart

## Problem
The pie chart has too many activity labels that overlap each other and block UI elements like the Submit button (visible in screenshot). With many activity types, pie charts become unreadable.

## Solution
Replace the `PieChart` with a horizontal `BarChart` inside a scrollable container. Each activity type gets its own row with the label above the bar (like the reference screenshot). The container has a fixed max height with vertical scroll.

## Changes

### `src/components/reports/ActivityBreakdownChart.tsx` — Full rewrite
- Replace `PieChart/Pie/Cell/Legend` imports with `BarChart, Bar, XAxis, YAxis, CartesianGrid`
- Sort data descending by hours
- Use a vertical layout: activity name as label above each bar, hours value displayed at bar end
- Wrap in a scrollable `div` with `max-h-[400px] overflow-y-auto`
- Dynamic height based on number of items (e.g., `items * 60px`) so bars aren't cramped
- Keep the same Card wrapper, tooltip with hours/percentage/entries
- Use `hsl(var(--primary))` as bar color (single color like the reference)
- Remove the Legend entirely — labels are inline

### No other file changes needed
The component is used in `Reports.tsx` and `Dashboard.tsx` with the same `data` prop — the interface stays identical.

