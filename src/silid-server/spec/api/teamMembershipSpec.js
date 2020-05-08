const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubAuth0ManagementEndpoint = require('../support/stubAuth0ManagementEndpoint');
const stubUserRead = require('../support/auth0Endpoints/stubUserRead');
const stubUserReadQuery = require('../support/auth0Endpoints/stubUserReadQuery');
const stubUserAppMetadataUpdate = require('../support/auth0Endpoints/stubUserAppMetadataUpdate');
const mailer = require('../../mailer');
const uuid = require('uuid');
const nock = require('nock');
const scope = require('../../config/permissions');
const apiScope = require('../../config/apiPermissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../fixtures/sample-auth0-identity-token');
const _profile = require('../fixtures/sample-auth0-profile-response');

describe('teamMembershipSpec', () => {

  let login, pub, prv, keystore;
  beforeEach(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  afterEach(() => {
    mailer.transport.sentMail = [];
  });

  let originalProfile;
  let team, organization, agent;
  beforeEach(done => {
    originalProfile = {..._profile};

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

  afterEach(() => {
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    _profile.email_verified = true;
    delete _profile.user_metadata;
    _profile.email = originalProfile.email;
    _profile.name = originalProfile.name;
  });

  describe('authenticated', () => {

    describe('authorized', () => {

      describe('create', () => {

        let authenticatedSession, teamId;
        beforeEach(done => {
          teamId = uuid.v4();
          _profile.user_metadata = { teams: [ {name: 'The Calgary Roughnecks', leader: _profile.email, members: [_profile.email], id: teamId } ] };

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login(_identity, [scope.create.teamMembers], (err, session) => {
              if (err) return done.fail(err);
              authenticatedSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                done();
              });
            });
          });
        });

        it('doesn\'t barf if team doesn\'t exist', done => {
          authenticatedSession
            .put('/team/333/agent')
            .send({
              email: 'somebrandnewguy@example.com'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('No such team');
              done();
            });
        });

        describe('unknown agent', () => {
          let userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope;
          beforeEach(done => {
            stubUserAppMetadataUpdate((err, apiScopes) => {
              if (err) return done.fail();
              ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
              done();
            });
          });

          describe('is sent a new invite', () => {
            it('adds an invitation to the database', done => {
              models.Agent.findAll().then(results => {
                expect(results.length).toEqual(1);
                expect(results[0].id).toEqual(agent.id);

                models.Invitation.findAll().then(results => {
                  expect(results.length).toEqual(0);

                  authenticatedSession
                    .put(`/team/${teamId}/agent`)
                    .send({
                      email: 'somebrandnewguy@example.com'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      models.Invitation.findAll().then(results => {
                        expect(results.length).toEqual(1);
                        expect(results[0].recipient).toEqual('somebrandnewguy@example.com');
                        expect(results[0].name).toEqual('The Calgary Roughnecks');
                        expect(results[0].uuid).toEqual(teamId);
                        expect(results[0].type).toEqual('team');

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
            });

            describe('Auth0', () => {
              it('/oauth/token endpoint is called to retrieve a machine-to-machine access token', done => {
                authenticatedSession
                  .put(`/team/${teamId}/agent`)
                  .send({
                    email: 'somebrandnewguy@example.com'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('is called to see if the agent already exists', done => {
                authenticatedSession
                  .put(`/team/${teamId}/agent`)
                  .send({
                    email: 'somebrandnewguy@example.com'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('writes the pending invitation to the team leader\'s user_metadata', done => {
                expect(_profile.user_metadata.pendingInvites).toBeUndefined();
                authenticatedSession
                  .put(`/team/${teamId}/agent`)
                  .send({
                    email: 'somebrandnewguy@example.com'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    models.Invitation.findAll().then(invites => {
                      expect(invites.length).toEqual(1);

                      expect(_profile.user_metadata.pendingInvitations.length).toEqual(1);
                      expect(_profile.user_metadata.pendingInvitations[0].name).toEqual(invites[0].name);
                      expect(_profile.user_metadata.pendingInvitations[0].type).toEqual(invites[0].type);
                      expect(_profile.user_metadata.pendingInvitations[0].uuid).toEqual(invites[0].uuid);
                      expect(_profile.user_metadata.pendingInvitations[0].recipient).toEqual(invites[0].recipient);

                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              });
            });

            describe('email', () => {
              describe('notification', () => {
                it('sends an email to notify agent of team membership invitation', function(done) {
                  expect(mailer.transport.sentMail.length).toEqual(0);
                  authenticatedSession
                    .put(`/team/${teamId}/agent`)
                    .send({
                      email: 'somebrandnewguy@example.com'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(mailer.transport.sentMail.length).toEqual(1);
                      expect(mailer.transport.sentMail[0].data.to).toEqual('somebrandnewguy@example.com');
                      expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                      expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity team invitation');

                      expect(mailer.transport.sentMail[0].data.text).toContain('You have been invited to join a team:');
                      expect(mailer.transport.sentMail[0].data.text).toContain('The Calgary Roughnecks');
                      expect(mailer.transport.sentMail[0].data.text).toContain('Login at the link below to view the invitation:');
                      expect(mailer.transport.sentMail[0].data.text).toContain(process.env.SERVER_DOMAIN);

                      done();
                    });
                });
              });

              describe('invitation verification', () => {

                let verificationUrl;
                beforeEach(done => {
                  authenticatedSession
                    .put(`/team/${teamId}/agent`)
                    .send({
                      email: 'somebrandnewguy@example.com'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      verificationUrl = `/team/${teamId}/invite`;

                      // This reset the profile for the invited agent
                      _profile.email_verified = true;
                      delete _profile.user_metadata;
                      _profile.email = 'somebrandnewguy@example.com';
                      _profile.name = 'Some Brand New Guy';

                      done();
                    });
                });

                describe('on first login', () => {
                  it('writes the invite to the agent\'s user_metadata', done => {
                   expect(_profile.user_metadata).toBeUndefined();

                    stubAuth0ManagementApi((err, apiScopes) => {
                      if (err) return done.fail();

                      login({..._identity, email: _profile.email, name: _profile.name }, (err, newAgentSession) => {
                        if (err) return done.fail(err);

                        // Cached profile doesn't match "live" data, so agent needs to be updated
                        // with a call to Auth0
                        stubUserRead((err, apiScopes) => {
                          if (err) return done.fail();
                          stubUserAppMetadataUpdate((err, apiScopes) => {
                            if (err) return done.fail();
                            newAgentSession
                              .get('/agent')
                              .set('Accept', 'application/json')
                              .expect('Content-Type', /json/)
                              .expect(200)
                              .end(function(err, res) {
                                if (err) return done.fail(err);

                                expect(_profile.user_metadata).toBeDefined();
                                expect(_profile.user_metadata.rsvps.length).toEqual(1);
                                expect(_profile.user_metadata.rsvps[0].name).toEqual('The Calgary Roughnecks');
                                expect(_profile.user_metadata.rsvps[0].uuid).toEqual(teamId);
                                expect(_profile.user_metadata.rsvps[0].type).toEqual('team');
                                expect(_profile.user_metadata.rsvps[0].recipient).toEqual(_profile.email);

                                done();
                              });
                          });
                        });
                      });
                    });
                  });

                  it('removes the invitation from the database', done => {
                    models.Invitation.findAll().then(invites => {
                      expect(invites.length).toEqual(1);

                      stubAuth0ManagementApi((err, apiScopes) => {
                        if (err) return done.fail();

                        login({..._identity, email: _profile.email, name: _profile.name }, (err, newAgentSession) => {
                          if (err) return done.fail(err);

                          // Cached profile doesn't match "live" data, so agent needs to be updated
                          // with a call to Auth0
                          stubUserRead((err, apiScopes) => {
                            if (err) return done.fail();

                            stubUserAppMetadataUpdate((err, apiScopes) => {
                              if (err) return done.fail();
                              newAgentSession
                                .get('/agent')
                                .set('Accept', 'application/json')
                                .expect('Content-Type', /json/)
                                .expect(200)
                                .end(function(err, res) {
                                  if (err) return done.fail(err);

                                  models.Invitation.findAll().then(invites => {
                                    expect(invites.length).toEqual(0);

                                    done();
                                  }).catch(err => {
                                    done.fail(err);
                                  });
                                });
                            });
                          });
                        });
                      });
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
                });

                describe('while authenticated', () => {
                  let invitedAgentSession;
                  beforeEach(done => {
                    stubAuth0ManagementApi((err, apiScopes) => {
                      if (err) return done.fail();

                      login({..._identity, email: 'somebrandnewguy@example.com', name: 'Some Brand New Guy' },
                            [scope.create.teamMembers, scope.delete.teamMembers], (err, session) => {
                        if (err) return done.fail(err);
                        invitedAgentSession = session;

                        // Cached profile doesn't match "live" data, so agent needs to be updated
                        // with a call to Auth0
                        stubUserRead((err, apiScopes) => {
                          if (err) return done.fail();

                          stubUserAppMetadataUpdate((err, apiScopes) => {
                            if (err) return done.fail();

                            // Simulates first login action. Invite is written to metadata and removed from DB
                            invitedAgentSession
                              .get('/agent')
                              .set('Accept', 'application/json')
                              .expect('Content-Type', /json/)
                              .expect(200)
                              .end(function(err, res) {
                                if (err) return done.fail(err);

                                expect(_profile.user_metadata.rsvps.length).toEqual(1);

                                done();
                              });
                          });
                        });
                      });
                    });
                  });

                  describe('the agent may', () => {

                    beforeEach(done => {
                      // Cached profile doesn't match "live" data, so agent needs to be updated
                      // with a call to Auth0
                      stubUserRead((err, apiScopes) => {
                        if (err) return done.fail();

                        stubUserReadQuery([{..._profile,
                                           email: 'someguy@example.com',
                                           name: 'Some Guy',
                                           user_metadata: {
                                             pendingInvitations: [{name: 'The Calgary Roughnecks', uuid: teamId, recipient: 'somebrandnewguy@example.com', type: 'team'}],
                                             teams: [{name: 'The Calgary Roughnecks', id: teamId, leader: 'someguy@example.com'}]
                                           }}], (err, apiScopes) => {
                          if (err) return done.fail(err);
                          // Update the invited agent
                          stubUserAppMetadataUpdate((err, apiScopes) => {
                            if (err) return done.fail(err);

                            // Update the team leader
                            stubUserAppMetadataUpdate((err, apiScopes) => {
                              if (err) return done.fail(err);

                              done();
                            });
                          });
                        });
                      });
                    });

                    describe('accept the invitation', () => {

                      it('writes team membership to the agent\'s user_metadata', done => {
                        expect(_profile.user_metadata.teams).toBeUndefined();
                        invitedAgentSession
                          .get(`${verificationUrl}/accept`)
                          .set('Accept', 'application/json')
                          .expect('Content-Type', /json/)
                          .expect(201)
                          .end(function(err, res) {
                            if (err) return done.fail(err);

                            expect(_profile.user_metadata.teams).toBeDefined();
                            expect(_profile.user_metadata.teams.length).toEqual(1);
                            expect(_profile.user_metadata.teams[0].name).toEqual('The Calgary Roughnecks');
                            expect(_profile.user_metadata.teams[0].id).toEqual(teamId);
                            expect(_profile.user_metadata.teams[0].leader).toEqual('someguy@example.com');

                            done();
                          });
                      });

                      it('removes the invitation from the agent\'s user_metadata', done => {
                        // Note the flip-flop from testing _profile to testing res.body
                        // The _profile constant is getting manipulated by the mocks.
                        // This is happening twice-over because both the invited agent
                        // and the team leader are being updated. The state of the
                        // _profile reflects that of the team leader because he is the
                        // last to be updated.
                        expect(_profile.user_metadata.rsvps.length).toEqual(1);
                        invitedAgentSession
                          .get(`${verificationUrl}/accept`)
                          .set('Accept', 'application/json')
                          .expect('Content-Type', /json/)
                          .expect(201)
                          .end(function(err, res) {
                            if (err) return done.fail(err);

                            expect(res.body.user_metadata.rsvps.length).toEqual(0);

                            done();
                          });
                      });

                      it('doesn\'t barf if the team doesn\'t exist', done => {
                        invitedAgentSession
                          .get('/team/333/invite/accept')
                          .set('Accept', 'application/json')
                          .expect('Content-Type', /json/)
                          .expect(404)
                          .end(function(err, res) {
                            if (err) return done.fail(err);

                            expect(res.body.message).toEqual('No such invitation');

                            done();
                          });
                      });

                      it('removes the invitation from the team leader\'s user_metadata', done => {
                        invitedAgentSession
                          .get(`${verificationUrl}/reject`)
                          .set('Accept', 'application/json')
                          .expect('Content-Type', /json/)
                          .expect(201)
                          .end(function(err, res) {
                            if (err) return done.fail(err);

                            // _profile reflects state of team leader. Cf. above...
                            expect(_profile.user_metadata.pendingInvitations.length).toEqual(0);

                            done();
                          });
                      });
                    });

                    describe('reject the invitation', () => {

                      it('does not write team membership to the agent\'s user_metadata', done => {
                        // Note the flip-flop from testing _profile to testing res.body. Cf. above...
                        expect(_profile.user_metadata.teams).toBeUndefined();
                        invitedAgentSession
                          .get(`${verificationUrl}/reject`)
                          .set('Accept', 'application/json')
                          .expect('Content-Type', /json/)
                          .expect(201)
                          .end(function(err, res) {
                            if (err) return done.fail(err);

                            expect(res.body.user_metadata.teams.length).toEqual(0);

                            done();
                          });
                      });

                      it('removes the invitation from the agent\'s user_metadata', done => {
                        // Note the flip-flop from testing _profile to testing res.body. Cf. above...
                        expect(_profile.user_metadata.rsvps.length).toEqual(1);
                        invitedAgentSession
                          .get(`${verificationUrl}/reject`)
                          .set('Accept', 'application/json')
                          .expect('Content-Type', /json/)
                          .expect(201)
                          .end(function(err, res) {
                            if (err) return done.fail(err);

                            expect(res.body.user_metadata.rsvps.length).toEqual(0);

                            done();
                          });
                      });

                      it('doesn\'t barf if the team doesn\'t exist', done => {
                        invitedAgentSession
                          .get('/team/333/invite/reject')
                          .set('Accept', 'application/json')
                          .expect('Content-Type', /json/)
                          .expect(404)
                          .end(function(err, res) {
                            if (err) return done.fail(err);

                            expect(res.body.message).toEqual('No such invitation');

                            done();
                          });
                      });

                      it('removes the invitation from the team leader\'s user_metadata', done => {
                        invitedAgentSession
                          .get(`${verificationUrl}/reject`)
                          .set('Accept', 'application/json')
                          .expect('Content-Type', /json/)
                          .expect(201)
                          .end(function(err, res) {
                            if (err) return done.fail(err);

                            // _profile reflects state of team leader. Cf. above...
                            expect(_profile.user_metadata.pendingInvitations.length).toEqual(0);

                            done();
                          });
                      });
                    });
                  });

//                it('redirects to root', function(done) {
//                  authenticatedSession
//                    .get(verificationUrl)
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      expect(res.headers.location).toEqual(`/`);
//                      done();
//                    });
//                });
//
//                it('doesn\'t barf if verificationCode is mangled', function(done) {
//                  authenticatedSession
//                    .get('/verify/some-mangled-code')
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.headers.location).toEqual(`/login`);
//                      done();
//                    });
//                });
//
//                it('doesn\'t barf if verificationCode does not exist', function(done) {
//                  authenticatedSession
//                    .get(`/verify/${uuid()}`)
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.headers.location).toEqual(`/login`);
//                      done();
//                    });
//                });
                });

                describe('while not authenticated', () => {
//                it('nullifies the verification code on click', function(done) {
//                  expect(unverifiedMembership.verificationCode).toBeDefined();
//                  request(app)
//                    .get(verificationUrl)
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      models.TeamMember.findOne({ where: { AgentId: unverifiedMembership.AgentId } }).then(results => {
//                        expect(results.verificationCode).toBe(null);
//                        done();
//                      }).catch(err => {
//                        done.fail(err);
//                      });
//                    });
//                });
//
//                it('redirects to /login', function(done) {
//                  request(app)
//                    .get(verificationUrl)
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      expect(res.headers.location).toEqual(`/login`);
//                      done();
//                    });
//                });
//
//                it('doesn\'t barf if verificationCode is invalid', function(done) {
//                  request(app)
//                    .get('/verify/some-mangled-code')
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.headers.location).toEqual(`/login`);
//                      done();
//                    });
//                });
                });
              });
            });
          });

          describe('is re-sent an invite', () => {
            it('updates the timestamp if invitation already exists', done => {
              authenticatedSession
                .put(`/team/${teamId}/agent`)
                .send({
                  email: 'somebrandnewguy@example.com'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  models.Invitation.findAll().then(results => {
                    expect(results.length).toEqual(1);
                    const updatedAt = results[0].updatedAt;

                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail();

                      authenticatedSession
                        .put(`/team/${teamId}/agent`)
                        .send({
                          email: 'somebrandnewguy@example.com'
                        })
                        .set('Accept', 'application/json')
                        .expect('Content-Type', /json/)
                        .expect(201)
                        .end(function(err, res) {
                          if (err) return done.fail(err);

                          models.Invitation.findAll().then(results => {
                            expect(results.length).toEqual(1);
                            expect(results[0].updatedAt).toBeGreaterThan(updatedAt);

                            done();
                          }).catch(err => {
                            done.fail(err);
                          });
                        });
                    });
                  }).catch(err => {
                    done.fail(err);
                  });
                });
            });
          });


//          describe('Auth0', () => {
//            it('/oauth/token endpoint is called to retrieve a machine-to-machine access token', done => {
//              authenticatedSession
//                .put(`/team/${teamId}/agent`)
//                .send({
//                  email: 'somebrandnewguy@example.com'
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(oauthTokenScope.isDone()).toBe(true);
//                  done();
//                });
//            });
//
//            it('is called to see if the agent already exists', done => {
//              authenticatedSession
//                .put(`/team/${teamId}/agent`)
//                .send({
//                  email: 'somebrandnewguy@example.com'
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(userAppMetadataReadScope.isDone()).toBe(true);
//                  done();
//                });
//            });
//
//            it('is called to create the agent', done => {
//              authenticatedSession
//                .put(`/team/${teamId}/agent`)
//                .send({
//                  email: 'somebrandnewguy@example.com'
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//
//                  expect(userReadScope.isDone()).toBe(true);
//                  done();
//                });
//            });
//
////            it('is called to update the agent\'s user_metadata', done => {
////              authenticatedSession
////                .put(`/team/${teamId}/agent`)
////                .send({
////                  email: 'somebrandnewguy@example.com'
////                })
////                .set('Accept', 'application/json')
////                .expect('Content-Type', /json/)
////                .expect(201)
////                .end(function(err, res) {
////                  if (err) return done.fail(err);
////
////                  expect(updateTeamScope.isDone()).toBe(true);
////                  done();
////                });
////            });
//          });

//          it('returns the agent added to the membership', done => {
//            models.Team.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
//              expect(results.length).toEqual(1);
//              expect(results[0].members.length).toEqual(1);
//
//              authenticatedSession
//                .put(`/team/${team.id}/agent`)
//                .send({
//                  email: 'somebrandnewguy@example.com'
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(res.body.name).toEqual(null);
//                  expect(res.body.email).toEqual('somebrandnewguy@example.com');
//                  expect(res.body.id).toBeDefined();
//
//                  done();
//                });
//            }).catch(err => {
//              done.fail(err);
//            });
//          });
//
//          it('adds a new agent to team membership', done => {
//            models.Team.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
//              expect(results.length).toEqual(1);
//              expect(results[0].members.length).toEqual(1);
//
//              authenticatedSession
//                .put(`/team/${team.id}/agent`)
//                .send({
//                  email: 'somebrandnewguy@example.com'
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//
//                  models.Team.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
//                    expect(results.length).toEqual(1);
//                    expect(results[0].members.length).toEqual(2);
//                    expect(results[0].members.map(a => a.email).includes('somebrandnewguy@example.com')).toBe(true);
//                    done();
//                  }).catch(err => {
//                    done.fail(err);
//                  });
//                });
//            }).catch(err => {
//              done.fail(err);
//            });
//          });
//
//          it('creates an agent record if the agent is not currently registered', done => {
//            models.Agent.findOne({ where: { email: 'somebrandnewguy@example.com' } }).then(results => {
//              expect(results).toBe(null);
//
//              authenticatedSession
//                .put(`/team/${team.id}/agent`)
//                .send({
//                  email: 'somebrandnewguy@example.com'
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//
//                  models.Agent.findOne({ where: { email: 'somebrandnewguy@example.com' } }).then(results => {
//                    expect(results.email).toEqual('somebrandnewguy@example.com');
//                    expect(results.id).toBeDefined();
//                    done();
//                  }).catch(err => {
//                    done.fail(err);
//                  });
//                });
//            }).catch(err => {
//              done.fail(err);
//            });
//          });
//
//          it('returns a friendly message if the agent is already a member', done => {
//            authenticatedSession
//              .put(`/team/${team.id}/agent`)
//              .send({
//                email: 'somebrandnewguy@example.com'
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(201)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//
//                // Cached profile doesn't match "live" data, so agent needs to be updated
//                // with a call to Auth0
//                stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
//                  if (err) return done.fail();
//
//                  authenticatedSession
//                    .put(`/team/${team.id}/agent`)
//                    .send({
//                      email: 'somebrandnewguy@example.com'
//                    })
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(200)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.body.message).toEqual('somebrandnewguy@example.com is already a member of this team');
//                      done();
//                    });
//                });
//              });
//          });
//
//          it('doesn\'t barf if team doesn\'t exist', done => {
//            authenticatedSession
//              .put('/team/333/agent')
//              .send({
//                email: 'somebrandnewguy@example.com'
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(404)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//                expect(res.body.message).toEqual('No such team');
//                done();
//              });
//          });
//
//          describe('email', () => {
//            describe('notification', () => {
//              it('sends an email to notify agent of new membership', function(done) {
//                expect(mailer.transport.sentMail.length).toEqual(0);
//                authenticatedSession
//                  .put(`/team/${team.id}/agent`)
//                  .send({
//                    email: 'somebrandnewguy@example.com'
//                  })
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(201)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    expect(mailer.transport.sentMail.length).toEqual(1);
//                    expect(mailer.transport.sentMail[0].data.to).toEqual('somebrandnewguy@example.com');
//                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
//                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity team invitation');
//
//                    models.Agent.findOne({ where: { email: 'somebrandnewguy@example.com' } }).then(a => {
//                      models.TeamMember.findOne({ where: { AgentId: a.id } }).then(results => {
//                        expect(mailer.transport.sentMail[0].data.text).toContain(`You have been invited to join ${team.name}`);
//                        expect(mailer.transport.sentMail[0].data.text).toContain(`Click or copy-paste the link below to accept:`);
//                        expect(mailer.transport.sentMail[0].data.text).toContain(`${process.env.SERVER_DOMAIN}/verify/${results.verificationCode}`);
//                        done();
//                      }).catch(err => {
//                        done.fail(err);
//                      });
//                    }).catch(err => {
//                      done.fail(err);
//                    });
//                  });
//              });
//            });
//
//            describe('verification', () => {
//              let verificationUrl, unverifiedMembership;
//
//              beforeEach(done => {
//                authenticatedSession
//                  .put(`/team/${team.id}/agent`)
//                  .send({
//                    email: 'somebrandnewguy@example.com'
//                  })
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(201)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    models.Agent.findOne({ where: { email: 'somebrandnewguy@example.com' } }).then(a => {
//                      models.TeamMember.findOne({ where: { AgentId: a.id } }).then(results => {
//
//                        unverifiedMembership = results;
//                        verificationUrl = `/verify/${results.verificationCode}`;
//
//                        done();
//                      }).catch(err => {
//                        done.fail(err);
//                      });
//                    }).catch(err => {
//                      done.fail(err);
//                    });
//                  });
//              });
//
//              describe('while authenticated', () => {
//                it('nullifies the verification code on click', function(done) {
//                  expect(unverifiedMembership.verificationCode).toBeDefined();
//
//                  authenticatedSession
//                    .get(verificationUrl)
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      models.TeamMember.findOne({ where: { AgentId: unverifiedMembership.AgentId } }).then(results => {
//                        expect(results.verificationCode).toBe(null);
//                        done();
//                      }).catch(err => {
//                        done.fail(err);
//                      });
//                    });
//                });
//
//                it('redirects to root', function(done) {
//                  authenticatedSession
//                    .get(verificationUrl)
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      expect(res.headers.location).toEqual(`/`);
//                      done();
//                    });
//                });
//
//                it('doesn\'t barf if verificationCode is mangled', function(done) {
//                  authenticatedSession
//                    .get('/verify/some-mangled-code')
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.headers.location).toEqual(`/login`);
//                      done();
//                    });
//                });
//
//                it('doesn\'t barf if verificationCode does not exist', function(done) {
//                  authenticatedSession
//                    .get(`/verify/${uuid()}`)
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.headers.location).toEqual(`/login`);
//                      done();
//                    });
//                });
//              });
//
//              describe('while not authenticated', () => {
//                it('nullifies the verification code on click', function(done) {
//                  expect(unverifiedMembership.verificationCode).toBeDefined();
//                  request(app)
//                    .get(verificationUrl)
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      models.TeamMember.findOne({ where: { AgentId: unverifiedMembership.AgentId } }).then(results => {
//                        expect(results.verificationCode).toBe(null);
//                        done();
//                      }).catch(err => {
//                        done.fail(err);
//                      });
//                    });
//                });
//
//                it('redirects to /login', function(done) {
//                  request(app)
//                    .get(verificationUrl)
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      expect(res.headers.location).toEqual(`/login`);
//                      done();
//                    });
//                });
//
//                it('doesn\'t barf if verificationCode is invalid', function(done) {
//                  request(app)
//                    .get('/verify/some-mangled-code')
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.headers.location).toEqual(`/login`);
//                      done();
//                    });
//                });
//              });
//            });
//          });
        });

        describe('registered agent', () => {
//          let knownAgent;
//          beforeEach(done => {
//            models.Agent.create({ email: 'weknowthisguy@example.com', name: 'Well-known Guy' }).then(result => {
//              knownAgent = result;
//              done();
//            }).catch(err => {
//              done.fail(err);
//            });
//          });
//
//          it('returns the agent added to the membership', done => {
//            models.Team.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
//              expect(results.length).toEqual(1);
//              expect(results[0].members.length).toEqual(1);
//
//              authenticatedSession
//                .put(`/team/${team.id}/agent`)
//                .send({
//                  email: knownAgent.email
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(res.body.name).toEqual(knownAgent.name);
//                  expect(res.body.email).toEqual(knownAgent.email);
//                  expect(res.body.id).toEqual(knownAgent.id);
//
//                  done();
//                });
//            }).catch(err => {
//              done.fail(err);
//            });
//          });
//
//          it('adds the agent to team membership', done => {
//            models.Team.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
//              expect(results.length).toEqual(1);
//              expect(results[0].members.length).toEqual(1);
//
//              authenticatedSession
//                .put(`/team/${team.id}/agent`)
//                .send({
//                  email: knownAgent.email
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//
//                  models.Team.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
//                    expect(results.length).toEqual(1);
//                    expect(results[0].members.length).toEqual(2);
//                    expect(results[0].members.map(a => a.id).includes(knownAgent.id)).toBe(true);
//                    done();
//                  }).catch(err => {
//                    done.fail(err);
//                  });
//                });
//            }).catch(err => {
//              done.fail(err);
//            });
//          });
//
//          it('returns a friendly message if the agent is already a member', done => {
//            authenticatedSession
//              .put(`/team/${team.id}/agent`)
//              .send({
//                email: knownAgent.email
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(201)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//
//                // Cached profile doesn't match "live" data, so agent needs to be updated
//                // with a call to Auth0
//                stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
//                  if (err) return done.fail();
//
//                  authenticatedSession
//                    .put(`/team/${team.id}/agent`)
//                    .send({
//                      email: knownAgent.email
//                    })
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(200)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.body.message).toEqual(`${knownAgent.email} is already a member of this team`);
//                      done();
//                    });
//                });
//              });
//          });
//
//          it('doesn\'t barf if team doesn\'t exist', done => {
//            authenticatedSession
//              .put('/team/333/agent')
//              .send({
//                email: knownAgent.email
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(404)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//                expect(res.body.message).toEqual('No such team');
//                done();
//              });
//          });
//
//          describe('email', () => {
//            describe('notification', () => {
//              it('sends an email to notify agent of new membership', function(done) {
//                expect(mailer.transport.sentMail.length).toEqual(0);
//                authenticatedSession
//                  .put(`/team/${team.id}/agent`)
//                  .send({
//                    email: knownAgent.email
//                  })
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(201)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    expect(mailer.transport.sentMail.length).toEqual(1);
//                    expect(mailer.transport.sentMail[0].data.to).toEqual(knownAgent.email);
//                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
//                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity team invitation');
//
//                    models.TeamMember.findOne({ where: { AgentId: knownAgent.id } }).then(results => {
//                      expect(mailer.transport.sentMail[0].data.text).toContain(`You have been invited to join ${team.name}`);
//                      expect(mailer.transport.sentMail[0].data.text).toContain(`Click or copy-paste the link below to accept:`);
//                      expect(mailer.transport.sentMail[0].data.text).toContain(`${process.env.SERVER_DOMAIN}/verify/${results.verificationCode}`);
//                      done();
//                    }).catch(err => {
//                      done.fail(err);
//                    });
//                  });
//              });
//            });
//
//            describe('verification', () => {
//              let verificationUrl, unverifiedMembership;
//
//              beforeEach(done => {
//                authenticatedSession
//                  .put(`/team/${team.id}/agent`)
//                  .send({
//                    email: knownAgent.email
//                  })
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(201)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    models.TeamMember.findOne({ where: { AgentId: knownAgent.id } }).then(results => {
//
//                      unverifiedMembership = results;
//                      verificationUrl = `/verify/${results.verificationCode}`;
//
//                      done();
//                    }).catch(err => {
//                      done.fail(err);
//                    });
//                  });
//              });
//
//              describe('while authenticated', () => {
//                it('nullifies the verification code on click', function(done) {
//                  expect(unverifiedMembership.verificationCode).toBeDefined();
//
//                  authenticatedSession
//                    .get(verificationUrl)
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      models.TeamMember.findOne({ where: { AgentId: unverifiedMembership.AgentId } }).then(results => {
//                        expect(results.verificationCode).toBe(null);
//                        done();
//                      }).catch(err => {
//                        done.fail(err);
//                      });
//                    });
//                });
//
//                it('redirects to root', function(done) {
//                  authenticatedSession
//                    .get(verificationUrl)
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      expect(res.headers.location).toEqual(`/`);
//                      done();
//                    });
//                });
//
//                it('doesn\'t barf if verificationCode is mangled', function(done) {
//                  authenticatedSession
//                    .get('/verify/some-mangled-code')
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.headers.location).toEqual(`/login`);
//                      done();
//                    });
//                });
//
//                it('doesn\'t barf if verificationCode does not exist', function(done) {
//                  authenticatedSession
//                    .get(`/verify/${uuid()}`)
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.headers.location).toEqual(`/login`);
//                      done();
//                    });
//                });
//              });
//
//              describe('while not authenticated', () => {
//                it('nullifies the verification code on click', function(done) {
//                  expect(unverifiedMembership.verificationCode).toBeDefined();
//                  request(app)
//                    .get(verificationUrl)
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      models.TeamMember.findOne({ where: { AgentId: unverifiedMembership.AgentId } }).then(results => {
//                        expect(results.verificationCode).toBe(null);
//                        done();
//                      }).catch(err => {
//                        done.fail(err);
//                      });
//                    });
//                });
//
//                it('redirects to /login', function(done) {
//                  request(app)
//                    .get(verificationUrl)
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//
//                      expect(res.headers.location).toEqual(`/login`);
//                      done();
//                    });
//                });
//
//                it('doesn\'t barf if verificationCode is invalid', function(done) {
//                  request(app)
//                    .get('/verify/some-mangled-code')
//                    .set('Accept', 'application/json')
//                    .expect(302)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.headers.location).toEqual(`/login`);
//                      done();
//                    });
//                });
//              });
//            });
//          });
        });
      });

//      describe('delete', () => {
//        let knownAgent, authenticatedSession;
//        beforeEach(done => {
//          models.Agent.create({ email: 'weknowthisguy@example.com', name: 'Well-known Guy' }).then(result => {
//            knownAgent = result;
//            team.addMember(knownAgent).then(result => {
//
//              stubAuth0ManagementApi((err, apiScopes) => {
//                if (err) return done.fail();
//
//                login(_identity, [scope.delete.teamMembers], (err, session) => {
//                  if (err) return done.fail(err);
//                  authenticatedSession = session;
//
//                  // Cached profile doesn't match "live" data, so agent needs to be updated
//                  // with a call to Auth0
//                  stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
//                    if (err) return done.fail();
//
//                    done();
//                  });
//                });
//              });
//            }).catch(err => {
//              done.fail(err);
//            });
//          }).catch(err => {
//            done.fail(err);
//          });
//        });
//
//        it('removes an existing member record from the team', done => {
//          authenticatedSession
//            .delete(`/team/${team.id}/agent/${knownAgent.id}`)
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(201)
//            .end(function(err, res) {
//              if (err) return done.fail(err);
//              expect(res.body.message).toEqual(`Member removed`);
//              done();
//            });
//        });
//
//        it('doesn\'t barf if team doesn\'t exist', done => {
//          authenticatedSession
//            .delete(`/team/333/agent/${knownAgent.id}`)
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(404)
//            .end(function(err, res) {
//              if (err) return done.fail(err);
//              expect(res.body.message).toEqual('No such team');
//              done();
//            });
//        });
//
//        it('doesn\'t barf if the agent doesn\'t exist', done => {
//          authenticatedSession
//            .delete(`/team/${team.id}/agent/333`)
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(404)
//            .end(function(err, res) {
//              if (err) return done.fail(err);
//              expect(res.body.message).toEqual('That agent is not a member');
//              done();
//            });
//        });
//
//        it('sends an email to notify agent of membership revocation', function(done) {
//          expect(mailer.transport.sentMail.length).toEqual(0);
//          team.addMember(knownAgent).then(result => {
//            authenticatedSession
//              .delete(`/team/${team.id}/agent/${knownAgent.id}`)
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(201)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//                expect(mailer.transport.sentMail.length).toEqual(1);
//                expect(mailer.transport.sentMail[0].data.to).toEqual(knownAgent.email);
//                expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
//                expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
//                expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${team.name}`);
//                done();
//              });
//          }).catch(err => {
//            done.fail(err);
//          });
//        });
//      });
    });

//    describe('unauthorized', () => {
//      let unauthorizedSession, suspiciousAgent;
//      beforeEach(done => {
//        models.Agent.create({ email: 'suspiciousagent@example.com', name: 'Suspicious Guy' }).then(a => {
//          suspiciousAgent = a;
//
//          _profile.email = suspiciousAgent.email;
//          _profile.name = suspiciousAgent.name;
//
//
//          stubAuth0ManagementApi((err, apiScopes) => {
//            if (err) return done.fail();
//
//            login({ ..._identity, email: suspiciousAgent.email }, [scope.create.teamMembers], (err, session) => {
//              if (err) return done.fail(err);
//              unauthorizedSession = session;
//
//              // Cached profile doesn't match "live" data, so agent needs to be updated
//              // with a call to Auth0
//              stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
//                if (err) return done.fail();
//
//                done();
//              });
//            });
//          });
//        }).catch(err => {
//          done.fail(err);
//        });
//      });
//
//      describe('create', () => {
//        it('doesn\'t allow a non-member agent to add a member', done => {
//          unauthorizedSession
//            .put(`/team/${team.id}/agent`)
//            .send({
//              email: suspiciousAgent.email
//            })
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(403)
//            .end(function(err, res) {
//              if (err) return done.fail(err);
//              expect(res.body.message).toEqual('You are not a member of this team');
//              done();
//            });
//        });
//      });
//
//      describe('delete', () => {
//        let knownAgent;
//        beforeEach(done => {
//          models.Agent.create({ email: 'weknowthisguy@example.com', name: 'Well-known Guy' }).then(result => {
//            knownAgent = result;
//            team.addMember(knownAgent).then(result => {
//              done();
//            }).catch(err => {
//              done.fail(err);
//            });
//          }).catch(err => {
//            done.fail(err);
//          });
//        });
//
//        it('returns 403', done => {
//          unauthorizedSession
//            .delete(`/team/${team.id}/agent/${knownAgent.id}`)
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(403)
//            .end(function(err, res) {
//              if (err) return done.fail(err);
//              expect(res.body.message).toEqual('Insufficient scope');
//              done();
//            });
//        });
//
//        it('does not remove the record from the database', done => {
//          models.Team.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
//            expect(results.length).toEqual(1);
//            expect(results[0].members.length).toEqual(2);
//
//            unauthorizedSession
//              .delete(`/team/${team.id}/agent/${knownAgent.id}`)
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(403)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//                models.Team.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
//                  expect(results.length).toEqual(1);
//                  expect(results[0].members.length).toEqual(2);
//                  done();
//                }).catch(err => {
//                  done.fail(err);
//                });
//              });
//          }).catch(err => {
//            done.fail(err);
//          });
//        });
//      });
//    });
  });

  describe('not authenticated', () => {
    it('redirects to login', done => {
      request(app)
        .get('/team')
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
