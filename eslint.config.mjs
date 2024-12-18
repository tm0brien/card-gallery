import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
    baseDirectory: import.meta.dirname
})

const eslintConfig = [
    ...compat.config({
        extends: [
            'plugin:@next/next/recommended',
            'plugin:@typescript-eslint/recommended',
            'plugin:prettier/recommended'
        ],
        plugins: ['simple-import-sort'],
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
    })
]

export default eslintConfig
