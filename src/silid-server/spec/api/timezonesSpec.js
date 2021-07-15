const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const request = require('supertest');
const nock = require('nock');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubUserRead = require('../support/auth0Endpoints/stubUserRead');
const stubUserAppMetadataUpdate = require('../support/auth0Endpoints/stubUserAppMetadataUpdate');
const scope = require('../../config/permissions');
const apiScope = require('../../config/apiPermissions');
const ct = require('countries-and-timezones')

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = { ...require('../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_CUSTOM_DOMAIN}/`};
const _profile = require('../fixtures/sample-auth0-profile-response');

describe('timezoneSpec', () => {
  let originalProfile;

  let login, pub, prv, keystore;
  beforeEach(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  afterEach(() => {
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    _profile.email_verified = true;
    delete _profile.user_metadata;
    _profile.email = originalProfile.email;
    _profile.name = originalProfile.name;

    nock.cleanAll();
  });

  let agent;
  beforeEach(done => {
    originalProfile = {..._profile};

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

  let authenticatedSession, accessToken;
  describe('authenticated', () => {

    describe('authorized', () => {

      describe('read', () => {

        describe('GET /timezone', () => {
          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();

              login(_identity, [scope.read.agents], (err, session, token) => {
                if (err) return done.fail(err);
                accessToken = token;
                authenticatedSession = session;

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

                  done();
                });
              });
            });
          });

          describe('session access', () => {

            it('retrieves all the world\'s timezones', done => {
              authenticatedSession
                .get('/timezone')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.length).toEqual(543);
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

            it('retrieves all the world\'s timezones', done => {
              request(app)
                .get('/timezone')
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.length).toEqual(543);
                  done();
                });
            });
          });
        });
      });

      describe('update', () => {

        describe('PUT /timezone/:id', () => {

          let userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope
          describe('timezone not set', () => {

            beforeEach(done => {
              expect(_profile.user_metadata).toBeUndefined();

              stubAuth0ManagementApi((err, apiScopes) => {
                if (err) return done.fail();

                login(_identity, [scope.update.agents], (err, session) => {

                  if (err) return done.fail(err);
                  authenticatedSession = session;

                  // Cached profile doesn't match "live" data, so agent needs to be updated
                  // with a call to Auth0
                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

                    /**
                     * 2020-9-3
                     *
                     * This suggests `zoneinfo` is part of the OpenID standard:
                     *
                     * https://openid.net/specs/openid-connect-basic-1_0.html
                     *
                     * This error says this is not true of Auth0 (we are using
                     * OpenID, aren't we?)
                     *
                     * `Bad Request: Payload validation error:
                     *  'Additional properties not allowed:
                     *  zoneinfo (consider storing them in app_metadata
                     *  or user_metadata. See "Users Metadata"
                     *  in https://auth0.com/docs/api/v2/changes for more details`
                     *
                     * Link is broken, btw.
                     */
                    //stubUserUpdate((err, apiScopes) => {
                    //  if (err) return done.fail();
                    //  ({userUpdateScope, userUpdateOauthTokenScope} = apiScopes);
                    //  done();
                    //});

                    stubUserAppMetadataUpdate((err, apiScopes) => {
                      if (err) return done.fail();
                      ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                      done();
                    });
                  });
                });
              });
            });

            describe('session access', () => {
              it('returns the agent\'s profile with the timezone field', done => {
                authenticatedSession
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

              it('returns profile data with roles', done => {
                authenticatedSession
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
                    expect(res.body.roles.length).toEqual(1);
                    expect(res.body.roles[0].name).toEqual('viewer');
                    done();
                  });
              });

              it('updates the user session data', done => {
                models.Session.findAll().then(results => {
                  expect(results.length).toEqual(1);
                  let session = JSON.parse(results[0].data).passport.user;
                  expect(session.name).toEqual(_profile.name);
                  expect(session.email).toEqual(_profile.email);
                  expect(session.user_metadata.zoneinfo).toBeUndefined();

                  authenticatedSession
                    .put(`/timezone/${_identity.sub}`)
                    .send({
                      timezone: 'America/Edmonton'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      models.Session.findAll().then(results => {
                        expect(results.length).toEqual(1);
                        session = JSON.parse(results[0].data).passport.user;

                        expect(session.user_metadata.zoneinfo).toEqual(ct.getTimezone('America/Edmonton'));
                        expect(session.name).toEqual(_profile.name);
                        expect(session.email).toEqual(_profile.email);
                        expect(session.roles.length).toEqual(1);
                        expect(session.roles[0].name).toEqual('viewer');

                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });

              it('returns a friendly message if an invalid timezone is provided', done => {
                authenticatedSession
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

              describe('Auth0', () => {
                it('is called to update the agent', done => {
                  authenticatedSession
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
              });
            });

            describe('Bearer token access', () => {

              beforeEach(() => {
                const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                  .get(/userinfo/)
                  .reply(200, _identity);
              });

              it('returns the agent\'s profile with the timezone field', done => {
                request(app)
                  .put(`/timezone/${_identity.sub}`)
                  .set('Authorization', `Bearer ${accessToken}`)
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

              it('returns profile data with roles', done => {
                request(app)
                  .put(`/timezone/${_identity.sub}`)
                  .set('Authorization', `Bearer ${accessToken}`)
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
                    expect(res.body.roles.length).toEqual(1);
                    expect(res.body.roles[0].name).toEqual('viewer');
                    done();
                  });
              });

              it('returns a friendly message if an invalid timezone is provided', done => {
                request(app)
                  .put(`/timezone/${_identity.sub}`)
                  .set('Authorization', `Bearer ${accessToken}`)
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

              describe('Auth0', () => {
                it('is called to update the agent', done => {
                  request(app)
                    .put(`/timezone/${_identity.sub}`)
                    .set('Authorization', `Bearer ${accessToken}`)
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
              });
            });
          });

          describe('timezone set', () => {

            beforeEach(done => {
              _profile.user_metadata = { zoneinfo: ct.getTimezone('America/Edmonton') };

              stubAuth0ManagementApi((err, apiScopes) => {
                if (err) return done.fail();

                login(_identity, [scope.update.agents], (err, session) => {

                  if (err) return done.fail(err);
                  authenticatedSession = session;

                  // Cached profile doesn't match "live" data, so agent needs to be updated
                  // with a call to Auth0
                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

                    /**
                     * 2020-9-3 See above...
                     */
                    //stubUserUpdate((err, apiScopes) => {
                    //  if (err) return done.fail();

                    //  ({userUpdateScope, userUpdateOauthTokenScope} = apiScopes);
                    //  done();
                    //});

                    stubUserAppMetadataUpdate((err, apiScopes) => {
                      if (err) return done.fail();
                      ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                      done();
                    });
                  });
                });
              });
            });

            describe('session access', () => {
              it('returns the agent\'s profile with the timezone field', done => {
                authenticatedSession
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
                    //expect(res.body.zoneinfo).toEqual(ct.getTimezone('Europe/Paris').name);
                    expect(res.body.user_metadata.zoneinfo).toEqual(ct.getTimezone('Europe/Paris'));
                    done();
                  });
              });

              it('returns profile data with roles', done => {
                authenticatedSession
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
                    expect(res.body.roles.length).toEqual(1);
                    expect(res.body.roles[0].name).toEqual('viewer');
                    done();
                  });
              });

              it('updates the user session data', done => {
                models.Session.findAll().then(results => {
                  expect(results.length).toEqual(1);
                  let session = JSON.parse(results[0].data).passport.user;
                  expect(session.name).toEqual(_profile.name);
                  expect(session.email).toEqual(_profile.email);
                  expect(session.user_metadata.zoneinfo).toEqual(ct.getTimezone('America/Edmonton'));

                  authenticatedSession
                    .put(`/timezone/${_identity.sub}`)
                    .send({
                      timezone: 'Europe/Paris'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      models.Session.findAll().then(results => {
                        expect(results.length).toEqual(1);
                        session = JSON.parse(results[0].data).passport.user;

                        expect(session.user_metadata.zoneinfo).toEqual(ct.getTimezone('Europe/Paris'));
                        expect(session.name).toEqual(_profile.name);
                        expect(session.email).toEqual(_profile.email);
                        expect(session.roles.length).toEqual(1);
                        expect(session.roles[0].name).toEqual('viewer');

                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });

              describe('Auth0', () => {
                it('is called to update the agent', done => {
                  authenticatedSession
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
                  authenticatedSession
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
              });
            });

            describe('Bearer token access', () => {

              beforeEach(() => {
                const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                  .get(/userinfo/)
                  .reply(200, _identity);
              });

              it('returns the agent\'s profile with the timezone field', done => {
                request(app)
                  .put(`/timezone/${_identity.sub}`)
                  .set('Authorization', `Bearer ${accessToken}`)
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
                    //expect(res.body.zoneinfo).toEqual(ct.getTimezone('Europe/Paris').name);
                    expect(res.body.user_metadata.zoneinfo).toEqual(ct.getTimezone('Europe/Paris'));
                    done();
                  });
              });

              it('returns profile data with roles', done => {
                request(app)
                  .put(`/timezone/${_identity.sub}`)
                  .set('Authorization', `Bearer ${accessToken}`)
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
                    expect(res.body.roles.length).toEqual(1);
                    expect(res.body.roles[0].name).toEqual('viewer');
                    done();
                  });
              });

              describe('Auth0', () => {
                it('is called to update the agent', done => {
                  request(app)
                    .put(`/timezone/${_identity.sub}`)
                    .set('Authorization', `Bearer ${accessToken}`)
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

                it('is still called even if the zone is already assigned to the agent', done => {
                  expect(_profile.user_metadata.zoneinfo).toEqual(ct.getTimezone('America/Edmonton'));
                  request(app)
                    .put(`/timezone/${_identity.sub}`)
                    .set('Authorization', `Bearer ${accessToken}`)
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
              });
            });
          });
        });
      });
    });

    describe('unauthorized', () => {
      let unauthorizedSession;
      beforeEach(done => {
        stubAuth0ManagementApi((err, apiScopes) => {
          if (err) return done.fail();

          login(_identity, [scope.read.agents], (err, session) => {
            if (err) return done.fail(err);
            unauthorizedSession = session;

            // Cached profile doesn't match "live" data, so agent needs to be updated
            // with a call to Auth0
            stubUserRead((err, apiScopes) => {
              if (err) return done.fail();

              done();
            });
          });
        });
      });

      it('returns 403', done => {
        unauthorizedSession
          .put('/timezone/some-other-user-id')
          .send({
            timezone: 'America/Edmonton'
          })
          .set('Accept', 'application/json')
          .expect(403)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.body.message).toEqual('Forbidden');
            done();
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
