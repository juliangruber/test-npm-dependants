#!/usr/bin/env node
'use strict'
process.title = 'test-npm-dependants'

const test = require('..')
const minimist = require('minimist')
const pkg = require('../package')

const defaults = {
  concurrency: 4,
  timeout: 300
}

const argv = minimist(process.argv.slice(2), {
  boolean: ['verbose', 'version', 'help'],
  alias: {
    filter: 'f',
    verbose: 'V',
    concurrency: 'c',
    timeout: 't',
    version: 'v',
    help: 'h'
  },
  default: {
    concurrency: defaults.concurrency,
    timeout: defaults.timeout
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
  filter: argv.filter && new RegExp(argv.filter),
  verbose: argv.verbose,
  concurrency: Number(argv.concurrency),
  timeout: 1000 * Number(argv.timeout)
}

if (!args.name || !args.version || argv.help) {
  console.log()
  console.log('  test-npm-dependants NAME STABLEVERSION [NEXTVERSION]')
  console.log()
  console.log('  Options:')
  console.log()
  console.log('    --help, -h         Print help text')
  console.log('    --version, -v      Print program version')
  console.log('    --filter, -f       Filter dependant names by this regexp')
  console.log(
    `    --concurrency, -c  Test concurrency [Default: ${defaults.concurrency}]`
  )
  console.log(
    `    --timeout, -t      Time out processes after x seconds [Default: ${defaults.timeout}]`
  )
  console.log('    --verbose, -V      Verbose mode')
  console.log()
  process.exit(Number(!argv.help))
}

test(args).catch(err => {
  console.error(err)
  process.exit(1)
})
