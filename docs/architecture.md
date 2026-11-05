# Why the grid has a view layer

The grid used to be a headless engine with one React component on top. It is now a headless engine, a headless
**view layer**, and renderers on top of that, React being the first. This page says why that was done, what it
means if you already use the grid, and what it costs. If you only want to write a renderer for another framework,
go to [Another framework](adapters.md).

## The short answer

- **Nothing you have written needs to change.** Every export that existed still exists at the same path, the React
  markup and class names are the same, no default moved, and every existing add-on, including your own, runs as
  before.
- **The cost is small and bounded.** In a browser, sorting and paging behave the same as before. On first load the
  new build was about 40 ms slower on average, which is inside the run-to-run noise of that measurement. In the
  jsdom benchmark, mounting a page of rows costs roughly 2 to 7 ms more and re-rendering is level or faster. It scales with
  what is on screen, never with how many rows you hold.
- **What you get is a second road.** A Vue, Angular, Svelte or custom-element grid can now be written against one
  small contract instead of a rewrite of the React package, and it can prove it behaves like the React one.

## Why we did it

The engine was already framework-free. The grid was not. Everything between the engine and the pixels, which is
what a header cell is, which attributes it carries, what a sort control does on a key press, what the live region
says, and how add-ons are ordered and suppressed, lived in `src/react/` and was typed in React's terms.

That had three consequences:

1. **A second framework meant a second implementation of the accessible behaviour.** Sort cycles, `aria-sort`,
   selection keys, focus after a page change and the announced sentence are exactly the parts that are easy to get
   subtly wrong, and two copies drift. We measured the starting point: the logic was mostly pure functions that
   imported no React, but they sat under `src/react/`, which imports React when it loads, so a non-React
   application could not reach them. Thirty-six files held add-on state in React hooks. The table's structure was
   decided inside JSX, so it could not be tested without a renderer or reused by another.
2. **A fix had to be made once per framework.** Fix a focus rule in React, and every other adapter keeps the bug
   until someone remembers.
3. **Security review had no single place to look.** Which tags and attributes a grid may emit was decided wherever
   JSX was written.

So the logic moved down, and the renderer became thin:

```text
engine            rows, query, state, pipeline        no DOM, no framework
view layer        table model, add-on contract        no DOM, no framework, one allowlist for tags and attributes
renderer          React today; yours tomorrow         draws plain data, decides nothing
```

The view layer describes the table as plain data (a node tree of elements, text, fragments, slots and
components). A renderer maps that data to its framework's own elements. There is no virtual DOM and no
reconciler: each framework already has one.

What we deliberately did **not** do: build a Vue or Angular adapter, migrate every feature add-on to the neutral
contract, or change the engine, the pipeline or the data sources. The goal was the architecture that makes those
possible, not any one of them. The full reasoning, the rejected alternatives and the decisions are in
[`specs/adapter-architecture`](https://github.com/yaotzin1/apsw-gridwright/tree/main/specs/adapter-architecture).

## Backward compatibility

This is a **minor** release for `apsw-gridwright`: two new entries and additive exports, nothing removed, renamed
or changed.

| If you... | What happens |
| :--- | :--- |
| use `<Gridwright />` and `useGridwright` | Same signatures, same props, same defaults, same markup and class names |
| import from `apsw-gridwright` or `apsw-gridwright/react` | Every name still exports from the same path; moved helpers are re-exports |
| use `sorting()`, `selection()` or `pagination()` | Same options, same behaviour; they are now written once as neutral add-ons and the React renderer runs them. Their React tests pass unchanged |
| wrote an add-on against `GridAddon` | Nothing to edit. `GridAddon` is untouched, and it is **not** an alias of the new contract, because an alias would have broken add-ons typed against React's events |
| write add-ons with React hooks in `setup` | Still supported; hook-using `setup` keeps running per render |
| style with the stylesheet or with `apsw-gridwright-mui` | Unchanged. The markup is the contract both rely on, and `apsw-gridwright-mui` is unaffected |
| use the headless core | Unchanged. No engine, pipeline or data-source change, and no new runtime dependency |

New in this release, and opt-in:

- `apsw-gridwright/view`: the table model, the node description, `createGridHost`, the neutral add-on contract
  (`defineAddon`, `createStore`) and the three core add-ons written once.
- `apsw-gridwright/conformance`: scenarios a renderer runs to show it behaves like the React one.
- `renderNode` in `apsw-gridwright/react`, which draws a node description as React elements.

A list passed to `addons={[...]}` may now hold either kind of add-on. Both new entries import with no React, no DOM
and no UI framework, in ESM and CommonJS, and share the core's chunk, so an error they throw is `instanceof` the
`GridwrightError` from the core entry.

The rule we held ourselves to: a change that makes a consumer's build stay green while their grid behaves
differently is a breaking change. Nothing here does.

## What it costs

We measured it three ways. All of them compare against the last release before this work, `v0.23.0`.

### 1. The jsdom benchmark (GitHub-hosted runner, nine interleaved rounds)

`npm run bench:render` renders the fixtures in jsdom. Times are in milliseconds; "change" is one re-render after a
sort. Percentages are the new architecture against `v0.23.0`, by minimum / median.

| Fixture | Mount before | Mount after | Change before | Change after |
| :--- | ---: | ---: | ---: | ---: |
| 10 000 rows x 12 columns, 50 per page | 35 / 36 | 37.9 / 38.1 (+8% / +6%) | 13.6 / 14.1 | 14.7 / 15.2 (+8% / +8%) |
| 10 000 rows x 12 columns, `virtualRows()` | 20.7 / 22 | 24.8 / 25.8 (+20% / +17%) | 8.2 / 10.8 | 7.5 / 7.9 (-9% / -27%) |
| 100 rows x 500 columns, `virtualColumns()` | 101.6 / 103.3 | 105.3 / 106.7 (+4% / +3%) | 28.8 / 29.3 | 30.1 / 30.8 (+5% / +5%) |
| 10 000 rows x 12 columns, 50 per page, selection | 42 / 43 | 49.1 / 49.6 (+17% / +15%) | 15.7 / 17.2 | 14.6 / 16.1 (-7% / -6%) |

The percentages look larger than the cost because the baselines are small: the worst mount difference is about
7 ms (the selection fixture), and a 60 fps frame is about 16 ms. The one cost that is real is the checkbox column on mount. Each checkbox
is drawn through the node description and the allowlist, and that allowlist is the single place a tag or attribute
is checked, so the cost is the price of that guarantee. It is bounded by the page or the window, never by the
data.

### 2. In a real browser (Chrome, both builds served locally)

The numbers above are jsdom, which has no layout or paint. So we also loaded both builds in Chrome from
`localhost`, alternating between them, and compared like with like.

| Measurement | `v0.23.0` | This release |
| :--- | :--- | :--- |
| Largest paint on load, median of 5 (ms) | 460 | 500 |
| Long-task time on load, median of 5 (ms) | 217 | 198 |
| Sort click until the table settles (ms) | 272 | 277 |
| Page change until the table settles (ms) | 272 | 271 |
| DOM changes for one sort / one page change | 150 / 175 | 150 / 175 |

The playground's mock API adds a delay of about 270 ms to every request, so "until the table settles" is mostly
that delay and says nothing about rendering cost. The useful lines are the last one, which says both builds do
identical work in the table, and the load row, where the 40 ms gap is smaller than the spread of the old build's
own runs (348 to 700 ms).

### 3. What we did not measure

Be careful not to read more into this than it holds:

- **No slow-device numbers.** Chrome's CPU throttling was not available to the test tooling. A few milliseconds on
  a fast machine is a few times more on a low-end phone. To check yours, open the playground, then DevTools >
  Performance > CPU > 4x slowdown.
- **No frame times while scrolling.** The automated browser did not deliver animation frames, so scroll smoothness
  is unmeasured. The re-render times above are the nearest evidence, and they are level or better.
- **No allocation counts.** Node gives no stable per-render allocation count.
- **A grid that renders hundreds of rows without pagination or `virtualRows()`** was not a fixture. That is where a
  per-cell cost would add up most, and it is not the use case the grid is designed around.

Compare any of these numbers only with themselves. Run-to-run noise on the same code is 10 to 15 percent in
jsdom, and one fixture swung from 48 ms to 278 ms between invocations on a developer machine. The raw tables and
the method are in
[`specs/adapter-architecture/research.md`](https://github.com/yaotzin1/apsw-gridwright/blob/main/specs/adapter-architecture/research.md).

## See it for yourself

```bash
npm run example        # builds the package, serves the playground on http://localhost:5173
npm run bench:render   # the jsdom benchmark
```

The hosted playground is rebuilt from `main` on every push, so it runs the view layer too.

## Where to go next

| You want to | Read |
| :--- | :--- |
| write a renderer for Vue, Angular or a custom element | [Another framework](adapters.md) |
| write an add-on once for every framework | [Add-ons](addons.md) and [Another framework](adapters.md) |
| see where your own code attaches | [Extensibility](extensibility.md) |
| read the decisions behind this | [`specs/adapter-architecture`](https://github.com/yaotzin1/apsw-gridwright/tree/main/specs/adapter-architecture) |
