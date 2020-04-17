const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubAuth0ManagementEndpoint = require('../../support/stubAuth0ManagementEndpoint');
const scope = require('../../../config/permissions');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const nock = require('nock');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../../fixtures/sample-auth0-identity-token');
const _access = require('../../fixtures/sample-auth0-access-token');

describe('root/agentSpec', () => {

  let login, pub, prv, keystore;
  beforeEach(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
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

  describe('authorized', () => {

    let rootSession;
    beforeEach(done => {
      login({..._identity, email: process.env.ROOT_AGENT}, (err, session) => {
        if (err) return done.fail(err);
        rootSession = session;
        done();
      });
    });

    describe('read', () => {

      let oauthTokenScope, userListScope, userReadScope;
      beforeEach(done => {
        stubAuth0ManagementApi((err, apiScopes) => {
          if (err) return done.fail(err);
          stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
            if (err) return done.fail(err);
            ({userListScope, userReadScope, oauthTokenScope} = apiScopes);
            done();
          });
        });
      });

      describe('/agent', () => {
        describe('Auth0', () => {
          it('calls the Auth0 /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
            rootSession
              .get('/agent')
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
            rootSession
              .get('/agent')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('attaches isSuper flag to user_metadata for app-configured root agent', done => {
            rootSession
              .get('/agent')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // This is just returning whatever is in
                // `fixtures/sample-auth0-profile-response`.
                // Don't be alarmed when the emails don't match
                expect(res.body.email).toBeDefined();

                expect(res.body.user_metadata.isSuper).toBe(true);
                done();
              });
          });
        });
      });

      describe('/agent/admin', () => {
        it('retrieves all the agents at Auth0', done => {
          rootSession
            .get(`/agent/admin`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);

              /**
               * For the purpose of documenting expected fields
               */
              let userList = require('../../fixtures/managementApi/userList');
              expect(res.body).toEqual(userList);
              expect(res.body.start).toEqual(0);
              expect(res.body.limit).toEqual(30);
              expect(res.body.length).toEqual(1);
              expect(res.body.total).toEqual(100);
              expect(res.body.users.length).toEqual(userList.length);
              done();
            });
        });

        describe('Auth0', () => {
          it('calls the Auth0 /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
            rootSession
              .get(`/agent/admin`)
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
            rootSession
              .get(`/agent/admin`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userListScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });

      describe('/agent/admin/:page', () => {
        it('retrieves all the agents at Auth0', done => {
          rootSession
            .get(`/agent/admin/5`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);

              /**
               * For the purpose of documenting expected fields
               */
              let userList = require('../../fixtures/managementApi/userList');
              expect(res.body.start).toEqual(5);
              expect(res.body.limit).toEqual(30);
              expect(res.body.length).toEqual(1);
              expect(res.body.total).toEqual(100);
              expect(res.body.users.length).toEqual(userList.length);
              done();
            });
        });

        describe('Auth0', () => {
          it('calls the Auth0 /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
            rootSession
              .get(`/agent/admin`)
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
            rootSession
              .get(`/agent/admin`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userListScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });

      describe('/agent/admin/cached', () => {

        it('retrieves all the agents in the database', done => {
          models.Agent.findAll({ where: { socialProfile: { [models.Sequelize.Op.ne]: null} } }).then(results => {
            rootSession
              .get(`/agent/admin/cached`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);

                /**
                 * For the purpose of documenting expected fields
                 */
                expect(res.body.start).toEqual(0);
                expect(res.body.limit).toEqual(30);
                expect(res.body.length).toEqual(results.length);
                expect(res.body.total).toEqual(results.length);
                expect(res.body.users.length).toEqual(results.length);
                expect(res.body.users[0].given_name).toBeDefined();
                expect(res.body.users[0].id).toEqual(results[0].id);

                done();
              });
          }).catch(err => {
            done.fail(err);
          });
        });

        describe('Auth0', () => {
          it('does not call the Auth0 /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
            rootSession
              .get(`/agent/admin/cached`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(oauthTokenScope.isDone()).toBe(false);
                done();
              });
          });

          it('does not call Auth0 to read the agent at the Auth0-defined connection', done => {
            rootSession
              .get(`/agent/admin/cached`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userListScope.isDone()).toBe(false);
                done();
              });
          });
        });
      });

      describe('/agent/admin/:page/cached', () => {
        it('retrieves all the agents in the database', done => {
          models.Agent.findAll({ where: { socialProfile: { [models.Sequelize.Op.ne]: null} } }).then(results => {
          rootSession
            .get(`/agent/admin/0/cached`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);

              /**
               * For the purpose of documenting expected fields
               */
              let userList = require('../../fixtures/managementApi/userList');
              expect(res.body.start).toEqual(0);
              expect(res.body.limit).toEqual(30);
              expect(res.body.length).toEqual(results.length);
              expect(res.body.total).toEqual(results.length);
              expect(res.body.users.length).toEqual(results.length);
              expect(res.body.users[0].given_name).toBeDefined();
              expect(res.body.users[0].id).toEqual(results[0].id);

              done();
            });
          }).catch(err => {
            done.fail(err);
          });
        });

        it('retrieves an empty array when out of range', done => {
          models.Agent.findAll().then(results => {
          rootSession
            .get(`/agent/admin/100/cached`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(res.body.length).toEqual(0);
              done();
            });
          }).catch(err => {
            done.fail(err);
          });
        });

        describe('Auth0', () => {
          it('does not call the Auth0 /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
            rootSession
              .get(`/agent/admin/0/cached`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(oauthTokenScope.isDone()).toBe(false);
                done();
              });
          });

          it('does not call Auth0 to read the agent at the Auth0-defined connection', done => {
            rootSession
              .get(`/agent/admin/0/cached`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userListScope.isDone()).toBe(false);
                done();
              });
          });
        });
      });

      describe('/agent/:id', () => {
        describe('Auth0', () => {
          it('calls the Auth0 /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
            rootSession
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
            rootSession
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
            rootSession
              .get(`/agent/${agent.id}`)
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

      describe('/agent/:id/cached', () => {
        it('retrieves root agent\'s own record from the database', done => {
          rootSession
            .get(`/agent/${root.id}/cached`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(res.body.email).toEqual(root.email);
              expect(res.body.isSuper).toEqual(true);
              done();
            });
        });

        it('retrieves another agent\'s record from the database', done => {
          rootSession
            .get(`/agent/${agent.id}/cached`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(res.body.email).toEqual(agent.email);
              expect(res.body.isSuper).toEqual(false);
              done();
            });
        });

        it('doesn\'t barf if record doesn\'t exist', done => {
          rootSession
            .get('/agent/33/cached')
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
    });

    describe('create', () => {

      let userCreateScope, oauthTokenScope;
      beforeEach(done => {
        stubAuth0ManagementApi((err, apiScopes) => {
          if (err) return done.fail();

          stubAuth0ManagementEndpoint([apiScope.create.users], (err, apiScopes) => {
            if (err) return done.fail(err);

            ({userCreateScope, oauthTokenScope} = apiScopes);
            done();
          });
        });
      });

// 2020-4-8
//      describe('database', () => {
//        it('adds a new record to the database', done => {
//          models.Agent.findAll().then(results => {
//            expect(results.length).toEqual(2);
//
//            rootSession
//              .post('/agent')
//              .send({
//                email: 'someotherguy@example.com'
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(201)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//
//                expect(res.body.email).toEqual('someotherguy@example.com');
//
//                models.Agent.findAll().then(results => {
//                  expect(results.length).toEqual(3);
//                  done();
//                }).catch(err => {
//                  done.fail(err);
//                });
//              });
//          }).catch(err => {
//            done.fail(err);
//          });
//        });
//
//        it('returns an error if record already exists', done => {
//          rootSession
//            .post('/agent')
//            .send({
//              email: agent.email
//            })
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(500)
//            .end(function(err, res) {
//              if (err) done.fail(err);
//
//              expect(res.body.errors.length).toEqual(1);
//              expect(res.body.errors[0].message).toEqual('That agent is already registered');
//              done();
//            });
//        });
//      });

      describe('Auth0', () => {
        it('calls the Auth0 /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
          rootSession
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
          rootSession
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

//        it('does not call the Auth0 endpoints if record already exists', done => {
//          rootSession
//            .post('/agent')
//            .send({
//              email: agent.email
//            })
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(500)
//            .end(function(err, res) {
//              if (err) done.fail(err);
//
//              expect(oauthTokenScope.isDone()).toBe(false);
//              expect(userCreateScope.isDone()).toBe(false);
//              done();
//            });
//        });
      });
    });

    describe('update', () => {

      beforeEach(done => {
        stubAuth0ManagementApi((err, apiScopes) => {
          stubAuth0ManagementEndpoint([apiScope.update.users], (err, apiScopes) => {
            if (err) return done.fail(err);
            done();
          });
        });
      });

      describe('agent who has visited', () => {
        beforeEach(done => {
          // This ensures agent has a socialProfile (because he's visited);
          login({..._identity, email: agent.email}, (err, session) => {
            if (err) return done.fail(err);
            done();
          });
        });

        it('updates an existing record in the database', done => {
          rootSession
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

            rootSession
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
          rootSession
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

      describe('agent who has never visited', () => {
        it('updates an existing record in the database', done => {
          rootSession
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

            rootSession
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
      });
    });

    describe('delete', () => {

      beforeEach(done => {
        stubAuth0ManagementApi((err, apiScopes) => {
          if (err) return done.fail(err);
          stubAuth0ManagementEndpoint([apiScope.delete.users], (err, apiScopes) => {
            if (err) return done.fail(err);
            done();
          });
        });
      });

      describe('agent who has visited', () => {
        beforeEach(done => {
          // This ensures agent has a socialProfile (because he's visited);
          login({..._identity, email: agent.email}, (err, session) => {
            if (err) return done.fail(err);
            done();
          });
        });

        it('removes an existing record from the database', done => {
          rootSession
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
          rootSession
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
      });

      describe('agent who has never visited', () => {
        it('removes an existing record from the database', done => {
          rootSession
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
      });
    });
  });

  describe('unauthorized', () => {
    let unauthorizedSession;
    beforeEach(done => {
      login({ ..._identity, email: agent.email }, [scope.read.agents], (err, session) => {
        if (err) return done.fail(err);
        unauthorizedSession = session;

        stubAuth0ManagementApi((err, apiScopes) => {
          if (err) return done.fail(err);

          stubAuth0ManagementEndpoint([apiScope.read.users],(err, apiScopes) => {
            if (err) return done.fail(err);
            done();
          });
        });
      });
    });

    describe('read', () => {
      describe('/agent/admin', () => {
        it('returns 403 with message', done => {
          unauthorizedSession
            .get(`/agent/admin`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('Insufficient scope');
              done();
            });
        });
      });

      describe('/agent/:id/cached', () => {
        it('returns 403 with message', done => {
          unauthorizedSession
            .get(`/agent/${root.id}/cached`)
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
  });
});
