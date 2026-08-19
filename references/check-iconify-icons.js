#!/usr/bin/env node
// Reference script — support tool for generate-icon-asset.js's icon-tile
// pipeline (see that file's header for why it's a reference, not a default
// workflow). Doesn't touch the CMS at all, only Iconify's public API — kept
// here rather than in scripts/ because it's only useful alongside that pipeline.
//
// Usage: node check-iconify-icons.js <iconify-id> [<iconify-id> ...]
//
// Verifies each "<prefix>:<name>" id actually resolves on Iconify BEFORE you
// spend a batch of generate-icon-asset.js calls on them -- guessed icon
// names/prefixes are wrong often enough that this is worth doing up front for
// any set of 2+ icons. Groups ids by prefix and uses Iconify's bulk lookup
// endpoint (one request per prefix, not one per icon).
//
// Exits non-zero if anything is missing.

function groupByPrefix(ids) {
	const byPrefix = new Map();
	for (const id of ids) {
		const [prefix, name] = id.split(':');
		if (!prefix || !name) throw new Error(`iconify-id must be "<prefix>:<name>", got "${id}"`);
		if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
		byPrefix.get(prefix).push(name);
	}
	return byPrefix;
}

(async () => {
	const ids = process.argv.slice(2);
	if (ids.length === 0) {
		throw new Error('Usage: node check-iconify-icons.js <iconify-id> [<iconify-id> ...]  e.g. mdi:lock lucide:users heroicons:document-text');
	}

	const byPrefix = groupByPrefix(ids);
	const found = [];
	const missing = [];

	for (const [prefix, names] of byPrefix) {
		const url = `https://api.iconify.design/${prefix}.json?icons=${names.join(',')}`;
		const res = await fetch(url);
		if (!res.ok) {
			names.forEach((name) => missing.push(`${prefix}:${name}`));
			continue;
		}
		const data = await res.json();
		const resolvedNames = new Set(Object.keys(data.icons || {}));
		const notFoundNames = new Set(data.not_found || []);
		for (const name of names) {
			if (resolvedNames.has(name) && !notFoundNames.has(name)) found.push(`${prefix}:${name}`);
			else missing.push(`${prefix}:${name}`);
		}
	}

	console.log(`Found (${found.length}/${ids.length}):`);
	found.forEach((id) => console.log(`  OK      ${id}`));
	if (missing.length > 0) {
		console.log(`Missing (${missing.length}/${ids.length}):`);
		missing.forEach((id) => console.log(`  MISSING ${id}`));
		console.log('\nBrowse alternatives at https://icon-sets.iconify.design/');
		process.exit(1);
	}
})().catch((e) => { console.error(e.message); process.exit(1); });
