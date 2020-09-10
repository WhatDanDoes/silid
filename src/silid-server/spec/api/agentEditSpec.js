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
const stubUserAppMetadataUpdate = require('../support/auth0Endpoints/stubUserAppMetadataUpdate');
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

    let authenticatedSession, oauthTokenScope, auth0ManagementScope,
        userUpdateScope, userUpdateOauthTokenScope,
        userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope;
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

          describe('root-level claims', () => {
            it('updates a single claim', done => {
              authenticatedSession
                .patch(`/agent/${_identity.sub}`)
                .send({ nickname: 'That Guy Over There' })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(res.body.phone_number).toBeUndefined();
                  expect(res.body.email_verified).toEqual(_profile.email_verified);
                  expect(res.body.family_name).toEqual(_profile.family_name);
                  expect(res.body.given_name).toEqual(_profile.given_name);
                  expect(res.body.name).toEqual(_profile.name);
                  expect(res.body.nickname).toEqual('That Guy Over There');
                  expect(res.body.picture).toEqual(_profile.picture);

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

            it('returns profile data with roles', done => {
              authenticatedSession
                .patch(`/agent/${_identity.sub}`)
                .send({
                  nickname: 'That Guy Over There'
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
                authenticatedSession
                  .patch(`/agent/${_identity.sub}`)
                  .send({
                    nickname: 'That Guy Over There'
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

              it('is not called to update the agent\'s pseudo root claims', done => {
                authenticatedSession
                  .patch(`/agent/${_identity.sub}`)
                  .send({
                    nickname: 'That Guy Over There'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                    expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                    done();
                  });
              });
            });
          });

          /**
           * `phone_number`, though an OIDC standard claim, is only relevant
           * for SMS users. As such, and though it is part of the agent profile
           * data, it is slotted into user_metadata and requires a seperate
           * call to Auth0.
           */
          describe('pseudo root-level claims', () => {

            describe('Auth0', () => {
              it('is called to update the agent\'s root claims', done => {
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

              it('is called to update the agent\'s pseudo root claims', done => {
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

                    expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                    expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                    done();
                  });
              });
            });
          });


          describe('pseudo and root-level claims together at last', () => {

            const allClaims = {
              email_verified: true,
              family_name: 'Sanders',
              given_name: 'Harland',
              name: 'Harland Sanders',
              nickname: 'Colonel Sanders',
              phone_number: '403-266-1234',
              picture: 'http://example.com/mypic.jpg',
            }

            it('updates all non-dependent claims', done => {
              expect(_profile).not.toEqual({..._profile, ...allClaims });

              authenticatedSession
                .patch(`/agent/${_identity.sub}`)
                .send(allClaims)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  //expect(res.body).toEqual({..._profile, ...allClaims });
                  expect(res.body.phone_number).toEqual('403-266-1234');
                  expect(res.body.email_verified).toBe(true);
                  expect(res.body.family_name).toEqual('Sanders');
                  expect(res.body.given_name).toEqual('Harland');
                  expect(res.body.name).toEqual('Harland Sanders');
                  expect(res.body.nickname).toEqual('Colonel Sanders');
                  expect(res.body.picture).toEqual('http://example.com/mypic.jpg');

                  done();
                });
            });

            describe('Auth0', () => {
              it('is called to update the agent\'s root claims', done => {
                authenticatedSession
                  .patch(`/agent/${_identity.sub}`)
                  .send(allClaims)
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

              it('is called to update the agent\'s pseudo root claims', done => {
                authenticatedSession
                  .patch(`/agent/${_identity.sub}`)
                  .send(allClaims)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                    expect(userAppMetadataUpdateScope.isDone()).toBe(true);
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

          it('returns 401 unauthenticated', done => {
            authenticatedSession
              .patch(`/agent/${_identity.sub}`)
              .send({ phone_number: '403-266-1234' })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(401)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(res.body.message).toEqual('Check your email to verify your account');
                done();


                done();
              });
          });
        });
      });
    });

    describe('forbidden', () => {
      let originalProfile;

      let forbiddenSession;
      beforeEach(done => {
        originalProfile = {..._profile};
        _profile.email = 'someotherguy@example.com';
        _profile.name = 'Some Other Guy';
        _profile.user_id = _profile.user_id + 1;

        stubAuth0ManagementApi((err, apiScopes) => {
          if (err) return done.fail(err);

         login({ ..._identity, email: 'someotherguy@example.com', name: 'Some Other Guy' }, (err, session) => {
            if (err) return done.fail(err);
            forbiddenSession = session;

            // Cached profile doesn't match "live" data, so agent needs to be updated
            // with a call to Auth0
            stubUserRead((err, apiScopes) => {
              if (err) return done.fail();

              done();
            });
          });
        });
      });

      afterEach(() => {
        // Through the magic of node I am able to adjust the profile data returned.
        // This resets the default values
        _profile.email = originalProfile.email;
        _profile.name = originalProfile.name;
        _profile.user_id = originalProfile.user_id;
      });

      it('returns 403 forbidden', done => {
        forbiddenSession
          .patch(`/agent/${_identity.sub}`)
          .send({ phone_number: '403-266-1234' })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(403)
          .end(function(err, res) {
            if (err) return done.fail(err);

            expect(res.body.message).toEqual('Forbidden');
            done();
          });
      });
    });
  });

  describe('unauthenticated', () => {

    it('redirects to login', done => {
      request(app)
        .patch(`/agent/${_identity.sub}`)
        .send({ phone_number: '403-266-1234' })
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
