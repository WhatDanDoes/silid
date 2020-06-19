const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../../models');
const request = require('supertest');
const uuid = require('uuid');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubUserRead = require('../../support/auth0Endpoints/stubUserRead');
const stubUserAppMetadataRead = require('../../support/auth0Endpoints/stubUserAppMetadataRead');
const stubUserAppMetadataUpdate = require('../../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubOrganizationRead = require('../../support/auth0Endpoints/stubOrganizationRead');
const stubTeamRead = require('../../support/auth0Endpoints/stubTeamRead');
const mailer = require('../../../mailer');
const scope = require('../../../config/permissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../../fixtures/sample-auth0-identity-token');
const _profile = require('../../fixtures/sample-auth0-profile-response');

describe('root/organizationSpec', () => {

  let login, pub, prv, keystore;
  beforeEach(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  let originalProfile;
  afterEach(() => {
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    _profile.email = originalProfile.email;
    delete _profile.user_metadata;
  });

  let root, organization, agent;
  beforeEach(done => {
    originalProfile = {..._profile};
    _profile.email = process.env.ROOT_AGENT;

    models.sequelize.sync({force: true}).then(() => {
      fixtures.loadFile(`${__dirname}/../../fixtures/agents.json`, models).then(() => {
        models.Agent.findAll().then(results => {
          agent = results[0];
          expect(agent.isSuper).toBe(false);
          fixtures.loadFile(`${__dirname}/../../fixtures/organizations.json`, models).then(() => {
            models.Organization.findAll().then(results => {
              organization = results[0];

              models.Agent.create({ email: process.env.ROOT_AGENT }).then(results => {
                root = results;
                expect(root.isSuper).toBe(true);
                done();
              }).catch(err => {
                done.fail(err);
              });
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
    }).catch(err => {
      done.fail(err);
    });
  });

  describe('authorized', () => {
    let oauthTokenScope, rootSession,
        userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope,
        userAppMetadataReadScope, userAppMetadataReadOauthTokenScope,
        organizationReadScope, organizationReadOauthTokenScope;

    beforeEach(done => {
      stubAuth0ManagementApi((err, apiScopes) => {
        if (err) return done.fail();

        login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, (err, session) => {
          if (err) return done.fail(err);
          rootSession = session;

          done();
        });
      });
    });

    describe('create', () => {
      describe('successfully', () => {
        beforeEach(done => {
          // Cached profile doesn't match "live" data, so agent needs to be updated
          // with a call to Auth0
          stubUserRead((err, apiScopes) => {
            if (err) return done.fail();

            // Search for existing organization name
            stubOrganizationRead([], (err, apiScopes) => {
              if (err) return done.fail();
              ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);


              // Retrieve agent profile
              stubUserAppMetadataRead((err, apiScopes) => {
                if (err) return done.fail();
                ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

                stubUserAppMetadataUpdate((err, apiScopes) => {
                  if (err) return done.fail();
                  ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                  done();
                });
              });
            });
          });
        });

        it('returns the agent profile', done => {
          rootSession
            .post('/organization')
            .send({
              name: 'One Book Canada'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.email).toEqual(_profile.email);
              expect(res.body.user_metadata.organizations.length).toEqual(1);
              done();
            });
        });

        describe('Auth0', () => {
          it('is called to see if organization name is already registered', done => {
            rootSession
              .post('/organization')
              .send({
                name: 'One Book Canada'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(organizationReadOauthTokenScope.isDone()).toBe(true);
                expect(organizationReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('calls Auth0 to retrieve the agent user_metadata', done => {
            rootSession
              .post('/organization')
              .send({
                name: 'One Book Canada'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // 2020-6-17 Reuse token from above? This needs to be confirmed in production
                expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(false);
                expect(userAppMetadataReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('calls Auth0 to update the agent', done => {
            rootSession
              .post('/organization')
              .send({
                name: 'One Book Canada'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // 2020-6-17 Reuse token from above? This needs to be confirmed in production
                expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });

      describe('unsuccessfully', () =>{
        beforeEach(done => {
          // Witness node module caching magic
          _profile.user_metadata = { organizations: [ {name: 'One Book Canada', organizer: _profile.email } ] };

          // Cached profile doesn't match "live" data, so agent needs to be updated
          // with a call to Auth0
          stubUserRead((err, apiScopes) => {
            if (err) return done.fail();

            // This stubs calls subsequent to the inital login/permission checking step
            stubUserAppMetadataRead((err, apiScopes) => {
              if (err) return done.fail();
              ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

              stubOrganizationRead((err, apiScopes) => {
                if (err) return done.fail();
                ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                stubUserAppMetadataUpdate((err, apiScopes) => {
                  if (err) return done.fail();
                  ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                  done();
                });
              });
            });
          });
        });

        describe('add a duplicate organization name', () => {
          it('returns an error if record already exists', done => {
            rootSession
              .post('/organization')
              .send({
                name: 'One Book Canada'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.errors.length).toEqual(1);
                expect(res.body.errors[0].message).toEqual('That organization is already registered');
                done();
              });
          });

          describe('Auth0', () => {
            it('is called to see if organization name is already registered', done => {
              rootSession
                .post('/organization')
                .send({
                  name: 'One Book Canada'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(organizationReadOauthTokenScope.isDone()).toBe(true);
                  expect(organizationReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('does not call Auth0 to retrieve the agent user_metadata', done => {
              rootSession
                .post('/organization')
                .send({
                  name: 'One Book Canada'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(false);
                  expect(userAppMetadataReadScope.isDone()).toBe(false);
                  done();
                });
            });

            it('does not call Auth0 to update the agent user_metadata', done => {
              rootSession
                .post('/organization')
                .send({
                  name: 'One Book Canada'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                  expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                  done();
                });
            });
          });
        });

        it('returns an error if empty organization name provided', done => {
          rootSession
            .post('/organization')
            .send({
              name: '   '
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('Organization requires a name');
              done();
            });
        });

        it('returns an error if no organization name provided', done => {
          rootSession
            .post('/organization')
            .send({})
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('Organization requires a name');
              done();
            });
        });

        it('returns an error if organization name is over 128 characters long', done => {
          rootSession
            .post('/organization')
            .send({
              name: '!'.repeat(129)
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('Organization name is too long');
              done();
            });
        });
      });
    });

    describe('delete', () => {
      let organizationId;
      beforeEach(() => {
        organizationId = uuid.v4();
      });

      describe('as organizer', () => {
        describe('successfully', () => {
          beforeEach(done => {

            _profile.user_metadata = {
              organizations: [{ name: 'One Book Canada', organizer: _profile.email, id: organizationId }],
            };

            // Cached profile doesn't match "live" data, so agent needs to be updated
            // with a call to Auth0
            stubUserRead((err, apiScopes) => {
              if (err) return done.fail();

              // Make sure there are no member teams
              stubTeamRead([], (err, apiScopes) => {
                if (err) return done.fail();
                ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                // Get organizer profile
                stubOrganizationRead((err, apiScopes) => {
                  if (err) return done.fail();
                  ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                  // Update former organizer's record
                  stubUserAppMetadataUpdate((err, apiScopes) => {
                    if (err) return done.fail();
                    ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                    done();
                  });
                });
              });
            });
          });

          it('removes organization from Auth0', done => {
            expect(_profile.user_metadata.organizations.length).toEqual(1);
            rootSession
              .delete(`/organization/${organizationId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('Organization deleted');
                expect(_profile.user_metadata.organizations.length).toEqual(0);
                done();
              });
          });

          describe('Auth0', () => {
            it('is called to retrieve any existing member teams', done => {
              rootSession
                .delete(`/organization/${organizationId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(teamReadOauthTokenScope.isDone()).toBe(true);
                  expect(teamReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to retrieve the organizer\'s profile', done => {
              rootSession
                .delete(`/organization/${organizationId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  // 2020-6-18 Reuse token from above? This needs to be confirmed in production
                  expect(organizationReadOauthTokenScope.isDone()).toBe(false);
                  expect(organizationReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to update the former organizer agent', done => {
              rootSession
                .delete(`/organization/${organizationId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  // 2020-6-18 Reuse token from above? This needs to be confirmed in production
                  expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                  expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                  done();
                });
            });
          });
        });

        describe('unsuccessfully', () => {
          const memberTeams = [];

          beforeEach(done => {
            _profile.user_metadata = {
              organizations: [{ name: 'One Book Canada', organizer: _profile.email, id: organizationId }],
              pendingInvitations: [
                { name: 'One Book Canada', recipient: 'someotherguy@example.com', uuid: organizationId, type: 'organization', teamId: uuid.v4() },
                { name: 'One Book Canada', recipient: 'yetanotherguy@example.com', uuid: organizationId, type: 'organization', teamId: uuid.v4() }
              ],
            };

            // Cached profile doesn't match "live" data, so agent needs to be updated
            // with a call to Auth0
            stubUserRead((err, apiScopes) => {
              if (err) return done.fail();

              // Check for member teams
              memberTeams.push({
                ..._profile,
                name: 'A Aaronson',
                email: 'aaaronson@example.com',
                user_id: _profile.user_id + 1,
                user_metadata: {
                  teams: [
                    { name: 'Asia Sensitive', leader: 'teamleader@example.com', id: uuid.v4(), organizationId: organizationId },
                  ]
                }
              });
              stubTeamRead(memberTeams, (err, apiScopes) => {

                if (err) return done.fail();
                ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                // Get organizer profile
                stubOrganizationRead((err, apiScopes) => {
                  if (err) return done.fail();
                  ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                  // Update former organizer's record
                  stubUserAppMetadataUpdate((err, apiScopes) => {
                    if (err) return done.fail();
                    ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                    done();
                  });
                });
              });
            });
          });

          afterEach(() => {
            memberTeams.length = 0;
          });

          it('doesn\'t barf if organization doesn\'t exist', done => {
            rootSession
              .delete('/organization/333')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(404)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('No such organization');
                done();
              });
          });

          it('doesn\'t delete if there are pending invitations', done => {
            memberTeams.length = 0;
            expect(_profile.user_metadata.pendingInvitations.length).toEqual(2);
            rootSession
              .delete(`/organization/${organizationId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(res.body.message).toEqual('Organization has invitations pending. Cannot delete');
                done();
              });
          });

          it('doesn\'t delete if there are member teams', done => {
            rootSession
              .delete(`/organization/${organizationId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(res.body.message).toEqual('Organization has member teams. Cannot delete');
                done();
              });
          });

          describe('Auth0', () => {
            it('is called to retrieve any existing member teams', done => {
              rootSession
                .delete(`/organization/${organizationId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(teamReadOauthTokenScope.isDone()).toBe(true);
                  expect(teamReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is not called to retrieve the organizer\'s profile', done => {
              rootSession
                .delete(`/organization/${organizationId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(organizationReadOauthTokenScope.isDone()).toBe(false);
                  expect(organizationReadScope.isDone()).toBe(false);
                  done();
                });
            });

            it('is not called to update the former organizer agent', done => {
              rootSession
                .delete(`/organization/${organizationId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                  expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                  done();
                });
            });
          });
        });
      });
    });
  });
});
