# window.codex

`window.codex` is a browser provider for Codex. It pairs a Chrome extension and local native host with a typed SDK, developer documentation, and Reflex—the reference history-analysis integration.

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

On first install, the extension opens a guided macOS bridge setup. Permission requests open in a focused wallet-style extension window; the side panel remains available for ongoing activity and connected-site management.

The native setup expects an installed and authenticated `codex` executable. Cloudflare deployment uses the currently authenticated Wrangler account and never receives Codex data.

See [SPEC.md](./SPEC.md), [SECURITY.md](./SECURITY.md), and [REFLEX.md](./REFLEX.md).

Hosted demos: [Docs](https://window-codex-docs.pages.dev) and [Reflex](https://window-codex-reflex.pages.dev).

## Release distribution

The monorepo uses npm workspaces internally; no registry publication is required. Public integrations install immutable tarballs attached to [GitHub Releases](https://github.com/mergd/window-codex/releases):

```bash
npx --yes \
  https://github.com/mergd/window-codex/releases/download/v0.1.0/create-window-codex-0.1.0.tgz \
  my-integration
```

Create the two release archives locally with `npm run release:pack`. Pushing a `v*` tag runs the release workflow and attaches the SDK and scaffolder archives to that GitHub release.

The release also contains `window-codex-bridge-macos.zip`, which is linked from extension onboarding and registers the native messaging host for the pinned extension ID.

## Cloudflare CI

`.github/workflows/deploy-pages.yml` builds and deploys Docs and Reflex independently on pushes to `main`, with preview deployments for pull requests. GitHub Actions stores the account-scoped `CLOUDFLARE_ACCOUNT_ID` and least-privilege `CLOUDFLARE_API_TOKEN`; neither credential is committed to the repository.
