#!/usr/bin/env node
// Usage:
//   node backup-restore-preview-images.js backup  <out-dir>
//   node backup-restore-preview-images.js restore <out-dir> [apiId]
//
// backup:  downloads every content type's previewImages (a content type can
//          carry more than one — the CMS admin shows them all as a gallery
//          so editors can recognize the type visually) locally and writes a
//          manifest.json (apiId, name, original + local-relative paths for
//          each image) to <out-dir>. Use this before any migration that
//          might break previewImages CDN links.
// restore: reads manifest.json from <out-dir>, re-uploads each local image to
//          the CURRENT CMS (fetched live, matched by apiId) as media, and
//          PUTs the full rebuilt URL array onto that content type's
//          previewImages. Pass a single apiId as a third arg to restore just
//          one (verify before doing all).
//
// previewImages (and __variant) are default top-level properties every
// content type document carries automatically — not something you add to
// its `fields` array. See docs/admin-api.md's "Default content-type document
// properties" section — some older read paths in this project's history only
// ever read a singular `previewImage` (first image, or a separate legacy
// field); this script uses the full array, which is the real capability.
const fs = require('fs');
const path = require('path');
const { requireEnv, adminRequest } = require('../lib');

async function runBackup(outDir) {
	const models = await adminRequest('/api/content-types');
	fs.mkdirSync(outDir, { recursive: true });

	const withPreview = models.filter((m) => Array.isArray(m.previewImages) && m.previewImages.length > 0);
	console.log(`${withPreview.length} of ${models.length} content types have previewImages`);

	const manifest = [];
	for (const model of withPreview) {
		const localFiles = [];
		for (let i = 0; i < model.previewImages.length; i++) {
			const url = model.previewImages[i];
			const ext = path.extname(new URL(url).pathname) || '.png';
			const fileName = `${model.apiId}-${i}${ext}`;
			const outPath = path.join(outDir, fileName);
			try {
				const imgRes = await fetch(url);
				if (!imgRes.ok) {
					console.log(`FAILED (${imgRes.status}) ${model.apiId}[${i}] <- ${url}`);
					continue;
				}
				const buf = Buffer.from(await imgRes.arrayBuffer());
				fs.writeFileSync(outPath, buf);
				console.log(`OK ${model.apiId}[${i}] -> ${outPath}`);
				localFiles.push({ originalUrl: url, localFile: `./${fileName}` });
			} catch (e) {
				console.log(`ERROR ${model.apiId}[${i}]: ${e.message}`);
			}
		}
		if (localFiles.length > 0) {
			manifest.push({ apiId: model.apiId, name: model.name, images: localFiles });
		}
	}

	fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
	console.log(`Wrote manifest.json with ${manifest.length} entries`);
}

async function uploadMedia(filePath) {
	const { BASE_URL, API_KEY } = requireEnv();
	const buffer = fs.readFileSync(filePath);
	const form = new FormData();
	form.append('file', new Blob([buffer]), path.basename(filePath));
	const res = await fetch(`${BASE_URL}/api/media/upload`, {
		method: 'POST',
		headers: { 'X-API-Key': API_KEY },
		body: form,
	});
	if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
	return res.json();
}

async function runRestore(outDir, onlyApiId) {
	const manifestPath = path.join(outDir, 'manifest.json');
	const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
	const entries = onlyApiId ? manifest.filter((e) => e.apiId === onlyApiId) : manifest;
	if (onlyApiId && entries.length === 0) throw new Error(`No manifest entry found for apiId "${onlyApiId}"`);

	console.log(`Processing ${entries.length} of ${manifest.length} entries`);
	const live = await adminRequest('/api/content-types');
	const liveByApiId = new Map(live.map((m) => [m.apiId, m]));

	const results = [];
	for (const entry of entries) {
		const current = liveByApiId.get(entry.apiId);
		if (!current) {
			console.log(`SKIP ${entry.apiId}: not found on live CMS`);
			results.push({ apiId: entry.apiId, ok: false, reason: 'not found on live CMS' });
			continue;
		}

		const newUrls = [];
		let anyFailed = false;
		for (const img of entry.images) {
			const imagePath = path.join(outDir, path.basename(img.localFile));
			if (!fs.existsSync(imagePath)) {
				console.log(`SKIP ${entry.apiId} (${img.localFile}): local file missing`);
				anyFailed = true;
				continue;
			}
			try {
				const media = await uploadMedia(imagePath);
				newUrls.push(media.url);
				console.log(`OK ${entry.apiId} (${img.localFile}) -> ${media.url}`);
			} catch (e) {
				console.log(`FAILED ${entry.apiId} (${img.localFile}): ${e.message}`);
				anyFailed = true;
			}
		}

		if (newUrls.length === 0) {
			results.push({ apiId: entry.apiId, ok: false, reason: 'no images uploaded' });
			continue;
		}

		try {
			await adminRequest(`/api/content-types/${current.id}`, {
				method: 'PUT',
				body: { ...current, previewImages: newUrls },
			});
			console.log(`${entry.apiId}: set previewImages to ${newUrls.length} image(s)${anyFailed ? ' (partial — some images failed, see above)' : ''}`);
			results.push({ apiId: entry.apiId, ok: !anyFailed });
		} catch (e) {
			console.log(`FAILED ${entry.apiId}: ${e.message}`);
			results.push({ apiId: entry.apiId, ok: false, reason: e.message });
		}
	}

	const failed = results.filter((r) => !r.ok);
	console.log(`\nDone. ${results.length - failed.length} succeeded, ${failed.length} failed/partial.`);
	if (failed.length) console.log('Failed/partial:', JSON.stringify(failed, null, 2));
}

(async () => {
	const [mode, outDir, arg3] = process.argv.slice(2);
	if (!mode || !outDir || (mode !== 'backup' && mode !== 'restore')) {
		throw new Error('Usage: node backup-restore-preview-images.js backup|restore <out-dir> [apiId (restore only)]');
	}
	if (mode === 'backup') await runBackup(outDir);
	else await runRestore(outDir, arg3);
})().catch((e) => { console.error(e.message); process.exit(1); });
