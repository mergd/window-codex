# Codemask

Codemask is a developer wallet for Codex. The product injects the stable `window.codex` browser provider and pairs a Chrome extension with a local native host, typed SDK, developer documentation, and Reflex—the reference history-analysis integration.

## Quick start

```bash
npm install
npm run build
npm run setup:native
```

Load `apps/extension/dist` as an unpacked Chrome extension, then run either web app:

```bash
npm run dev:docs
npm run dev:reflex
```

On first install, Codemask opens a guided macOS bridge setup. Permission requests open in a focused wallet-style extension window; the side panel remains available for ongoing activity and connected-site management.

For the packaged developer install:

```bash
npx --yes "https://cm.fldr.zip/downloads/codemask-bridge.tgz?bridge=0.1.1"
```

The native setup expects an installed and authenticated `codex` executable. Cloudflare deployment uses the currently authenticated Wrangler account and never receives Codex data.

See [SPEC.md](./SPEC.md), [SECURITY.md](./SECURITY.md), and [REFLEX.md](./REFLEX.md).

Hosted demos: [Docs](https://cm.fldr.zip) and [Reflex](https://reflex.cm.fldr.zip).

## Release distribution

The monorepo uses npm workspaces internally; no registry publication is required. Public integrations install immutable tarballs attached to [GitHub Releases](https://github.com/mergd/window-codex/releases):

```bash
npx --yes \
  https://github.com/mergd/window-codex/releases/download/v0.1.0/create-window-codex-0.1.0.tgz \
  my-integration
```

Create the two release archives locally with `npm run release:pack`. Pushing a `v*` tag runs the release workflow and attaches the SDK and scaffolder archives to that GitHub release.

The release also contains `codemask-bridge.tgz`, the executable npx installer used by onboarding. The legacy ZIP remains available during the hackathon transition.

## Cloudflare CI

`.github/workflows/deploy-pages.yml` builds and deploys Docs and Reflex independently on pushes to `main`, with preview deployments for pull requests. GitHub Actions stores the account-scoped `CLOUDFLARE_ACCOUNT_ID` and least-privilege `CLOUDFLARE_API_TOKEN`; neither credential is committed to the repository.
