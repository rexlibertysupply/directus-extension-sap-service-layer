import { createSapClient } from './sap-client.js';
import { SESSION_TIMEOUT_MINUTES } from './constants.js';

/**
 * In-memory SAP session pool.
 * Keyed by Directus user ID → { sessionId, serviceLayerUrl, companyDB, userName, password, expiresAt }
 * Shared across all operations in the bundle (single dist/api.js).
 * Lost on Directus restart — re-authenticates transparently on next request.
 */
const sessionPool = new Map();

export function getSession(userId) {
	const entry = sessionPool.get(userId);
	if (!entry) return null;
	if (Date.now() > entry.expiresAt) {
		sessionPool.delete(userId);
		return null;
	}
	return entry;
}

export function setSession(userId, { sessionId, serviceLayerUrl, companyDB, userName, password }) {
	sessionPool.set(userId, {
		sessionId,
		serviceLayerUrl,
		companyDB,
		userName,
		password,
		expiresAt: Date.now() + (SESSION_TIMEOUT_MINUTES - 1) * 60 * 1000,
	});
}

export function removeSession(userId) {
	sessionPool.delete(userId);
}

/**
 * Read SAP credential fields from the Directus user profile.
 * Returns { serviceLayerUrl, companyDB, userName, password } or null if not configured.
 */
export async function getSapCredentials(userId, context) {
	const { services, database, getSchema } = context;
	const schema = await getSchema();
	const usersService = new services.UsersService({
		knex: database,
		schema,
	});

	const user = await usersService.readOne(userId, {
		fields: ['sap_service_layer_url', 'sap_company_db', 'sap_username', 'sap_password'],
	});

	if (!user.sap_service_layer_url || !user.sap_username || !user.sap_password) {
		return null;
	}

	return {
		serviceLayerUrl: user.sap_service_layer_url,
		companyDB: user.sap_company_db,
		userName: user.sap_username,
		password: user.sap_password,
	};
}

/**
 * Get a valid SAP session for the given user.
 * Returns cached session if still valid, otherwise authenticates and caches.
 */
export async function ensureSession(userId, context, logger) {
	const cached = getSession(userId);
	if (cached) return cached;

	const creds = await getSapCredentials(userId, context);
	if (!creds) {
		throw new Error('No SAP credentials configured on user profile. Set sap_service_layer_url, sap_company_db, sap_username, and sap_password fields.');
	}

	const client = createSapClient({ serviceLayerUrl: creds.serviceLayerUrl });
	const { data, error } = await client.login(creds.companyDB, creds.userName, creds.password);

	if (error) {
		throw new Error(`SAP auto-login failed: ${error.message}`);
	}

	logger?.debug(`SAP auto-login successful for user ${userId}`);

	const session = {
		sessionId: data.SessionId,
		serviceLayerUrl: creds.serviceLayerUrl,
		companyDB: creds.companyDB,
		userName: creds.userName,
		password: creds.password,
	};

	setSession(userId, session);
	return { ...session, sessionId: data.SessionId };
}
