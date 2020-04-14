'use strict';
require('dotenv').config();

const nock = require('nock');
const httpMocks = require('node-mocks-http');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const Agent = models.Agent;
const Profile = require('passport-auth0/lib/Profile');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');

const checkPermissions = require('../../lib/checkPermissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../fixtures/sample-auth0-identity-token');

const scope = require('../../config/permissions');
const apiScope = require('../../config/apiPermissions');
const roles = require('../../config/roles');

describe('checkPermissions', function() {

  let agent, request, response, getRolesScope, userAssignRolesScope;

  beforeEach(done => {
    nock.cleanAll();

    /**
     * Agents need basic viewing privileges. This stubs the
     * role-getting and role-assigning endpoints
     */
    stubAuth0ManagementApi((err, apiScopes) => {
      if (err) return done.fail(err);
      ({getRolesScope, userAssignRolesScope} = apiScopes);
      done();
    });
  });

  describe('returning visitor', () => {

    let authenticatedSession, profile;
    beforeEach(function(done) {
      response = httpMocks.createResponse();

      models.sequelize.sync({force: true}).then(() => {
        fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, models).then(() => {
          models.Agent.findAll().then(results => {
            agent = results[0];

            // Scope. Cf., app.js
            profile = new Profile(_identity);
            profile.scope = [scope.read.agents];

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
        user: profile
      });

      checkPermissions([scope.read.agents])(request, response, err => {
        if (err) return done.fail(err);
        expect(request.agent.email).toEqual(agent.email);
        done();
      });
    });

    it('saves the Profile produced by the Identity Token in the agent\'s socialProfile', done => {
      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        user: profile
      });

      expect(agent.socialProfile).toBeNull();

      checkPermissions([scope.read.agents])(request, response, err => {
        if (err) return done.fail(err);

        models.Agent.findOne({ where: { email: _identity.email }}).then(agent => {
          expect(agent.socialProfile).toEqual(JSON.parse(JSON.stringify(profile)));
          done();

        }).catch(err => {
          done.fail(err);
        });
      });
    });

    describe('Auth0 roles', () => {
      it('calls the management API to retrieve all the roles', done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: profile
        });

        checkPermissions([])(request, response, err => {
          if (err) return done.fail(err);

          expect(getRolesScope.isDone()).toBe(true);

          done();
        });
      });

      it('calls the management API to assign viewer role if agent not already a viewer', done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: profile
        });

        checkPermissions([scope.read.agents])(request, response, err => {
          if (err) return done.fail(err);

          expect(userAssignRolesScope.isDone()).toBe(true);

          done();
        });
      });


      it('does not call the management API if agent is already a viewer', done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: {...profile, scope: roles.viewer}
        });

        checkPermissions([])(request, response, err => {
          if (err) return done.fail(err);

          expect(getRolesScope.isDone()).toBe(false);
          expect(userAssignRolesScope.isDone()).toBe(false);

          done();
        });
      });

      it('attaches the new scoped permissions to req.user', done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: profile,
        });

        expect(request.user.scope).toEqual(profile.scope);

        checkPermissions([])(request, response, err => {
          if (err) return done.fail(err);

          expect(request.user.scope).toEqual([...new Set(profile.scope.concat(roles.viewer))]);

          done();
        });
      });
    });
  });

  describe('first visit', () => {

    let profile;
    beforeEach(function(done) {
      profile = new Profile(_identity);
      profile.scope = [scope.read.agents];

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
        user: profile
      });

      checkPermissions([scope.read.agents])(request, response, err => {
        if (err) return done.fail(err);
        Agent.findOne({ where: { id: request.agent.id } }).then(a => {
          expect(request.agent.dataValues).toEqual(a.dataValues);
          done();
        }).catch(err => {
          done.fail(err);
        });
      });
    });

    it('adds agent to the database', done => {
      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        user: profile
      });

      Agent.findAll().then(a => {
        expect(a.length).toEqual(0);

        checkPermissions([scope.read.agents])(request, response, err => {
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
        user: profile
      });

      checkPermissions([scope.read.agents])(request, response, err => {
        if (err) return done.fail(err);
        expect(request.agent.socialProfile).toEqual(JSON.parse(JSON.stringify(profile)));
        Agent.findOne({ where: { email: request.agent.email } }).then(a => {
          expect(request.agent.socialProfile).toEqual(a.socialProfile);
          done();
        }).catch(err => {
          done.fail(err);
        });
      });
    });

    describe('Auth0 roles', () => {
      it('calls the management API to retrieve all the roles and set viewer role', done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: profile
        });

        checkPermissions([])(request, response, err => {
          if (err) return done.fail(err);

          expect(getRolesScope.isDone()).toBe(true);
          expect(userAssignRolesScope.isDone()).toBe(true);

          done();
        });
      });

      it('attaches the new scoped permissions to req.user', done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: profile,
        });

        expect(request.user.scope).toEqual(profile.scope);

        checkPermissions([])(request, response, err => {
          if (err) return done.fail(err);

          expect(request.user.scope).toEqual([...new Set(profile.scope.concat(roles.viewer))]);

          done();
        });
      });
    });
  });

  /**
   * An invited agent won't have any profile data set expect for email
   */
  describe('invited agent', () => {

    let invitedAgent, profile;
    beforeEach(done => {
      profile = new Profile(_identity);
      profile.scope = [scope.read.agents];

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
        user: profile
      });

      expect(invitedAgent.socialProfile).toBeNull();

      checkPermissions([scope.read.agents])(request, response, err => {
        if (err) return done.fail(err);
        Agent.findOne({ where: { email: _identity.email } }).then(a => {
          expect(a.socialProfile).toEqual(JSON.parse(JSON.stringify(profile)));
          expect(a.email).toEqual(_identity.email);
          expect(a.name).toEqual(_identity.name);
          done();
        }).catch(err => {
          done.fail(err);
        });
      });
    });

    it('populates new agent\'s fields with data from the identity token-generated profile when the social profile is up to date', done => {
      invitedAgent.socialProfile = _identity;
      invitedAgent.save().then(savedAgent => {

        request = httpMocks.createRequest({
          method: 'GET',
          url: '/agent',
          user: profile
        });

        expect(savedAgent.socialProfile).toEqual(_identity);

        checkPermissions([scope.read.agents])(request, response, err => {
          if (err) return done.fail(err);
          Agent.findOne({ where: { email: _identity.email } }).then(a => {
            expect(a.socialProfile).toEqual(JSON.parse(JSON.stringify(profile)));
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

    describe('Auth0 roles', () => {
      it('calls the management API to retrieve all the roles and set viewer role', done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: profile
        });

        checkPermissions([])(request, response, err => {
          if (err) return done.fail(err);

          expect(getRolesScope.isDone()).toBe(true);
          expect(userAssignRolesScope.isDone()).toBe(true);

          done();
        });
      });

      it('attaches the new scoped permissions to req.user', done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: profile,
        });

        expect(request.user.scope).toEqual(profile.scope);

        checkPermissions([])(request, response, err => {
          if (err) return done.fail(err);

          expect(request.user.scope).toEqual([...new Set(profile.scope.concat(roles.viewer))]);

          done();
        });
      });
    });
  });

  describe('unauthorized', () => {
    it('returns 403', done => {
      response = httpMocks.createResponse();

      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        user: new Profile(_identity)
      });

      expect(response.statusCode).toEqual(200);

      // This may prove a bit flaky...
      // The status code stuff happens outside anything asynchronous
      checkPermissions([scope.update.agents])(request, response, err => {
        done.fail('Should not get here');
      });

      setTimeout(() => {
        let data = JSON.parse(response._getData());
        expect(data.statusCode).toEqual(403);
        expect(data.error).toEqual('Forbidden');
        expect(data.message).toEqual('Insufficient scope');
        done();
      }, 100); // Flaky!
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
      checkPermissions([scope.read.agents])(request, response, function(err) {
        done.fail('Should not get here');
      });

      expect(response.statusCode).toEqual(302);
      expect(response._getRedirectUrl()).toEqual('/login');
      done();
    });
  });
});
