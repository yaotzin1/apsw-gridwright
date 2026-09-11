/**
 * Icons, as markup.
 *
 * The core has no opinion about icons, because the core renders nothing. The React adapter has
 * `icon` on a column, which is the same idea with the markup written for you. A page that builds
 * strings writes the strings.
 *
 * Every one is `aria-hidden`: the text beside it already says what it says.
 */

export const personIcon = (active) => `
    <span class="gw-icon" aria-hidden="true" style="color:${active ? '#16a34a' : '#94a3b8'}">
        <svg viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="5.2" r="3.1"></circle>
            <path d="M2.4 14.2a5.6 5.6 0 0 1 11.2 0z"></path>
        </svg>
    </span>`;

export const folderIcon = `
    <span class="gw-icon" aria-hidden="true" style="color:#f59e0b">
        <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3l1.4 1.7H13A1.5 1.5 0 0 1 14.5 5.7v5.8A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5V4Z"></path>
        </svg>
    </span>`;

export const fileIcon = `
    <span class="gw-icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
            <path d="M4.2 1.9h4.6l3 3v9.2H4.2z"></path>
            <path d="M8.8 1.9v3h3"></path>
        </svg>
    </span>`;
