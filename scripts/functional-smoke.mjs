import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');

const files = {
  app: read('App.tsx'),
  auth: read('AuthContext.tsx'),
  server: read('server.ts'),
  rules: read('firestore.rules'),
  layout: read('components/Layout.tsx'),
  index: read('index.html'),
  chat: read('components/ChatView.tsx'),
  details: read('components/ItemDetails.tsx'),
};

const tests = [
  ['App: push payload carries itemId context', /data:\s*\{[\s\S]*?itemId:\s*fullNotif\.itemId\s*\|\|\s*undefined[\s\S]*?\}/.test(files.app)],
  ['App: cross-user notifications identify sender', /finalUserId !== currentUser\?\.id[\s\S]*?senderId:\s*currentUser\.id/.test(files.app)],
  ['App: contextual report requires authentication', /handleSendReport[\s\S]*?if\s*\(!currentUser\)/.test(files.app)],
  ['Chat: danger report requires authentication', /handleReportChatDanger[\s\S]*?if\s*\(!currentUser\)/.test(files.chat) && /reporterId:\s*currentUser\.id/.test(files.chat)],
  ['ItemDetails: report identity uses authenticated user', /handleSendReport[\s\S]*?if\s*\(!currentUser\)/.test(files.details) && /reporterId:\s*currentUser\.id/.test(files.details)],
  ['Auth: admin access is allowlisted and verified', /ADMIN_EMAILS[\s\S]*?user\.emailVerified[\s\S]*?ADMIN_EMAILS\.has/.test(files.auth)],
  ['Auth: legacy hardcoded admin password is absent', !/FireW@ll321/i.test(files.auth)],
  ['Server: push endpoint requires authentication, not admin role', (() => { const start = files.server.indexOf('/api/trigger-push'); const end = files.server.indexOf('/api/trigger-sms'); const s = files.server.slice(start, end); return s.includes('requireAuthenticatedUser') && !s.includes('requireAdmin'); })()],
  ['Server: SMS endpoint requires authentication, not admin role', (() => { const start = files.server.indexOf('/api/trigger-sms'); const end = files.server.indexOf('/api/test-sms-webhook', start); const route = files.server.slice(start, end > start ? end : start + 8000); return /const caller = await requireAuthenticatedUser\\(req, res\\)/.test(route) && !/const caller = await requireAdmin\\(req, res\\)/.test(route); })()],
  ['Server: VAPID private key comes from environment', /process\.env\.VAPID_PRIVATE_KEY/.test(files.server) && !/VAPID_PRIVATE_KEY\s*\|\|/.test(files.server)],
  ['Rules: no public allow-all write rule', !/allow\s+read,\s*write:\s*if\s+true\s*;/.test(files.rules)],
  ['Rules: cross-user notification requires sender identity', /request\.resource\.data\.senderId\s*==\s*request\.auth\.uid/.test(files.rules)],
  ['Layout: mobile controls expose ARIA labels', /aria-label=/.test(files.layout)],
  ['Index: mobile viewport is configured', /name=["']viewport["'][^>]*width=device-width/.test(files.index)],
];

let failed = false;
for (const [name, passed] of tests) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) failed = true;
}

console.log(`\nFunctional regression smoke: ${tests.length - tests.filter(([, ok]) => !ok).length}/${tests.length} checks passed.`);
process.exitCode = failed ? 1 : 0;
