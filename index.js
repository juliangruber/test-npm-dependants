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
const ora = require('ora')

const run = async (dir, cmd) => {
  const segs = cmd.split(' ')
  const ps = spawn(segs[0], segs.slice(1), { cwd: dir, stdio: 'inherit' })
  await promisify(ps.once.bind(ps))('exit')
}

const download = async (pkg, dir) => {
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
    throw new Error('Unable to download source code')
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

  for await (const dependant of dependants(root.name)) {
    console.log(dependant)
    const spinner = ora('Loading package information').start()
    const res = await fetch(`https://registry.npmjs.org/${dependant}`)
    const body = await res.json()
    const pkg = body.versions[body['dist-tags'].latest]
    const range = { ...pkg.devDependencies, ...pkg.dependencies }[root.name]
    if (range && semver.satisfies(root.version, range)) {
      const dir = join(
        tmpdir(),
        [pkg.name, pkg.version, Date.now(), Math.random()].join('-')
      )
      spinner.text = 'Downloading package'
      await fs.mkdir(dir)
      try {
        await download(pkg, dir)
      } catch (err) {
        console.error(err.message)
        continue
      }
      spinner.text = 'Installing dependencies'
      await run(dir, 'npm install')
      spinner.text = 'Running test suite'
      await run(dir, 'npm test')
      console.log('Yes!')
    } else {
      console.error("Package not found in dependant's latest version")
    }
    spinner.stop()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
