export default {
	id: 'sap-request',
	name: 'SAP Request',
	icon: 'swap_horiz',
	description: 'Send a GET, POST, PATCH, or DELETE request to any SAP Service Layer entity.',
	overview: ({ method, entity }) => [
		{ label: 'Method', text: method ?? 'Not set' },
		{ label: 'Entity', text: entity ?? 'Not set' },
	],
	options: [
		{
			field: 'useSessionPool',
			name: 'Use Session Pool',
			type: 'boolean',
			schema: {
				default_value: true,
			},
			meta: {
				width: 'full',
				interface: 'boolean',
				note: 'When enabled, session is managed automatically using your SAP credentials from your user profile. Disable to provide credentials below.',
			},
		},
		{
			field: 'serviceLayerUrl',
			name: 'Service Layer URL',
			type: 'string',
			meta: {
				width: 'full',
				interface: 'input',
				note: 'e.g. https://10.1.3.50:50000/b1s/v1 — leave blank to use SAP_SERVICE_LAYER_URL env var.',
				conditions: [
					{
						rule: { _and: [{ useSessionPool: { _eq: true } }] },
						hidden: true,
					},
				],
			},
		},
		{
			field: 'companyDB',
			name: 'Company DB',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'input',
				note: 'Leave blank to use SAP_COMPANY_DB env var.',
				conditions: [
					{
						rule: { _and: [{ useSessionPool: { _eq: true } }] },
						hidden: true,
					},
				],
			},
		},
		{
			field: 'userName',
			name: 'SAP Username',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'input',
				conditions: [
					{
						rule: { _and: [{ useSessionPool: { _eq: true } }] },
						hidden: true,
					},
				],
			},
		},
		{
			field: 'password',
			name: 'SAP Password',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'input',
				options: {
					masked: true,
				},
				conditions: [
					{
						rule: { _and: [{ useSessionPool: { _eq: true } }] },
						hidden: true,
					},
				],
			},
		},
		{
			field: 'method',
			name: 'HTTP Method',
			type: 'string',
			required: true,
			meta: {
				width: 'half',
				interface: 'select-dropdown',
				options: {
					choices: [
						{ text: 'GET', value: 'GET' },
						{ text: 'POST', value: 'POST' },
						{ text: 'PATCH', value: 'PATCH' },
						{ text: 'DELETE', value: 'DELETE' },
					],
				},
			},
		},
		{
			field: 'entity',
			name: 'Entity',
			type: 'string',
			required: true,
			meta: {
				width: 'half',
				interface: 'input',
				note: 'e.g. BusinessPartners, Items, PurchaseOrders',
			},
		},
		{
			field: 'entityKey',
			name: 'Entity Key',
			type: 'string',
			meta: {
				width: 'full',
				interface: 'input',
				note: "Optional. e.g. C001 for BusinessPartners('C001')",
			},
		},
		{
			field: 'queryParams',
			name: 'Query Parameters',
			type: 'json',
			meta: {
				width: 'full',
				interface: 'input-code',
				options: {
					language: 'json',
					placeholder: '{ "$filter": "CardType eq \'S\'", "$top": 50 }',
				},
				note: 'OData params: $filter, $select, $top, $skip, $orderby',
			},
		},
		{
			field: 'body',
			name: 'Request Body',
			type: 'json',
			meta: {
				width: 'full',
				interface: 'input-code',
				options: {
					language: 'json',
					placeholder: '{ "CardCode": "C001", "CardName": "Test Customer" }',
				},
				note: 'For POST and PATCH requests',
			},
		},
	],
};
