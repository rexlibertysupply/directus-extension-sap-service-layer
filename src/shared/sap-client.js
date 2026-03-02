import https from 'node:https';

/**
 * Create a SAP Service Layer HTTP client.
 * Returns an object with get, post, patch methods that use the { data, error } pattern.
 */
export function createSapClient({ serviceLayerUrl, sessionId, rejectUnauthorized = false }) {
	const baseUrl = serviceLayerUrl.replace(/\/+$/, '');

	const agent = new https.Agent({ rejectUnauthorized });

	async function request(method, path, body = null) {
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

		const start = Date.now();

		try {
			const res = await fetch(url, options);
			const duration = Date.now() - start;

			if (res.status === 204) {
				return { data: { success: true }, error: null };
			}

			let responseData;
			const contentType = res.headers.get('content-type') || '';

			if (contentType.includes('application/json')) {
				responseData = await res.json();
			} else {
				responseData = await res.text();
			}

			if (!res.ok) {
				const sapError = parseSapError(responseData, res.status);
				return { data: null, error: sapError };
			}

			return { data: responseData, error: null };
		} catch (err) {
			return {
				data: null,
				error: {
					code: 'CONNECTION_ERROR',
					message: err.message,
					statusCode: 0,
				},
			};
		}
	}

	function buildQueryString(params) {
		if (!params || typeof params !== 'object') return '';

		const parts = [];
		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined && value !== null && value !== '') {
				const paramKey = key.startsWith('$') ? key : `$${key}`;
				parts.push(`${paramKey}=${encodeURIComponent(value)}`);
			}
		}

		return parts.length > 0 ? `?${parts.join('&')}` : '';
	}

	return {
		async get(entity, queryParams) {
			const qs = buildQueryString(queryParams);
			return request('GET', `${entity}${qs}`);
		},

		async post(entity, body) {
			return request('POST', entity, body);
		},

		async patch(entity, body) {
			return request('PATCH', entity, body);
		},

		async delete(entity) {
			return request('DELETE', entity);
		},

		async login(companyDB, userName, password) {
			return request('POST', 'Login', {
				CompanyDB: companyDB,
				UserName: userName,
				Password: password,
			});
		},

		async logout() {
			return request('POST', 'Logout');
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
