'use strict';
require('dotenv').config();

const nock = require('nock');
const httpMocks = require('node-mocks-http');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const Agent = models.Agent;
const Profile = require('passport-auth0/lib/Profile');

const sessionAuth = require('../../lib/sessionAuth');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../fixtures/sample-auth0-identity-token');

describe('sessionAuth', function() {

  let agent, request, response;

  describe('returning visitor', () => {

    let authenticatedSession;
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

    it('attaches agent to request object', done => {
      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        user: new Profile(_identity)
      });

      sessionAuth(request, response, function(err) {
        if (err) return done.fail(err);
        expect(request.agent.email).toEqual(agent.email);
        done();
      });
    });

    it('saves the Identity Token in the agent\'s socialProfile', done => {
      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        user: new Profile(_identity)
      });

      expect(agent.socialProfile).toBeNull();

      sessionAuth(request, response, function(err) {
        if (err) return done.fail(err);

        models.Agent.findOne({ where: { email: _identity.email }}).then(agent => {
          expect(agent.socialProfile).toEqual(_identity);
          done();

        }).catch(err => {
          done.fail(err);
        });
      });
    });
  });

  describe('first visit', () => {
    beforeEach(function(done) {
      response = httpMocks.createResponse();
  
      models.sequelize.sync({force: true}).then(() => {
        done();
      }).catch(err => {
        done.fail(err);
      });
    });

    it('attaches agent to request object', done => {
      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        user: new Profile(_identity)
      });

      sessionAuth(request, response, function(err) {
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
        user: new Profile(_identity)
      });

      Agent.findAll().then(a => {
        expect(a.length).toEqual(0);

        sessionAuth(request, response, function(err) {
          if (err) return done.fail(err);
          Agent.findOne({ where: { email: _identity.email } }).then(a => {
            expect(request.agent.dataValues).toEqual(a.dataValues);
            done();
          }).catch(err => {
            done.fail(err);
          });
        });

      }).catch(err => {
        done.fail();
      });
    });

    it('saves the Identity Token in the agent\'s socialProfile', done => {
      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        user: new Profile(_identity)
      });

      sessionAuth(request, response, function(err) {
        if (err) return done.fail(err);
        expect(request.agent.socialProfile).toEqual(_identity);
        Agent.findOne({ where: { email: request.agent.email } }).then(a => {
          expect(request.agent.socialProfile).toEqual(a.socialProfile);
          done();
        }).catch(err => {
          done.fail(err);
        });
      });
    });
  });

  /**
   * An invited agent won't have any profile data set expect for email
   */
  describe('invited agent', () => {

    let invitedAgent;
    beforeEach(done => {
      models.sequelize.sync({force: true}).then(() => {
        invitedAgent = new Agent({ email: _identity.email });
        invitedAgent.save().then(res => {
          done();
        }).catch(err => {
          done.fail(err);
        });
      }).catch(err => {
        done.fail(err);
      });
    });

    it('populates new agent\'s fields with data from the identity token when the social profile is out of date', done => {
      request = httpMocks.createRequest({
        method: 'GET',
        url: '/agent',
        user: new Profile(_identity)
      });

      expect(invitedAgent.socialProfile).toBeNull();

      sessionAuth(request, response, function(err) {
        if (err) return done.fail(err);
        Agent.findOne({ where: { email: _identity.email } }).then(a => {
          expect(a.socialProfile).toEqual(_identity);
          expect(a.email).toEqual(_identity.email);
          expect(a.name).toEqual(_identity.name);
          done();
        }).catch(err => {
          done.fail(err);
        });
      });
    });

    it('populates new agent\'s fields with data from the identity token when the social profile is up to date', done => {
      invitedAgent.socialProfile = _identity;
      invitedAgent.save().then(savedAgent => {

        request = httpMocks.createRequest({
          method: 'GET',
          url: '/agent',
          user: new Profile(_identity)
        });

        expect(savedAgent.socialProfile).toEqual(_identity);

        sessionAuth(request, response, function(err) {
          if (err) return done.fail(err);
          Agent.findOne({ where: { email: _identity.email } }).then(a => {
            expect(a.socialProfile).toEqual(_identity);
            expect(a.email).toEqual(_identity.email);
            expect(a.name).toEqual(_identity.name);
            done();
          }).catch(err => {
            done.fail(err);
          });
        });
      }).catch(err => {
        done.fail(err);
      });
    });
  });

  describe('unauthenticated', () => {
    it('redirects to login', done => {
      response = httpMocks.createResponse();

      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        user: undefined // Passport never got a hold of the request object
      });

      expect(response.statusCode).toEqual(200);

      // This may prove a bit flaky...
      // The status code stuff happens outside anything asynchronous
      sessionAuth(request, response, function(err) {
        done.fail('Should not get here');
      });

      expect(response.statusCode).toEqual(302);
      expect(response._getRedirectUrl()).toEqual('/login');
      done();
    });
  });
});