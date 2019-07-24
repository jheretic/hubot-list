"use strict";

// Description:
//   A script that expands mentions of lists. Lists themselves can be used as
//   members if prepended with '&', and mentions will be expanded recursively.
//
// Commands:
//   hubot list lists - list all list names
//   hubot list dump - list all list names and members
//   hubot list create <list> - create a new list
//   hubot list destroy <list> - destroy a list
//   hubot list rename <old> <new> - rename a list
//   hubot list add <list> <name> - add name to a list
//   hubot list remove <list> <name> - remove name from a list
//   hubot list info <list> - list members in list
//   hubot list membership <name> - list lists that name is in
//
// Dependencies:
//   None
//
// Configuration:
//   HUBOT_LIST_ADMINS - Specify a comma-separated list of user IDs to
//     designate as admins that can manage and send messages to the lists.
//     This is in addition to the built-in admin group. This setting defaults
//     to ''.
//   HUBOT_LIST_DECORATOR - a character indicating how to decorate usernames.
//     Valid settings are '<', '(', '[', and '{'. This variable can also be left
//     unset. This setting defaults to ''.
//   HUBOT_LIST_PREPEND_USERNAME - set to 'true' to disable prepending the
//     original username to the prepended message. This variable can also be
//     left unset. This setting defaults to 'false'.
//   HUBOT_LIST_RECURSE - set to 'false' to disable recursive list expansion.
//     The setting defaults to 'true'.
//   HUBOT_LIST_AUTH - set to 'true' to enable a hubot-auth compatible wrapper
//     for using hubot-list as a drop-in replacement for other scripts that
//     may use hubot-auth. This setting defaults to 'false'.
//
//
// Author:
//   Josh King <jking@chambana.net>, based on hubot-group by anishathalye

const IDENTIFIER = "[-._a-zA-Z0-9]+";
const LIST_ADMINS = process.env.HUBOT_LIST_ADMINS.split(",") || "";
const LIST_DECORATOR = process.env.HUBOT_LIST_DECORATOR || "";
const LIST_PREPEND_USERNAME = process.env.HUBOT_LIST_PREPEND_USERNAME || false;
const LIST_RECURSE = process.env.HUBOT_LIST_RECURSE || false;
const LIST_AUTH = process.env.HUBOT_LIST_AUTH || false;

function sorted(arr) {
  const copy = Array.from(arr);
  return copy.sort();
}

class List {
  constructor(robot) {
    this.load = this.load.bind(this);
    this.members = this.members.bind(this);
    this.lists = this.lists.bind(this);
    this.exists = this.exists.bind(this);
    this.create = this.create.bind(this);
    this.destroy = this.destroy.bind(this);
    this.rename = this.rename.bind(this);
    this.add = this.add.bind(this);
    this.remove = this.remove.bind(this);
    this.membership = this.membership.bind(this);
    this.ismember = this.ismember.bind(this);
    this.isAdmin = this.isAdmin.bind(this);
    this.robot = robot;
    this.cache = {};
    this.robot.brain.on("loaded", this.load);
    if (this.robot.brain.data.users.length) {
      this.load();
    }
  }

  load() {
    if (this.robot.brain.data.list) {
      this.cache = this.robot.brain.data.list;
    } else {
      this.robot.brain.data.list = this.cache;
    }
    if (!this.exists("admins")) {
      this.create("admins");
    }
  }

  members(list) {
    return sorted(this.cache[list] || []);
  }

  lists() {
    return sorted(Object.keys(this.cache));
  }

  exists(list) {
    return this.cache[list] != null;
  }

  create(list) {
    if (this.exists(list)) {
      return false;
    } else {
      this.cache[list] = [];
      return true;
    }
  }

  destroy(list) {
    if (this.exists(list)) {
      const mem = this.members(list);
      delete this.cache[list];
      return mem;
    } else {
      return null;
    }
  }

  rename(from, to) {
    if (!this.exists(from) || this.exists(to)) {
      return false;
    } else {
      this.cache[to] = this.cache[from];
      delete this.cache[from];
      return true;
    }
  }

  add(list, name) {
    if (!this.exists(list)) {
      return false;
    }
    if (Array.from(this.cache[list]).includes(name)) {
      return false;
    } else {
      this.cache[list].push(name);
      return true;
    }
  }

  remove(list, name) {
    if (!this.exists(list)) {
      return false;
    }
    if (Array.from(this.cache[list]).includes(name)) {
      const idx = this.cache[list].indexOf(name);
      this.cache[list].splice(idx, 1);
      return true;
    } else {
      return false;
    }
  }

  membership(name) {
    const lists = [];
    for (let list of Object.keys(this.cache || {})) {
      const names = this.cache[list];
      if (Array.from(names).includes(name)) {
        lists.push(list);
      }
    }
    return lists;
  }

  ismember(list, name) {
    if (!this.exists(list)) {
      return false;
    }
    if (Array.from(this.cache[list]).includes(name)) {
      return true;
    } else {
      return false;
    }
  }

  isAdmin(name) {
    return (
      Array.from(LIST_ADMINS).includes(name) || this.ismember("admins", name)
    );
  }
}

class Auth {
  constructor(list) {
    this.isAdmin = this.isAdmin.bind(this);
    this.hasRole = this.hasRole.bind(this);
    this.usersWithRole = this.usersWithRole.bind(this);
    this.userRoles = this.userRoles.bind(this);
    this.list = list;
  }

  isAdmin(name) {
    return this.list.isAdmin(name);
  }

  hasRole(user, role) {
    return this.list.ismember(role, user);
  }

  usersWithRole(role) {
    return this.list.members(role);
  }

  userRoles(user) {
    return this.list.membership(name);
  }
}

module.exports = function(robot) {
  const list = new List(robot);
  if (LIST_AUTH) {
    robot.auth = new Auth(list);
  }

  robot.listenerMiddleware((context, next, done) => {
    if (context.listener.options.id === "list.send") {
      if (list.isAdmin(context.response.message.user.id)) {
        // User is allowed access to this command
        return next();
      } else {
        // Fail silently
        return done();
      }
    } else if (context.listener.options.id === "list.response") {
      return next();
    } else if (
      context.listener.options.id &&
      context.listener.options.id.match(
        new RegExp(`^list\\.[a-zA-Z0-9]+$`, "i")
      )
    ) {
      if (list.isAdmin(context.response.message.user.id)) {
        // User is allowed access to this command
        return next();
      } else {
        // Restricted command, but user isn't in whitelist
        context.response.reply(
          `I'm sorry, @${context.response.message.user.name}, but you don't have access to do that.`
        );
        return done();
      }
    } else {
      // This is not a restricted command; allow everyone
      return next();
    }
  });

  const decorate = name => {
    switch (LIST_DECORATOR) {
      case "<":
        return `<@${name}>`;
      case "(":
        return `(@${name})`;
      case "[":
        return `[@${name}]`;
      case "{":
        return `{@${name}}`;
      default:
        return `@${name}`;
    }
  };

  robot.hear(new RegExp(`@${IDENTIFIER}`), { id: "list.send" }, res => {
    let mem;
    const response = [];
    const tagged = [];
    for (var g of Array.from(list.lists())) {
      if (new RegExp(`(^|\\s)@${g}\\b`).test(res.message.text)) {
        tagged.push(g);
      }
    }
    if (LIST_RECURSE !== "false") {
      const process = Array.from(tagged);
      while (process.length > 0) {
        g = process.shift();
        for (mem of Array.from(list.members(g))) {
          if (mem[0] === "&") {
            mem = mem.substring(1);
            // it's a list
            if (
              !Array.from(process).includes(mem) &&
              !Array.from(tagged).includes(mem)
            ) {
              tagged.push(mem);
              process.push(mem);
            }
          }
        }
      }
    }
    // output results
    const decorated = {};
    const decorateOnce = name => {
      if (name[0] === "&" || decorated[name]) {
        return name;
      } else {
        decorated[name] = true;
        return decorate(name);
      }
    };
    let { text } = res.message;
    if (LIST_PREPEND_USERNAME === "true") {
      text = `${res.message.user.name}: ${message}`;
    }
    return (() => {
      const result = [];
      for (g of Array.from(tagged)) {
        mem = list.members(g);
        if (mem.length > 0) {
          if (["SlackBot", "Room"].includes(robot.adapter.constructor.name)) {
            result.push(
              (() => {
                const result1 = [];
                for (let m of Array.from(mem)) {
                  const room = robot.adapter.client.rtm.dataStore.getDMByName(
                    m
                  );
                  result1.push(res.send({ room: room.id }, text));
                }
                return result1;
              })()
            );
          } else if (["Signal"].includes(robot.adapter.constructor.name)) {
            result.push(
              (() => {
                const result1 = [];
                for (let m of Array.from(mem)) {
                  result1.push(robot.messageRoom(m, text));
                }
                return result1;
              })()
            );
          } else {
            result.push(undefined);
          }
        } else {
          result.push(undefined);
        }
      }
      return result;
    })();
  });

  robot.respond("/list lists/i", { id: "list.lists" }, res =>
    res.send(`Lists: ${list.lists().join(", ")}`)
  );

  robot.respond(new RegExp(`[L|l]ist\\s+dump`), { id: "list.dump" }, res => {
    const response = [];
    for (let g of Array.from(list.lists())) {
      response.push(`*@${g}*: ${list.members(g).join(", ")}`);
    }
    if (response.length > 0) {
      res.send(response.join("\n"));
    }
  });

  robot.respond("/list create (.*)/i", { id: "list.create" }, res => {
    const name = res.match[1];
    if (list.create(name)) {
      res.send(`Created list ${name}.`);
    } else {
      res.send(`List ${name} already exists!`);
    }
  });

  robot.respond("/list destroy (.*)/i", { id: "list.destroy" }, res => {
    const name = res.match[1];
    const old = list.destroy(name);
    if (old !== null) {
      res.send(`Destroyed list ${name} (${old.join(", ")}).`);
    } else {
      res.send(`List ${name} does not exist!`);
    }
  });

  robot.respond(
    "/list rename (.*) (to)? (.*)/i",
    { id: "list.rename" },
    res => {
      const from = res.match[1];
      const to = res.match[3];
      if (list.rename(from, to)) {
        res.send(`Renamed list ${from} to ${to}.`);
      } else {
        res.send(`Either list ${from} does not exist or ${to} already exists!`);
      }
    }
  );

  robot.respond("/list add (.*) (.*)/i", { id: "list.add" }, res => {
    const g = res.match[1];
    let names = res.match[2];
    names = names.split(/\s+/);
    if (!list.exists(g)) {
      res.send(`List ${g} does not exist!`);
      return;
    }
    const response = [];
    for (let name of Array.from(names)) {
      if (list.add(g, name)) {
        response.push(`${name} added to list ${g}.`);
      } else {
        response.push(`${name} is already in list ${g}!`);
      }
    }
    res.send(response.join("\n"));
  });

  robot.respond("/list remove (.*) (.*)/i", { id: "list.remove" }, res => {
    const g = res.match[1];
    let names = res.match[2];
    names = names.split(/\s+/);
    if (!list.exists(g)) {
      res.send(`List ${g} does not exist!`);
      return;
    }
    const response = [];
    for (let name of Array.from(names)) {
      if (list.remove(g, name)) {
        response.push(`${name} removed from list ${g}.`);
      } else {
        response.push(`${name} is not in list ${g}!`);
      }
    }
    res.send(response.join("\n"));
  });

  robot.respond("/list invite (.*) (.*)/i", { id: "list.invite" }, res => {
    const g = res.match[1];
    let names = res.match[2];
    names = names.split(/\s+/);
    if (!list.exists(g)) {
      res.send(`List ${g} does not exist!`);
      return;
    }
    const response = [];
    for (let name of Array.from(names)) {
      if (!list.ismember(g, name)) {
        robot.messageRoom(
          name,
          `You have been invited to the list ${g}, reply 'YES' (all uppercase) to accept or 'NO' to reject.`
        );
        const user = robot.brain.userForId(name);
        if (!user.invited_to) {
          user.invited_to = [];
        }
        user.invited_to.push(g);
        response.push(`${name} invited to list ${g}.`);
      } else {
        response.push(`${name} is already in list ${g}!`);
      }
    }
    res.send(response.join("\n"));
  });

  robot.respond("/(YES|NO)/", { id: "list.response" }, res => {
    const answer = res.match[1];
    const user = robot.brain.userForId(res.message.user.id);

    if (user.invited_to) {
      if (answer === "YES") {
        user.invited_to.forEach(l => {
          list.add(l, user.id);
        });
        res.send("Okay, adding you to the list!");
      } else if (answer === "NO") {
        user.invited_to = null;
        res.send("Okay, not adding you to the list!");
      }
    }
  });

  robot.respond("/list info (.*)/i", { id: "list.info" }, res => {
    const name = res.match[1];
    if (!list.exists(name)) {
      res.send(`List ${name} does not exist!`);
      return;
    }
    res.send(`*@${name}*: ${list.members(name).join(", ")}`);
  });

  robot.respond("/list membership (.*)/i", { id: "list.membership" }, res => {
    const name = res.match[1];
    const lists = list.membership(name);
    if (lists.length > 0) {
      res.send(`${name} is in ${list.membership(name).join(", ")}.`);
    } else {
      res.send(`${name} is not in any lists!`);
    }
  });
};
