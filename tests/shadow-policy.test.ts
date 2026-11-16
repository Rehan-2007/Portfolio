import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : /\.(tsx?|css)$/.test(path) ? [path] : []
  })
}

test('all world JSX casting and receiving flags are explicitly false or absent', () => {
  for (const path of sourceFiles('src/experience')) {
    const text = readFileSync(path, 'utf8')
    for (const match of text.matchAll(/\b(?:castShadow|receiveShadow)(?:=\{([^}]+)\})?(?=[\s/>])/g)) {
      assert.equal(match[1]?.trim(), 'false', `${path}: ${match[0]}`)
    }
    assert.doesNotMatch(text, /<ContactShadows|<AccumulativeShadows|<SSAO|<N8AO|new\s+\w*ShadowMaterial/)
    assert.doesNotMatch(text, /shadow-mapSize|shadow-camera-|shadow-normalBias|shadow-bias/)
  }
})

test('Canvas never enables the shadow map at a graphics quality level', () => {
  const source = readFileSync('src/experience/PhaseOneExperience.tsx', 'utf8')
  assert.match(source, /shadows=\{false\}/)
  assert.match(source, /gl\.shadowMap\.enabled\s*=\s*false/)
})

test('stand-in beacon poles and gem toppers are no longer mounted', () => {
  const source = readFileSync('src/experience/world/StationBeacons.tsx', 'utf8')
  assert.doesNotMatch(source, /octahedronGeometry|cylinderGeometry|makeLabelTexture/)
})
