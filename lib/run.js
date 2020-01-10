'use strict'

const { promisify } = require('util')
const { spawn } = require('child_process')

const run = async (cmd, opts) => {
  const segs = cmd.split(' ')
  cmd = segs[0]
  const args = segs.slice(1)
  const ps = spawn(cmd, args, { ...opts, stdio: 'ignore' })
  const code = await promisify(cb => {
    ps.once('exit', code => cb(null, code))
  })()
  if (code !== 0) throw new Error(`Non-zero exit code ${code}`)
}

module.exports = run
