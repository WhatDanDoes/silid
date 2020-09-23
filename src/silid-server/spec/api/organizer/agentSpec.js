const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubAuth0ManagementEndpoint = require('../../support/stubAuth0ManagementEndpoint');
const stubUserRead = require('../../support/auth0Endpoints/stubUserRead');
const stubUserRolesRead = require('../../support/auth0Endpoints/stubUserRolesRead');
const scope = require('../../../config/permissions');
const apiScope = require('../../../config/apiPermissions');
const roles = require('../../../config/roles');
const jwt = require('jsonwebtoken');
const nock = require('nock');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../../fixtures/sample-auth0-identity-token');
const _profile = require('../../fixtures/sample-auth0-profile-response');
const _roles = require('../../fixtures/roles');

describe('organizer/agentSpec', () => {
  let originalProfile;

  let login, pub, prv, keystore;
  beforeEach(done => {
    originalProfile = {..._profile};

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

  let agent;
  beforeEach(done => {
    models.sequelize.sync({force: true}).then(() => {

      fixtures.loadFile(`${__dirname}/../../fixtures/agents.json`, models).then(() => {
        models.Agent.findAll().then(results => {
          agent = results[0];
          expect(agent.isSuper).toBe(false);

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

  afterEach(() => {
    nock.cleanAll();
  });

  describe('authorized', () => {

    let organizerSession;
    beforeEach(done => {
      stubAuth0ManagementApi({ userRoles: [_roles[0], _roles[2]] }, (err, apiScopes) => {
        if (err) return done.fail(err);

        login({..._identity, email: _profile.email}, roles.organizer.concat(roles.viewer), (err, session) => {
          if (err) return done.fail(err);
          organizerSession = session;
          done();
        });
      });
    });

    describe('read', () => {

      describe('/agent', () => {

        let oauthTokenScope, userReadScope,
            userRolesReadScope, userRolesReadOauthTokenScope;
        beforeEach(done => {
          stubUserRead((err, apiScopes) => {
            if (err) return done.fail(err);
            ({userReadScope, oauthTokenScope} = apiScopes);

            stubUserRolesRead([_roles[0], _roles[2]], (err, apiScopes) => {
              if (err) return done.fail(err);
              ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

              done();
            });
          });
        });

        it('attaches isOrganizer flag for organizer agent', done => {
          organizerSession
            .get('/agent')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(res.body.email).toEqual(_profile.email);
              expect(res.body.isOrganizer).toBe(true);
              done();
            });
        });

        describe('Auth0', () => {
          it('is called to retrieve agent profile data', done => {
            organizerSession
              .get('/agent')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(oauthTokenScope.isDone()).toBe(true);
                expect(userReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to retrieve the roles to which the agent is assigned', done => {
            organizerSession
              .get('/agent')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userRolesReadOauthTokenScope.isDone()).toBe(false);
                expect(userRolesReadScope.isDone()).toBe(true);

                done();
              });
          });
        });
      });

      describe('/agent/admin', () => {
        let oauthTokenScope, userListScope;
        beforeEach(done => {
          const stubUserList = require('../../support/auth0Endpoints/stubUserList');

          stubUserList((err, apiScopes) => {
            if (err) return done.fail(err);
            ({userListScope, oauthTokenScope} = apiScopes);
            done();
          });
        });

        it('retrieves all the agents at Auth0', done => {
          organizerSession
            .get('/agent/admin')
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
          it('calls the /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
            organizerSession
              .get('/agent/admin')
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
            organizerSession
              .get('/agent/admin')
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
        let oauthTokenScope, userListScope;
        beforeEach(done => {
          const stubUserList = require('../../support/auth0Endpoints/stubUserList');

          stubUserList((err, apiScopes) => {
            if (err) return done.fail(err);
            ({userListScope, oauthTokenScope} = apiScopes);
            done();
          });
        });

        it('retrieves all the agents at Auth0', done => {
          organizerSession
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
          it('calls Auth0 to read the agent at the Auth0-defined connection', done => {
            organizerSession
              .get('/agent/admin')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userListScope.isDone()).toBe(true);
                expect(oauthTokenScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });


      describe('/agent/:id', () => {

        let oauthTokenScope, userReadScope,
            userRolesReadScope, userRolesReadOauthTokenScope;

        beforeEach(done => {
          stubUserRead((err, apiScopes) => {
            if (err) return done.fail(err);
            ({userReadScope, oauthTokenScope} = apiScopes);

            stubUserRolesRead([_roles[0], _roles[2]], (err, apiScopes) => {
              if (err) return done.fail(err);
              ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

              done();
            });
          });
        });

        it('retrieves a record from Auth0', done => {
          organizerSession
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

        describe('Auth0', () => {
          it('calls Auth0 to read the agent at the Auth0-defined connection', done => {
            organizerSession
              .get(`/agent/${_identity.sub}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userReadScope.isDone()).toBe(true);
                expect(oauthTokenScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to retrieve the roles to which the agent is assigned', done => {
            organizerSession
              .get(`/agent/${_identity.sub}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
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

    describe('delete', () => {

      let oauthTokenScope, userReadScope,
          userRolesReadScope, userRolesReadOauthTokenScope;
      let anotherAgent;
      beforeEach(done => {
        stubUserRead((err, apiScopes) => {
          if (err) return done.fail(err);
          ({userReadScope, oauthTokenScope} = apiScopes);

          stubUserRolesRead([_roles[0], _roles[2]], (err, apiScopes) => {
            if (err) return done.fail(err);
            ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

            models.Agent.create({ email: 'someotherguy@example.com', name: 'Some Other Guy' }).then(results => {
              anotherAgent = results;
              done();
            }).catch(err => {
              done.fail(err);
            });
          });
        });
      });

      it('removes an existing record from the database', done => {
        organizerSession
          .delete('/agent')
          .send({
            id: anotherAgent.id,
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(403)
          .end(function(err, res) {
            if (err) return done.fail(err);
            done();
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

          // Cached profile doesn't match "live" data, so agent needs to be updated
          // with a call to Auth0
          stubUserRead((err, apiScopes) => {
            if (err) return done.fail();

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
    });
  });
});
