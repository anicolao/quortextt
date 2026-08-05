# Immutable Production Releases

Quortex production releases are self-contained, checksummed archives. The host
does not build a checkout, install dependencies into an active directory, or
copy files over the currently running release.

## Release contents

After a common frontend and backend build, create the archive with:

```bash
npm run build:all
npm run verify:build-metadata
npm run package:release
```

`release-artifacts/quortex-<full-git-sha>.tar.gz` contains:

```text
frontend/                  compiled Vite output
server/dist/               compiled backend and server version metadata
server/node_modules/       production dependencies only
server/package.json
server/package-lock.json
LICENSE
release.json
```

`release.json` records the common build identity, expected Node major version,
component metadata paths, and the byte length and SHA-256 checksum of every
other file. Packaging rejects dirty builds or frontend/backend identity
disagreement, and confirms that the manifest SHA is the clean checkout's
current SHA. Verification rejects missing, additional, modified, or symlinked
files, as well as release entries that are group-writable or world-writable.

An extracted archive can be checked before staging with:

```bash
npm run verify:release -- /path/to/extracted-release <full-git-sha>
```

## Host layout

Archives are uploaded to the deployment account's incoming directory. The
privileged release command extracts them as new root-owned directories. Neither
the uploader nor an operator should write into `current`:

```text
/var/lib/quortex/
  releases/
    <full-git-sha>/
  current -> releases/<active-sha>
  previous -> releases/<rollback-sha>
  incoming/                 quortex-deploy-owned archives
  data/
```

The release directory and all of its contents must be owned by root and must
not be writable by group or other users. Persistent data and production
secrets remain outside every release.

## Activation and rollback

The NixOS module installs one fixed privileged command. It accepts only a full
Git SHA. If the release is not already installed, activation imports the
fixed-name `/var/lib/quortex/incoming/quortex-<sha>.tar.gz` archive first:

```bash
sudo quortex-release activate <full-git-sha>
sudo quortex-release rollback
```

The archive must be a regular file owned by the configured deployment account
and must not be writable by group or other users. Activation extracts it into a
root-owned temporary directory, verifies every path, byte, mode, owner, Node
version, and component SHA against `release.json`, and only then renames it into
`releases/<sha>`. It records the old `current` target as `previous`, atomically
replaces `current`, and restarts `quortex.service`. If the service restart
fails, it restores and restarts the old release.

Rollback verifies both targets, atomically swaps `current` and `previous`, and
restarts the service. A later deployment workflow can therefore call rollback
after a failed public smoke check without reconstructing the previous SHA.

## Canonical Nginx layout

With `services.quortex.nginx.enable = true`, the module declares
`quortex.morpheum.dev` with ACME and forced HTTPS by default.

- `/` serves `frontend/index.html` as the canonical multiplayer entry point.
- `/tabletop.html` serves local/tabletop mode.
- `/quortextt/` redirects existing links and client-side routes to their
  canonical root equivalents.
- `/assets/` and `/quortextt/assets/` serve hashed assets with a one-year,
  immutable cache policy.
- HTML and both frontend version paths use `Cache-Control: no-store`.
- `/api/`, `/auth/`, `/health`, `/version`, and `/socket.io/` proxy to the
  loopback backend; Socket.IO has WebSocket proxying enabled.

When no explicit `VITE_SERVER_URL` is compiled in, browsers use their current
origin. Production reaches the backend through Nginx; local development and E2E
reach it through the equivalent Vite proxy. This keeps the tested frontend
artifact free of an embedded temporary backend address.

Before enabling this virtual host, remove the legacy host definition that
serves `/var/www/morpheum.dev/quortextt`; defining the same NixOS virtual-host
options in two modules can cause conflicting declarations. The old static
directory should be retained until activation, public checks, and rollback have
all been exercised successfully.

Automatic upload, activation, public identity checks, and rollback are
described in [Automatic Production Deployment](AUTOMATIC_DEPLOYMENT.md).
