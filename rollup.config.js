import fs from 'fs'

import clear from 'rollup-plugin-clear'
import copy from 'rollup-plugin-copy-glob'
import gql from 'rollup-plugin-graphql-tag'
import typescript from 'rollup-plugin-typescript2'

import packageJson from './package.json'

export const external = id => !(id.startsWith('.') || id.startsWith('/'))

export default [
  {
    input: './src/index.ts',
    output: {
      file: './dist/index.cjs.js',
      format: 'cjs',
    },
    external,
    plugins: [
      clear({ targets: ['./dist'] }),
      {
        writeBundle: () => {
          delete packageJson.scripts

          fs.writeFileSync(
            './dist/package.json',
            JSON.stringify(
              {
                ...packageJson,
                main: 'index.cjs.js',
                module: 'index.js',
              },
              null,
              '  '
            )
          )
        },
      },
      copy([
        { files: '*.md', dest: 'dist' },
        { files: 'package-lock.json', dest: 'dist' },
        { files: 'src/directives.graphql', dest: 'dist' },
      ]),
      gql(),
      typescript(),
    ],
  },
  {
    input: './src/index.ts',
    output: {
      dir: './dist',
      format: 'esm',
      preserveModules: true,
      sourcemap: true,
    },
    treeshake: false,
    external,
    plugins: [
      gql(),
      typescript({
        tsconfigOverride: {
          compilerOptions: {
            declaration: true,
            sourceMap: true,
          },
        },
      }),
    ],
  },
]
