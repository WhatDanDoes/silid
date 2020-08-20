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
const app = require('../../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubUserUpdate = require('../../support/auth0Endpoints/stubUserUpdate');
const stubUserRead = require('../../support/auth0Endpoints/stubUserRead');
const scope = require('../../../config/permissions');

const nock = require('nock');

const _profile = require('../../fixtures/sample-auth0-profile-response');

describe('root/agentEditSpec', () => {

  let originalProfile;

  /**
   * 2019-11-13
   * Sample tokens taken from:
   *
   * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
   */
  const _identity = require('../../fixtures/sample-auth0-identity-token');
  const _access = require('../../fixtures/sample-auth0-access-token');

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

  afterEach(() => {
    nock.cleanAll();
  });



  describe('authenticated', () => {

    let rootSession, userUpdateScope, userUpdateOauthTokenScope;
    describe('authorized', () => {

      let rootSession;

      describe('update', () => {

        describe('root\'s own profile', () => {

          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail(err);

              login({..._identity, email: process.env.ROOT_AGENT}, (err, session) => {
                if (err) return done.fail(err);
                rootSession = session;

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
            rootSession
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

            rootSession
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
              rootSession
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
              rootSession
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
            rootSession
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
            rootSession
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
              rootSession
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
              rootSession
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
              rootSession
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

        describe('another agent\'s profile', () => {

          describe('email verified', () => {
            const anotherAgent = {..._profile, email: 'someotherguy@example.com', name: 'Some Other Guy', user_id: _profile.user_id + 1};

            beforeEach(done => {
              stubAuth0ManagementApi((err, apiScopes) => {
                if (err) return done.fail(err);

                login({..._identity, email: process.env.ROOT_AGENT}, (err, session) => {
                  if (err) return done.fail(err);
                  rootSession = session;

                  // Cached profile doesn't match "live" data, so agent needs to be updated
                  // with a call to Auth0
                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

                    stubUserUpdate(anotherAgent, (err, apiScopes) => {
                      if (err) return done.fail();

                      ({userUpdateScope, userUpdateOauthTokenScope} = apiScopes);
                      done();
                    });
                  });
                });
              });
            });


            it('updates a single claim', done => {
              rootSession
                .patch(`/agent/${anotherAgent.user_id}`)
                .send({ phone_number: '403-266-1234' })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(res.body).toEqual({ ...anotherAgent, phone_number: '403-266-1234' });

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

              expect(_profile).not.toEqual({...anotherAgent, ...allClaims });

              rootSession
                .patch(`/agent/${anotherAgent.user_id}`)
                .send(allClaims)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(res.body).toEqual({...anotherAgent, ...allClaims });

                  done();
                });
            });

            describe('dependent claims', () => {

              it('does not unblock when `blocked` is set to false (as per the docs)', done => {
                rootSession
                  .patch(`/agent/${anotherAgent.user_id}`)
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
                rootSession
                  .patch(`/agent/${anotherAgent.user_id}`)
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
              rootSession
                .patch(`/agent/${anotherAgent.user_id}`)
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
              rootSession
                .patch(`/agent/${anotherAgent.user_id}`)
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
                rootSession
                  .patch(`/agent/${anotherAgent.user_id}`)
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
                rootSession
                  .patch(`/agent/${anotherAgent.user_id}`)
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
                rootSession
                  .patch(`/agent/${anotherAgent.user_id}`)
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
            const anotherAgent = {..._profile, email_verified: false, email: 'someotherguy@example.com', name: 'Some Other Guy', user_id: _profile.user_id + 1};

            beforeEach(done => {
              stubAuth0ManagementApi((err, apiScopes) => {
                if (err) return done.fail(err);

                login({..._identity, email: process.env.ROOT_AGENT}, (err, session) => {
                  if (err) return done.fail(err);
                  rootSession = session;

                  // Cached profile doesn't match "live" data, so agent needs to be updated
                  // with a call to Auth0
                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

                    stubUserUpdate(anotherAgent, (err, apiScopes) => {
                      if (err) return done.fail();

                      ({userUpdateScope, userUpdateOauthTokenScope} = apiScopes);
                      done();
                    });
                  });
                });
              });
            });


            it('updates a single claim', done => {
              rootSession
                .patch(`/agent/${anotherAgent.user_id}`)
                .send({ phone_number: '403-266-1234' })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(res.body).toEqual({ ...anotherAgent, phone_number: '403-266-1234' });

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

              expect(_profile).not.toEqual({...anotherAgent, ...allClaims });

              rootSession
                .patch(`/agent/${anotherAgent.user_id}`)
                .send(allClaims)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(res.body).toEqual({...anotherAgent, ...allClaims });

                  done();
                });
            });

            describe('dependent claims', () => {

              it('does not unblock when `blocked` is set to false (as per the docs)', done => {
                rootSession
                  .patch(`/agent/${anotherAgent.user_id}`)
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
                rootSession
                  .patch(`/agent/${anotherAgent.user_id}`)
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
              rootSession
                .patch(`/agent/${anotherAgent.user_id}`)
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
              rootSession
                .patch(`/agent/${anotherAgent.user_id}`)
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
                rootSession
                  .patch(`/agent/${anotherAgent.user_id}`)
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
                rootSession
                  .patch(`/agent/${anotherAgent.user_id}`)
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
                rootSession
                  .patch(`/agent/${anotherAgent.user_id}`)
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
        });
      });
    });
  });
});
