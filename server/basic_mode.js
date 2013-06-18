(function() {
  var Class = require('clah'),
      mpd = require('mpd'),
      _ = require('underscore'),
      specialCommands;
      
      
  specialCommands = {
    list: function emitSpecializedEvent(command, args, response, client) {
      if (args.length) {
        console.log('Emitting:', command);
        
        client.emit(command, response);
        
        console.log('Emitting:', command + ':' + args[0].toLowerCase());
        
        client.emit(command + ':' + args[0].toLowerCase(), {
          args: args.slice(1),
          data: response
        });
      }
    },
    find: function emitCommandWithEverySecondArg(command, args, response, client) {
      if (args.length) {
        console.log('Emitting:', command);
        
        client.emit(command, {
          args: _.filter(args, function(v, i) { return (i % 2 == 1); }),
          data: response
        });
      }
    }
  };

  function trim(s) {
    if (!s) {
        return s;
    }

    return s.replace(/^\s+|\s+$/g, '');
  }

  function parseResponse(s) {
    if (!s) {
      return s;
    }
    
    var lines = s.split('\n'),
        obj = {},
        json = [];

    _(lines).chain().compact().each(function(l) {
      var i = l.indexOf(':'),
          key = l.slice(0, i).toLowerCase(),
          value = l.slice(i + 1);
          
      // If we ran into an existing key, it means it's a new record.
      if (obj.hasOwnProperty(key)) {
        json.push(obj);
        
        obj = {};
      }

      obj[key] = trim(value);
    });
    
    json.push(obj);

    return (json.length == 1 ? json[0] : json);
  }

  var BasicMode = Class.extend({
    init: function(mpd, clients, cmdProcessors) {
      this.type = 'freeforall';

      this.mpd = mpd;
      this.clients = clients;

      this.commandProcessors = cmdProcessors;
    },
    command: function(command, args, client) {
      var processor;
      
      command = command.toLowerCase();

      if (this.canExecute(command, client)) {

        if (!_.isArray(args)) {
          args = [args];
        }
        
        console.log('Received command [', command, args.join(' '), '] from', client.userid);

        processor = this.commandProcessors[command];

        if (processor) {

          // Run the command through the processor, which calls back with modified args (e.g. Youtube stream from url).
          processor(this.mpd, args, function(args) {
            this.execute(command, args, client);
          }.bind(this));

        }else{
          this.execute(command, args, client);
        }

        return;
      }

      client.emit(command, {
        type: 'nopermission'
      });
    },
    canExecute: function() {
      return true;
    },
    execute: function(command, args, client) {
      var cmd;

      if (!_.isArray(args)) {
        args = [args]; // Ensure array.
      }

      cmd = mpd.cmd(command, args);

      this.mpd.sendCommand(cmd, function(err, result) {
        var response = parseResponse(result),
            special = specialCommands[command];
        
        console.log('Result for command', command, ': ', result);
        
        if (special) {
          
          special(command, args, response, client);
          
        } else {
          console.log('Emitting:', command);
          
          client.emit(command, response);
        }
      });
    }
  });

  if (this.define && define.amd) {
    // Publish as AMD module
    define(function() {
      return BasicMode;
    });
  } else if (typeof(module) != 'undefined' && module.exports) {
    // Publish as node.js module
    module.exports = BasicMode;
  }
})();