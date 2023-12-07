# mist

Middleweight arg parsing library.

## Example

``` js 
const Mist = require('mist')

const m = new Mist({
  flags: {
    alpha: {
      value: 'bool',
      default: 'a'
    },
    beta: {
      value: 'string',
      default: 'b',
      parser: (newValue) => {
        if (newValue.length > 10) {
            throw new Error('too long')
        }
      }
    }
  },
  positional: [
    {
      default: 1000
    }
  ]
})

m.sub('call', {
  flags: {
    gamma: {
      value: 'list'
    }
  },
  flagInheritance: false
})
```

## API

The api is based around two options object formats, one for declaring commands and another one for declaring arguments. 

Since they're regular javascript objects, they can be customized with arbitrary fields to be used in the callbacks they're passed to.

#### `const m = new Mist([commandObject])`

The main constructor takes a command object as argument. The following properties are supported:

``` js
{
    flags: {}, // an object containing an argument object for each flag
    positional: [], // an array containing an argument object for each positional parameter of the command
    sub: {}, // an object containing command objects for each subcommand. They can also be inserted with the .sub method, described later
    validate: (result, currentCommand) => {}, // a function to validate the result of the argument parsing. It has a default hook, described later
    help: (currentCommand) => {}, // a function to generate an help message for the command
    run: (result, currentCommand) => {}, // an arbitrary function to run with the command
    teardown: (result, currentCommand) => {}, // a function to run when the rest of the program stops, using the graceful-goodbye module
    simpleAlias: false, // if true, gives each flag an alias based on the first letter of its name
    flagInheritance: true // by default each subcommand inherits all the flag of its supercommand. With false it inherits nothing. 
                          // Passing an array of strings allows to inherit only selected ones
}

```

Mist supports recursive subcommands. Each subcommand inherits from its super:
- all flags by default, unless the `flagInheritance` field is meddled with
- the validate/help/run/teardown hooks, unless a specific one is provided to overwrite it
- the simpleAlias setting, unless a value is provided to overwrite it
- not the positional parameters, they are specific for each command

The default validate hook will print to console.error (and call the teardown logic to exit the program) if:
- the number of positional arguments given is larger than the number accepted by the command
- an unknown flag was passed to the command
- an enum flag was given an argument outside of its allowed values
- a string or list flag was not given argument


Argument objects are used to declare flags and positional parameters. Here are the properties for flags:

``` js
{
    value: null, // to impose restrictions on the value of the parameter, it supports 4 different options, described later
    alias: null, // to assign an alias to the flag
    default: null, // to assign a default value to the parameter
    parser: (newValue, previousValue) => {} // a parsing function specific to the flag
}
```

The value field can have the following contents:
- 'bool' (a boolean flag)
- 'string' (the flag is expected to receive an argument)
- 'list' (with the format `--list-flag=first,second,third`)
- ['option', 'anotherOption'] (passing an array of strings will generate an enum flag that can only take one of the declared values as argument)

Positional parameters support a limited version of the object: 

``` js
{
    default: null, // to assign a default value to the parameter
    parser: (newValue) => {} // a parsing function specific to the parameter
}
```

#### `const result = m.parse(argv = argv = process.argv.splice(2))`

Run this method to get the parsed values.


#### `m.sub(...supercommands, commandName, [subCommandObject])`

To avoid writing deeply nested subcommand objects, this method allows to insert a subcommand object into another command object. For example

``` js
m.sub('create', {})
```

will add a subcommand `create` to the main command object. While 

``` js
m.sub('create', 'page', {})
```

will add a subcommand `page` to the subcommand `create`, to be called with `cliName create page`.