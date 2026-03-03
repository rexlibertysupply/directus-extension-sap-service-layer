import { createSapClient } from '../shared/sap-client.js';
import { removeSession } from '../shared/session-pool.js';
import { resolveServiceLayerUrl, buildSapClientOptions } from '../shared/helpers.js';

export default {
	id: 'sap-logout',
	handler: async ({ serviceLayerUrl, sessionId }, context) => {
		const { env, logger } = context;

		const resolvedUrl = resolveServiceLayerUrl(serviceLayerUrl, null, env, logger);
		if (!resolvedUrl) {
			logger?.error('SAP Logout: No Service Layer URL provided and SAP_SERVICE_LAYER_URL env var is not set');
			throw new Error('No SAP Service Layer URL. Provide it in the operation options or set SAP_SERVICE_LAYER_URL environment variable.');
		}

		if (!sessionId) {
			logger?.error('SAP Logout: No session ID provided');
			throw new Error('SAP Logout requires a session ID.');
		}

		logger?.debug(`SAP Logout: Ending session at ${resolvedUrl}`);

		const client = createSapClient({ serviceLayerUrl: resolvedUrl, sessionId, ...buildSapClientOptions(env) });
		const { error } = await client.logout();

		if (error) {
			logger?.error(`SAP Logout failed: ${error.message} (code: ${error.code}, status: ${error.statusCode})`);
			throw new Error(`SAP Logout failed: ${error.message}`);
		}

		const userId = context?.accountability?.user;
		if (userId) {
			removeSession(userId);
		}

		logger?.debug('SAP Logout successful');
		return { success: true };
	},
};
