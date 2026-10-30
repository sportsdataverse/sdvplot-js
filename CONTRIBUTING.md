# Contributing to sdvplot-js

Bug reports, ideas and pull requests are welcome. Open an issue first for anything larger than a small fix, so we can
agree on the shape before you write it.

## Setup

Node 20.18.1 or later (CI tests Node 20 and 22) and pnpm (the version in `package.json`'s `packageManager`; `corepack enable` picks it up).

```bash
pnpm install
```

On Windows, keep the checkout path short: under a deep path `@napi-rs/canvas` cannot find its ICU data, and the
examples gate fails.

## Before you open a pull request

Run what CI runs:

```bash
pnpm lint && pnpm vendor --check && pnpm codegen --check && pnpm build:index --check && pnpm typecheck && pnpm build \
  && pnpm test && pnpm api:check && pnpm pack:check && pnpm docs:build && pnpm --filter docs typecheck
```

- **Public types changed?** Run `pnpm -r api:report` and commit the updated `packages/*/etc/*.api.md`.
- **User-visible change?** Add a changeset with `pnpm changeset`: pick the packages it touches and the bump, and write
  one or two plain sentences on what changed for a user. The release notes and CHANGELOGs come only from changesets.
- **New example or guide?** Each example on the site is a module under `examples/` and runs in `pnpm test` and the
  docs build; pages show live examples rather than inert code blocks.

Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages and pull request titles
(`feat(sdvplot): …`, `fix(sdvtables): …`, `docs: …`).

The README's [Development](README.md#development) section describes the repository layout, the toolchain and the docs
build. [RELEASING.md](RELEASING.md) covers publishing, which maintainers do.
