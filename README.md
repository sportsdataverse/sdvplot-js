# sdvplot-js <img src="docs/static/img/sdvplot-js-logo.png" align="right" width="140" alt="sdvplot-js hex logo">

TypeScript ports of [sdvplot/sdvplotR](https://github.com/sportsdataverse) and sportyR/sportypy: team identity,
colors, logos, surfaces and tables for SportsDataverse plots.

## Packages

- `@sportsdataverse/sdvplot` - team identity, colors, logos and headshots
- `@sportsdataverse/sporty` - sport surfaces (geometry and dimensions)
- `@sportsdataverse/sdvtables` - table helpers

Docs site: <https://plot.sportsdataverse.org>

## Toolchain

pnpm workspace, tsup, vitest, biome, api-extractor (public-type drift baseline in `packages/*/etc`),
attw + publint, changesets.

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm api:check && pnpm pack:check
```

After changing public types run `pnpm -r api:report` and commit the updated `etc/*.api.md`.

## Owner steps

- Create/own the `@sportsdataverse` npm org.
- Register each package on npmjs.com once and configure OIDC trusted publishing for
  `sportsdataverse/sdvplot-js` (workflow `release.yml`). Until then `changeset publish` fails at the publish
  step only.
- Upload `docs/static/img/social-card.png` as the repo's Social preview (Settings → General); GitHub has no
  API for it. `pnpm brand` regenerates it and the other brand assets (see `tools/brand/README.md`).

See [NOTICE.md](NOTICE.md) for licensing notes.
