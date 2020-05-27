const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubUserRead = require('../../support/auth0Endpoints/stubUserRead');
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
  beforeAll(done => {
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
    let rootSession;
    beforeEach(done => {
      stubAuth0ManagementApi((err, apiScopes) => {
        if (err) return done.fail();

        login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, (err, session) => {
          if (err) return done.fail(err);
          rootSession = session;

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
      describe('/organization', () => {
        it('retrieves only the root agent\'s organization', done => {
          models.Organization.create({ name: 'Mr Worldwide', creatorId: root.id }).then(o => {
            models.Organization.findAll().then(results => {
              expect(results.length).toEqual(2);
              rootSession
                .get(`/organization`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.length).toEqual(1);
                  expect(res.body[0].name).toEqual('Mr Worldwide');
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


      describe('/organization/:id', () => {
        it('retrieves an existing record from the database', done => {
          rootSession
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
          rootSession
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

        it('populates the organization creator field', done => {
          rootSession
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
            rootSession
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
            rootSession
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
          rootSession
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
    });

    describe('create', () => {
      it('adds a new record to the database', done => {
        models.Organization.findAll().then(results => {
          expect(results.length).toEqual(1);

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
              expect(res.body.name).toEqual('One Book Canada');

              models.Organization.findAll().then(results => {
                expect(results.length).toEqual(2);
                done();
              }).catch(err => {
                done.fail(err);
              });
            });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('credits creator agent', done => {
        rootSession
          .post('/organization')
          .send({
            name: 'One Book Canada'
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) done.fail(err);
            expect(res.body.creatorId).toEqual(root.id);
            done();
          });
      });

      it('returns an error if record already exists', done => {
        rootSession
          .post('/organization')
          .send({
            name: organization.name
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.body.errors.length).toEqual(1);
            expect(res.body.errors[0].message).toEqual('That organization is already registered');
            done();
          });
      });
    });


    describe('update', () => {

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

  describe('forbidden', () => {

    let forbiddenSession;
    beforeEach(done => {
      _profile.email = originalProfile.email;

      stubAuth0ManagementApi((err, apiScopes) => {
        if (err) return done.fail();

        login({..._identity, email: agent.email}, [scope.read.organizations], (err, session) => {
          if (err) return done.fail(err);
          forbiddenSession = session;

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
      describe('/organization', () => {
        it('returns only the organizations created by the requesting agent', done => {
          models.Organization.create({ name: 'Mr Worldwide', creatorId: root.id }).then(o => {
            models.Organization.findAll().then(results => {
              expect(results.length).toEqual(2);
              forbiddenSession
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
          }).catch(err => {
            done.fail(err);
          });
        });
      });
    });
  });
});
