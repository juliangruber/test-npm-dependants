'use strict'

const test = require('..')
const { ux } = require('@cto.ai/sdk')
const fetch = require('node-fetch')
const semver = require('semver')

const main = async () => {
  const { name } = await ux.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Name of the module to test',
      default: 'express'
    }
  ])

  const res = await fetch(`https://registry.npmjs.org/${name}`)
  if (!res.ok) {
    console.error('Module not found!')
    process.exit(1)
  }
  const {
    'dist-tags': { latest, next }
  } = await res.json()

  const { version, nextVersion, filter, timeout, verbose } = await ux.prompt([
    {
      type: 'input',
      name: 'version',
      message: 'Stable version of the module',
      default: latest
    },
    {
      type: 'input',
      name: 'nextVersion',
      message: 'Next version of the module',
      default: next && semver.gt(next, latest) ? next : undefined,
      allowEmpty: true
    },
    {
      type: 'input',
      name: 'filter',
      message: 'Filter dependants by module name regular expression?',
      allowEmpty: true,
      flag: 'f'
    },
    {
      type: 'input',
      name: 'timeout',
      message: 'Time out processes after x seconds?',
      allowEmpty: true,
      flag: 't',
      default: '300'
    },
    {
      type: 'confirm',
      name: 'verbose',
      message: 'Do you want to run in verbose mode?',
      flag: 'V'
    }
  ])

  let concurrency
  if (!verbose) {
    ;({ concurrency } = await ux.prompt([
      {
        type: 'input',
        name: 'concurrency',
        message: 'How many modules do you want to test at once?',
        default: '4',
        flag: 'c'
      }
    ]))
  }

  await test({
    name,
    version,
    nextVersion,
    filter: filter && new RegExp(filter),
    timeout: timeout * 1000,
    verbose,
    concurrency: Number(concurrency)
  })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
