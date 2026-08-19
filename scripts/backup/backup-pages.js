#!/usr/bin/env node
// Backs up every page's full data (page metadata + all section entries) into
// ../backups/<YYYY-MM-DD>/<slug>/<slug>.json (relative to the toolkit root,
// i.e. a sibling folder of zunoy-cms-toolkit itself). Each run gets its own
// dated folder so earlier backups are never overwritten.
//
// Usage: CMS_BASE_URL=... CMS_API_KEY=... node backup-pages.js
const fs = require('fs');
const path = require('path');
const { adminRequest } = require('../lib');

const BACKUP_DATE = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../../backups/${BACKUP_DATE}`);

(async () => {
	console.log('Fetching page list from /api/pages ...');
	const pages = await adminRequest('/api/pages');
	console.log(`Found ${pages.length} pages. Fetching full section entries for each...\n`);

	fs.mkdirSync(OUT_DIR, { recursive: true });

	let failedPages = 0;

	for (const [i, p] of pages.entries()) {
		process.stdout.write(`[${i + 1}/${pages.length}] ${p.slug} ... `);
		try {
			const sections = await adminRequest(`/api/pages/${p.id}/sections`);
			const pageDir = path.join(OUT_DIR, p.slug);
			fs.mkdirSync(pageDir, { recursive: true });
			const outFile = path.join(pageDir, `${path.basename(p.slug)}.json`);
			fs.writeFileSync(outFile, JSON.stringify({ page: p, sections }, null, 2));
			console.log(`saved -> ${path.relative(process.cwd(), outFile)}`);
		} catch (e) {
			failedPages++;
			console.log(`FAILED (${e.message})`);
		}
	}

	console.log('\n--- Summary ---');
	console.log(`Pages:          ${pages.length}`);
	console.log(`Failed:         ${failedPages}`);
	console.log(`Output dir:     ${OUT_DIR}`);
})().catch((e) => { console.error('Fatal error:', e.message); process.exit(1); });
