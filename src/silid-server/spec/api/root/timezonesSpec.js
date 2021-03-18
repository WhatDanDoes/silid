const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const fixtures = require('sequelize-fixtures');
const nock = require('nock');
const models = require('../../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubUserRead = require('../../support/auth0Endpoints/stubUserRead');
const stubUserRolesRead = require('../../support/auth0Endpoints/stubUserRolesRead');
const stubUserAppMetadataUpdate = require('../../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubUserUpdate = require('../../support/auth0Endpoints/stubUserUpdate');
const scope = require('../../../config/permissions');
const apiScope = require('../../../config/apiPermissions');
const ct = require('countries-and-timezones')

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = { ...require('../../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_CUSTOM_DOMAIN}/`};
const _profile = require('../../fixtures/sample-auth0-profile-response');
const _roles = require('../../fixtures/roles');

describe('root/timezoneSpec', () => {
  let originalProfile;

  let login, pub, prv, keystore;
  beforeEach(done => {
    originalProfile = {..._profile};
    _profile.email = process.env.ROOT_AGENT;

    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  afterEach(() => {
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    _profile.email = originalProfile.email;
    delete _profile.user_metadata;
    nock.cleanAll();
  });

  let root, agent;
  beforeEach(done => {
    models.sequelize.sync({force: true}).then(() => {

      fixtures.loadFile(`${__dirname}/../../fixtures/agents.json`, models).then(() => {
        models.Agent.findAll().then(results => {
          agent = results[0];
          expect(agent.isSuper).toBe(false);

          models.Agent.create({ email: process.env.ROOT_AGENT, name: 'Professor Fresh' }).then(results => {
            root = results;
            expect(root.isSuper).toBe(true);
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

  let rootSession;
  describe('authenticated', () => {

    describe('authorized', () => {

      describe('read', () => {

        describe('GET /timezone', () => {
          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();

              login({..._identity, email: process.env.ROOT_AGENT}, (err, session) => {
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

          it('retrieves all the world\'s timezones', done => {
            rootSession
              .get('/timezone')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(Object.keys(res.body).length).toEqual(544);
                done();
              });
          });
        });
      });

      describe('update', () => {

        describe('PUT /timezone/:id', () => {

          describe('root\'s own profile', () => {

            let userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope,
                userRolesReadScope, userRolesReadOauthTokenScope;
            describe('timezone not set', () => {

              beforeEach(done => {
                expect(_profile.user_metadata).toBeUndefined();

                stubAuth0ManagementApi((err, apiScopes) => {
                  if (err) return done.fail();

                  login({..._identity, email: process.env.ROOT_AGENT}, (err, session) => {
                    if (err) return done.fail(err);
                    rootSession = session;

                    // Cached profile doesn't match "live" data, so agent needs to be updated
                    // with a call to Auth0
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail();

                      stubUserAppMetadataUpdate((err, apiScopes) => {
                        if (err) return done.fail();
                        ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);

                        stubUserRolesRead((err, apiScopes) => {
                          if (err) return done.fail(err);
                          ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

                          done();
                        });
                      });
                    });
                  });
                });
              });

              it('returns the agent\'s profile with the timezone field', done => {
                rootSession
                  .put(`/timezone/${_identity.sub}`)
                  .send({
                    timezone: 'America/Edmonton'
                  })
                  .set('Accept', 'application/json')
                  .redirects(1)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(res.body.name).toEqual(_profile.name);
                    expect(res.body.email).toEqual(_profile.email);
                    expect(res.body.user_metadata.zoneinfo).toEqual(ct.getTimezone('America/Edmonton'));
                    done();
                  });
              });

              it('returns a friendly message if an invalid timezone is provided', done => {
                rootSession
                  .put(`/timezone/${_identity.sub}`)
                  .send({
                    timezone: 'Antarctica/Atlantis'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('That timezone does not exist');
                    done();
                  });
              });

              it('returns profile data with roles', done => {
                rootSession
                  .put(`/timezone/${_identity.sub}`)
                  .send({
                    timezone: 'America/Edmonton'
                  })
                  .set('Accept', 'application/json')
                  .redirects(1)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(res.body.name).toEqual(_profile.name);
                    expect(res.body.email).toEqual(_profile.email);
                    // This is a configured root agent, not assigned. Only one role...
                    expect(res.body.roles.length).toEqual(1);
                    expect(res.body.roles[0].name).toEqual('viewer');
                    done();
                  });
              });

              describe('Auth0', () => {
                it('is called to update the agent', done => {
                  rootSession
                    .put(`/timezone/${_identity.sub}`)
                    .send({
                      timezone: 'America/Edmonton'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
                      expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is not called to retrieve agent\'s roles', done => {
                  rootSession
                    .put(`/timezone/${_identity.sub}`)
                    .send({
                      timezone: 'America/Edmonton'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                      expect(userRolesReadScope.isDone()).toBe(false);
                      done();
                    });
                });
              });
            });

            describe('timezone set', () => {

              beforeEach(done => {
                _profile.user_metadata = { zoneinfo: ct.getTimezone('America/Edmonton') };

                stubAuth0ManagementApi((err, apiScopes) => {
                  if (err) return done.fail();

                  login({..._identity, email: process.env.ROOT_AGENT}, (err, session) => {
                    if (err) return done.fail(err);
                    rootSession = session;

                    // Cached profile doesn't match "live" data, so agent needs to be updated
                    // with a call to Auth0
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail();

                      stubUserAppMetadataUpdate((err, apiScopes) => {
                        if (err) return done.fail();
                        ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);

                        stubUserRolesRead((err, apiScopes) => {
                          if (err) return done.fail(err);
                          ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

                          done();
                        });
                      });
                    });
                  });
                });
              });

              it('returns the agent\'s profile with the timezone field', done => {
                rootSession
                  .put(`/timezone/${_identity.sub}`)
                  .send({
                    timezone: 'Europe/Paris'
                  })
                  .set('Accept', 'application/json')
                  .redirects(1)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(res.body.name).toEqual(_profile.name);
                    expect(res.body.email).toEqual(_profile.email);
                    expect(res.body.user_metadata.zoneinfo).toEqual(ct.getTimezone('Europe/Paris'));
                    done();
                  });
              });

              it('returns profile data with roles', done => {
                rootSession
                  .put(`/timezone/${_identity.sub}`)
                  .send({
                    timezone: 'Europe/Paris'
                  })
                  .set('Accept', 'application/json')
                  .redirects(1)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(res.body.name).toEqual(_profile.name);
                    expect(res.body.email).toEqual(_profile.email);
                    // This is a configured root agent, not assigned. Only one role...
                    expect(res.body.roles.length).toEqual(1);
                    expect(res.body.roles[0].name).toEqual('viewer');
                    done();
                  });
              });

              describe('Auth0', () => {
                it('is called to update the agent', done => {
                  rootSession
                    .put(`/timezone/${_identity.sub}`)
                    .send({
                      timezone: 'Europe/Paris'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
                      expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is still called even if the language is already assigned to the agent', done => {
                  expect(_profile.user_metadata.zoneinfo).toEqual(ct.getTimezone('America/Edmonton'));
                  rootSession
                    .put(`/timezone/${_identity.sub}`)
                    .send({
                      timezone: 'America/Edmonton'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
                      expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is not called to retrieve agent\'s roles', done => {
                  rootSession
                    .put(`/timezone/${_identity.sub}`)
                    .send({
                      timezone: 'America/Edmonton'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                      expect(userRolesReadScope.isDone()).toBe(false);
                      done();
                    });
                });
              });
            });
          });

          describe('another agent\'s profile', () => {

            const assignedRoles = [];
            beforeEach(() => {
              assignedRoles.push(_roles[2], _roles[0]);
            });

            afterEach(() => {
              assignedRoles.length = 0;
            });

            let userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope;

            describe('timezone not set', () => {

              const anotherAgent = {..._profile, email: 'someotherguy@example.com', name: 'Some Other Guy', user_id: _profile.user_id + 1};

              beforeEach(done => {
                expect(_profile.user_metadata).toBeUndefined();

                stubAuth0ManagementApi((err, apiScopes) => {
                  if (err) return done.fail();

                  login({..._identity, email: process.env.ROOT_AGENT}, (err, session) => {
                    if (err) return done.fail(err);
                    rootSession = session;

                    // Cached profile doesn't match "live" data, so agent needs to be updated
                    // with a call to Auth0
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail();

                      stubUserAppMetadataUpdate(anotherAgent, (err, apiScopes) => {
                        if (err) return done.fail();
                        ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);

                        stubUserRolesRead(assignedRoles, (err, apiScopes) => {
                          if (err) return done.fail(err);
                          ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

                          done();
                        });
                      });
                    });
                  });
                });
              });

              it('returns the agent\'s profile with the timezone field', done => {
                rootSession
                  .put(`/timezone/${anotherAgent.user_id}`)
                  .send({
                    timezone: 'America/Edmonton'
                  })
                  .set('Accept', 'application/json')
                  .redirects(1)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(res.body.name).toEqual(anotherAgent.name);
                    expect(res.body.email).toEqual(anotherAgent.email);
                    expect(res.body.user_metadata.zoneinfo).toEqual(ct.getTimezone('America/Edmonton'));
                    done();
                  });
              });

              it('returns a friendly message if an invalid timezone is provided', done => {
                rootSession
                  .put(`/timezone/${anotherAgent.user_id}`)
                  .send({
                    timezone: 'Antarctica/Atlantis'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('That timezone does not exist');
                    done();
                  });
              });

              it('returns profile data with roles', done => {
                rootSession
                  .put(`/timezone/${anotherAgent.user_id}`)
                  .send({
                    timezone: 'America/Edmonton'
                  })
                  .set('Accept', 'application/json')
                  .redirects(1)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(res.body.name).toEqual(anotherAgent.name);
                    expect(res.body.email).toEqual(anotherAgent.email);
                    expect(res.body.roles.length).toEqual(2);
                    expect(res.body.roles[0].name).toEqual('viewer');
                    expect(res.body.roles[1].name).toEqual('organizer');
                    done();
                  });
              });


              describe('Auth0', () => {
                it('is called to update the agent', done => {
                  rootSession
                    .put(`/timezone/${anotherAgent.user_id}`)
                    .send({
                      timezone: 'America/Edmonton'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
                      expect(userAppMetadataUpdateScope.isDone()).toBe(true);

                      done();
                    });
                });

                it('is called to retrieve agent\'s roles', done => {
                  rootSession
                    .put(`/timezone/${anotherAgent.user_id}`)
                    .send({
                      timezone: 'America/Edmonton'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                      expect(userRolesReadScope.isDone()).toBe(true);
                      done();
                    });
                });
              });
            });

            describe('timezone set', () => {

              const anotherAgent = {
                ..._profile,
                email: 'someotherguy@example.com',
                name: 'Some Other Guy',
                user_metadata: {
                  ..._profile.user_metadata, zoneinfo: 'America/Edmonton'
                },
                user_id: _profile.user_id + 1
              };

              beforeEach(done => {
                _profile.user_metadata = { zoneinfo: ct.getTimezone('America/Edmonton') };

                stubAuth0ManagementApi((err, apiScopes) => {
                  if (err) return done.fail();

                  login({..._identity, email: process.env.ROOT_AGENT}, (err, session) => {
                    if (err) return done.fail(err);
                    rootSession = session;

                    // Cached profile doesn't match "live" data, so agent needs to be updated
                    // with a call to Auth0
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail();

                      stubUserAppMetadataUpdate(anotherAgent, (err, apiScopes) => {
                        if (err) return done.fail();
                        ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);

                        stubUserRolesRead(assignedRoles, (err, apiScopes) => {
                          if (err) return done.fail(err);
                          ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

                          done();
                        });
                      });
                    });
                  });
                });
              });

              it('returns the agent\'s profile with the timezone field', done => {
                rootSession
                  .put(`/timezone/${anotherAgent.user_id}`)
                  .send({
                    timezone: 'Europe/Paris'
                  })
                  .set('Accept', 'application/json')
                  .redirects(1)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(res.body.name).toEqual(anotherAgent.name);
                    expect(res.body.email).toEqual(anotherAgent.email);
                    expect(res.body.user_metadata.zoneinfo).toEqual(ct.getTimezone('Europe/Paris'));
                    done();
                  });
              });

              it('returns profile data with roles', done => {
                rootSession
                  .put(`/timezone/${anotherAgent.user_id}`)
                  .send({
                    timezone: 'Europe/Paris'
                  })
                  .set('Accept', 'application/json')
                  .redirects(1)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(res.body.name).toEqual(anotherAgent.name);
                    expect(res.body.email).toEqual(anotherAgent.email);
                    expect(res.body.roles.length).toEqual(2);
                    expect(res.body.roles[0].name).toEqual('viewer');
                    expect(res.body.roles[1].name).toEqual('organizer');
                    done();
                  });
              });

              describe('Auth0', () => {
                it('is called to update the agent', done => {
                  rootSession
                    .put(`/timezone/${anotherAgent.user_id}`)
                    .send({
                      timezone: 'Europe/Paris'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
                      expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is still called even if the language is already assigned to the agent', done => {
                  expect(_profile.user_metadata.zoneinfo).toEqual(ct.getTimezone('America/Edmonton'));
                  rootSession
                    .put(`/timezone/${anotherAgent.user_id}`)
                    .send({
                      timezone: 'America/Edmonton'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
                      expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is called to retrieve agent\'s roles', done => {
                  rootSession
                    .put(`/timezone/${anotherAgent.user_id}`)
                    .send({
                      timezone: 'America/Edmonton'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                      expect(userRolesReadScope.isDone()).toBe(true);
                      done();
                    });
                });
              });
            });
          });
        });
      });
    });
  });

  describe('not authenticated', () => {
    it('redirects to login', done => {
      request(app)
        .get('/timezone')
        .set('Accept', 'application/json')
        .expect(302)
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(res.headers.location).toEqual('/login');
          done();
        });
    });
  });
});
