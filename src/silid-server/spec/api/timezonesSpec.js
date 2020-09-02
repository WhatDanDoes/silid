const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubUserRead = require('../support/auth0Endpoints/stubUserRead');
const stubUserRolesRead = require('../support/auth0Endpoints/stubUserRolesRead');
const stubUserAppMetadataUpdate = require('../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubUserUpdate = require('../support/auth0Endpoints/stubUserUpdate');
const scope = require('../../config/permissions');
const apiScope = require('../../config/apiPermissions');
const ct = require('countries-and-timezones')

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../fixtures/sample-auth0-identity-token');
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

  let authenticatedSession;
  describe('authenticated', () => {

    describe('authorized', () => {

      describe('read', () => {

        describe('GET /timezone', () => {
          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();

              login(_identity, [scope.read.agents], (err, session) => {
                if (err) return done.fail(err);
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

          it('retrieves all the world\'s timezones', done => {
            authenticatedSession
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

          let userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope;
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

//                    stubUserAppMetadataUpdate((err, apiScopes) => {
//                      if (err) return done.fail();
//                      ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
//
//                      /**
//                       * For redirect after timezone update
//                       */
//                      stubAuth0ManagementApi((err, apiScopes) => {
//                        if (err) return done.fail();
//
//                        stubUserRead((err, apiScopes) => {
//                          if (err) return done.fail();
//
//                          stubUserRolesRead((err, apiScopes) => {
//                            if (err) return done.fail();
//
                            stubUserUpdate((err, apiScopes) => {
                              if (err) return done.fail();

                              ({userUpdateScope, userUpdateOauthTokenScope} = apiScopes);
                              done();
                            });
//                          });
//                        });
//                      });
//                    });
                  });
                });
              });
            });

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
                  expect(res.body.zoneinfo).toEqual(ct.getTimezone('America/Edmonton').name);
                  done();
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

                    expect(userUpdateOauthTokenScope.isDone()).toBe(true);
                    expect(userUpdateScope.isDone()).toBe(true);
                    done();
                  });
              });
            });
          });

          describe('timezone set', () => {

            beforeEach(done => {
              _profile.zoneinfo = 'America/Edmonton';

              stubAuth0ManagementApi((err, apiScopes) => {
                if (err) return done.fail();

                login(_identity, [scope.update.agents], (err, session) => {

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
                  expect(res.body.zoneinfo).toEqual(ct.getTimezone('Europe/Paris').name);
                  done();
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

                    expect(userUpdateOauthTokenScope.isDone()).toBe(true);
                    expect(userUpdateScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('is not called if the language is already assigned to the agent', done => {
                expect(_profile.zoneinfo).toEqual('America/Edmonton');
                authenticatedSession
                  .put(`/timezone/${_identity.sub}`)
                  .send({
                    timezone: 'America/Edmonton'
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
