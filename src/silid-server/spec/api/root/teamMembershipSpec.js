const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubUserRead = require('../../support/auth0Endpoints/stubUserRead');
const stubUserReadQuery = require('../../support/auth0Endpoints/stubUserReadQuery');
const stubUserAppMetadataUpdate = require('../../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubUserAppMetadataRead = require('../../support/auth0Endpoints/stubUserAppMetadataRead');
const stubUserRolesRead = require('../../support/auth0Endpoints/stubUserRolesRead');
const mailer = require('../../../mailer');
const uuid = require('uuid');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../../fixtures/sample-auth0-identity-token');
const _profile = require('../../fixtures/sample-auth0-profile-response');

describe('root/teamMembershipSpec', () => {

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
    mailer.transport.sentMail = [];
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    _profile.email = originalProfile.email;
  });

  let root, team, organization, regularAgent;
  beforeEach(done => {
    originalProfile = {..._profile};
    _profile.email = process.env.ROOT_AGENT;

    models.sequelize.sync({force: true}).then(() => {
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
  });

  describe('authorized', () => {

    let rootSession;

//    describe('create', () => {
//    });

    describe('delete', () => {

      describe('from root\'s own team', () => {

        const agentProfile = { ..._profile, user_id: `${_profile.user_id + 1}`};

        let teamId;
        beforeEach(done => {

          // Member agent profile
          teamId = uuid.v4();
          agentProfile.email = 'member@example.com';
          agentProfile.name = 'Team Member';
          agentProfile.user_metadata = { teams: [ {name: 'The Calgary Roughnecks', leader: _profile.email, id: teamId } ] };

          // Team leader profile
          _profile.user_metadata = { teams: [ {name: 'The Calgary Roughnecks', leader: _profile.email, id: teamId } ] };

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login(_identity, (err, session) => {
              if (err) return done.fail(err);
              rootSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                // Retrieve the member agent
                stubUserAppMetadataRead(agentProfile, (err, apiScopes) => {
                  if (err) return done.fail();

                  // Update the agent
                  stubUserAppMetadataUpdate(agentProfile, (err, apiScopes) => {
                    if (err) return done.fail();

                    done();
                  });
                });
              });
            });
          });
        });

        it('removes an existing member record from the team', done => {
          expect(agentProfile.user_metadata.teams.length).toEqual(1);
          rootSession
            .delete(`/team/${teamId}/agent/${agentProfile.user_id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(agentProfile.user_metadata.teams.length).toEqual(0);
              done();
            });
        });

        it('doesn\'t barf if team doesn\'t exist', done => {
          rootSession
            .delete(`/team/333/agent/${agentProfile.user_id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('No such team');
              done();
            });
        });

        it('doesn\'t barf if the agent doesn\'t exist', done => {
          // This first call just clears the mocks
          rootSession
            .delete(`/team/${teamId}/agent/333`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                stubUserRolesRead((err, apiScopes) => {
                  if (err) return done(err);

                  // Retrieve the member agent
                  stubUserAppMetadataRead(agentProfile, (err, apiScopes) => {
                    if (err) return done.fail();

                    rootSession
                      .delete(`/team/${teamId}/agent/333`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(404)
                      .end(function(err, res) {
                        if (err) return done.fail(err);
                        expect(res.body.message).toEqual('That agent is not a member');
                        done();
                      });
                  }, { status: 404 });
                });
              });
            });
        });

        it('sends an email to notify agent of membership revocation', function(done) {
          expect(mailer.transport.sentMail.length).toEqual(0);
          rootSession
            .delete(`/team/${teamId}/agent/${agentProfile.user_id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(mailer.transport.sentMail.length).toEqual(1);
              expect(mailer.transport.sentMail[0].data.to).toEqual(agentProfile.email);
              expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
              expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
              expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of The Calgary Roughnecks`);
              done();
            });
        });

        it('doesn\'t let you delete the team leader', done => {
          // This first call just clears the mocks
          rootSession
            .delete(`/team/333/agent/333`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                stubUserRolesRead((err, apiScopes) => {
                   if (err) return done(err);

                  // Retrieve the member agent
                  stubUserAppMetadataRead((err, apiScopes) => {
                    if (err) return done.fail();

                    rootSession
                      .delete(`/team/${teamId}/agent/${_profile.user_id}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(403)
                      .end(function(err, res) {
                        if (err) return done.fail(err);
                        expect(res.body.message).toEqual('Team leader cannot be removed from team');
                        done();
                      });
                  });
                });
              });
            });
        });
      });

      describe('from team where root is a member', () => {

        const agentProfile = { ..._profile, user_id: `${_profile.user_id + 1}`};

        let teamId;
        beforeEach(done => {

          // Team leader profile
          teamId = uuid.v4();
          agentProfile.email = 'leader@example.com';
          agentProfile.name = 'Team Leader';
          agentProfile.user_metadata = { teams: [ {name: 'The Calgary Roughnecks', leader: 'leader@example.com', id: teamId } ] };

          // Member agent/root profile
          _profile.user_metadata = { teams: [ {name: 'The Calgary Roughnecks', leader: 'leader@example.com', id: teamId } ] };

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login(_identity, (err, session) => {
              if (err) return done.fail(err);
              rootSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                stubUserRolesRead((err, apiScopes) => {
                  if (err) return done(err);

                  // Retrieve the member agent
                  stubUserAppMetadataRead((err, apiScopes) => {
                    if (err) return done.fail();

                    // Update the agent
                    stubUserAppMetadataUpdate((err, apiScopes) => {
                      if (err) return done.fail();

                      done();
                    });
                  });
                });
              });
            });
          });
        });

        it('removes an existing member record from the team', done => {
          expect(_profile.user_metadata.teams.length).toEqual(1);
          rootSession
            .delete(`/team/${teamId}/agent/${_profile.user_id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(_profile.user_metadata.teams.length).toEqual(0);
              done();
            });
        });

        it('doesn\'t barf if team doesn\'t exist', done => {
          rootSession
            .delete(`/team/333/agent/${_profile.user_id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('No such team');
              done();
            });
        });

        it('doesn\'t barf if the agent doesn\'t exist', done => {
          // This first call just clears the mocks
          rootSession
            .delete(`/team/${teamId}/agent/333`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                // Retrieve the member agent
                stubUserAppMetadataRead(agentProfile, (err, apiScopes) => {
                  if (err) return done.fail();

                  stubUserRolesRead((err, apiScopes) => {
                    if (err) return done(err);

                    // Update the agent
                    stubUserAppMetadataUpdate(agentProfile, (err, apiScopes) => {
                      if (err) return done.fail();

                      rootSession
                        .delete(`/team/${teamId}/agent/333`)
                        .set('Accept', 'application/json')
                        .expect('Content-Type', /json/)
                        .expect(404)
                        .end(function(err, res) {
                          if (err) return done.fail(err);
                          expect(res.body.message).toEqual('That agent is not a member');
                          done();
                        });
                    });
                  });
                }, { status: 404 });
              });
            });
        });

        it('sends an email to notify root of membership revocation', function(done) {
          expect(mailer.transport.sentMail.length).toEqual(0);
          rootSession
            .delete(`/team/${teamId}/agent/${_profile.user_id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(mailer.transport.sentMail.length).toEqual(1);
              expect(mailer.transport.sentMail[0].data.to).toEqual(_profile.email);
              expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
              expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
              expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of The Calgary Roughnecks`);
              done();
            });
        });

        it('doesn\'t let you delete the team leader', done => {
          // This first call just clears the mocks
          rootSession
            .delete(`/team/333/agent/333`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                stubUserRolesRead((err, apiScopes) => {
                  if (err) return done(err);

                  // Retrieve the member agent
                  stubUserAppMetadataRead(agentProfile, (err, apiScopes) => {
                    if (err) return done.fail();

                    rootSession
                      .delete(`/team/${teamId}/agent/${agentProfile.user_id}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(403)
                      .end(function(err, res) {
                        if (err) return done.fail(err);
                        expect(res.body.message).toEqual('Team leader cannot be removed from team');
                        done();
                      });
                  });
                });
              });
            });
        });
      });

      describe('from team with which root has no affiliation', () => {

        const agentProfile = { ..._profile, user_id: `${_profile.user_id + 1}`};

        let teamId;
        beforeEach(done => {

          // Team leader profile
          teamId = uuid.v4();
          agentProfile.email = 'teammember@example.com';
          agentProfile.name = 'Team Member';
          agentProfile.user_metadata = { teams: [ {name: 'The Calgary Roughnecks', leader: 'leader@example.com', id: teamId } ] };

          // Root
          _profile.user_metadata = { };

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login(_identity, (err, session) => {
              if (err) return done.fail(err);
              rootSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                stubUserRolesRead((err, apiScopes) => {
                  if (err) return done(err);

                  // Retrieve the member agent
                  stubUserAppMetadataRead(agentProfile, (err, apiScopes) => {
                    if (err) return done.fail();

                    // Update the agent
                    stubUserAppMetadataUpdate(agentProfile, (err, apiScopes) => {
                      if (err) return done.fail();

                      done();
                    });
                  });
                });
              });
            });
          });
        });

        it('removes an existing member record from the team', done => {
          expect(agentProfile.user_metadata.teams.length).toEqual(1);
          rootSession
            .delete(`/team/${teamId}/agent/${agentProfile.user_id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(agentProfile.user_metadata.teams.length).toEqual(0);
              done();
            });
        });

        it('doesn\'t barf if team doesn\'t exist', done => {
          rootSession
            .delete(`/team/333/agent/${agentProfile.user_id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('No such team');
              done();
            });
        });

        it('doesn\'t barf if the agent doesn\'t exist', done => {
          // This first call just clears the mocks
          rootSession
            .delete(`/team/${teamId}/agent/333`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                // Retrieve the member agent
                stubUserAppMetadataRead(agentProfile, (err, apiScopes) => {
                  if (err) return done.fail();

                  stubUserRolesRead((err, apiScopes) => {
                     if (err) return done(err);

                    // Update the agent
                    stubUserAppMetadataUpdate(agentProfile, (err, apiScopes) => {
                      if (err) return done.fail();

                      rootSession
                        .delete(`/team/${teamId}/agent/333`)
                        .set('Accept', 'application/json')
                        .expect('Content-Type', /json/)
                        .expect(404)
                        .end(function(err, res) {
                          if (err) return done.fail(err);
                          expect(res.body.message).toEqual('That agent is not a member');
                          done();
                        });
                    });
                  });
                }, { status: 404 });
              });
            });
        });

        it('sends an email to notify former member of membership revocation', function(done) {
          expect(mailer.transport.sentMail.length).toEqual(0);
          rootSession
            .delete(`/team/${teamId}/agent/${agentProfile.user_id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(mailer.transport.sentMail.length).toEqual(1);
              expect(mailer.transport.sentMail[0].data.to).toEqual(agentProfile.email);
              expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
              expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
              expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of The Calgary Roughnecks`);
              done();
            });
        });

        it('doesn\'t let you delete the team leader', done => {
          // This first call just clears the mocks
          rootSession
            .delete(`/team/333/agent/333`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                stubUserRolesRead((err, apiScopes) => {
                   if (err) return done(err);

                  // Retrieve the member agent
                  stubUserAppMetadataRead({...agentProfile, name: 'Team Leader', email: 'leader@example.com', user_id: _profile.user_id + 2 }, (err, apiScopes) => {
                    if (err) return done.fail();

                    rootSession
                      .delete(`/team/${teamId}/agent/${agentProfile.user_id}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(403)
                      .end(function(err, res) {
                        if (err) return done.fail(err);
                        expect(res.body.message).toEqual('Team leader cannot be removed from team');
                        done();
                      });
                  });
                });
              });
            });
        });
      });
    });
  });
});
