{ config, lib, pkgs, ... }:

let
  cfg = config.services.quortex;
  dataDirectory = "/var/lib/quortex/data";
  releaseRoot = "/var/lib/quortex";
  immutableCache = ''
    add_header Cache-Control "public, max-age=31536000, immutable" always;
  '';
  noStore = ''
    add_header Cache-Control "no-store" always;
  '';
  releaseManagerSource = pkgs.runCommand "quortex-release-manager-source" { } ''
    mkdir -p "$out"
    cp ${../../scripts/manage-release.mjs} "$out/manage-release.mjs"
    cp ${../../scripts/release-manifest.mjs} "$out/release-manifest.mjs"
  '';
  releaseManager = pkgs.writeShellApplication {
    name = "quortex-release";
    text = ''
      staging_args=()
      ${lib.optionalString cfg.deployment.enable ''
        deployment_uid="$(${pkgs.coreutils}/bin/id -u ${lib.escapeShellArg cfg.deployment.user})"
        staging_args=(
          --staging-root ${releaseRoot}/incoming
          --expected-archive-uid "$deployment_uid"
          --tar ${pkgs.gnutar}/bin/tar
        )
      ''}
      exec ${lib.getExe' cfg.nodePackage "node"} \
        ${releaseManagerSource}/manage-release.mjs \
        "$@" \
        --release-root ${releaseRoot} \
        --service quortex.service \
        --systemctl ${pkgs.systemd}/bin/systemctl \
        --expected-uid 0 \
        --node-major ${lib.versions.major cfg.nodePackage.version} \
        "''${staging_args[@]}"
    '';
  };
  environmentCheck = pkgs.writeShellScript "quortex-check-environment" ''
    set -eu

    environment_file=${lib.escapeShellArg cfg.environmentFile}
    release_directory=${lib.escapeShellArg cfg.releaseDirectory}

    if [ ! -f "$environment_file" ]; then
      echo "Quortex environment file is missing: $environment_file" >&2
      exit 1
    fi

    owner="$(${pkgs.coreutils}/bin/stat -c '%U:%G' "$environment_file")"
    mode="$(${pkgs.coreutils}/bin/stat -c '%a' "$environment_file")"
    if [ "$owner" != "root:root" ]; then
      echo "Quortex environment file must be owned by root:root, not $owner" >&2
      exit 1
    fi
    if [ "$mode" != "400" ] && [ "$mode" != "600" ]; then
      echo "Quortex environment file must have mode 0400 or 0600, not $mode" >&2
      exit 1
    fi
    if ! ${pkgs.gnugrep}/bin/grep -Eq '^JWT_SECRET=.+$' "$environment_file"; then
      echo "Quortex environment file must define a non-empty JWT_SECRET" >&2
      exit 1
    fi
    if [ ! -f "$release_directory/server/dist/index.js" ]; then
      echo "Quortex server entry point is missing from $release_directory" >&2
      exit 1
    fi
  '';
in
{
  options.services.quortex = {
    enable = lib.mkEnableOption "the Quortex multiplayer backend";

    releaseDirectory = lib.mkOption {
      type = lib.types.str;
      default = "/var/lib/quortex/current";
      description = ''
        Active immutable Quortex release. The directory must contain
        server/dist/index.js and the server's production dependencies.
      '';
    };

    environmentFile = lib.mkOption {
      type = lib.types.str;
      default = "/etc/quortex/environment";
      description = ''
        Root-owned environment file containing JWT_SECRET and any configured
        OAuth credentials. It must have mode 0400 or 0600 and must not be
        stored in a release or repository checkout.
      '';
    };

    publicOrigin = lib.mkOption {
      type = lib.types.str;
      default = "https://quortex.morpheum.dev";
      description = "Public origin used for OAuth callbacks and browser CORS.";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 3001;
      description = "Loopback TCP port used by the Quortex backend.";
    };

    nodePackage = lib.mkOption {
      type = lib.types.package;
      default = pkgs.nodejs_22;
      defaultText = lib.literalExpression "pkgs.nodejs_22";
      description = "Pinned Node.js runtime used to start the backend.";
    };

    deployment.enable = lib.mkOption {
      type = lib.types.bool;
      default = true;
      description = "Whether to create the restricted automatic-deployment account.";
    };

    deployment.user = lib.mkOption {
      type = lib.types.str;
      default = "quortex-deploy";
      description = "Unprivileged SSH account that may upload and activate releases.";
    };

    deployment.authorizedKeys = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
      description = ''
        SSH public keys accepted for the deployment account. Keep the private
        key only in the protected GitHub production environment.
      '';
    };

    nginx.enable = lib.mkOption {
      type = lib.types.bool;
      default = true;
      description = "Whether to declare the canonical Quortex Nginx virtual host.";
    };

    nginx.hostName = lib.mkOption {
      type = lib.types.str;
      default = "quortex.morpheum.dev";
      description = "Canonical production hostname served by Nginx.";
    };

    nginx.enableACME = lib.mkOption {
      type = lib.types.bool;
      default = true;
      description = "Whether Nginx should obtain an ACME certificate for the host.";
    };

    nginx.forceSSL = lib.mkOption {
      type = lib.types.bool;
      default = true;
      description = "Whether Nginx should redirect plaintext requests to HTTPS.";
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = [
      {
        assertion = lib.hasPrefix "/" cfg.releaseDirectory;
        message = "services.quortex.releaseDirectory must be an absolute path";
      }
      {
        assertion = lib.hasPrefix "/" cfg.environmentFile;
        message = "services.quortex.environmentFile must be an absolute path";
      }
      {
        assertion = !(lib.hasPrefix "${cfg.releaseDirectory}/" cfg.environmentFile);
        message = "services.quortex.environmentFile must be outside the active release";
      }
      {
        assertion = lib.hasPrefix "https://" cfg.publicOrigin;
        message = "services.quortex.publicOrigin must use HTTPS";
      }
      {
        assertion = !cfg.nginx.enable || cfg.nginx.hostName != "";
        message = "services.quortex.nginx.hostName must not be empty";
      }
      {
        assertion = !cfg.deployment.enable || builtins.match "[a-z_][a-z0-9_-]*" cfg.deployment.user != null;
        message = "services.quortex.deployment.user must be a valid system user name";
      }
      {
        assertion = !cfg.deployment.enable || !builtins.elem cfg.deployment.user [ "root" "quortex" ];
        message = "services.quortex.deployment.user must be separate from root and quortex";
      }
    ];

    environment.systemPackages = [ releaseManager ];

    users.groups.quortex = { };
    users.users.quortex = {
      isSystemUser = true;
      group = "quortex";
      home = "/var/lib/quortex";
      createHome = false;
      description = "Quortex multiplayer backend";
    };

    users.groups.${cfg.deployment.user} = lib.mkIf cfg.deployment.enable { };
    users.users.${cfg.deployment.user} = lib.mkIf cfg.deployment.enable {
      isSystemUser = true;
      group = cfg.deployment.user;
      home = "${releaseRoot}/incoming";
      createHome = false;
      shell = pkgs.bashInteractive;
      description = "Restricted Quortex release deployment";
      openssh.authorizedKeys.keys = cfg.deployment.authorizedKeys;
    };

    systemd.tmpfiles.rules = [
      "d /etc/quortex 0700 root root -"
      "d /var/lib/quortex 0755 root root -"
      "d /var/lib/quortex/releases 0755 root root -"
      "d ${dataDirectory} 0750 quortex quortex -"
    ] ++ lib.optionals cfg.deployment.enable [
      "d ${releaseRoot}/incoming 0750 ${cfg.deployment.user} ${cfg.deployment.user} -"
    ];

    security.sudo.extraRules = lib.optionals cfg.deployment.enable [
      {
        users = [ cfg.deployment.user ];
        commands = [
          {
            command = "/run/current-system/sw/bin/quortex-release";
            options = [ "NOPASSWD" ];
          }
        ];
      }
    ];

    systemd.services.quortex = {
      description = "Quortex multiplayer backend";
      wantedBy = [ "multi-user.target" ];
      wants = [ "network-online.target" ];
      after = [ "network-online.target" ];

      environment = {
        NODE_ENV = "production";
        HOST = "127.0.0.1";
        PORT = toString cfg.port;
        DATA_DIR = dataDirectory;
        BASE_URL = cfg.publicOrigin;
        CLIENT_URL = cfg.publicOrigin;
      };

      serviceConfig = {
        Type = "simple";
        User = "quortex";
        Group = "quortex";
        WorkingDirectory = "${cfg.releaseDirectory}/server";
        EnvironmentFile = cfg.environmentFile;
        ExecStartPre = "+${environmentCheck}";
        ExecStart = "${lib.getExe' cfg.nodePackage "node"} ${cfg.releaseDirectory}/server/dist/index.js";

        Restart = "on-failure";
        RestartSec = "5s";
        TimeoutStopSec = "30s";
        UMask = "0027";

        CapabilityBoundingSet = "";
        LockPersonality = true;
        NoNewPrivileges = true;
        PrivateDevices = true;
        PrivateTmp = true;
        ProtectClock = true;
        ProtectControlGroups = true;
        ProtectHome = true;
        ProtectHostname = true;
        ProtectKernelLogs = true;
        ProtectKernelModules = true;
        ProtectKernelTunables = true;
        ProtectSystem = "strict";
        ReadWritePaths = [ dataDirectory ];
        RemoveIPC = true;
        RestrictAddressFamilies = [ "AF_UNIX" "AF_INET" "AF_INET6" ];
        RestrictNamespaces = true;
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
        SystemCallArchitectures = "native";
      };
    };

    services.nginx = lib.mkIf cfg.nginx.enable {
      enable = true;
      recommendedProxySettings = true;
      recommendedTlsSettings = true;

      virtualHosts.${cfg.nginx.hostName} = {
        root = "${cfg.releaseDirectory}/frontend";
        enableACME = cfg.nginx.enableACME;
        forceSSL = cfg.nginx.forceSSL;

        locations = {
          "= /" = {
            tryFiles = "/index.html =404";
            extraConfig = noStore;
          };
          "= /index.html" = {
            tryFiles = "/index.html =404";
            extraConfig = noStore;
          };
          "= /tabletop.html" = {
            tryFiles = "/tabletop.html =404";
            extraConfig = noStore;
          };
          "= /version.json" = {
            tryFiles = "/version.json =404";
            extraConfig = noStore;
          };
          "/assets/" = {
            tryFiles = "$uri =404";
            extraConfig = immutableCache;
          };

          "= /quortextt".return = "308 /";
          "= /quortextt/version.json" = {
            alias = "${cfg.releaseDirectory}/frontend/version.json";
            extraConfig = noStore;
          };
          "^~ /quortextt/assets/" = {
            alias = "${cfg.releaseDirectory}/frontend/assets/";
            extraConfig = immutableCache;
          };
          "~ ^/quortextt/(.*)$".return = "308 /$1";

          "= /health".proxyPass = "http://127.0.0.1:${toString cfg.port}";
          "= /version".proxyPass = "http://127.0.0.1:${toString cfg.port}";
          "/api/".proxyPass = "http://127.0.0.1:${toString cfg.port}";
          "/auth/".proxyPass = "http://127.0.0.1:${toString cfg.port}";
          "/socket.io/" = {
            proxyPass = "http://127.0.0.1:${toString cfg.port}";
            proxyWebsockets = true;
          };

          "/" = {
            tryFiles = "$uri $uri/ /index.html";
            extraConfig = noStore;
          };
        };
      };
    };
  };
}
