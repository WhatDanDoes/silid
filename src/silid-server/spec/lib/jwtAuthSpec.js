'use strict';
require('dotenv').config();

describe('jwtAuth', function() {
  const httpMocks = require('node-mocks-http');
  const fixtures = require('sequelize-fixtures');
  const models = require('../../models');
  const Agent = models.Agent;

  const jwt = require('jsonwebtoken');
  const jwtAuth = require('../../lib/jwtAuth');

  let agent, request, response;

  beforeEach(function(done) {
    response = httpMocks.createResponse({
      eventEmitter: require('events').EventEmitter
    });

    models.sequelize.sync({force: true}).then(() => {
      fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, models).then(() => {
        models.Agent.findAll().then(results => {
          agent = results[0];
          done();
        }).catch(err => {
          done.fail(err);
        });
      }).catch(err => {
        done.fail(err);
      });
    }).catch(err => {
      done.fail(err);
    });
  });

  it('returns 401 and message if no token provided', done => {
    request = httpMocks.createRequest({
      method: 'POST',
      url: '/agent',
      body: {}
    });

    response.on('end', function() {
      expect(response.statusCode).toEqual(401);
      expect(response._isJSON()).toBe(true);
      expect(response._getJSONData().message).toEqual('Unauthorized: No token provided');
      done();
    });

    jwtAuth(request, response, function(err) {
      done.fail('Should not get here');
    });
  });

  it('returns 401 and message if token is invalid', done => {
    request = httpMocks.createRequest({
      method: 'POST',
      url: '/agent',
      body: {
        token: 'invalidtoken'
      }
    });

    response.on('end', function() {
      expect(response.statusCode).toEqual(401);
      expect(response._isJSON()).toBe(true);
      expect(response._getJSONData().message).toEqual('Unauthorized: Invalid token');
      done();
    });


    jwtAuth(request, response, function(err) {
      done.fail('Should not get here');
    });
  });

  it('attaches agent to request object', done => {
    const token = jwt.sign({ email: agent.email }, process.env.SECRET, { expiresIn: '1h' });

    request = httpMocks.createRequest({
      method: 'POST',
      url: '/agent',
      body: {
        token: token
      }
    });

    jwtAuth(request, response, function(err) {
      if (err) return done.fail(err);
      expect(request.user).toEqual(agent);
      done();
    });
  });

  it('attaches the decoded token if agent isn\'t in the database', done => {
    const token = jwt.sign({ email: 'newagent@example.com' }, process.env.SECRET, { expiresIn: '1h' });

    request = httpMocks.createRequest({
      method: 'POST',
      url: '/agent',
      body: {
        token: token
      }
    });

    jwtAuth(request, response, function(err) {
      if (err) return done.fail(err);
      expect(request.user.email).toEqual('newagent@example.com');
      expect(request.user.iat).toBeDefined();
      expect(request.user.exp).toBeDefined();
      done();
    });
  });
});
 
