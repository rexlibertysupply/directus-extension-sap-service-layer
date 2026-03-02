export default {
	id: 'sap-login',
	name: 'SAP Login',
	icon: 'login',
	description: 'Authenticate with SAP Service Layer and obtain a session ID.',
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
			field: 'companyDB',
			name: 'Company Database',
			type: 'string',
			required: true,
			meta: {
				width: 'half',
				interface: 'input',
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
