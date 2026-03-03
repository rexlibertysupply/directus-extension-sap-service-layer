import { createSapClient } from '../shared/sap-client.js';
import { ensureSession, removeSession } from '../shared/session-pool.js';
import { resolveServiceLayerUrl, buildSapClientOptions } from '../shared/helpers.js';

export default {
	id: 'sap-request',
	handler: async ({ serviceLayerUrl, sessionId, method, entity, entityKey, queryParams, body, useSessionPool }, context) => {
		const { accountability, logger, env } = context;
		const userId = accountability?.user;

		const { path, params, payload } = parseOperationInputs({ entity, entityKey, queryParams, body });

		// Two modes:
		//   Pool mode (useSessionPool: true, default) — session managed automatically from user profile.
		//   Explicit mode (useSessionPool: false) — caller provides serviceLayerUrl + sessionId directly.
		// Falls back to explicit mode when there is no authenticated Directus user (e.g. API key context).
		const { resolvedUrl, resolvedSessionId } = await resolveOperationSession({
			useSessionPool, userId, serviceLayerUrl, sessionId, env, logger, context,
		});

		let result = await executeRequest(resolvedUrl, resolvedSessionId, method, path, params, payload, env);

		// On 401, re-authenticate once and retry (session may have expired mid-flow).
		if (result.error?.statusCode === 401 && useSessionPool !== false && userId) {
			logger?.debug(`SAP 401 on ${method} ${path} — re-authenticating`);
			removeSession(userId);
			const session = await ensureSession(userId, context, logger);
			result = await executeRequest(session.serviceLayerUrl, session.sessionId, method, path, params, payload, env);
		}

		if (result.error) {
			logger?.error(`SAP ${method} ${path} failed: ${result.error.message} (code: ${result.error.code}, status: ${result.error.statusCode})`);
			throw new Error(`SAP ${method} ${path} failed: ${result.error.message}`);
		}

		return result.data;
	},
};

function parseOperationInputs({ entity, entityKey, queryParams, body }) {
	// Escape single quotes in entityKey to prevent OData path injection: O'Brien → O''Brien
	const safeKey = entityKey ? entityKey.replace(/'/g, "''") : null;
	const path = safeKey ? `${entity}('${safeKey}')` : entity;

	let params;
	try {
		params = typeof queryParams === 'string' ? JSON.parse(queryParams) : queryParams;
	} catch (err) {
		throw new Error(`Invalid JSON in queryParams: ${err.message}`);
	}

	let payload;
	try {
		payload = typeof body === 'string' ? JSON.parse(body) : body;
	} catch (err) {
		throw new Error(`Invalid JSON in body: ${err.message}`);
	}

	return { path, params, payload };
}

async function resolveOperationSession({ useSessionPool, userId, serviceLayerUrl, sessionId, env, logger, context }) {
	if (useSessionPool !== false && userId) {
		const session = await ensureSession(userId, context, logger);
		return { resolvedUrl: session.serviceLayerUrl, resolvedSessionId: session.sessionId };
	}

	const resolvedUrl = resolveServiceLayerUrl(serviceLayerUrl, null, env, logger);
	if (!resolvedUrl) {
		logger?.error('SAP Request: No Service Layer URL provided and SAP_SERVICE_LAYER_URL env var is not set');
		throw new Error('No SAP Service Layer URL. Provide it in the operation options or set SAP_SERVICE_LAYER_URL environment variable.');
	}

	if (!sessionId) {
		logger?.error('SAP Request: No session ID provided and session pool is disabled');
		throw new Error('No SAP session ID. Either enable "Use Session Pool" or provide a session ID from a SAP Login step.');
	}

	return { resolvedUrl, resolvedSessionId: sessionId };
}

async function executeRequest(serviceLayerUrl, sessionId, method, path, params, payload, env) {
	const client = createSapClient({ serviceLayerUrl, sessionId, ...buildSapClientOptions(env) });

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
