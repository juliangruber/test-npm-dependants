'use strict'

const { promisify } = require('util')
const { exec } = require('child_process')
const { promises: fs } = require('fs')

const run = async (cmd, { cwd }) => {
  const log = `${cwd}/.${cmd.replace(/ /, '-')}`
  try {
    await promisify(exec)(cmd, { cwd, maxBuffer: Infinity })
  } catch (err) {
    await fs.writeFile(`${log}.stdout`, err.stdout)
    await fs.writeFile(`${log}.stderr`, err.stderr)
    throw new Error(`See ${log}.{stdout,stderr}`)
  }
}

module.exports = run
