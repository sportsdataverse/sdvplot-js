---
"@sportsdataverse/sdvplot": patch
---

`sdvplot/vega`: the image layers (`withLogos`, `withWordmarks`, `withHeadshots`, `logoLayer`, `withAxisLogos`) carry an explicit description ("KC logo") instead of Vega's automatic `aria-label`, which read out the image URL, or the whole base64 data URI with `embedSources`. Embedded SVGs are also smaller.
