const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const models = require('../../../models');
const uuid = require('uuid');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubUserRead = require('../../support/auth0Endpoints/stubUserRead');
const stubUserAppMetadataRead = require('../../support/auth0Endpoints/stubUserAppMetadataRead');
const stubUserAppMetadataUpdate = require('../../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubOrganizationRead = require('../../support/auth0Endpoints/stubOrganizationRead');
const stubTeamRead = require('../../support/auth0Endpoints/stubTeamRead');
const scope = require('../../../config/permissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = { ...require('../../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_DOMAIN}/`};
const _profile = require('../../fixtures/sample-auth0-profile-response');

describe('root/organizationDeleteSpec', () => {

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

  let root;
  beforeEach(done => {
    originalProfile = {..._profile};
    _profile.email = process.env.ROOT_AGENT;

    models.sequelize.sync({force: true}).then(() => {
      models.Agent.create({ email: process.env.ROOT_AGENT }).then(results => {
        root = results;
        expect(root.isSuper).toBe(true);
        done();
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

      describe('without affiliation', () => {

        const organizerProfile = {..._profile, name: 'A Aaronson', email: 'aaaronson@example.com', user_id: _profile.user_id + 1 };
        describe('successfully', () => {

          beforeEach(done => {

            _profile.user_metadata = {};

            organizerProfile.user_metadata = {
              organizations: [{ name: 'One Book Canada', organizer: organizerProfile.email, id: organizationId }],
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
                stubOrganizationRead([organizerProfile], (err, apiScopes) => {
                  if (err) return done.fail();
                  ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                  // Update former organizer's record
                  stubUserAppMetadataUpdate(organizerProfile, (err, apiScopes) => {
                    if (err) return done.fail();
                    ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                    done();
                  });
                });
              });
            });
          });

          it('removes organization from Auth0', done => {
            expect(organizerProfile.user_metadata.organizations.length).toEqual(1);
            rootSession
              .delete(`/organization/${organizationId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('Organization deleted');
                expect(organizerProfile.user_metadata.organizations.length).toEqual(0);
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

            _profile.user_metadata = {};

            organizerProfile.user_metadata = {
              organizations: [{ name: 'One Book Canada', organizer: organizerProfile.email, id: organizationId }],
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
                name: 'Zelda Zerk',
                email: 'zzerk@example.com',
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
                stubOrganizationRead([organizerProfile], (err, apiScopes) => {
                  if (err) return done.fail();
                  ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                  // Update former organizer's record
                  stubUserAppMetadataUpdate(organizerProfile, (err, apiScopes) => {
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
            expect(organizerProfile.user_metadata.pendingInvitations.length).toEqual(2);
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
