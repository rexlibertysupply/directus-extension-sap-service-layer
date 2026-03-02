export default {
	id: 'sap-logout',
	name: 'SAP Logout',
	icon: 'logout',
	description: 'End a SAP Service Layer session.',
	overview: ({ serviceLayerUrl }) => [
		{ label: 'URL', text: serviceLayerUrl },
	],
	options: [
		{
			field: 'serviceLayerUrl',
			name: 'Service Layer URL',
			type: 'string',
			required: true,
			meta: {
				width: 'full',
				interface: 'input',
				note: 'e.g. https://10.1.3.50:50000/b1s/v1',
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
