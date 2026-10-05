import {readFileSync} from 'node:fs';
const source = JSON.parse(readFileSync(new URL('../wrangler.json', import.meta.url), 'utf8'));
const built = JSON.parse(readFileSync(new URL('../dist/server/wrangler.json', import.meta.url), 'utf8'));
if (built.name !== source.name || built.d1_databases?.find(d => d.binding === 'DB')?.database_id !== source.d1_databases[0].database_id) {
  throw Error('Worker name or D1 binding changed after the build. Run npm run build:cloudflare again before deploying.');
}
console.log('Built Worker matches the selected Cloudflare configuration.');
