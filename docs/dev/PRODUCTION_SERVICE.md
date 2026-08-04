# Production Backend Service

The Quortex multiplayer backend is declared by
[`deploy/nixos/quortex.nix`](../../deploy/nixos/quortex.nix). It creates a
dedicated `quortex` user and group, starts the compiled backend after networking
is available, restarts it on failure, and records output in the system journal.

The service has read-only access to the active release and writable access only
to `/var/lib/quortex/data`. NixOS creates the following stable layout:

```text
/var/lib/quortex/
  current -> releases/<release-id>
  releases/                  root:root, 0755
  data/                      quortex:quortex, 0750
```

The `current` symlink and release contents are intentionally not created by the
module. Release creation and atomic activation belong to the immutable-release
deployment step.

## Host configuration

The production NixOS flake can pin this repository as a non-flake input and
import the module directly from the pinned source:

```nix
inputs.quortextt = {
  url = "github:anicolao/quortextt";
  flake = false;
};

# Add `quortextt` to the flake output arguments, then in the kenobi module list:
modules = [
  (quortextt + "/deploy/nixos/quortex.nix")
  {
    services.quortex.enable = true;
  }
];
```

The module defaults match production:

- release: `/var/lib/quortex/current`;
- data: `/var/lib/quortex/data`;
- secrets: `/etc/quortex/environment`;
- listener: `127.0.0.1:3001`, reachable only through the local Nginx proxy;
- public origin: `https://quortex.morpheum.dev`;
- runtime: the Nixpkgs Node.js 22 package.

## Secrets

`/etc/quortex/environment` is host configuration, not release content. It must
be owned by `root:root`, use mode `0400` or `0600`, and contain a non-empty
`JWT_SECRET`. OAuth variables are optional, but each enabled provider requires
both its ID and secret:

```text
JWT_SECRET=<random production signing key>
DISCORD_CLIENT_ID=<id>
DISCORD_CLIENT_SECRET=<secret>
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
FACEBOOK_APP_ID=<id>
FACEBOOK_APP_SECRET=<secret>
```

Do not place `HOST`, `PORT`, `DATA_DIR`, `BASE_URL`, or `CLIENT_URL` in this
file; the service declares those non-secret values. Do not copy `VITE_*` build
settings into the backend environment.

The service runs a root-only preflight before every start. It rejects a missing
environment file, unsafe ownership or permissions, a missing `JWT_SECRET`, or a
release without `server/dist/index.js`.

## One-time data migration

The existing production data must be copied once, while the old backend is
stopped, before the service is enabled. Preserve the source until the migrated
service has passed its health checks and a backup has been taken.

```bash
sudo install -d -o quortex -g quortex -m 0750 /var/lib/quortex/data
sudo rsync -a --chown=quortex:quortex \
  /home/anicolao/projects/quortextt/server/data/ \
  /var/lib/quortex/data/
```

The checkout's `server/backups/data` directory is a separate historical backup;
do not merge it into the live data directory. Copy it to a separate protected
backup location if it must be retained.

Create the production environment without printing its values. Copy only the
secret and provider values listed above from the legacy file; do not copy the
legacy file wholesale because it also contains build and runtime settings now
owned by the service:

```bash
sudo install -d -o root -g root -m 0700 /etc/quortex
sudo install -o root -g root -m 0600 /dev/null /etc/quortex/environment
sudoedit /etc/quortex/environment
sudo chmod 0400 /etc/quortex/environment
```

After the active release exists, build and switch the host configuration. Then
verify that the unit survives a restart and that Nginx reaches it:

```bash
sudo systemctl restart quortex
systemctl status quortex --no-pager
journalctl -u quortex -n 100 --no-pager
curl -fsS https://quortex.morpheum.dev/health
curl -fsS https://quortex.morpheum.dev/version
```

The service is enabled under `multi-user.target`, so it starts automatically
after reboot. A reboot validation should be scheduled only after the first
restart and public checks pass.

## Module evaluation

On a machine with Nixpkgs available through `NIX_PATH`, evaluate the module's
contract with:

```bash
nix-instantiate --eval --strict --json deploy/nixos/quortex-test.nix
```
