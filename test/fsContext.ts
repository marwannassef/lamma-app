// Stand-in for Metro's require.context under Jest: lists and reads files from disk.
import fs from 'fs';
import path from 'path';

export function fsContext(dir: string, recursive: boolean, pattern: RegExp) {
  const root = path.join(__dirname, '..', dir);
  const walk = (rel: string): string[] =>
    fs.readdirSync(path.join(root, rel), { withFileTypes: true }).flatMap((e) => {
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) return recursive ? walk(child) : [];
      return [`./${child}`];
    });
  const keys = walk('').filter((k) => pattern.test(k));
  const ctx = (key: string): unknown => JSON.parse(fs.readFileSync(path.join(root, key), 'utf8'));
  ctx.keys = () => keys;
  return ctx;
}
