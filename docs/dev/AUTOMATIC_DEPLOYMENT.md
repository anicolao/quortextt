# Automatic Production Deployment

A successful `main` CI run calls the production workflow with the exact Git SHA
and immutable artifact produced by that run. The workflow does not rebuild the
application. It verifies the archive locally, uploads it through a dedicated
account, activates it through one fixed privileged command, and checks all
public runtime identities.

Pull-request runs never call the deployment workflow. Production credentials
belong to the GitHub `production` environment and are unavailable to ordinary
CI jobs.

## One-time host bootstrap

The host must import `deploy/nixos/quortex.nix` as described in
[Production Backend Service](PRODUCTION_SERVICE.md). Generate a dedicated SSH
keypair for GitHub Actions and configure only its public half in Nix:

```nix
services.quortex = {
  enable = true;
  deployment.authorizedKeys = [
    "ssh-ed25519 AAAA... quortex-production"
  ];
};
```

Before switching the host, complete the protected environment file and data
migration, remove the conflicting legacy Quortex Nginx virtual host, and retain
the legacy static files for rollback. The switch creates:

```text
/var/lib/quortex/incoming/   quortex-deploy:quortex-deploy, 0750
/var/lib/quortex/releases/  root:root, 0755
```

`quortex-deploy` has no access to production data or secrets. Its only
passwordless sudo rule is the fixed
`/run/current-system/sw/bin/quortex-release` command. That command accepts only
`activate <full-sha>` or `rollback`; upload paths are derived from the validated
SHA rather than supplied by the caller.

After the NixOS switch, confirm the boundary without deploying:

```bash
id quortex-deploy
sudo -u quortex-deploy test -w /var/lib/quortex/incoming
sudo -u quortex-deploy test ! -w /var/lib/quortex/releases
sudo -l -U quortex-deploy
```

## Protected GitHub environment

Create an environment named `production` before merging the workflow. Restrict
deployment branches to `main`; add required reviewers if unattended deployment
is not yet desired. Add these environment secrets:

- `QUORTEX_DEPLOY_SSH_PRIVATE_KEY`: the private half of the dedicated key.
- `QUORTEX_DEPLOY_SSH_KNOWN_HOSTS`: a pinned `known_hosts` line for
  `matrix.morpheum.dev`, verified through an already trusted connection. Do not
  trust an unauthenticated `ssh-keyscan` result by itself.

The following environment variables are optional because their production
defaults are committed in the workflow:

- `QUORTEX_DEPLOY_HOST` defaults to `matrix.morpheum.dev`.
- `QUORTEX_DEPLOY_USER` defaults to `quortex-deploy`.
- `QUORTEX_PRODUCTION_URL` defaults to
  `https://quortex.morpheum.dev`.

The environment and secrets are repository settings, not files in this
repository. Keep the pull request in draft until the host boundary and protected
environment both exist; otherwise the first post-merge deployment will fail at
its explicit credential or host preflight.

## Deployment transaction

The `Deploy production` job runs only after the required `test` job succeeds on
a push to `main`:

1. Download `quortex-release-<sha>` from the same CI run.
2. Extract a local copy and verify its complete inventory and checksums.
3. Connect using the dedicated key and pinned host key.
4. Upload only `quortex-<sha>.tar.gz` to the incoming directory.
5. Ask the privileged release command to import, re-verify, and activate it.
6. Poll `/version.json`, `/version`, and `/health` for the expected SHA.
7. Establish a real Socket.IO WebSocket and require its `server_version` event
   to report the same SHA.

The GitHub environment records the deployment URL, commit, actor, and result.
Production deployments share a concurrency group: a running activation is not
cancelled, while GitHub replaces an older pending run with a newer one.

## Automatic rollback

If public smoke checks fail after a changed activation, the workflow calls
`quortex-release rollback` and checks the previous release publicly through the
same HTTP and Socket.IO paths. Activation itself also restores the old links if
the service restart fails.

The first deployment has no `previous` target and therefore cannot roll back
automatically. Treat host bootstrap and the first activation as an observed
rollout; automatic rollback applies after one known-good release exists.

An operator can inspect runtime identity at any time without secrets:

```bash
curl -fsS https://quortex.morpheum.dev/version.json
curl -fsS https://quortex.morpheum.dev/version
curl -fsS https://quortex.morpheum.dev/health
readlink /var/lib/quortex/current
readlink /var/lib/quortex/previous
```
