---
"@sportsdataverse/sdvplot": minor
---

`toPNG(svg, { fonts: { files, defaultFamily, system } })`: the fonts resvg draws `<text>` with. On a host without system fonts (slim Docker images, minimal CI runners) resvg drew every label as nothing, with no error; `fonts.files` loads font files from disk (a missing file throws `InputError`), `defaultFamily` names the fallback family, and `system: false` skips the system fonts. The default is unchanged: the system fonts.
