const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const nock = require('nock');
const request = require('supertest');
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
const stubUserDeleteRoles = require('../../support/auth0Endpoints/stubUserDeleteRoles');
const scope = require('../../../config/permissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = { ...require('../../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_CUSTOM_DOMAIN}/`};
const _profile = require('../../fixtures/sample-auth0-profile-response');
const _roles = require('../../fixtures/roles');

describe('root/roleSpec', () => {

  let login, pub, prv, keystore,
      root, originalProfile;
  beforeEach(done => {
    originalProfile = {..._profile};

    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);

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
  });

  afterEach(() => {
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    _profile.email = originalProfile.email;
    delete _profile.user_metadata;
  });

  describe('authorized', () => {

    let rootSession,
        userAssignRolesScope, userAssignRolesOauthTokenScope,
        rolesReadScope, rolesReadOauthTokenScope,
        userAppMetadataReadScope, userAppMetadataReadOauthTokenScope,
        userRolesReadScope, userRolesReadOauthTokenScope,
        accessToken;

    beforeEach(done => {
      _profile.email = process.env.ROOT_AGENT;

      stubAuth0ManagementApi((err, apiScopes) => {
        if (err) return done.fail();

        login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, (err, session, token) => {
          if (err) return done.fail(err);
          accessToken = token;
          rootSession = session;

          done();
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

      describe('session access', () => {

        it('returns a list of all the roles', done => {
          rootSession
            .get('/role')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
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
              .expect(200)
              .end((err, res) => {
                if (err) return done.fail(err);

                expect(rolesReadOauthTokenScope.isDone()).toBe(true);
                expect(rolesReadScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });

      describe('Bearer token access', () => {

        beforeEach(() => {
          const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
            .get(/userinfo/)
            .reply(200, {..._identity, email: process.env.ROOT_AGENT });
        });

        it('returns a list of all the roles', done => {
          request(app)
            .get('/role')
            .set('Authorization', `Bearer ${accessToken}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) return done.fail(err);

              expect(res.body).toEqual(_roles);
              done();
            });
        });

        describe('Auth0', () => {
          it('calls Auth0 to retrieve all assignable roles', done => {
            request(app)
              .get('/role')
              .set('Authorization', `Bearer ${accessToken}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) return done.fail(err);

                expect(rolesReadOauthTokenScope.isDone()).toBe(true);
                expect(rolesReadScope.isDone()).toBe(true);
                done();
              });
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

        describe('session access', () => {

          it('returns the agent profile', done => {
            rootSession
              .put(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end((err, res) => {
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
                .end((err, res) => {
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
                .end((err, res) => {
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
                .end((err, res) => {
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
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // 2020-6-23 Reuse token from above? This needs to be confirmed in production
                  expect(userAssignRolesOauthTokenScope.isDone()).toBe(false);
                  expect(userAssignRolesScope.isDone()).toBe(true);
                  done();
                });
            });
          });
        });

        describe('Bearer token access', () => {

          beforeEach(() => {
            const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
              .get(/userinfo/)
              .reply(200, {..._identity, email: process.env.ROOT_AGENT });
          });

          it('returns the agent profile', done => {
            request(app)
              .put(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
              .set('Authorization', `Bearer ${accessToken}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end((err, res) => {
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
              request(app)
                .put(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                  expect(userAppMetadataReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to retrieve the agent\'s assigned roles', done => {
              request(app)
                .put(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // 2020-6-23 Reuse token from above? This needs to be confirmed in production
                  expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                  expect(userRolesReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to retrieve all assignable roles', done => {
              request(app)
                .put(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // 2020-6-23 Reuse token from above? This needs to be confirmed in production
                  expect(rolesReadOauthTokenScope.isDone()).toBe(false);
                  expect(rolesReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to assign the role to the agent', done => {
              request(app)
                .put(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // 2020-6-23 Reuse token from above? This needs to be confirmed in production
                  expect(userAssignRolesOauthTokenScope.isDone()).toBe(false);
                  expect(userAssignRolesScope.isDone()).toBe(true);
                  done();
                });
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

          describe('session access', () => {

            it('doesn\'t barf if the role doesn\'t exist', done => {
              rootSession
                .put(`/role/333/agent/${organizerProfile.user_id}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('No such role');
                  done();
                });
            });
          });

          describe('Bearer token access', () => {
            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, {..._identity, email: process.env.ROOT_AGENT });
            });

            it('doesn\'t barf if the role doesn\'t exist', done => {
              request(app)
                .put(`/role/333/agent/${organizerProfile.user_id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('No such role');
                  done();
                });
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

          describe('session access', () => {

            it('doesn\'t barf if the agent doesn\'t exist', done => {
              rootSession
                .put(`/role/${_roles[0].id}/agent/333`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('No such agent');
                  done();
                });
            });
          });

          describe('Bearer token access', () => {
            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, {..._identity, email: process.env.ROOT_AGENT });
            });

            it('doesn\'t barf if the agent doesn\'t exist', done => {
              request(app)
                .put(`/role/${_roles[0].id}/agent/333`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('No such agent');
                  done();
                });
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

          describe('session access', () => {

            it('doesn\'t barf if the agent is already assigned to the role', done => {
              assignedRoles.push(_roles[0]);
              rootSession
                .put(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('Role already assigned');
                  done();
                });
            });
          });

          describe('Bearer token access', () => {

            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, {..._identity, email: process.env.ROOT_AGENT });
            });

            it('doesn\'t barf if the agent is already assigned to the role', done => {
              assignedRoles.push(_roles[0]);
              request(app)
                .put(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('Role already assigned');
                  done();
                });
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
            stubUserDeleteRoles([_roles[0].id], (err, apiScopes) => {
              if (err) return done.fail();
              ({userDeleteRolesScope, userDeleteRolesOauthTokenScope} = apiScopes);

              // Get the agent formerly assigned to the role
              stubUserAppMetadataRead(organizerProfile, (err, apiScopes) => {
                if (err) return done.fail();
                ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

                done();
              });
            });
          });
        });

        describe('session access', () => {

          it('returns the agent profile', done => {
            rootSession
              .delete(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.email).toEqual(organizerProfile.email);
                expect(res.body.roles.length).toEqual(1);
                expect(res.body.roles[0]).toEqual(_roles[2]);
                done();
              });
          });

          describe('Auth0', () => {
            it('is called to retrieve the agent user_metadata', done => {
              rootSession
                .delete(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                  expect(userAppMetadataReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to retrieve the agent\'s assigned roles', done => {
              rootSession
                .delete(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // 2020-6-23 Reuse token from above? This needs to be confirmed in production
                  expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
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
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // 2020-6-23 Reuse token from above? This needs to be confirmed in production
                  expect(userDeleteRolesOauthTokenScope.isDone()).toBe(false);
                  expect(userDeleteRolesScope.isDone()).toBe(true);
                  done();
                });
            });
          });
        });

        describe('Bearer token access', () => {

          beforeEach(() => {
            const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
              .get(/userinfo/)
              .reply(200, {..._identity, email: process.env.ROOT_AGENT });
          });

          it('returns the agent profile', done => {
            request(app)
              .delete(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
              .set('Authorization', `Bearer ${accessToken}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.email).toEqual(organizerProfile.email);
                expect(res.body.roles.length).toEqual(1);
                expect(res.body.roles[0]).toEqual(_roles[2]);
                done();
              });
          });

          describe('Auth0', () => {
            it('is called to retrieve the agent user_metadata', done => {
              request(app)
                .delete(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                  expect(userAppMetadataReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to retrieve the agent\'s assigned roles', done => {
              request(app)
                .delete(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // 2020-6-23 Reuse token from above? This needs to be confirmed in production
                  expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                  expect(userRolesReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to remove the role from the agent', done => {
              request(app)
                .delete(`/role/${_roles[0].id}/agent/${organizerProfile.user_id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // 2020-6-23 Reuse token from above? This needs to be confirmed in production
                  expect(userDeleteRolesOauthTokenScope.isDone()).toBe(false);
                  expect(userDeleteRolesScope.isDone()).toBe(true);
                  done();
                });
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
              .end((err, res) => {
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

          describe('session access', () => {

            it('doesn\'t barf if the agent doesn\'t exist', done => {
              rootSession
                .delete(`/role/${_roles[0].id}/agent/333`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('No such agent');
                  done();
                });
            });
          });

          describe('Bearer token access', () => {

            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, {..._identity, email: process.env.ROOT_AGENT });
            });

            it('doesn\'t barf if the agent doesn\'t exist', done => {
              request(app)
                .delete(`/role/${_roles[0].id}/agent/333`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('No such agent');
                  done();
                });
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

          describe('session access', () => {

            it('doesn\'t barf if the agent is not assigned to the role', done => {
              expect(_roles[1].name).toEqual('sudo');
              rootSession
                .delete(`/role/${_roles[1].id}/agent/${organizerProfile.user_id}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('Role not assigned');
                  done();
                });
            });
          });

          describe('Bearer token access', () => {

            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, {..._identity, email: process.env.ROOT_AGENT });
            });

            it('doesn\'t barf if the agent is not assigned to the role', done => {
              expect(_roles[1].name).toEqual('sudo');
              request(app)
                .delete(`/role/${_roles[1].id}/agent/${organizerProfile.user_id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end((err, res) => {
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

  describe('unauthorized', () => {
    const unauthorizedProfile = { ..._profile, name: 'Regular Guy', email: 'someregularguy@example.com', user_id: _profile.user_id + 1 };
    beforeEach(done => {
      stubAuth0ManagementApi({ userRead: unauthorizedProfile }, (err, apiScopes) => {
        if (err) return done.fail();

        login({..._identity, email: unauthorizedProfile.email, name: unauthorizedProfile.name}, (err, session, token) => {
          if (err) return done.fail(err);
          accessToken = token;
          unauthorizedSession = session;

          done();
        });
      });
    });

    describe('session access', () => {

      describe('read', () => {
        it('returns 403', done => {
          unauthorizedSession
            .get('/role')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end((err, res) => {
              if (err) return done.fail(err);

              expect(res.body.message).toEqual('Insufficient scope');
              done();
            });
        });
      });

      describe('assign', () => {
        it('returns 403', done => {
          unauthorizedSession
            .put(`/role/${_roles[0].id}/agent/${unauthorizedProfile.user_id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end((err, res) => {
              if (err) return done.fail(err);

              expect(res.body.message).toEqual('Insufficient scope');
              done();
            });
        });
      });

      describe('divest', () => {
        it('returns 403', done => {
          unauthorizedSession
            .delete(`/role/${_roles[0].id}/agent/${unauthorizedProfile.user_id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end((err, res) => {
              if (err) return done.fail(err);

              expect(res.body.message).toEqual('Insufficient scope');
              done();
            });
        });
      });
    });

    describe('Bearer token access', () => {

      beforeEach(() => {
        const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
          .get(/userinfo/)
          .reply(200, {..._identity });
      });

      describe('read', () => {
        it('returns 403', done => {
          request(app)
            .get('/role')
            .set('Authorization', `Bearer ${accessToken}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end((err, res) => {
              if (err) return done.fail(err);

              expect(res.body.message).toEqual('Insufficient scope');
              done();
            });
        });
      });

      describe('assign', () => {
        it('returns 403', done => {
          request(app)
            .put(`/role/${_roles[0].id}/agent/${unauthorizedProfile.user_id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end((err, res) => {
              if (err) return done.fail(err);

              expect(res.body.message).toEqual('Insufficient scope');
              done();
            });
        });
      });

      describe('divest', () => {
        it('returns 403', done => {
          request(app)
            .delete(`/role/${_roles[0].id}/agent/${unauthorizedProfile.user_id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end((err, res) => {
              if (err) return done.fail(err);

              expect(res.body.message).toEqual('Insufficient scope');
              done();
            });
        });
      });
    });
  });
});
