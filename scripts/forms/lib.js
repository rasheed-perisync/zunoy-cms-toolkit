// Forms-specific helpers. Transport and authentication come from the shared
// toolkit library; this file owns only the Forms API base URL and data rules.
const { adminRequest, publicRequest, readJsonArg } = require('../lib');

const DEFAULT_FORMS_BASE_URL = 'https://api.zunoy.com/api/v1/cms';

function formsBaseUrl() {
	return (process.env.CMS_FORMS_BASE_URL || DEFAULT_FORMS_BASE_URL).replace(/\/$/, '');
}

function formsRequest(path = '', options = {}) {
	return adminRequest(`/api/forms${path}`, { ...options, baseUrl: formsBaseUrl() });
}

function formsPublicRequest(path, options = {}) {
	return publicRequest(path, { ...options, baseUrl: formsBaseUrl() });
}

async function listForms() {
	const body = await formsRequest();
	if (!Array.isArray(body)) throw new Error('Expected the Forms API to return an array.');
	return body;
}

async function findForm(idOrSlug) {
	const forms = await listForms();
	const form = forms.find((item) => item.id === idOrSlug || item.slug === idOrSlug);
	if (!form) throw new Error(`No form found with id or slug "${idOrSlug}".`);
	return form;
}

function formPayload(input, { requireSlug = false } = {}) {
	const allowed = new Set(['name', 'slug', 'description']);
	const unsupported = Object.keys(input).filter((key) => !allowed.has(key));
	if (unsupported.length) {
		throw new Error(
			`Unsupported form field(s): ${unsupported.join(', ')}. Only name, slug, and description are supported until form-tag taxonomies are available.`,
		);
	}
	if (typeof input.name !== 'string' || !input.name.trim()) throw new Error('Form name must be a non-empty string.');
	if (input.description !== undefined && typeof input.description !== 'string') throw new Error('Form description must be a string when provided.');
	if (requireSlug && (typeof input.slug !== 'string' || !input.slug.trim())) throw new Error('Form slug must be a non-empty string.');
	if (input.slug !== undefined && (typeof input.slug !== 'string' || !input.slug.trim())) throw new Error('Form slug must be a non-empty string when provided.');

	const payload = { name: input.name.trim() };
	if (input.slug !== undefined) payload.slug = input.slug.trim();
	if (input.description !== undefined) payload.description = input.description;
	return payload;
}

module.exports = {
	formsRequest,
	formsPublicRequest,
	listForms,
	findForm,
	formPayload,
	readJsonArg,
};
