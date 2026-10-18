---
"@sportsdataverse/sdvtables": minor
---

The 27 reactablefmtr themes, registered as `fmtr-<name>` (`fmtr-espn`, `fmtr-nytimes`, `fmtr-no-lines`, ...) with reactablefmtr's own colours, sizes, rules and padding, plus `fmtr-team`, reactablefmtr's default look in a team's colours (`{ league, team }`). Each theme takes its reactablefmtr arguments as options (`fontSize`, `fontColor`, `headerFontSize`, `headerFontColor`, `backgroundColor`, `cellPadding`) and reactable's `striped` and `highlight`; the highlight fills the hovered row, on by default in `fmtr-hoverdark` and `fmtr-hoverlight`. A few body colours and fills moved just far enough to pass the 3:1 contrast checks. `FMTR_THEME_NAMES` lists the 27, and `GT_ALIASES` maps each reactablefmtr name to its theme. New decoration `legendIcon`, reactablefmtr's `add_icon_legend`: reactablefmtr's ski-rating, medal and battery icon sets, or your own shapes, drawn as inline SVG.
