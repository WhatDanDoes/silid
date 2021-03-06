const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const request = require('supertest');
const nock = require('nock');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubAuth0ManagementEndpoint = require('../support/stubAuth0ManagementEndpoint');
const stubUserAppMetadataUpdate = require('../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubUserRead = require('../support/auth0Endpoints/stubUserRead');
const stubUserCreate = require('../support/auth0Endpoints/stubUserCreate');
const stubUserRolesRead = require('../support/auth0Endpoints/stubUserRolesRead');
const stubEmailVerification = require('../support/auth0Endpoints/stubEmailVerification');
const scope = require('../../config/permissions');
const apiScope = require('../../config/apiPermissions');
const jwt = require('jsonwebtoken');

const _profile = require('../fixtures/sample-auth0-profile-response');

describe('agentSpec', () => {

  /**
   * 2019-11-13
   * Sample tokens taken from:
   *
   * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
   */
  const _identity = { ...require('../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_CUSTOM_DOMAIN}/`};
  const _access = require('../fixtures/sample-auth0-access-token');

  let login, pub, prv, keystore,
      agent;

  beforeEach(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);

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
  });

  describe('authenticated', () => {

    describe('authorized', () => {

      let authenticatedSession, accessToken;

      describe('create', () => {

        describe('email verified', () => {
          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail(err);

              login(_identity, [scope.create.agents], (err, session, token) => {
                if (err) return done.fail(err);
                accessToken = token;
                authenticatedSession = session;

                stubUserCreate((err, apiScopes) => {
                  if (err) return done.fail();

                  ({userCreateScope, userCreateOauthTokenScope} = apiScopes);
                  done();
                });
              });
            });
          });

          describe('session access', () => {

            describe('Auth0', () => {

              it('calls the Auth0 /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
                authenticatedSession
                  .post('/agent')
                  .send({
                    email: 'someotherguy@example.com'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(userCreateOauthTokenScope.isDone()).toBe(true);
                    done();
                  });
              });

              /**
               * Auth0 requires a connection. It is called `Initial-Connection`
               * here. This setting can be configured at:
               *
               * https://manage.auth0.com/dashboard/us/silid/connections
               */
              it('calls Auth0 to create the agent at the Auth0-defined connection', done => {
                authenticatedSession
                  .post('/agent')
                  .send({
                    email: 'someotherguy@example.com'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(userCreateScope.isDone()).toBe(true);
                    done();
                  });
              });
            });
          });

          describe('Bearer token access', () => {

            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, {..._identity, permissions: [scope.create.agents] });
            });

            describe('Auth0', () => {

              it('calls the Auth0 /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
                request(app)
                  .post('/agent')
                  .send({
                    email: 'someotherguy@example.com'
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(userCreateOauthTokenScope.isDone()).toBe(true);
                    done();
                  });
              });

              /**
               * Auth0 requires a connection. It is called `Initial-Connection`
               * here. This setting can be configured at:
               *
               * https://manage.auth0.com/dashboard/us/silid/connections
               */
              it('calls Auth0 to create the agent at the Auth0-defined connection', done => {
                request(app)
                  .post('/agent')
                  .send({
                    email: 'someotherguy@example.com'
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(userCreateScope.isDone()).toBe(true);
                    done();
                  });
              });
            });
          });
        });

        describe('email not verified', () => {

          beforeEach(done => {
            stubAuth0ManagementApi({userRead: {..._profile, email_verified: false}}, (err, apiScopes) => {
              if (err) return done.fail(err);

              login(_identity, [scope.create.agents], (err, session, token) => {
                if (err) return done.fail(err);
                accessToken = token;
                authenticatedSession = session;

                stubUserCreate((err, apiScopes) => {
                  if (err) return done.fail();

                  ({userCreateScope, userCreateOauthTokenScope} = apiScopes);
                  done();
                });
              });
            });
          });

          describe('session access', () => {

            it('returns 401 unauthenticated', done => {
              authenticatedSession
                .post('/agent')
                .send({
                  email: 'someotherguy@example.com'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(401)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.message).toEqual('Check your email to verify your account');
                  done();
                });
            });

            describe('Auth0', () => {

              it('is not called', done => {
                authenticatedSession
                  .post('/agent')
                  .send({
                    email: 'someotherguy@example.com'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(401)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(userCreateOauthTokenScope.isDone()).toBe(false);
                    expect(userCreateScope.isDone()).toBe(false);
                    done();
                  });
              });
            });
          });

          describe('Bearer token access', () => {

            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, {..._identity, permissions: [scope.create.agents], email_verified: false });
            });

            it('returns 401 unauthenticated', done => {
              request(app)
                .post('/agent')
                .send({
                  email: 'someotherguy@example.com'
                })
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(401)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.message).toEqual('Check your email to verify your account');
                  done();
                });
            });

            describe('Auth0', () => {

              it('is not called', done => {
                request(app)
                  .post('/agent')
                  .send({
                    email: 'someotherguy@example.com'
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(401)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(userCreateOauthTokenScope.isDone()).toBe(false);
                    expect(userCreateScope.isDone()).toBe(false);
                    done();
                  });
              });
            });
          });
        });
      });

      describe('read', () => {

        describe('/agent', () => {

          describe('email verified', () => {

            describe('well-formed user_metadata', () => {

              beforeEach(done => {
                stubAuth0ManagementApi((err, apiScopes) => {
                  if (err) return done.fail(err);

                  login(_identity, [scope.read.agents], (err, session, token) => {
                    if (err) return done.fail(err);

                    accessToken = token;
                    authenticatedSession = session;

                    /**
                     * The following calls [may] take place in the `/agent` route
                     */
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail(err);
                      ({userReadScope, userReadOauthTokenScope} = apiScopes);

                      // Retrieve the roles to which this agent is assigned
                      stubUserRolesRead((err, apiScopes) => {
                        if (err) return done.fail(err);
                        ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

                        // Update agent if null values are found
                        stubUserAppMetadataUpdate((err, apiScopes) => {
                          if (err) return done.fail();
                          ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                          done();
                        });
                      });
                    });
                  });
                });
              });

              describe('session access', () => {

                it('returns the info attached to the req.user object', done => {
                  authenticatedSession
                    .get('/agent')
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.email).toEqual(_identity.email);
                      expect(res.body.name).toEqual(_identity.name);
                      expect(res.body.user_id).toEqual(_identity.sub);
                      expect(res.body.roles).toEqual([{ "id": "345", "name": "viewer", "description": "Basic agent viewing/updating permissions" }]);
                      done();
                    });
                });

                it('has the agent metadata set', done => {
                  authenticatedSession
                    .get('/agent')
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);
                      expect(res.body.user_metadata).toBeDefined();
                      done();
                    });
                });

                it('sets isSuper status to false for a regular agent', done => {
                  authenticatedSession
                    .get('/agent')
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.isSuper).toBe(false);
                      done();
                    });
                });

                describe('Auth0', () => {
                  it('is called to retrieve the agent\'s profile', done => {
                    authenticatedSession
                      .get('/agent')
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done.fail(err);

                        expect(userReadOauthTokenScope.isDone()).toBe(false);
                        expect(userReadScope.isDone()).toBe(true);

                        done();
                      });
                  });

                  it('is called to retrieve the roles to which the agent is assigned', done => {
                    authenticatedSession
                      .get('/agent')
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done.fail(err);

                        expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                        expect(userRolesReadScope.isDone()).toBe(true);

                        done();
                      });
                  });

                  it('is not called to update the agent profile', done => {
                    authenticatedSession
                      .get('/agent')
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done.fail(err);
                        expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                        expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                        done();
                      });
                  });
                });
              });

              describe('Bearer token access', () => {

                beforeEach(() => {
                  const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                    .get(/userinfo/)
                    .reply(200, _identity);
                });

                it('returns the info attached to the req.user object', done => {
                  request(app)
                    .get('/agent')
                    .set('Accept', 'application/json')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.email).toEqual(_identity.email);
                      expect(res.body.name).toEqual(_identity.name);
                      expect(res.body.user_id).toEqual(_identity.sub);
                      expect(res.body.roles).toEqual([{ "id": "345", "name": "viewer", "description": "Basic agent viewing/updating permissions" }]);
                      done();
                    });
                });

                it('has the agent metadata set', done => {
                  request(app)
                    .get('/agent')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);
                      expect(res.body.user_metadata).toBeDefined();
                      done();
                    });
                });

                it('sets isSuper status to false for a regular agent', done => {
                  request(app)
                    .get('/agent')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.isSuper).toBe(false);
                      done();
                    });
                });

                describe('Auth0', () => {

                  it('is called to retrieve the agent\'s profile', done => {
                    request(app)
                      .get('/agent')
                      .set('Authorization', `Bearer ${accessToken}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done.fail(err);

                        expect(userReadOauthTokenScope.isDone()).toBe(false);
                        expect(userReadScope.isDone()).toBe(true);

                        done();
                      });
                  });

                  it('is called to retrieve the roles to which the agent is assigned', done => {
                    request(app)
                      .get('/agent')
                      .set('Authorization', `Bearer ${accessToken}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done.fail(err);

                        expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                        expect(userRolesReadScope.isDone()).toBe(true);

                        done();
                      });
                  });

                  it('is not called to update the agent profile', done => {
                    request(app)
                      .get('/agent')
                      .set('Authorization', `Bearer ${accessToken}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done.fail(err);
                        expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                        expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                        done();
                      });
                  });
                });
              });
            });

            describe('missing user_metadata tolerance and correction', () => {
              let mangledProfile;
              beforeEach(done => {
                mangledProfile = {
                  ..._profile,
                  user_metadata: {
                    teams: [null, null, null],
                    rsvps: [null, null, null],
                    pendingInvitations: [null, null, null],
                  }
                };
                stubAuth0ManagementApi((err, apiScopes) => {
                  if (err) return done.fail(err);

                  login(_identity, [scope.read.agents], (err, session) => {
                    if (err) return done.fail(err);
                    authenticatedSession = session;

                    // This stub is for the tests defined in this block
                    stubUserRead(mangledProfile, (err, apiScopes) => {
                      if (err) return done.fail(err);
                      ({userReadScope, userReadOauthTokenScope} = apiScopes);

                      // Retrieve the roles to which this agent is assigned
                      stubUserRolesRead((err, apiScopes) => {
                        if (err) return done.fail(err);
                        ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

                        // Update agent if null values are found
                        stubUserAppMetadataUpdate(mangledProfile, (err, apiScopes) => {
                          if (err) return done.fail();
                          ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                          done();
                        });
                      });
                    });
                  });
                });
              });

              describe('session access', () => {

                it('returns the info attached to the req.user object', done => {
                  authenticatedSession
                    .get('/agent')
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.email).toEqual(_identity.email);
                      expect(res.body.name).toEqual(_identity.name);
                      expect(res.body.user_id).toEqual(_identity.sub);
                      expect(res.body.roles).toEqual([{ "id": "345", "name": "viewer", "description": "Basic agent viewing/updating permissions" }]);
                      done();
                    });
                });

                it('removes all null values from teams/rsvps/pendingInvitations lists', done => {
                  authenticatedSession
                    .get('/agent')
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.user_metadata.teams.length).toEqual(0);
                      expect(res.body.user_metadata.rsvps.length).toEqual(0);
                      expect(res.body.user_metadata.pendingInvitations.length).toEqual(0);
                      done();
                    });
                });

                it('sets isSuper status to false for a regular agent', done => {
                  authenticatedSession
                    .get('/agent')
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.isSuper).toBe(false);
                      done();
                    });
                });

                describe('Auth0', () => {
                  it('is called to retrieve the agent\'s user_metadata', done => {
                    authenticatedSession
                      .get('/agent')
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(201)
                      .end((err, res) => {
                        if (err) return done.fail(err);

                        expect(userReadOauthTokenScope.isDone()).toBe(false);
                        expect(userReadScope.isDone()).toBe(true);

                        done();
                      });
                  });

                  it('is called to retrieve the roles to which the agent is assigned', done => {
                    authenticatedSession
                      .get('/agent')
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(201)
                      .end((err, res) => {
                        if (err) return done.fail(err);

                        expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                        expect(userRolesReadScope.isDone()).toBe(true);

                        done();
                      });
                  });

                  it('is called to update the agent profile', done => {
                    authenticatedSession
                      .get('/agent')
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(201)
                      .end((err, res) => {
                        if (err) return done.fail(err);
                        expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                        expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                        done();
                      });
                  });
                });
              });

              describe('Bearer token access', () => {

                beforeEach(() => {
                  const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                    .get(/userinfo/)
                    .reply(200, _identity);
                });

                it('returns the info attached to the req.user object', done => {
                  request(app)
                    .get('/agent')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.email).toEqual(_identity.email);
                      expect(res.body.name).toEqual(_identity.name);
                      expect(res.body.user_id).toEqual(_identity.sub);
                      expect(res.body.roles).toEqual([{ "id": "345", "name": "viewer", "description": "Basic agent viewing/updating permissions" }]);
                      done();
                    });
                });

                it('removes all null values from teams/rsvps/pendingInvitations lists', done => {
                  request(app)
                    .get('/agent')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.user_metadata.teams.length).toEqual(0);
                      expect(res.body.user_metadata.rsvps.length).toEqual(0);
                      expect(res.body.user_metadata.pendingInvitations.length).toEqual(0);
                      done();
                    });
                });

                it('sets isSuper status to false for a regular agent', done => {
                  request(app)
                    .get('/agent')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.isSuper).toBe(false);
                      done();
                    });
                });

                describe('Auth0', () => {

                  it('is called to retrieve the agent\'s user_metadata', done => {
                    request(app)
                      .get('/agent')
                      .set('Authorization', `Bearer ${accessToken}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(201)
                      .end((err, res) => {
                        if (err) return done.fail(err);

                        expect(userReadOauthTokenScope.isDone()).toBe(false);
                        expect(userReadScope.isDone()).toBe(true);

                        done();
                      });
                  });

                  it('is called to retrieve the roles to which the agent is assigned', done => {
                    request(app)
                      .get('/agent')
                      .set('Authorization', `Bearer ${accessToken}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(201)
                      .end((err, res) => {
                        if (err) return done.fail(err);

                        expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                        expect(userRolesReadScope.isDone()).toBe(true);

                        done();
                      });
                  });

                  it('is called to update the agent profile', done => {
                    request(app)
                      .get('/agent')
                      .set('Authorization', `Bearer ${accessToken}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(201)
                      .end((err, res) => {
                        if (err) return done.fail(err);
                        expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                        expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                        done();
                      });
                  });
                });
              });
            });
          });

          describe('email not verified', () => {
            beforeEach(done => {
              stubAuth0ManagementApi({ userRead: {..._profile, email_verified: false} }, (err, apiScopes) => {
                if (err) return done.fail(err);
                ({userReadScope, oauthTokenScope} = apiScopes);

                login(_identity, [scope.read.agents], (err, session) => {
                  if (err) return done.fail(err);
                  authenticatedSession = session;

                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail(err);
                    ({userReadScope, oauthTokenScope} = apiScopes);

                    // Retrieve the roles to which this agent is assigned
                    stubUserRolesRead((err, apiScopes) => {
                      if (err) return done.fail(err);
                      ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

                      // Update agent if null values are found
                      stubUserAppMetadataUpdate((err, apiScopes) => {
                        if (err) return done.fail();
                        ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                        done();
                      });
                    });
                  });
                });
              });
            });

            describe('session access', () => {

              it('returns the info attached to the req.user object', done => {
                authenticatedSession
                  .get('/agent')
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.email).toEqual(_identity.email);
                    expect(res.body.name).toEqual(_identity.name);
                    expect(res.body.user_id).toEqual(_identity.sub);
                    expect(res.body.roles).toEqual([{ "id": "345", "name": "viewer", "description": "Basic agent viewing/updating permissions" }]);
                    done();
                  });
              });
            });

            describe('Bearer token access', () => {

              beforeEach(() => {
                const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                  .get(/userinfo/)
                  .reply(200, _identity);
              });

              it('returns the info attached to the req.user object', done => {
                request(app)
                  .get('/agent')
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.email).toEqual(_identity.email);
                    expect(res.body.name).toEqual(_identity.name);
                    expect(res.body.user_id).toEqual(_identity.sub);
                    expect(res.body.roles).toEqual([{ "id": "345", "name": "viewer", "description": "Basic agent viewing/updating permissions" }]);
                    done();
                  });
              });
            });
          });
        });

        describe('/agent/:id', () => {

          describe('email verified', () => {

            describe('well-formed user_metadata', () => {

              beforeEach(done => {
                stubAuth0ManagementApi((err, apiScopes) => {
                  if (err) return done.fail(err);

                  login(_identity, [scope.read.agents], (err, session) => {
                    if (err) return done.fail(err);
                    authenticatedSession = session;

                    // This stub is for the tests defined in this block
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail(err);
                      ({userReadScope, userReadOauthTokenScope} = apiScopes);

                      // Retrieve the roles to which this agent is assigned
                      stubUserRolesRead((err, apiScopes) => {
                        if (err) return done.fail(err);
                        ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

                        // Update agent if null values are found
                        stubUserAppMetadataUpdate((err, apiScopes) => {
                          if (err) return done.fail();
                          ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                          done();
                        });
                      });
                    });
                  });
                });
              });

              describe('session access', () => {

                it('returns the info attached to the req.user object', done => {
                  authenticatedSession
                    .get(`/agent/${_identity.sub}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.email).toEqual(_identity.email);
                      expect(res.body.name).toEqual(_identity.name);
                      expect(res.body.user_id).toEqual(_identity.sub);
                      expect(res.body.roles).toEqual([{ "id": "345", "name": "viewer", "description": "Basic agent viewing/updating permissions" }]);
                      done();
                    });
                });

                describe('Auth0', () => {
                  it('calls Auth0 to read the agent at the Auth0-defined connection', done => {
                    authenticatedSession
                      .get(`/agent/${_identity.sub}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done.fail(err);

                        expect(userReadOauthTokenScope.isDone()).toBe(false);
                        expect(userReadScope.isDone()).toBe(true);
                        done();
                      });
                  });

                  it('is called to retrieve the roles to which the agent is assigned', done => {
                    authenticatedSession
                      .get(`/agent/${_identity.sub}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done.fail(err);

                        expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                        expect(userRolesReadScope.isDone()).toBe(true);

                        done();
                      });
                  });

                  it('is not called to update the agent profile', done => {
                    authenticatedSession
                      .get(`/agent/${_identity.sub}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done.fail(err);
                        expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                        expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                        done();
                      });
                  });

                  it('retrieves a record from Auth0', done => {
                    authenticatedSession
                      .get(`/agent/${_identity.sub}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done.fail(err);

                        expect(res.body.email).toBeDefined();
                        done();
                      });
                  });
                });
              });

              describe('Bearer token access', () => {

                beforeEach(() => {
                  const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                    .get(/userinfo/)
                    .reply(200, _identity);
                });

                it('returns the info attached to the req.user object', done => {
                  request(app)
                    .get(`/agent/${_identity.sub}`)
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.email).toEqual(_identity.email);
                      expect(res.body.name).toEqual(_identity.name);
                      expect(res.body.user_id).toEqual(_identity.sub);
                      expect(res.body.roles).toEqual([{ "id": "345", "name": "viewer", "description": "Basic agent viewing/updating permissions" }]);
                      done();
                    });
                });

                describe('Auth0', () => {

                  it('calls Auth0 to read the agent at the Auth0-defined connection', done => {
                    request(app)
                      .get(`/agent/${_identity.sub}`)
                      .set('Authorization', `Bearer ${accessToken}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done.fail(err);

                        expect(userReadOauthTokenScope.isDone()).toBe(false);
                        expect(userReadScope.isDone()).toBe(true);
                        done();
                      });
                  });

                  it('is called to retrieve the roles to which the agent is assigned', done => {
                    request(app)
                      .get(`/agent/${_identity.sub}`)
                      .set('Authorization', `Bearer ${accessToken}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done.fail(err);

                        expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                        expect(userRolesReadScope.isDone()).toBe(true);

                        done();
                      });
                  });

                  it('is not called to update the agent profile', done => {
                    request(app)
                      .get(`/agent/${_identity.sub}`)
                      .set('Authorization', `Bearer ${accessToken}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done.fail(err);
                        expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                        expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                        done();
                      });
                  });

                  it('retrieves a record from Auth0', done => {
                    request(app)
                      .get(`/agent/${_identity.sub}`)
                      .set('Authorization', `Bearer ${accessToken}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done.fail(err);

                        expect(res.body.email).toBeDefined();
                        done();
                      });
                  });
                });
              });
            });

            describe('missing user_metadata tolerance and correction', () => {
              let userReadScope, mangledProfile;
              beforeEach(done => {
                mangledProfile = {
                  ..._profile,
                  user_metadata: {
                    teams: [null, null, null],
                    rsvps: [null, null, null],
                    pendingInvitations: [null, null, null],
                  }
                };
                stubAuth0ManagementApi((err, apiScopes) => {
                  if (err) return done.fail(err);

                  login(_identity, [scope.read.agents], (err, session) => {
                    if (err) return done.fail(err);
                    authenticatedSession = session;

                    // This stub is for the tests defined in this block
                    stubUserRead(mangledProfile, (err, apiScopes) => {
                      if (err) return done.fail(err);
                      ({userReadScope, userReadOauthTokenScope} = apiScopes);

                      // Retrieve the roles to which this agent is assigned
                      stubUserRolesRead((err, apiScopes) => {
                        if (err) return done.fail(err);
                        ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

                        // Update agent if null values are found
                        stubUserAppMetadataUpdate(mangledProfile, (err, apiScopes) => {
                          if (err) return done.fail();
                          ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                          done();
                        });
                      });
                    });
                  });
                });
              });

              describe('session access', () => {

                it('returns the info attached to the req.user object', done => {
                  authenticatedSession
                    .get(`/agent/${_identity.sub}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.email).toEqual(_identity.email);
                      expect(res.body.name).toEqual(_identity.name);
                      expect(res.body.user_id).toEqual(_identity.sub);
                      expect(res.body.roles).toEqual([{ "id": "345", "name": "viewer", "description": "Basic agent viewing/updating permissions" }]);
                      done();
                    });
                });

                it('removes all null values from teams/rsvps/pendingInvitations lists', done => {
                  authenticatedSession
                    .get(`/agent/${_identity.sub}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.user_metadata.teams.length).toEqual(0);
                      expect(res.body.user_metadata.rsvps.length).toEqual(0);
                      expect(res.body.user_metadata.pendingInvitations.length).toEqual(0);
                      done();
                    });
                });

                describe('Auth0', () => {
                  it('is called to retrieve the agent profile', done => {
                    authenticatedSession
                      .get(`/agent/${_identity.sub}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(201)
                      .end((err, res) => {
                        if (err) return done.fail(err);
                        expect(userReadOauthTokenScope.isDone()).toBe(false);
                        expect(userReadScope.isDone()).toBe(true);
                        done();
                      });
                  });

                  it('is called to retrieve the roles to which the agent is assigned', done => {
                    authenticatedSession
                      .get(`/agent/${_identity.sub}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(201)
                      .end((err, res) => {
                        if (err) return done.fail(err);

                        expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                        expect(userRolesReadScope.isDone()).toBe(true);

                        done();
                      });
                  });

                  it('is called to update the agent profile', done => {
                    authenticatedSession
                      .get(`/agent/${_identity.sub}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(201)
                      .end((err, res) => {
                        if (err) return done.fail(err);
                        expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                        expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                        done();
                      });
                  });
                });
              });

              describe('Bearer token access', () => {

                beforeEach(() => {
                  const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                    .get(/userinfo/)
                    .reply(200, _identity);
                });

                it('returns the info attached to the req.user object', done => {
                  request(app)
                    .get(`/agent/${_identity.sub}`)
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.email).toEqual(_identity.email);
                      expect(res.body.name).toEqual(_identity.name);
                      expect(res.body.user_id).toEqual(_identity.sub);
                      expect(res.body.roles).toEqual([{ "id": "345", "name": "viewer", "description": "Basic agent viewing/updating permissions" }]);
                      done();
                    });
                });

                it('removes all null values from teams/rsvps/pendingInvitations lists', done => {
                  request(app)
                    .get(`/agent/${_identity.sub}`)
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.user_metadata.teams.length).toEqual(0);
                      expect(res.body.user_metadata.rsvps.length).toEqual(0);
                      expect(res.body.user_metadata.pendingInvitations.length).toEqual(0);
                      done();
                    });
                });

                describe('Auth0', () => {

                  it('is called to retrieve the agent profile', done => {
                    request(app)
                      .get(`/agent/${_identity.sub}`)
                      .set('Authorization', `Bearer ${accessToken}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(201)
                      .end((err, res) => {
                        if (err) return done.fail(err);
                        expect(userReadOauthTokenScope.isDone()).toBe(false);
                        expect(userReadScope.isDone()).toBe(true);
                        done();
                      });
                  });

                  it('is called to retrieve the roles to which the agent is assigned', done => {
                    request(app)
                      .get(`/agent/${_identity.sub}`)
                      .set('Authorization', `Bearer ${accessToken}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(201)
                      .end((err, res) => {
                        if (err) return done.fail(err);

                        expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                        expect(userRolesReadScope.isDone()).toBe(true);

                        done();
                      });
                  });

                  it('is called to update the agent profile', done => {
                    request(app)
                      .get(`/agent/${_identity.sub}`)
                      .set('Authorization', `Bearer ${accessToken}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(201)
                      .end((err, res) => {
                        if (err) return done.fail(err);
                        expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                        expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                        done();
                      });
                  });
                });
              });
            });
          });

          describe('email not verified', () => {

            beforeEach(done => {
              stubAuth0ManagementApi({ userRead: {..._profile, email_verified: false} }, (err, apiScopes) => {
                if (err) return done.fail(err);

                login(_identity, [scope.read.agents], (err, session) => {
                  if (err) return done.fail(err);
                  authenticatedSession = session;

                  // This stub is for the tests defined in this block
                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail(err);
                    ({userReadScope, oauthTokenScope} = apiScopes);

                    // Retrieve the roles to which this agent is assigned
                    stubUserRolesRead((err, apiScopes) => {
                      if (err) return done.fail(err);
                      ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

                      // Update agent if null values are found
                      stubUserAppMetadataUpdate((err, apiScopes) => {
                        if (err) return done.fail();
                        ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                        done();
                      });
                    });
                  });
                });
              });
            });

            describe('session access', () => {

              it('returns 401 unauthenticated', done => {
                authenticatedSession
                  .get(`/agent/${_identity.sub}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(401)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.message).toEqual('Check your email to verify your account');
                    done();
                  });
              });
            });

            describe('Bearer token access', () => {

              beforeEach(() => {
                const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                  .get(/userinfo/)
                  .reply(200, {..._identity, email_verified: false });
              });

              it('returns 401 unauthenticated', done => {
                request(app)
                  .get(`/agent/${_identity.sub}`)
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(401)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.message).toEqual('Check your email to verify your account');
                    done();
                  });
              });
            });
          });
        });
      });

      describe('delete', () => {

        describe('email verified', () => {
          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail(err);

              login(_identity, [scope.delete.agents], (err, session) => {
                if (err) return done.fail(err);
                authenticatedSession = session;

                stubAuth0ManagementEndpoint([apiScope.delete.users], (err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({userDeleteScope, oauthTokenScope} = apiScopes);
                  done();
                });
              });
            });
          });

          describe('session access', () => {

            it('removes an existing record from the database', done => {
              authenticatedSession
                .delete('/agent')
                .send({
                  id: agent.id,
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.message).toEqual('Agent deleted');
                  done();
                });
            });

            it('doesn\'t barf if agent doesn\'t exist', done => {
              authenticatedSession
                .delete('/agent')
                .send({
                  id: 111,
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.message).toEqual('No such agent');
                  done();
                });
            });

            describe('Auth0', () => {
              it('calls the Auth0 /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
                authenticatedSession
                  .delete('/agent')
                  .send({
                    id: agent.id,
                    name: 'Some Cool Guy'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(oauthTokenScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('calls Auth0 to delete the agent at the Auth0-defined connection', done => {
                authenticatedSession
                  .delete('/agent')
                  .send({
                    id: agent.id,
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(userDeleteScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('does not call the Auth0 endpoints if record doesn\'t exist', done => {
                authenticatedSession
                  .delete('/agent')
                  .send({
                    id: 333,
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end((err, res) => {
                    if (err) done.fail(err);

                    expect(oauthTokenScope.isDone()).toBe(false);
                    expect(userDeleteScope.isDone()).toBe(false);
                    done();
                  });
              });
            });
          });

          describe('Bearer token access', () => {

            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, {..._identity, permissions: [scope.delete.agents] });
            });

            it('removes an existing record from the database', done => {
              request(app)
                .delete('/agent')
                .send({
                  id: agent.id,
                })
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.message).toEqual('Agent deleted');
                  done();
                });
            });

            it('doesn\'t barf if agent doesn\'t exist', done => {
              request(app)
                .delete('/agent')
                .send({
                  id: 111,
                })
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

            describe('Auth0', () => {
              it('calls the Auth0 /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
                request(app)
                  .delete('/agent')
                  .send({
                    id: agent.id,
                    name: 'Some Cool Guy'
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(oauthTokenScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('calls Auth0 to delete the agent at the Auth0-defined connection', done => {
                request(app)
                  .delete('/agent')
                  .send({
                    id: agent.id,
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(userDeleteScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('does not call the Auth0 endpoints if record doesn\'t exist', done => {
                request(app)
                  .delete('/agent')
                  .send({
                    id: 333,
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end((err, res) => {
                    if (err) done.fail(err);

                    expect(oauthTokenScope.isDone()).toBe(false);
                    expect(userDeleteScope.isDone()).toBe(false);
                    done();
                  });
              });
            });
          });
        });

        describe('email not verified', () => {

          beforeEach(done => {
            stubAuth0ManagementApi({ userRead: {..._profile, email_verified: false} }, (err, apiScopes) => {
              if (err) return done.fail(err);

              login(_identity, [scope.delete.agents], (err, session) => {
                if (err) return done.fail(err);
                authenticatedSession = session;

                stubAuth0ManagementEndpoint([apiScope.delete.users], (err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({userDeleteScope, oauthTokenScope} = apiScopes);
                  done();
                });
              });
            });
          });

          describe('session access', () => {

            it('returns 401 unauthenticated', done => {
              authenticatedSession
                .delete('/agent')
                .send({
                  id: agent.id,
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(401)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.message).toEqual('Check your email to verify your account');
                  done();
                });
            });
          });

          describe('Bearer token access', () => {

            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, {..._identity, permissions: [scope.delete.agents], email_verified: false });
            });

            it('returns 401 unauthenticated', done => {
              request(app)
                .delete('/agent')
                .send({
                  id: agent.id,
                })
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(401)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.message).toEqual('Check your email to verify your account');
                  done();
                });
            });
          });
        });
      });

      describe('/agent/verify - email verification', () => {

        describe('email already verified', () => {

          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail(err);

              login(_identity, (err, session) => {
                if (err) return done.fail(err);
                authenticatedSession = session;

                stubEmailVerification((err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({emailVerificationScope, emailVerificationOauthTokenScope} = apiScopes);
                  done();
                });
              });
            });
          });

          describe('session access', () => {

            it('returns a friendly message', done => {
              authenticatedSession
                .post('/agent/verify')
                .send({
                  id: 'some-uuid-v4'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.message).toBe('Email already verified');
                  done();
                });
            });

            describe('Auth0', () => {
              it('is not called to re-send an email verification', done => {
                authenticatedSession
                  .post('/agent/verify')
                  .send({
                    id: 'some-uuid-v4'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(emailVerificationOauthTokenScope.isDone()).toBe(false);
                    expect(emailVerificationScope.isDone()).toBe(false);
                    done();
                  });
              });
            });
          });

          describe('Bearer token access', () => {

            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, _identity);
            });

            it('returns a friendly message', done => {
              request(app)
                .post('/agent/verify')
                .send({
                  id: 'some-uuid-v4'
                })
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.message).toBe('Email already verified');
                  done();
                });
            });

            describe('Auth0', () => {

              it('is not called to re-send an email verification', done => {
                request(app)
                  .post('/agent/verify')
                  .send({
                    id: 'some-uuid-v4'
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(emailVerificationOauthTokenScope.isDone()).toBe(false);
                    expect(emailVerificationScope.isDone()).toBe(false);
                    done();
                  });
              });
            });
          });
        });

        describe('email not yet verified', () => {

          beforeEach(done => {
            stubAuth0ManagementApi({ userRead: {..._profile, email_verified: false} }, (err, apiScopes) => {
              if (err) return done.fail(err);

              login(_identity, [scope.delete.agents], (err, session) => {
                if (err) return done.fail(err);
                authenticatedSession = session;

                stubEmailVerification((err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({emailVerificationScope, emailVerificationOauthTokenScope} = apiScopes);
                  done();
                });
              });
            });
          });

          describe('session access', () => {

            it('returns a friendly message', done => {
              authenticatedSession
                .post('/agent/verify')
                .send({
                  id: 'some-uuid-v4'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.message).toBe('Verification sent. Check your email');
                  done();
                });
            });

            describe('Auth0', () => {
              it('is called to re-send an email verification', done => {
                authenticatedSession
                  .post('/agent/verify')
                  .send({
                    id: 'some-uuid-v4'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(emailVerificationOauthTokenScope.isDone()).toBe(true);
                    expect(emailVerificationScope.isDone()).toBe(true);
                    done();
                  });
              });
            });
          });

          describe('Bearer token access', () => {

            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, {..._identity, permissions: [scope.delete.agents], email_verified: false });
            });

            it('returns a friendly message', done => {
              request(app)
                .post('/agent/verify')
                .send({
                  id: 'some-uuid-v4'
                })
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.message).toBe('Verification sent. Check your email');
                  done();
                });
            });

            describe('Auth0', () => {

              it('is called to re-send an email verification', done => {
                request(app)
                  .post('/agent/verify')
                  .send({
                    id: 'some-uuid-v4'
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(emailVerificationOauthTokenScope.isDone()).toBe(true);
                    expect(emailVerificationScope.isDone()).toBe(true);
                    done();
                  });
              });
            });
          });
        });
      });
    });

    describe('forbidden', () => {

      let originalProfile, forbiddenSession;
      beforeEach(done => {
        originalProfile = {..._profile};
        _profile.email = 'someotherguy@example.com';
        _profile.name = 'Some Other Guy';

        stubAuth0ManagementApi((err, apiScopes) => {
          if (err) return done.fail(err);

         login({ ..._identity, email: 'someotherguy@example.com', name: 'Some Other Guy' }, (err, session) => {
            if (err) return done.fail(err);
            forbiddenSession = session;

            done();
          });
        });
      });

      afterEach(() => {
        // Through the magic of node I am able to adjust the profile data returned.
        // This resets the default values
        _profile.email = originalProfile.email;
        _profile.name = originalProfile.name;
      });

      describe('delete', () => {

        it('returns 403', done => {
          forbiddenSession
            .delete('/agent')
            .send({
              id: agent.id
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end((err, res) => {
              if (err) done.fail(err);
              expect(res.body.message).toEqual('Insufficient scope');
              done();
            });
        });

        it('does not remove the record from the database', done => {
          models.Agent.findAll().then(results => {
            // 2 because the unauthorized agent is in the database
            expect(results.length).toEqual(2);

            forbiddenSession
              .delete('/agent')
              .send({
                id: agent.id
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end((err, res) => {
                if (err) done.fail(err);
                models.Agent.findAll().then(results => {
                  expect(results.length).toEqual(2);
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
    });
  });

  describe('unauthenticated', () => {

    it('redirects to login', done => {
      request(app)
        .get('/agent')
        .set('Accept', 'application/json')
        .expect(302)
        .end((err, res) => {
          if (err) return done.fail(err);
          expect(res.headers.location).toEqual('/login');
          done();
        });
    });
  });
});
