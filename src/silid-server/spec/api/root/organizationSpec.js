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

      beforeEach(done => {
        // Cached profile doesn't match "live" data, so agent needs to be updated
        // with a call to Auth0
        stubUserRead((err, apiScopes) => {
          if (err) return done.fail();
          done();
        });
      });

      describe('/organization', () => {

        let organizationId, anotherOrganizationId;
        beforeEach(done => {
          // Manufacture some orgs
          organizationId = uuid.v4();
          anotherOrganizationId = uuid.v4();
          done();
        });

        it('retrieves only the root agent\'s organization', done => {
          _profile.user_metadata = {
            organizations: [
              {name: 'The National Lacrosse League', organizer: _profile.email, id: anotherOrganizationId },
              {name: 'One Book Canada', organizer: _profile.email, id: organizationId }
            ]
          };

          stubUserAppMetadataRead((err, apiScopes) => {
            if (err) return done.fail();
            let {userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes;

            expect(_profile.user_metadata.organizations.length).toEqual(2);
            rootSession
              .get(`/organization`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.length).toEqual(2);
                expect(res.body[0]).toEqual({name: 'One Book Canada', organizer: _profile.email, id: organizationId });
                expect(res.body[1]).toEqual({name: 'The National Lacrosse League', organizer: _profile.email, id: anotherOrganizationId });

                // Auth0 is the souce
                expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                expect(userAppMetadataReadScope.isDone()).toBe(true);

                done();
              });
          });
        });
      });

      describe('/organization/admin', () => {
        it('retrieves all organizations', done => {
          models.Organization.create({ name: 'Mr Worldwide', creatorId: agent.id }).then(o => {
            models.Organization.findAll().then(results => {
              expect(results.length).toEqual(2);
              rootSession
                .get(`/organization/admin`)
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
      });


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

                expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
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
            it('calls Auth0 to retrieve the agent user_metadata', done => {
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

                  expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                  expect(userAppMetadataReadScope.isDone()).toBe(true);
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

      beforeEach(done => {
        // Cached profile doesn't match "live" data, so agent needs to be updated
        // with a call to Auth0
        stubUserRead((err, apiScopes) => {
          if (err) return done.fail();
          done();
        });
      });

      describe('PUT', () => {
        it('updates an existing record in the database', done => {
          rootSession
            .put('/organization')
            .send({
              id: organization.id,
              name: 'Mr. Worldwide'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.name).toEqual('Mr. Worldwide');

              models.Organization.findOne({ where: { id: organization.id }}).then(results => {
                expect(results.name).toEqual('Mr. Worldwide');
                done();
              }).catch(err => {
                done.fail(err);
              });
            });
        });

        it('doesn\'t barf if organization doesn\'t exist', done => {
          rootSession
            .put('/organization')
            .send({
              id: 111,
              name: 'Mr. Worldwide'
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
              rootSession
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

                  models.Organization.findOne({ where: { id: organization.id }, include: ['members'] }).then(results => {
                    expect(results.members.length).toEqual(2);
                    expect(results.members.find(m => m.name === anotherAgent.name)).toBeDefined();
                    expect(results.members.find(m => m.email === anotherAgent.email)).toBeDefined();
                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });
            });

            it('sends an email to notify agent of new membership', function(done) {
              expect(mailer.transport.sentMail.length).toEqual(0);
              rootSession
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
                rootSession
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
                rootSession
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
              rootSession
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
              rootSession
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
              rootSession
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
              rootSession
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
          });

          describe('updated via email', () => {
            it('adds a member agent when agent provided isn\'t currently a member', done => {
              rootSession
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

                  models.Organization.findOne({ where: { id: organization.id }, include: ['members'] }).then(results => {
                    expect(results.members.length).toEqual(2);
                    expect(results.members.find(m => m.name === anotherAgent.name)).toBeDefined();
                    expect(results.members.find(m => m.email === anotherAgent.email)).toBeDefined();

                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });
            });

            it('sends an email to notify agent of new membership', function(done) {
              expect(mailer.transport.sentMail.length).toEqual(0);
              rootSession
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
                rootSession
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
                rootSession
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
              rootSession
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
              rootSession
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
              rootSession
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
            rootSession
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
              rootSession
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
            rootSession
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
            rootSession
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
        });
      });
    });

    describe('delete', () => {

      beforeEach(done => {
        // Cached profile doesn't match "live" data, so agent needs to be updated
        // with a call to Auth0
        stubUserRead((err, apiScopes) => {
          if (err) return done.fail();
          done();
        });
      });

      it('removes an existing record from the database', done => {
        rootSession
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
        rootSession
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
});
