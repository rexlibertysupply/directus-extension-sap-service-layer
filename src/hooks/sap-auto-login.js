import { ensureSession } from '../shared/session-pool.js';
import { encrypt, isEncrypted } from '../shared/crypto.js';

export default ({ action, filter }, { services, database, getSchema, env, logger }) => {
	// Encrypt sap_password before saving to database.
	// Shared logic for both users.update and users.create.
	function encryptSapPasswordPayload(payload, hookName) {
		if (payload.sap_password && !isEncrypted(payload.sap_password)) {
			if (!env.SECRET) {
				logger.error('SAP hook: Cannot encrypt sap_password — Directus SECRET env var is not set');
				throw new Error('Cannot encrypt SAP password: Directus SECRET is not configured.');
			}
			try {
				payload.sap_password = encrypt(payload.sap_password, env.SECRET);
				logger.debug(`SAP password encrypted before save (${hookName})`);
			} catch (err) {
				logger.error(`SAP hook: Failed to encrypt sap_password: ${err.message}`);
				throw new Error('Failed to encrypt SAP password before save.');
			}
		}
		return payload;
	}

	filter('users.update', (payload) => encryptSapPasswordPayload(payload, 'users.update'));
	filter('users.create', (payload) => encryptSapPasswordPayload(payload, 'users.create'));

	// Pre-warm the SAP session when a user authenticates with Directus.
	// Failure is intentionally non-blocking — a SAP outage must not prevent Directus login.
	action('auth.login', async ({ user }) => {
		if (!user) {
			logger.debug('SAP auto-login skipped: no user ID in auth.login payload');
			return;
		}

		try {
			const context = { services, database, getSchema, env };
			await ensureSession(user, context, logger);
			logger.info(`SAP session pre-warmed for user ${user}`);
		} catch (err) {
			logger.warn(`SAP auto-login error for user ${user}: ${err.message}`);
		}
	});
};
