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
2. **Formalize the J3 licence understanding in writing.** `@sportsdataverse/sporty` ports sportyR (GPL-3) under MIT;
   see `NOTICE.md`. Do this before anything is published.
3. **Check the token.** The `NPM_TOKEN` secret must be a granular access token with read and write on the
   `@sportsdataverse` scope (it creates new packages there), "Bypass 2FA" enabled (CI cannot answer a 2FA prompt), and
   an expiry after the release date (write tokens last at most 90 days).
4. **Give the publish step the token.** In `.github/workflows/release.yml`, add
   `NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}"` to the `env` of the `changesets/action` step. `setup-node`'s
   `registry-url` writes the `.npmrc` that npm reads, and that file reads `NODE_AUTH_TOKEN`; an `NPM_TOKEN` variable
   makes `changesets/action` write `~/.npmrc`, which npm then ignores.
5. **Merge the version PR only when every phase has landed.** All three packages ship together at 0.1.0. After the
   release job finishes, confirm each package exists:
   `npm view @sportsdataverse/sdvplot version`, and the same for `sporty` and `sdvtables`.
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
