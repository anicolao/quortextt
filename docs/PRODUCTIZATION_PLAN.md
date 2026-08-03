# Quortex Productization Plan

## Purpose

This plan brings Quortex to a state where:

1. Every pull request is exercised as a complete application, using the real
   compiled backend wherever practical.
2. A successful merge to `main` is deployed automatically to production.
3. The frontend, backend, and deployed release can each report the exact Git
   commit they are running or serving.

The intended production origin is `https://quortex.morpheum.dev` on the NixOS
host currently reached as `matrix.morpheum.dev`.

## Current State

The repository already has useful pieces of this system, but they are not yet
connected into a single release process.

- GitHub Actions builds the frontend and runs unit and Chromium E2E tests.
- Most E2E tests run against the Vite development server. Multiplayer coverage
  starts the backend only in selected tests, and some tests skip when no server
  is already listening on port 3001.
- The Pages deployment workflow builds and publishes static files, but it does
  not deploy or manage the multiplayer backend.
- Production static files appear to have been copied manually into
  `/var/www/morpheum.dev/quortextt`. They do not match the build in the server's
  repository checkout.
- The compiled backend and persistent data exist on the host, but no systemd
  service currently keeps the backend running. Nginx therefore returns an
  upstream error for `/health`.
- The Nginx default document refers to a Discord build that is not present in
  the deployed static directory. Explicit HTML paths work, but the canonical
  root URL does not.
- Neither the browser application nor the server exposes an authoritative build
  hash.

## Guiding Decisions

### Test the real program, not a substitute

Pull-request E2E tests should compile and start `server/dist/index.js` with an
isolated temporary data directory. The frontend should be the production Vite
build served by `vite preview` or an equivalent static test server. Tests may
replace external identity providers, but should not replace Quortex HTTP,
Socket.IO, persistence, or game logic with mocks.

This is the "real backend" for a PR: the production server implementation built
from that PR, with disposable configuration and data. Arbitrary PR code must
not run against production credentials or production data.

### Build once, promote the same artifact

CI should produce one immutable release artifact containing both frontend and
backend outputs. Deployment should transfer and activate that artifact rather
than rebuilding an independently moving checkout on the server.

### Treat the Git commit as release identity

Every component in a release should receive the same full Git SHA at build
time. Human-friendly tags and build numbers are useful additions, but must not
replace the SHA.

### Make deployment atomic and reversible

Each release should have its own directory. Activating a release should be one
atomic symlink change followed by a managed service restart. The previous
release should remain available for immediate rollback.

## Target Architecture

### CI and pull requests

For every pull request, GitHub Actions should:

1. Install dependencies from the lockfile.
2. Build the frontend and backend with the PR's Git SHA embedded.
3. Run frontend and backend unit tests.
4. Start the compiled backend with test-only secrets and a temporary
   `DATA_DIR`.
5. Serve the compiled frontend with its backend URL pointed at that backend.
6. Wait for both processes to become healthy.
7. Run the Playwright suite against the resulting full stack.
8. Upload browser traces, screenshots, server logs, and version endpoints on
   failure.
9. Stop both processes and remove the temporary data even after a failed test.

Use one shared lifecycle helper for the test backend. No E2E test should depend
on a developer having manually started port 3001, and a missing backend should
fail a multiplayer test rather than cause it to skip.

The initial automated browser matrix should remain intentionally small and
reliable:

- Desktop Chromium on Ubuntu for every PR.
- A second Playwright project with the application's primary tabletop viewport
  and interaction model for every PR.
- Firefox, WebKit, touch/mobile emulation, and other operating systems in a
  scheduled or merge-queue job until their expectations are stable enough to
  become required checks.

Tests should use real guest authentication and real Socket.IO connections.
OAuth redirects to Discord, Google, or Facebook should be covered by focused
contract tests with provider boundaries stubbed; CI should never contain live
provider credentials.

### Optional PR environments

If browser artifacts are insufficient, trusted PRs may receive an ephemeral
full-stack preview under a per-PR hostname. Each preview must use its own
backend process, data directory, signing secret, and origin configuration.

Preview deployment must be opt-in for trusted branches or require maintainer
approval. Code from forks must never receive production SSH keys, OAuth secrets,
or access to production data. Preview cleanup should run when the PR closes.

### Production filesystem

Use an immutable release layout such as:

```text
/var/lib/quortex/
  releases/
    <full-git-sha>/
      frontend/
      server/
      release.json
  current -> releases/<full-git-sha>
  previous -> releases/<previous-full-git-sha>
  data/
```

Persistent game data must live outside release directories. A dedicated
unprivileged service account should own only the data it needs to modify.

Nginx should serve frontend files from the `current` release and proxy
`/api/`, `/auth/`, `/health`, `/version`, and `/socket.io/` to the backend. The
canonical root URL must return the intended application. Hashed assets should
be cached immutably, while HTML and version metadata should be revalidated.

The Vite base path and application entry point should be explicit deployment
configuration rather than an accidental combination of `/quortextt/`, a
missing Discord entry point, and manually copied files.

### Production backend

Declare the backend as a NixOS systemd service with:

- a dedicated user and group;
- `WorkingDirectory` set to the active release's server directory;
- `ExecStart` using the pinned Node runtime and `server/dist/index.js`;
- `DATA_DIR` pointing at `/var/lib/quortex/data`;
- `PORT=3001` and the production client origin;
- automatic restart on failure;
- startup ordering after networking and before deployment verification;
- logs available through the journal; and
- hardening appropriate for a network service.

Production secrets should be supplied through a root-readable environment file
or a NixOS secret manager such as `sops-nix` or `agenix`. Repository `.env`
files must not be the production secret store, and secret files must not be
world-readable.

## Version and Runtime Identity

### Build metadata contract

The release build should require these values:

```text
gitSha        full 40-character commit SHA
buildTime     UTC ISO-8601 timestamp
buildId       GitHub Actions run ID/attempt, when available
```

A dirty local build may append or separately report `dirty`, but CI and
production builds must reject missing or malformed SHAs. The metadata should be
generated once and consumed by both builds so the frontend and backend cannot
silently disagree.

### Frontend identity

The frontend build should provide:

- `version.json` at a stable, uncached URL;
- the same metadata through a typed compile-time constant or
  `window.__QUORTEX_BUILD__`; and
- a small user-visible About/diagnostics affordance showing at least the short
  SHA, with the full SHA available for copying.

Example response:

```json
{
  "component": "frontend",
  "gitSha": "0123456789abcdef0123456789abcdef01234567",
  "buildTime": "2026-08-03T15:04:05Z",
  "buildId": "1234567890.1"
}
```

### Backend identity

Add a public, side-effect-free `GET /version` endpoint returning the same
fields with `component: "server"`. Include the server SHA in `/health`, while
keeping `/health` suitable for automated readiness checks.

On Socket.IO connection, expose the server version in an initial protocol
message or handshake metadata. The browser diagnostics view can then show both
the frontend and connected-server SHAs and visibly warn when they differ.

### Release manifest

Each artifact should contain `release.json` with:

- the common build metadata;
- frontend and backend component names;
- the expected Node version;
- checksums of the deployable files; and
- any persistent-data schema version introduced in the future.

CI should verify that `frontend/version.json`, the backend `/version` response,
and `release.json` all report the commit under test. Production smoke tests
should verify that both public endpoints report the commit being deployed.

## Automatic Main Deployment

Create a production deployment workflow triggered only after required CI for a
push to `main` succeeds. It should use a protected GitHub environment so that
production credentials are unavailable to pull-request jobs.

The workflow should:

1. Download the exact immutable artifact built and tested for the `main` SHA.
2. Verify its manifest, SHA, and checksums.
3. Connect over SSH using a pinned host key and a narrowly scoped deployment
   credential.
4. Upload into a new `/var/lib/quortex/releases/<sha>` directory.
5. Validate file ownership, permissions, and required configuration without
   changing the active release.
6. Update `previous`, atomically switch `current`, and restart the declared
   backend service.
7. Reload Nginx only when its configuration actually changed.
8. Poll the public health and version URLs and establish a test Socket.IO
   connection.
9. Confirm that frontend, backend, and requested `GITHUB_SHA` are identical.
10. Mark the GitHub deployment successful and record the deployed URL and SHA.

Only the activation operation should require elevated privileges. Prefer a
small root-owned activation script with fixed paths and validated SHA input over
granting the CI account general shell or passwordless sudo access.

Use a deployment concurrency group so a newer `main` deployment supersedes a
queued older one without interrupting an activation already in progress.

### Rollback

If post-activation checks fail, the activation script should restore the
`previous` symlink, restart the backend, and verify the previous release. Keep a
small bounded number of old immutable releases for manual rollback and incident
analysis.

Any future persistent-data migration must declare whether it is backward
compatible. An irreversible migration requires a backup and a separate rollout
procedure; switching code symlinks alone is not a safe rollback for incompatible
data.

## E2E Test Improvements

The existing tests provide valuable narrative screenshots, but CI currently
uses changes to files written during the run as its visual assertion. Separate
the two concerns over time:

- Use Playwright's snapshot assertions for visual regression baselines and
  platform-specific tolerances.
- Generate documentation/user-story screenshots in an explicit command rather
  than as an incidental side effect of every E2E run.
- Preserve deterministic seeds, fixed fonts, GPU settings, viewport sizes, and
  animation controls.
- Keep interaction-based tests for user-visible behavior. Direct Redux dispatch
  tests are useful integration tests but should not be the only evidence for a
  user workflow.
- Run multiplayer tests with two isolated browser contexts against the shared
  compiled test server.
- Allocate ports dynamically and publish chosen URLs through the test fixture so
  parallel jobs cannot collide.

The required PR job should prove at minimum:

- the production frontend starts and reports the PR SHA;
- the production backend starts, persists to disposable storage, and reports
  the PR SHA;
- guest login and lobby creation use real HTTP endpoints;
- two clients can join and exchange game state over real Socket.IO; and
- the primary local/tabletop game remains playable.

## Implementation Sequence

Each phase should be a separately reviewable pull request where practical.

### PR 1: Common build identity

- Add a single metadata-generation step.
- Embed it in both builds.
- Add frontend `version.json` and backend `/version`.
- Include the SHA in `/health` and Socket.IO connection metadata.
- Add unit/integration tests for missing, malformed, and matching metadata.

Acceptance: a local full-stack build and CI artifact report one identical SHA
from every component.

### PR 2: Deterministic backend test lifecycle

- Add a test launcher for compiled `server/dist/index.js`.
- Use temporary data, generated test secrets, and dynamically allocated ports.
- Remove multiplayer skips caused by an absent manually started server.
- Always capture logs and clean up child processes.

Acceptance: the multiplayer E2E tests pass on a clean machine with no service
already listening.

### PR 3: Production-build E2E CI

- Build both components before Playwright.
- Serve `dist` rather than relying on Vite's development server.
- Split local/tabletop and full-stack multiplayer into named Playwright
  projects.
- Upload diagnostics on failure and make the full-stack smoke path required.

Acceptance: every PR tests the same compiled frontend and server shapes used by
the release artifact.

### PR 4: Visual test cleanup

- Introduce Playwright snapshot assertions.
- Separate documentation screenshot generation.
- Add the scheduled cross-browser and responsive matrix.

Acceptance: required visual checks are deterministic, and updating narrative
screenshots is an intentional reviewable action.

### PR 5: Declarative host service and secrets

- Add the NixOS systemd service and dedicated account.
- Move persistent data to its stable location.
- Move secrets to protected host configuration.
- Make `/health` succeed through Nginx after reboot.

Acceptance: the backend starts automatically after a reboot and does not depend
on an interactive shell or repository `.env` file.

### PR 6: Immutable release and canonical Nginx layout

- Add release packaging, manifest verification, and activation scripts.
- Serve static files from the `current` release.
- Fix the canonical root entry point and cache headers.
- Test activation and rollback on the host without production data changes.

Acceptance: a staged release can be activated and rolled back atomically, and
explicit and root URLs serve the intended application.

### PR 7: Deploy `main` automatically

- Add the protected production GitHub environment and restricted SSH identity.
- Deploy the tested artifact after `main` CI.
- Run public HTTP, version, and Socket.IO smoke checks.
- Roll back automatically on a failed activation check.

Acceptance: merging a harmless version change to `main` results in production
reporting that merge SHA with no manual file copying or process startup.

### PR 8: Optional trusted PR previews

- Provision isolated per-PR frontend, backend, secrets, and data.
- Publish the preview URL on the PR.
- Delete the environment when the PR closes.

Acceptance: an approved trusted PR can be reviewed in a browser without sharing
production state or credentials.

## Operational Checks

After the plan is implemented, an operator should be able to answer "what is
running?" with public read-only commands equivalent to:

```bash
curl -fsS https://quortex.morpheum.dev/version.json
curl -fsS https://quortex.morpheum.dev/version
curl -fsS https://quortex.morpheum.dev/health
```

The host should additionally expose:

- the `current` and `previous` release symlink targets;
- systemd service status and journal logs;
- the installed `release.json`; and
- recent GitHub deployment records containing URL, SHA, actor, and result.

None of these checks should reveal secrets, session identifiers, player data,
or OAuth configuration.

## Definition of Done

Productization is complete when all of the following are true:

- Every pull request has a required full-stack Playwright check using the
  compiled frontend and actual compiled Quortex backend.
- No multiplayer E2E test skips merely because a developer did not start a
  server.
- Pull-request jobs cannot access production secrets or data.
- The artifact deployed to production is byte-for-byte the artifact tested for
  the merged SHA.
- A successful merge to `main` deploys without manual copying, building, or
  process management.
- A failed deployment is detected by public smoke checks and automatically
  returns to a verified previous release.
- The browser UI, `version.json`, `/version`, `/health`, Socket.IO connection,
  and release manifest identify the same full Git SHA.
- The backend and Nginx recover automatically after a host reboot.
- Production secrets are not stored in the checkout and are readable only by
  the accounts that need them.
- `https://quortex.morpheum.dev/` is a working canonical entry point.
