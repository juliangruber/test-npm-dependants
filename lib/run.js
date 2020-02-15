'use strict'

const { spawn } = require('child_process')

const run = async (cmd, { cwd, verbose, timeout }) =>
  new Promise((resolve, reject) => {
    if (verbose) console.log(cmd)
    const [program, ...args] = cmd.split(' ')
    const ps = spawn(program, args, {
      cwd,
      env: {
        ...process.env,
        NODE_ENV: 'development'
      }
    })
    if (verbose) {
      ps.stdout.pipe(process.stdout)
      ps.stderr.pipe(process.stderr)
    }

    let handle
    let timedOut
    if (timeout) {
      handle = setTimeout(() => {
        timedOut = true
        ps.kill()
      }, timeout)
    }

    ps.on('exit', code => {
      if (handle) clearTimeout(handle)
      if (timedOut) reject(new Error('Timed out'))
      else if (code === 0) resolve()
      else reject(new Error(`Non-zero exit code: ${code}`))
    })
  })

module.exports = run
