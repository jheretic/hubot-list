const Helper = require("hubot-test-helper");
const chai = require("chai");

const { expect } = chai;

const helper = new Helper("../src/list.js");

describe("list", function() {
  process.env.HUBOT_LIST_ADMINS = "alice";
  beforeEach(function() {
    this.room = helper.createRoom();
  });

  afterEach(function() {
    this.room.destroy();
  });

  it("creates a list", function() {
    this.room.user.say("alice", "@hubot list create test").then(() => {
      expect(this.room.messages).to.eql([
        ["alice", "@hubot list create test"],
        ["hubot", "Created list test."]
      ]);
    });
  });

  it("failed to create a list", function() {
    this.room.user.say("bob", "@hubot list create test").then(() => {
      expect(this.room.messages).to.eql([
        ["bob", "@hubot list create test"],
        ["hubot", "@bob I'm sorry, @bob, but you don't have access to do that."]
      ]);
    });
  });
});
