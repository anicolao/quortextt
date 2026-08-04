{ config, lib, pkgs, ... }:

let
  cfg = config.services.quortex;
  dataDirectory = "/var/lib/quortex/data";
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
    ];

    users.groups.quortex = { };
    users.users.quortex = {
      isSystemUser = true;
      group = "quortex";
      home = "/var/lib/quortex";
      createHome = false;
      description = "Quortex multiplayer backend";
    };

    systemd.tmpfiles.rules = [
      "d /etc/quortex 0700 root root -"
      "d /var/lib/quortex 0755 root root -"
      "d /var/lib/quortex/releases 0755 root root -"
      "d ${dataDirectory} 0750 quortex quortex -"
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
  };
}
