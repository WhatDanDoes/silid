const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubAuth0ManagementEndpoint = require('../../support/stubAuth0ManagementEndpoint');
const stubUserRead = require('../../support/auth0Endpoints/stubUserRead');
const stubUserCreate = require('../../support/auth0Endpoints/stubUserCreate');
const stubUserRolesRead = require('../../support/auth0Endpoints/stubUserRolesRead');
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
const _identity = { ...require('../../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_CUSTOM_DOMAIN}/`};
const _profile = require('../../fixtures/sample-auth0-profile-response');

describe('root/agentSpec', () => {

  let login, pub, prv, keystore,
      root, agent, originalProfile;
  beforeEach(done => {
    originalProfile = {..._profile};
    _profile.email = process.env.ROOT_AGENT;

    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);

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
  });

  afterEach(() => {
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    _profile.email = originalProfile.email;
  });

  describe('authorized', () => {

    let rootSession;
    beforeEach(done => {
      stubAuth0ManagementApi((err, apiScopes) => {
        if (err) return done.fail(err);

        login({..._identity, email: process.env.ROOT_AGENT}, (err, session) => {
          if (err) return done.fail(err);
          rootSession = session;

          done();
        });
      });
    });

    describe('read', () => {

      describe('/agent', () => {

        beforeEach(done => {
          stubUserRead((err, apiScopes) => {
            if (err) return done.fail(err);
            ({userReadScope, userReadOauthTokenScope} = apiScopes);

             // Retrieve the roles to which this agent is assigned
             stubUserRolesRead((err, apiScopes) => {
               if (err) return done.fail(err);
               ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

              done();
            });
          });
        });

        it('attaches isSuper flag for app-configured root agent', done => {
          rootSession
            .get('/agent')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) return done.fail(err);

              expect(res.body.email).toEqual(_profile.email);
              expect(res.body.isSuper).toBe(true);
              done();
            });
        });

        describe('Auth0', () => {
          it('is called to retrieve root agent profile data', done => {
            rootSession
              .get('/agent')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) return done.fail(err);

                // Note: the OAuth token request is being satisfied by existing mocks
                expect(userReadOauthTokenScope.isDone()).toBe(false);
                expect(userReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to retrieve the roles to which the agent is assigned', done => {
            rootSession
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
        });
      });

      describe('/agent/admin', () => {
        beforeEach(done => {
          const stubUserList = require('../../support/auth0Endpoints/stubUserList');

          stubUserList((err, apiScopes) => {
            if (err) return done.fail(err);
            ({userListScope, userListOauthTokenScope} = apiScopes);
            done();
          });
        });

        it('retrieves all the agents at Auth0', done => {
          rootSession
            .get('/agent/admin')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/) .expect(200) .end((err, res) => {
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
          it('calls Auth0 to read the agent list at the Auth0-defined connection', done => {
            rootSession
              .get('/agent/admin')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) return done.fail(err);

                // Note: the OAuth token request is being satisfied by existing mocks
                expect(userListOauthTokenScope.isDone()).toBe(false);
                expect(userListScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });

      describe('/agent/admin/:page', () => {

        beforeEach(done => {
          const stubUserList = require('../../support/auth0Endpoints/stubUserList');

          stubUserList((err, apiScopes) => {
            if (err) return done.fail(err);
            ({userListScope, userListOauthTokenScope} = apiScopes);
            done();
          });
        });

        it('retrieves all the agents at Auth0', done => {
          rootSession
            .get(`/agent/admin/5`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
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
          it('calls Auth0 to read the agent at the Auth0-defined connection', done => {
            rootSession
              .get('/agent/admin')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) return done.fail(err);

                // Note: the OAuth token request is being satisfied by existing mocks
                expect(userListOauthTokenScope.isDone()).toBe(false);
                expect(userListScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });

      describe('/agent/:id', () => {

        beforeEach(done => {
          stubUserRead((err, apiScopes) => {
            if (err) return done.fail(err);
            ({userReadScope, userReadOauthTokenScope} = apiScopes);

            // Retrieve the roles to which this agent is assigned
            stubUserRolesRead((err, apiScopes) => {
              if (err) return done.fail(err);
              ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

              done();
            });
          });
        });

        it('retrieves a record from Auth0', done => {
          rootSession
            .get(`/agent/${agent.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) return done.fail(err);

              expect(res.body.email).toBeDefined();
              done();
            });
        });

        describe('Auth0', () => {
          it('calls Auth0 to read the agent at the Auth0-defined connection', done => {
            rootSession
              .get(`/agent/${_identity.sub}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) return done.fail(err);

                // Note: the OAuth token request is being satisfied by existing mocks
                expect(userReadOauthTokenScope.isDone()).toBe(false);
                expect(userReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to retrieve the roles to which the agent is assigned', done => {
            rootSession
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
        });
      });
    });

    describe('create', () => {

      beforeEach(done => {
        stubAuth0ManagementApi((err, apiScopes) => {
          if (err) return done.fail();

          stubUserCreate((err, apiScopes) => {
            if (err) return done.fail(err);

            ({userCreateScope, userCreateOauthTokenScope} = apiScopes);
            done();
          });
        });
      });

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
          rootSession
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
          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail(err);

            // This ensures agent has a socialProfile (because he's visited);
            login({..._identity, email: agent.email}, (err, session) => {
              if (err) return done.fail(err);
              done();
            });
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
            .end((err, res) => {
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
            .end((err, res) => {
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
            .end((err, res) => {
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
      _profile.email = originalProfile.email;

      stubAuth0ManagementApi((err, apiScopes) => {
        if (err) return done.fail(err);

        login({ ..._identity, email: agent.email }, [scope.read.agents], (err, session) => {
          if (err) return done.fail(err);
          unauthorizedSession = session;

          done();
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
            .end((err, res) => {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('Insufficient scope');
              done();
            });
        });
      });
    });
  });
});
