/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  // Define types for your REACT_APP_ variables here if you wish
  readonly REACT_APP_API_KEY: string;
  // ... more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}