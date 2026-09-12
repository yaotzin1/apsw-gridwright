/**
 * The features page: switches, the grid, and what the grid is holding.
 *
 * The grids themselves are in `shape-demo.js` (every in-memory shape) and `huge-demo.js` (ten
 * million rows). This file is the page around them.
 */
import { React, h } from '../shared/package.js';
import { choice, hint, languageChoice, panel, row, toggle } from '../shared/ui.js';
import { HugeDemo } from './huge-demo.js';
import { ShapeDemo } from './shape-demo.js';

const { useCallback, useState } = React;

const SHAPES = [
    ['nested', 'Nested children'],
    ['graph', 'Flat, with two parents'],
    ['stored', 'Stored on the server'],
    ['lazy', 'Lazy children'],
    ['many', '20,000 rows in memory'],
    ['huge', '10,000,000 rows, windowed'],
];

const HINTS = {
    huge: 'Ten million rows. The source is asked for a block of two hundred, the cache keeps eight of them, and the body renders about forty. Scroll fast and the rows you outrun are skeletons waiting for their block. Edit a name and the cache is dropped and asked again.',
    stored: 'This tree lives on the server as an adjacency list: one row per node naming its parent and its position. Add, rename or delete something and reload the page, and it is still there. Each change is one POST, and a refusal reverts the row the grid had already moved.',
    graph: 'Shared.pdf is one row under two parents. Rename it in one place and both change, because there is one row. Expand it in one place and only that one opens, because there are two placements.',
    lazy: 'Children arrive on first expand. Team B always fails, and the node stays open with the message so it can be retried. Expanding a folder a second time does not fetch again.',
    many: 'Twenty thousand rows in a plain array. Windowing is the switch that matters here, and it is the same switch the ten million rows use. Only the source underneath differs.',
    nested: 'Every switch above is a prop on one component. Turn the tree off and the menu and the editors keep working. Turn windowing on and the tree keeps working, indentation and all.',
};

export function App() {
    const [shape, setShape] = useState('nested');
    const [tree, setTree] = useState(true);
    const [virtual, setVirtual] = useState(false);
    const [actions, setActions] = useState(true);
    const [editing, setEditing] = useState(true);
    const [icons, setIcons] = useState(true);
    const [exporting, setExporting] = useState(true);
    const [filtering, setFiltering] = useState(true);
    const [locale, setLocale] = useState('en');
    const [strict, setStrict] = useState(false);
    const [events, setEvents] = useState([]);
    const [stats, setStats] = useState([]);

    const log = useCallback((name, detail) => {
        setEvents((current) => [{ id: Math.random(), name, detail }, ...current].slice(0, 24));
    }, []);

    // A demo reports what it holds and the page draws it. Deferred, so a child never sets parent
    // state during the parent's render.
    const onStats = useCallback((next) => queueMicrotask(() => setStats(next)), []);

    const huge = shape === 'huge';
    const treeable = shape !== 'many' && !huge;
    const treeOn = tree && treeable;
    const virtualOn = virtual || huge;

    return h('div', { className: 'stack' },
        panel(
            { title: 'Switches', sources: ['files/app.js'] },
            row(
                choice('Data', shape, (next) => {
                    setShape(next);
                    if (next === 'huge') setVirtual(true);
                }, SHAPES),
                toggle('tree', treeOn, setTree, !treeable),
                toggle('virtual', virtualOn, setVirtual, huge),
                toggle('row actions', actions, setActions),
                toggle('inline edit', editing, setEditing),
                toggle('icons', icons, setIcons),
                toggle('export', exporting, setExporting),
                // Off over ten million rows: the range endpoint cannot filter, and a source that claims
                // to filter when it does not would make the switch a lie.
                toggle('column filters', filtering && !huge, setFiltering, huge)),
            row(
                languageChoice(locale, setLocale),
                huge ? null : toggle('refuse every edit', strict, setStrict)),
            hint(HINTS[shape])),

        panel(
            { title: 'The grid', sources: huge ? ['files/huge-demo.js', 'files/data.js'] : ['files/shape-demo.js', 'files/columns.js', 'files/data.js'] },
            huge
                ? h(HugeDemo, { key: 'huge', actions, editing, icons, exporting, locale, log, onStats })
                : h(ShapeDemo, {
                      // A tree and a flat list are different grids, so switching remounts. Every other
                      // switch changes in place.
                      key: `${shape}:${treeOn}:${virtualOn}`,
                      shape, tree: treeOn, virtual: virtualOn, actions, editing, icons, exporting, filtering, locale, strict, log, onStats,
                  })),

        panel(
            { title: huge ? 'What the browser is holding' : 'What the grid is holding' },
            h('dl', { className: 'stats' },
                stats.map(([label, value]) => h('div', { className: 'stat', key: label }, h('dt', null, label), h('dd', null, String(value))))),
            hint(huge
                ? 'Memory is a function of the cache, not of the table. Eight blocks of two hundred rows is the same whether the result set has ten thousand rows or ten million.'
                : treeOn
                  ? 'Nodes outnumber rows exactly when a row is placed more than once. Subtree size is arithmetic on the nested-set interval, never a walk.'
                  : 'The same component, with the tree switched off. Nothing else was rearranged to get here.')),

        panel(
            { title: 'Events' },
            h('div', { className: 'log' },
                events.length === 0
                    ? h('div', null, 'Expand a node, edit a cell, or open a row menu.')
                    : events.map((entry) => h('div', { key: entry.id }, h('b', null, entry.name), ' ', entry.detail)))));
}
