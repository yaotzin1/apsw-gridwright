# Manual passes: how to run milestone H

> For the maintainer. The conformance report (`docs/conformance.md`) is interim until these are done, because each of them needs a person
> at a Windows machine. Do them in any order, in sessions of your own length. After each, **paste what you recorded into the chat** and I
> will write it into `research.md`, update the report rows and tick the task. Nothing here asks you to edit a file.
>
> The point of every pass is a **record**: what you did, what you saw or heard, and the version of the tool. "Seemed fine" is not a result.

## Before any pass

```bash
npm install            # once
npm run example        # builds the package, serves http://localhost:5173
```

Open <http://localhost:5173/>. The page is a grid with a column of switches above it. Each switch adds or removes an add-on. The ones you
need are **checkbox column**, **column layout**, **column filters**, **cell navigation**, **density**, **virtual**, **tree**,
**group by department**, **responsive** (then **stack rows below 560px**), **row detail**, **row actions**, **export** and **wcag**.

Write down once: Windows version, Chrome version (`chrome://version`), Firefox version, Edge version.

**Every pass is done twice where it matters: with `wcag` off, and with `wcag` on.** The report states each row for both.

---

## T-27: Chrome with the axe extension (about 30 minutes)

Covers what jsdom could not run: contrast, target size, reflow, and three rules that came back undecided (`label-content-name-mismatch`,
`aria-valid-attr-value`, `form-field-multiple-labels`).

1. Install **axe DevTools** (free) from the Chrome Web Store. Open DevTools (F12), the **axe DevTools** tab.
2. For each state below, set the switches, then press **Scan ALL of my page**. Use the setting **WCAG 2.2 AA** if it is offered, otherwise
   **WCAG 2.1 AA** plus best practices.

| # | State | Switches |
| :--- | :--- | :--- |
| 1 | default | the page as it loads |
| 2 | wcag | **wcag** |
| 3 | filter dialog | **column filters**, press a Filter button so the dialog is open, scan |
| 4 | picker | **column layout**, press **Columns** so the menu is open, scan; then again with **wcag** on |
| 5 | selection | click two row checkboxes, scan |
| 6 | tree | **tree** and expand one node |
| 7 | grouping | **group by department** |
| 8 | windowed | **virtual** |
| 9 | stacked | **responsive** then **stack rows below 560px**, and make the window narrower than 560 px |
| 10 | dark | switch your operating system to dark mode, reload, scan states 1 and 2 again |

3. For each scan write down: the number of **issues**, and for each issue its **rule id**, its **impact** and the element it names. Take
   particular note of `color-contrast` and `target-size`. A screenshot of a scan with issues is welcome.
4. Choose one issue at random in each scan and press **Highlight**, to check it is a real element and not noise.

**Paste back:** the Chrome and axe versions, and a table of state, issue count, rule ids.

---

## T-28: keyboard-only walk (about 45 minutes)

Unplug the mouse or do not touch it. Press **Tab** from the top of the page. For each configuration, work through the list and write down
anything that **cannot be reached**, **cannot be operated**, **loses focus** (focus goes to the top of the page or nowhere), **traps focus**,
or **cannot be seen**.

**Configuration A, default grid.**

1. Tab to the search box, type, Tab on. 2. Tab to each header: Enter on a sort button sorts; Shift+Enter on a second adds it as a second sort.
3. Tab to a row checkbox: Space selects. 4. Tab to the header checkbox. 5. Tab to the page-size select: change it with the arrow keys.
6. Tab to the Previous and Next buttons; press Next until it disables itself. **Where does focus go?** It must stay in the grid.

**Configuration B, `cell navigation`.** Tab into the grid once. The arrow keys move a cursor; Home, End, PageUp, PageDown, Ctrl+Home and
Ctrl+End jump. Tab leaves the grid in one press. Check you can see where the cursor is at every step.

**Configuration C, `column filters`.** Tab to a Filter button, Enter to open. Is focus inside the dialog? Fill a condition; Tab to Apply;
Enter. Open it again and press **Escape**: focus must return to the button that opened it. Try **Clear filters**.

**Configuration D, `column layout`.** Tab to **Columns**, Enter. Arrow keys move through the menu; Escape closes it and returns focus. Tab to
a column header's resize handle (it is a separator): the left and right arrows change the width. On a header, **Ctrl+Left** and
**Ctrl+Right** move the column. With **wcag** on, find the "Move … earlier", "Move … later", "Make … narrower" and "Make … wider" buttons in
the Columns menu and operate them with Enter.

**Configuration E, `export`, `row actions`, `row detail`, `tree`, `group by`.** Operate the export menu, the row menu (Enter or the
context-menu key on a row), expand and collapse a detail panel, a tree node and a group, each by keyboard.

**Configuration F, `wcag` on, cell navigation on, a column pinned** (use the pin buttons above the grid). Scroll the grid sideways with the
mouse first, then use only the arrow keys to move the cursor toward the pinned column. **The cursor cell must never end up partly under the
pinned column.** Repeat with **wcag** off: you should see it go under (issue #78). Note the difference.

**Paste back:** for each configuration, "all reachable and operable" or the exact step that failed and what happened.

---

## T-29: screen readers (about 90 minutes per pair; this is the one that finds real defects)

Use the protocol in `research.md` under "Screen-reader protocol (C-8)": ten numbered steps, each with what to record. Summary:

1. **Set-up.** Install **NVDA** (free, nvaccess.org). **Narrator** is built in: Windows key + Ctrl + Enter starts and stops it. Pairs to run:
   NVDA with Firefox, NVDA with Chrome, Narrator with Edge. Close your eyes or turn the screen off for the pass: sighted shortcuts hide defects.
2. **Run the ten steps** (arrive at the grid; read a cell; sort; page; filter; select; group and tree; resize and move; an error; the stacked
   layout) once with `cell navigation` on and once off. For the error, use the playground's option to fail the next request.
3. **Write down what was spoken, word for word.** Also the screen reader and browser version (NVDA: menu, Help, About).
4. **For every defect:** the pair, the step, what was spoken, what you expected, and whether you think it is the grid or the screen reader (a
   Narrator quirk is not a grid bug).
5. **VoiceOver with Safari, JAWS and TalkBack** stay "not tested" unless you can run them. That is a fine, honest answer.

**Also listen for these specifically**, because the tests assert them but nobody has heard them: that a sorted column says "sorted ascending" once, that
page 2 reads its rows as 26 onwards, that "filtered" is announced after Apply, that a failed fetch is spoken once and not twice, and that each value in
the stacked layout is read once with its column header.

**Paste back:** per pair, the spoken text for each step and the defect list.

---

## T-07: Windows High Contrast (about 15 minutes)

1. Settings, Accessibility, **Contrast themes**, choose **Aquatic** or **Desert**, **Apply**. (Alt + left Shift + Print Screen toggles it.)
2. With **wcag** on, look at: the **focus ring** on a button and on a checkbox; the **cursor cell** under cell navigation; a **selected row**; the **sort
   arrow** and, with two columns sorted, the **priority badge**; the **column resize line** (hover it); a **disabled** page button; an open **filter
   dialog** and the **Columns** menu.
3. For each: can you tell it from its neighbours? Note any that disappear or look identical to unselected.
4. Repeat with **wcag** off for the same list, so the report can say what `wcag()` changes there.
5. Turn the contrast theme off again.

**Paste back:** for each item "visible" or "not distinguishable", with the theme you used.

---

## What I do with it

I record each result in `research.md` with your date and versions, change the matching rows in `docs/conformance.md` (an unevaluated row becomes
Supports, Partially Supports or Does Not Support on your evidence; a row that your result overturns is corrected), file a GitHub issue for each
real defect, and tick T-27 to T-30. When the last row is no longer "Not yet evaluated", the report loses its "interim" label and I re-run
`npm run verify`.
