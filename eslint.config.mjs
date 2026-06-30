import nextPlugin from '@next/eslint-plugin-next'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tseslint from 'typescript-eslint'

const eslintConfig = [
    {
        ignores: ['.next/**', 'node_modules/**', 'out/**', 'public/**', 'next-env.d.ts']
    },

    // Next.js recommended rules (native flat config)
    nextPlugin.configs.recommended,

    // @typescript-eslint recommended (sets the TS parser + rules)
    ...tseslint.configs.recommended,

    // prettier-eslint integration (must come after other configs)
    prettierRecommended,

    {
        plugins: {
            'simple-import-sort': simpleImportSort
        },
        rules: {
            // Prettier customization
            'prettier/prettier': [
                'error',
                {
                    bracketSpacing: true,
                    jsxBracketSameLine: false,
                    printWidth: 120,
                    semi: false,
                    singleQuote: true,
                    tabWidth: 4,
                    arrowParens: 'avoid',
                    trailingComma: 'none'
                }
            ],

            // TypeScript ESLint rules
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error'
        }
    }
]

export default eslintConfig
