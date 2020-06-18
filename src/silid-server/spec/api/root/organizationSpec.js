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

    describe('read', () => {
//
//      beforeEach(done => {
//        // Cached profile doesn't match "live" data, so agent needs to be updated
//        // with a call to Auth0
//        stubUserRead((err, apiScopes) => {
//          if (err) return done.fail();
//          done();
//        });
//      });
//
//      describe('/organization', () => {
//
//        let organizationId, anotherOrganizationId;
//        beforeEach(done => {
//          // Manufacture some orgs
//          organizationId = uuid.v4();
//          anotherOrganizationId = uuid.v4();
//          done();
//        });
//
//        it('retrieves only the root agent\'s organization', done => {
//          _profile.user_metadata = {
//            organizations: [
//              {name: 'The National Lacrosse League', organizer: _profile.email, id: anotherOrganizationId },
//              {name: 'One Book Canada', organizer: _profile.email, id: organizationId }
//            ]
//          };
//
//          stubUserAppMetadataRead((err, apiScopes) => {
//            if (err) return done.fail();
//            let {userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes;
//
//            expect(_profile.user_metadata.organizations.length).toEqual(2);
//            rootSession
//              .get(`/organization`)
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(200)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//                expect(res.body.length).toEqual(2);
//                expect(res.body[0]).toEqual({name: 'One Book Canada', organizer: _profile.email, id: organizationId });
//                expect(res.body[1]).toEqual({name: 'The National Lacrosse League', organizer: _profile.email, id: anotherOrganizationId });
//
//                // Auth0 is the souce
//                expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
//                expect(userAppMetadataReadScope.isDone()).toBe(true);
//
//                done();
//              });
//          });
//        });
//      });
//
//      describe('/organization/admin', () => {
//        it('retrieves all organizations', done => {
//          models.Organization.create({ name: 'Mr Worldwide', creatorId: agent.id }).then(o => {
//            models.Organization.findAll().then(results => {
//              expect(results.length).toEqual(2);
//              rootSession
//                .get(`/organization/admin`)
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(200)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(res.body.length).toEqual(2);
//                  done();
//                });
//            }).catch(err => {
//              done.fail(err);
//            });
//          }).catch(err => {
//            done.fail(err);
//          });
//        });
//      });


      describe('GET /organization/:id', () => {
        let organizationId, team1Id, team2Id;
        beforeEach(done => {
          organizationId = uuid.v4();
          team1Id = uuid.v4();
          team2Id = uuid.v4();

          _profile.user_metadata = { organizations: [{ name: 'One Book Canada', organizer: _profile.email, id: organizationId }] };

          // Cached profile doesn't match "live" data, so agent needs to be updated
          // with a call to Auth0
          stubUserRead((err, apiScopes) => {
            if (err) return done.fail();

            stubOrganizationRead((err, apiScopes) => {
              if (err) return done.fail();
              ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

              stubTeamRead([{..._profile,
                              user_metadata: {
                                ..._profile.user_metadata,
                                teams: [
                                  { name: 'Guinea-Bissau', leader: 'squadleader@example.com', id: team2Id, organizationId: organizationId },
                                  { name: 'Mystery Incorporated', leader: 'thelma@example.com', id: uuid.v4(), organizationId: uuid.v4() }
                                ]
                              }
                            },
                            {..._profile,
                              name: 'A Aaronson',
                              email: 'aaaronson@example.com',
                              user_id: _profile.user_id + 1,
                              user_metadata: {
                                teams: [
                                  { name: 'Asia Sensitive', leader: 'teamleader@example.com', id: team1Id, organizationId: organizationId },
                                  { name: 'The A-Team', leader: 'babaracus@example.com', id: uuid.v4(), organizationId: uuid.v4() }
                                ]
                              }
                            }], (err, apiScopes) => {
                ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                stubUserAppMetadataUpdate((err, apiScopes) => {
                  if (err) return done.fail();
                  ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                  done();
                });
              });
            });
          });
        });

        it('collates agent data into organization data', done => {
          rootSession
            .get(`/organization/${organizationId}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.name).toEqual('One Book Canada');
              expect(res.body.organizer).toEqual(_profile.email);
              expect(res.body.id).toEqual(organizationId);
              // Alphabetical according to name
              expect(res.body.teams.length).toEqual(2);
              expect(res.body.teams[0]).toEqual({ name: 'Asia Sensitive', leader: 'teamleader@example.com', id: team1Id, organizationId: organizationId });
              expect(res.body.teams[1]).toEqual({ name: 'Guinea-Bissau', leader: 'squadleader@example.com', id: team2Id, organizationId: organizationId });

              done();
            });
        });

        it('doesn\'t barf if record doesn\'t exist', done => {
          rootSession
            .get('/organization/333')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('No such organization');
              done();
            });
        });

        describe('Auth0', () => {
          it('is called to retrieve organization data', done => {
            rootSession
              .get(`/organization/${organizationId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(organizationReadOauthTokenScope.isDone()).toBe(true);
                expect(organizationReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to retrieve team data', done => {
            rootSession
              .get(`/organization/${organizationId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                // Token re-used from first request
                expect(teamReadOauthTokenScope.isDone()).toBe(false);
                expect(teamReadScope.isDone()).toBe(true);
                done();
              });
          });
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

    describe('update', () => {

      let teamId, team1Id, team2Id, organizationId,
          organizationReadByIdScope, organizationReadByIdOauthTokenScope,
          organizationReadByNameScope, organizationReadByNameOauthTokenScope,
          teamReadRsvpsScope, teamReadRsvpsOauthTokenScope;

      const rsvpList = [];

      beforeEach(done => {
        teamId = uuid.v4();
        team1Id = uuid.v4();
        team2Id = uuid.v4();
        organizationId = uuid.v4();

        _profile.user_metadata = {
          organizations: [{ name: 'One Book Canada', organizer: _profile.email, id: organizationId }],
          pendingInvitations: [
            { name: 'One Book Canada', recipient: 'someotherguy@example.com', uuid: organizationId, type: 'organization', teamId: teamId },
            { name: 'One Book Canada', recipient: 'yetanotherguy@example.com', uuid: organizationId, type: 'organization', teamId: team2Id }
          ],
          teams: [
            { name: 'Guinea-Bissau', leader: 'yetanotherguy@example.com', id: team2Id, organizationId: organizationId },
            { name: 'Mystery Incorporated', leader: 'thelma@example.com', id: uuid.v4(), organizationId: uuid.v4() }
          ]
        };

        // Cached profile doesn't match "live" data, so agent needs to be updated
        // with a call to Auth0
        stubUserRead((err, apiScopes) => {
          if (err) return done.fail();

          // See if organization name is already registered
          stubOrganizationRead((err, apiScopes) => {
            if (err) return done.fail();
            ({organizationReadScope: organizationReadByNameScope, organizationReadOauthTokenScope: organizationReadByNameOauthTokenScope} = apiScopes);

            // Get organization by ID
            stubOrganizationRead((err, apiScopes) => {
              if (err) return done.fail();
              ({organizationReadScope: organizationReadByIdScope, organizationReadOauthTokenScope: organizationReadByIdOauthTokenScope} = apiScopes);

              // Get member teams
              stubTeamRead([{..._profile },
                            {..._profile,
                              name: 'A Aaronson',
                              email: 'aaaronson@example.com',
                              user_id: _profile.user_id + 1,
                              user_metadata: {
                                teams: [
                                  { name: 'Asia Sensitive', leader: 'teamleader@example.com', id: team1Id, organizationId: organizationId },
                                  { name: 'The A-Team', leader: 'babaracus@example.com', id: uuid.v4(), organizationId: uuid.v4() }
                                ]
                              }
                            }], (err, apiScopes) => {
                if (err) return done.fail();
                ({teamReadScope: teamMembershipReadScope, teamReadOauthTokenScope: teamMembershipReadOauthTokenScope} = apiScopes);

                // Get RSVPs
                rsvpList.push({
                                ..._profile,
                                name: 'Some Other Guy',
                                email: 'someotherguy@example.com',
                                user_id: _profile.user_id + 2,
                                user_metadata: {
                                  rsvps: [
                                    { name: 'One Book Canada', recipient: 'someotherguy@example.com', uuid: organizationId, type: 'organization', teamId: teamId }
                                  ]
                                }
                              });
                rsvpList.push({
                                ..._profile,
                                name: 'Yet Another Guy',
                                email: 'yetanotherguy@example.com',
                                user_id: _profile.user_id + 3,
                                user_metadata: {
                                  rsvps: [
                                    { name: 'One Book Canada', recipient: 'yetanotherguy@example.com', uuid: organizationId, type: 'organization', teamId: team2Id }
                                  ]
                                }
                              });
                stubTeamRead(rsvpList, (err, apiScopes) => {
                  if (err) return done.fail();
                  ({teamReadScope: teamReadRsvpsScope, teamReadOauthTokenScope: teamReadRsvpsOauthTokenScope} = apiScopes);

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
      });

      afterEach(() => {
        // 2020-6-16 https://stackoverflow.com/a/1232046/1356582
        // Empty/reset list
        rsvpList.length = 0;
      });

      it('allows a team creator to update an existing record', done => {
        rootSession
          .put(`/organization/${organizationId}`)
          .send({
            name: 'Two Testaments Bolivia'
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) return done.fail(err);

            expect(res.body.name).toEqual('Two Testaments Bolivia');
            expect(res.body.organizer).toEqual(_profile.email);
            expect(res.body.id).toEqual(organizationId);
            expect(res.body.teams.length).toEqual(2);
            expect(res.body.teams[0]).toEqual({ name: 'Asia Sensitive', leader: 'teamleader@example.com', id: team1Id, organizationId: organizationId });
            expect(res.body.teams[1]).toEqual({ name: 'Guinea-Bissau', leader: 'yetanotherguy@example.com', id: team2Id, organizationId: organizationId });

            done();
          });
      });

      it('updates any pending invitations', done => {
        expect(_profile.user_metadata.pendingInvitations.length).toEqual(2);
        expect(_profile.user_metadata.pendingInvitations[0].name).toEqual('One Book Canada');
        expect(_profile.user_metadata.pendingInvitations[1].name).toEqual('One Book Canada');

        rootSession
          .put(`/organization/${organizationId}`)
          .send({
            name: 'Two Testaments Bolivia'
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) return done.fail(err);

            expect(_profile.user_metadata.pendingInvitations.length).toEqual(2);
            expect(_profile.user_metadata.pendingInvitations[0].name).toEqual('Two Testaments Bolivia');
            expect(_profile.user_metadata.pendingInvitations[1].name).toEqual('Two Testaments Bolivia');
            done();
          });
      });

      it('updates any database invitations', done => {
        models.Invitation.create({ name: 'One Book Canada', recipient: 'onecooldude@example.com', uuid: organizationId, type: 'organization', teamId: teamId }).then(results => {
          rootSession
            .put(`/organization/${organizationId}`)
            .send({
              name: 'Two Testaments Bolivia'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              models.Invitation.findByPk(results.id).then(invites => {
                expect(invites.name).toEqual('Two Testaments Bolivia');
                expect(invites.recipient).toEqual('onecooldude@example.com');
                expect(invites.uuid).toEqual(organizationId);
                expect(invites.teamId).toEqual(teamId);
                done();
              }).catch(err => {
                done.fail(err);
              });
            });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('create invitation in DB to updates any RSVPs on next login', done => {
        models.Invitation.findAll().then(invites => {
          expect(invites.length).toEqual(0);

          rootSession
            .put(`/organization/${organizationId}`)
            .send({
              name: 'Two Testaments Bolivia'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              models.Invitation.findAll().then(invites => {
                expect(invites.length).toEqual(2);
                expect(invites[0].name).toEqual('Two Testaments Bolivia');
                expect(invites[1].name).toEqual('Two Testaments Bolivia');
                done();
              }).catch(err => {
                done.fail(err);
              });
            });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('returns an error if empty organization name provided', done => {
        rootSession
          .put(`/organization/${organizationId}`)
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

      it('returns an error if record already exists', done => {
        rootSession
          .put(`/organization/${organizationId}`)
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

      it('doesn\'t barf if team doesn\'t exist', done => {
        rootSession
          .put('/organization/333')
          .send({
            name: 'Two Testaments Bolivia'
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(404)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.body.message).toEqual('No such organization');
            done();
          });
      });

      describe('Auth0', () => {
        it('is called to see if organization name is already registered', done => {
          rootSession
            .put(`/organization/${organizationId}`)
            .send({
              name: 'Two Testaments Bolivia'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(organizationReadByNameOauthTokenScope.isDone()).toBe(true);
              expect(organizationReadByNameScope.isDone()).toBe(true);
              done();
            });
        });

        it('is called to retrieve organization leadership', done => {
          rootSession
            .put(`/organization/${organizationId}`)
            .send({
              name: 'Two Testaments Bolivia'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              // Token re-used from first call
              expect(organizationReadByIdOauthTokenScope.isDone()).toBe(false);
              expect(organizationReadByIdScope.isDone()).toBe(true);
              done();
            });
        });

        it('is called to retrieve team membership', done => {
          rootSession
            .put(`/organization/${organizationId}`)
            .send({
              name: 'Two Testaments Bolivia'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              // 2020-6-17 Reuse token from above? This needs to be confirmed in production
              expect(teamMembershipReadOauthTokenScope.isDone()).toBe(false);
              expect(teamMembershipReadScope.isDone()).toBe(true);
              done();
            });
        });

        it('is called to retrieve outstanding RSVPs', done => {
          rootSession
            .put(`/organization/${organizationId}`)
            .send({
              name: 'Two Testaments Bolivia'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              // 2020-6-17 Reuse token from above? This needs to be confirmed in production
              expect(teamReadRsvpsOauthTokenScope.isDone()).toBe(false);
              expect(teamReadRsvpsScope.isDone()).toBe(true);
              done();
            });
        });

        it('is called to update the agent user_metadata', done => {
          rootSession
            .put(`/organization/${organizationId}`)
            .send({
              name: 'Two Testaments Bolivia'
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
