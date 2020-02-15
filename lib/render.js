'use strict'

const spinners = require('cli-spinners')
const chalk = require('chalk')
const ms = require('ms')

const check = (spinner, version) => {
  if (version.loading) return chalk.gray(spinner)
  if (version.pass) return chalk.green('✓')
  return chalk.red('×')
}

module.exports = () => {
  let frameIdx = 0

  return state => {
    const spinner = spinners.dots.frames[frameIdx]
    frameIdx = (frameIdx + 1) % spinners.dots.frames.length

    // head
    let out = `\n    ${chalk.bold.gray('test')}`
    out += ` ${chalk.bold.white(state.name)}`
    out += ` ${chalk.gray('dependants')}\n\n`

    // thead
    out += chalk.gray(` stable: ${chalk.white(state.version)}\n`)
    if (state.nextVersion) {
      out += chalk.gray(`   next: ${chalk.white(state.nextVersion)}\n`)
    }
    out += chalk.gray(`   time: ${chalk.white(ms(new Date() - state.start))}\n`)
    out += '\n'

    // tbody
    for (const dependant of state.dependants) {
      if (!state.nextVersion) out += '  '
      out += `    ${check(spinner, dependant.version)}`
      if (state.nextVersion) out += ` ${check(spinner, dependant.nextVersion)}`
      out += `  ${dependant.name}`
      if (dependant.status) out += ` ${chalk.gray(dependant.status)}`
      out += '\n'
    }

    return out
  }
}

if (!module.parent) {
  process.stdout.write(
    module.exports()({
      name: 'express',
      version: '4.0.0',
      nextVersion: '5.0.0',
      start: new Date() - 1000,
      dependants: [
        {
          name: 'webpack-dev-server',
          status: 'Loading package information',
          version: {
            pass: true,
            loading: false
          },
          nextVersion: {
            pass: false,
            loading: true
          }
        },
        {
          name: 'hubot',
          status: 'Installing dependencies',
          version: {
            pass: false,
            loading: true
          },
          nextVersion: {
            pass: false,
            loading: true
          }
        }
      ]
    })
  )
}
