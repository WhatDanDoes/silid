const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubAuth0ManagementEndpoint = require('../support/stubAuth0ManagementEndpoint');
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

    let authenticatedSession, oauthTokenScope, auth0ManagementScope;
    describe('authorized', () => {

      describe('create', () => {

        let auth0UserCreateScope;
        beforeEach(done => {
          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail(err);

            login(_identity, [scope.create.agents], (err, session) => {
              if (err) return done.fail(err);
              authenticatedSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
                if (err) return done.fail();

                stubAuth0ManagementEndpoint([apiScope.create.users], (err, apiScopes) => {
                  if (err) return done.fail();

                  ({userCreateScope, oauthTokenScope} = apiScopes);
                  done();
                });
              });
            });
          });
        });

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
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(oauthTokenScope.isDone()).toBe(true);
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
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userCreateScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });

      describe('read', () => {

        describe('/agent', () => {
          let userReadScope;
          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail(err);

              ({userReadScope, oauthTokenScope} = apiScopes);

              login(_identity, [scope.read.agents], (err, session) => {
                if (err) return done.fail(err);
                authenticatedSession = session;

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
                  if (err) return done.fail();

                  done();
                });
              });
            });
          });

          it('returns the info attached to the req.user object', done => {
            authenticatedSession
              .get(`/agent`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(res.body.email).toEqual(_identity.email);
                expect(res.body.name).toEqual(_identity.name);
                expect(res.body.user_id).toEqual(_identity.sub);
                done();
              });
          });

          it('has the agent metadata set', done => {
            authenticatedSession
              .get(`/agent`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.user_metadata).toBeDefined();
                done();
              });
          });


          it('does not attach isSuper status to a regular agent', done => {
            authenticatedSession
              .get(`/agent`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(res.body.isSuper).toBeUndefined();
                done();
              });
          });
        });

        describe('/agent/:id', () => {

          let userReadScope;
          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail(err);

              login(_identity, [scope.read.agents], (err, session) => {
                if (err) return done.fail(err);
                authenticatedSession = session;

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
                  if (err) return done.fail();

                  stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
                    if (err) return done.fail(err);
                    ({userReadScope, oauthTokenScope} = apiScopes);

                    done();
                  });
                });
              });
            });
          });

          describe('Auth0', () => {
            it('calls the Auth0 /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
              authenticatedSession
                .get(`/agent/${_identity.sub}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(oauthTokenScope.isDone()).toBe(true);
                  done();
                });
            });

            it('calls Auth0 to read the agent at the Auth0-defined connection', done => {
              authenticatedSession
                .get(`/agent/${_identity.sub}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(userReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('retrieves a record from Auth0', done => {
              authenticatedSession
                .get(`/agent/${_identity.sub}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(res.body.email).toBeDefined();
                  done();
                });
            });
          });
        });
      });

      describe('update', () => {
        beforeEach(done => {
          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail(err);

            login(_identity, [scope.update.agents], (err, session) => {
              if (err) return done.fail(err);
              authenticatedSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
                if (err) return done.fail();

                stubAuth0ManagementEndpoint([apiScope.update.users], (err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({oauthTokenScope} = apiScopes);

                  done();
                });
              });
            });
          });
        });

        it('updates an existing record in the database', done => {
          authenticatedSession
            .put('/agent')
            .send({
              id: agent.id,
              name: 'Some Cool Guy'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(res.body.name).toEqual('Some Cool Guy');

              models.Agent.findOne({ where: { id: agent.id }}).then(results => {
                expect(results.name).toEqual('Some Cool Guy');
                expect(results.email).toEqual(agent.email);
                done();
              }).catch(err => {
                done.fail(err);
              });
            });
        });

        it('allows updating null fields', done => {
          agent.name = null;
          agent.save().then(agent => {
            expect(agent.name).toBeNull();

            authenticatedSession
              .put('/agent')
              .send({
                id: agent.id,
                name: 'Some Cool Guy'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(res.body.name).toEqual('Some Cool Guy');

                models.Agent.findOne({ where: { id: agent.id }}).then(results => {
                  expect(results.name).toEqual('Some Cool Guy');
                  expect(results.email).toEqual(agent.email);
                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
          }).catch(err => {
            done.fail(err);
          });
        });

        it('doesn\'t barf if agent doesn\'t exist', done => {
          authenticatedSession
            .put('/agent')
            .send({
              id: 111,
              name: 'Some Guy'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) done.fail(err);

              expect(res.body.message).toEqual('No such agent');
              done();
            });
        });
      });

      describe('delete', () => {

        let userDeleteScope;
        beforeEach(done => {
          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail(err);

            login(_identity, [scope.delete.agents], (err, session) => {
              if (err) return done.fail(err);
              authenticatedSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
                if (err) return done.fail();

                stubAuth0ManagementEndpoint([apiScope.delete.users], (err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({userDeleteScope, oauthTokenScope} = apiScopes);
                  done();
                });
              });
            });
          });
        });

        it('removes an existing record from the database', done => {
          authenticatedSession
            .delete('/agent')
            .send({
              id: agent.id,
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
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
            .end(function(err, res) {
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
              .end(function(err, res) {
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
              .end(function(err, res) {
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
              .end(function(err, res) {
                if (err) done.fail(err);

                expect(oauthTokenScope.isDone()).toBe(false);
                expect(userDeleteScope.isDone()).toBe(false);
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

        stubAuth0ManagementApi((err, apiScopes) => {
          if (err) return done.fail(err);

         login({ ..._identity, email: 'someotherguy@example.com', name: 'Some Other Guy' }, (err, session) => {
            if (err) return done.fail(err);
            forbiddenSession = session;

            // Cached profile doesn't match "live" data, so agent needs to be updated
            // with a call to Auth0
            stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
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
      });

      describe('update', () => {
        it('returns 403', done => {
          forbiddenSession
            .put('/agent')
            .send({
              id: agent.id,
              name: 'Some Cool Guy'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('Insufficient scope');
              done();
            });
        });

        it('does not change the record in the database', done => {
          forbiddenSession
            .put('/agent')
            .send({
              id: agent.id,
              name: 'Some Cool Guy'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) done.fail(err);
              models.Agent.findOne({ where: { id: agent.id }}).then(results => {
                expect(results.name).toEqual('Some Guy');
                expect(results.email).toEqual(agent.email);
                done();
              }).catch(err => {
                done.fail(err);
              });
            });
        });
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
            .end(function(err, res) {
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
              .end(function(err, res) {
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
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(res.headers.location).toEqual('/login');
          done();
        });
    });
  });
});
