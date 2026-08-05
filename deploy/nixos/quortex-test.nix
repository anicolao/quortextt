let
  pkgs = import <nixpkgs> { system = "x86_64-linux"; };
  evaluated = import "${pkgs.path}/nixos/lib/eval-config.nix" {
    system = "x86_64-linux";
    modules = [
      ./quortex.nix
      {
        services.quortex.enable = true;
        services.quortex.deployment.authorizedKeys = [ "ssh-ed25519 test-key quortex-deploy" ];
        system.stateVersion = "25.05";
      }
    ];
  };
  config = evaluated.config;
  service = config.systemd.services.quortex;
  virtualHost = config.services.nginx.virtualHosts."quortex.morpheum.dev";
in
assert config.users.users.quortex.isSystemUser;
assert config.users.users.quortex.group == "quortex";
assert config.users.users.quortex-deploy.isSystemUser;
assert config.users.users.quortex-deploy.home == "/var/lib/quortex/incoming";
assert config.users.users.quortex-deploy.openssh.authorizedKeys.keys == [ "ssh-ed25519 test-key quortex-deploy" ];
assert builtins.any
  (rule:
    builtins.elem "quortex-deploy" rule.users
    && builtins.length rule.commands == 1
    && (builtins.head rule.commands).command == "/run/current-system/sw/bin/quortex-release"
    && builtins.elem "NOPASSWD" (builtins.head rule.commands).options)
  config.security.sudo.extraRules;
assert service.environment.DATA_DIR == "/var/lib/quortex/data";
assert service.environment.HOST == "127.0.0.1";
assert service.environment.PORT == "3001";
assert service.serviceConfig.User == "quortex";
assert service.serviceConfig.Group == "quortex";
assert service.serviceConfig.EnvironmentFile == "/etc/quortex/environment";
assert service.serviceConfig.WorkingDirectory == "/var/lib/quortex/current/server";
assert service.serviceConfig.ProtectSystem == "strict";
assert service.serviceConfig.ReadWritePaths == [ "/var/lib/quortex/data" ];
assert virtualHost.root == "/var/lib/quortex/current/frontend";
assert virtualHost.locations."= /health".proxyPass == "http://127.0.0.1:3001";
assert virtualHost.locations."/socket.io/".proxyWebsockets;
assert virtualHost.locations."^~ /quortextt/assets/".alias == "/var/lib/quortex/current/frontend/assets/";
{
  service = "quortex.service";
  user = service.serviceConfig.User;
  deploymentUser = config.users.users.quortex-deploy.name;
  dataDirectory = service.environment.DATA_DIR;
  environmentFile = service.serviceConfig.EnvironmentFile;
  workingDirectory = service.serviceConfig.WorkingDirectory;
}
