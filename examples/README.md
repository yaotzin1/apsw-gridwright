# Examples

| Example | What it is | Use it to |
| :--- | :--- | :--- |
| [`playground/`](playground/README.md) | Two runnable pages over a mock API, plain ES modules, `npm run example` | switch every add-on on and off, and find the file behind each panel |
| [`react-remote/App.tsx`](react-remote/App.tsx) | Every add-on as TypeScript and JSX, the way an application writes it, plus one of its own, type-checked with the package | copy code into a project |

Both use the package the way a project that ran `npm install apsw-gridwright` does: one
`<Gridwright />`, with its features listed in `addons`. The playground
loads the same exports from `dist/` because it has no bundler; its README has
[the translation table](playground/README.md#from-the-playground-to-your-application).

Start with the playground's [I want to…](playground/README.md#i-want-to) table.
