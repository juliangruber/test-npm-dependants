'use strict'

const execa = require('execa')

const run = async (cmd, { cwd, verbose, timeout }) => {
  if (verbose) console.log(cmd)
  const [program, ...args] = cmd.split(' ')
  const ps = execa(program, args, {
    cwd,
    env: { NODE_ENV: 'development' }
  })
  if (verbose) {
    ps.stdout.pipe(process.stdout)
    ps.stderr.pipe(process.stderr)
  }

  let handle
  if (timeout) {
    handle = setTimeout(() => {
      ps.kill('SIGTERM', {
        forceKillAfterTimeout: 2000
      })
    }, timeout)
  }

  try {
    await ps
  } catch (err) {
    if (ps.killed) throw new Error('Timed out')
    throw new Error('Non-zero exit')
  } finally {
    if (handle) clearTimeout(handle)
  }
}

module.exports = run
