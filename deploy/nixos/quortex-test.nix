let
  pkgs = import <nixpkgs> { system = "x86_64-linux"; };
  evaluated = import "${pkgs.path}/nixos/lib/eval-config.nix" {
    system = "x86_64-linux";
    modules = [
      ./quortex.nix
      {
        services.quortex.enable = true;
        system.stateVersion = "25.05";
      }
    ];
  };
  config = evaluated.config;
  service = config.systemd.services.quortex;
in
assert config.users.users.quortex.isSystemUser;
assert config.users.users.quortex.group == "quortex";
assert service.environment.DATA_DIR == "/var/lib/quortex/data";
assert service.environment.HOST == "127.0.0.1";
assert service.environment.PORT == "3001";
assert service.serviceConfig.User == "quortex";
assert service.serviceConfig.Group == "quortex";
assert service.serviceConfig.EnvironmentFile == "/etc/quortex/environment";
assert service.serviceConfig.WorkingDirectory == "/var/lib/quortex/current/server";
assert service.serviceConfig.ProtectSystem == "strict";
assert service.serviceConfig.ReadWritePaths == [ "/var/lib/quortex/data" ];
{
  service = "quortex.service";
  user = service.serviceConfig.User;
  dataDirectory = service.environment.DATA_DIR;
  environmentFile = service.serviceConfig.EnvironmentFile;
  workingDirectory = service.serviceConfig.WorkingDirectory;
}
