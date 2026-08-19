#!/usr/bin/env node
// Usage: node create.js <path-to-schema.json>
//
// schema.json shape:
// {
//   "name": "2x3 Dot Cards",              // apiId auto-derives from this on creation, immutable after
//   "description": "...",
//   "type": "block",
//   "showInPageManager": true,
//   "isSingleton": false,                  // true for types meant to have exactly one entry (header/footer/global-style) — see entries/get-singleton.js
//   "categories": ["3x3"],                 // group label, reuse an existing one if it fits
//   "previewImages": ["https://.../thumb1.png"],  // optional — shown as the type's thumbnail(s) in the CMS admin; can set later via update.js or backup/backup-restore-preview-images.js
//   "fields": [
//     { "name": "Title", "apiId": "title", "type": "richtext", "required": false },
//     { "name": "Icon", "apiId": "icon", "type": "media", "required": false },
//     { "name": "CTA", "apiId": "cta", "type": "blocks", "allowedTypes": ["button"], "single": true, "required": false }
//   ]
// }
// See docs/admin-api.md's "Default content-type document properties" for what
// previewImages/isSingleton/__variant/categories actually do.
const { adminRequest, readJsonArg } = require('../lib');

(async () => {
	const file = process.argv[2];
	if (!file) throw new Error('Usage: node create.js <path-to-schema.json>');
	const schema = readJsonArg(file);
	const created = await adminRequest('/api/content-types', { method: 'POST', body: schema });
	console.log('Created:', JSON.stringify(created, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
