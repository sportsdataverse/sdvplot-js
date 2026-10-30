# Releasing

Maintainer checklist for publishing `@sportsdataverse/sdvplot`, `@sportsdataverse/sporty` and
`@sportsdataverse/sdvtables` to npm. This file stays in the repo; it is not in any package tarball.

How a release runs: `.github/workflows/release.yml` runs `changesets/action` on every push to `main`. While changesets
are pending it opens or updates the version PR ("chore(release): version packages"); once that PR merges it runs
`pnpm release` (`pnpm build && changeset publish`). `changeset publish` calls `pnpm publish`, and pnpm hands the
packed tarball to the `npm` on `PATH`, so the npm version the workflow installs is the one that publishes.

npm attaches a trusted publisher only to a package that already exists, so the first publish of each package uses a
token and trusted publishing (OIDC) is configured afterwards.

## First publish, then trusted publishing

1. **Confirm the npm org.** <https://www.npmjs.com/org/sportsdataverse> must be an organization you own (free plan;
   every package public). The `sportsdataverse` scope exists on the registry, but the registry cannot tell an org
   from a user account anonymously, so check the page while logged in.
2. **Licence: done.** Settled 2026-10-08: `@sportsdataverse/sporty` ships under MIT, and its `NOTICE.md` records
   the agreement with the sportyR and sportypy maintainers. Nothing to do here; do not re-open it.
3. **Check the token: done.** Owner confirmed token scope (2026-10-08). The `NPM_TOKEN` secret must stay a granular
   access token with read and write on the `@sportsdataverse` scope (it creates new packages there), "Bypass 2FA"
   enabled (CI cannot answer a 2FA prompt), and an expiry after the release date (write tokens last at most 90 days).
4. **Give the publish step the token: done.** Wired 2026-10-08 in #32; owner confirmed token scope.
   `.github/workflows/release.yml` passes `NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}"` to the `changesets/action`
   step. `setup-node`'s `registry-url` writes the `.npmrc` that npm reads, and that file reads `NODE_AUTH_TOKEN`; an
   `NPM_TOKEN` variable would make `changesets/action` write `~/.npmrc`, which npm then ignores.

5. **First publish: done.** 0.1.0 shipped 2026-10-09 and 0.2.0 on 2026-10-30.

Open from here: 6 (trusted publishers), 7 (Node 24, drop the token) and the optional 8.
6. **Attach a trusted publisher to each package.** On npmjs.com, open the package, then Settings, Trusted Publisher,
   GitHub Actions: organization `sportsdataverse`, repository `sdvplot-js`, workflow filename `release.yml`,
   environment left blank. Repeat for all three packages. (With npm 11.15.0 or later and 2FA on your account,
   `npm trust github @sportsdataverse/<pkg> --file release.yml --repo sportsdataverse/sdvplot-js` does the same.)
7. **Move the workflow to OIDC and drop the token.** Trusted publishing needs npm 11.5.1 or later; Node 22 ships
   npm 10.9. Set `node-version: 24` in `release.yml` (or add `npm install -g npm@^11.5.1` before the changesets
   step), then remove `NODE_AUTH_TOKEN`. Keep `permissions: id-token: write`. The next release log should say
   "No NPM_TOKEN found, but OIDC is available - using npm trusted publishing".
8. **Optional: lock it down.** Set each package's publishing access to "Require two-factor authentication and
   disallow tokens", then revoke or rotate the token (check that no other repository still uses the org secret).

## Every release

1. Each user-visible change carries a changeset (`pnpm changeset`); merging it to `main` opens or updates the version
   PR.
2. Before merging the version PR, check that the docs describe what it ships: the root and package READMEs (npm shows
   them and cuts each one at 65,536 characters), `docs/docs/intro.mdx`, the home page and `CITATION.cff`.
3. Merge the version PR. The release job publishes every package whose version is not on npm yet, tags it and opens
   its GitHub release. Do not cancel or re-run that job: a re-run publishes again.
4. Confirm each version with `npm view @sportsdataverse/<pkg> version`, and that main's `ci` run on the merge commit
   is green (a bot pushes the version PR, so CI never ran on it).
