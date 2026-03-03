import { createSapClient } from './sap-client.js';
import { SESSION_TIMEOUT_MINUTES } from './constants.js';
import { decrypt } from './crypto.js';
import { resolveServiceLayerUrl, resolveCompanyDB, buildSapClientOptions } from './helpers.js';

/**
 * In-memory SAP session pool.
 * Keyed by Directus user ID → { sessionId, serviceLayerUrl, companyDB, userName, expiresAt }
 * Passwords are NOT stored — only used transiently during login then discarded.
 * Shared across all operations in the bundle (single dist/api.js).
 * Lost on Directus restart — re-authenticates transparently on next request.
 */
const sessionPool = new Map();

// Tracks in-flight login promises to prevent race condition on concurrent requests.
const inflightLogins = new Map();

// Periodic cleanup of expired entries to prevent unbounded pool growth.
setInterval(() => {
	const now = Date.now();
	for (const [userId, session] of sessionPool) {
		if (now > session.expiresAt) sessionPool.delete(userId);
	}
}, 10 * 60 * 1000).unref?.();

/**
 * Return a session entry if it exists and has not expired.
 * Does not mutate the pool — expired entry cleanup is handled by the periodic sweep.
 */
export function getSession(userId) {
	const entry = sessionPool.get(userId);
	if (!entry) return null;
	if (Date.now() > entry.expiresAt) return null;
	return entry;
}

/**
 * Store a new session entry for the given user.
 * Password is NOT accepted here — store only what is needed for requests.
 * sessionTimeout is the value SAP returned at login (minutes); falls back to SESSION_TIMEOUT_MINUTES.
 */
export function setSession(userId, { sessionId, serviceLayerUrl, companyDB, userName, sessionTimeout }) {
	const timeoutMinutes = sessionTimeout || SESSION_TIMEOUT_MINUTES;
	sessionPool.set(userId, {
		sessionId,
		serviceLayerUrl,
		companyDB,
		userName,
		expiresAt: Date.now() + (timeoutMinutes - 1) * 60 * 1000,
	});
}

export function removeSession(userId) {
	sessionPool.delete(userId);
}

/**
 * Read SAP credential fields from the Directus user profile, with env var fallbacks.
 * Makes a DB query — returns { serviceLayerUrl, companyDB, userName, password } or null if not configured.
 */
export async function fetchSapCredentials(userId, context, logger) {
	const { services, database, getSchema, env } = context;

	if (!env?.SECRET) {
		logger?.error('SAP session pool: Directus SECRET env var is not set — cannot decrypt SAP passwords');
		throw new Error('Directus SECRET env var is not set. Required for SAP password decryption.');
	}

	const schema = await getSchema();
	const usersService = new services.UsersService({
		knex: database,
		schema,
	});

	let user;
	try {
		user = await usersService.readOne(userId, {
			fields: ['sap_service_layer_url', 'sap_company_db', 'sap_username', 'sap_password'],
		});
	} catch (err) {
		logger?.error(`SAP session pool: Failed to read user ${userId} profile: ${err.message}`);
		throw new Error(`Failed to read SAP credentials from user profile: ${err.message}`);
	}

	if (!user.sap_username || !user.sap_password) {
		logger?.debug(`SAP session pool: User ${userId} has no sap_username or sap_password set`);
		return null;
	}

	const serviceLayerUrl = resolveServiceLayerUrl(null, user.sap_service_layer_url, env, logger);
	const companyDB = resolveCompanyDB(null, user.sap_company_db, env, logger);

	if (!serviceLayerUrl) {
		logger?.error('SAP session pool: No Service Layer URL configured. Set sap_service_layer_url on user profile or SAP_SERVICE_LAYER_URL in .env');
		throw new Error('No SAP Service Layer URL configured. Set sap_service_layer_url on user profile or SAP_SERVICE_LAYER_URL environment variable.');
	}

	if (!companyDB) {
		logger?.error('SAP session pool: No Company DB configured. Set sap_company_db on user profile or SAP_COMPANY_DB in .env');
		throw new Error('No SAP Company DB configured. Set sap_company_db on user profile or SAP_COMPANY_DB environment variable.');
	}

	let password;
	try {
		password = decrypt(user.sap_password, env.SECRET);
	} catch (err) {
		logger?.error(`SAP session pool: Failed to decrypt SAP password for user ${userId}: ${err.message}`);
		throw new Error('Failed to decrypt SAP password. The password may be corrupted or the Directus SECRET may have changed.');
	}

	return {
		serviceLayerUrl,
		companyDB,
		userName: user.sap_username,
		password,
	};
}

/**
 * Get a valid SAP session for the given user.
 * Returns cached session if still valid, otherwise authenticates and caches.
 * In-flight deduplication prevents concurrent logins for the same user.
 * The returned object never includes password or expiry metadata.
 */
export async function ensureSession(userId, context, logger) {
	const cached = getSession(userId);
	if (cached) return toPublicSession(cached);

	// If a login is already in progress for this user, wait for it instead of racing.
	if (inflightLogins.has(userId)) {
		return inflightLogins.get(userId);
	}

	const promise = (async () => {
		// Re-check after awaiting — another coroutine may have completed login.
		const rechecked = getSession(userId);
		if (rechecked) return toPublicSession(rechecked);

		logger?.debug(`SAP session pool: No cached session for user ${userId}, authenticating...`);

		const creds = await fetchSapCredentials(userId, context, logger);
		if (!creds) {
			throw new Error('No SAP credentials configured. Set sap_username and sap_password on user profile, and either sap_service_layer_url/sap_company_db on profile or SAP_SERVICE_LAYER_URL/SAP_COMPANY_DB in .env');
		}

		const client = createSapClient({ serviceLayerUrl: creds.serviceLayerUrl, ...buildSapClientOptions(context.env) });
		const { data, error } = await client.login(creds.companyDB, creds.userName, creds.password);

		if (error) {
			logger?.error(`SAP session pool: Login failed for user ${userId} at ${creds.serviceLayerUrl}: ${error.message} (code: ${error.code}, status: ${error.statusCode})`);
			throw new Error(`SAP auto-login failed for ${creds.userName}@${creds.companyDB}: ${error.message}`);
		}

		logger?.debug(`SAP session pool: Login successful for user ${userId} (session timeout: ${data.SessionTimeout}min)`);

		setSession(userId, {
			sessionId: data.SessionId,
			serviceLayerUrl: creds.serviceLayerUrl,
			companyDB: creds.companyDB,
			userName: creds.userName,
			sessionTimeout: data.SessionTimeout,
		});

		return toPublicSession(getSession(userId));
	})().finally(() => inflightLogins.delete(userId));

	inflightLogins.set(userId, promise);
	return promise;
}

/**
 * Strip sensitive and internal fields before returning a session to callers.
 */
function toPublicSession(session) {
	return {
		sessionId: session.sessionId,
		serviceLayerUrl: session.serviceLayerUrl,
		companyDB: session.companyDB,
	};
}
