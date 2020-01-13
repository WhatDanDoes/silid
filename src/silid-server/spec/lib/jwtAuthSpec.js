'use strict';
require('dotenv').config();

const nock = require('nock');
const httpMocks = require('node-mocks-http');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const Agent = models.Agent;

const jwt = require('jsonwebtoken');
const jwtAuth = require('../../lib/jwtAuth');
const NodeRSA = require('node-rsa');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _access = require('../fixtures/sample-auth0-access-token');
const _identity = require('../fixtures/sample-auth0-identity-token');

describe('jwtAuth', function() {

  /**
   * Build RSA key
   */
  let _authHeader;
  beforeAll(() => {
    const key = new NodeRSA({b: 512, e: 5});
    key.setOptions({
      encryptionScheme: {
        scheme: 'pkcs1',
        label: 'Optimization-Service'
      }
    });

    // Get public/private pair
    const pub = key.exportKey('pkcs8-public-pem');
    const prv = key.exportKey('pkcs1-private-pem');

    _authHeader = `Bearer ${jwt.sign(_access, prv, { algorithm: 'RS256', header: { kid: 'some-kid' } })}`;
  });

  let scope;
  beforeEach(() => {
    /**
     * Auth0 /userinfo mock
     */
    scope = nock(`http://${process.env.AUTH0_DOMAIN}`, {
        reqheaders: {
          'Authorization': _authHeader
        }
      })
      .get('/userinfo')
      .reply(200, _identity);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  let agent, request, response;

  describe('returning visitor', () => {
    beforeEach(function(done) {
      response = httpMocks.createResponse();
  
      models.sequelize.sync({force: true}).then(() => {
        fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, models).then(() => {
          models.Agent.findAll().then(results => {
            agent = results[0];
  
            // This agent has recently returned for a visit
            agent.accessToken = _authHeader;
            agent.save().then(() => {
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
      }).catch(err => {
        done.fail(err);
      });
    });

    it('attaches agent to request object', done => {
      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        headers: {
          'Authorization': _authHeader
        }
      });

      jwtAuth(request, response, function(err) {
        if (err) return done.fail(err);
        expect(request.agent.dataValues).toEqual(agent.dataValues);
        done();
      });
    });

    it('doesn\'t call Auth0\'s /user API if access token has been seen before', done => {
      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        headers: {
          'Authorization': _authHeader
        }
      });

      jwtAuth(request, response, function(err) {
        if (err) return done.fail(err);
        expect(request.agent.dataValues).toEqual(agent.dataValues);

        try {
          scope.done();
          return done.fail('Should not get here');
        } catch (err) {
          done();
        }
      });
    });

    it('calls Auth0\'s /user API if access token has not been seen before', done => {
      const newTokenScope = nock(`http://${process.env.AUTH0_DOMAIN}`, {
          reqheaders: {
            'Authorization': 'Bearer SomePreviouslyUnknownThoughValidToken'
          }
        })
        .get('/userinfo')
        .reply(200, _identity);

      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        headers: {
          'Authorization': 'Bearer SomePreviouslyUnknownThoughValidToken'
        }
      });

      jwtAuth(request, response, function(err) {
        if (err) return done.fail(err);
        try {
          newTokenScope.done();
          done();
        } catch (err) {
          return done.fail(err);
        }
      });
    });

    it('saves the new Access Token in the agent\'s accessToken', done => {
      const newTokenScope = nock(`http://${process.env.AUTH0_DOMAIN}`, {
          reqheaders: {
            'Authorization': 'Bearer SomePreviouslyUnknownThoughValidToken'
          }
        })
        .get('/userinfo')
        .reply(200, _identity);

      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        headers: {
          'Authorization': 'Bearer SomePreviouslyUnknownThoughValidToken'
        }
      });

      jwtAuth(request, response, function(err) {
        if (err) return done.fail(err);
        Agent.findOne({ where: { id: agent.id } }).then(a => {
          expect(a.accessToken).toEqual('Bearer SomePreviouslyUnknownThoughValidToken');
          expect(request.agent.accessToken).toEqual(a.accessToken);
          done();
        }).catch(err => {
          done.fail(err);
        });
      });
    });

    it('saves the Identity Token in the agent\'s socialProfile', done => {
      const newTokenScope = nock(`http://${process.env.AUTH0_DOMAIN}`, {
          reqheaders: {
            'Authorization': 'Bearer SomePreviouslyUnknownThoughValidToken'
          }
        })
        .get('/userinfo')
        .reply(200, _identity);

      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        headers: {
          'Authorization': 'Bearer SomePreviouslyUnknownThoughValidToken'
        }
      });

      jwtAuth(request, response, function(err) {
        if (err) return done.fail(err);
        expect(request.agent.socialProfile).toEqual(_identity);
        done();
      });
    });
  });

  describe('first visit', () => {
    beforeEach(function(done) {
      response = httpMocks.createResponse();
  
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

    it('calls Auth0\'s /userinfo API if access token isn\'t attached to an agent', done => {
      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        headers: {
          'Authorization': _authHeader
        }
      });

      Agent.findOne({ where: { accessToken: _authHeader } }).then(a => {
        expect(a).toBe(null);

        jwtAuth(request, response, function(err) {
          if (err) return done.fail(err);
          try {
            scope.done();
            done();
          } catch (err) {
            done.fail('Should not get here');
          }
        });
      }).catch(err => {
        done.fail();
      });
    });

    it('attaches agent to request object', done => {
      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        headers: {
          'Authorization': _authHeader
        }
      });

      jwtAuth(request, response, function(err) {
        if (err) return done.fail(err);
        Agent.findOne({ where: { id: agent.id } }).then(a => {
          expect(request.agent.dataValues).toEqual(a.dataValues);
          done();
        }).catch(err => {
          done.fail();
        });
      });
    });

    it('adds agent to the database', done => {
      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        headers: {
          'Authorization': _authHeader
        }
      });

      // Erase the database
      models.sequelize.sync({force: true}).then(() => {
        Agent.findOne({ where: { id: agent.id } }).then(a => {
          expect(a).toEqual(null);

          jwtAuth(request, response, function(err) {
            if (err) return done.fail(err);
            Agent.findOne({ where: { id: agent.id } }).then(a => {
              expect(request.agent.dataValues).toEqual(a.dataValues);
              done();
            }).catch(err => {
              done.fail(err);
            });
          });

        }).catch(err => {
          done.fail();
        });
      }).catch(err => {
        done.fail();
      });
    });

    it('saves the new Access Token in the agent\'s accessToken', done => {
      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        headers: {
          'Authorization': _authHeader
        }
      });

      expect(agent.accessToken).toBe(null);

      jwtAuth(request, response, function(err) {
        if (err) return done.fail(err);
        Agent.findOne({ where: { id: agent.id } }).then(a => {
          expect(a.accessToken).toEqual(_authHeader);
          expect(request.agent.accessToken).toEqual(a.accessToken);
          done();
        }).catch(err => {
          done.fail(err);
        });
      });
    });

    it('saves the Identity Token in the agent\'s socialProfile', done => {
      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        headers: {
          'Authorization': _authHeader
        }
      });

      expect(agent.socialProfile).toBe(null);

      jwtAuth(request, response, function(err) {
        if (err) return done.fail(err);
        expect(request.agent.socialProfile).toEqual(_identity);
        done();
      });
    });
  });
});
