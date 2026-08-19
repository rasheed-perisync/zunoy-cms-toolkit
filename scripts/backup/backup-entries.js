#!/usr/bin/env node
// Backs up every entry of a given content type into
// ../backups/<YYYY-MM-DD>/<apiId>/<slug-or-id>.json (relative to the toolkit
// root, i.e. a sibling folder of zunoy-cms-toolkit itself). Each run gets its
// own dated folder so earlier backups are never overwritten.
//
// Usage: CMS_BASE_URL=... CMS_API_KEY=... node backup-entries.js <contentType-apiId-or-id>
const fs = require('fs');
const path = require('path');
const { adminRequest, findContentType } = require('../lib');

const BACKUP_DATE = new Date().toISOString().slice(0, 10);

(async () => {
	const key = process.argv[2];
	if (!key) throw new Error('Usage: node backup-entries.js <contentType-apiId-or-id>');

	console.log(`Resolving "${key}" content type ...`);
	const ct = await findContentType(key);
	const OUT_DIR = path.resolve(__dirname, `../../../backups/${BACKUP_DATE}/${ct.apiId}`);

	console.log(`Fetching entries from /api/content-types/${ct.id}/entries ...`);
	const raw = await adminRequest(`/api/content-types/${ct.id}/entries`);
	const entries = Array.isArray(raw) ? raw : raw?.entries || raw?.data || [];
	console.log(`Found ${entries.length} entries.\n`);

	fs.mkdirSync(OUT_DIR, { recursive: true });

	for (const e of entries) {
		const name = e.data?.slug || e.data?.name || e.id;
		const outFile = path.join(OUT_DIR, `${name}.json`);
		fs.writeFileSync(outFile, JSON.stringify(e, null, 2));
		console.log(`saved -> ${path.relative(process.cwd(), outFile)}`);
	}

	console.log('\n--- Summary ---');
	console.log(`Entries:        ${entries.length}`);
	console.log(`Output dir:     ${OUT_DIR}`);
})().catch((e) => { console.error('Fatal error:', e.message); process.exit(1); });
