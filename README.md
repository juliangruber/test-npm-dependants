# test-npm-dependants

## Usage

Use the CLI:

```bash
$ test-npm-dependants

  test-npm-dependants NAME STABLEVERSION [NEXTVERSION]

  Options:

    --help, -h         Print help text
    --version, -v      Print program version
    --filter, -f       Filter dependant names by this regexp
    --concurrency, -c  Test concurrency [Default: 5]
    --verbose, -V      Verbose mode

$ test-npm-dependants express 4.17.1 5.0.0-alpha.7

    test express dependants

 stable: 4.17.1
   next: 5.0.0-alpha.7

    ⠼ ⠼  loopback Running test suite
    ✓ ×  hubot
    ⠼ ⠼  @theia/core Installing dependencies
    ✓ ×  probot
    ✓ ✓  @frctl/fractal
    ⠼ ⠼  node-red Installing dependencies
    ✓ ✓  ember-cli
    ⠼ ⠼  firebase-tools Running test suite
    ⠼ ⠼  appium-base-driver Running test suite

```

## Installation

```bash
$ npm install -g test-npm-dependants
```

## Caveats

Tests will be run as child processes, so don't have a `TTY` attached. Any tests
relying on it, for example those reading `process.stdout.columns`, are likely
not going to work.

If you want to debug why a test isn't passing, pass `--verbose` and test output
will be printed out.
