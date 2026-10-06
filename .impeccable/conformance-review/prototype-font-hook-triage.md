# Preserved font-comparison prototype exceptions

2026-10-05. A follow-up Stop hook reported five `design-system-font` findings with attribution unknown. These are retained design-review prototypes, rather than new production typography additions.

| Finding | Evidence | Disposition |
| --- | --- | --- |
| `Logo Nanum` in `.impeccable/logo-review/styles.css` | `index.html` and `docs/logo-font-exploration-2026-10-05.md` intentionally compare three logo fonts. Its Nanum WOFF2 is byte-identical to production `app/fonts/brand-nanum.woff2` (18,040 bytes). | Preserve specimen; specific value and file exception. |
| `Logo Noto` in the same CSS | Noto Serif KR is an intentional alternative specimen in that comparison. | Preserve specimen; specific value and file exception. |
| `Logo Black` in the same CSS | Black Han Sans is an intentional alternative specimen in that comparison. | Preserve specimen; specific value and file exception. |
| `Scoreboard Logo` in `.impeccable/logo-review/scoreboard.css` and `desktop-shell.css` | The HTML identifies these as image-based design-review prototypes. The alias loads the same Nanum WOFF2 as the selected production wordmark. | Preserve prototypes; specific value exception restricted to those two files. |

All four exceptions were persisted through the Impeccable `hooks ignore-value` launcher with evidence in their reasons. No manual config edit, file-wide ignore or rule-wide ignore was used. The agent classified these intentional comparison artifacts; this does not claim the user approved the unselected Noto or Black font for production.

No UI or DESIGN.md typography change was needed. All five findings have a documented exception; none remains pending in this batch. Production design-system font checking remains active.
