'use strict'

const { spawn } = require('child_process')

const run = async (cmd, { cwd, verbose }) =>
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
    ps.on('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`Non-zero exit code: ${code}`))
    })
  })

module.exports = run
