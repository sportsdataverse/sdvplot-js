---
"@sportsdataverse/sdvtables": patch
---

Data-driven colour columns (`colorRef` on `dataBar`, `colorRanks`, `colorPills` and `bubble`, and `iconSet`'s `iconColorRef`) accept the 148 CSS colour names (case-insensitive, trimmed: `"red"`, `" SteelBlue "`) as well as hex, as reactablefmtr does. A name resolves to its `#rrggbb` before rendering, so contrast ink is computed against the real colour and only hex reaches CSS. `transparent`, unknown names, `rgb()` / `hsl()`, `var()`, `url(...)` and blanks still render blank.
