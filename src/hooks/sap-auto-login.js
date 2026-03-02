import { getSapCredentials, setSession } from '../shared/session-pool.js';
import { createSapClient } from '../shared/sap-client.js';

export default ({ action }, { services, database, getSchema, logger }) => {
	action('auth.login', async ({ user }) => {
		try {
			const context = { services, database, getSchema };
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
