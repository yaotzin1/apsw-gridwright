## 2025-05-18 - Markdown Link Scheme Normalization XSS
**Vulnerability:** XSS in `markdownToHtml` via HTML entity and percent-encoded schemes in links (e.g., `javascript&#58;alert(1)` or `javascript%3aalert(1)`).
**Learning:** Checking schemes solely after stripping whitespace/controls leaves room for bypasses if browsers decode entities or percent-encoding in `href` before execution.
**Prevention:** Always decode HTML entities and percent-encodings prior to checking scheme allowlists for user-supplied URLs.

## 2025-05-18 - Formula Injection in Export and Clipboard Headers
**Vulnerability:** Column headers in CSV export and HTML clipboard payload were exempted from formula defusing (`escapeFormulas` was passed as `false` for headers in `formatCsv` and `formatHtml`), allowing dynamic column headers starting with `=`, `+`, `-`, or `@` to execute as formulas in spreadsheet software.
**Learning:** Export logic previously assumed only data rows contained untrusted input, overlooking that column headers can also be user-supplied or data-driven (e.g., custom query schemas, dynamic CSV templates).
**Prevention:** Always apply uniform formula defusing rules across both table headers and body cells when serializing tabular data for spreadsheet applications.

## 2025-05-18 - Markdown Link Scheme Normalization XSS via Semicolonless HTML Entities
**Vulnerability:** XSS in `markdownToHtml` via numeric and named HTML entities in link schemes lacking trailing semicolons (e.g., `java&#115cript:alert(1)` or `javascript&#58alert(1)`).
**Learning:** HTML entity decoding regexes requiring trailing semicolons leave room for scheme bypasses because browsers decode numeric entities in attribute values even without a trailing semicolon.
**Prevention:** Make trailing semicolons optional (`;&#?` or `;?`) when decoding HTML entities in URL scheme normalization logic.

## 2026-10-03 - Markdown Link Scheme Normalization XSS via Percent-Encoded HTML Entities
**Vulnerability:** XSS in `markdownToHtml` via percent-encoded HTML entities in link schemes (e.g., `java%26%23115%3bcript:alert(1)` or `javascript%26colon%3balert(1)`).
**Learning:** Performing percent decoding after HTML entity decoding leaves un-decoded entities in normalized scheme strings when percent-encoded ampersands (`%26`) are used.
**Prevention:** Iteratively decode both percent encodings and HTML entities until fixed-point in scheme normalization logic before stripping control characters.

## 2026-10-04 - Formula Injection Defusing for Leading Line Feeds
**Vulnerability:** `defuseFormula` checked `0x09` (`\t`) and `0x0d` (`\r`) but omitted `0x0a` (`\n`) in its unconditional leading control character check, allowing text cells starting with a line feed to bypass formula defusing when not followed by a formula lead character.
**Learning:** CSV and spreadsheet formula defusing must treat all leading ASCII whitespace control characters (`\t`, `\n`, `\r`) identically when guarding against control character prefixes.
**Prevention:** Include `0x0a` (line feed) alongside `0x09` (tab) and `0x0d` (carriage return) in leading control character checks for formula defusing.

## 2026-10-25 - Markdown Link Scheme Normalization XSS via Non-Breaking Spaces and Named Entities
**Vulnerability:** XSS in `markdownToHtml` via non-breaking space named entities (`&nbsp;` / `&NonBreakingSpace;`) and numeric or percent-encoded Unicode space characters (e.g., `&#160;`, `%a0`, `\u00A0`) in link targets.
**Learning:** Normalizing URL schemes by stripping only ASCII whitespace and control characters fails to strip Unicode space separators (`\p{Z}`) or decode named non-breaking space entities (`&nbsp;`), allowing scheme checks to be bypassed when browsers trim Unicode whitespace or decode entities in `href` attributes.
**Prevention:** Include named space entities (`&nbsp;`, `&NonBreakingSpace;`) in entity normalization, and filter out all Unicode space separators (`\p{Z}`) alongside ASCII controls when checking URL schemes.

## 2026-10-26 - Prototype Pollution Key Sanitization in Column Order Layout
**Vulnerability:** Saved layout normalization cleaned prototype pollution keys (`__proto__`, `prototype`, `constructor`) from record dictionaries (`widths`, `pinned`, `hidden`), but allowed them to persist in the `order` array when parsing untrusted layout state.
**Learning:** Object key sanitization logic often focuses on dictionary record keys, but array properties (such as column ID `order` lists) can also contain prototype pollution keys that need explicit filtering before state normalization.
**Prevention:** Filter prototype pollution key names (`__proto__`, `prototype`, `constructor`) from array representations of object keys alongside dictionary record key checks.
