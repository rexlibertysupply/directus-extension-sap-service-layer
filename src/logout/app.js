export default {
	id: 'sap-logout',
	name: 'SAP Logout',
	icon: 'logout',
	description: 'End a SAP Service Layer session.',
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
			field: 'sessionId',
			name: 'Session ID',
			type: 'string',
			required: true,
			meta: {
				width: 'full',
				interface: 'input',
				note: 'Use {{$last.sessionId}} from a SAP Login step',
			},
		},
	],
};
