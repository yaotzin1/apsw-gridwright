/**
 * What a framework adapter implements to be checked by the conformance kit.
 *
 * The kit asks questions a reader of the page could answer (what is the role, what is the name, what
 * does the live region say, where is the focus) and never about how the adapter is built. So the same
 * scenarios hold a React grid, an Angular one and a string renderer to the same behaviour.
 */

/** One thing on the page, as an assistive technology would meet it. */
export interface DriverElement {
    /** The ARIA role, explicit or implied. */
    readonly role: string;
    /** The accessible name. */
    readonly name: string;
    /** The visible text. */
    text(): string;
    /** An attribute's value, or null when it is absent. */
    attribute(name: string): string | null;
    /** Whether a checkbox is checked, or null when the element is not one. */
    checked(): boolean | null;
    /** The current value of a select or a field, or null when the element has none. */
    value(): string | null;
    /** Whether a checkbox is drawn in its mixed state. The platform has no attribute for it, so it is asked apart. False for anything else. */
    indeterminate(): boolean;
}

export interface DriverMountOptions {
    /** The columns, by id and header text. Every column is sortable unless it says otherwise. */
    readonly columns: readonly { readonly id: string; readonly header: string; readonly sortable?: boolean }[];
    /** Rows keyed by column id. The first column's value is the row's identity. */
    readonly rows: readonly Readonly<Record<string, string | number>>[];
    /** Rows per page. Default: all of them. */
    readonly pageSize?: number;
    /**
     * Turns row selection on: `multiple` also gives the grid its checkbox column; `onRowClick` lets a click on a row
     * select it. Leave out for a grid with no selection.
     */
    readonly selection?: { readonly mode: 'single' | 'multiple'; readonly onRowClick?: boolean };
}

/** A mounted grid. */
export interface DriverGrid {
    /** All visible text, for scenarios that only need to know something is there. */
    text(): string;
    /** The first element with the role (and the name, when given), or null. */
    query(role: string, name?: string): DriverElement | null;
    /** Every element with the role, in document order. */
    queryAll(role: string): readonly DriverElement[];
    /** The body rows' cell text, one array per row, in display order. */
    rows(): readonly (readonly string[])[];
    /** Activates an element the way a pointer does. `shift` holds Shift. */
    click(on: DriverElement, options?: { readonly shift?: boolean }): Promise<void>;
    /** Chooses an option of a select by its value, the way a reader does with the pointer or the keyboard. */
    choose(on: DriverElement, value: string): Promise<void>;
    /** Presses a key (`Tab`, `Enter`, `ArrowDown`), on the focused element or on the given one. */
    press(key: string, on?: DriverElement): Promise<void>;
    /** The element that has the focus, or null. */
    focused(): DriverElement | null;
    /** What the grid's live region says now. */
    liveRegionText(): string;
}

export interface ConformanceDriver {
    /** Draws a grid with the framework's default add-ons. */
    mount(options: DriverMountOptions): Promise<DriverGrid>;
    /** Removes whatever `mount` drew. Called after every scenario. */
    unmount(): Promise<void> | void;
}

/** One checked behaviour. `run` throws a `ConformanceFailure` when the adapter does not behave. */
export interface Scenario {
    /** Stable, so an adapter can list it in `skip` with a reason. */
    readonly id: string;
    readonly title: string;
    run(driver: ConformanceDriver): Promise<void>;
}

/** The runner's own `describe` and `it`, so the kit depends on no test library. */
export interface Runner {
    describe(name: string, body: () => void): void;
    it(name: string, body: () => Promise<void>): void;
}

export interface ConformanceOptions {
    /** Scenario ids not to run, each with the reason the adapter does not support it yet. */
    readonly skip?: Readonly<Record<string, string>>;
}
