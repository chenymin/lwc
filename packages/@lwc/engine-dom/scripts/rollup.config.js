/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

/* eslint-env node */

const path = require('path');

const { nodeResolve } = require('@rollup/plugin-node-resolve');
const replace = require('@rollup/plugin-replace');
const typescriptPlugin = require('@rollup/plugin-typescript');
const writeDistAndTypes = require('../../../../scripts/rollup/writeDistAndTypes');
const { version } = require('../package.json');

const banner = `/* proxy-compat-disable */`;
const footer = `/* version: ${version} */`;
const formats = ['es', 'cjs'];

module.exports = {
    input: path.resolve(__dirname, '../src/index.ts'),

    output: formats.map((format) => {
        return {
            file: `engine-dom${format === 'cjs' ? '.cjs' : ''}.js`,
            format,
            banner: banner,
            footer: footer,
        };
    }),

    plugins: [
        replace({
            preventAssignment: true,
            delimiters: ['', ''],
            values: {
                'from "@lwc/engine-impl"': `from "@lwc/engine-dom/src/renderer.ts"`,
                "from '@lwc/engine-impl'": `from "@lwc/engine-dom/src/renderer.ts"`,
            },
        }),
        nodeResolve({
            resolveOnly: [/^@lwc\//],
        }),
        typescriptPlugin({
            target: 'es2017',
            tsconfig: path.join(__dirname, '../tsconfig.json'),
        }),
        writeDistAndTypes(),
    ],

    onwarn({ code, message }) {
        if (code !== 'CIRCULAR_DEPENDENCY') {
            throw new Error(message);
        }
    },
};
