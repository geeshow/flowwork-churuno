import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginBabel } from '@rsbuild/plugin-babel';
import { pluginStyledComponents } from '@rsbuild/plugin-styled-components';
import { pluginSass } from '@rsbuild/plugin-sass';
import { pluginNodePolyfill } from '@rsbuild/plugin-node-polyfill';
import { pluginRemoteImages } from './plugins/remote-images/index.mjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const remoteImageDomains = (process.env.BRUNO_REMOTE_IMAGE_DOMAINS || 'd3icksk7srk4uh.cloudfront.net')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [
    pluginNodePolyfill(),
    pluginReact(),
    pluginStyledComponents(),
    pluginSass(),
    pluginBabel({
      include: /\.(?:js|jsx|tsx)$/,
      babelLoaderOptions(opts) {
        // Resolve from this file, not the process cwd — the plugin may be nested
        // under packages/bruno-app/node_modules while the dev server runs from the repo root.
        opts.plugins?.unshift(require.resolve('babel-plugin-react-compiler'));
      }
    }),
    pluginRemoteImages({
      domains: remoteImageDomains,
      include: [/\.md$/]
    })
  ],
  source: {
    tsconfigPath: './jsconfig.json', // Specifies the path to the JavaScript/TypeScript configuration file,
    define: {
      // API server for static deployments — see web-ipc/server-api.js
      'process.env.BRUNO_WEB_SERVER_URL': JSON.stringify(process.env.BRUNO_WEB_SERVER_URL || '')
    },
    // @usebruno/filestore's worker/redaction modules import node builtins that
    // the web build never executes — resolve them to inert browser stubs.
    alias: {
      'node:worker_threads': './src/web-ipc/stubs/worker-threads.js',
      'worker_threads$': './src/web-ipc/stubs/worker-threads.js',
      'node:crypto': './src/web-ipc/stubs/node-crypto.js',
      'node:path': 'path',
      // bruno-lang requires ohm-js via CJS; the ESM build the bundler would
      // otherwise pick has no default-interop `grammar` property.
      'ohm-js$': 'ohm-js/index.js',
      // @tippyjs/react reads `children.ref`, which React 19 deprecated in
      // favor of `children.props.ref` — route to the vendored, fixed copy.
      '@tippyjs/react$': './src/vendor/tippyjs-react/index.js'
    },
    exclude: [
      '**/test-utils/**',
      '**/*.test.*',
      '**/*.spec.*'
    ]
  },
  html: {
    title: 'Flowwork',
    // Flowwork mark (public/favicon.*): SVG for browsers that take it, .ico for the rest.
    // Declared as tags rather than html.favicon so both get the assetPrefix.
    tags: [
      { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: 'favicon.svg' } },
      { tag: 'link', attrs: { rel: 'alternate icon', href: 'favicon.ico' } }
    ]
  },
  output: {
    // A static host serves the app under a sub-path (GitHub Pages: /<repo>/).
    assetPrefix: process.env.BRUNO_WEB_ASSET_PREFIX || '/'
  },
  server: {
    // 3000 is rsbuild's own default; reading PORT lets a harness that assigns a
    // free port (preview tooling, CI) put the dev server where it expects it.
    port: Number(process.env.PORT) || 3000
  },
  tools: {
    rspack: {
      module: {
        parser: {
          javascript: {
            // This loads the JavaScript contents from a library along with the main JavaScript bundle.
            dynamicImportMode: "eager",
          },
        }
      },
      ignoreWarnings: [
        (warning) =>  warning.message.includes('Critical dependency: the request of a dependency is an expression') && warning?.moduleDescriptor?.name?.includes('flow-parser')
      ],
      optimization: {
        splitChunks: {
          cacheGroups: {
            // CodeMirror's modes/addons/themes + codemirror-graphql are all
            // required upfront (pages/Bruno/index.js) but rarely change —
            // pulling them into their own initial chunk lets the browser
            // fetch it in parallel with the main bundle instead of inflating
            // one monolithic file.
            codemirror: {
              test: /[\\/]node_modules[\\/]codemirror(-.*)?[\\/]/,
              name: 'lib-codemirror',
              chunks: 'all',
              priority: 10
            }
          }
        }
      }
    },
  }
});
``