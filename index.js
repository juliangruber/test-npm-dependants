'use strict'

const dependants = require('npm-dependants')
const fetch = require('node-fetch')
const semver = require('semver')
const { tmpdir } = require('os')
const { promises: fs } = require('fs')
const { promisify } = require('util')
const { spawn } = require('child_process')
const { join } = require('path')
const Spinnies = require('spinnies')
const fetchPackageSource = require('fetch-package-source')

const run = async (dir, cmd) => {
  const segs = cmd.split(' ')
  const ps = spawn(segs[0], segs.slice(1), { cwd: dir })
  await promisify(ps.once.bind(ps))('exit')
}

const main = async () => {
  const root = {
    name: process.argv[2],
    version: process.argv[3]
  }
  if (!root.name || !root.version) {
    console.error('Usage: test-npm-dependants NAME VERSION')
  }
  const spinnies = new Spinnies()
  const iterator = dependants(root.name)

  await Promise.all(
    Array(5)
      .fill()
      .map(async () => {
        for await (const dependant of iterator) {
          spinnies.add(dependant, {
            text: `[${dependant}] Loading package information`
          })
          const res = await fetch(`https://registry.npmjs.org/${dependant}`)
          const body = await res.json()
          const pkg = body.versions[body['dist-tags'].latest]
          if (!pkg.repository) {
            spinnies.fail(pkg.name, { text: `[${pkg.name}] No repository set` })
            continue
          }
          const allDependencies = {
            ...pkg.devDependencies,
            ...pkg.dependencies
          }
          const range = allDependencies[root.name]
          if (!range || !semver.satisfies(root.version, range)) {
            spinnies.fail(pkg.name, {
              text: `[${pkg.name}] Package not found in dependant's latest version`
            })
            continue
          }

          const dir = join(
            tmpdir(),
            [
              pkg.name.replace('/', '-'),
              pkg.version,
              Date.now(),
              Math.random()
            ].join('-')
          )
          spinnies.update(pkg.name, {
            text: `[${dependant}] Downloading package`
          })
          await fs.mkdir(dir)
          try {
            await fetchPackageSource(pkg.repository.url, pkg.version, dir)
          } catch (err) {
            spinnies.fail(pkg.name, { text: `[${pkg.name}] ${err.message}` })
            continue
          }
          spinnies.update(pkg.name, {
            text: `[${dependant}] Installing dependencies`
          })
          await run(dir, 'npm install')
          spinnies.update(pkg.name, {
            text: `[${dependant}] Running test suite`
          })
          await run(dir, 'npm test')
          spinnies.succeed(pkg.name)
        }
      })
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
