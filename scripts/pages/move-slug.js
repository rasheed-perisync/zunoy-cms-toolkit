#!/usr/bin/env node
// Move one CMS page slug while safely repointing its section entries and CMS links.
//
// Usage:
//   node move-slug.js <old-slug> <new-slug> [--apply]
//
// Dry run is the default. `--apply` is required for writes and is blocked unless
// today's backup covers every entry that will be changed. Every entry update is a
// full PUT of a freshly fetched record; never send a field-only PUT to this CMS.
const fs = require('fs');
const path = require('path');
const { adminRequest } = require('../lib');

function usage() {
	throw new Error('Usage: node move-slug.js <old-slug> <new-slug> [--apply]');
}

function normaliseSlug(slug) {
	return slug.replace(/^\/+|\/+$/g, '');
}

function asList(response) {
	if (Array.isArray(response)) return response;
	for (const key of ['sections', 'entries', 'data']) {
		if (Array.isArray(response?.[key])) return response[key];
	}
	throw new Error('Unexpected CMS list response.');
}

function walk(value, pathParts = [], results = []) {
	if (typeof value === 'string') {
		results.push({ path: pathParts, value });
		return results;
	}
	if (Array.isArray(value)) {
		value.forEach((item, index) => walk(item, [...pathParts, index], results));
	} else if (value && typeof value === 'object') {
		Object.entries(value).forEach(([key, item]) => walk(item, [...pathParts, key], results));
	}
	return results;
}

function pathLabel(pathParts) {
	return pathParts.join('.');
}

function parentAndKey(target, pathParts) {
	const key = pathParts[pathParts.length - 1];
	const parent = pathParts.slice(0, -1).reduce((value, part) => value[part], target);
	return { parent, key };
}

function replaceRoute(value, oldSlug, newSlug) {
	const oldRoute = `/${oldSlug}`;
	const newRoute = `/${newSlug}`;
	return value === oldRoute || value.startsWith(`${oldRoute}?`) || value.startsWith(`${oldRoute}#`)
		? `${newRoute}${value.slice(oldRoute.length)}`
		: null;
}

function collectEntryChanges(entry, oldSlug, newSlug, targetSectionIds) {
	const changes = [];
	const references = walk(entry.data || {});
	for (const reference of references) {
		const leaf = String(reference.path.at(-1));
		if (targetSectionIds.has(entry.id) && leaf === 'page' && reference.value === oldSlug) {
			changes.push({ path: reference.path, before: reference.value, after: newSlug, kind: 'section page' });
			continue;
		}
		if (leaf === 'href' && reference.value.startsWith(`/${oldSlug}`)) {
			const after = replaceRoute(reference.value, oldSlug, newSlug);
			if (after) {
				changes.push({ path: reference.path, before: reference.value, after, kind: 'inbound link' });
				continue;
			}
			throw new Error(
				`Unsupported route reference in entry ${entry.id} (${entry.contentTypeApiId}) at ${pathLabel(reference.path)}: ${reference.value}`,
			);
		}
	}
	return changes;
}

function applyChanges(data, changes) {
	for (const change of changes) {
		const { parent, key } = parentAndKey(data, change.path);
		parent[key] = change.after;
	}
}

function backupFileForSlug(slug) {
	const date = new Date().toISOString().slice(0, 10);
	const normalised = normaliseSlug(slug);
	return path.resolve(
		__dirname,
		`../../../backups/${date}/${normalised}/${path.basename(normalised)}.json`,
	);
}

function findBackupContainingEntry(entryId) {
	const date = new Date().toISOString().slice(0, 10);
	const root = path.resolve(__dirname, `../../../backups/${date}`);
	const stack = [root];
	while (stack.length) {
		const current = stack.pop();
		if (!fs.existsSync(current)) continue;
		for (const item of fs.readdirSync(current, { withFileTypes: true })) {
			const file = path.join(current, item.name);
			if (item.isDirectory()) {
				stack.push(file);
				continue;
			}
			if (!item.isFile() || !item.name.endsWith('.json')) continue;
			try {
				const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
				if (snapshot?.page && asList(snapshot.sections).some((section) => section.id === entryId)) {
					return { file, snapshot };
				}
			} catch {
				// Ignore unrelated or malformed backup files; the exact entry ID is the guard.
			}
		}
	}
	return null;
}

function verifyBackup(page, entry, typesByApiId) {
	if (entry.data?.page) {
		let file = backupFileForSlug(entry.data.page);
		let snapshot;
		if (fs.existsSync(file)) {
			snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
		} else {
			const fallback = findBackupContainingEntry(entry.id);
			if (!fallback) throw new Error(`Today's backup is missing for entry ${entry.id}: ${file}`);
			({ file, snapshot } = fallback);
		}
		if (!snapshot?.page) throw new Error(`Backup page mismatch for entry ${entry.id}: ${file}`);
		const sections = asList(snapshot.sections);
		if (!sections.some((section) => section.id === entry.id)) {
			throw new Error(`Backup ${file} does not contain entry ${entry.id}.`);
		}
		return file;
	}

	const type = typesByApiId.get(entry.contentTypeApiId);
	if (!type) throw new Error(`Cannot identify the content type for global entry ${entry.id}.`);
	const name = entry.data?.slug || entry.data?.name || entry.id;
	const date = new Date().toISOString().slice(0, 10);
	const file = path.resolve(__dirname, `../../../backups/${date}/${type.apiId}/${name}.json`);
	if (!fs.existsSync(file)) throw new Error(`Today's global-entry backup is missing: ${file}`);
	const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
	if (snapshot?.id !== entry.id) throw new Error(`Global-entry backup mismatch for ${entry.id}: ${file}`);
	return file;
}

async function findExactPage(slug) {
	const pages = await adminRequest('/api/pages');
	const matches = pages.filter((page) => page.slug === slug);
	if (matches.length !== 1) throw new Error(`Expected exactly one page with slug "${slug}", found ${matches.length}.`);
	return { page: matches[0], pages };
}

async function listAllEntries(types) {
	const limit = 8;
	const rows = [];
	let next = 0;
	await Promise.all(Array.from({ length: limit }, async () => {
		while (next < types.length) {
			const type = types[next++];
			const entries = await adminRequest(`/api/content-types/${type.id}/entries`);
			for (const entry of entries || []) rows.push(entry);
		}
	}));
	return rows;
}

(async () => {
	const [oldInput, newInput, ...flags] = process.argv.slice(2);
	if (!oldInput || !newInput || flags.some((flag) => flag !== '--apply')) usage();
	const oldSlug = normaliseSlug(oldInput);
	const newSlug = normaliseSlug(newInput);
	if (!oldSlug || !newSlug || oldSlug === newSlug) throw new Error('Provide two distinct, non-empty slugs.');
	const APPLY = flags.includes('--apply');

	const { page, pages } = await findExactPage(oldSlug);
	if (pages.some((candidate) => candidate.slug === newSlug)) {
		throw new Error(`The destination slug "${newSlug}" already exists.`);
	}
	const [rawSections, types] = await Promise.all([
		adminRequest(`/api/pages/${page.id}/sections`),
		adminRequest('/api/content-types'),
	]);
	const sections = asList(rawSections);
	const targetSectionIds = new Set(sections.map((section) => section.id));
	const allEntries = await listAllEntries(types);
	const planned = allEntries
		.map((entry) => ({ entry, changes: collectEntryChanges(entry, oldSlug, newSlug, targetSectionIds) }))
		.filter(({ changes }) => changes.length);

	console.log(`${APPLY ? 'Applying' : 'Dry run'}: ${oldSlug} -> ${newSlug}`);
	console.log(`Page ${page.id}; ${sections.length} attached section(s); ${planned.length} entry update(s).`);
	for (const { entry, changes } of planned) {
		console.log(`\n[${entry.id}] ${entry.contentTypeApiId} (${entry.data?.page || 'global'})`);
		for (const change of changes) {
			console.log(`  ${change.kind}: ${pathLabel(change.path)} :: ${change.before} -> ${change.after}`);
		}
	}
	console.log(`\n[page ${page.id}] slug :: ${oldSlug} -> ${newSlug}`);

	if (!APPLY) {
		console.log('\nNo CMS data was changed. Re-run with --apply after reviewing this plan.');
		return;
	}

	const typesByApiId = new Map(types.map((type) => [type.apiId, type]));
	const verifiedBackups = new Set(planned.map(({ entry }) => verifyBackup(page, entry, typesByApiId)));
	console.log(`\nVerified ${verifiedBackups.size} backup file(s) for every changed entry.`);

	for (const { entry, changes } of planned) {
		const live = await adminRequest(`/api/entries/${entry.id}`);
		const liveChanges = collectEntryChanges(live, oldSlug, newSlug, targetSectionIds);
		if (liveChanges.length !== changes.length) {
			throw new Error(`Entry ${entry.id} changed during this run; stopped before updating it.`);
		}
		applyChanges(live.data, liveChanges);
		await adminRequest(`/api/entries/${entry.id}`, { method: 'PUT', body: live });
		console.log(`[${entry.id}] updated with full PUT`);
	}

	const livePage = await adminRequest(`/api/pages/${page.id}`);
	if (livePage.slug !== oldSlug) throw new Error(`Page slug changed during this run; stopped before page update.`);
	const { id, tenantId, branchId, createdAt, updatedAt, ...pageBody } = livePage;
	pageBody.slug = newSlug;
	await adminRequest(`/api/pages/${page.id}`, { method: 'PUT', body: pageBody });
	console.log(`[page ${page.id}] slug updated with full PUT`);
})().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
