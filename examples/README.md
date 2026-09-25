# Examples

| Example | What it is | Use it to |
| :--- | :--- | :--- |
| [`react-quickstart/`](react-quickstart/README.md) | Six steps from an array to a server, as a real React app: TypeScript, JSX, Vite, Strict Mode. `npm run example:react` | **start here**, and follow the steps in order |
| [`playground/`](playground/README.md) | Two runnable pages over a mock API, plain ES modules, `npm run example` | switch every add-on on and off, and find the file behind each panel |
| [`mui-quickstart/`](mui-quickstart/README.md) | The grid in an MUI app: `coreAddons={muiAddons()}`, a light/dark switch on a CSS-variables theme, and MUI's own switches beside it. `npm run example:mui` | see what `apsw-gridwright-mui` changes, by switching its views off and on |
| [`react-remote/App.tsx`](react-remote/App.tsx) | Every add-on as TypeScript and JSX, the way an application writes it, plus one of its own, type-checked with the package | copy code into a project |

Both use the package the way a project that ran `npm install apsw-gridwright` does: one
`<Gridwright />`, with its features listed in `addons`. The playground
loads the same exports from `dist/` because it has no bundler; its README has
[the translation table](playground/README.md#from-the-playground-to-your-application).

New to the package? Start with [react-quickstart](react-quickstart/README.md), or its prose
version in [docs/getting-started.md](../docs/getting-started.md). Looking for one specific
behaviour? Start with the playground's [I want to…](playground/README.md#i-want-to) table.
