/// <reference types="vite/client" />

declare const chrome: {
  runtime: {
    getURL: (path: string) => string;
  };
};
