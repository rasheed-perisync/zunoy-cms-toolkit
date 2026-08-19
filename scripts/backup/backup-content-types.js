#!/usr/bin/env node
// Backs up every content type's full schema into
// ../backups/<YYYY-MM-DD>/content-types/<apiId>.json (relative to the toolkit
// root, i.e. a sibling folder of zunoy-cms-toolkit itself). Each run gets its
// own dated folder so earlier backups are never overwritten.
//
// Usage: CMS_BASE_URL=... CMS_API_KEY=... node backup-content-types.js
const fs = require('fs');
const path = require('path');
const { adminRequest } = require('../lib');

const BACKUP_DATE = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../../backups/${BACKUP_DATE}/content-types`);

(async () => {
	console.log('Fetching content types from /api/content-types ...');
	const types = await adminRequest('/api/content-types');
	console.log(`Found ${types.length} content types.\n`);

	fs.mkdirSync(OUT_DIR, { recursive: true });

	for (const t of types) {
		const outFile = path.join(OUT_DIR, `${t.apiId}.json`);
		fs.writeFileSync(outFile, JSON.stringify(t, null, 2));
		console.log(`saved -> ${path.relative(process.cwd(), outFile)}`);
	}

	console.log('\n--- Summary ---');
	console.log(`Content types:  ${types.length}`);
	console.log(`Output dir:     ${OUT_DIR}`);
})().catch((e) => { console.error('Fatal error:', e.message); process.exit(1); });
