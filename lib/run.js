'use strict'

const { promisify } = require('util')
const { spawn } = require('child_process')
const fs = require('fs')

const { DEBUG: debug } = process.env

const run = async (cmd, { cwd }) => {
  const log = `${cwd}/.${cmd}.log.txt`
  const segs = cmd.split(' ')
  cmd = segs[0]
  const args = segs.slice(1)
  const ps = spawn(cmd, args, { cwd, shell: true })
  if (debug) {
    const ws = fs.createWriteStream(log)
    ps.stdout.pipe(ws)
    ps.stderr.pipe(ws)
  }
  const code = await promisify(cb => {
    ps.once('exit', code => cb(null, code))
  })()
  if (code !== 0) throw new Error(`See ${log}`)
}

module.exports = run
