/// <reference types="vite/client" />

interface QuortexBuildMetadata {
  readonly component: 'frontend' | 'server';
  readonly gitSha: string;
  readonly buildTime: string;
  readonly buildId: string | null;
  readonly dirty: boolean;
}

declare const __QUORTEX_BUILD__: QuortexBuildMetadata & {
  readonly component: 'frontend';
};

interface Window {
  __QUORTEX_BUILD__: QuortexBuildMetadata & { readonly component: 'frontend' };
  __QUORTEX_SERVER_BUILD__?: QuortexBuildMetadata & { readonly component: 'server' };
}

interface ImportMetaEnv {
  readonly VITE_DISCORD_CLIENT_ID?: string;
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Declare image modules for TypeScript
declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}
