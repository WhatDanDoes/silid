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
const _identity = { ...require('../../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_CUSTOM_DOMAIN}/`};
const _profile = require('../../fixtures/sample-auth0-profile-response');

describe('root/organizationUpdateSpec', () => {

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


    describe('update', () => {

      describe('where root is organizer', () => {
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
//                  rsvpList.push({
//                                  ..._profile,
//                                  name: 'Some Other Guy',
//                                  email: 'someotherguy@example.com',
//                                  user_id: _profile.user_id + 2,
//                                  user_metadata: {
//                                    rsvps: [
//                                      { name: 'One Book Canada', recipient: 'someotherguy@example.com', uuid: organizationId, type: 'organization', teamId: teamId }
//                                    ]
//                                  }
//                                });
//                  rsvpList.push({
//                                  ..._profile,
//                                  name: 'Yet Another Guy',
//                                  email: 'yetanotherguy@example.com',
//                                  user_id: _profile.user_id + 3,
//                                  user_metadata: {
//                                    rsvps: [
//                                      { name: 'One Book Canada', recipient: 'yetanotherguy@example.com', uuid: organizationId, type: 'organization', teamId: team2Id }
//                                    ]
//                                  }
//                                });
//                  stubTeamRead(rsvpList, (err, apiScopes) => {
//                    if (err) return done.fail();
//                    ({teamReadScope: teamReadRsvpsScope, teamReadOauthTokenScope: teamReadRsvpsOauthTokenScope} = apiScopes);

                    stubUserAppMetadataUpdate((err, apiScopes) => {
                      if (err) return done.fail();
                      ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                      done();
                    });
//                  });
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

 //       it('updates any pending invitations', done => {
 //         expect(_profile.user_metadata.pendingInvitations.length).toEqual(2);
 //         expect(_profile.user_metadata.pendingInvitations[0].name).toEqual('One Book Canada');
 //         expect(_profile.user_metadata.pendingInvitations[1].name).toEqual('One Book Canada');

 //         rootSession
 //           .put(`/organization/${organizationId}`)
 //           .send({
 //             name: 'Two Testaments Bolivia'
 //           })
 //           .set('Accept', 'application/json')
 //           .expect('Content-Type', /json/)
 //           .expect(201)
 //           .end(function(err, res) {
 //             if (err) return done.fail(err);

 //             expect(_profile.user_metadata.pendingInvitations.length).toEqual(2);
 //             expect(_profile.user_metadata.pendingInvitations[0].name).toEqual('Two Testaments Bolivia');
 //             expect(_profile.user_metadata.pendingInvitations[1].name).toEqual('Two Testaments Bolivia');
 //             done();
 //           });
 //       });

 //       it('updates any database updates', done => {
 //         models.Update.create({ name: 'One Book Canada', recipient: 'onecooldude@example.com', uuid: organizationId, type: 'organization', teamId: teamId }).then(results => {
 //           rootSession
 //             .put(`/organization/${organizationId}`)
 //             .send({
 //               name: 'Two Testaments Bolivia'
 //             })
 //             .set('Accept', 'application/json')
 //             .expect('Content-Type', /json/)
 //             .expect(201)
 //             .end(function(err, res) {
 //               if (err) return done.fail(err);

 //               models.Update.findByPk(results.id).then(updates => {
 //                 expect(updates.name).toEqual('Two Testaments Bolivia');
 //                 expect(updates.recipient).toEqual('onecooldude@example.com');
 //                 expect(updates.uuid).toEqual(organizationId);
 //                 expect(updates.teamId).toEqual(teamId);
 //                 done();
 //               }).catch(err => {
 //                 done.fail(err);
 //               });
 //             });
 //         }).catch(err => {
 //           done.fail(err);
 //         });
 //       });

 //       it('create update in DB to updates any RSVPs on next login', done => {
 //         models.Update.findAll().then(updates => {
 //           expect(updates.length).toEqual(0);

 //           rootSession
 //             .put(`/organization/${organizationId}`)
 //             .send({
 //               name: 'Two Testaments Bolivia'
 //             })
 //             .set('Accept', 'application/json')
 //             .expect('Content-Type', /json/)
 //             .expect(201)
 //             .end(function(err, res) {
 //               if (err) return done.fail(err);

 //               models.Update.findAll().then(updates => {
 //                 expect(updates.length).toEqual(2);
 //                 expect(updates[0].name).toEqual('Two Testaments Bolivia');
 //                 expect(updates[1].name).toEqual('Two Testaments Bolivia');
 //                 done();
 //               }).catch(err => {
 //                 done.fail(err);
 //               });
 //             });
 //         }).catch(err => {
 //           done.fail(err);
 //         });
 //       });

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

//          it('is called to retrieve outstanding RSVPs', done => {
//            rootSession
//              .put(`/organization/${organizationId}`)
//              .send({
//                name: 'Two Testaments Bolivia'
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(201)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//
//                // 2020-6-17 Reuse token from above? This needs to be confirmed in production
//                expect(teamReadRsvpsOauthTokenScope.isDone()).toBe(false);
//                expect(teamReadRsvpsScope.isDone()).toBe(true);
//                done();
//              });
//          });

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

      describe('where root has no affiliation', () => {
        const rsvpList = [];
        const orgList = [];
        const organizerProfile = {..._profile, name: 'A Aaronson', email: 'aaaronson@example.com', user_id: _profile.user_id + 1 };

        beforeEach(done => {
          teamId = uuid.v4();
          team1Id = uuid.v4();
          team2Id = uuid.v4();
          organizationId = uuid.v4();

          _profile.user_metadata = {};

          organizerProfile.user_metadata = {
            organizations: [{ name: 'One Book Canada', organizer: organizerProfile.email, id: organizationId }],
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
            stubOrganizationRead(orgList, (err, apiScopes) => {
              if (err) return done.fail();
              ({organizationReadScope: organizationReadByNameScope, organizationReadOauthTokenScope: organizationReadByNameOauthTokenScope} = apiScopes);

              // Get organization by ID
              stubOrganizationRead([organizerProfile], (err, apiScopes) => {
                if (err) return done.fail();
                ({organizationReadScope: organizationReadByIdScope, organizationReadOauthTokenScope: organizationReadByIdOauthTokenScope} = apiScopes);

                // Get member teams
                stubTeamRead([organizerProfile,
                              {..._profile,
                                name: 'Zelda Zerk',
                                email: 'zzerk@example.com',
                                user_id: _profile.user_id + 2,
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
                                  user_id: _profile.user_id + 3,
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
                                  user_id: _profile.user_id + 4,
                                  user_metadata: {
                                    rsvps: [
                                      { name: 'One Book Canada', recipient: 'yetanotherguy@example.com', uuid: organizationId, type: 'organization', teamId: team2Id }
                                    ]
                                  }
                                });
                  stubTeamRead(rsvpList, (err, apiScopes) => {
                    if (err) return done.fail();
                    ({teamReadScope: teamReadRsvpsScope, teamReadOauthTokenScope: teamReadRsvpsOauthTokenScope} = apiScopes);

                    stubUserAppMetadataUpdate(organizerProfile, (err, apiScopes) => {
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
          orgList.length = 0;
        });

        it('allows updating an existing record', done => {
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
              expect(res.body.organizer).toEqual(organizerProfile.email);
              expect(res.body.id).toEqual(organizationId);
              expect(res.body.teams.length).toEqual(2);
              expect(res.body.teams[0]).toEqual({ name: 'Asia Sensitive', leader: 'teamleader@example.com', id: team1Id, organizationId: organizationId });
              expect(res.body.teams[1]).toEqual({ name: 'Guinea-Bissau', leader: 'yetanotherguy@example.com', id: team2Id, organizationId: organizationId });

              done();
            });
        });

//        it('updates any pending invitations', done => {
//          expect(organizerProfile.user_metadata.pendingInvitations.length).toEqual(2);
//          expect(organizerProfile.user_metadata.pendingInvitations[0].name).toEqual('One Book Canada');
//          expect(organizerProfile.user_metadata.pendingInvitations[1].name).toEqual('One Book Canada');
//
//          rootSession
//            .put(`/organization/${organizationId}`)
//            .send({
//              name: 'Two Testaments Bolivia'
//            })
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(201)
//            .end(function(err, res) {
//              if (err) return done.fail(err);
//
//              expect(organizerProfile.user_metadata.pendingInvitations.length).toEqual(2);
//              expect(organizerProfile.user_metadata.pendingInvitations[0].name).toEqual('Two Testaments Bolivia');
//              expect(organizerProfile.user_metadata.pendingInvitations[1].name).toEqual('Two Testaments Bolivia');
//              done();
//            });
//        });

//        it('updates any database updates', done => {
//          models.Update.create({ name: 'One Book Canada', recipient: 'onecooldude@example.com', uuid: organizationId, type: 'organization', teamId: teamId }).then(results => {
//            rootSession
//              .put(`/organization/${organizationId}`)
//              .send({
//                name: 'Two Testaments Bolivia'
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(201)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//
//                models.Update.findByPk(results.id).then(updates => {
//                  expect(updates.name).toEqual('Two Testaments Bolivia');
//                  expect(updates.recipient).toEqual('onecooldude@example.com');
//                  expect(updates.uuid).toEqual(organizationId);
//                  expect(updates.teamId).toEqual(teamId);
//                  done();
//                }).catch(err => {
//                  done.fail(err);
//                });
//              });
//          }).catch(err => {
//            done.fail(err);
//          });
//        });

//        it('create update in DB to updates any RSVPs on next login', done => {
//          models.Update.findAll().then(updates => {
//            expect(updates.length).toEqual(0);
//
//            rootSession
//              .put(`/organization/${organizationId}`)
//              .send({
//                name: 'Two Testaments Bolivia'
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(201)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//
//                models.Update.findAll().then(updates => {
//                  expect(updates.length).toEqual(2);
//                  expect(updates[0].name).toEqual('Two Testaments Bolivia');
//                  expect(updates[1].name).toEqual('Two Testaments Bolivia');
//                  done();
//                }).catch(err => {
//                  done.fail(err);
//                });
//              });
//          }).catch(err => {
//            done.fail(err);
//          });
//        });

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
          orgList.push(organizerProfile);
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

//          it('is called to retrieve outstanding RSVPs', done => {
//            rootSession
//              .put(`/organization/${organizationId}`)
//              .send({
//                name: 'Two Testaments Bolivia'
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(201)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//
//                // 2020-6-17 Reuse token from above? This needs to be confirmed in production
//                expect(teamReadRsvpsOauthTokenScope.isDone()).toBe(false);
//                expect(teamReadRsvpsScope.isDone()).toBe(true);
//                done();
//              });
//          });

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
    });
  });
});
