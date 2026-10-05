import {pbkdf2Sync, randomBytes} from 'node:crypto';
import {mkdirSync, writeFileSync} from 'node:fs';
// Read from stdin so a password never appears in command-line arguments.
let input = '';
for await (const chunk of process.stdin) input += chunk;
const password = input.replace(/\r?\n$/, '');
if (!password || password.length > 256) throw Error('Provide the account password on stdin.');
const salt = randomBytes(16);
const hash = `pbkdf2-sha256$100000$${salt.toString('hex')}$${pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')}`;
mkdirSync(new URL('../.private/', import.meta.url), {recursive: true, mode: 0o700});
writeFileSync(new URL('../.private/auth-secrets.json', import.meta.url), JSON.stringify({STRIDE_PASSWORD_HASH: hash}), {mode: 0o600});
console.log('Saved the password hash to the ignored .private/auth-secrets.json file.');
