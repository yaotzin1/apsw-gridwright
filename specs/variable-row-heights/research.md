# Research: variable row heights

Options considered for letting rows differ in height under `virtualRows()`.

| # | Option | Verdict | Why |
| :--- | :--- | :--- | :--- |
| 1 | `rowHeightOf(row, index)` function, heights recorded for held rows | **Chosen** | Opt-in, no DOM reads, cheap for the uniform case, honest about unseen rows. |
| 2 | Widen `rowHeight` to `number \| function` | Rejected | Breaks anything that reads `rowHeight` as a number, including a third-party windowed body that follows `AddonSetupContext.rowHeight`. |
| 3 | Array or map of heights by index | Rejected | A million-entry array is the cost the design avoids; rows arrive in windows so indexes are not known up front. |
| 4 | Measure each row with `ResizeObserver` | Deferred | Exact for content-driven heights, but one observer per row, a render-to-layout-to-render loop, and no answer for rows that are not rendered. A separate spec; `rowHeightOf` does not prevent it. |
| 5 | Absolute-positioned rows (`transform: translateY`) | Rejected | Loses column alignment of a real `<table>` and the grid semantics the body keeps. Already refused in `GridVirtualBody`. |
| 6 | A height multiplier per density level | Rejected | Two sources of truth for one number (C-5). |

## Measurements to record before stage 8

AC-18 requires numbers, not a claim. To be filled during implementation:

| Scenario | Target | Measured |
| :--- | :--- | :--- |
| 1,000,000 rows, 0 custom heights, scroll event | no regression from today | |
| 1,000,000 rows, 1% custom, `offsetOf` / `indexAt` | microseconds per call | |
| 1,000,000 rows, 1% custom, recording a 200-row window | milliseconds | |
| 500 columns, 100,000 rows, mixed heights, scroll frame | within the frame budget in `performance.md` section 8 | |
