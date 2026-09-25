## 2025-05-18 - Markdown Link Scheme HTML Entity Obfuscation
**Vulnerability:** Markdown link scheme validation did not decode HTML entities before checking against blocked/allowed schemes, allowing obfuscated schemes like `java&Tab;script:` or `javascript&colon;` to bypass the URL scheme check and render as executable links in exported reports.
**Learning:** Browsers decode HTML entities in attributes (such as `href`) before interpreting the URL scheme. Scheme validation regexes must decode HTML entities and strip whitespace/control characters prior to checking allowed/blocked scheme lists.
**Prevention:** Always decode HTML entities before performing security scheme checks on URLs placed into markup attributes.
