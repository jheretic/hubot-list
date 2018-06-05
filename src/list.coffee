# Description:
#   A script that expands mentions of lists. Lists themselves can be used as
#   members if prepended with '&', and mentions will be expanded recursively.
#
# Configuration:
#   HUBOT_LIST_DECORATOR - a character indicating how to decorate usernames.
#     Valid settings are '<', '(', '[', and '{'. This variable can also be left
#     unset. This setting defaults to ''.
#   HUBOT_LIST_PREPEND - set to 'false' to disable prepending the original
#     message to the response. This variable can also be left unset. This
#     setting defaults to 'true'.
#   HUBOT_LIST_PREPEND_USERNAME - set to 'false' to disable prepending the
#     original username to the prepended message. This variable can also be
#     left unset. This setting defaults to 'true'.
#   HUBOT_LIST_TRUNCATE - number of characters from the original message to
#     display when HUBOT_LIST_PREPEND is set. Set to a value less than or
#     equal to zero to disable truncating. This setting defaults to '50'.
#   HUBOT_LIST_RECURSE - set to 'false' to disable recursive list expansion.
#     The setting defaults to 'true'.
#
# Commands:
#   hubot list list - list all list names
#   hubot list dump - list all list names and members
#   hubot list create <list> - create a new list
#   hubot list destroy <list> - destroy a list
#   hubot list rename <old> <new> - rename a list
#   hubot list add <list> <name> - add name to a list
#   hubot list remove <list> <name> - remove name from a list
#   hubot list info <list> - list members in list
#   hubot list membership <name> - list lists that name is in
#
# Author:
#   anishathalye

IDENTIFIER = "[-._a-zA-Z0-9]+"

sorted = (arr) ->
  copy = (i for i in arr)
  copy.sort()

class List
  constructor: (@robot) ->
    @cache = {}

    @robot.brain.on "loaded", @load
    if @robot.brain.data.users.length
      @load()

  load: =>
    if @robot.brain.data.list
      @cache = @robot.brain.data.list
    else
      @robot.brain.data.list = @cache

  members: (list) =>
    sorted(@cache[list] or [])

  lists: =>
    sorted(Object.keys(@cache))

  exists: (list) =>
    return @cache[list]?

  create: (list) =>
    if @exists list
      return false
    else
      @cache[list] = []
      return true

  destroy: (list) =>
    if @exists list
      mem = @members list
      delete @cache[list]
      return mem
    else
      return null

  rename: (from, to) =>
    if (not @exists from) or (@exists to)
      return false
    else
      @cache[to] = @cache[from]
      delete @cache[from]
      return true

  add: (list, name) =>
    if not @exists list
      return false
    if name in @cache[list]
      return false
    else
      @cache[list].push name
      return true

  remove: (list, name) =>
    if not @exists list
      return false
    if name in @cache[list]
      idx = @cache[list].indexOf name
      @cache[list].splice idx, 1
      return true
    else
      return false

  membership: (name) =>
    lists = []
    for own list, names of @cache
      if name in names
        lists.push list
    return lists

module.exports = (robot) ->
  config = require('hubot-conf')('list', robot)
  list = new List robot

  decorate = (name) ->
    switch config('decorator', '')
      when "<" then "<@#{name}>"
      when "(" then "(@#{name})"
      when "[" then "[@#{name}]"
      when "{" then "{@#{name}}"
      else "@#{name}"

  robot.hear ///@#{IDENTIFIER}///, (res) ->
    response = []
    tagged = []
    for g in list.lists()
      if ///(^|\s)@#{g}\b///.test res.message.text
        tagged.push g
    if config('recurse') != 'false'
      process = (i for i in tagged)
      while process.length > 0
        g = process.shift()
        for mem in list.members g
          if mem[0] == '&'
            mem = mem.substring 1
            # it's a list
            if mem not in process and mem not in tagged
              tagged.push mem
              process.push mem
    # output results
    decorated = {}
    decorateOnce = (name) ->
      if name[0] == '&' or decorated[name]
        name
      else
        decorated[name] = true
        decorate name
    for g in tagged
      mem = list.members g
      if mem.length > 0
        response.push "*@#{g}*: #{(decorateOnce name for name in mem).join ", "}"
    if response.length > 0
      if config('prepend', 'true') == 'true'
        truncate = parseInt config('truncate', '50')
        text = res.message.text
        message = if truncate > 0 and text.length > truncate \
          then text.substring(0, truncate) + " [...]" else text
        if config('prepend.username', 'true') == 'true'
          message = "#{res.message.user.name}: #{message}"
        response.unshift message
      res.send response.join "\n"

  robot.respond ///list\s+list///, (res) ->
    res.send "Lists: #{list.lists().join ", "}"

  robot.respond ///list\s+dump///, (res) ->
    response = []
    for g in list.lists()
      response.push "*@#{g}*: #{list.members(g).join ", "}"
    if response.length > 0
      res.send response.join "\n"

  robot.respond ///list\s+create\s+(#{IDENTIFIER})///, (res) ->
    name = res.match[1]
    if list.create name
      res.send "Created list #{name}."
    else
      res.send "List #{name} already exists!"

  robot.respond ///list\s+destroy\s+(#{IDENTIFIER})///, (res) ->
    name = res.match[1]
    old = list.destroy name
    if old isnt null
      res.send "Destroyed list #{name} (#{old.join ", "})."
    else
      res.send "List #{name} does not exist!"

  robot.respond ///list\s+rename\s+(#{IDENTIFIER})\s+(#{IDENTIFIER})///, (res) ->
    from = res.match[1]
    to = res.match[2]
    if list.rename from, to
      res.send "Renamed list #{from} to #{to}."
    else
      res.send "Either list #{from} does not exist or #{to} already exists!"

  robot.respond ///list\s+add\s+(#{IDENTIFIER})\s+(&?#{IDENTIFIER}(?:\s+&?#{IDENTIFIER})*)///, (res) ->
    g = res.match[1]
    names = res.match[2]
    names = names.split /\s+/
    if not list.exists g
      res.send "List #{g} does not exist!"
      return
    response = []
    for name in names
      if list.add g, name
        response.push "#{name} added to list #{g}."
      else
        response.push "#{name} is already in list #{g}!"
    res.send response.join "\n"

  robot.respond ///list\s+remove\s+(#{IDENTIFIER})\s+(&?#{IDENTIFIER}(?:\s+&?#{IDENTIFIER})*)///, (res) ->
    g = res.match[1]
    names = res.match[2]
    names = names.split /\s+/
    if not list.exists g
      res.send "List #{g} does not exist!"
      return
    response = []
    for name in names
      if list.remove g, name
        response.push "#{name} removed from list #{g}."
      else
        response.push "#{name} is not in list #{g}!"
    res.send response.join "\n"

  robot.respond ///list\s+info\s+(#{IDENTIFIER})///, (res) ->
    name = res.match[1]
    if not list.exists name
      res.send "List #{name} does not exist!"
      return
    res.send "*@#{name}*: #{(list.members name).join ", "}"

  robot.respond ///list\s+membership\s+(&?#{IDENTIFIER})///, (res) ->
    name = res.match[1]
    lists = list.membership name
    if lists.length > 0
      res.send "#{name} is in #{list.membership(name).join ", "}."
    else
      res.send "#{name} is not in any lists!"
