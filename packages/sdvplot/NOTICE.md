# Notices

- `@sportsdataverse/sdvplot` re-shards the team index curated in **sdvplot** (Python, MIT) and reads the
  SportsDataverse logo archive manifest. It ports WCAG contrast helpers from **sdvplotR** (MIT).
- `@sportsdataverse/sdvplot/shots` ports blazing-the-nets' shot-chart code (Copyright (c) 2021-2026 Saiem Gilani, MIT). Its `hexbin` and
  `hexagonPath` port **d3-hexbin** 0.2.2, Copyright Mike Bostock, 2012-2016, BSD-3-Clause; the licence text follows
  this list verbatim. `diffScale` ports colour interpolation from **d3-interpolate** (Copyright 2010-2021 Mike Bostock,
  ISC) and **d3-scale-chromatic** (Copyright 2010-2024 Mike Bostock, ISC), whose RdBu scheme is from **ColorBrewer**
  (Copyright 2002 Cynthia Brewer, Mark Harrower, and The Pennsylvania State University, Apache License 2.0);
  `sizeHexes` ports `quantile` from **d3-array** (Copyright 2010-2023 Mike Bostock, ISC).

## d3-hexbin

```text
Copyright Mike Bostock, 2012-2016
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of the author nor the names of contributors may be used to
  endorse or promote products derived from this software without specific prior
  written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
