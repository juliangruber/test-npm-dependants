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

const removeDelay = 3000
const run = promisify(exec)
const cancel = (spinnies, name, text) => {
  spinnies.update(name, {
    text: `[${name}] ${text}`,
    color: 'gray'
  })
  setTimeout(() => {
    spinnies.remove(name)
    spinnies.remove(`${name}@next`)
  }, removeDelay)
}

const main = async () => {
  const root = {
    name: process.argv[2],
    version: process.argv[3],
    nextVersion: process.argv[4]
  }
  if (!root.name || !root.version) {
    console.error('Usage: test-npm-dependants NAME STABLEVERSION [NEXTVERSION]')
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
          if (root.nextVersion) {
            spinnies.add(`${dependant}@next`, {
              text: `[${dependant}+${root.nextVersion}] Waiting...`,
              color: 'gray'
            })
          }
          const res = await fetch(`https://registry.npmjs.org/${dependant}`)
          const body = await res.json()
          const pkg = body.versions[body['dist-tags'].latest]
          if (!pkg.repository) {
            cancel(spinnies, pkg.name, 'No repository set')
            continue
          }
          const allDependencies = {
            ...pkg.devDependencies,
            ...pkg.dependencies
          }
          const range = allDependencies[root.name]
          if (!range || !semver.satisfies(root.version, range)) {
            cancel(
              spinnies,
              pkg.name,
              "Package not found in dependant's latest version"
            )
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
            cancel(spinnies, pkg.name, err.message)
            continue
          }
          spinnies.update(pkg.name, {
            text: `[${dependant}] Installing dependencies`
          })
          try {
            await run('npm install', { cwd: dir })
          } catch (_) {
            cancel(spinnies, pkg.name, 'Installation failed')
            continue
          }
          spinnies.update(pkg.name, {
            text: `[${dependant}] Installing ${root.name}@${root.version}`
          })
          await run(`npm install ${root.name}@${root.version}`, {
            cwd: dir
          })
          spinnies.update(pkg.name, {
            text: `[${dependant}] Running test suite`
          })
          let stablePassed
          try {
            await run('npm test', { cwd: dir })
            spinnies.succeed(pkg.name, {
              text: `[${dependant}] Test suite passed`
            })
            stablePassed = true
          } catch (_) {
            spinnies.fail(pkg.name, {
              text: `[${dependant}] Test suite failed`
            })
            stablePassed = false
          }

          if (root.nextVersion) {
            spinnies.update(`${pkg.name}@next`, {
              text: `[${dependant}+${root.nextVersion}] Installing ${root.name}@${root.nextVersion}`,
              color: 'white'
            })
            await run(`npm install ${root.name}@${root.nextVersion}`, {
              cwd: dir
            })
            spinnies.update(`${pkg.name}@next`, {
              text: `[${dependant}+${root.nextVersion}] Running test suite`
            })
            try {
              await run('npm test', { cwd: dir })
              spinnies.succeed(`${pkg.name}@next`, {
                text: `[${dependant}+${root.nextVersion}] Test suite passed`
              })
            } catch (_) {
              spinnies.fail(`${pkg.name}@next`, {
                text: `[${dependant}+${root.nextVersion}] Test suite failed`
              })
              if (!stablePassed) {
                setTimeout(() => {
                  spinnies.remove(pkg.name)
                  spinnies.remove(`${pkg.name}@next`)
                }, removeDelay)
              }
            }
          }
        }
      })
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
