Helper = require('hubot-test-helper')
chai = require 'chai'

expect = chai.expect

helper = new Helper('../src/list.coffee')

describe 'list', ->
  beforeEach ->
    @room = helper.createRoom()

  afterEach ->
    @room.destroy()

  it 'creates a list', ->
    @room.user.say('alice', '@hubot list create test').then =>
      expect(@room.messages).to.eql [
        ['alice', '@hubot list create test']
        ['hubot', 'Created list test.']
      ]

  it 'failed to create a list', ->
    @room.user.say('bob', '@hubot list create test').then =>
      expect(@room.messages).to.eql [
        ['bob', '@hubot list create test']
        ['hubot', "@bob I'm sorry, @bob, but you don't have access to do that."]
      ]
