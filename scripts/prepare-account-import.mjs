import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier, context, next) {try {return next(specifier, context);} catch(error) {if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context); throw error;}}});
const {stateSchema} = await import('../lib/data.ts');
const file = process.argv[2];
if (!file) throw Error('Pass the original Stride full-backup JSON file.');
const raw = readFileSync(file, 'utf8');
if (Buffer.byteLength(raw) > 3000000) throw Error('Backup exceeds 3 MB.');
const original = JSON.parse(raw);
stateSchema.parse(original);
// Preserve optional fields verbatim. Never overwrite an existing account;
// use the in-app restore review if the destination was used before migration.
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const sql = `INSERT OR IGNORE INTO athlete_state (user_id,data,version,updated_at) VALUES ('felixdasumo',${quote(raw)},1,${quote(new Date().toISOString())});\nSELECT changes() AS imported, json_array_length(data, '$.workouts') AS workouts FROM athlete_state WHERE user_id='felixdasumo';\n`;
mkdirSync(new URL('../.private/', import.meta.url), {recursive: true, mode: 0o700});
writeFileSync(new URL('../.private/original-state.sql', import.meta.url), sql, {mode: 0o600});
console.log(`Prepared ${original.workouts.length} workouts for the fixed account. Nothing was uploaded. Existing records will not be overwritten.`);
