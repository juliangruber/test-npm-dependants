#!/usr/bin/env node
'use strict'
process.title = 'test-npm-dependants'

const test = require('..')
const minimist = require('minimist')

const argv = minimist(process.argv.slice(2), {
  boolean: ['stream'],
  alias: {
    filter: 'f',
    stream: 's'
  }
})

const args = {
  name: argv._[0],
  version: argv._[1],
  nextVersion: argv._[2],
  filter: argv.filter,
  stream: argv.stream
}

if (!args.name || !args.version) {
  console.error('Usage: test-npm-dependants NAME STABLEVERSION [NEXTVERSION]')
  process.exit(1)
}

test(args).catch(err => {
  console.error(err)
  process.exit(1)
})
