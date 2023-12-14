module.exports = class Cmd {
  constructor (flags, help, teardown) {
    this.cmds = {}
    this.flags = flags || []
    this.help = help
    this.teardown = teardown
  }

  add (cmd, fn) {
    this.cmds[cmd] = fn
  }

  async run (argv = process.argv) {
    const cmd = argv[0]
    const sub = `${cmd} ${argv[1]}`
    try {
      if (this.cmds[sub]) {
        if (argv.includes('--help') || argv.includes('-h')) return await this.help(sub)
        return await this.cmds[sub](argv.slice(2))
      }
      if (this.cmds[cmd]) {
        if (argv.includes('--help') || argv.includes('-h')) return await this.help(cmd)
        return await this.cmds[cmd](argv.slice(1))
      }
      return await this.help(cmd)
    } finally {
      await this.teardown()
    }
  }

  parse (argv, opts = {}) {
    const arg = (flag, argv = process.argv) => {
      for (let index = argv.length - 1; index >= 0; index--) {
        const item = argv[index]
        let value = (item === flag) ? argv[index + 1] : null
        if (value?.[0] === '-' && isNaN(value)) value = ''
        if (item.startsWith(flag + '=')) value = item.split('=')[1].trim()
        if (value === null) continue
        if (value === undefined) value = ''
        const end = value.length - 1
        if ((value[0] === '"' || value[0] === '\'') && (value[end] === '"' || value[end] === '\'')) value = value.slice(1, -1)
        return value
      }
      return false
    }

    const { boolean = [], string = [], alias = {}, default: def = {}, validate = false } = opts
    const valid = validate ? [...boolean, ...string, ...Object.values(alias).flat(), ...this.flags.map((str) => str.slice(2))] : null
    const parsed = { _: [], '--': argv.includes('--') ? argv.slice(argv.indexOf('--') + 1) : [], ...def }

    for (let i = 0; i < argv.length; i++) {
      const val = argv[i]
      const split = val.split('=')
      const flag = split[0]

      if (val === '--') break
      if (val[0] !== '-') {
        parsed._.push(val)
        continue
      }

      let name = flag[1] === '-' ? flag.slice(2) : flag.slice(1)
      const isNo = name.startsWith('no-')
      if (isNo) name = name.slice(3)

      if (validate && !valid.includes(name)) {
        const err = new Error(`Invalid flag: ${flag}`)
        err.code = 'ERR_INVALID_FLAG'
        throw err
      }

      for (const [actual, aliases] of Object.entries(alias)) {
        if (typeof aliases === 'string' ? aliases === name : aliases.includes(name)) {
          name = actual
          break
        }
      }

      if (boolean.includes(name)) {
        parsed[name] = !isNo
      } else {
        parsed[name] = arg(flag, argv)
        if (split.length === 1 && parsed[name]) i++
      }
    }

    return parsed
  }
}
