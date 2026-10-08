---
"@sportsdataverse/sdvtables": patch
---

A host page's global table CSS no longer restyles an sdvtables table. Observable Framework's `td { color }` and `table { font }` rules beat the ink and type a cell only inherited from the table root, and Docusaurus (Infima) painted its stripe on every second row: in dark mode a dark theme on a light page, or a light theme on a dark page, fell to about 1.0–1.6:1 contrast. Cells now take their row's ink explicitly (`color: inherit`, at specificity (0,1,0), so an element-only host rule loses and an author's class-qualified rule such as `.page td { color }` still wins), the table inherits the root's font, rows drop a host's background and rules, and cells drop its borders (Infima borders every cell). sdvtables itself never styles a `<tr>`, and the theme renders on a bare page are unchanged.
