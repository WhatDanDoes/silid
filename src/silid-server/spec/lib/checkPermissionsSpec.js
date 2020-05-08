'use strict';
require('dotenv').config();

const nock = require('nock');
const httpMocks = require('node-mocks-http');
const fixtures = require('sequelize-fixtures');
const uuid = require('uuid');
const models = require('../../models');
const Agent = models.Agent;
const Profile = require('passport-auth0/lib/Profile');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubUserAppMetadataUpdate = require('../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubUserRead = require('../support/auth0Endpoints/stubUserRead');

const checkPermissions = require('../../lib/checkPermissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../fixtures/sample-auth0-identity-token');
const _profile = require('../fixtures/sample-auth0-profile-response');

const scope = require('../../config/permissions');
const apiScope = require('../../config/apiPermissions');
const roles = require('../../config/roles');

describe('checkPermissions', function() {

  let agent, request, response, rolesReadScope, userAssignRolesScope, userReadScope;

  beforeEach(done => {
    nock.cleanAll();
    _profile.scope = [ 'read:agents', 'read:organizations', 'read:teams' ];

    /**
     * Agents need basic viewing privileges. This stubs the
     * role-getting and role-assigning endpoints
     */
    stubAuth0ManagementApi((err, apiScopes) => {
      if (err) return done.fail(err);
      ({rolesReadScope, userAssignRolesScope, userReadScope} = apiScopes);
      done();
    });
  });

  afterEach(() => {
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    delete _profile.scope;
    delete _profile.user_metadata;
  });

  describe('returning visitor', () => {

    let authenticatedSession, profile;
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
        user: _profile
      });

      checkPermissions([scope.read.agents])(request, response, err => {
        if (err) return done.fail(err);
        expect(request.agent.email).toEqual(agent.email);
        done();
      });
    });

    it('saves the Auth0-provided profile the agent\'s socialProfile', done => {
      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        user: _profile
      });

      expect(agent.socialProfile).toBeNull();

      checkPermissions([scope.read.agents])(request, response, err => {
        if (err) return done.fail(err);

        models.Agent.findOne({ where: { email: _identity.email }}).then(agent => {
          expect(agent.socialProfile).toEqual(_profile);
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
          user: {..._profile, scope: null}
        });

        checkPermissions([])(request, response, err => {
          if (err) return done.fail(err);

          expect(rolesReadScope.isDone()).toBe(true);

          done();
        });
      });

      it('calls the management API to assign viewer role if agent not already a viewer', done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: {..._profile, scope: null}
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
          user: {..._profile, scope: roles.viewer}
        });

        checkPermissions([])(request, response, err => {
          if (err) return done.fail(err);

          expect(rolesReadScope.isDone()).toBe(false);
          expect(userAssignRolesScope.isDone()).toBe(false);

          done();
        });
      });

      it('attaches the new scoped permissions to req.user', done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: _profile,
        });

        expect(request.user.scope).toEqual(_profile.scope);

        checkPermissions([])(request, response, err => {
          if (err) return done.fail(err);

          expect(request.user.scope).toEqual([...new Set(_profile.scope.concat(roles.viewer))]);

          done();
        });
      });
    });

    /**
     * 2020-4-28
     *
     * There may come a day when we don't need the database anymore. Until that happens, these
     * tests ensure that the `req.user` object is consistent with what _should_ be stored
     * at Auth0.
     */
    describe('Auth0 caching', () => {

      let newReadScope;
      beforeEach(done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: _profile
        });

        checkPermissions([scope.read.agents])(request, response, err => {
          models.Agent.findOne({ where: { email: _identity.email }}).then(results => {
            agent = results;

            stubUserRead((err, apiScopes) => {
              if (err) return done.fail(err);
              ({userReadScope: newReadScope} = apiScopes);
              done();
            });
          }).catch(err => {
            done.fail(err);
          });
        });

      });

      it('does not call the management API if Auth0 and the local cache data are consistent', done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: _profile
        });

        agent.socialProfile = _profile;
        agent.save().then(() => {
          expect(agent.socialProfile).toEqual(_profile);

          checkPermissions([scope.read.agents])(request, response, err => {
            if (err) return done.fail(err);

            expect(newReadScope.isDone()).toBe(false);

            done();
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('calls the management API if there is inconsistency between Auth0 and the local cache', done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: _profile
        });

        agent.socialProfile = {..._profile, user_metadata: { teams: [] }};

        agent.save().then(() => {
          checkPermissions([scope.read.agents])(request, response, err => {
            if (err) return done.fail(err);

            expect(newReadScope.isDone()).toBe(true);

            done();
          });
        }).catch(err => {
          done.fail(err);
        });
      });
    });

  });

  describe('first visit', () => {

    let profile, userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope;
    beforeEach(function(done) {
      response = httpMocks.createResponse();

      models.sequelize.sync({force: true}).then(() => {

        stubUserAppMetadataUpdate((err, apiScopes) => {
          if (err) return done.fail();
          ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
          done();
        });
      }).catch(err => {
        done.fail(err);
      });
    });

    it('attaches agent to request object', done => {
      request = httpMocks.createRequest({
        method: 'POST',
        url: '/agent',
        user: {..._profile, scope: undefined}
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
        user: {..._profile, scope: undefined}
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
        user: {..._profile, scope: undefined}
      });

      checkPermissions([scope.read.agents])(request, response, err => {
        if (err) return done.fail(err);
        expect(request.agent.socialProfile).toEqual(_profile);
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
          user: {..._profile, scope: undefined}
        });

        checkPermissions([])(request, response, err => {
          if (err) return done.fail(err);

          expect(rolesReadScope.isDone()).toBe(true);
          expect(userAssignRolesScope.isDone()).toBe(true);

          done();
        });
      });

      it('attaches the new scoped permissions to req.user', done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: {..._profile, scope: undefined}
        });

        expect(request.user.scope).toBeUndefined();

        checkPermissions([])(request, response, err => {
          if (err) return done.fail(err);

          expect(request.user.scope).toEqual(_profile.scope);

          done();
        });
      });
    });

    describe('with pending team invitations', () => {
      beforeEach(done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: {..._profile, email: 'somebrandnewguy@example.com', scope: undefined}
        });

        done();
      });

      describe('a single invitation', () => {
        let teamId;
        beforeEach(done => {
          teamId = uuid.v4();

          models.Invitation.create({name: 'The Calgary Roughnecks', uuid: teamId, type: 'team', recipient: 'somebrandnewguy@example.com'}).then(result => {
            done();
          }).catch(err => {
            done.fail(err);
          });
        });


        it('removes the invitation from the database', done => {
          models.Invitation.findAll().then(invites => {
            expect(invites.length).toEqual(1);

            checkPermissions([])(request, response, err => {
              if (err) return done.fail(err);

              models.Invitation.findAll().then(invites => {
                expect(invites.length).toEqual(0);

                done();
              }).catch(err => {
                done.fail(err);
              });
            });
          }).catch(err => {
            done.fail(err);
          });
        });

        it('writes the invite to the agent\'s user_metadata', done => {
          expect(request.user.user_metadata).toBeUndefined();
          checkPermissions([])(request, response, err => {
            if (err) return done.fail(err);

            expect(request.user.user_metadata).toBeDefined();
            expect(request.user.user_metadata.rsvps.length).toEqual(1);
            expect(request.user.user_metadata.rsvps[0].uuid).toEqual(teamId);
            expect(request.user.user_metadata.rsvps[0].name).toEqual('The Calgary Roughnecks');
            expect(request.user.user_metadata.rsvps[0].type).toEqual('team');
            expect(request.user.user_metadata.rsvps[0].recipient).toEqual('somebrandnewguy@example.com');

            done();
          });
        });

        describe('Auth0', () => {
          it('is called to write the invitations to the agent\'s user_metadata', done => {
            checkPermissions([])(request, response, err => {
              if (err) return done.fail(err);

              expect(userAppMetadataUpdateScope.isDone()).toBe(true);
              expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);

              done();
            });
          });
        });

        describe('and now multiple invitations', () => {
          let anotherTeamId;
          beforeEach(done => {
            anotherTeamId = uuid.v4();

            models.Invitation.create({name: 'The Buffalo Bandits', uuid: anotherTeamId, type: 'team', recipient: 'somebrandnewguy@example.com'}).then(result => {
              done();
            }).catch(err => {
              done.fail(err);
            });
          });

          it('removes the invitation from the database', done => {
            models.Invitation.findAll().then(invites => {
              expect(invites.length).toEqual(2);

              checkPermissions([])(request, response, err => {
                if (err) return done.fail(err);

                models.Invitation.findAll().then(invites => {
                  expect(invites.length).toEqual(0);

                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
            }).catch(err => {
              done.fail(err);
            });
          });

          it('writes the invite to the agent\'s user_metadata', done => {
            expect(request.user.user_metadata).toBeUndefined();
            checkPermissions([])(request, response, err => {
              if (err) return done.fail(err);

              expect(request.user.user_metadata).toBeDefined();
              expect(request.user.user_metadata.rsvps.length).toEqual(2);

              expect(request.user.user_metadata.rsvps[0].uuid).toEqual(anotherTeamId);
              expect(request.user.user_metadata.rsvps[0].name).toEqual('The Buffalo Bandits');
              expect(request.user.user_metadata.rsvps[0].type).toEqual('team');
              expect(request.user.user_metadata.rsvps[0].recipient).toEqual('somebrandnewguy@example.com');

              expect(request.user.user_metadata.rsvps[1].uuid).toEqual(teamId);
              expect(request.user.user_metadata.rsvps[1].name).toEqual('The Calgary Roughnecks');
              expect(request.user.user_metadata.rsvps[1].type).toEqual('team');
              expect(request.user.user_metadata.rsvps[1].recipient).toEqual('somebrandnewguy@example.com');

              done();
            });
          });

          describe('Auth0', () => {
            it('is called to write the invitations to the agent\'s user_metadata', done => {
              checkPermissions([])(request, response, err => {
                if (err) return done.fail(err);

                expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);

                done();
              });
            });
          });
        });
      });
    });
  });

  /**
   * An invited agent won't have any profile data set expect for email
   */
  describe('invited agent', () => {

    let invitedAgent, profile, userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope;
    beforeEach(done => {
      models.sequelize.sync({force: true}).then(() => {
        invitedAgent = new Agent({ email: _identity.email });
        invitedAgent.save().then(res => {
          stubUserAppMetadataUpdate((err, apiScopes) => {
            if (err) return done.fail();
            ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
            done();
          });
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
        user: _profile
      });

      expect(invitedAgent.socialProfile).toBeNull();

      checkPermissions([scope.read.agents])(request, response, err => {
        if (err) return done.fail(err);
        Agent.findOne({ where: { email: _identity.email } }).then(a => {
          expect(a.socialProfile).toEqual(_profile);
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
          user: _profile
        });

        expect(savedAgent.socialProfile).toEqual(_identity);

        checkPermissions([scope.read.agents])(request, response, err => {
          if (err) return done.fail(err);
          Agent.findOne({ where: { email: _identity.email } }).then(a => {
            expect(a.socialProfile).toEqual(_profile);
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
          user: {..._profile, scope: undefined}
        });

        checkPermissions([])(request, response, err => {
          if (err) return done.fail(err);

          expect(rolesReadScope.isDone()).toBe(true);
          expect(userAssignRolesScope.isDone()).toBe(true);

          done();
        });
      });

      it('attaches the new scoped permissions to req.user', done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: {..._profile, scope: undefined}
        });

        expect(request.user.scope).toBeUndefined();

        checkPermissions([])(request, response, err => {
          if (err) return done.fail(err);

          expect(request.user.scope).toEqual(_profile.scope);

          done();
        });
      });
    });

    describe('with pending team invitations', () => {
      beforeEach(done => {
        request = httpMocks.createRequest({
          method: 'POST',
          url: '/agent',
          user: {..._profile, scope: undefined}
        });

        done();
      });

      describe('a single invitation', () => {
        let teamId;
        beforeEach(done => {
          teamId = uuid.v4();

          models.Invitation.create({name: 'The Calgary Roughnecks', uuid: teamId, type: 'team', recipient: _profile.email}).then(result => {
            done();
          }).catch(err => {
            done.fail(err);
          });
        });


        it('removes the invitation from the database', done => {
          models.Invitation.findAll().then(invites => {
            expect(invites.length).toEqual(1);

            checkPermissions([])(request, response, err => {
              if (err) return done.fail(err);

              models.Invitation.findAll().then(invites => {
                expect(invites.length).toEqual(0);

                done();
              }).catch(err => {
                done.fail(err);
              });
            });
          }).catch(err => {
            done.fail(err);
          });
        });

        it('writes the invite to the agent\'s user_metadata', done => {
          expect(request.user.user_metadata).toBeUndefined();
          checkPermissions([])(request, response, err => {
            if (err) return done.fail(err);

            expect(request.user.user_metadata).toBeDefined();
            expect(request.user.user_metadata.rsvps.length).toEqual(1);
            expect(request.user.user_metadata.rsvps[0].uuid).toEqual(teamId);
            expect(request.user.user_metadata.rsvps[0].name).toEqual('The Calgary Roughnecks');
            expect(request.user.user_metadata.rsvps[0].type).toEqual('team');
            expect(request.user.user_metadata.rsvps[0].recipient).toEqual(_profile.email);

            done();
          });
        });

        describe('Auth0', () => {
          it('is called to write the invitations to the agent\'s user_metadata', done => {
            request = httpMocks.createRequest({
              method: 'POST',
              url: '/agent',
              user: {..._profile, scope: undefined}
            });

            checkPermissions([])(request, response, err => {
              if (err) return done.fail(err);

              expect(userAppMetadataUpdateScope.isDone()).toBe(true);
              expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);

              done();
            });
          });
        });

        describe('multiple invitations', () => {
          let anotherTeamId;
          beforeEach(done => {
            anotherTeamId = uuid.v4();

            models.Invitation.create({name: 'The Buffalo Bandits', uuid: anotherTeamId, type: 'team', recipient: _profile.email}).then(result => {
              done();
            }).catch(err => {
              done.fail(err);
            });
          });

          it('removes the invitation from the database', done => {
            models.Invitation.findAll().then(invites => {
              expect(invites.length).toEqual(2);

              checkPermissions([])(request, response, err => {
                if (err) return done.fail(err);

                models.Invitation.findAll().then(invites => {
                  expect(invites.length).toEqual(0);

                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
            }).catch(err => {
              done.fail(err);
            });
          });

          it('writes the invite to the agent\'s user_metadata', done => {
            expect(request.user.user_metadata).toBeUndefined();
            checkPermissions([])(request, response, err => {
              if (err) return done.fail(err);

              expect(request.user.user_metadata).toBeDefined();
              expect(request.user.user_metadata.rsvps.length).toEqual(2);

              expect(request.user.user_metadata.rsvps[0].uuid).toEqual(anotherTeamId);
              expect(request.user.user_metadata.rsvps[0].name).toEqual('The Buffalo Bandits');
              expect(request.user.user_metadata.rsvps[0].type).toEqual('team');
              expect(request.user.user_metadata.rsvps[0].recipient).toEqual(_profile.email);

              expect(request.user.user_metadata.rsvps[1].uuid).toEqual(teamId);
              expect(request.user.user_metadata.rsvps[1].name).toEqual('The Calgary Roughnecks');
              expect(request.user.user_metadata.rsvps[1].type).toEqual('team');
              expect(request.user.user_metadata.rsvps[1].recipient).toEqual(_profile.email);

              done();
            });
          });

          describe('Auth0', () => {
            it('is called to write the invitations to the agent\'s user_metadata', done => {
              request = httpMocks.createRequest({
                method: 'POST',
                url: '/agent',
                user: {..._profile, scope: undefined}
              });

              checkPermissions([])(request, response, err => {
                if (err) return done.fail(err);

                expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);

                done();
              });
            });
          });
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
        user: _profile
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
