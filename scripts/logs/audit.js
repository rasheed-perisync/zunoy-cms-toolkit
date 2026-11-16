#!/usr/bin/env node
// Read the CMS audit log (who created/updated/published/deleted what), the
// same feed as the web app's Logs → Audit tab (GET /api/audit-logs).
//
// Usage: node audit.js [options]
//   --action=<a>        create | update | delete | bulk_delete | publish | unpublish | revalidate
//   --resource=<r>      entry | content_type | page | media | api_key | webhook | client_deploy
//   --search=<text>     server-side search (same as the web app's search box)
//   --id=<resourceId>   only logs for one record (filtered client-side)
//   --type=<apiId>      only entry logs of one content type, e.g. card (client-side)
//   --actor=<text>      only logs whose actor name/email contains <text> (client-side)
//   --since=<date>      stop at logs older than this (ISO date/time, e.g. 2026-11-16)
//   --limit=<n>         logs per page request (default 50)
//   --pages=<n>         how many pages to walk (default 1; --since keeps walking until it is reached)
//   --full              print the full before/after JSON for each log
//   --json              print the matching logs as a JSON array instead
//
// Log shape: { action, resource, resourceId, resourceName, actor, actorInfo,
// ip, userAgent, before, after, ts }. `before` is often null for entry
// updates; `after` holds the saved record including its `status`, so an
// `update` whose after.status is "draft" means the edit isn't live yet.
const { adminRequest } = require('../lib');

function parseArgs(argv) {
	const opts = {};
	for (const arg of argv) {
		const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
		if (!m) throw new Error(`Unknown argument: ${arg}`);
		opts[m[1]] = m[2] ?? true;
	}
	return opts;
}

function summarize(log) {
	const after = log?.after && typeof log.after === 'object' ? log.after : null;
	const before = log?.before && typeof log.before === 'object' ? log.before : null;
	const rec = after || before || {};
	const actor = log?.actorInfo?.name || log?.actor || '?';
	const parts = [
		log?.ts || '',
		(log?.action || '').padEnd(10),
		(log?.resource || '').padEnd(13),
		log?.resourceId || '-',
	];
	const type = rec?.contentTypeApiId || rec?.apiId;
	if (type) parts.push(`type=${type}`);
	const resourceName = log?.resourceName !== log?.resourceId ? log?.resourceName : '';
	const name = resourceName || rec?.data?.title || rec?.data?.name || rec?.data?.internalName || rec?.title || rec?.name;
	if (name) parts.push(`"${String(name).slice(0, 60)}"`);
	if (rec?.data?.page) parts.push(`page=${rec.data.page}`);
	if (rec?.status) parts.push(`status=${rec.status}`);
	if (log?.resource === 'client_deploy' && after) parts.push(`${after?.event || ''} → ${after?.statusCode ?? '?'}`);
	parts.push(`by ${actor}`);
	return parts.join('  ');
}

(async () => {
	const opts = parseArgs(process.argv.slice(2));
	const limit = Number(opts.limit) || 50;
	const since = opts.since ? new Date(opts.since) : null;
	if (since && Number.isNaN(since.getTime())) throw new Error(`Bad --since date: ${opts.since}`);
	const maxPages = Number(opts.pages) || (since ? Infinity : 1);

	const matches = (log) => {
		const rec = log?.after || log?.before || {};
		if (opts.id && log?.resourceId !== opts.id) return false;
		if (opts.type && rec?.contentTypeApiId !== opts.type) return false;
		if (opts.actor) {
			const hay = `${log?.actor || ''} ${log?.actorInfo?.name || ''} ${log?.actorInfo?.email || ''}`.toLowerCase();
			if (!hay.includes(String(opts.actor).toLowerCase())) return false;
		}
		return true;
	};

	const out = [];
	let reachedSince = false;
	for (let page = 1; page <= maxPages && !reachedSince; page++) {
		const params = new URLSearchParams({ page: String(page), limit: String(limit) });
		for (const key of ['action', 'resource', 'search']) {
			if (typeof opts[key] === 'string') params.set(key, opts[key]);
		}
		const res = await adminRequest(`/api/audit-logs?${params}`);
		const logs = Array.isArray(res?.logs) ? res.logs : [];
		for (const log of logs) {
			if (since && log?.ts && new Date(log.ts) < since) { reachedSince = true; break; }
			if (matches(log)) out.push(log);
		}
		if (page >= (res?.pages ?? 1) || logs.length === 0) break;
	}

	if (opts.json) {
		console.log(JSON.stringify(out, null, 2));
		return;
	}
	for (const log of out) {
		console.log(summarize(log));
		if (opts.full) {
			if (log?.before != null) console.log(`  before: ${JSON.stringify(log.before, null, 2).replace(/\n/g, '\n  ')}`);
			if (log?.after != null) console.log(`  after:  ${JSON.stringify(log.after, null, 2).replace(/\n/g, '\n  ')}`);
		}
	}
	console.log(`\n${out.length} log(s)`);
})().catch((e) => { console.error(e.message); process.exit(1); });
