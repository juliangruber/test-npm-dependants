'use strict'

const dependants = require('npm-dependants')
const fetch = require('node-fetch')
const semver = require('semver')
const { tmpdir } = require('os')
const { promises: fs } = require('fs')
const { promisify } = require('util')
const { exec } = require('child_process')
const { join } = require('path')
const Spinnies = require('spinnies')
const fetchPackageSource = require('fetch-package-source')

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
            spinnies.fail(pkg.name, {
              text: `[${pkg.name}] No repository set`,
              failColor: 'gray'
            })
            continue
          }
          const allDependencies = {
            ...pkg.devDependencies,
            ...pkg.dependencies
          }
          const range = allDependencies[root.name]
          if (!range || !semver.satisfies(root.version, range)) {
            spinnies.fail(pkg.name, {
              text: `[${pkg.name}] Package not found in dependant's latest version`,
              failColor: 'gray'
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
            spinnies.fail(pkg.name, {
              text: `[${pkg.name}] ${err.message}`,
              failColor: 'gray'
            })
            continue
          }
          spinnies.update(pkg.name, {
            text: `[${dependant}] Installing dependencies`
          })
          await promisify(exec)('npm install', { cwd: dir })
          spinnies.update(pkg.name, {
            text: `[${dependant}] Installing ${root.name}@${root.version}`
          })
          await promisify(exec)(`npm install ${root.name}@${root.version}`, {
            cwd: dir
          })
          spinnies.update(pkg.name, {
            text: `[${dependant}] Running test suite`
          })
          try {
            await promisify(exec)('npm test', { cwd: dir })
            spinnies.succeed(pkg.name, {
              text: `[${dependant}] Test suite passed`
            })
          } catch (_) {
            spinnies.fail(pkg.name, {
              text: `[${dependant}] Test suite failed`
            })
          }
        }
      })
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
