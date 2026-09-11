# BAREA Cloudflare Workers Deployment

## Purpose

BAREA frontend previews and production deployments use **Cloudflare Workers**, not Cloudflare Pages.

The application remains a Next.js 16 App Router project. Cloudflare's current recommended path for Next.js on Workers is **vinext**, which provides the Next.js API surface on Vite and supports App Router, React Server Components, Server Actions, and Cloudflare bindings.

## Current deployment model

```text
GitHub repository: jbr01061981-hue/barea
        |
        +-- main ----------------------> Cloudflare production Worker
        |
        +-- feature / PR branches -----> Cloudflare preview versions
```

Production must only come from `main` through the Cloudflare Workers Builds integration.

Non-production branch builds should be enabled so pull requests receive preview URLs without changing production.

## Repository configuration

The Cloudflare deployment configuration is intentionally kept in GitHub:

- `vite.config.ts` — vinext + Cloudflare Vite plugin.
- `wrangler.jsonc` — Worker name, compatibility settings, preview URLs, and Worker entry.
- `package.json` — vinext/Vite/Cloudflare/Wrangler dependencies and deployment scripts.

Current Worker name: `barea`.

If the Cloudflare account already contains a Worker named `barea`, do not silently rename it. Reconcile the existing Worker and this configuration first.

## Cloudflare setup

In Cloudflare Dashboard:

1. Open **Workers & Pages**.
2. Create an application using **Import a repository**.
3. Connect the GitHub account that owns `jbr01061981-hue/barea`.
4. Select the `barea` repository.
5. Select `main` as the production branch.
6. Enable **non-production branch builds**.
7. Confirm the Worker name matches `barea` in `wrangler.jsonc`.
8. Save and deploy.

Cloudflare Workers Builds uses the repository configuration and can post build/preview information back to pull requests.

## Build commands

For production:

```text
Build command: npm run build:vinext
Deploy command: npx wrangler deploy
```

For non-production branches:

```text
Build command: npm run build:vinext
Preview deploy command: npx wrangler versions upload
```

Cloudflare's Workers Builds uses `wrangler versions upload` for non-production previews so the version can be inspected without promoting it to production.

## Local Cloudflare development

After installing dependencies:

```text
npm run dev:vinext
npm run build:vinext
npm run deploy:cloudflare
```

A local Cloudflare authentication step may be required before a real deployment. Do not commit API tokens, account secrets, or other credentials.

## Environment variables and secrets

Do not place production credentials in `wrangler.jsonc`, source files, or Git history.

When BAREA begins consuming production authentication, database, realtime, or other external services, document each required variable here and configure secrets through Cloudflare's environment-variable/secret mechanisms.

Preview and production environments must be treated as separate deployment environments when secrets or service endpoints differ.

## Preview review process

For every frontend stage:

1. Push the implementation branch.
2. Cloudflare builds the branch preview.
3. Open the preview URL from the Cloudflare/GitHub pull request information.
4. Check desktop teacher layout.
5. Check mobile participant layout.
6. Check projector/presentation layouts when applicable.
7. Verify loading, error, empty, and recovery states.
8. Record material visual/design decisions in `docs/frontend/DESIGN_DECISIONS.md`.
9. Only then request merge approval.

## Important limitations

BAREA's current repository does not yet contain the production authentication integration or live quiz/realtime contracts. A successful Cloudflare deployment therefore proves the frontend can run on Workers; it does **not** mean those future backend capabilities are deployed or available.

Do not add Cloudflare bindings merely because they are available. Add D1, KV, R2, Durable Objects, Queues, AI, or other bindings only when a BAREA backend/frontend contract requires them and the binding is documented.

## Technology decision

Cloudflare Workers + vinext is the chosen BAREA frontend deployment target because:

- it supports the current Next.js 16 App Router direction;
- it supports Server Actions;
- it gives BAREA a native Workers deployment path;
- it supports future Cloudflare bindings;
- Workers Builds provides branch previews suitable for UI review.

`vinext` is currently beta/actively developed. BAREA must therefore run its compatibility check and build in CI/preview before adopting vinext for production. If a material compatibility problem appears, stop and document the finding before changing deployment architecture.

## References

- Cloudflare Next.js on Workers documentation: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Cloudflare Workers Builds configuration: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Cloudflare GitHub integration: https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/
- vinext project: https://github.com/cloudflare/vinext
