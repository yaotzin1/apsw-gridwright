## 2025-05-18 - Markdown Link URI Scheme Normalization
**Vulnerability:** XSS/script-execution via control characters/whitespace in Markdown link URI schemes (e.g., `java\tscript:` or `java\nscript:`).
**Learning:** Browsers strip control characters and whitespace when parsing URI schemes in `<a>` `href` attributes, allowing obfuscated schemes to bypass regex checks if unnormalized.
**Prevention:** Normalize URI schemes by stripping whitespace and ASCII control characters (`\x00` - `\x20`, `\x7F`) prior to evaluating against allowed/blocked scheme patterns.
