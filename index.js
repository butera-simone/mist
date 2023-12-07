const goodbye = require('graceful-goodbye')

class Mist {
  constructor (obj) {
    this.run = obj.run
    this.teardown = obj.teardown
    this.help = obj.help
    this.validate = (obj.validate === undefined || obj.validate === true) ? defaultValidate : obj.validate
    this.simpleAlias = obj.simpleAlias || false
    this.sub = obj.sub || {}
    this.flags = obj.flags || {}
    this.positional = obj.positional || []

    if (this.simpleAlias) {
      this._simpleAlias()
    }
  }

  _simpleAlias (commandObject = this) {
    if (commandObject.flags) {
      for (const [flagName, flagOptions] of Object.entries(commandObject.flags)) {
        const alias = flagName.charAt(0)
        flagOptions.alias = alias
      }
    }
  }

  sub (...args) {
    let superCommand = this
    const commandOptions = args.pop()
    const commandName = args.pop()
    for (let index = 0; index < args.length; index++) {
      superCommand = superCommand.sub[args[index]]
    }
    superCommand.sub = superCommand.sub || {}
    if (superCommand.simpleAlias && commandOptions.simpleAlias !== false) {
      commandOptions.simpleAlias = true
      this._simpleAlias(commandOptions)
    }
    superCommand.sub[commandName] = commandOptions
  }

  parse (argv = process.argv.splice(2)) {
    const checkingCommands = 0
    const parsing = 1
    const awaitingFlagArgument = 2

    let currentCommand = this
    const superCommands = []
    let flags = Object.assign({}, this.flags)
    const result = {}
    let anonArgsCollected = 0
    let state = checkingCommands
    let missingArgument = null

    function findHook (name) {
      if (currentCommand[name]) {
        return currentCommand[name]
      }
      for (let index = superCommands.length; index > 0; index--) {
        if (superCommands[index - 1][name]) {
          return superCommands[index - 1][name]
        }
      }
    }
    function isAFlag (arg) {
      return arg.startsWith('-')
    }
    function flagNameOf (flag) {
      while (flag.charAt(0) === '-') {
        flag = flag.substring(1)
      }
      flag = flag.split('=')[0]
      if (flag.length === 1) {
        for (const [flagName, flagOptions] of Object.entries(flags)) {
          if ('alias' in flagOptions && flagOptions.alias === flag) {
            flag = flagName
          }
        }
      }
      return flag
    }
    function checkIfAnArgumentIsMissing () {
      const flagOptions = flags[missingArgument] || {}
      if (state === awaitingFlagArgument && missingArgument) {
        if (flagOptions.value === 'string') {
          result[missingArgument] = null
        } else {
          result[missingArgument] = true
        }
      }
    }
    function addAnonymousArgument (value) {
      result._ = result._ ? result._.concat(value) : [value]
    }

    for (const [flagName, flagOptions] of Object.entries(flags)) {
      if (flagOptions.default) {
        result[flagName] = flagOptions.default
      }
    }
    for (const arg of currentCommand.positional) {
      if (arg.default) {
        addAnonymousArgument(arg.default)
      }
    }

    for (let arg of argv) {
      if (state === checkingCommands) {
        if (currentCommand.sub && arg in currentCommand.sub) {
          superCommands.push(currentCommand)
          currentCommand = currentCommand.sub[arg]
          if (currentCommand.flagInheritance === false) {
            flags = currentCommand.flags
          }
          if (Array.isArray(currentCommand.flagInheritance)) {
            for (const flag in flags) {
              if (!currentCommand.flagInheritance.includes(flag)) {
                delete flags[flag]
              }
            }
            Object.assign(flags, currentCommand.flags)
          }
          continue
        } else {
          state = parsing
        }
      }
      currentCommand.flags = flags
      if (isAFlag(arg)) {
        checkIfAnArgumentIsMissing()
        missingArgument = null
        const flagName = flagNameOf(arg)
        const flagOptions = flags[flagName] || {}
        switch (flagOptions.value) {
          case 'bool' : {
            result[flagName] = true
            break
          }
          case 'list' : {
            const list = arg.split('=')
            result[flagName] = list[1] ? list[1].split(',') : null
            break
          }
          default : {
            state = awaitingFlagArgument
            missingArgument = flagName
          }
        }
      } else if (state === awaitingFlagArgument) {
        const flagOptions = flags[missingArgument] || {}
        if (flagOptions.parser) {
          result[missingArgument] = flagOptions.parser(arg, result[missingArgument])
        } else {
          result[missingArgument] = arg
        }
        state = parsing
      } else if (currentCommand.positional && anonArgsCollected < currentCommand.positional.length) {
        if (currentCommand.positional[anonArgsCollected].parser) {
          arg = currentCommand.positional[anonArgsCollected].parser(arg)
        }
        addAnonymousArgument(arg)
        anonArgsCollected++
      } else {
        addAnonymousArgument(arg)
        anonArgsCollected++
      }
    }
    checkIfAnArgumentIsMissing()

    if (result.help) {
      const help = findHook('help')
      return help(currentCommand)
    }

    const validate = findHook('validate')
    if (validate) {
      validate(result, currentCommand)
    }

    const teardown = findHook('teardown')
    if (teardown) {
      goodbye(async function () {
        teardown(result, currentCommand)
      })
    }

    const run = findHook('run')
    if (run) {
      return run(result, currentCommand)
    }

    return result
  }
}

module.exports = Mist

function defaultValidate (result, currentCommand) {
  const positionals = currentCommand.positional || []
  if (result._ && result._.length > positionals.length) {
    console.error(`The command takes up to ${positionals.length} arguments but ${result._.length} were provided`)
    goodbye.exit()
  }
  for (const [argName, argValue] of Object.entries(result)) {
    if (argName !== '_') {
      if (!(argName in currentCommand.flags)) {
        console.error(`Invalid flag: --${argName}`)
        goodbye.exit()
      }
      if (argName in currentCommand.flags && Array.isArray(currentCommand.flags[argName].value) && !currentCommand.flags[argName].value.includes(result[argName])) {
        console.error(`The flag --${argName} expected one of the following values: ${currentCommand.flags[argName].value.join(', ')}`)
        goodbye.exit()
      }
      if (argValue === null) {
        console.error(`The flag --${argName} expected an argument`)
        goodbye.exit()
      }
    }
  }
}
