import { getSapCredentials, setSession } from '../shared/session-pool.js';
import { createSapClient } from '../shared/sap-client.js';
import { encrypt, isEncrypted } from '../shared/crypto.js';

export default ({ action, filter }, { services, database, getSchema, env, logger }) => {
	// Encrypt sap_password before saving to database
	filter('users.update', (payload) => {
		if (payload.sap_password && !isEncrypted(payload.sap_password)) {
			payload.sap_password = encrypt(payload.sap_password, env.SECRET);
			logger.debug('SAP password encrypted before save');
		}
		return payload;
	});

	filter('users.create', (payload) => {
		if (payload.sap_password && !isEncrypted(payload.sap_password)) {
			payload.sap_password = encrypt(payload.sap_password, env.SECRET);
			logger.debug('SAP password encrypted before save');
		}
		return payload;
	});

	// Auto-login to SAP when user authenticates with Directus
	action('auth.login', async ({ user }) => {
		try {
			const context = { services, database, getSchema, env };
			const creds = await getSapCredentials(user, context);

			if (!creds) {
				logger.debug(`SAP auto-login skipped for user ${user}: no SAP credentials configured`);
				return;
			}

			const client = createSapClient({ serviceLayerUrl: creds.serviceLayerUrl });
			const { data, error } = await client.login(creds.companyDB, creds.userName, creds.password);

			if (error) {
				logger.warn(`SAP auto-login failed for user ${user}: ${error.message}`);
				return;
			}

			setSession(user, {
				sessionId: data.SessionId,
				serviceLayerUrl: creds.serviceLayerUrl,
				companyDB: creds.companyDB,
				userName: creds.userName,
				password: creds.password,
			});

			logger.debug(`SAP auto-login successful for user ${user} (session timeout: ${data.SessionTimeout}min)`);
		} catch (err) {
			logger.warn(`SAP auto-login error for user ${user}: ${err.message}`);
		}
	});
};
