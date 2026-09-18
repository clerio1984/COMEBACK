import fs from 'node:fs';
import { execSync } from 'node:child_process';

const checks = [
  ['package.json', fs.existsSync('package.json')],
  ['index.html', fs.existsSync('index.html')],
  ['App.tsx', fs.existsSync('App.tsx')],
  ['services/firebase.ts', fs.existsSync('services/firebase.ts')],
  ['firestore.rules', fs.existsSync('firestore.rules')],
];

const forbidden = [
  ['hardcoded admin password', /FireW@ll321/i],
  ['old VAPID private key fallback', /VAPID_PRIVATE_KEY\s*\|\|/],
  ['public Firestore allow-all rule', /allow\s+read,\s*write:\s*if\s+true\s*;/],
  ['anonymous report identity', /reporterId:\s*currentUser\?\.id\s*\|\|\s*['"]anonymous['"]/],
  ['admin localStorage mode', /comeback_isAdminMode/],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed = true;
}

for (const [name, pattern] of forbidden) {
  const files = ['AuthContext.tsx','server.ts','firestore.rules'].filter(fs.existsSync);
  const hit = files.some(file => pattern.test(fs.readFileSync(file,'utf8')));
  console.log(`${hit ? 'FAIL' : 'PASS'} ${name}`);
  if (hit) failed = true;
}

try {
  execSync('npm run lint', { stdio: 'inherit' });
  console.log('PASS TypeScript');
} catch {
  console.error('FAIL TypeScript');
  failed = true;
}

process.exitCode = failed ? 1 : 0;
