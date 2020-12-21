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
const stubUserRolesRead = require('../../support/auth0Endpoints/stubUserRolesRead');
const scope = require('../../../config/permissions');

const nock = require('nock');

const _profile = require('../../fixtures/sample-auth0-profile-response');
const _roles = require('../../fixtures/roles');

describe('root/agentEditSpec', () => {

  let originalProfile;

  /**
   * 2019-11-13
   * Sample tokens taken from:
   *
   * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
   */
  const _identity = { ...require('../../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_DOMAIN}/`};
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

          describe('root-level claims', () => {
            it('updates a single claim', done => {
              rootSession
                .patch(`/agent/${_identity.sub}`)
                .send({
                  nickname: 'That Guy Over There'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(res.body.user_metadata.phone_number).toBeUndefined();
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

            it('returns profile data with roles', done => {
              rootSession
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
                  // This is a configured root agent, not assigned. Only one role...
                  expect(res.body.roles.length).toEqual(1);
                  expect(res.body.roles[0].name).toEqual('viewer');
                  done();
                });
            });

            describe('Auth0', () => {
              it('is called to update the agent', done => {
                rootSession
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

              it('is not called to retrieve agent\'s roles', done => {
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

                    expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                    expect(userRolesReadScope.isDone()).toBe(false);
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

            it('is called to update the agent\'s pseudo root claims', done => {
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

                  expect(res.body.user_metadata.phone_number).toEqual('403-266-1234');
                  expect(res.body.email_verified).toEqual(_profile.email_verified);
                  expect(res.body.family_name).toEqual(_profile.family_name);
                  expect(res.body.given_name).toEqual(_profile.given_name);
                  expect(res.body.name).toEqual(_profile.name);
                  expect(res.body.nickname).toEqual(_profile.nickname);
                  expect(res.body.picture).toEqual(_profile.picture);

                  done();
                });
            });

            describe('Auth0', () => {
              it('is called to update the agent\'s root claims', done => {
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
            });
          });


          describe('pseudo and root-level claims', () => {

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

              rootSession
                .patch(`/agent/${_identity.sub}`)
                .send(allClaims)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(res.body.user_metadata.phone_number).toEqual('403-266-1234');
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
                rootSession
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

            describe('root-level claims', () => {
              it('updates a single claim', done => {
                rootSession
                  .patch(`/agent/${anotherAgent.user_id}`)
                  .send({ nickname: 'That Guy Over There' })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    //expect(res.body).toEqual({ ...anotherAgent, phone_number: '403-266-1234' });
                    expect(res.body.user_metadata).toBeUndefined();
                    expect(res.body.email_verified).toEqual(anotherAgent.email_verified);
                    expect(res.body.family_name).toEqual(anotherAgent.family_name);
                    expect(res.body.given_name).toEqual(anotherAgent.given_name);
                    expect(res.body.name).toEqual(anotherAgent.name);
                    expect(res.body.nickname).toEqual('That Guy Over There');
                    expect(res.body.picture).toEqual(anotherAgent.picture);

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

              it('returns profile data with roles', done => {
                rootSession
                  .patch(`/agent/${anotherAgent.user_id}`)
                  .send({
                    nickname: 'That Guy Over There'
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
                    .patch(`/agent/${anotherAgent.user_id}`)
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

                it('is called to retrieve agent\'s roles', done => {
                  rootSession
                    .patch(`/agent/${anotherAgent.user_id}`)
                    .send({
                      nickname: 'That Guy Over There'
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

            /**
             * `phone_number`, though an OIDC standard claim, is only relevant
             * for SMS users. As such, and though it is part of the agent profile
             * data, it is slotted into user_metadata and requires a seperate
             * call to Auth0.
             */
            describe('pseudo root-level claims', () => {

              it('is called to update the agent\'s pseudo root claims', done => {
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

                    expect(res.body.user_metadata.phone_number).toEqual('403-266-1234');
                    expect(res.body.email_verified).toEqual(anotherAgent.email_verified);
                    expect(res.body.family_name).toEqual(anotherAgent.family_name);
                    expect(res.body.given_name).toEqual(anotherAgent.given_name);
                    expect(res.body.name).toEqual(anotherAgent.name);
                    expect(res.body.nickname).toEqual(anotherAgent.nickname);
                    expect(res.body.picture).toEqual(anotherAgent.picture);

                    done();
                  });
              });

              describe('Auth0', () => {
                it('is called to update the agent\'s root claims', done => {
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
              });
            });


            describe('pseudo and root-level claims', () => {

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

                rootSession
                  .patch(`/agent/${anotherAgent.user_id}`)
                  .send(allClaims)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(res.body.user_metadata.phone_number).toEqual('403-266-1234');
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
                  rootSession
                    .patch(`/agent/${anotherAgent.user_id}`)
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

            describe('root-level claims', () => {
              it('updates a single claim', done => {
                rootSession
                  .patch(`/agent/${anotherAgent.user_id}`)
                  .send({
                    nickname: 'That Guy Over There'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(res.body.user_metadata).toBeUndefined();
                    expect(res.body.email_verified).toEqual(anotherAgent.email_verified);
                    expect(res.body.family_name).toEqual(anotherAgent.family_name);
                    expect(res.body.given_name).toEqual(anotherAgent.given_name);
                    expect(res.body.name).toEqual(anotherAgent.name);
                    expect(res.body.nickname).toEqual('That Guy Over There');
                    expect(res.body.picture).toEqual(anotherAgent.picture);

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

                it('is called to retrieve agent\'s roles', done => {
                  rootSession
                    .patch(`/agent/${anotherAgent.user_id}`)
                    .send({
                      nickname: 'That Guy Over There'
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

            /**
             * `phone_number`, though an OIDC standard claim, is only relevant
             * for SMS users. As such, and though it is part of the agent profile
             * data, it is slotted into user_metadata and requires a seperate
             * call to Auth0.
             */
            describe('pseudo root-level claims', () => {

              it('is called to update the agent\'s pseudo root claims', done => {
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

                    expect(res.body.user_metadata.phone_number).toEqual('403-266-1234');
                    expect(res.body.email_verified).toEqual(anotherAgent.email_verified);
                    expect(res.body.family_name).toEqual(anotherAgent.family_name);
                    expect(res.body.given_name).toEqual(anotherAgent.given_name);
                    expect(res.body.name).toEqual(anotherAgent.name);
                    expect(res.body.nickname).toEqual(anotherAgent.nickname);
                    expect(res.body.picture).toEqual(anotherAgent.picture);

                    done();
                  });
              });

              describe('Auth0', () => {
                it('is called to update the agent\'s root claims', done => {
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
              });
            });


            describe('pseudo and root-level claims', () => {

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

                rootSession
                  .patch(`/agent/${anotherAgent.user_id}`)
                  .send(allClaims)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(res.body.user_metadata.phone_number).toEqual('403-266-1234');
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
                  rootSession
                    .patch(`/agent/${anotherAgent.user_id}`)
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
              });
            });
          });
        });
      });
    });
  });
});
