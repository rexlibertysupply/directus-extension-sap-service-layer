/**
 * Resolve a config value from the priority chain:
 * explicit > userField > env var
 * Private — used by resolveServiceLayerUrl and resolveCompanyDB.
 */
function resolveConfigValue(explicit, userField, envValue, envVarName, logger) {
	if (explicit) return explicit;
	if (userField) return userField;
	if (envValue) {
		logger?.debug(`Using ${envVarName} from environment`);
		return envValue;
	}
	return null;
}

/**
 * Resolve SAP Service Layer URL.
 * Priority: explicit value > user profile > SAP_SERVICE_LAYER_URL env var
 */
export function resolveServiceLayerUrl(explicit, userField, env, logger) {
	return resolveConfigValue(explicit, userField, env?.SAP_SERVICE_LAYER_URL, 'SAP_SERVICE_LAYER_URL', logger);
}

/**
 * Resolve SAP Company DB.
 * Priority: explicit value > user profile > SAP_COMPANY_DB env var
 */
export function resolveCompanyDB(explicit, userField, env, logger) {
	return resolveConfigValue(explicit, userField, env?.SAP_COMPANY_DB, 'SAP_COMPANY_DB', logger);
}

/**
 * Build createSapClient options from environment variables.
 * - SAP_REJECT_UNAUTHORIZED=true  → enforce TLS cert verification (default: false, for self-signed certs)
 * - SAP_REQUEST_TIMEOUT_MS=<ms>   → per-request timeout in milliseconds (default: 30000)
 */
export function buildSapClientOptions(env) {
	return {
		rejectUnauthorized: env?.SAP_REJECT_UNAUTHORIZED === 'true',
		timeoutMs: env?.SAP_REQUEST_TIMEOUT_MS ? Number(env.SAP_REQUEST_TIMEOUT_MS) : undefined,
	};
}
