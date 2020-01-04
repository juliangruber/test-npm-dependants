'use strict'

const test = require('..')
const { ux } = require('@cto.ai/sdk')

const main = async () => {
  const { name, version, nextVersion } = await ux.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Name of the module to test?'
    },
    {
      type: 'input',
      name: 'version',
      message: 'Stable version of the module?'
    },
    {
      type: 'input',
      name: 'nextVersion',
      message: 'Next version of the module?'
    }
  ])

  if (!name || !version) {
    console.error('Usage: test-npm-dependants NAME STABLEVERSION [NEXTVERSION]')
    process.exit(1)
  }

  await test({ name, version, nextVersion })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
