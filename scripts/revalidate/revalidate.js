#!/usr/bin/env node
// Triggers a full revalidation of the client website, the same as the web
// app's top-bar "Publish to website" button (POST /api/revalidate-all). The
// CMS calls the site's revalidate URL with the secret from Settings → Deploy;
// the result shows up in the audit log as action=revalidate,
// resource=client_deploy (see ../logs/audit.js).
//
// Usage: node revalidate.js [branch]
//
// Publishing an entry does not update an ISR site by itself: publish first,
// then revalidate. Check `status.js` to see whether the site is behind.
const { adminRequest } = require('../lib');

(async () => {
	const branch = process.argv[2];
	const before = await adminRequest('/api/publish-status', { branch }).catch(() => null);
	console.log(`Before: dirty=${before?.dirty ?? '?'} lastPublishedAt=${before?.lastPublishedAt ?? '?'}`);

	const startedAt = Date.now();
	const res = await adminRequest('/api/revalidate-all', { method: 'POST', body: {}, branch });
	if (res !== undefined && res !== null && res !== '') console.log('Response:', typeof res === 'string' ? res : JSON.stringify(res));

	const after = await adminRequest('/api/publish-status', { branch }).catch(() => null);
	console.log(`After:  dirty=${after?.dirty ?? '?'} lastPublishedAt=${after?.lastPublishedAt ?? '?'}`);

	// Latest client_deploy audit log carries the site's HTTP status for this call.
	const logs = await adminRequest('/api/audit-logs?page=1&limit=1&resource=client_deploy').catch(() => null);
	const last = logs?.logs?.[0];
	// Older entries belong to earlier runs; skip them rather than report a stale result.
	if (last?.after && last?.ts && new Date(last.ts).getTime() >= startedAt - 5000) {
		console.log(`Site responded: ${last.after?.statusCode ?? '?'} in ${last.after?.durationMs ?? '?'}ms (${last.after?.targetURL ?? ''}) at ${last?.ts ?? '?'}`);
	}
})().catch((e) => { console.error(e.message); process.exit(1); });
