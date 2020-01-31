'use strict'

const dependants = require('npm-dependants')
const fetch = require('node-fetch')
const semver = require('semver')
const { tmpdir } = require('os')
const { promises: fs } = require('fs')
const { join } = require('path')
const fetchPackageSource = require('fetch-package-source')
const createRender = require('./lib/render')
const differ = require('ansi-diff-stream')
const run = require('./lib/run')

const { DEBUG: debug } = process.env
const removeDelay = 3000
const cancel = (state, dependantState, text) => {
  dependantState.status = text
  setTimeout(() => {
    const idx = state.dependants.indexOf(dependantState)
    state.dependants.splice(idx, 1)
  }, removeDelay)
}

const test = async ({ name, version, nextVersion, filter, verbose }) => {
  const root = { name, version }
  const iterator = dependants(root.name)

  const state = {
    ...root,
    nextVersion,
    dependants: []
  }

  let iv
  if (!verbose) {
    const render = createRender()
    const diff = differ()
    diff.pipe(process.stdout)
    iv = setInterval(() => {
      diff.reset()
      diff.write(render(state))
    }, 100)
  }
  const concurrency = verbose ? 1 : 5

  await Promise.all(
    Array(concurrency)
      .fill()
      .map(async () => {
        for await (const dependant of iterator) {
          if (filter && !new RegExp(filter).test(dependant)) continue
          const dependantState = {
            name: dependant,
            status: 'Loading package information',
            version: { loading: true, pass: false },
            nextVersion: { loading: true, pass: false }
          }
          state.dependants.push(dependantState)

          const res = await fetch(`https://registry.npmjs.org/${dependant}`)
          const body = await res.json()
          const pkg = body.versions[body['dist-tags'].latest]
          if (!pkg.repository) {
            cancel(state, dependantState, 'No repository set')
            continue
          }
          const allDependencies = {
            ...pkg.devDependencies,
            ...pkg.dependencies
          }
          const range = allDependencies[root.name]
          if (!range || !semver.satisfies(root.version, range)) {
            cancel(
              state,
              dependantState,
              "Package not found in dependant's latest version"
            )
            continue
          }

          if (verbose) console.log(`test ${pkg.name}@${pkg.version}`)
          const dir = join(
            tmpdir(),
            [
              pkg.name.replace('/', '-'),
              pkg.version,
              Date.now(),
              Math.random()
            ].join('-')
          )
          dependantState.status = 'Downloading package'
          await fs.mkdir(dir)
          try {
            await fetchPackageSource(pkg.repository.url, pkg.version, dir)
          } catch (err) {
            cancel(state, dependantState, err.code || err.message)
            continue
          }
          dependantState.status = 'Installing dependencies'
          try {
            await run('npm install', { cwd: dir, verbose })
          } catch (_) {
            cancel(state, dependantState, 'Installation failed')
            continue
          }
          dependantState.status = `Installing ${root.name}@${root.version}`
          await run(`npm install ${root.name}@${root.version}`, {
            cwd: dir,
            verbose
          })
          dependantState.status = 'Running test suite'
          try {
            await run('npm test', { cwd: dir, verbose })
            dependantState.version.pass = true
            dependantState.status = ''
          } catch (err) {
            dependantState.status = debug ? err.message : ''
          }
          dependantState.version.loading = false

          if (nextVersion) {
            dependantState.status = `Installing ${root.name}@${nextVersion}`
            await run(`npm install ${root.name}@${nextVersion}`, {
              cwd: dir,
              verbose
            })
            dependantState.status = 'Running test suite'
            try {
              await run('npm test', { cwd: dir, verbose })
              dependantState.nextVersion.pass = true
            } catch (_) {
              if (!dependantState.version.pass) {
                cancel(state, dependantState, '')
              }
            }
            dependantState.nextVersion.loading = false
            dependantState.status = ''
          }
        }
      })
  )

  if (!verbose) clearInterval(iv)
}

module.exports = test
