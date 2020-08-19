/**
 * 2020-8-19
 *
 * This functionality requires Auth0 side configuration.
 *
 * An Auth0 user's root profile attributes can be updated.
 *
 * https://auth0.com/docs/users/update-root-attributes-for-users
 */
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubUserUpdate = require('../support/auth0Endpoints/stubUserUpdate');
const stubUserRead = require('../support/auth0Endpoints/stubUserRead');
const scope = require('../../config/permissions');

const _profile = require('../fixtures/sample-auth0-profile-response');

describe('agentEditSpec', () => {

  /**
   * 2019-11-13
   * Sample tokens taken from:
   *
   * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
   */
  const _identity = require('../fixtures/sample-auth0-identity-token');
  const _access = require('../fixtures/sample-auth0-access-token');

  let login, pub, prv, keystore;
  beforeEach(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  let agent;
  beforeEach(done => {
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

  describe('authenticated', () => {

    let authenticatedSession, oauthTokenScope, auth0ManagementScope, userUpdateScope, userUpdateOauthTokenScope;
    describe('authorized', () => {

      describe('update', () => {

        describe('email verified', () => {
          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail(err);

              login(_identity, [scope.create.agents], (err, session) => {
                if (err) return done.fail(err);
                authenticatedSession = session;

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

                  stubUserUpdate((err, apiScopes) => {
                    if (err) return done.fail();

                    ({userUpdateScope, userUpdateOauthTokenScope} = apiScopes);
                    done();
                  });
                });
              });
            });
          });

          it('updates a single claim', done => {
            authenticatedSession
              .patch(`/agent/${_identity.sub}`)
              .send({ phone_number: '403-266-1234' })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(res.body).toEqual({ ..._profile, phone_number: '403-266-1234' });

                done();
              });
          });


          it('updates all non-dependent claims', done => {
            const allClaims = {
              email_verified: true,
              family_name: 'Sanders',
              given_name: 'Harland',
              name: 'Harland Sanders',
              nickname: 'Colonel Sanders',
              phone_number: '403-266-1234',
              picture: 'http://example.com/mypic.jpg',
            }

            expect(_profile).not.toEqual({..._profile, ...allClaims });

            authenticatedSession
              .patch(`/agent/${_identity.sub}`)
              .send(allClaims)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(res.body).toEqual({..._profile, ...allClaims });

                done();
              });
          });

          describe('dependent claims', () => {

            it('does not unblock when `blocked` is set to false (as per the docs)', done => {
              authenticatedSession
                .patch(`/agent/${_identity.sub}`)
                .send({ blocked: false })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(res.body.blocked).toBeUndefined();

                  done();
                });
            });

            it('blocks when `blocked` is set to true (as per the docs)', done => {
              authenticatedSession
                .patch(`/agent/${_identity.sub}`)
                .send({ blocked: true })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(res.body.blocked).toBe(true);

                  done();
                });
            });
          });

          // 2020-8-19 According to: https://auth0.com/docs/users/user-profile-structure
          it('ignores claims that cannot be modified (or have been omitted)', done => {
            authenticatedSession
              .patch(`/agent/${_identity.sub}`)
              .send({
                app_metadata: { some: 'metadata' },
                created_at: 'some-fake-time',
                identities: [],
                last_ip: '127.0.0.1',
                last_login: 'some-fake-date',
                last_login: 'some-fake-date',
                last_password_reset: 'some-fake-date',
                logins_count: 333,
                multifactor: [],
                updated_at: 'some-fake-time',
                user_id: 'some-fake-id',
                user_metadata: { some: 'metadata' },
                username: 'some_guy',
                email: 'someweirdemail@example.com'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(res.body.message).toEqual('No relevant data supplied');

                expect(_profile.app_metadata).toBeUndefined();
                expect(_profile.created_at).not.toEqual('some-fake-time');
                expect(_profile.identities.length).toEqual(1);
                expect(_profile.last_ip).not.toEqual('127.0.0.1');
                expect(_profile.last_login).not.toEqual('some-fake-date');
                expect(_profile.last_password_reset).not.toEqual('some-fake-date');
                expect(_profile.logins_count).not.toEqual(333);
                expect(_profile.multifactor).not.toEqual([]);
                expect(_profile.updated_at).not.toEqual('some-fake-time');
                expect(_profile.user_id).not.toEqual('some-fake-id');
                expect(_profile.user_metadata).not.toEqual({ some: 'metadata' });
                expect(_profile.username).not.toEqual('some_guy');
                expect(_profile.email).not.toEqual('someweirdemail@example.com');

                done();
              });
          });

          it('returns a friendly message if no relevant data supplied', done => {
            authenticatedSession
              .patch(`/agent/${_identity.sub}`)
              .send({
                favourite_fish: 'Cod'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(res.body.message).toEqual('No relevant data supplied');
                done();
              });
          });

          describe('Auth0', () => {
            it('is called to update the agent', done => {
              authenticatedSession
                .patch(`/agent/${_identity.sub}`)
                .send({
                  phone_number: '403-266-1234'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(userUpdateOauthTokenScope.isDone()).toBe(true);
                  expect(userUpdateScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is not called if no data is supplied', done => {
              authenticatedSession
                .patch(`/agent/${_identity.sub}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(userUpdateOauthTokenScope.isDone()).toBe(false);
                  expect(userUpdateScope.isDone()).toBe(false);
                  done();
                });
            });

            it('is not called if no relevant data is supplied', done => {
              authenticatedSession
                .patch(`/agent/${_identity.sub}`)
                .send({
                  favourite_fish: 'Cod'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(userUpdateOauthTokenScope.isDone()).toBe(false);
                  expect(userUpdateScope.isDone()).toBe(false);
                  done();
                });
            });
          });
        });

        describe('email not verified', () => {
//          beforeEach(done => {
//
//            stubAuth0ManagementApi({userRead: {..._profile, email_verified: false}}, (err, apiScopes) => {
//              if (err) return done.fail(err);
//
//              login(_identity, [scope.create.agents], (err, session) => {
//                if (err) return done.fail(err);
//                authenticatedSession = session;
//
//                // Cached profile doesn't match "live" data, so agent needs to be updated
//                // with a call to Auth0
//                stubUserRead((err, apiScopes) => {
//                  if (err) return done.fail();
//
//                  stubAuth0ManagementEndpoint([apiScope.create.users], (err, apiScopes) => {
//                    if (err) return done.fail();
//
//                    ({userUpdateScope, oauthTokenScope} = apiScopes);
//                    done();
//                  });
//                });
//              });
//            });
//          });
//
//          it('returns 401 unauthenticated', done => {
//            authenticatedSession
//              .post('/agent')
//              .send({
//                email: 'someotherguy@example.com'
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(401)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//
//                expect(res.body.message).toEqual('Check your email to verify your account');
//                done();
//              });
//          });
        });
      });

//      describe('read', () => {
//
//        let userReadScope, oauthTokenScope,
//            userRolesReadScope, userRolesReadOauthTokenScope,
//            userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope;
//
//        describe('/agent', () => {
//
//          describe('email verified', () => {
//            describe('well-formed user_metadata', () => {
//              beforeEach(done => {
//                stubAuth0ManagementApi((err, apiScopes) => {
//                  if (err) return done.fail(err);
//                  ({userReadScope, oauthTokenScope} = apiScopes);
//
//                  login(_identity, [scope.read.agents], (err, session) => {
//                    if (err) return done.fail(err);
//                    authenticatedSession = session;
//
//                    // Cached profile doesn't match "live" data, so agent needs to be updated
//                    // with a call to Auth0
//                    stubUserRead((err, apiScopes) => {
//                      if (err) return done.fail();
//
//                      stubUserRead((err, apiScopes) => {
//                        if (err) return done.fail(err);
//                        ({userReadScope, oauthTokenScope} = apiScopes);
//
//                        // Retrieve the roles to which this agent is assigned
//                        stubUserRolesRead((err, apiScopes) => {
//                          if (err) return done.fail(err);
//                          ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);
//
//                          // Update agent if null values are found
//                          stubUserAppMetadataUpdate((err, apiScopes) => {
//                            if (err) return done.fail();
//                            ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
//                            done();
//                          });
//                        });
//                      });
//                    });
//                  });
//                });
//              });
//
//              it('returns the info attached to the req.user object', done => {
//                authenticatedSession
//                  .get('/agent')
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(200)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//
//                    expect(res.body.email).toEqual(_identity.email);
//                    expect(res.body.name).toEqual(_identity.name);
//                    expect(res.body.user_id).toEqual(_identity.sub);
//                    expect(res.body.roles).toEqual([{ "id": "345", "name": "viewer", "description": "Basic agent, organization, and team viewing permissions" }]);
//                    done();
//                  });
//              });
//
//              it('has the agent metadata set', done => {
//                authenticatedSession
//                  .get('/agent')
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(200)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    expect(res.body.user_metadata).toBeDefined();
//                    done();
//                  });
//              });
//
//              it('sets isSuper status to false for a regular agent', done => {
//                authenticatedSession
//                  .get('/agent')
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(200)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//
//                    expect(res.body.isSuper).toBe(false);
//                    done();
//                  });
//              });
//
//              describe('Auth0', () => {
//                it('is called to retrieve the agent\'s user_metadata', done => {
//                  authenticatedSession
//                    .get('/agent')
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(200)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      expect(oauthTokenScope.isDone()).toBe(true);
//                      expect(userReadScope.isDone()).toBe(true);
//
//                      done();
//                    });
//                });
//
//                it('is called to retrieve the roles to which the agent is assigned', done => {
//                  authenticatedSession
//                    .get('/agent')
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(200)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
//                      expect(userRolesReadScope.isDone()).toBe(true);
//
//                      done();
//                    });
//                });
//
//                it('is not called to update the agent profile', done => {
//                  authenticatedSession
//                    .get('/agent')
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(200)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
//                      expect(userAppMetadataUpdateScope.isDone()).toBe(false);
//                      done();
//                    });
//                });
//              });
//            });
//
//            describe('missing user_metadata tolerance and correction', () => {
//              let userReadScope, mangledProfile;
//              beforeEach(done => {
//                mangledProfile = {
//                  ..._profile,
//                  user_metadata: {
//                    teams: [null, null, null],
//                    rsvps: [null, null, null],
//                    pendingInvitations: [null, null, null],
//                  }
//                };
//                stubAuth0ManagementApi((err, apiScopes) => {
//                  if (err) return done.fail(err);
//
//                  login(_identity, [scope.read.agents], (err, session) => {
//                    if (err) return done.fail(err);
//                    authenticatedSession = session;
//
//                    // Cached profile doesn't match "live" data, so agent needs to be updated
//                    // with a call to Auth0
//                    stubUserRead((err, apiScopes) => {
//                      if (err) return done.fail();
//
//                      // This stub is for the tests defined in this block
//                      stubUserRead(mangledProfile, (err, apiScopes) => {
//                        if (err) return done.fail(err);
//                        ({userReadScope, oauthTokenScope} = apiScopes);
//
//                        // Retrieve the roles to which this agent is assigned
//                        stubUserRolesRead((err, apiScopes) => {
//                          if (err) return done.fail(err);
//                          ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);
//
//                          // Update agent if null values are found
//                          stubUserAppMetadataUpdate(mangledProfile, (err, apiScopes) => {
//                            if (err) return done.fail();
//                            ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
//                            done();
//                          });
//                        });
//                      });
//                    });
//                  });
//                });
//              });
//
//              it('returns the info attached to the req.user object', done => {
//                authenticatedSession
//                  .get('/agent')
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(201)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//
//                    expect(res.body.email).toEqual(_identity.email);
//                    expect(res.body.name).toEqual(_identity.name);
//                    expect(res.body.user_id).toEqual(_identity.sub);
//                    expect(res.body.roles).toEqual([{ "id": "345", "name": "viewer", "description": "Basic agent, organization, and team viewing permissions" }]);
//                    done();
//                  });
//              });
//
//              it('removes all null values from teams/rsvps/pendingInvitations lists', done => {
//                authenticatedSession
//                  .get('/agent')
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(201)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//
//                    expect(res.body.user_metadata.teams.length).toEqual(0);
//                    expect(res.body.user_metadata.rsvps.length).toEqual(0);
//                    expect(res.body.user_metadata.pendingInvitations.length).toEqual(0);
//                    done();
//                  });
//              });
//
//              it('sets isSuper status to false for a regular agent', done => {
//                authenticatedSession
//                  .get('/agent')
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(201)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//
//                    expect(res.body.isSuper).toBe(false);
//                    done();
//                  });
//              });
//
//              describe('Auth0', () => {
//                it('is called to retrieve a the agent\'s user_metadata', done => {
//                  authenticatedSession
//                    .get('/agent')
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(201)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      expect(oauthTokenScope.isDone()).toBe(true);
//                      expect(userReadScope.isDone()).toBe(true);
//
//                      done();
//                    });
//                });
//
//                it('is called to retrieve the roles to which the agent is assigned', done => {
//                  authenticatedSession
//                    .get('/agent')
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(201)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
//                      expect(userRolesReadScope.isDone()).toBe(true);
//
//                      done();
//                    });
//                });
//
//                it('is called to update the agent profile', done => {
//                  authenticatedSession
//                    .get('/agent')
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(201)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
//                      expect(userAppMetadataUpdateScope.isDone()).toBe(true);
//                      done();
//                    });
//                });
//              });
//            });
//          });
//
//          describe('email not verified', () => {
//            beforeEach(done => {
//              stubAuth0ManagementApi({ userRead: {..._profile, email_verified: false} }, (err, apiScopes) => {
//                if (err) return done.fail(err);
//                ({userReadScope, oauthTokenScope} = apiScopes);
//
//                login(_identity, [scope.read.agents], (err, session) => {
//                  if (err) return done.fail(err);
//                  authenticatedSession = session;
//
//                  // Cached profile doesn't match "live" data, so agent needs to be updated
//                  // with a call to Auth0
//                  stubUserRead((err, apiScopes) => {
//                    if (err) return done.fail();
//
//                    stubUserRead((err, apiScopes) => {
//                      if (err) return done.fail(err);
//                      ({userReadScope, oauthTokenScope} = apiScopes);
//
//                      // Retrieve the roles to which this agent is assigned
//                      stubUserRolesRead((err, apiScopes) => {
//                        if (err) return done.fail(err);
//                        ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);
//
//                        // Update agent if null values are found
//                        stubUserAppMetadataUpdate((err, apiScopes) => {
//                          if (err) return done.fail();
//                          ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
//                          done();
//                        });
//                      });
//                    });
//                  });
//                });
//              });
//            });
//
//            it('returns the info attached to the req.user object', done => {
//              authenticatedSession
//                .get('/agent')
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(200)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//
//                  expect(res.body.email).toEqual(_identity.email);
//                  expect(res.body.name).toEqual(_identity.name);
//                  expect(res.body.user_id).toEqual(_identity.sub);
//                  expect(res.body.roles).toEqual([{ "id": "345", "name": "viewer", "description": "Basic agent, organization, and team viewing permissions" }]);
//                  done();
//                });
//            });
//          });
//        });
//
//        describe('/agent/:id', () => {
//
//          describe('email verified', () => {
//            describe('well-formed user_metadata', () => {
//              let userReadScope;
//              beforeEach(done => {
//                stubAuth0ManagementApi((err, apiScopes) => {
//                  if (err) return done.fail(err);
//
//                  login(_identity, [scope.read.agents], (err, session) => {
//                    if (err) return done.fail(err);
//                    authenticatedSession = session;
//
//                    // Cached profile doesn't match "live" data, so agent needs to be updated
//                    // with a call to Auth0
//                    stubUserRead((err, apiScopes) => {
//                      if (err) return done.fail();
//
//                      // This stub is for the tests defined in this block
//                      stubUserRead((err, apiScopes) => {
//                        if (err) return done.fail(err);
//                        ({userReadScope, oauthTokenScope} = apiScopes);
//
//                        // Retrieve the roles to which this agent is assigned
//                        stubUserRolesRead((err, apiScopes) => {
//                          if (err) return done.fail(err);
//                          ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);
//
//                          // Update agent if null values are found
//                          stubUserAppMetadataUpdate((err, apiScopes) => {
//                            if (err) return done.fail();
//                            ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
//                            done();
//                          });
//                        });
//                      });
//                    });
//                  });
//                });
//              });
//
//              it('returns the info attached to the req.user object', done => {
//                authenticatedSession
//                  .get(`/agent/${_identity.sub}`)
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(200)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//
//                    expect(res.body.email).toEqual(_identity.email);
//                    expect(res.body.name).toEqual(_identity.name);
//                    expect(res.body.user_id).toEqual(_identity.sub);
//                    expect(res.body.roles).toEqual([{ "id": "345", "name": "viewer", "description": "Basic agent, organization, and team viewing permissions" }]);
//                    done();
//                  });
//              });
//
//              describe('Auth0', () => {
//                it('calls the Auth0 /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
//                  authenticatedSession
//                    .get(`/agent/${_identity.sub}`)
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(200)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(oauthTokenScope.isDone()).toBe(true);
//                      done();
//                    });
//                });
//
//                it('calls Auth0 to read the agent at the Auth0-defined connection', done => {
//                  authenticatedSession
//                    .get(`/agent/${_identity.sub}`)
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(200)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      expect(userReadScope.isDone()).toBe(true);
//                      done();
//                    });
//                });
//
//                it('is called to retrieve the roles to which the agent is assigned', done => {
//                  authenticatedSession
//                    .get(`/agent/${_identity.sub}`)
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(200)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
//                      expect(userRolesReadScope.isDone()).toBe(true);
//
//                      done();
//                    });
//                });
//
//                it('is not called to update the agent profile', done => {
//                  authenticatedSession
//                    .get(`/agent/${_identity.sub}`)
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(200)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
//                      expect(userAppMetadataUpdateScope.isDone()).toBe(false);
//                      done();
//                    });
//                });
//
//                it('retrieves a record from Auth0', done => {
//                  authenticatedSession
//                    .get(`/agent/${_identity.sub}`)
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(200)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      expect(res.body.email).toBeDefined();
//                      done();
//                    });
//                });
//              });
//            });
//
//            describe('missing user_metadata tolerance and correction', () => {
//              let userReadScope, mangledProfile;
//              beforeEach(done => {
//                mangledProfile = {
//                  ..._profile,
//                  user_metadata: {
//                    teams: [null, null, null],
//                    rsvps: [null, null, null],
//                    pendingInvitations: [null, null, null],
//                  }
//                };
//                stubAuth0ManagementApi((err, apiScopes) => {
//                  if (err) return done.fail(err);
//
//                  login(_identity, [scope.read.agents], (err, session) => {
//                    if (err) return done.fail(err);
//                    authenticatedSession = session;
//
//                    // Cached profile doesn't match "live" data, so agent needs to be updated
//                    // with a call to Auth0
//                    stubUserRead((err, apiScopes) => {
//                      if (err) return done.fail();
//
//                      // This stub is for the tests defined in this block
//                      stubUserRead(mangledProfile, (err, apiScopes) => {
//                        if (err) return done.fail(err);
//                        ({userReadScope, oauthTokenScope} = apiScopes);
//
//                        // Retrieve the roles to which this agent is assigned
//                        stubUserRolesRead((err, apiScopes) => {
//                          if (err) return done.fail(err);
//                          ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);
//
//                          // Update agent if null values are found
//                          stubUserAppMetadataUpdate(mangledProfile, (err, apiScopes) => {
//                            if (err) return done.fail();
//                            ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
//                            done();
//                          });
//                        });
//                      });
//                    });
//                  });
//                });
//              });
//
//              it('returns the info attached to the req.user object', done => {
//                authenticatedSession
//                  .get(`/agent/${_identity.sub}`)
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(201)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//
//                    expect(res.body.email).toEqual(_identity.email);
//                    expect(res.body.name).toEqual(_identity.name);
//                    expect(res.body.user_id).toEqual(_identity.sub);
//                    expect(res.body.roles).toEqual([{ "id": "345", "name": "viewer", "description": "Basic agent, organization, and team viewing permissions" }]);
//                    done();
//                  });
//              });
//
//              it('removes all null values from teams/rsvps/pendingInvitations lists', done => {
//                authenticatedSession
//                  .get(`/agent/${_identity.sub}`)
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(201)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//
//                    expect(res.body.user_metadata.teams.length).toEqual(0);
//                    expect(res.body.user_metadata.rsvps.length).toEqual(0);
//                    expect(res.body.user_metadata.pendingInvitations.length).toEqual(0);
//                    done();
//                  });
//              });
//
//              describe('Auth0', () => {
//                it('is called to retrieve the agent profile', done => {
//                  authenticatedSession
//                    .get(`/agent/${_identity.sub}`)
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(201)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(oauthTokenScope.isDone()).toBe(true);
//                      expect(userReadScope.isDone()).toBe(true);
//                      done();
//                    });
//                });
//
//                it('is called to retrieve the roles to which the agent is assigned', done => {
//                  authenticatedSession
//                    .get(`/agent/${_identity.sub}`)
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(201)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
//                      expect(userRolesReadScope.isDone()).toBe(true);
//
//                      done();
//                    });
//                });
//
//                it('is called to update the agent profile', done => {
//                  authenticatedSession
//                    .get(`/agent/${_identity.sub}`)
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(201)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
//                      expect(userAppMetadataUpdateScope.isDone()).toBe(true);
//                      done();
//                    });
//                });
//              });
//            });
//          });
//
//          describe('email not verified', () => {
//            let userReadScope;
//            beforeEach(done => {
//              stubAuth0ManagementApi({ userRead: {..._profile, email_verified: false} }, (err, apiScopes) => {
//                if (err) return done.fail(err);
//
//                login(_identity, [scope.read.agents], (err, session) => {
//                  if (err) return done.fail(err);
//                  authenticatedSession = session;
//
//                  // Cached profile doesn't match "live" data, so agent needs to be updated
//                  // with a call to Auth0
//                  stubUserRead((err, apiScopes) => {
//                    if (err) return done.fail();
//
//                    // This stub is for the tests defined in this block
//                    stubUserRead((err, apiScopes) => {
//                      if (err) return done.fail(err);
//                      ({userReadScope, oauthTokenScope} = apiScopes);
//
//                      // Retrieve the roles to which this agent is assigned
//                      stubUserRolesRead((err, apiScopes) => {
//                        if (err) return done.fail(err);
//                        ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);
//
//                        // Update agent if null values are found
//                        stubUserAppMetadataUpdate((err, apiScopes) => {
//                          if (err) return done.fail();
//                          ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
//                          done();
//                        });
//                      });
//                    });
//                  });
//                });
//              });
//            });
//
//            it('returns 401 unauthenticated', done => {
//              authenticatedSession
//                .get(`/agent/${_identity.sub}`)
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(401)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//
//                  expect(res.body.message).toEqual('Check your email to verify your account');
//                  done();
//                });
//            });
//          });
//        });
//      });
//
//      describe('delete', () => {
//
//        let userDeleteScope;
//        describe('email verified', () => {
//          beforeEach(done => {
//            stubAuth0ManagementApi((err, apiScopes) => {
//              if (err) return done.fail(err);
//
//              login(_identity, [scope.delete.agents], (err, session) => {
//                if (err) return done.fail(err);
//                authenticatedSession = session;
//
//                // Cached profile doesn't match "live" data, so agent needs to be updated
//                // with a call to Auth0
//                stubUserRead((err, apiScopes) => {
//                  if (err) return done.fail();
//
//                  stubAuth0ManagementEndpoint([apiScope.delete.users], (err, apiScopes) => {
//                    if (err) return done.fail(err);
//                    ({userDeleteScope, oauthTokenScope} = apiScopes);
//                    done();
//                  });
//                });
//              });
//            });
//          });
//
//          it('removes an existing record from the database', done => {
//            authenticatedSession
//              .delete('/agent')
//              .send({
//                id: agent.id,
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(201)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//
//                expect(res.body.message).toEqual('Agent deleted');
//                done();
//              });
//          });
//
//          it('doesn\'t barf if agent doesn\'t exist', done => {
//            authenticatedSession
//              .delete('/agent')
//              .send({
//                id: 111,
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(404)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//
//                expect(res.body.message).toEqual('No such agent');
//                done();
//              });
//          });
//
//          describe('Auth0', () => {
//            it('calls the Auth0 /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
//              authenticatedSession
//                .delete('/agent')
//                .send({
//                  id: agent.id,
//                  name: 'Some Cool Guy'
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(oauthTokenScope.isDone()).toBe(true);
//                  done();
//                });
//            });
//
//            it('calls Auth0 to delete the agent at the Auth0-defined connection', done => {
//              authenticatedSession
//                .delete('/agent')
//                .send({
//                  id: agent.id,
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//
//                  expect(userDeleteScope.isDone()).toBe(true);
//                  done();
//                });
//            });
//
//            it('does not call the Auth0 endpoints if record doesn\'t exist', done => {
//              authenticatedSession
//                .delete('/agent')
//                .send({
//                  id: 333,
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(404)
//                .end(function(err, res) {
//                  if (err) done.fail(err);
//
//                  expect(oauthTokenScope.isDone()).toBe(false);
//                  expect(userDeleteScope.isDone()).toBe(false);
//                  done();
//                });
//            });
//          });
//        });
//
//        describe('email not verified', () => {
//          beforeEach(done => {
//            stubAuth0ManagementApi({ userRead: {..._profile, email_verified: false} }, (err, apiScopes) => {
//              if (err) return done.fail(err);
//
//              login(_identity, [scope.delete.agents], (err, session) => {
//                if (err) return done.fail(err);
//                authenticatedSession = session;
//
//                // Cached profile doesn't match "live" data, so agent needs to be updated
//                // with a call to Auth0
//                stubUserRead((err, apiScopes) => {
//                  if (err) return done.fail();
//
//                  stubAuth0ManagementEndpoint([apiScope.delete.users], (err, apiScopes) => {
//                    if (err) return done.fail(err);
//                    ({userDeleteScope, oauthTokenScope} = apiScopes);
//                    done();
//                  });
//                });
//              });
//            });
//          });
//
//          it('returns 401 unauthenticated', done => {
//            authenticatedSession
//              .delete('/agent')
//              .send({
//                id: agent.id,
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(401)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//
//                expect(res.body.message).toEqual('Check your email to verify your account');
//                done();
//              });
//          });
//        });
//      });
//
//      describe('/agent/verify - email verification', () => {
//
//        describe('email already verified', () => {
//          beforeEach(done => {
//            stubAuth0ManagementApi((err, apiScopes) => {
//              if (err) return done.fail(err);
//
//              login(_identity, (err, session) => {
//                if (err) return done.fail(err);
//                authenticatedSession = session;
//
//                // Cached profile doesn't match "live" data, so agent needs to be updated
//                // with a call to Auth0
//                stubUserRead((err, apiScopes) => {
//                  if (err) return done.fail();
//
//                  stubEmailVerification((err, apiScopes) => {
//                    if (err) return done.fail(err);
//                    ({emailVerificationScope, emailVerificationOauthTokenScope} = apiScopes);
//                    done();
//                  });
//                });
//              });
//            });
//          });
//
//          it('returns a friendly message', done => {
//            authenticatedSession
//              .post('/agent/verify')
//              .send({
//                id: 'some-uuid-v4'
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(200)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//
//                expect(res.body.message).toBe('Email already verified');
//                done();
//              });
//          });
//
//          describe('Auth0', () => {
//            it('is not called to re-send an email verification', done => {
//              authenticatedSession
//                .post('/agent/verify')
//                .send({
//                  id: 'some-uuid-v4'
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(200)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//
//                  expect(emailVerificationOauthTokenScope.isDone()).toBe(false);
//                  expect(emailVerificationScope.isDone()).toBe(false);
//                  done();
//                });
//            });
//          });
//        });
//
//        describe('email not yet verified', () => {
//          beforeEach(done => {
//            stubAuth0ManagementApi({ userRead: {..._profile, email_verified: false} }, (err, apiScopes) => {
//              if (err) return done.fail(err);
//
//              login(_identity, [scope.delete.agents], (err, session) => {
//                if (err) return done.fail(err);
//                authenticatedSession = session;
//
//                // Cached profile doesn't match "live" data, so agent needs to be updated
//                // with a call to Auth0
//                stubUserRead((err, apiScopes) => {
//                  if (err) return done.fail();
//
//                  stubEmailVerification((err, apiScopes) => {
//                    if (err) return done.fail(err);
//                    ({emailVerificationScope, emailVerificationOauthTokenScope} = apiScopes);
//                    done();
//                  });
//                });
//              });
//            });
//          });
//
//          it('returns a friendly message', done => {
//            authenticatedSession
//              .post('/agent/verify')
//              .send({
//                id: 'some-uuid-v4'
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(201)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//
//                expect(res.body.message).toBe('Verification sent. Check your email');
//                done();
//              });
//          });
//
//          describe('Auth0', () => {
//            it('is called to re-send an email verification', done => {
//              authenticatedSession
//                .post('/agent/verify')
//                .send({
//                  id: 'some-uuid-v4'
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//
//                  expect(emailVerificationOauthTokenScope.isDone()).toBe(true);
//                  expect(emailVerificationScope.isDone()).toBe(true);
//                  done();
//                });
//            });
//          });
//        });
//      });
    });

//    describe('forbidden', () => {
//      let originalProfile;
//
//      let forbiddenSession;
//      beforeEach(done => {
//        originalProfile = {..._profile};
//        _profile.email = 'someotherguy@example.com';
//        _profile.name = 'Some Other Guy';
//
//        stubAuth0ManagementApi((err, apiScopes) => {
//          if (err) return done.fail(err);
//
//         login({ ..._identity, email: 'someotherguy@example.com', name: 'Some Other Guy' }, (err, session) => {
//            if (err) return done.fail(err);
//            forbiddenSession = session;
//
//            // Cached profile doesn't match "live" data, so agent needs to be updated
//            // with a call to Auth0
//            stubUserRead((err, apiScopes) => {
//              if (err) return done.fail();
//
//              done();
//            });
//          });
//        });
//      });
//
//      afterEach(() => {
//        // Through the magic of node I am able to adjust the profile data returned.
//        // This resets the default values
//        _profile.email = originalProfile.email;
//        _profile.name = originalProfile.name;
//      });
//
//      describe('delete', () => {
//        it('returns 403', done => {
//          forbiddenSession
//            .delete('/agent')
//            .send({
//              id: agent.id
//            })
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(403)
//            .end(function(err, res) {
//              if (err) done.fail(err);
//              expect(res.body.message).toEqual('Insufficient scope');
//              done();
//            });
//        });
//
//        it('does not remove the record from the database', done => {
//          models.Agent.findAll().then(results => {
//            // 2 because the unauthorized agent is in the database
//            expect(results.length).toEqual(2);
//
//            forbiddenSession
//              .delete('/agent')
//              .send({
//                id: agent.id
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(403)
//              .end(function(err, res) {
//                if (err) done.fail(err);
//                models.Agent.findAll().then(results => {
//                  expect(results.length).toEqual(2);
//                  done();
//                }).catch(err => {
//                  done.fail(err);
//                });
//              });
//          }).catch(err => {
//            done.fail(err);
//          });
//        });
//      });
//    });
  });

  describe('unauthenticated', () => {

//    it('redirects to login', done => {
//      request(app)
//        .get('/agent')
//        .set('Accept', 'application/json')
//        .expect(302)
//        .end(function(err, res) {
//          if (err) return done.fail(err);
//          expect(res.headers.location).toEqual('/login');
//          done();
//        });
//    });
  });
});
