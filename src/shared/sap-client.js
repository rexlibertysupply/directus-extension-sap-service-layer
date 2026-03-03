import https from 'node:https';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Create a SAP Service Layer HTTP client.
 * Returns an object with get, post, patch, delete, login, logout methods
 * that all use the { data, error } pattern.
 *
 * rejectUnauthorized defaults to false — SAP on-prem installations commonly use
 * self-signed certificates. Set SAP_REJECT_UNAUTHORIZED=true in .env to enforce
 * certificate verification (e.g. when SAP is behind a trusted reverse proxy).
 *
 * timeoutMs defaults to 30s. Set SAP_REQUEST_TIMEOUT_MS in .env to override.
 */
export function createSapClient({ serviceLayerUrl, sessionId, rejectUnauthorized = false, timeoutMs = DEFAULT_TIMEOUT_MS }) {
	if (!serviceLayerUrl || typeof serviceLayerUrl !== 'string') {
		throw new Error('SAP client: serviceLayerUrl is required and must be a string.');
	}

	const baseUrl = serviceLayerUrl.replace(/\/+$/, '');
	const agent = new https.Agent({ rejectUnauthorized });

	async function sendRequest(method, path, body = null) {
		const url = `${baseUrl}/${path}`;
		const headers = {
			'Content-Type': 'application/json',
		};

		if (sessionId) {
			headers['Cookie'] = `B1SESSION=${sessionId}`;
		}

		const options = {
			method,
			headers,
			agent,
		};

		if (body !== null) {
			options.body = JSON.stringify(body);
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		options.signal = controller.signal;

		try {
			const res = await fetch(url, options);
			clearTimeout(timer);

			if (res.status === 204) {
				return { data: { success: true }, error: null };
			}

			let responseData;
			const contentType = res.headers.get('content-type') || '';

			if (contentType.includes('application/json')) {
				responseData = await res.json();
			} else {
				// Wrap non-JSON text responses in a consistent object shape.
				const text = await res.text();
				responseData = { value: text };
			}

			if (!res.ok) {
				const sapError = parseSapError(responseData, res.status);
				return { data: null, error: sapError };
			}

			return { data: responseData, error: null };
		} catch (err) {
			clearTimeout(timer);
			const isTimeout = err.name === 'AbortError';
			return {
				data: null,
				error: {
					code: isTimeout ? 'TIMEOUT' : 'CONNECTION_ERROR',
					message: isTimeout ? `SAP request timed out after ${timeoutMs}ms` : err.message,
					statusCode: 0,
				},
			};
		}
	}

	function buildQueryString(params) {
		if (!params || typeof params !== 'object') return '';

		const queryParts = [];
		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined && value !== null && value !== '') {
				const paramKey = key.startsWith('$') ? key : `$${key}`;
				queryParts.push(`${paramKey}=${encodeURIComponent(value)}`);
			}
		}

		return queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
	}

	return {
		async get(entity, queryParams) {
			const qs = buildQueryString(queryParams);
			return sendRequest('GET', `${entity}${qs}`);
		},

		async post(entity, body) {
			return sendRequest('POST', entity, body);
		},

		async patch(entity, body) {
			return sendRequest('PATCH', entity, body);
		},

		async delete(entity) {
			return sendRequest('DELETE', entity);
		},

		async login(companyDB, userName, password) {
			return sendRequest('POST', 'Login', {
				CompanyDB: companyDB,
				UserName: userName,
				Password: password,
			});
		},

		async logout() {
			return sendRequest('POST', 'Logout');
		},
	};
}

function parseSapError(responseData, statusCode) {
	if (responseData && typeof responseData === 'object' && responseData.error) {
		return {
			code: responseData.error.code || 'SAP_ERROR',
			message: responseData.error.message?.value || responseData.error.message || 'Unknown SAP error',
			statusCode,
		};
	}

	return {
		code: 'SAP_ERROR',
		message: typeof responseData === 'string' ? responseData : `SAP request failed with status ${statusCode}`,
		statusCode,
	};
}
