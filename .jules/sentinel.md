## 2025-05-18 - Markdown Link Scheme Normalization XSS
**Vulnerability:** XSS in `markdownToHtml` via HTML entity and percent-encoded schemes in links (e.g., `javascript&#58;alert(1)` or `javascript%3aalert(1)`).
**Learning:** Checking schemes solely after stripping whitespace/controls leaves room for bypasses if browsers decode entities or percent-encoding in `href` before execution.
**Prevention:** Always decode HTML entities and percent-encodings prior to checking scheme allowlists for user-supplied URLs.

## 2025-05-18 - Formula Injection in Export and Clipboard Headers
**Vulnerability:** Column headers in CSV export and HTML clipboard payload were exempted from formula defusing (`escapeFormulas` was passed as `false` for headers in `formatCsv` and `formatHtml`), allowing dynamic column headers starting with `=`, `+`, `-`, or `@` to execute as formulas in spreadsheet software.
**Learning:** Export logic previously assumed only data rows contained untrusted input, overlooking that column headers can also be user-supplied or data-driven (e.g., custom query schemas, dynamic CSV templates).
**Prevention:** Always apply uniform formula defusing rules across both table headers and body cells when serializing tabular data for spreadsheet applications.

## 2025-05-19 - Unterminated HTML Entities in Link Scheme Normalization XSS
**Vulnerability:** XSS bypass in `markdownToHtml` via HTML entity references without a terminating semicolon in link schemes (e.g., `javascript&#58alert(1)`, `java&#115cript:alert(1)`, or `javascript&colonalert(1)`).
**Learning:** HTML parsers decode numeric and named entities in attributes even when the terminating semicolon `;` is omitted.
**Prevention:** Entity normalization regexes in scheme checkers must match entity references with optional semicolons (`;?`).
