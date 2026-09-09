#!/usr/bin/env node
// Usage:
//   node fix-alt-keys.js [--slug=homepage] [--apply]
//   node fix-alt-keys.js --all [--apply]               (scans all pages AND all content-type collections)
//   node fix-alt-keys.js --all-pages [--apply]         (scans all pages and their sections)
//   node fix-alt-keys.js --all-entries [--apply]       (scans all entries across all content-types)
//   node fix-alt-keys.js --type=<apiId> [--apply]      (scans entries of one content-type, e.g. post)
//   node fix-alt-keys.js --entry=<entryId> [--apply]   (scans one entry by ID)
//
// Finds keys ending in 'Alt' (e.g. mainImageAlt, backgroundAlt, videoAlt, tile1ImageAlt, imageAlt)
// across entry data (including nested objects and arrays) and replaces them with
// <fieldName>_alt (e.g. mainImage_alt, background_alt, video_alt, tile1Image_alt, image_alt).
//
// Dry-run is the default — pass --apply to execute the updates in the CMS.
//
// Always performs a full PUT of the freshly fetched entry to prevent
// data loss or accidental section unlinking.

const fs = require('fs');
const path = require('path');

// Auto-load env from .env or .env.local if not already set
function loadEnvIfPresent() {
	const candidates = [
		path.resolve(process.cwd(), '.env.local'),
		path.resolve(process.cwd(), '.env'),
		path.resolve(__dirname, '../../.env.local'),
		path.resolve(__dirname, '../.env.local'),
		'/Users/dev/perisync/Esyasoft-Git-copy/.env.local',
	];
	for (const file of candidates) {
		if (fs.existsSync(file)) {
			const content = fs.readFileSync(file, 'utf8');
			for (const line of content.split('\n')) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith('#')) continue;
				const eq = trimmed.indexOf('=');
				if (eq === -1) continue;
				const key = trimmed.slice(0, eq).trim();
				let val = trimmed.slice(eq + 1).trim();
				if (
					(val.startsWith('"') && val.endsWith('"')) ||
					(val.startsWith("'") && val.endsWith("'"))
				) {
					val = val.slice(1, -1);
				}
				if (
					!process.env.CMS_BASE_URL &&
					(key === 'CMS_BASE_URL' || key === 'ZUNOY_CMS_URL')
				) {
					process.env.CMS_BASE_URL = val;
				}
				if (
					!process.env.CMS_API_KEY &&
					(key === 'CMS_API_KEY' || key === 'ZUNOY_CMS_API_KEY')
				) {
					process.env.CMS_API_KEY = val;
				}
			}
			if (process.env.CMS_BASE_URL && process.env.CMS_API_KEY) break;
		}
	}
}

loadEnvIfPresent();

const { adminRequest } = require('../scripts/lib');

function parseArgs() {
	const args = {
		slug: null,
		all: false,
		allPages: false,
		allEntries: false,
		type: null,
		entryId: null,
		apply: false,
	};
	for (const arg of process.argv.slice(2)) {
		if (arg === '--apply') {
			args.apply = true;
		} else if (arg === '--all') {
			args.all = true;
		} else if (arg === '--all-pages') {
			args.allPages = true;
		} else if (arg === '--all-entries') {
			args.allEntries = true;
		} else if (arg.startsWith('--slug=')) {
			args.slug = arg.slice('--slug='.length);
		} else if (arg.startsWith('--type=')) {
			args.type = arg.slice('--type='.length);
		} else if (arg.startsWith('--entry=')) {
			args.entryId = arg.slice('--entry='.length);
		}
	}
	// Default to homepage if no mode specified
	if (
		!args.all &&
		!args.allPages &&
		!args.allEntries &&
		!args.type &&
		!args.entryId &&
		!args.slug
	) {
		args.slug = 'homepage';
	}
	return args;
}

// Recursively traverse obj and rename <fieldName>Alt -> <fieldName>_alt
function transformAltKeys(obj, currentPath = '') {
	const changes = [];
	if (!obj || typeof obj !== 'object') {
		return { changed: false, changes };
	}

	let changed = false;

	if (Array.isArray(obj)) {
		for (let i = 0; i < obj.length; i++) {
			const sub = transformAltKeys(obj[i], `${currentPath}[${i}]`);
			if (sub.changed) changed = true;
			changes.push(...sub.changes);
		}
	} else {
		for (const key of Object.keys(obj)) {
			const propPath = currentPath ? `${currentPath}.${key}` : key;
			// Matches any key ending in capital Alt preceded by letter or digit (e.g. backgroundAlt)
			if (/[a-z0-9]Alt$/.test(key)) {
				const base = key.slice(0, -3);
				const newKey = `${base}_alt`;
				const val = obj[key];

				delete obj[key];
				obj[newKey] = val;

				changed = true;
				changes.push({
					path: propPath,
					oldKey: key,
					newKey,
					value: val,
				});
			}

			if (obj[key] && typeof obj[key] === 'object') {
				const sub = transformAltKeys(obj[key], propPath);
				if (sub.changed) changed = true;
				changes.push(...sub.changes);
			}
		}
	}

	return { changed, changes };
}

async function processEntry(entryId, apply) {
	let entry;
	try {
		entry = await adminRequest(`/api/entries/${entryId}`);
	} catch (e) {
		console.error(`  x Failed to fetch entry ${entryId}: ${e.message}`);
		return null;
	}
	if (!entry || !entry.data) return null;

	const { changed, changes } = transformAltKeys(entry.data);
	if (!changed) return null;

	console.log(
		`\n[Entry: ${entryId}] (${entry.contentTypeApiId || 'unknown type'}, status: ${entry.status})`,
	);
	for (const ch of changes) {
		console.log(
			`  - ${ch.path} -> ${ch.newKey} (value: ${JSON.stringify(ch.value)})`,
		);
	}

	if (apply) {
		await adminRequest(`/api/entries/${entryId}`, {
			method: 'PUT',
			body: {
				status: entry.status,
				data: entry.data,
			},
		});
		console.log(`  ✓ Updated entry ${entryId}`);
	}

	return { entryId, changesCount: changes.length };
}

async function processPage(slug, apply) {
	const pages = await adminRequest('/api/pages');
	const pageList = Array.isArray(pages) ? pages : pages?.data || [];
	const page = pageList.find((p) => p.slug === slug);
	if (!page) {
		throw new Error(`No page found with slug "${slug}"`);
	}

	console.log(`\n======================================================`);
	console.log(
		`Processing page "${page.title}" (slug: ${page.slug}, id: ${page.id})`,
	);
	console.log(`======================================================`);

	// 1. Check page.data itself
	const pageDataRes = transformAltKeys(page.data || {});
	if (pageDataRes.changed) {
		console.log(`\n[Page Record: ${page.id}]`);
		for (const ch of pageDataRes.changes) {
			console.log(
				`  - page.data.${ch.path} -> ${ch.newKey} (value: ${JSON.stringify(ch.value)})`,
			);
		}
		if (apply) {
			await adminRequest(`/api/pages/${page.id}`, {
				method: 'PUT',
				body: {
					slug: page.slug,
					title: page.title,
					status: page.status,
					data: page.data,
				},
			});
			console.log(`  ✓ Updated page ${page.id}`);
		}
	}

	// 2. Fetch page sections
	const secRes = await adminRequest(`/api/pages/${page.id}/sections`);
	const sections = Array.isArray(secRes) ? secRes : secRes?.sections || [];
	console.log(`Found ${sections.length} sections for page "${page.slug}".`);

	let modifiedEntries = 0;
	let totalKeysChanged = pageDataRes.changed ? pageDataRes.changes.length : 0;

	for (const sec of sections) {
		const res = await processEntry(sec.id, apply);
		if (res) {
			modifiedEntries++;
			totalKeysChanged += res.changesCount;
		}
	}

	return { page: page.slug, modifiedEntries, totalKeysChanged };
}

async function processContentTypeEntries(typeObj, apply) {
	const entries = await adminRequest(
		`/api/content-types/${typeObj.id}/entries`,
	);
	if (!Array.isArray(entries) || entries.length === 0) {
		return { modifiedEntries: 0, totalKeysChanged: 0 };
	}

	let modifiedEntries = 0;
	let totalKeysChanged = 0;

	for (const entry of entries) {
		const res = await processEntry(entry.id, apply);
		if (res) {
			modifiedEntries++;
			totalKeysChanged += res.changesCount;
		}
	}

	return { modifiedEntries, totalKeysChanged };
}

(async () => {
	const args = parseArgs();
	console.log(
		`Mode: ${args.apply ? 'LIVE APPLY (mutating)' : 'DRY RUN (no changes written)'}`,
	);

	if (args.entryId) {
		console.log(`Targeting single entry: ${args.entryId}`);
		const res = await processEntry(args.entryId, args.apply);
		if (!res) {
			console.log(`No *Alt keys found on entry ${args.entryId}.`);
		} else {
			console.log(
				`\nDone. Changed ${res.changesCount} key(s) on entry ${args.entryId}.`,
			);
		}
		return;
	}

	if (args.type) {
		console.log(`Targeting content type: ${args.type}`);
		const types = await adminRequest('/api/content-types');
		const t = types.find(
			(x) => x.apiId === args.type || x.id === args.type,
		);
		if (!t) throw new Error(`Content type "${args.type}" not found.`);
		const r = await processContentTypeEntries(t, args.apply);
		console.log(
			`\nContent type "${t.apiId}": Modified ${r.modifiedEntries} entries, changed ${r.totalKeysChanged} keys.`,
		);
		return;
	}

	if (args.all || args.allPages) {
		const pages = await adminRequest('/api/pages');
		const pageList = Array.isArray(pages) ? pages : pages?.data || [];
		console.log(`Scanning all ${pageList.length} pages...`);
		let grandTotalEntries = 0;
		let grandTotalKeys = 0;
		for (const p of pageList) {
			try {
				const r = await processPage(p.slug, args.apply);
				grandTotalEntries += r.modifiedEntries;
				grandTotalKeys += r.totalKeysChanged;
			} catch (e) {
				console.error(`Error processing page ${p.slug}:`, e.message);
			}
		}
		console.log(
			`\nPages summary: Total modified entries: ${grandTotalEntries}, total keys changed: ${grandTotalKeys}.`,
		);
	}

	if (args.all || args.allEntries) {
		const types = await adminRequest('/api/content-types');
		console.log(
			`\nScanning entries across all ${types.length} content types...`,
		);
		let grandTotalEntries = 0;
		let grandTotalKeys = 0;
		for (const t of types) {
			try {
				const r = await processContentTypeEntries(t, args.apply);
				if (r.modifiedEntries > 0) {
					console.log(
						`[Content Type: ${t.apiId}] Modified ${r.modifiedEntries} entries, ${r.totalKeysChanged} keys.`,
					);
					grandTotalEntries += r.modifiedEntries;
					grandTotalKeys += r.totalKeysChanged;
				}
			} catch (e) {
				console.error(
					`Error processing content type ${t.apiId}:`,
					e.message,
				);
			}
		}
		console.log(
			`\nContent-types summary: Total modified entries: ${grandTotalEntries}, total keys changed: ${grandTotalKeys}.`,
		);
	}

	if (args.slug) {
		const r = await processPage(args.slug, args.apply);
		console.log(`\nSummary for "${args.slug}":`);
		console.log(`- Modified entries: ${r.modifiedEntries}`);
		console.log(`- Total keys changed: ${r.totalKeysChanged}`);
	}

	if (!args.apply) {
		console.log(
			`\nNOTE: This was a DRY RUN. Re-run with --apply to write these changes to the CMS.`,
		);
	} else {
		console.log(`\n✓ All changes successfully applied to CMS.`);
	}
})().catch((err) => {
	console.error('Fatal error:', err.message);
	process.exit(1);
});
