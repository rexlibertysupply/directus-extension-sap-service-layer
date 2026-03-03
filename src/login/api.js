import { createSapClient } from '../shared/sap-client.js';
import { setSession } from '../shared/session-pool.js';
import { resolveServiceLayerUrl, resolveCompanyDB, buildSapClientOptions } from '../shared/helpers.js';

export default {
	id: 'sap-login',
	handler: async ({ serviceLayerUrl, companyDB, userName, password }, context) => {
		const { env, logger } = context;

		const resolvedUrl = resolveServiceLayerUrl(serviceLayerUrl, null, env, logger);
		if (!resolvedUrl) {
			logger?.error('SAP Login: No Service Layer URL provided and SAP_SERVICE_LAYER_URL env var is not set');
			throw new Error('No SAP Service Layer URL. Provide it in the operation options or set SAP_SERVICE_LAYER_URL environment variable.');
		}

		const resolvedDB = resolveCompanyDB(companyDB, null, env, logger);
		if (!resolvedDB) {
			logger?.error('SAP Login: No Company DB provided and SAP_COMPANY_DB env var is not set');
			throw new Error('No SAP Company DB. Provide it in the operation options or set SAP_COMPANY_DB environment variable.');
		}

		if (!userName || !password) {
			logger?.error('SAP Login: Username or password not provided');
			throw new Error('SAP Login requires userName and password.');
		}

		logger?.debug(`SAP Login: Attempting login at ${resolvedUrl} (DB: ${resolvedDB})`);

		const client = createSapClient({ serviceLayerUrl: resolvedUrl, ...buildSapClientOptions(env) });
		const { data, error } = await client.login(resolvedDB, userName, password);

		if (error) {
			logger?.error(`SAP Login failed at ${resolvedUrl}: ${error.message} (code: ${error.code}, status: ${error.statusCode})`);
			throw new Error(`SAP Login failed: ${error.message}`);
		}

		logger?.debug(`SAP Login successful at ${resolvedUrl} (session timeout: ${data.SessionTimeout}min)`);

		const userId = context?.accountability?.user;
		if (userId) {
			setSession(userId, {
				sessionId: data.SessionId,
				serviceLayerUrl: resolvedUrl,
				companyDB: resolvedDB,
				userName,
				sessionTimeout: data.SessionTimeout,
			});
		}

		return {
			sessionId: data.SessionId,
			sessionTimeout: data.SessionTimeout,
		};
	},
};
