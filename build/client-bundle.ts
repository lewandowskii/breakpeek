/** Standalone tsdown preset for the Breakpeek Host and browser artifacts. */

import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isBuiltin } from 'node:module'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'lightningcss'
import type { UserConfig } from 'tsdown'

const PACKAGE_ID = '@runnerzhang/dsh-client-ui-breakpeek'
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const PACKAGE_MANIFEST = JSON.parse(
  readFileSync(resolve(PACKAGE_ROOT, 'package.json'), 'utf8'),
) as PackageManifest
const TYPES_MARKER = `${sep}lib${sep}types${sep}`
const CSS_VIRTUAL_PREFIX = '\0breakpeek-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

const CLIENT_EXTERNALS = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-runtime/client',
  ...optionalStringArray(PACKAGE_MANIFEST.dsh?.client?.external),
])

interface PackageManifest {
  readonly name?: string
  readonly dependencies?: Record<string, string>
  readonly peerDependencies?: Record<string, string>
  readonly optionalDependencies?: Record<string, string>
  readonly dsh?: { readonly client?: { readonly external?: unknown } }
}

type BuildFace = 'host' | 'client' | undefined
type BuildFaceConfig = (inlineConfig: Pick<UserConfig, 'env'>) => UserConfig[]

/**
 * Build Breakpeek's Node plugin and lazy browser module from package-local inputs.
 * @param id - package identifier registered with the browser module loader.
 * @param libEntry - emitted TypeScript entries for the Node artifacts.
 * @returns a build-face-aware tsdown configuration.
 */
export function clientBundle(id: string, libEntry: readonly string[]): BuildFaceConfig {
  if (id !== PACKAGE_ID || PACKAGE_MANIFEST.name !== id) {
    throw new Error(`breakpeek build: expected package id ${PACKAGE_ID}, received ${id}`)
  }
  const node = nodeConfig(id, libEntry)
  return ({ env }) => {
    const face = buildFace(env?.DSH_BUILD_FACE)
    if (face === 'host') return [{ entry: '' }]
    const clientEntry = face === 'client' ? 'lib/types/client/index.js' : 'src/client/index.ts'
    return [node, browserConfig(id, clientEntry)]
  }
}

function buildFace(value: unknown): BuildFace {
  if (value === undefined || value === 'host' || value === 'client') return value
  throw new Error(`breakpeek build: DSH_BUILD_FACE must be host or client, received ${String(value)}`)
}

function nodeConfig(id: string, entries: readonly string[]): UserConfig {
  const production = productionExternals()
  const isProductionDependency = (specifier: string): boolean =>
    production.some(pattern => pattern.test(specifier))
  return {
    name: id,
    entry: [...entries],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    deps: {
      neverBundle: isProductionDependency,
      alwaysBundle: specifier => !isBuiltin(specifier) && !isProductionDependency(specifier),
    },
  }
}

function productionExternals(): readonly RegExp[] {
  const names = new Set([
    ...Object.keys(PACKAGE_MANIFEST.dependencies ?? {}),
    ...Object.keys(PACKAGE_MANIFEST.peerDependencies ?? {}),
    ...Object.keys(PACKAGE_MANIFEST.optionalDependencies ?? {}),
  ])
  return [...names].sort().map(name => new RegExp(`^${escapeRegExp(name)}(/|$)`))
}

function browserConfig(id: string, entry: string): UserConfig {
  const isExternal = (specifier: string): boolean => CLIENT_EXTERNALS.has(specifier)
  return {
    name: `${id}/client`,
    entry: { client: entry },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: isExternal,
      alwaysBundle: specifier => !isExternal(specifier),
    },
    define: {
      ...clientEnvironmentDefines(process.env),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    plugins: [{
      name: 'breakpeek-client-bundle-purity',
      resolveId(source: string) {
        if (!source.startsWith('@deepseek-ai/') || isExternal(source)) return null
        if (/^@deepseek-ai\/(cosmokit|schemastery)(\/|$)/.test(source)) return null
        if (/^@deepseek-ai\/dsh-(host-apiproxy|file-reference|session|llm|tools|brand)(\/|$)/.test(source)) return null
        if (/^@deepseek-ai\/dsh-[a-z0-9]+(?:-[a-z0-9]+)*\/remote$/.test(source)) return null
        throw new Error(
          `breakpeek client bundle: ${source} is neither a shared client module nor an inline-safe wire module`,
        )
      },
    }, {
      name: 'breakpeek-css-modules-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.module.css')) return null
        const file = importer === undefined ? source : sourceAssetPath(source, importer)
        return CSS_VIRTUAL_PREFIX + file + CSS_VIRTUAL_SUFFIX
      },
      async load(virtualId: string) {
        if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
        const file = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        this.addWatchFile(file)
        const result = transform({
          filename: file,
          code: await readFile(file),
          cssModules: { pattern: '[hash]_[local]' },
          minify: true,
        })
        const classMap: Record<string, string> = {}
        for (const [local, cssExport] of Object.entries(result.exports ?? {}).sort(([left], [right]) =>
          left.localeCompare(right))) {
          classMap[local] = cssExport.name
        }
        return styleInjectionModule(id, file, result.code.toString(), classMap)
      },
    }],
    outputOptions: {
      entryFileNames: 'client.js',
      sourcemapPathTransform: browserSourcePath,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  }
}

function optionalStringArray(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new Error('breakpeek build: dsh.client.external must be a string array')
  }
  return value as string[]
}

function clientEnvironmentDefines(environment: NodeJS.ProcessEnv): Record<string, string> {
  const defines: Record<string, string> = { 'process.env': '{}' }
  for (const [name, value] of Object.entries(environment)) {
    if (!name.startsWith('DSH_CLIENT_') || value === undefined) continue
    defines[`process.env.${name}`] = JSON.stringify(value)
  }
  return defines
}

function styleInjectionModule(
  id: string,
  file: string,
  css: string,
  classMap: Readonly<Record<string, string>>,
): string {
  return [
    `const css = ${JSON.stringify(css)};`,
    `const tagId = ${JSON.stringify(`${id}/${basename(file)}`)};`,
    "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
    "  const tag = document.createElement('style');",
    `  tag.dataset.plugin = ${JSON.stringify(id)};`,
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    '  document.head.appendChild(tag);',
    '}',
    `export default ${JSON.stringify(classMap)};`,
  ].join('\n')
}

function sourceAssetPath(source: string, importer: string): string {
  const emitted = resolve(dirname(importer), source)
  if (existsSync(emitted)) return emitted
  const boundary = emitted.indexOf(TYPES_MARKER)
  if (boundary < 0) return emitted
  return resolve(emitted.slice(0, boundary), 'src', emitted.slice(boundary + TYPES_MARKER.length))
}

function browserSourcePath(source: string, sourcemapPath: string): string {
  if (!source.startsWith('.')) return source
  const physicalSource = resolve(dirname(sourcemapPath), source)
  return relative(dirname(sourcemapPath), physicalSource).split(sep).join('/')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
