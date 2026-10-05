import {readFileSync, writeFileSync} from 'node:fs';
// Resource IDs are configuration, never credentials. Build environments can
// supply these until the real database ID is committed after provisioning.
const path = new URL('../wrangler.json', import.meta.url);
const config = JSON.parse(readFileSync(path, 'utf8'));
const id = process.env.STRIDE_D1_DATABASE_ID || config.d1_databases[0].database_id;
if (!/^[a-f0-9-]{36}$/i.test(id) || id === '00000000-0000-4000-8000-000000000000') throw Error('Set STRIDE_D1_DATABASE_ID to the Cloudflare D1 database ID before deploying.');
config.d1_databases[0].database_id = id;
if (process.env.STRIDE_WORKER_NAME) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(process.env.STRIDE_WORKER_NAME)) throw Error('Invalid Worker name.');
  config.name = process.env.STRIDE_WORKER_NAME;
}
writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
console.log('Cloudflare Worker and database configuration ready.');
