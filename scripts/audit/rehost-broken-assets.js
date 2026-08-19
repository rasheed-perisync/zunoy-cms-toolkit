#!/usr/bin/env node
// Usage:
//   node rehost-broken-assets.js --old-host=old.example.com --fallback-host=https://backup.example.com [options]
//
// Finds URLs pointing at a dead/broken host baked into CMS entries (anywhere
// in the entry's data, not just known image fields), re-fetches the same
// asset from a fallback host, re-uploads it to the CMS media library, and
// rewrites every occurrence to the new CDN URL. Generalized from a real
// incident where a project's own marketing domain went down while still
// being referenced as an image host inside old CMS entries.
//
// Required:
//   --old-host=<host>        e.g. old-site.com (matched as https?://(www.)?<host>/...)
//   --fallback-host=<url>    e.g. https://backup-host.example.com — old-host's
//                            path is appended to this to build the fetch URL
// Optional filters:
//   --page=<slug substring>  only entries whose data.page includes this
//   --component=<apiId>      only this content type's apiId
//   --limit=<n>               stop after fixing n entries (for running in batches)
//   --apply                   actually upload + PUT updates (default: dry run, no writes)
const { requireEnv, adminRequest } = require('../lib');

const EXT_MIME = {
	svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
	webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
};

function parseArgs() {
	const args = { apply: false };
	for (const arg of process.argv.slice(2)) {
		if (arg === '--apply') args.apply = true;
		else if (arg.startsWith('--old-host=')) args.oldHost = arg.slice('--old-host='.length);
		else if (arg.startsWith('--fallback-host=')) args.fallbackHost = arg.slice('--fallback-host='.length);
		else if (arg.startsWith('--page=')) args.page = arg.slice('--page='.length);
		else if (arg.startsWith('--component=')) args.component = arg.slice('--component='.length);
		else if (arg.startsWith('--limit=')) args.limit = parseInt(arg.slice('--limit='.length), 10);
	}
	return args;
}

function* walkStrings(value, path = []) {
	if (typeof value === 'string') {
		yield { path, value };
	} else if (Array.isArray(value)) {
		for (let i = 0; i < value.length; i++) yield* walkStrings(value[i], [...path, i]);
	} else if (value && typeof value === 'object') {
		for (const key of Object.keys(value)) yield* walkStrings(value[key], [...path, key]);
	}
}

function setAt(root, path, newValue) {
	let node = root;
	for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
	node[path[path.length - 1]] = newValue;
}

async function uploadFromUrl(sourceUrl, filename, contentType) {
	const { BASE_URL, API_KEY } = requireEnv();
	const res = await fetch(sourceUrl);
	if (!res.ok) throw new Error(`Failed to download ${sourceUrl}: ${res.status}`);
	const arrayBuffer = await res.arrayBuffer();
	const form = new FormData();
	form.append('file', new Blob([arrayBuffer], { type: contentType }), filename);
	const uploadRes = await fetch(`${BASE_URL}/api/media/upload`, {
		method: 'POST',
		headers: { 'X-API-Key': API_KEY },
		body: form,
	});
	const uploadData = await uploadRes.json();
	if (!uploadData.url) throw new Error(`Upload failed for ${filename}: ${JSON.stringify(uploadData)}`);
	return uploadData.url;
}

(async () => {
	const args = parseArgs();
	if (!args.oldHost || !args.fallbackHost) {
		throw new Error('Usage: node rehost-broken-assets.js --old-host=<host> --fallback-host=<url> [--page=] [--component=] [--limit=] [--apply]');
	}
	const oldHostRe = new RegExp(`^https?://(www\\.)?${args.oldHost.replace(/\./g, '\\.')}(?=/)`, 'i');
	const imageUrlRe = new RegExp(`^https?://(www\\.)?${args.oldHost.replace(/\./g, '\\.')}/[^\\s"']*\\.(svg|png|jpe?g|webp|gif|avif)(\\?[^\\s"']*)?$`, 'i');

	console.log(`Mode: ${args.apply ? 'APPLY (writing changes)' : 'DRY RUN (no writes)'}`);
	if (args.page) console.log(`Filter page contains: "${args.page}"`);
	if (args.component) console.log(`Filter component apiId: "${args.component}"`);

	const contentTypes = await adminRequest('/api/content-types');
	const typesToScan = args.component ? contentTypes.filter((ct) => ct.apiId === args.component) : contentTypes;

	let totalFound = 0, totalFixed = 0, entriesFixed = 0;

	outer:
	for (const ct of typesToScan) {
		const entries = await adminRequest(`/api/content-types/${ct.id}/entries`);
		if (!Array.isArray(entries) || entries.length === 0) continue;

		for (const entry of entries) {
			if (args.limit && args.apply && entriesFixed >= args.limit) {
				console.log(`\nReached --limit=${args.limit} entries fixed, stopping this batch.`);
				break outer;
			}
			if (args.page && !(entry.data && entry.data.page && entry.data.page.includes(args.page))) continue;

			const matches = [...walkStrings(entry.data)].filter((s) => imageUrlRe.test(s.value));
			if (matches.length === 0) continue;

			console.log(`\n[${ct.apiId}] entry ${entry.id} (page: ${entry.data?.page || 'n/a'}) — ${matches.length} broken asset(s)`);
			let entryChanged = false;

			for (const match of matches) {
				totalFound++;
				const oldUrl = match.value;
				const pathAfterHost = oldUrl.replace(oldHostRe, '');
				const fetchUrl = `${args.fallbackHost}${pathAfterHost}`;
				const filename = decodeURIComponent(pathAfterHost.split('/').pop().split('?')[0]);
				const ext = filename.split('.').pop().toLowerCase();
				const contentType = EXT_MIME[ext] || 'application/octet-stream';

				console.log(`  field: ${match.path.join('.')}`);
				console.log(`    old: ${oldUrl}`);
				console.log(`    fetching from: ${fetchUrl}`);

				if (!args.apply) {
					console.log('    (dry run — would upload and replace)');
					continue;
				}
				try {
					const newUrl = await uploadFromUrl(fetchUrl, filename, contentType);
					console.log(`    new: ${newUrl}`);
					setAt(entry.data, match.path, newUrl);
					totalFixed++;
					entryChanged = true;
				} catch (err) {
					console.error(`    FAILED: ${err.message}`);
				}
			}

			if (args.apply && entryChanged) {
				const fullEntry = await adminRequest(`/api/entries/${entry.id}`);
				fullEntry.data = entry.data;
				await adminRequest(`/api/entries/${entry.id}`, { method: 'PUT', body: fullEntry });
				console.log(`  updated entry ${entry.id}`);
				entriesFixed++;
			}
		}
	}

	console.log(`\nDone. Found ${totalFound} broken asset URL(s), fixed ${totalFixed}.`);
})().catch((e) => { console.error(e.message); process.exit(1); });
