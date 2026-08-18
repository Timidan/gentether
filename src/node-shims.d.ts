declare module "node:crypto" {
  export function createHash(algorithm: string): {
    update(value: string): { digest(encoding: "hex"): string };
  };
}

declare module "node:fs/promises" {
  const value: any;
  export default value;
}

declare module "node:fs" {
  export function createReadStream(path: string): any;
}

declare module "node:path" {
  const value: any;
  export default value;
}

declare module "node:url" {
  export function fileURLToPath(value: string | URL): string;
}

declare module "node:http" {
  export function createServer(handler: (request: any, response: any) => void | Promise<void>): any;
}

declare module "node:test" {
  export default function test(name: string, implementation: () => unknown | Promise<unknown>): void;
  export function describe(name: string, implementation: () => void): void;
  export function it(name: string, implementation: () => unknown | Promise<unknown>): void;
}

declare module "node:assert/strict" {
  const assert: any;
  export default assert;
}

declare module "node:child_process" {
  export function spawnSync(command: string, arguments_: string[], options?: Record<string, unknown>): any;
}

declare const process: {
  env: NodeJS.ProcessEnv;
  argv: string[];
  cwd(): string;
  exitCode?: number;
  stdin: any;
  stdout: any;
  stderr: any;
  on(event: string, listener: (...arguments_: any[]) => void): void;
};

declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
}


declare const Buffer: {
  byteLength(value: string): number;
};
