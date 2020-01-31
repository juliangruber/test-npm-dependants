#!/usr/bin/env node
'use strict'
process.title = 'test-npm-dependants'

const test = require('..')
const minimist = require('minimist')
const pkg = require('../package')

const argv = minimist(process.argv.slice(2), {
  boolean: ['verbose', 'version'],
  alias: {
    filter: 'f',
    verbose: 'V',
    version: 'v'
  }
})

if (argv.version) {
  console.log(pkg.version)
  process.exit()
}

const args = {
  name: argv._[0],
  version: argv._[1],
  nextVersion: argv._[2],
  filter: argv.filter,
  verbose: argv.verbose
}

if (!args.name || !args.version) {
  console.error('Usage: test-npm-dependants NAME STABLEVERSION [NEXTVERSION]')
  process.exit(1)
}

test(args).catch(err => {
  console.error(err)
  process.exit(1)
})
