const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const models = require('../../../models');
const uuid = require('uuid');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubUserRead = require('../../support/auth0Endpoints/stubUserRead');
const stubUserAppMetadataRead = require('../../support/auth0Endpoints/stubUserAppMetadataRead');
const stubUserAppMetadataUpdate = require('../../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubOrganizationRead = require('../../support/auth0Endpoints/stubOrganizationRead');
const stubTeamRead = require('../../support/auth0Endpoints/stubTeamRead');
const stubUserRolesRead = require('../../support/auth0Endpoints/stubUserRolesRead');
const stubRolesRead = require('../../support/auth0Endpoints/stubRolesRead');
const stubUserAssignRoles = require('../../support/auth0Endpoints/stubUserAssignRoles');
const scope = require('../../../config/permissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../../fixtures/sample-auth0-identity-token');
const _profile = require('../../fixtures/sample-auth0-profile-response');

describe('root/roleSpec', () => {

  let login, pub, prv, keystore;
  beforeEach(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  let originalProfile;
  afterEach(() => {
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    _profile.email = originalProfile.email;
    delete _profile.user_metadata;
  });

  let root;
  beforeEach(done => {
    originalProfile = {..._profile};
    _profile.email = process.env.ROOT_AGENT;

    models.sequelize.sync({force: true}).then(() => {
      models.Agent.create({ email: process.env.ROOT_AGENT }).then(results => {
        root = results;
        expect(root.isSuper).toBe(true);
        done();
      }).catch(err => {
        done.fail(err);
      });
    }).catch(err => {
      done.fail(err);
    });
  });

  const _roles = [
    {
      "id": "123",
      "name": "organizer",
      "description": "Manage organizations and team memberships therein"
    },
    {
      "id": "234",
      "name": "sudo",
      "description": "All-access pass to Identity resources"
    },
    {
      "id": "345",
      "name": "viewer",
      "description": "Basic agent, organization, and team viewing permissions"
    }
  ];

  describe('authorized', () => {

    let rootSession,
        userAssignRolesScope, userAssignRolesOauthTokenScope,
        rolesReadScope, rolesReadOauthTokenScope,
        userAppMetadataReadScope, userAppMetadataReadOauthTokenScope,
        userRolesReadScope, userRolesReadOauthTokenScope;

    beforeEach(done => {
      stubAuth0ManagementApi((err, apiScopes) => {
        if (err) return done.fail();

        login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, (err, session) => {
          if (err) return done.fail(err);
          rootSession = session;

          // Cached profile doesn't match "live" data, so agent needs to be updated
          // with a call to Auth0
          stubUserRead((err, apiScopes) => {
            if (err) return done.fail();

            done();
          });
        });
      });
    });

    describe('read', () => {
      beforeEach(done => {
        // Retrieve the roles to which this agent is assigned
        stubRolesRead(_roles, (err, apiScopes) => {
          if (err) return done.fail(err);
          ({rolesReadScope, rolesReadOauthTokenScope} = apiScopes);

          done();
        });
      });

      it('returns a list of all the roles', done => {
        rootSession
          .get('/role')
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) return done.fail(err);

            expect(res.body).toEqual(_roles);
            done();
          });
      });

      describe('Auth0', () => {
        it('calls Auth0 to retrieve all assignable roles', done => {
          rootSession
            .get('/role')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(rolesReadOauthTokenScope.isDone()).toBe(true);
              expect(rolesReadScope.isDone()).toBe(true);
              done();
            });
        });
      });
    });

    describe('assign', () => {

      const organizerProfile = { ..._profile, name: 'Ollie Organizer', email: 'organizer@example.com', user_id: _profile.user_id + 1 };

      describe('successfully', () => {
        beforeEach(done => {
          // Get agent to be assigned role
          stubUserAppMetadataRead(organizerProfile, (err, apiScopes) => {
            if (err) return done.fail();
            ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

            // Retrieve the roles to which this agent is assigned
            stubUserRolesRead((err, apiScopes) => {
              if (err) return done.fail(err);
              ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

              // Retrieve all the assignable roles
              stubRolesRead(_roles, (err, apiScopes) => {
                if (err) return done.fail(err);
                ({rolesReadScope, rolesReadOauthTokenScope} = apiScopes);

                // Assign the new role to the user
                stubUserAssignRoles([_roles[0].id, _roles[2].id], (err, apiScopes) => {
                  if (err) return done.fail();
                  ({userAssignRolesScope, userAssignRolesOauthTokenScope} = apiScopes);
                  done();
                });
              });
            });
          });
        });

        it('returns the agent profile', done => {
          rootSession
            .put(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.email).toEqual(organizerProfile.email);
              expect(res.body.roles.length).toEqual(2);
              expect(res.body.roles[0]).toEqual(_roles[0]);
              expect(res.body.roles[1]).toEqual(_roles[2]);
              done();
            });
        });

        describe('Auth0', () => {
          it('is called to retrieve the agent user_metadata', done => {
            rootSession
              .put(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                expect(userAppMetadataReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to retrieve the agent\'s assigned roles', done => {
            rootSession
              .put(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // 2020-6-23 Reuse token from above? This needs to be confirmed in production
                expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                expect(userRolesReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to retrieve all assignable roles', done => {
            rootSession
              .put(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // 2020-6-23 Reuse token from above? This needs to be confirmed in production
                expect(rolesReadOauthTokenScope.isDone()).toBe(false);
                expect(rolesReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to assign the role to the agent', done => {
            rootSession
              .put(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // 2020-6-23 Reuse token from above? This needs to be confirmed in production
                expect(userAssignRolesOauthTokenScope.isDone()).toBe(false);
                expect(userAssignRolesScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });

      describe('unsuccessfully', () =>{

        const assignedRoles = [];
        beforeEach(() => {
          assignedRoles.push(_roles[2]);
        });

        afterEach(() => {
          assignedRoles.length = 0;
        });

        describe('role doesn\'t exist', () => {

          beforeEach(done => {
            // Get agent to be assigned role
            stubUserAppMetadataRead(organizerProfile, (err, apiScopes) => {
              if (err) return done.fail();
              ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

              // Retrieve the roles to which this agent is assigned
              stubUserRolesRead(assignedRoles, (err, apiScopes) => {
                if (err) return done.fail(err);
                ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

                // Retrieve all the assignable roles
                stubRolesRead(_roles, (err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({rolesReadScope, rolesReadOauthTokenScope} = apiScopes);

                  done();
                });
              });
            });
          });

          it('doesn\'t barf if the role doesn\'t exist', done => {
            rootSession
              .put(`/role/333/agent/${organizerProfile.user_id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(404)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('No such role');
                done();
              });
          });
        });

        describe('agent doesn\'t exist', () => {
          beforeEach(done => {
            // Get agent to be assigned role
            stubUserAppMetadataRead(null, (err, apiScopes) => {
              if (err) return done.fail();
              ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

              done();
            }, { status: 404 });
          });

          it('doesn\'t barf if the agent doesn\'t exist', done => {
            rootSession
              .put(`/role/${_roles[0].id}/agent/333`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(404)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('No such agent');
                done();
              });
          });
        });

        describe('role already assigned', () => {
          beforeEach(done => {
            assignedRoles.push(_roles[0]);

            // Get agent to be assigned role
            stubUserAppMetadataRead(organizerProfile, (err, apiScopes) => {
              if (err) return done.fail();
              ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

              // Retrieve the roles to which this agent is assigned
              stubUserRolesRead(assignedRoles, (err, apiScopes) => {
                if (err) return done.fail(err);
                ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

                done();
              });
            });
          });

          it('doesn\'t barf if the agent is already assigned to the role', done => {
            assignedRoles.push(_roles[0]);
            rootSession
              .put(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('Role already assigned');
                done();
              });
          });
        });
      });
    });

    describe('divest', () => {

      const organizerProfile = { ..._profile, name: 'Ollie Organizer', email: 'organizer@example.com', user_id: _profile.user_id + 1 };

      describe('successfully', () => {

        beforeEach(done => {
          // Retrieve the roles to which this agent is assigned
          stubUserRolesRead([_roles[2], _roles[0]], (err, apiScopes) => {
            if (err) return done.fail(err);
            ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

            // Remove the role from the user
            stubUserAssignRoles([_roles[2].id], (err, apiScopes) => {
              if (err) return done.fail();
              ({userAssignRolesScope, userAssignRolesOauthTokenScope} = apiScopes);

              // Get the agent formerly assigned to the role
              stubUserAppMetadataRead(organizerProfile, (err, apiScopes) => {
                if (err) return done.fail();
                ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

                done();
              });
            });
          });
        });

        it('returns the agent profile', done => {
          rootSession
            .delete(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.email).toEqual(organizerProfile.email);
              expect(res.body.roles.length).toEqual(1);
              expect(res.body.roles[0]).toEqual(_roles[2]);
              done();
            });
        });

        describe('Auth0', () => {
          it('is called to retrieve the agent\'s assigned roles', done => {
            rootSession
              .delete(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userRolesReadOauthTokenScope.isDone()).toBe(true);
                expect(userRolesReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to remove the role from the agent', done => {
            rootSession
              .delete(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // 2020-6-23 Reuse token from above? This needs to be confirmed in production
                expect(userAssignRolesOauthTokenScope.isDone()).toBe(false);
                expect(userAssignRolesScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to retrieve the agent user_metadata', done => {
            rootSession
              .delete(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // 2020-6-23 Reuse token from above? This needs to be confirmed in production
                expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(false);
                expect(userAppMetadataReadScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });

      describe('unsuccessfully', () => {

        describe('role doesn\'t exist', () => {

          beforeEach(done => {
            // Get the agent formerly assigned to the role
            stubUserAppMetadataRead(organizerProfile, (err, apiScopes) => {
              if (err) return done.fail();
              ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

              // Retrieve the roles to which this agent is assigned
              stubUserRolesRead([_roles[2], _roles[0]], (err, apiScopes) => {
                if (err) return done.fail(err);
                ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

                // Remove the role from the user
                stubUserAssignRoles([_roles[2].id], (err, apiScopes) => {
                  if (err) return done.fail();
                  ({userAssignRolesScope, userAssignRolesOauthTokenScope} = apiScopes);

                  done();
                });
              });
            });
          });

          it('doesn\'t barf if the role doesn\'t exist', done => {
            rootSession
              .delete(`/role/333/agent/${organizerProfile.user_id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(404)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('Role not assigned');
                done();
              });
          });
        });

        describe('agent doesn\'t exist', () => {
          beforeEach(done => {
            // Get the agent formerly assigned to the role
            stubUserAppMetadataRead(null, (err, apiScopes) => {
              if (err) return done.fail();
              ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

              done();
            }, { status: 404 });
          });

          it('doesn\'t barf if the agent doesn\'t exist', done => {
            rootSession
              .delete(`/role/${_roles[0].id}/agent/333`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(404)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('No such agent');
                done();
              });
          });
        });

        describe('agent is not assigned role', () => {
          beforeEach(done => {
            // Get the agent formerly assigned to the role
            stubUserAppMetadataRead(organizerProfile, (err, apiScopes) => {
              if (err) return done.fail();
              ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

              // Retrieve the roles to which this agent is assigned
              stubUserRolesRead([_roles[2], _roles[0]], (err, apiScopes) => {
                if (err) return done.fail(err);
                ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

                done();
              });
            });
          });

          it('doesn\'t barf if the agent is not assigned to the role', done => {
            expect(_roles[1].name).toEqual('sudo');
            rootSession
              .delete(`/role/${_roles[1].id}/agent/${organizerProfile.user_id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('Role not assigned');
                done();
              });
          });
        });
      });
    });
  });
});
