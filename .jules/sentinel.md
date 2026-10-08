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

## 2026-10-04 - Markdown Link Scheme Normalization XSS via Soft Hyphen Entities and Zero-Width Characters
**Vulnerability:** XSS in `markdownToHtml` via soft hyphen HTML entities (`&shy;`, `&shy`, `&#173;`, `&#xAD;`) and zero-width/format control characters (`\u00AD`, `\u200B`..`\u200D`, `\u2060`, `\uFEFF`) in link schemes (e.g., `java&shy;script:alert(1)` or `java&#173;script:alert(1)`).
**Learning:** Checking schemes solely for ASCII whitespace/controls leaves room for bypasses because browsers decode `&shy;` entities and ignore soft hyphens and zero-width format characters in `href` schemes during URL navigation.
**Prevention:** Explicitly decode soft hyphen entities (`&shy;?`) and strip ignorable format characters (`\u00AD`, zero-width characters, BOM) when normalizing scheme strings prior to allowlist validation.
