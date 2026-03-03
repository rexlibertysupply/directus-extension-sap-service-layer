import js from '@eslint/js';

export default [
	js.configs.recommended,
	{
		languageOptions: {
			globals: {
				// Node.js built-ins
				Buffer: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				console: 'readonly',
				process: 'readonly',
				// Node 18+ globals
				fetch: 'readonly',
				AbortController: 'readonly',
			},
		},
		rules: {
			'no-unused-vars': 'error',
			'no-console': 'warn',
			'no-var': 'error',
			'prefer-const': 'error',
		},
	},
	{
		ignores: ['dist/', 'node_modules/'],
	},
];
