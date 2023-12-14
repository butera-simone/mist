const test = require('brittle')
const Mist = require('..')
const noop = () => {}

test('positional', function (t) {
  const m = new Mist()
  const argv = 'first second'.split(' ')
  const parsed = m.parse(argv)
  t.is(parsed._[0], 'first')
  t.is(parsed._[1], 'second')
})

test('boolean', function (t) {
  const m = new Mist()
  const argv = '--fast --no-random'.split(' ')
  const { fast, random } = m.parse(argv, {
    boolean: ['fast', 'random']
  })
  t.is(fast, true)
  t.is(random, false)
})

test('list', function (t) {
  const m = new Mist()
  const argv = '--listFlag=1,2,3'.split(' ')
  const { listFlag } = m.parse(argv)
  t.is(listFlag, '1,2,3')
})

test('string', function (t) {
  const m = new Mist([])
  const argv = '--correct arg --missing'.split(' ')
  const { correct, missing } = m.parse(argv, {
    string: ['correct', 'missing']
  })
  t.is(correct, 'arg')
  t.is(missing, '')
})

test('alias', function (t) {
  const m = new Mist()
  const argv = '-a -b c'.split(' ')
  const { alpha, beta } = m.parse(argv, {
    boolean: ['alpha'],
    string: ['beta'],
    alias: {
      alpha: 'a',
      beta: 'b'
    }
  })
  t.is(alpha, true)
  t.is(beta, 'c')
})

test('default', function (t) {
  const m = new Mist()
  const argv = '--other arg'.split(' ')
  const { main, other } = m.parse(argv, {
    default: {
      main: 12345
    }
  })
  t.is(other, 'arg')
  t.is(main, 12345)
})

test('validate', function (t) {
  const m = new Mist()
  const argv = '--known --unknown arg'.split(' ')
  const { known } = m.parse(argv, {
    boolean: ['known']
  })
  t.is(known, true)
  t.exception(() => m.parse(argv, {
    boolean: ['known'],
    validate: true
  }))
})

test('pass down', function (t) {
  const m = new Mist()
  const argv = '--firstFlag -- --secondFlag alpha beta gamma'.split(' ')
  const parsed = m.parse(argv)
  t.alike(parsed['--'], ['--secondFlag', 'alpha', 'beta', 'gamma'])
})

test('sub', async function (t) {
  const m = new Mist([], noop, noop)
  m.add('main', () => 888888888888888)
  const argv = 'main'.split(' ')
  const parsed = await m.run(argv)
  t.is(parsed, 888888888888888)
})

test('subsub', async function (t) {
  const m = new Mist([], noop, noop)
  m.add('first', () => 888888888888888)
  m.add('first second', () => 7777777777)
  const argv = 'first second'.split(' ')
  const parsed = await m.run(argv)
  t.is(parsed, 7777777777)
})

test('help', async function (t) {
  const m = new Mist([], (name) => name, noop)
  m.add('main', () => 888888888888888)
  const argv = 'main --help'.split(' ')
  const parsed = await m.run(argv)
  t.is(parsed, 'main')
})

test('teardown', async function (t) {
  let side = 0
  const m = new Mist([], noop, () => { side = 199 })
  m.add('main', () => {})
  const argv = 'main'.split(' ')
  await m.run(argv)
  t.is(side, 199)
})

test('complex example', async function (t) {
  let side = 0
  const m = new Mist([], noop, () => { side = 199 })
  m.add('main', (argv) => {
    return m.parse(argv, {
      boolean: ['fast', 'random', 'alpha'],
      string: ['correct', 'missing', 'beta'],
      alias: {
        alpha: 'a',
        beta: 'b'
      }
    })
  })
  const argv = 'main first second --fast --no-random --listFlag=1,2,3 --correct arg --missing -a -b c -- --secondFlag alpha beta gamma'.split(' ')
  const parsed = await m.run(argv)
  t.is(parsed._[0], 'first')
  t.is(parsed._[1], 'second')
  t.is(parsed.fast, true)
  t.is(parsed.random, false)
  t.is(parsed.listFlag, '1,2,3')
  t.is(parsed.correct, 'arg')
  t.is(parsed.missing, '')
  t.is(parsed.alpha, true)
  t.is(parsed.beta, 'c')
  t.alike(parsed['--'], ['--secondFlag', 'alpha', 'beta', 'gamma'])
  t.is(side, 199)
})
