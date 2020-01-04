#!/usr/bin/env node
'use strict'
process.title = 'test-npm-dependants'

const test = require('..')

const root = {
  name: process.argv[2],
  version: process.argv[3],
  nextVersion: process.argv[4]
}

if (!root.name || !root.version) {
  console.error('Usage: test-npm-dependants NAME STABLEVERSION [NEXTVERSION]')
  process.exit(1)
}

test(root).catch(err => {
  console.error(err)
  process.exit(1)
})
