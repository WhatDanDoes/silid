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
const stubUserAppMetadataRead = require('../support/auth0Endpoints/stubUserAppMetadataRead');
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

            login(_identity, [scope.create.teamMembers, scope.delete.teamMembers], (err, session) => {
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

        it('doesn\'t barf if no email provided', done => {
          authenticatedSession
            .put(`/team/${teamId}/agent`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('No email provided');
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
                          .get(`${verificationUrl}/accept`)
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

                      it('returns a friendly message if agent is already a member of the team', done => {
                        // Agent accepts invite
                        invitedAgentSession
                          .get(`${verificationUrl}/accept`)
                          .set('Accept', 'application/json')
                          .expect('Content-Type', /json/)
                          .expect(201)
                          .end(function(err, res) {
                            if (err) return done.fail(err);

                            // Try adding the agent again
                            stubUserRead((err, apiScopes) => {
                              if (err) return done.fail();

                              // This stubs the call for info on the agent who is already a team member
                              stubUserAppMetadataRead({..._profile,
                                                       user_metadata: { teams: [
                                                         {name: 'The Calgary Roughnecks', leader: _profile.email, id: teamId }
                                                       ] } }, (err, apiScopes) => {
                                if (err) return done.fail();

                                authenticatedSession
                                  .put(`/team/${teamId}/agent`)
                                  .send({
                                    email: 'somebrandnewguy@example.com'
                                  })
                                  .set('Accept', 'application/json')
                                  .expect('Content-Type', /json/)
                                  .expect(200)
                                  .end(function(err, res) {
                                    if (err) return done.fail(err);

                                    expect(res.body.message).toEqual('somebrandnewguy@example.com is already a member of this team');
                                    done();
                                  });
                              });
                            });
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
                });

                describe('while not authenticated', () => {
                  it('redirects to /login', function(done) {
                    request(app)
                      .get(`${verificationUrl}/accept`)
                      .set('Accept', 'application/json')
                      .expect(302)
                      .end(function(err, res) {
                        if (err) return done.fail(err);

                        expect(res.headers.location).toEqual(`/login`);
                        done();
                      });
                  });
                });
              });
            });
          });

          describe('is re-sent an invite', () => {
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

                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

                    done();
                  });
                });
            });

            it('updates the timestamp if invitation already exists', done => {
              models.Invitation.findAll().then(results => {
                expect(results.length).toEqual(1);
                const updatedAt = results[0].updatedAt;

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
              }).catch(err => {
                done.fail(err);
              });
            });

            it('sends an email to notify agent of team membership invitation', function(done) {
              expect(mailer.transport.sentMail.length).toEqual(1);
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
                  expect(mailer.transport.sentMail.length).toEqual(2);
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

          describe('has invitation rescinded', () => {

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

                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

                    // Update the team leader
                    stubUserAppMetadataUpdate((err, apiScopes) => {
                      if (err) return done.fail(err);

                      done();
                    });
                  });
                });
            });

            it('removes the invitation from the database', done => {
              models.Agent.findAll().then(results => {
                expect(results.length).toEqual(1);
                expect(results[0].id).toEqual(agent.id);

                models.Invitation.findAll().then(results => {
                  expect(results.length).toEqual(1);

                  authenticatedSession
                    .delete(verificationUrl)
                    .send({
                      email: 'somebrandnewguy@example.com'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      models.Invitation.findAll().then(results => {
                        expect(results.length).toEqual(0);
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

            it('removes the invitation from the team leader\'s user_metadata', done => {
              expect(_profile.user_metadata.pendingInvitations.length).toEqual(1);
              authenticatedSession
                .delete(verificationUrl)
                .send({
                  email: 'somebrandnewguy@example.com'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(_profile.user_metadata.pendingInvitations.length).toEqual(0);

                  done();
                });
            });

            it('doesn\'t barf if the team doesn\'t exist', done => {
              authenticatedSession
                .delete('/team/333/invite')
                .send({
                  email: 'somebrandnewguy@example.com'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(res.body.message).toEqual('No such invitation');

                  done();
                });
            });

            it('doesn\'t barf if the invitation doesn\'t exist', done => {
              authenticatedSession
                .delete(verificationUrl)
                .send({
                  email: 'somebrandnewguy@example.com'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail(err);

                    authenticatedSession
                      .delete(verificationUrl)
                      .send({
                        email: 'somebrandnewguy@example.com'
                      })
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(404)
                      .end(function(err, res) {
                        if (err) return done.fail(err);

                        expect(res.body.message).toEqual('No such invitation');

                        done();
                      });
                  });
                });
            });
          });
        });

        describe('registered agent', () => {
          let registeredAgent;
          let invitedUserAppMetadataReadScope, invitedUserAppMetadataReadOauthTokenScope;
          let invitedUserAppMetadataUpdateScope, invitedUserAppMetadataUpdateOauthTokenScope;
          let teamLeaderAppMetadataUpdateScope, teamLeaderAppMetadataUpdateOauthTokenScope;
          beforeEach(done => {
            models.Agent.create({ name: 'Some Other Guy',
                                  email: 'someotherguy@example.com',
                                  socialProfile: {..._profile, name: 'Some Other Guy',email: 'someotherguy@example.com' } }).then(result => {
              registeredAgent = result;

              // For the invited agent
              stubUserAppMetadataRead((err, apiScopes) => {
                if (err) return done.fail();
                ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);
                invitedUserAppMetadataReadScope = userAppMetadataReadScope;
                invitedUserAppMetadataReadOauthTokenScope = userAppMetadataReadOauthTokenScope;

                // For the invited agent
                stubUserAppMetadataUpdate((err, apiScopes) => {
                  if (err) return done.fail();
                  let {userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes;
                  invitedUserAppMetadataUpdateScope = userAppMetadataUpdateScope;
                  invitedUserAppMetadataUpdateOauthTokenScope = userAppMetadataUpdateOauthTokenScope;

                  // For the team leader
                  stubUserAppMetadataUpdate((err, apiScopes) => {
                    if (err) return done.fail();
                    let {userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes;
                    teamLeaderAppMetadataUpdateScope = userAppMetadataUpdateScope;
                    teamLeaderAppMetadataUpdateOauthTokenScope = userAppMetadataUpdateOauthTokenScope;

                    done();
                  });
                });
              });
            }).catch(err => {
              done.fail(err);
            });
          });

          describe('is sent a new invite', () => {
            it('does not add an invitation to the database', done => {
              models.Agent.findAll().then(results => {
                expect(results.length).toEqual(2);
                expect(results[0].id).toEqual(agent.id);
                expect(results[1].id).toEqual(registeredAgent.id);

                models.Invitation.findAll().then(results => {
                  expect(results.length).toEqual(0);

                  authenticatedSession
                    .put(`/team/${teamId}/agent`)
                    .send({
                      email: registeredAgent.email
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      models.Invitation.findAll().then(results => {
                        expect(results.length).toEqual(0);

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
              describe('invited agent', () => {
                it('/oauth/token endpoint is called to retrieve a machine-to-machine access token', done => {
                  authenticatedSession
                    .put(`/team/${teamId}/agent`)
                    .send({
                      email: registeredAgent.email
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(invitedUserAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is called to see if the agent already exists', done => {
                  authenticatedSession
                    .put(`/team/${teamId}/agent`)
                    .send({
                      email: registeredAgent.email
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(invitedUserAppMetadataReadScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is called to write the pending invitation to user_metadata', done => {
                  expect(_profile.user_metadata.rsvps).toBeUndefined();
                  authenticatedSession
                    .put(`/team/${teamId}/agent`)
                    .send({
                      email: registeredAgent.email
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(invitedUserAppMetadataUpdateScope.isDone()).toBe(true);
                      expect(invitedUserAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);

                      done();
                    });
                });
              });

              describe('team leader', () => {
                it('/oauth/token endpoint is called to retrieve a machine-to-machine access token', done => {
                  authenticatedSession
                    .put(`/team/${teamId}/agent`)
                    .send({
                      email: registeredAgent.email
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(teamLeaderAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('writes the pending invitation to user_metadata', done => {
                  authenticatedSession
                    .put(`/team/${teamId}/agent`)
                    .send({
                      email: registeredAgent.email
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(teamLeaderAppMetadataUpdateScope.isDone()).toBe(true);

                      done();
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
                      email: registeredAgent.email
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(mailer.transport.sentMail.length).toEqual(1);
                      expect(mailer.transport.sentMail[0].data.to).toEqual(registeredAgent.email);
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
                      email: registeredAgent.email
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      verificationUrl = `/team/${teamId}/invite`;

                      // This reset the profile for the invited agent
                      _profile.email_verified = true;
                      _profile.user_metadata = {
                        rsvps: [{name: 'The Calgary Roughnecks', uuid: teamId, recipient: registeredAgent.email, type: 'team'}],
                      };
                      _profile.email = registeredAgent.email;
                      _profile.name = registeredAgent.name;

                      done();
                    });
                });

                describe('while authenticated', () => {
                  let invitedAgentSession;
                  beforeEach(done => {
                    stubAuth0ManagementApi((err, apiScopes) => {
                      if (err) return done.fail();

                      login({..._identity, email: registeredAgent.email, name: registeredAgent.name },
                            [scope.create.teamMembers, scope.delete.teamMembers], (err, session) => {
                        if (err) return done.fail(err);
                        invitedAgentSession = session;

                        done();
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
                                             pendingInvitations: [{name: 'The Calgary Roughnecks', uuid: teamId, recipient: registeredAgent.email, type: 'team'}],
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
                        // Cf. note above...
                        // Before verification, _profile represents the invited agent's profile.
                        // The mocks modify _profile. By test's end, the profile belongs to the
                        // team leader.
                        expect(_profile.user_metadata.pendingInvitations).toBeUndefined();
                        invitedAgentSession
                          .get(`${verificationUrl}/accept`)
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

                      describe('agent is already a member of the team', () => {
                        beforeEach(done => {
                          // Agent accepts invite
                          invitedAgentSession
                            .get(`${verificationUrl}/accept`)
                            .set('Accept', 'application/json')
                            .expect('Content-Type', /json/)
                            .expect(201)
                            .end(function(err, res) {
                              if (err) return done.fail(err);

                              // Try adding the agent again
                              stubUserRead((err, apiScopes) => {
                                if (err) return done.fail();

                                // This stubs the call for info on the agent who is already a team member
                                stubUserAppMetadataRead({..._profile,
                                                         user_metadata: { teams: [
                                                           {name: 'The Calgary Roughnecks', leader: _profile.email, id: teamId }
                                                         ] } }, (err, apiScopes) => {
                                  if (err) return done.fail();
                                  done();
                                 });
                              });
                            });
                        });

                        it('returns a friendly message if agent is already a member of the team', done => {
                          authenticatedSession
                            .put(`/team/${teamId}/agent`)
                            .send({
                              email: registeredAgent.email
                            })
                            .set('Accept', 'application/json')
                            .expect('Content-Type', /json/)
                            .expect(200)
                            .end(function(err, res) {
                              if (err) return done.fail(err);

                              expect(res.body.message).toEqual(`${registeredAgent.email} is already a member of this team`);
                              done();
                            });
                        });

                        it('does not write a new invitation to the team leader\'s pending invitations', done => {
                          // Cf. note above...
                          // Before verification, _profile represents the invited agent's profile.
                          // The agent has verified, and thus the _profile belongs to the team leader
                          expect(_profile.user_metadata.pendingInvitations.length).toEqual(0);

                          authenticatedSession
                            .put(`/team/${teamId}/agent`)
                            .send({
                              email: registeredAgent.email
                            })
                            .set('Accept', 'application/json')
                            .expect('Content-Type', /json/)
                            .expect(200)
                            .end(function(err, res) {
                              if (err) return done.fail(err);

                              expect(_profile.user_metadata.pendingInvitations.length).toEqual(0);
                              done();
                            });
                        });

                        it('does not call Auth0 to update the invited agent', done => {
                          stubUserAppMetadataUpdate((err, apiScopes) => {
                            if (err) return done.fail();
                            let {userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes;

                            authenticatedSession
                              .put(`/team/${teamId}/agent`)
                              .send({
                                email: registeredAgent.email
                              })
                              .set('Accept', 'application/json')
                              .expect('Content-Type', /json/)
                              .expect(200)
                              .end(function(err, res) {
                                if (err) return done.fail(err);

                                expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                                expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                                done();
                              });
                          });
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
                });

                describe('while not authenticated', () => {
                  it('redirects to /login', function(done) {
                    request(app)
                      .get(`${verificationUrl}/accept`)
                      .set('Accept', 'application/json')
                      .expect(302)
                      .end(function(err, res) {
                        if (err) return done.fail(err);

                        expect(res.headers.location).toEqual(`/login`);
                        done();
                      });
                  });
                });
              });
            });
          });

          describe('is re-sent an invite', () => {
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

                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

                    done();
                  });
                });
            });

            it('sends an email to notify agent of team membership invitation', function(done) {
              expect(mailer.transport.sentMail.length).toEqual(1);
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
                  expect(mailer.transport.sentMail.length).toEqual(2);
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

          describe('has invitation rescinded', () => {

            let verificationUrl;

            beforeEach(done => {
              authenticatedSession
                .put(`/team/${teamId}/agent`)
                .send({
                  email: registeredAgent.email
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  verificationUrl = `/team/${teamId}/invite`;

                  // For the team leader permission check
                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

                    // Update the team leader
                    stubUserAppMetadataUpdate((err, apiScopes) => {
                      if (err) return done.fail();
                      let {userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes;
                      teamLeaderAppMetadataUpdateScope = userAppMetadataUpdateScope;
                      teamLeaderAppMetadataUpdateOauthTokenScope = userAppMetadataUpdateOauthTokenScope;

                      // Retrieve the invited agent
                      stubUserAppMetadataRead({ ...registeredAgent.socialProfile,
                                                user_metadata: {...registeredAgent.socialProfile.user_metadata, rsvps: [{uuid: teamId}]}
                                              }, (err, apiScopes) => {
                        if (err) return done.fail();
                        ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);
                        invitedUserAppMetadataReadScope = userAppMetadataReadScope;
                        invitedUserAppMetadataReadOauthTokenScope = userAppMetadataReadOauthTokenScope;

                        // Update the previously invited agent
                        stubUserAppMetadataUpdate((err, apiScopes) => {
                          if (err) return done.fail();
                          let {userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes;
                          invitedUserAppMetadataUpdateScope = userAppMetadataUpdateScope;
                          invitedUserAppMetadataUpdateOauthTokenScope = userAppMetadataUpdateOauthTokenScope;

                          done();
                        });
                      });
                    });
                  });
                });
            });

            it('calls Auth0 to remove the invitation from the invited agent\'s user_metadata', done => {
              authenticatedSession
                .delete(verificationUrl)
                .send({
                  email: registeredAgent.email
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(invitedUserAppMetadataReadScope.isDone()).toBe(true);
                  expect(invitedUserAppMetadataUpdateScope.isDone()).toBe(true);

                  done();
                });
            });

            it('removes the invitation from the team leader\'s user_metadata', done => {
              // Cf. above... reverse thing happening here. Invited
              // agent is last to be modified, so the _profile represents him
              expect(_profile.user_metadata.pendingInvitations.length).toEqual(1);
              authenticatedSession
                .delete(verificationUrl)
                .send({
                  email: registeredAgent.email
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(res.body.user_metadata.pendingInvitations.length).toEqual(0);
                  expect(teamLeaderAppMetadataUpdateScope.isDone()).toBe(true);

                  done();
                });
            });

            it('doesn\'t barf if the team doesn\'t exist', done => {
              authenticatedSession
                .delete('/team/333/invite')
                .send({
                  email: registeredAgent.email
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(res.body.message).toEqual('No such invitation');

                  done();
                });
            });

            it('doesn\'t barf if the invitation doesn\'t exist', done => {
              authenticatedSession
                .delete(verificationUrl)
                .send({
                  email: registeredAgent.email
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail(err);

                    authenticatedSession
                      .delete(verificationUrl)
                      .send({
                        email: registeredAgent.email
                      })
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(404)
                      .end(function(err, res) {
                        if (err) return done.fail(err);

                        expect(res.body.message).toEqual('No such invitation');

                        done();
                      });
                  });
                });
            });
          });
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
