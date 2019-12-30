'use strict'

const dependants = require('npm-dependants')
const fetch = require('node-fetch')
const semver = require('semver')
const { tmpdir } = require('os')
const { promises: fs } = require('fs')
const { promisify } = require('util')
const { spawn } = require('child_process')
const { join } = require('path')
const githubUrlToObject = require('github-url-to-object')
const Spinnies = require('spinnies')
const itBatch = require('it-batch')

const run = async (dir, cmd) => {
  const segs = cmd.split(' ')
  const ps = spawn(segs[0], segs.slice(1), { cwd: dir })
  await promisify(ps.once.bind(ps))('exit')
}

const download = async (pkg, dir) => {
  if (!pkg.repository) {
    throw new Error('No repository set')
  }
  const obj = githubUrlToObject(pkg.repository.url)
  let res = await fetch(
    `https://github.com/${obj.user}/${obj.repo}/archive/${pkg.version}.tar.gz`
  )
  if (!res.ok) {
    res = await fetch(
      `https://github.com/${obj.user}/${obj.repo}/archive/v${pkg.version}.tar.gz`
    )
  }
  if (!res.ok) {
    throw new Error('No matching GitHub release found')
  }
  await fs.writeFile(`${dir}/tgz`, await res.buffer())
  await run(dir, 'tar -xzf tgz --strip=1')
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

  for await (const batch of itBatch(dependants(root.name), 5)) {
    await Promise.all(
      batch.map(async dependant => {
        spinnies.add(dependant, {
          text: `[${dependant}] Loading package information`
        })
        const res = await fetch(`https://registry.npmjs.org/${dependant}`)
        const body = await res.json()
        const pkg = body.versions[body['dist-tags'].latest]
        const range = { ...pkg.devDependencies, ...pkg.dependencies }[root.name]
        if (range && semver.satisfies(root.version, range)) {
          const dir = join(
            tmpdir(),
            [pkg.name, pkg.version, Date.now(), Math.random()].join('-')
          )
          spinnies.update(pkg.name, {
            text: `[${dependant}] Downloading package`
          })
          await fs.mkdir(dir)
          try {
            await download(pkg, dir)
          } catch (err) {
            spinnies.fail(pkg.name, { text: `[${pkg.name}] ${err.message}` })
            return
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
        } else {
          spinnies.fail(pkg.name, {
            text: `[${pkg.name}] Package not found in dependant's latest version`
          })
        }
      })
    )
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
