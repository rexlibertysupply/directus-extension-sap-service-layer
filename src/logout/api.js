import { createSapClient } from '../shared/sap-client.js';
import { removeSession } from '../shared/session-pool.js';

export default {
	id: 'sap-logout',
	handler: async ({ serviceLayerUrl, sessionId }, context) => {
		const client = createSapClient({ serviceLayerUrl, sessionId });

		const { error } = await client.logout();

		if (error) {
			throw new Error(`SAP Logout failed: ${error.message}`);
		}

		const userId = context?.accountability?.user;
		if (userId) {
			removeSession(userId);
		}

		return { success: true };
	},
};
