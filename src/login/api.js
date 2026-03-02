import { createSapClient } from '../shared/sap-client.js';
import { setSession } from '../shared/session-pool.js';

export default {
	id: 'sap-login',
	handler: async ({ serviceLayerUrl, companyDB, userName, password }, context) => {
		const client = createSapClient({ serviceLayerUrl });

		const { data, error } = await client.login(companyDB, userName, password);

		if (error) {
			throw new Error(`SAP Login failed: ${error.message}`);
		}

		const userId = context?.accountability?.user;
		if (userId) {
			setSession(userId, {
				sessionId: data.SessionId,
				serviceLayerUrl,
				companyDB,
				userName,
				password,
			});
		}

		return {
			sessionId: data.SessionId,
			sessionTimeout: data.SessionTimeout,
		};
	},
};
