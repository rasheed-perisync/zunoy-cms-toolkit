#!/usr/bin/env node
// Usage: node screenshot-previews.js <site-url> [apiId ...] [--dry] [--missing] [--folder "ct previews"]
//
// For every content type used as a page section: finds the first page that
// has it, opens <site-url>/<slug> in Playwright, screenshots just that section
// and sets it as the content type's previewImages (replacing what's there),
// uploading into the media folder given by --folder (created if missing).
//
// The site must wrap each rendered section in an element carrying
// data-section-id="<section entry id>" (and data-ct="<apiId>"). Item types
// (testimonial, faq-item, ...) are found by data-ct="<apiId>" on their root
// element, first visible one on any published page. Singletons and taxonomies
// are skipped.
//
// --dry      screenshots only (saved to ./ct-previews), no upload or update
// --missing  skip content types that already have previewImages
// apiIds     limit the run to those content types
//
// Uses the globally installed playwright (npm i -g playwright; npx playwright install chromium).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { requireEnv, adminRequest, filterEntriesByBranch } = require('../lib');

const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));

const HOME_SLUG = 'home';
const OUT_DIR = path.resolve('ct-previews');

function parseArgs(argv) {
	const opts = { siteUrl: null, apiIds: [], dry: false, missing: false, folder: 'ct previews' };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--dry') opts.dry = true;
		else if (a === '--missing') opts.missing = true;
		else if (a === '--folder') opts.folder = argv[++i];
		else if (!opts.siteUrl) opts.siteUrl = a.replace(/\/$/, '');
		else opts.apiIds.push(a);
	}
	if (!opts.siteUrl) throw new Error('Usage: node screenshot-previews.js <site-url> [apiId ...] [--dry] [--missing] [--folder <name>]');
	return opts;
}

async function getFolderId(name) {
	const folders = await adminRequest('/api/media/folders');
	const existing = folders.find((f) => f.name === name);
	if (existing) return existing.id;
	const created = await adminRequest('/api/media/folders', { method: 'POST', body: { name } });
	console.log(`Created media folder "${name}"`);
	return created.id;
}

async function uploadFile(filePath, folderId) {
	const { BASE_URL, API_KEY } = requireEnv();
	const form = new FormData();
	form.append('file', new Blob([fs.readFileSync(filePath)], { type: 'image/png' }), path.basename(filePath));
	form.append('folderId', folderId);
	const res = await fetch(`${BASE_URL}/api/media/upload`, { method: 'POST', headers: { 'X-API-Key': API_KEY }, body: form });
	if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
	return res.json();
}

// Sections: apiId -> { slug, sectionId } for the first published page that
// uses it. Also returns every published page slug, searched for item types.
async function findSectionTargets() {
	const pages = filterEntriesByBranch(await adminRequest('/api/pages')).filter((p) => p.status === 'published');
	const targets = new Map();
	for (const page of pages) {
		const { sections } = await adminRequest(`/api/pages/${page.id}/sections`);
		for (const s of filterEntriesByBranch(sections)) {
			if (s.status === 'published' && !targets.has(s.contentTypeApiId)) {
				targets.set(s.contentTypeApiId, { slug: page.slug, sectionId: s.id });
			}
		}
	}
	return { targets, slugs: pages.map((p) => p.slug) };
}

async function loadPage(page, url) {
	await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
	// Sticky header would cover the top of each section; cookie banner and Next dev badge too.
	await page.addStyleTag({ content: '.sticky{position:relative!important} [class*="cookie" i],[id*="cookie" i],nextjs-portal{display:none!important}' });
	// Scroll through once so lazy images and scroll animations load.
	await page.evaluate(async () => {
		for (let y = 0; y < document.body.scrollHeight; y += 600) {
			window.scrollTo(0, y);
			await new Promise((r) => setTimeout(r, 120));
		}
		window.scrollTo(0, 0);
	});
	await page.waitForLoadState('networkidle').catch(() => {});
}

// Sections are shot as-is; items (small) get some padding around them.
async function shoot(page, el, file, pad) {
	await el.scrollIntoViewIfNeeded({ timeout: 10000 });
	await page.waitForTimeout(600);
	if (!pad) return el.screenshot({ path: file, animations: 'disabled' });
	// Clip in page coordinates (fullPage) so padding past the viewport edge isn't cut.
	const box = await el.boundingBox();
	const scrollY = await page.evaluate(() => window.scrollY);
	const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y + scrollY - pad), width: box.width + pad * 2, height: box.height + pad * 2 };
	return page.screenshot({ path: file, clip, fullPage: true, animations: 'disabled' });
}

(async () => {
	const opts = parseArgs(process.argv.slice(2));
	const types = await adminRequest('/api/content-types');
	const { targets, slugs } = await findSectionTargets();

	// Everything except singletons (site settings etc.) and taxonomies: nothing to show.
	let todo = types.filter((t) => !t.isSingleton && !t.isTaxonomy);
	if (opts.apiIds.length) todo = todo.filter((t) => opts.apiIds.includes(t.apiId));
	if (opts.missing) todo = todo.filter((t) => !(t.previewImages || []).length);
	console.log(`${todo.length} content types to do: ${todo.map((t) => t.apiId).join(', ')}`);

	const folderId = opts.dry ? null : await getFolderId(opts.folder);
	fs.mkdirSync(OUT_DIR, { recursive: true });

	const browser = await chromium.launch();
	const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

	const pending = new Map(todo.map((t) => [t.apiId, t]));
	const failed = [];
	// Section pages first, then the rest, so items are usually found on pages already planned.
	const order = [...new Set([...todo.filter((t) => targets.has(t.apiId)).map((t) => targets.get(t.apiId).slug), ...slugs])];

	for (const slug of order) {
		if (!pending.size) break;
		const url = `${opts.siteUrl}/${slug === HOME_SLUG ? '' : slug}`;
		console.log(`\n${url}`);
		await loadPage(page, url);

		for (const ct of [...pending.values()]) {
			const section = targets.get(ct.apiId);
			let el;
			if (section) {
				if (section.slug !== slug) continue;
				el = page.locator(`[data-section-id="${section.sectionId}"]`);
			} else {
				el = page.locator(`[data-ct="${ct.apiId}"]:not([data-section-id]):visible`).first();
				if (!(await el.count())) continue;
			}
			pending.delete(ct.apiId);
			const file = path.join(OUT_DIR, `${ct.apiId}.png`);
			try {
				await shoot(page, el, file, section ? 0 : 24);
				if (opts.dry) { console.log(`  shot ${ct.apiId} -> ${file}`); continue; }

				const media = await uploadFile(file, folderId);
				await adminRequest(`/api/content-types/${ct.id}`, { method: 'PUT', body: { ...ct, previewImages: [media.url] } });
				console.log(`  OK ${ct.apiId} -> ${media.url}`);
			} catch (e) {
				failed.push(ct.apiId);
				console.log(`  FAILED ${ct.apiId}: ${e.message.split('\n')[0]}`);
			}
		}
	}

	await browser.close();
	if (pending.size) console.log(`\nNot found on any page (needs a data-ct marker on the site): ${[...pending.keys()].join(', ')}`);
	if (failed.length) console.log(`\nFailed: ${failed.join(', ')}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
