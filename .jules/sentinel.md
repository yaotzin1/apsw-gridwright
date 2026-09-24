## 2025-05-18 - Markdown Link URI Scheme Normalization
**Vulnerability:** XSS/script-execution via control characters/whitespace in Markdown link URI schemes (e.g., `java\tscript:` or `java\nscript:`).
**Learning:** Browsers strip control characters and whitespace when parsing URI schemes in `<a>` `href` attributes, allowing obfuscated schemes to bypass regex checks if unnormalized.
**Prevention:** Normalize URI schemes by stripping whitespace and ASCII control characters (`\x00` - `\x20`, `\x7F`) prior to evaluating against allowed/blocked scheme patterns.

## 2025-05-18 - CSV Injection Prevention with Leading Control Characters
**Vulnerability:** CSV formula injection (CWE-1236) via leading whitespace or control characters before formula trigger characters (`=`, `+`, `-`, `@`, `|`, `%`).
**Learning:** Spreadsheets evaluate cells as formulas even when preceded by spaces, newlines, or ASCII control characters (`<= 0x20`). Using RegExp literals with `\x00-\x1f` triggers ESLint `no-control-regex`.
**Prevention:** Inspect characters after skipping leading ASCII control characters/whitespace (`code <= 0x20`) without control regexes to ensure formula leads (`=+-@\t\r|%`) are escaped with `'`.
