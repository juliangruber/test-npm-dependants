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
const { ux } = require('@cto.ai/sdk')

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
  output,
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
  if (output === 'terminal') {
    render = createRender()
    diff = differ()
    diff.pipe(process.stdout)
    iv = setInterval(() => {
      diff.reset()
      diff.write(render(state))
    }, 100)
  } else if (output === 'verbose') {
    concurrency = 1
  }
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

          if (output === 'verbose') {
            console.log(`test ${pkg.name}@${pkg.version}`)
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
            await run('npm install', {
              cwd: dir,
              verbose: output === 'verbose',
              timeout
            })
          } catch (_) {
            cancel(state, dependantState, 'Installation failed')
            continue
          }
          dependantState.status = `Installing ${root.name}@${root.version}`
          await run(`npm install ${root.name}@${root.version}`, {
            cwd: dir,
            verbose: output === 'verbose'
          })
          dependantState.status = 'Running test suite'
          try {
            await run('npm test', {
              cwd: dir,
              verbose: output === 'verbose',
              timeout
            })
            dependantState.version.pass = true
            dependantState.status = ''
          } catch (err) {
            dependantState.status = ''
          }
          dependantState.version.loading = false

          if (nextVersion) {
            dependantState.status = `Installing ${root.name}@${nextVersion}`
            await run(`npm install ${root.name}@${nextVersion}`, {
              cwd: dir,
              verbose: output === 'verbose'
            })
            dependantState.status = 'Running test suite'
            try {
              await run('npm test', {
                cwd: dir,
                verbose: output === 'verbose',
                timeout
              })
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
                if (output === 'slack') {
                  ux.print(`${pkg.name}@${pkg.version} still passes`)
                }
              } else {
                dependantState.status = 'Breaks'
                if (output === 'slack') {
                  ux.print(`${pkg.name}@${pkg.version} breaks`)
                }
              }
            } else {
              if (dependantState.nextVersion.pass) {
                dependantState.status = 'Fixed'
                if (output === 'slack') {
                  ux.print(`${pkg.name}@${pkg.version} was fixed`)
                }
              }
            }
          }
        }
      })
  )

  if (!seen.size) {
    state.error = `${root.name} has no dependants`
    if (output === 'terminal') {
      diff.reset()
      diff.write(render(state))
    }
  }
  if (output === 'terminal') clearInterval(iv)
}

module.exports = test
