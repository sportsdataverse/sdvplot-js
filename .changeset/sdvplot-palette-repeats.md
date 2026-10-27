---
"@sportsdataverse/sdvplot": patch
---

`teamColorPalette` with a `background` (recharts, victory, svelte and chartjs): a team listed more than once now keeps one colour. The distinct-colour rule applies between teams, so a repeated entry no longer gets pushed to a different colour. `background` is documented as an opaque hex colour.
