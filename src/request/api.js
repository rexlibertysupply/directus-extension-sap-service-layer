import { createSapClient } from '../shared/sap-client.js';
import { ensureSession, removeSession } from '../shared/session-pool.js';
import { resolveServiceLayerUrl, resolveCompanyDB, buildSapClientOptions } from '../shared/helpers.js';

export default {
	id: 'sap-request',
	handler: async (
		{ serviceLayerUrl, method, entity, entityKey, queryParams, body, useSessionPool, companyDB, userName, password },
		context,
	) => {
		const { accountability, logger, env } = context;
		const userId = accountability?.user;

		const { path, params, payload } = parseOperationInputs({ entity, entityKey, queryParams, body });

		// Two modes:
		//   1. Pool mode (default) — useSessionPool is true → ensureSession() from user profile.
		//   2. Override mode — useSessionPool is false → inline login with provided credentials.
		const session = await resolveOperationSession({
			useSessionPool, userId, serviceLayerUrl, companyDB, userName, password, env, logger, context,
		});

		let result = await executeRequest(session.resolvedUrl, session.resolvedSessionId, method, path, params, payload, env);

		// On 401, re-authenticate once and retry — only for pool mode (session may have expired mid-flow).
		if (result.error?.statusCode === 401 && session.mode === 'pool') {
			logger?.debug(`SAP 401 on ${method} ${path} — re-authenticating`);
			removeSession(userId);
			const refreshed = await ensureSession(userId, context, logger);
			result = await executeRequest(refreshed.serviceLayerUrl, refreshed.sessionId, method, path, params, payload, env);
		}

		// For override mode, logout the ephemeral session after use.
		if (session.mode === 'override' && session.resolvedSessionId) {
			try {
				const client = createSapClient({ serviceLayerUrl: session.resolvedUrl, sessionId: session.resolvedSessionId, ...buildSapClientOptions(env) });
				await client.logout();
			} catch {
				logger?.debug('SAP override session logout failed (non-critical)');
			}
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

async function resolveOperationSession({ useSessionPool, userId, serviceLayerUrl, companyDB, userName, password, env, logger, context }) {
	// Mode 1: Pool — session managed automatically from user profile
	if (useSessionPool !== false && userId) {
		const session = await ensureSession(userId, context, logger);
		return { mode: 'pool', resolvedUrl: session.serviceLayerUrl, resolvedSessionId: session.sessionId };
	}

	// Mode 2: Override — inline login with provided credentials
	const resolvedUrl = resolveServiceLayerUrl(serviceLayerUrl, null, env, logger);
	if (!resolvedUrl) {
		throw new Error('No SAP Service Layer URL. Provide it in the operation options or set SAP_SERVICE_LAYER_URL environment variable.');
	}

	if (!userName || !password) {
		throw new Error('Session pool is disabled — SAP Username and Password are required.');
	}

	const resolvedCompanyDB = resolveCompanyDB(companyDB, null, env, logger);
	if (!resolvedCompanyDB) {
		throw new Error('No Company DB. Provide it in the operation options or set SAP_COMPANY_DB environment variable.');
	}

	logger?.debug('SAP Request: using override credentials for inline login');
	const client = createSapClient({ serviceLayerUrl: resolvedUrl, ...buildSapClientOptions(env) });
	const loginResult = await client.login(resolvedCompanyDB, userName, password);

	if (loginResult.error) {
		throw new Error(`SAP login failed: ${loginResult.error.message}`);
	}

	return {
		mode: 'override',
		resolvedUrl,
		resolvedSessionId: loginResult.data.SessionId,
	};
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
