# Extension Development Helper

[中文](README.zh-CN.md)

A VS Code extension for everyday development — postfix completion, script running, NPM utilities, and frontend/Java helpers in one place.

## Code Editing

### Postfix Completion

Type `.` after an expression to trigger completions, then press Tab to expand into full code. Works in JavaScript, TypeScript, Vue, Svelte, HTML, and more (configurable via `postfix.languages`).

Built-in templates: `var` / `let` / `const`, `await`, `for` / `forof` / `forin` / `foreach`. Supports custom templates (`postfix.customTemplates`), disabling built-ins, and automatic variable name inference.

```js
// "hello".let + Tab
let hello = "hello";
```

### Snippets

Handy snippets for JavaScript/TypeScript, Java, and Vue — e.g. `clg` (console.log), `sout` (System.out.println), `temp` (Vue SFC scaffold).

## Script Running & Debugging

### Run Button

A run button in the editor title bar for JavaScript and TypeScript; Batch on Windows; Shell Script on macOS/Linux. Output goes to the integrated terminal. Customize runners via `runner.jsRunner` / `runner.tsRunner` (defaults: `node` for JS, `tsx` for TS).

### Debug

A debug button in the title bar for JavaScript/TypeScript files — launches a Node debug session for the current file.

### Terminal Management

Right-click a terminal to close other terminals or close all terminals at once.

## NPM & Package Management

### package.json Shortcuts

- **Section jump**: Right-click `package.json` to jump to `scripts`, `dependencies`, or `devDependencies`.
- **Script CodeLens**: An Install button above `scripts`; a Run button next to each script for one-click install or execution.
- **Dependency navigation**: `Ctrl/Cmd + click` a dependency to open its `package.json` in `node_modules`, or the npm website if not installed.
- **Open on npm**: The "Go to Npm" context menu item opens the package page (or npm home) in your browser.
- **Dev shortcuts**: Extra context menu entries on `package.json` — reload window, command palette, developer tools.

Also supports the `dependencies.jsonc` file format.

### Outdated Dependency Detection

Automatically checks for outdated packages when you open `package.json`, with diagnostics and Quick Fixes (upgrade version, install missing packages, etc.). Tune behavior via `npm-outdated.*` — ignore list, update level, decoration style, cache lifetime, and more.

### node_modules Search

Right-click a `node_modules` folder in the explorer, or use the search icon in the NPM view title bar, to browse and search packages via Quick Pick.

## Frontend Helpers

### Tailwind CSS Class Completion

Tailwind utility class completions inside `class` attributes in HTML, Vue, Svelte, JavaScript/TypeScript/JSX, and CSS/Less/SCSS/Sass/Stylus.

### Vue Class Navigation

In `.vue` single-file components, jump between template `class` names and `<style>` selectors via Go to Definition.

## Java Helpers

### Language Services

AST-based support for Java:

- Document symbols (outline)
- Code folding
- Go to definition / type definition / implementation
- Semantic highlighting (classes, interfaces, enums, methods, variables)
- Syntax error diagnostics

### MyBatis Integration

- Bidirectional linking between Mapper interfaces and XML files, with **Go to Mapper** CodeLens on interfaces and methods.
- SQL syntax highlighting injected in `*Mapper.xml` and `*mapper.xml` files.

### Inline SQL Highlighting

SQL syntax highlighting inside string literals in Java, JavaScript, and TypeScript source files.

## Utilities

### TinyPNG Image Compression

Right-click a `.png` file in the explorer to compress it via the TinyPNG API — overwrite in place or save a copy (suffix configurable). Requires `tinypng.apiKey` in settings.

### Date Markdown Notes

Right-click a folder and choose "New Today Markdown" to create and open a file named `YYYY-M-D.md` — handy for daily notes or journals.

## Configuration

| Prefix | Description |
| --- | --- |
| `postfix.*` | Postfix languages, custom templates, variable name inference |
| `runner.*` | JS/TS run commands |
| `npm-outdated.*` | Outdated dependency detection behavior |
| `tinypng.*` | TinyPNG API key and output suffix |
