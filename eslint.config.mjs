import tsEslint from 'typescript-eslint';
import stylisticJs from '@stylistic/eslint-plugin-js';
import unusedImports from 'eslint-plugin-unused-imports';

// eslint "src/**/*.{ts,js,vue}" --fix
export default tsEslint.config(
    {
        ignores: ['**/*.d.ts', '**/*.test.ts']
    },
    ...tsEslint.configs.recommended,
    {
        plugins: { 'unused-imports': unusedImports, '@stylistic/js': stylisticJs },
        rules: {
            '@stylistic/js/quote-props': ['error', 'as-needed'],
            'unused-imports/no-unused-imports': 'warn',
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/no-duplicate-enum-values': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-this-alias': 'off',
            '@typescript-eslint/triple-slash-reference': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            quotes: [
                'error',
                'single',
                {
                    avoidEscape: true,
                    allowTemplateLiterals: true
                }
            ]
        },
    }
);