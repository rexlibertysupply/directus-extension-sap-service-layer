import { createSapClient } from '../shared/sap-client.js';
import { ensureSession, removeSession } from '../shared/session-pool.js';

export default {
	id: 'sap-request',
	handler: async ({ serviceLayerUrl, sessionId, method, entity, entityKey, queryParams, body, useSessionPool }, context) => {
		const { accountability, logger } = context;
		const userId = accountability?.user;

		const path = entityKey ? `${entity}('${entityKey}')` : entity;
		const params = typeof queryParams === 'string' ? JSON.parse(queryParams) : queryParams;
		const payload = typeof body === 'string' ? JSON.parse(body) : body;

		// Determine session: pool or explicit
		let resolvedUrl = serviceLayerUrl;
		let resolvedSessionId = sessionId;

		if (useSessionPool !== false && userId) {
			const session = await ensureSession(userId, context, logger);
			resolvedUrl = session.serviceLayerUrl;
			resolvedSessionId = session.sessionId;
		}

		let result = await executeRequest(resolvedUrl, resolvedSessionId, method, path, params, payload);

		// On 401, re-authenticate once and retry
		if (result.error?.statusCode === 401 && useSessionPool !== false && userId) {
			logger?.debug(`SAP 401 on ${method} ${path} — re-authenticating`);
			removeSession(userId);
			const session = await ensureSession(userId, context, logger);
			result = await executeRequest(session.serviceLayerUrl, session.sessionId, method, path, params, payload);
		}

		if (result.error) {
			throw new Error(`SAP ${method} ${path} failed: ${result.error.message}`);
		}

		return result.data;
	},
};

async function executeRequest(serviceLayerUrl, sessionId, method, path, params, payload) {
	const client = createSapClient({ serviceLayerUrl, sessionId });

	switch (method) {
		case 'GET':
			return client.get(path, params);
		case 'POST':
			return client.post(path, payload);
		case 'PATCH':
			return client.patch(path, payload);
		case 'DELETE':
			return client.delete(path);
		default:
			throw new Error(`Unsupported HTTP method: ${method}`);
	}
}
