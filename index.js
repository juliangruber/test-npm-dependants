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

const removeDelay = 3000
const cancel = (state, dependantState, text) => {
  dependantState.status = text
  setTimeout(() => {
    const idx = state.dependants.indexOf(dependantState)
    state.dependants.splice(idx, 1)
  }, removeDelay)
}

const test = async ({
  name,
  version,
  nextVersion,
  filter,
  timeout,
  verbose,
  concurrency
}) => {
  const root = { name, version }
  const iterator = dependants(root.name)

  const state = {
    ...root,
    nextVersion,
    dependants: [],
    start: new Date()
  }

  let iv, render, diff
  if (!verbose) {
    render = createRender()
    diff = differ()
    diff.pipe(process.stdout)
    iv = setInterval(() => {
      diff.reset()
      diff.write(render(state))
    }, 100)
  }
  if (verbose) concurrency = 1
  const seen = new Set()

  await Promise.all(
    Array(concurrency)
      .fill()
      .map(async () => {
        for await (const dependant of iterator) {
          if (filter && !filter.test(dependant)) continue
          if (seen.has(dependant)) continue
          seen.add(dependant)
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
            await run('npm install', { cwd: dir, verbose, timeout })
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
            await run('npm test', { cwd: dir, verbose, timeout })
            dependantState.version.pass = true
            dependantState.status = ''
          } catch (err) {
            dependantState.status = ''
          }
          dependantState.version.loading = false

          if (nextVersion) {
            const nameVersion = nextVersion.includes('#')
              ? `${root.name}${nextVersion}`
              : nextVersion
            dependantState.status = `Installing ${nextVersion}`
            await run('which git')
            await run(`npm install ${nextVersion}`, {
              cwd: dir,
              verbose
            })
            dependantState.status = 'Running test suite'
            try {
              await run('npm test', { cwd: dir, verbose, timeout })
              dependantState.nextVersion.pass = true
            } catch (_) {
              if (!dependantState.version.pass) {
                cancel(state, dependantState, '')
              }
            }
            dependantState.nextVersion.loading = false
            if (dependantState.version.pass) {
              if (dependantState.nextVersion.pass) {
                dependantState.status = 'Passes'
              } else {
                dependantState.status = 'Breaks'
              }
            } else {
              if (dependantState.nextVersion.pass) {
                dependantState.status = 'Fixed'
              }
            }
          }
        }
      })
  )

  if (!seen.size) {
    state.error = `${root.name} has no dependants`
    diff.reset()
    diff.write(render(state))
  }
  if (!verbose) clearInterval(iv)
}

module.exports = test
