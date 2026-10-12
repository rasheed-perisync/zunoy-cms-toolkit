// Shared HTTP helpers for the zunoy-cms-toolkit scripts.
// Requires Node 18+ (global fetch). No dependencies.
//
// Env vars (never hardcode these — export them or put them in a .env.local
// that you load yourself before running a script; they are instance-specific,
// not public constants):
//   CMS_BASE_URL   - e.g. https://api.example.com/api/v1/cms
//   CMS_API_KEY    - the CMS API key, used as both X-API-Key (admin) and X-Zunoy-Key (public)
//
// Two surfaces, same host+key, different header and path prefix:
//   admin  (draft + all branches, full CRUD): header X-API-Key,  paths like /api/content-types, /api/entries
//   public (published + default branch only, read-only): header X-Zunoy-Key, paths like /v1/_pages/:slug, /v1/:typeApiId

function requireEnv() {
	const BASE_URL = process.env.CMS_BASE_URL;
	const API_KEY = process.env.CMS_API_KEY;
	if (!BASE_URL) throw new Error('CMS_BASE_URL is not set. Export it before running this script.');
	if (!API_KEY) throw new Error('CMS_API_KEY is not set. Export it before running this script.');
	return { BASE_URL, API_KEY };
}

function adminHeaders() {
	const { API_KEY } = requireEnv();
	return { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' };
}

function publicHeaders() {
	const { API_KEY } = requireEnv();
	return { 'X-Zunoy-Key': API_KEY, 'Content-Type': 'application/json' };
}

async function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Appends query params (including an optional `branch`) to a path. `branch`
// selects a CMS content branch (git-like, instance-specific) — confirmed to
// work as a query param on the public surface and on the admin /api/pages*
// endpoints, but NOT on admin /api/content-types/:id/entries (that endpoint
// returns every branch mixed with no server-side filter — use
// filterEntriesByBranch() below on the result instead).
function withParams(path, params = {}) {
	const usp = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined && v !== null) usp.set(k, v);
	}
	const qs = usp.toString();
	return qs ? `${path}${path.includes('?') ? '&' : '?'}${qs}` : path;
}

// retries: number of additional attempts after the first failure (0 = no retry).
// Only retries network errors and 5xx responses — 4xx is treated as a real
// failure (retrying a bad request just wastes time and re-triggers the same error).
async function adminRequest(path, { method = 'GET', body, retries = 0, branch, baseUrl } = {}) {
	const { BASE_URL } = requireEnv();
	const requestBaseUrl = (baseUrl || BASE_URL).replace(/\/$/, '');
	const fullPath = branch ? withParams(path, { branch }) : path;
	let lastErr;
	for (let attempt = 0; attempt <= retries; attempt++) {
		const res = await fetch(`${requestBaseUrl}${fullPath}`, {
			method,
			headers: adminHeaders(),
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
		const text = await res.text();
		let json;
		try { json = text ? JSON.parse(text) : undefined; } catch { json = text; }
		if (res.ok) return json;
		const err = new Error(`${method} ${fullPath} -> ${res.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
		err.status = res.status;
		err.body = json;
		if (res.status < 500 || attempt === retries) throw err;
		lastErr = err;
		await sleep(1000 * (attempt + 1));
	}
	throw lastErr;
}

async function publicRequest(path, { branch, filter, method = 'GET', body, baseUrl } = {}) {
	const { BASE_URL } = requireEnv();
	const requestBaseUrl = (baseUrl || BASE_URL).replace(/\/$/, '');
	const params = { branch };
	if (filter) for (const [k, v] of Object.entries(filter)) params[`filter[${k}]`] = v;
	const fullPath = withParams(path, params);
	const res = await fetch(`${requestBaseUrl}${fullPath}`, {
		method,
		headers: publicHeaders(),
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await res.text();
	let json;
	try { json = text ? JSON.parse(text) : undefined; } catch { json = text; }
	if (!res.ok) {
		const err = new Error(`${method} ${fullPath} -> ${res.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
		err.status = res.status;
		err.body = json;
		throw err;
	}
	return json;
}

// new Blob([buffer]) with no `type` sends the multipart file part with no Content-Type,
// which most CMS backends then store/serve as application/octet-stream regardless of
// the real file format -- browsers can fail to render an <img src>/<audio>/<video>
// pointing at such a URL. Every upload script infers the real type from the extension
// with this.
const MIME_TYPES = {
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
	'.avif': 'image/avif',
	'.heic': 'image/heic',
	'.tif': 'image/tiff',
	'.tiff': 'image/tiff',
	'.ico': 'image/x-icon',
	'.mp3': 'audio/mpeg',
	'.m4a': 'audio/mp4',
	'.wav': 'audio/wav',
	'.ogg': 'audio/ogg',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.mov': 'video/quicktime',
	'.pdf': 'application/pdf',
	'.json': 'application/json',
	'.txt': 'text/plain',
	'.csv': 'text/csv',
};

function mimeTypeFor(filePath) {
	const ext = require('path').extname(filePath).toLowerCase();
	return MIME_TYPES[ext] || 'application/octet-stream';
}

// The admin entries-list endpoint mixes every branch together with no
// server-side filter (confirmed) — filter the result yourself with this.
// Entries with no branchId are treated as the default "main" branch.
function filterEntriesByBranch(entries, branch = 'main') {
	return entries.filter((e) => (e.branchId || 'main') === branch);
}

async function findContentType(apiIdOrId) {
	const types = await adminRequest('/api/content-types');
	const match = types.find((t) => t.id === apiIdOrId || t.apiId === apiIdOrId);
	if (!match) throw new Error(`No content type found with id or apiId "${apiIdOrId}"`);
	return match;
}

function readJsonArg(pathOrJson) {
	// Accepts either a path to a .json file or a raw JSON string as the arg.
	const fs = require('fs');
	if (fs.existsSync(pathOrJson)) {
		return JSON.parse(fs.readFileSync(pathOrJson, 'utf8'));
	}
	return JSON.parse(pathOrJson);
}

module.exports = {
	requireEnv,
	adminHeaders,
	publicHeaders,
	adminRequest,
	publicRequest,
	findContentType,
	readJsonArg,
	filterEntriesByBranch,
	mimeTypeFor,
};
