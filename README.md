# test-npm-dependants

Run the test suites of all modules depending on a given module.

## Usage

Use the CLI:

```bash
$ test-npm-dependants

  test-npm-dependants NAME STABLEVERSION [NEXTVERSION]

  Options:

    --help, -h         Print help text
    --version, -v      Print program version
    --filter, -f       Filter dependant names by this regexp
    --concurrency, -c  Test concurrency [Default: 4]
    --timeout, -t      Time out processes after x seconds [Default: 300]
    --verbose, -V      Verbose mode

$ test-npm-dependants express 4.17.1 5.0.0-alpha.7

    test express dependants

 stable: 4.17.1
   next: 5.0.0-alpha.7
   time: 3m

    ⠼ ⠼  loopback Running test suite
    ✓ ×  hubot Breaks
    ⠼ ⠼  @theia/core Installing dependencies
    ✓ ×  probot Breaks
    ✓ ✓  @frctl/fractal Passes
    ⠼ ⠼  node-red Installing dependencies
    ✓ ✓  ember-cli Passes
    ⠼ ⠼  firebase-tools Running test suite
    ⠼ ⠼  appium-base-driver Running test suite

```

Use as an [Op](https://cto.ai/):

```bash
$ npm install -g @cto.ai/ops && ops account:signup
$ ops run @juliangruber/test-npm-dependants
```

## Installation

```bash
$ npm install -g test-npm-dependants
```

## Security

Running untrusted code on your computer is dangerous. This is why you should use
this project via [Ops](https://cto.ai/) instead, which will sandbox everything
inside a Docker container:

![Why Sandbox](images/sandbox.png)

## Caveats

Tests will be run as child processes, so don't have a `TTY` attached. Any tests
relying on it, for example those reading `process.stdout.columns`, are likely
not going to work.

If you want to debug why a test isn't passing, pass `--verbose` and test output
will be printed out.

## Sponsors

This project is [sponsored](https://github.com/sponsors/juliangruber) by [CTO.ai](https://cto.ai/), making it easy for development teams to create and share workflow automations without leaving the command line.

[![](https://apex-software.imgix.net/github/sponsors/cto.png)](https://cto.ai/)
