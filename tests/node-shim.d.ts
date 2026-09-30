// Il minimo di Node usato dai test di export (evita di aggiungere @types/node).
declare const process: { env: Record<string, string | undefined> };
declare module 'node:fs' {
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void;
  export function writeFileSync(path: string, data: Uint8Array): void;
}
