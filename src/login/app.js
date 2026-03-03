export default {
	id: 'sap-login',
	name: 'SAP Login',
	icon: 'login',
	description: 'Authenticate with SAP Service Layer and obtain a session ID.',
	// FIX: fallback to '(not set)' to avoid undefined text in flow builder
	overview: ({ serviceLayerUrl }) => [
		{ label: 'URL', text: serviceLayerUrl || '(not set)' },
	],
	options: [
		{
			field: 'serviceLayerUrl',
			name: 'Service Layer URL',
			type: 'string',
			meta: {
				width: 'full',
				interface: 'input',
				note: 'e.g. https://10.1.3.50:50000/b1s/v1 — leave blank to use SAP_SERVICE_LAYER_URL from .env',
			},
		},
		{
			field: 'companyDB',
			name: 'Company Database',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'input',
				note: 'Leave blank to use SAP_COMPANY_DB from .env',
			},
		},
		{
			field: 'userName',
			name: 'Username',
			type: 'string',
			required: true,
			meta: {
				width: 'half',
				interface: 'input',
			},
		},
		{
			field: 'password',
			name: 'Password',
			type: 'string',
			required: true,
			meta: {
				width: 'half',
				interface: 'input',
				masked: true,
			},
		},
	],
};
