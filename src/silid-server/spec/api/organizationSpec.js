const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubUserRead = require('../support/auth0Endpoints/stubUserRead');
const stubUserAppMetadataRead = require('../support/auth0Endpoints/stubUserAppMetadataRead');
const stubUserAppMetadataUpdate = require('../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubOrganizationRead = require('../support/auth0Endpoints/stubTeamRead');
const mailer = require('../../mailer');
const scope = require('../../config/permissions');
const nock = require('nock');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../fixtures/sample-auth0-identity-token');
const _profile = require('../fixtures/sample-auth0-profile-response');

describe('organizationSpec', () => {

  let login, pub, prv, keystore;
  beforeEach(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  let originalProfile;
  let organization, agent;
  beforeEach(done => {
    originalProfile = {..._profile};

    models.sequelize.sync({force: true}).then(() => {
      fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, models).then(() => {
        models.Agent.findAll().then(results => {
          agent = results[0];
          fixtures.loadFile(`${__dirname}/../fixtures/organizations.json`, models).then(() => {
            models.Organization.findAll().then(results => {
              organization = results[0];
              done();
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

  afterEach(() => {
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    _profile.email_verified = true;
    delete _profile.user_metadata;
    _profile.email = originalProfile.email;
    _profile.name = originalProfile.name;
  });

  let oauthTokenScope, authenticatedSession,
      userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope,
      userAppMetadataReadScope, userAppMetadataReadOauthTokenScope,
      organizationReadScope, organizationReadOauthTokenScope;
  describe('authenticated', () => {

    describe('authorized', () => {

      describe('create', () => {

        describe('successfully', () => {
          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();

              login(_identity, [scope.create.organizations], (err, session) => {
                if (err) return done.fail(err);
                authenticatedSession = session;

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

                  // This stubs user reads subsequent to the original login
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
          });

          it('returns the agent profile', done => {
            authenticatedSession
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
            it('calls Auth0 to retrieve the agent user_metadata', done => {
              authenticatedSession
                .post('/organization')
                .send({
                  name: 'One Book Canada'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                  expect(userAppMetadataReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('calls Auth0 to update the agent', done => {
              authenticatedSession
                .post('/organization')
                .send({
                  name: 'One Book Canada'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
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
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();

              login(_identity, [scope.create.organizations], (err, session) => {

                if (err) return done.fail(err);
                authenticatedSession = session;

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
            });
          });

          describe('add a duplicate organization name', () => {
            it('returns an error if record already exists', done => {
              authenticatedSession
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
              it('calls Auth0 to retrieve the agent user_metadata', done => {
                authenticatedSession
                  .post('/organization')
                  .send({
                    name: 'One Book Canada'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(400)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                    expect(userAppMetadataReadScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('does not call Auth0 to update the agent user_metadata', done => {
                authenticatedSession
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
            authenticatedSession
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
            authenticatedSession
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
            authenticatedSession
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

      describe('read', () => {

        let authenticatedSession;
        beforeEach(done => {
          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login(_identity, [scope.read.organizations], (err, session) => {
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

        it('retrieves an existing record from the database', done => {
          authenticatedSession
            .get(`/organization/${organization.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.name).toBeDefined();
              expect(res.body.name).toEqual(organization.name);
              done();
            });
        });

        it('doesn\'t barf if record doesn\'t exist', done => {
          authenticatedSession
            .get('/organization/33')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('No such organization');
              done();
            });
        });

        it('retrieves all organization memberships for the agent', done => {
          agent.getOrganizations().then((results) => {
            expect(results.length).toEqual(1);
            authenticatedSession
              .get(`/organization`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.length).toEqual(1);
                done();
              });
          }).catch(err => {
            done.fail(err);
          });
        });

        it('retrieves all organizations created by the agent in addition to memberships', done => {
          agent.getOrganizations().then((results) => {
            expect(results.length).toEqual(1);

            models.Organization.create({ name: 'Lutheran Bible Translators', creatorId: agent.id }).then(org => {

              authenticatedSession
                .get(`/organization`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.length).toEqual(2);
                  done();
                });
             }).catch(err => {
               done.fail(err);
             });
          }).catch(err => {
            done.fail(err);
          });
        });

        it('populates the organization creator field', done => {
          authenticatedSession
            .get(`/organization/${organization.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              expect(res.body.creator).toBeDefined();
              expect(res.body.creator.email).toEqual(agent.email);
              done();
            });
        });

        it('populates the team list', done => {
          models.Team.create({ name: 'Alpha Squad 1', organizationId: organization.id, creatorId: agent.id }).then(team => {
            authenticatedSession
              .get(`/organization/${organization.id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.teams).toBeDefined();
                expect(res.body.teams.length).toEqual(1);
                expect(res.body.teams[0].name).toEqual('Alpha Squad 1');
                done();
              });
            }).catch(err => {
              done.fail(err);
            });
        });

        it('populates the teams on the organization team list', done => {
          models.Team.create({ name: 'Alpha Squad 1', organizationId: organization.id, creatorId: agent.id }).then(team => {
            authenticatedSession
              .get(`/organization/${organization.id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.teams).toBeDefined();
                expect(res.body.teams.length).toEqual(1);
                expect(res.body.teams[0].members.length).toEqual(1);
                expect(res.body.teams[0].members[0].email).toEqual(agent.email);
                done();
              });
            }).catch(err => {
              done.fail(err);
            });
        });

        it('populates the membership', done => {
          authenticatedSession
            .get(`/organization/${organization.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.members).toBeDefined();
              expect(res.body.members.length).toEqual(1);
              expect(res.body.members[0].id).toEqual(agent.id);
              done();
            });
        });
      });

      describe('update', () => {

        let authenticatedSession, userReadScope;
        beforeEach(done => {
          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login(_identity, [scope.update.organizations], (err, session) => {
              if (err) return done.fail(err);
              authenticatedSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();
                ({userReadScope} = apiScopes);

                done();
              });
            });
          });
        });

        describe('PUT', () => {
          it('updates an existing record in the database', done => {
            authenticatedSession
              .put('/organization')
              .send({
                id: organization.id,
                name: 'Some Cool Guy'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.name).toEqual('Some Cool Guy');

                models.Organization.findOne({ where: { id: organization.id }}).then(results => {
                  expect(results.name).toEqual('Some Cool Guy');
                  expect(results.email).toEqual(organization.email);
                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
          });

          it('doesn\'t barf if organization doesn\'t exist', done => {
            authenticatedSession
              .put('/organization')
              .send({
                id: 111,
                name: 'Some Guy'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('No such organization');
                done();
              });
          });
        });

        /**
         * The idempotent PUT is best used to change the properties of the organization.
         * PATCH is used to modify associations (i.e., memberships and teams).
         */
        describe('PATCH', () => {
          let anotherAgent;
          beforeEach(done => {
            models.Agent.create({ name: 'Some Other Guy', email: 'someotherguy@example.com' }).then(result => {
              anotherAgent = result;
              done();
            }).catch(err => {
              done.fail(err);
            });
          });

          afterEach(() => {
            mailer.transport.sentMail = [];
          });

          describe('agent membership', () => {
            describe('updated via ID', () => {
              it('adds a member agent when agent provided isn\'t currently a member', done => {
                authenticatedSession
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    memberId: anotherAgent.id
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('Update successful');

                    models.Organization.findOne({ where: { id: organization.id },
                                                  include: {model: models.Agent, as: 'members'},
                                                  order: [[{model: models.Agent, as: 'members'}, 'id', 'DESC']]
                                                }).then(results => {
                      expect(results.members.length).toEqual(2);
                      expect(results.members[0].name).toEqual(anotherAgent.name);
                      expect(results.members[0].email).toEqual(anotherAgent.email);
                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              });

              it('sends an email to notify agent of new membership', function(done) {
                expect(mailer.transport.sentMail.length).toEqual(0);
                authenticatedSession
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    memberId: anotherAgent.id
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(mailer.transport.sentMail.length).toEqual(1);
                    expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity organization invitation');
                    expect(mailer.transport.sentMail[0].data.text).toContain(`You have been invited to join ${organization.name}`);
                    done();
                  });
              });

              it('removes a member agent when agent provided is currently a member', done => {
                organization.addMember(anotherAgent).then(result => {
                  authenticatedSession
                    .patch('/organization')
                    .send({
                      id: organization.id,
                      memberId: anotherAgent.id
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(res.body.message).toEqual('Update successful');

                      models.Organization.findOne({ where: { id: organization.id }, include: ['members']}).then(results => {
                        expect(results.members.length).toEqual(1);
                        expect(results.members[0].name).toEqual(agent.name);
                        expect(results.members[0].email).toEqual(agent.email);
                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });

              it('sends an email to notify agent of membership revocation', function(done) {
                expect(mailer.transport.sentMail.length).toEqual(0);
                organization.addMember(anotherAgent).then(result => {
                  authenticatedSession
                    .patch('/organization')
                    .send({
                      id: organization.id,
                      memberId: anotherAgent.id
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(mailer.transport.sentMail.length).toEqual(1);
                      expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
                      expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                      expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                      expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${organization.name}`);
                      done();
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });

              it('doesn\'t barf if member agent doesn\'t exist', done => {
                authenticatedSession
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    memberId: 333
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

              it('doesn\'t send an email if member agent doesn\'t exist', done => {
                expect(mailer.transport.sentMail.length).toEqual(0);
                authenticatedSession
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    memberId: 333
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(mailer.transport.sentMail.length).toEqual(0);
                    done();
                  });
              });

              it('doesn\'t barf if organization doesn\'t exist', done => {
                authenticatedSession
                  .patch('/organization')
                  .send({
                    id: 111,
                    memberId: anotherAgent.id
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

              it('doesn\'t send an email if organization doesn\'t exist', done => {
                expect(mailer.transport.sentMail.length).toEqual(0);
                authenticatedSession
                  .patch('/organization')
                  .send({
                    id: 111,
                    memberId: anotherAgent.id
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(mailer.transport.sentMail.length).toEqual(0);
                    done();
                  });
              });

              it('doesn\'t allow a non-member agent to add a member', done => {
                nock.cleanAll();
                stubAuth0Sessions((err, sessionStuff) => {
                  if (err) return done.fail(err);
                  ({ login, pub, prv, keystore } = sessionStuff);

                  _profile.email = anotherAgent.email;
                  _profile.name = anotherAgent.name;

                  stubAuth0ManagementApi((err, apiScopes) => {
                    if (err) return done.fail();

                    // Cached profile doesn't match "live" data, so agent needs to be updated
                    // with a call to Auth0
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail();


                      login({..._identity, email: anotherAgent.email}, [scope.update.organizations], (err, session) => {
                        if (err) return done.fail(err);
                        session
                          .patch('/organization')
                          .send({
                            id: organization.id,
                            memberId: anotherAgent.id
                          })
                          .set('Accept', 'application/json')
                          .expect('Content-Type', /json/)
                          .expect(403)
                          .end(function(err, res) {
                            if (err) return done.fail(err);
                            expect(res.body.message).toEqual('You are not a member of this organization');
                            done();
                          });
                      });
                    });
                  });
                });
              });
            });

            describe('updated via email', () => {
              it('adds a member agent when agent provided isn\'t currently a member', done => {
                authenticatedSession
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    email: anotherAgent.email
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('Update successful');

                    models.Organization.findOne({ where: { id: organization.id },
                                                  include: {model: models.Agent, as: 'members'},
                                                  order: [[{model: models.Agent, as: 'members'}, 'id', 'DESC']]
                                                }).then(results => {
                      expect(results.members.length).toEqual(2);
                      expect(results.members[0].name).toEqual(anotherAgent.name);
                      expect(results.members[0].email).toEqual(anotherAgent.email);
                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              });

              it('sends an email to notify agent of new membership', function(done) {
                expect(mailer.transport.sentMail.length).toEqual(0);
                authenticatedSession
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    email: anotherAgent.email
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(mailer.transport.sentMail.length).toEqual(1);
                    expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity organization invitation');
                    expect(mailer.transport.sentMail[0].data.text).toContain(`You have been invited to join ${organization.name}`);
                    done();
                  });
              });

              it('removes a member agent when agent provided is currently a member', done => {
                organization.addMember(anotherAgent).then(result => {
                  authenticatedSession
                    .patch('/organization')
                    .send({
                      id: organization.id,
                      email: anotherAgent.email
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(res.body.message).toEqual('Update successful');

                      models.Organization.findOne({ where: { id: organization.id }, include: ['members']}).then(results => {
                        expect(results.members.length).toEqual(1);
                        expect(results.members[0].name).toEqual(agent.name);
                        expect(results.members[0].email).toEqual(agent.email);
                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });

              it('sends an email to notify agent of membership revocation', function(done) {
                expect(mailer.transport.sentMail.length).toEqual(0);
                organization.addMember(anotherAgent).then(result => {
                  authenticatedSession
                    .patch('/organization')
                    .send({
                      id: organization.id,
                      email: anotherAgent.email
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(mailer.transport.sentMail.length).toEqual(1);
                      expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
                      expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                      expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                      expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${organization.name}`);
                      done();
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });

              it('adds record if member agent doesn\'t exist', done => {
                authenticatedSession
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    email: 'someunknownagent@example.com'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('Update successful');

                    models.Agent.findOne({ where: { email: 'someunknownagent@example.com' } }).then(newAgent => {
                      expect(newAgent.name).toBe(null);
                      expect(newAgent.email).toEqual('someunknownagent@example.com');

                      models.Organization.findOne({ where: { id: organization.id }, include: ['members']}).then(results => {
                        expect(results.members.length).toEqual(2);
                        expect(results.members[1].name).toEqual(newAgent.name);
                        expect(results.members[1].email).toEqual(newAgent.email);
                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              });

              it('sends an email if member agent doesn\'t exist', done => {
                expect(mailer.transport.sentMail.length).toEqual(0);
                authenticatedSession
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    email: 'someunknownagent@example.com'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(mailer.transport.sentMail.length).toEqual(1);
                    expect(mailer.transport.sentMail[0].data.to).toEqual('someunknownagent@example.com');
                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity organization invitation');
                    expect(mailer.transport.sentMail[0].data.text).toContain(`You have been invited to join ${organization.name}`);
                    done();
                  });
              });

              it('doesn\'t barf if organization doesn\'t exist', done => {
                authenticatedSession
                  .patch('/organization')
                  .send({
                    id: 111,
                    email: anotherAgent.email
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

              it('doesn\'t allow a non-member agent to add a member', done => {
                nock.cleanAll();
                stubAuth0Sessions((err, sessionStuff) => {
                  if (err) return done.fail(err);
                  ({ login, pub, prv, keystore } = sessionStuff);

                  _profile.email = anotherAgent.email;
                  _profile.name = anotherAgent.name;

                  stubAuth0ManagementApi((err, apiScopes) => {
                    if (err) return done.fail();

                    login({..._identity, email: anotherAgent.email}, [scope.update.organizations], (err, session) => {
                      if (err) return done.fail(err);

                      // Cached profile doesn't match "live" data, so agent needs to be updated
                      // with a call to Auth0
                      stubUserRead((err, apiScopes) => {
                        if (err) return done.fail();

                        session
                          .patch('/organization')
                          .send({
                            id: organization.id,
                            email: anotherAgent.email
                          })
                          .set('Accept', 'application/json')
                          .expect('Content-Type', /json/)
                          .expect(403)
                          .end(function(err, res) {
                            if (err) return done.fail(err);
                            expect(res.body.message).toEqual('You are not a member of this organization');
                            done();
                          });
                      });
                    });
                  });
                });
              });
            });
          });

          describe('team membership', () => {

            let newTeam, newOrg;
            beforeEach(done => {
              anotherAgent.createOrganization({ name: 'International Association of Vigilante Crime Fighters', creatorId: anotherAgent.id }).then(result => {
                newOrg = result;
                newOrg.createTeam({ name: 'The A-Team', organizationId: newOrg.id, creatorId: agent.id }).then(result => {
                  newTeam = result;
                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
            });

            it('adds a team when the organization isn\'t currently a participant', done => {
              authenticatedSession
                .patch('/organization')
                .send({
                  id: organization.id,
                  teamId: newTeam.id
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('Update successful');

                  models.Organization.findOne({ where: { id: organization.id }, include: ['teams'] }).then(results => {
                    expect(results.teams.length).toEqual(1);
                    expect(results.teams[0].name).toEqual('The A-Team');
                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });
            });

            it('removes a team when the organization is a current participant', done => {
              organization.addTeam(newTeam).then(result => {
                authenticatedSession
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    teamId: newTeam.id
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('Update successful');

                    models.Organization.findOne({ where: { id: organization.id }, include: ['teams'] }).then(results => {
                      expect(results.teams.length).toEqual(0);
                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              }).catch(err => {
                done.fail(err);
              });
            });

            it('doesn\'t barf if team doesn\'t exist', done => {
              authenticatedSession
                .patch('/organization')
                .send({
                  id: organization.id,
                  teamId: 333
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

            it('doesn\'t barf if organization doesn\'t exist', done => {
              authenticatedSession
                .patch('/organization')
                .send({
                  id: 333,
                  teamId: newTeam
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

            it('doesn\'t allow a non-member agent to add a team', done => {
              nock.cleanAll();
              stubAuth0Sessions((err, sessionStuff) => {
                if (err) return done.fail(err);
                ({ login, pub, prv, keystore } = sessionStuff);

                _profile.email = anotherAgent.email;
                _profile.name = anotherAgent.name;

                stubAuth0ManagementApi((err, apiScopes) => {
                  if (err) return done.fail();

                  login({..._identity, email: anotherAgent.email}, [scope.update.organizations], (err, session) => {
                    if (err) return done.fail(err);

                    // Cached profile doesn't match "live" data, so agent needs to be updated
                    // with a call to Auth0
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail();

                      session
                        .patch('/organization')
                        .send({
                          id: organization.id,
                          teamId: newTeam.id
                        })
                        .set('Accept', 'application/json')
                        .expect('Content-Type', /json/)
                        .expect(403)
                        .end(function(err, res) {
                          if (err) done.fail(err);
                          expect(res.body.message).toEqual('You are not a member of this organization');
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

      describe('delete', () => {
        let authenticatedSession;
        beforeEach(done => {
          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login(_identity, [scope.delete.organizations], (err, session) => {
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

        it('removes an existing record from the database', done => {
          authenticatedSession
            .delete('/organization')
            .send({
              id: organization.id,
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('Organization deleted');
              done();
            });
        });

        it('doesn\'t barf if organization doesn\'t exist', done => {
          authenticatedSession
            .delete('/organization')
            .send({
              id: 111,
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('No such organization');
              done();
            });
        });
      });
    });

    describe('not verified', () => {

      let invitedAgent;
      beforeEach(done => {
        models.Agent.create({ email: 'invitedagent@example.com' }).then(a => {
          invitedAgent = a;
          models.OrganizationMember.create({ AgentId: a.id, OrganizationId: organization.id }).then(o => {
            done();
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      describe('update', () => {

        describe('PUT', () => {

          let unverifiedSession;
          beforeEach(done => {
            _profile.email = invitedAgent.email;
            _profile.name = invitedAgent.name;

            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();

              login({ ..._identity, email: invitedAgent.email }, [scope.update.organizations], (err, session) => {
                if (err) return done.fail(err);

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

                  unverifiedSession = session;

                  done();
                });
              });
            });
          });

          it('returns 403', done => {
            unverifiedSession
              .put('/organization')
              .send({
                id: organization.id,
                name: 'Some Cool Guy'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) done.fail(err);
                expect(res.body.message).toEqual('Unauthorized');
                done();
              });
          });

          it('does not change the record in the database', done => {
            unverifiedSession
              .put('/organization')
              .send({
                id: organization.id,
                name: 'Some Cool Guy'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) return done.fail(err);
                models.Organization.findOne({ where: { id: organization.id }}).then(results => {
                  expect(results.name).toEqual(organization.name);
                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
          });
        });

        describe('PATCH', () => {

          let unverifiedSession, anotherAgent;
          beforeEach(done => {
            _profile.email = invitedAgent.email;
            _profile.name = invitedAgent.name;

            models.Agent.create({ email: 'buddy@example.com' }).then(a => {
              anotherAgent = a;
              stubAuth0ManagementApi((err, apiScopes) => {
                if (err) return done.fail();

                login({ ..._identity, email: invitedAgent.email }, [scope.update.organizations], (err, session) => {
                  unverifiedSession = session;

                  // Cached profile doesn't match "live" data, so agent needs to be updated
                  // with a call to Auth0
                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

                    done();
                  });
                });
              });
            }).catch(err => {
              done.fail(err);
            });
          });

          it('returns 403', done => {
            unverifiedSession
              .patch('/organization')
              .send({
                id: organization.id,
                memberId: anotherAgent.id
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('You have not verified your invitation to this organization. Check your email.');
                done();
              });
          });

          it('does not change the record in the database', done => {
            models.Organization.findOne({ where: { id: organization.id }, include: ['members'] }).then(results => {
              expect(results.members.length).toEqual(2);

              unverifiedSession
                .patch('/organization')
                .send({
                  id: organization.id,
                  memberId: anotherAgent.id
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  models.Organization.findOne({ where: { id: organization.id }, include: ['members'] }).then(results => {
                    expect(results.members.length).toEqual(2);
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

      describe('read', () => {

        let unverifiedSession;
        beforeEach(done => {
          _profile.email = invitedAgent.email;
          _profile.name = invitedAgent.name;

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login({ ..._identity, email: invitedAgent.email }, [scope.read.organizations], (err, session) => {
              if (err) return done.fail(err);
              unverifiedSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                done();
              });
            });
          });
        });

        it('returns 403 on organization show', done => {
          unverifiedSession
            .get(`/organization/${organization.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('You have not verified your invitation to this organization. Check your email.');
              done();
            });
        });
      });

      describe('delete', () => {

        let unverifiedSession;
        beforeEach(done => {
          _profile.email = 'someotherguy@example.com';
          _profile.name = 'Some Other Guy';

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login({ ..._identity, email: _profile.email, name: _profile.name }, [scope.delete.organizations], (err, session) => {
              if (err) return done.fail(err);
              unverifiedSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                done();
              });
            });
          });
        });

        it('returns 401', done => {
          unverifiedSession
            .delete('/organization')
            .send({
              id: organization.id
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('Unauthorized');
              done();
            });
        });

        it('does not remove the record from the database', done => {
          models.Organization.findAll().then(results => {
            expect(results.length).toEqual(1);

            unverifiedSession
              .delete('/organization')
              .send({
                id: organization.id
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(401)
              .end(function(err, res) {
                if (err) return done.fail(err);
                models.Organization.findAll().then(results => {
                  expect(results.length).toEqual(1);
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

    describe('forbidden', () => {

      let unauthorizedSession;
      beforeEach(done => {
        models.Agent.create({ email: 'suspiciousagent@example.com', name: 'Suspicious Guy' }).then(a => {

          _profile.email = a.email;
          _profile.name = a.name;

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login({..._identity, email: a.email}, [scope.update.organizations, scope.read.organizations, scope.delete.organizations], (err, session) => {
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
        }).catch(err => {
          done.fail(err);
        });
      });

      describe('update', () => {
        describe('PUT', () => {
          it('returns 403', done => {
            unauthorizedSession
              .put('/organization')
              .send({
                id: organization.id,
                name: 'Some Cool Guy'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) done.fail(err);
                expect(res.body.message).toEqual('Unauthorized');
                done();
              });
          });

          it('does not change the record in the database', done => {
            unauthorizedSession
              .put('/organization')
              .send({
                id: organization.id,
                name: 'Some Cool Guy'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) return done.fail(err);
                models.Organization.findOne({ where: { id: organization.id }}).then(results => {
                  expect(results.name).toEqual(organization.name);
                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
          });
        });

        describe('PATCH', () => {
          it('returns 403', done => {
            unauthorizedSession
              .patch('/organization')
              .send({
                id: organization.id,
                memberId: 333
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('You are not a member of this organization');
                done();
              });
          });

          it('does not change the record in the database', done => {
            unauthorizedSession
              .patch('/organization')
              .send({
                id: organization.id,
                memberId: 333
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) return done.fail(err);
                models.Organization.findOne({ where: { id: organization.id }, include: ['members'] }).then(results => {
                  expect(results.members.length).toEqual(1);
                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
          });
        });
      });

      describe('read', () => {
        it('returns 403 on organization show', done => {
          unauthorizedSession
            .get(`/organization/${organization.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('You are not a member of that organization');
              done();
            });
        });
      });

      describe('delete', () => {
        it('returns 401', done => {
          unauthorizedSession
            .delete('/organization')
            .send({
              id: organization.id
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('Unauthorized');
              done();
            });
        });

        it('does not remove the record from the database', done => {
          models.Organization.findAll().then(results => {
            expect(results.length).toEqual(1);

            unauthorizedSession
              .delete('/organization')
              .send({
                id: organization.id
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(401)
              .end(function(err, res) {
                if (err) return done.fail(err);
                models.Organization.findAll().then(results => {
                  expect(results.length).toEqual(1);
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
  });

  describe('not authenticated', () => {
    it('redirects to login', done => {
      request(app)
        .get('/organization')
        .send({ name: 'Some org' })
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
