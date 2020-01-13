const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const nock = require('nock')
const stubJwks = require('../support/stubJwks');
const NodeRSA = require('node-rsa');
const mailer = require('../../mailer');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _access = require('../fixtures/sample-auth0-access-token');
const _identity = require('../fixtures/sample-auth0-identity-token');

describe('teamSpec', () => {

  let signedAccessToken, scope, pub, prv, keystore;
  beforeAll(done => {
    stubJwks((err, tokenAndScope) => {
      if (err) return done.fail(err);
      ({ signedAccessToken, scope, pub, prv, keystore } = tokenAndScope);

      done();
    });
  });

  let team, organization, agent;
  beforeEach(done => {
    models.sequelize.sync({force: true}).then(() => {
      fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, models).then(() => {
        models.Agent.findAll().then(results => {
          agent = results[0];
          fixtures.loadFile(`${__dirname}/../fixtures/organizations.json`, models).then(() => {
            models.Organization.findAll().then(results => {
              organization = results[0];
              fixtures.loadFile(`${__dirname}/../fixtures/teams.json`, models).then(() => {
                models.Team.findAll().then(results => {
                  team = results[0];

                  // This agent has recently returned for a visit
                  agent.accessToken = `Bearer ${signedAccessToken}`;
                  agent.save().then(() => {
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
    }).catch(err => {
      done.fail(err);
    });
  });

  describe('authenticated', () => {

    describe('authorized', () => {

      describe('create', () => {
        describe('organization creator', () => {
          it('allows organization creator to add a new record to the database', done => {
            organization.getCreator().then(creator => {
              expect(creator.email).toEqual(agent.email);

              models.Team.findAll().then(results => {
                expect(results.length).toEqual(1);

                request(app)
                  .post('/team')
                  .send({
                    organizationId: organization.id,
                    name: 'Tsuutina Translation'
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.name).toEqual('Tsuutina Translation');

                    models.Team.findAll().then(results => {
                      expect(results.length).toEqual(2);
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

          it('credits organization creator as team creator', done => {
            request(app)
              .post('/team')
              .send({
                organizationId: organization.id,
                name: 'Tsuutina Translation'
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(res.body.creatorId).toEqual(agent.id);
                done();
              });
          });
        });

        describe('organization member', () => {
          let newMemberToken, memberAgent;
          beforeEach(done => {
            newMemberToken = jwt.sign({ ..._access, sub: 'auth0|888888' }, prv, { algorithm: 'RS256', expiresIn: '1h', header: { kid: keystore.all()[0].kid } });

            memberAgent = new models.Agent({ email: 'member-agent@example.com', accessToken: `Bearer ${newMemberToken}` });
            memberAgent.save().then(results => {
              memberAgent.addOrganization(organization).then(results => {
                done();
              }).catch(err => {
                done.fail(err);
              });
            }).catch(err => {
              done.fail(err);
            });
          });

          it('allows organization member to add a new record to the database', done => {
            models.Team.findAll().then(results => {
              expect(results.length).toEqual(1);
              request(app)
                .post('/team')
                .send({
                  organizationId: organization.id,
                  name: 'Tsuutina Translation'
                })
                .set('Accept', 'application/json')
                .set('Authorization', `Bearer ${newMemberToken}`)
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) done.fail(err);
                  scope.done();

                  expect(res.body.name).toEqual('Tsuutina Translation');

                  models.Team.findAll().then(results => {
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

          it('credits organization member as team creator', done => {
            request(app)
              .post('/organization')
              .send({
                organizationId: organization.id,
                name: 'Tsuutina Translation'
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${newMemberToken}`)
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(res.body.creatorId).toEqual(memberAgent.id);
                done();
              });
          });
        });

        it('returns an error if record already exists', done => {
          request(app)
            .post('/team')
            .send({
              organizationId: organization.id, 
              name: team.name 
            })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('That team is already registered');
              done();
            });
        });
      });

      describe('read', () => {
        it('retrieves an existing record from the database', done => {
          request(app)
            .get(`/team/${team.id}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.email).toEqual(team.email);
              done();
            });
        });

        it('doesn\'t barf if record doesn\'t exist', done => {
          request(app)
            .get('/team/33')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.message).toEqual('No such team');
              done();
            });
        });

        it('retrieves all team memberships for the agent', done => {
          agent.getTeams().then(results => {
            expect(results.length).toEqual(1);
            request(app)
              .get(`/team`)
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(res.body.length).toEqual(1);
                done();
              });
          }).catch(err => {
            done.fail(err);
          });
        });

        it('retrieves all teams created by the agent in addition to memberships', done => {
          agent.getTeams().then(results => {
            expect(results.length).toEqual(1);

            models.Team.create({ name: 'Alpha Squadron',
                                 creatorId: agent.id,
                                 organizationId: organization.id }).then(res => {

              request(app)
                .get(`/team`)
                .set('Accept', 'application/json')
                .set('Authorization', `Bearer ${signedAccessToken}`)
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) done.fail(err);
                  scope.done();
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

        it('populates the team creator field', done => {
          request(app)
            .get(`/team/${team.id}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.creator).toBeDefined();
              expect(res.body.creator.email).toEqual(agent.email);
              expect(res.body.creator.accessToken).toBeUndefined();
              done();
            });
        });

        it('populates the owner organization', done => {
          request(app)
            .get(`/team/${team.id}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.organization).toBeDefined();
              expect(res.body.organization.id).toEqual(organization.id);
              expect(res.body.organization.name).toEqual(organization.name);
              done();
            });
        });

        it('populates the membership', done => {
          request(app)
            .get(`/team/${team.id}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.members).toBeDefined();
              expect(res.body.members.length).toEqual(1);
              expect(res.body.members[0].id).toEqual(agent.id);
              done();
            });
        });

        it('omits agent tokens in populated membership', done => {
          request(app)
            .get(`/team/${team.id}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.members[0].accessToken).toBeUndefined();
              done();
            });
        });
      });

      describe('update', () => {

        describe('PUT', () => {
          it('allows an organization creator to update an existing team in the database', done => {
            organization.getCreator().then(creator => {
              expect(creator.email).toEqual(agent.email);
              expect(team.organizationId).toEqual(organization.id);

              request(app)
                .put('/team')
                .send({
                  id: team.id,
                  name: 'Tsuutina Mark Translation'
                })
                .set('Accept', 'application/json')
                .set('Authorization', `Bearer ${signedAccessToken}`)
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) done.fail(err);
                  scope.done();
                  expect(res.body.name).toEqual('Tsuutina Mark Translation');

                  models.Team.findOne({ where: { id: team.id }}).then(results => {
                    expect(results.name).toEqual('Tsuutina Mark Translation');
                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });
            }).catch(err => {
              done.fail(err);
            });
          });

          it('allows a team creator to update an existing record in the database', done => {
            const memberToken = jwt.sign({ ..._access, sub: 'auth0|888888' }, prv, { algorithm: 'RS256', expiresIn: '1h', header: { kid: keystore.all()[0].kid } });

            let teamMember = new models.Agent({ email: 'member-agent@example.com', accessToken: `Bearer ${memberToken}` });
            teamMember.save().then(results => {
              teamMember.createTeam({ name: 'Omega Team',
                                      organizationId: organization.id,
                                      creatorId: teamMember.id }).then(team => {

                request(app)
                  .put('/team')
                  .send({
                    id: team.id,
                    name: 'Tsuutina Mark Translation'
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${memberToken}`)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.name).toEqual('Tsuutina Mark Translation');

                    models.Team.findOne({ where: { id: team.id }}).then(results => {
                      expect(results.name).toEqual('Tsuutina Mark Translation');
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

          it('doesn\'t barf if team doesn\'t exist', done => {
            request(app)
              .put('/team')
              .send({
                id: 111,
                name: 'Tsuutina Mark Translation'
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                scope.done();
                expect(res.body.message).toEqual('No such team');
                done();
              });
          });
        });

        /**
         * The idempotent PUT is best used to change the properties of the team.
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
                request(app)
                  .patch('/team')
                  .send({
                    id: team.id,
                    memberId: anotherAgent.id
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.message).toEqual('Update successful');

                    models.Team.findOne({ where: { id: team.id }, include: ['members'] }).then(results => {
                      expect(results.members.length).toEqual(2);
                      expect(results.members[1].name).toEqual(anotherAgent.name);
                      expect(results.members[1].email).toEqual(anotherAgent.email);
                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              });

              it('sends an email to notify agent of new membership', function(done) {
                expect(mailer.transport.sentMail.length).toEqual(0);
                request(app)
                  .patch('/team')
                  .send({
                    id: team.id,
                    memberId: anotherAgent.id
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(mailer.transport.sentMail.length).toEqual(1);
                    expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                    expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
                    done();
                  });
              });

              it('removes a member agent when agent provided is currently a member', done => {
                team.addMember(anotherAgent).then(result => {
                  request(app)
                    .patch('/team')
                    .send({
                      id: team.id,
                      memberId: anotherAgent.id
                    })
                    .set('Accept', 'application/json')
                    .set('Authorization', `Bearer ${signedAccessToken}`)
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) done.fail(err);
                      scope.done();
                      expect(res.body.message).toEqual('Update successful');

                      models.Team.findOne({ where: { id: team.id }, include: ['members']}).then(results => {
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
                team.addMember(anotherAgent).then(result => {
                  request(app)
                    .patch('/team')
                    .send({
                      id: team.id,
                      memberId: anotherAgent.id
                    })
                    .set('Accept', 'application/json')
                    .set('Authorization', `Bearer ${signedAccessToken}`)
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) done.fail(err);
                      scope.done();
                      expect(mailer.transport.sentMail.length).toEqual(1);
                      expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
                      expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                      expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                      expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${team.name}`);
                      done();
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });

              it('doesn\'t barf if member agent doesn\'t exist', done => {
                request(app)
                  .patch('/team')
                  .send({
                    id: team.id,
                    memberId: 333
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.message).toEqual('No such agent');
                    done();
                  });
              });

              it('doesn\'t send an email if member agent doesn\'t exist', done => {
                expect(mailer.transport.sentMail.length).toEqual(0);
                request(app)
                  .patch('/team')
                  .send({
                    id: team.id,
                    memberId: 333
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(mailer.transport.sentMail.length).toEqual(0);
                    done();
                  });
              });

              it('doesn\'t barf if team doesn\'t exist', done => {
                request(app)
                  .patch('/team')
                  .send({
                    id: 111,
                    memberId: anotherAgent.id
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.message).toEqual('No such team');
                    done();
                  });
              });

              it('doesn\'t send an email if team doesn\'t exist', done => {
                expect(mailer.transport.sentMail.length).toEqual(0);
                request(app)
                  .patch('/team')
                  .send({
                    id: 111,
                    memberId: anotherAgent.id
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(mailer.transport.sentMail.length).toEqual(0);
                    done();
                  });
              });

              it('doesn\'t allow a non-member agent to add a member', done => {
                let unauthorizedToken = jwt.sign({ ..._access, sub: 'auth0|888888' }, prv, { algorithm: 'RS256', expiresIn: '1h', header: { kid: keystore.all()[0].kid } });
                anotherAgent.accessToken = `Bearer ${unauthorizedToken}`;
                anotherAgent.save().then(() => {
                  request(app)
                    .patch('/team')
                    .send({
                      id: team.id,
                      memberId: anotherAgent.id
                    })
                    .set('Accept', 'application/json')
                    .set('Authorization', `Bearer ${unauthorizedToken}`)
                    .expect('Content-Type', /json/)
                    .expect(403)
                    .end(function(err, res) {
                      if (err) done.fail(err);
                      scope.done();
                      expect(res.body.message).toEqual('You are not a member of this team');
                      done();
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });
            });

            describe('updated via email', () => {
              it('adds a member agent when agent provided isn\'t currently a member', done => {
                request(app)
                  .patch('/team')
                  .send({
                    id: team.id,
                    email: anotherAgent.email
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.message).toEqual('Update successful');

                    models.Team.findOne({ where: { id: team.id }, include: ['members'] }).then(results => {
                      expect(results.members.length).toEqual(2);
                      expect(results.members[1].name).toEqual(anotherAgent.name);
                      expect(results.members[1].email).toEqual(anotherAgent.email);
                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              });

              it('sends an email to notify agent of new membership', function(done) {
                expect(mailer.transport.sentMail.length).toEqual(0);
                request(app)
                  .patch('/team')
                  .send({
                    id: team.id,
                    email: anotherAgent.email
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(mailer.transport.sentMail.length).toEqual(1);
                    expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                    expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
                    done();
                  });
              });

              it('removes a member agent when agent provided is currently a member', done => {
                team.addMember(anotherAgent).then(result => {
                  request(app)
                    .patch('/team')
                    .send({
                      id: team.id,
                      email: anotherAgent.email
                    })
                    .set('Accept', 'application/json')
                    .set('Authorization', `Bearer ${signedAccessToken}`)
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) done.fail(err);
                      scope.done();
                      expect(res.body.message).toEqual('Update successful');

                      models.Team.findOne({ where: { id: team.id }, include: ['members']}).then(results => {
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
                team.addMember(anotherAgent).then(result => {
                  request(app)
                    .patch('/team')
                    .send({
                      id: team.id,
                      email: anotherAgent.email
                    })
                    .set('Accept', 'application/json')
                    .set('Authorization', `Bearer ${signedAccessToken}`)
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) done.fail(err);
                      scope.done();
                      expect(mailer.transport.sentMail.length).toEqual(1);
                      expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
                      expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                      expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                      expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${team.name}`);
                      done();
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });

              it('adds record if member agent doesn\'t exist', done => {
                request(app)
                  .patch('/team')
                  .send({
                    id: team.id,
                    email: 'someunknownagent@example.com'
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    expect(res.body.message).toEqual('Update successful');

                    models.Agent.findOne({ where: { email: 'someunknownagent@example.com' } }).then(unknownAgent => {
                      expect(unknownAgent.name).toBe(null);
                      expect(unknownAgent.email).toEqual('someunknownagent@example.com');

                      models.Team.findOne({ where: { id: team.id }, include: ['members']}).then(results => {
                        expect(results.members.length).toEqual(2);
                        expect(results.members[1].name).toEqual(unknownAgent.name);
                        expect(results.members[1].email).toEqual(unknownAgent.email);
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
                request(app)
                  .patch('/team')
                  .send({
                    id: team.id,
                    email: 'someunknownagent@example.com'
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    expect(mailer.transport.sentMail.length).toEqual(1);
                    expect(mailer.transport.sentMail[0].data.to).toEqual('someunknownagent@example.com');
                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                    expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
                    done();
                  });
              });

              it('doesn\'t barf if team doesn\'t exist', done => {
                request(app)
                  .patch('/team')
                  .send({
                    id: 111,
                    email: anotherAgent.email
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.message).toEqual('No such team');
                    done();
                  });
              });

              it('doesn\'t allow a non-member agent to add a member', done => {
                let unauthorizedToken = jwt.sign({ ..._access, sub: 'auth0|888888' }, prv, { algorithm: 'RS256', expiresIn: '1h', header: { kid: keystore.all()[0].kid } });
                anotherAgent.accessToken = `Bearer ${unauthorizedToken}`;
                anotherAgent.save().then(() => {
                  request(app)
                    .patch('/team')
                    .send({
                      id: team.id,
                      email: anotherAgent.email
                    })
                    .set('Accept', 'application/json')
                    .set('Authorization', `Bearer ${unauthorizedToken}`)
                    .expect('Content-Type', /json/)
                    .expect(403)
                    .end(function(err, res) {
                      if (err) done.fail(err);
                      scope.done();
                      expect(res.body.message).toEqual('You are not a member of this team');
                      done();
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });
            });
          });
        });
      });

      describe('delete', () => {
        it('allows organization creator to remove an existing record from the database', done => {
          organization.getCreator().then(creator => {
            expect(creator.email).toEqual(agent.email);
            expect(team.organizationId).toEqual(organization.id);

            request(app)
              .delete(`/team/${team.id}`)
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(res.body.message).toEqual('Team deleted');
                models.Team.findAll().then(results => {
                  expect(results.length).toEqual(0);
                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
          }).catch(err => {
            done.fail(err);
          });
        });

        it('allows team creator to remove team from the database', done => {
          const memberToken = jwt.sign({ ..._access, sub: 'auth0|888888' }, prv, { algorithm: 'RS256', expiresIn: '1h', header: { kid: keystore.all()[0].kid } });

          let teamMember = new models.Agent({ email: 'member-agent@example.com', accessToken: `Bearer ${memberToken}` });
          teamMember.save().then(results => {
            teamMember.createTeam({ name: 'Omega Team',
                                    organizationId: organization.id,
                                    creatorId: teamMember.id }).then(team => {

              team.getCreator().then(creator => {
                expect(creator.email).toEqual(teamMember.email);
                expect(team.organizationId).toEqual(organization.id);

                request(app)
                  .delete(`/team/${team.id}`)
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${memberToken}`)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.message).toEqual('Team deleted');
                    models.Team.findOne({where: {id: team.id}}).then(results => {
                      expect(results).toBe(null);
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
        });

        it('does not allow organization member to remove an existing record from the database', done => {
          const memberToken = jwt.sign({ ..._access, sub: 'auth0|888888' }, prv, { algorithm: 'RS256', expiresIn: '1h', header: { kid: keystore.all()[0].kid } });

          let memberAgent = new models.Agent({ email: 'member-agent@example.com', accessToken: `Bearer ${memberToken}` });
          memberAgent.save().then(results => {
            memberAgent.addOrganization(organization).then(results => {

              request(app)
                .delete(`/team/${team.id}`)
                .set('Accept', 'application/json')
                .set('Authorization', `Bearer ${memberToken}`)
                .expect('Content-Type', /json/)
                .expect(403)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  scope.done();
                  expect(res.body.message).toEqual('Unauthorized: Invalid token');
                  models.Team.findAll().then(results => {
                    expect(results.length).toEqual(1);
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

        it('does not allow organization member to remove an existing record from the database', done => {
          const memberToken = jwt.sign({ ..._access, sub: 'auth0|888888' }, prv, { algorithm: 'RS256', expiresIn: '1h', header: { kid: keystore.all()[0].kid } });

          let memberAgent = new models.Agent({ email: 'member-agent@example.com', accessToken: `Bearer ${memberToken}` });
          memberAgent.save().then(results => {
            memberAgent.addTeam(team).then(results => {

              request(app)
                .delete(`/team/${team.id}`)
                .set('Accept', 'application/json')
                .set('Authorization', `Bearer ${memberToken}`)
                .expect('Content-Type', /json/)
                .expect(403)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  scope.done();
                  expect(res.body.message).toEqual('Unauthorized: Invalid token');
                  models.Team.findAll().then(results => {
                    expect(results.length).toEqual(1);
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

        it('doesn\'t barf if team doesn\'t exist', done => {
          request(app)
            .delete(`/team/333`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);
              scope.done();
              expect(res.body.message).toEqual('No such team');
              done();
            });
        });
      });
    });

    describe('unauthorized', () => {

      let unauthorizedToken;
      beforeEach(done => {
        unauthorizedToken = jwt.sign({ ..._access, sub: 'auth0|888888' }, prv, { algorithm: 'RS256', expiresIn: '1h', header: { kid: keystore.all()[0].kid } });

        models.Agent.create({ email: 'unauthorizedagent@example.com', accessToken: `Bearer ${unauthorizedToken}` }).then(a => {
          done();
        }).catch(err => {
          done.fail(err);
        });
      });

      describe('create', () => {
        it('returns 401', done => {
          request(app)
            .post('/team')
            .send({
              organizationId: organization.id,
              name: 'Cree Translation Team'
            })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${unauthorizedToken}`)
            .expect('Content-Type', /json/)
            .expect(401)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.message).toEqual('Unauthorized: Invalid token');

              done();
            });
        });

        it('does not add a new record to the database', done => {
          models.Team.findAll().then(results => {
            expect(results.length).toEqual(1);

            request(app)
              .post('/team')
              .send({
                organizationId: organization.id,
                name: 'Cree Translation Team'
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${unauthorizedToken}`)
              .expect('Content-Type', /json/)
              .expect(401)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                models.Team.findAll().then(results => {
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

      describe('update', () => {
        describe('PUT', () => {
          it('returns 403', done => {
            request(app)
              .put('/team')
              .send({
                id: team.id,
                name: 'Mark Cree Translation'
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${unauthorizedToken}`)
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(res.body.message).toEqual('Unauthorized: Invalid token');
                done();
              });
          });

          it('does not change the record in the database', done => {
            request(app)
              .put('/team')
              .send({
                id: team.id,
                name: 'Mark Cree Translation'
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${unauthorizedToken}`)
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                models.Team.findOne({ where: { id: team.id }}).then(results => {
                  expect(results.name).toEqual(team.name);
                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
          });

          it('does not allow a team member to update an existing record in the database', done => {
            const memberToken = jwt.sign({ ..._access, sub: 'auth0|888888' }, prv, { algorithm: 'RS256', expiresIn: '1h', header: { kid: keystore.all()[0].kid } });

            let memberAgent = new models.Agent({ email: 'member-agent@example.com', accessToken: `Bearer ${memberToken}` });
            memberAgent.save().then(results => {
              memberAgent.addTeam(team).then(results => {
                request(app)
                  .put('/team')
                  .send({
                    id: team.id,
                    name: 'Tsuutina Mark Translation'
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${memberToken}`)
                  .expect('Content-Type', /json/)
                  .expect(403)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.message).toEqual('Unauthorized: Invalid token');

                    models.Team.findOne({ where: { id: team.id }}).then(results => {
                      expect(results.name).toEqual(team.name);
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
        });

        describe('PATCH', () => {
          it('returns 403', done => {
            request(app)
              .patch('/team')
              .send({
                id: team.id,
                memberId: 333
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${unauthorizedToken}`)
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(res.body.message).toEqual('You are not a member of this team');
                done();
              });
          });

          it('does not change the record in the database', done => {
            request(app)
              .patch('/team')
              .send({
                id: team.id,
                memberId: 333
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${unauthorizedToken}`)
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                models.Team.findOne({ where: { id: team.id }, include: ['members'] }).then(results => {
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
          request(app)
            .get(`/team/${team.id}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${unauthorizedToken}`)
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.message).toEqual('You are not a member of that team');
              done();
            });
        });
      });

      describe('delete', () => {
        it('returns 403', done => {
          request(app)
            .delete(`/team/${team.id}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${unauthorizedToken}`)
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.message).toEqual('Unauthorized: Invalid token');
              done();
            });
        });

        it('does not remove the record from the database', done => {
          models.Team.findAll().then(results => {
            expect(results.length).toEqual(1);

            request(app)
              .delete(`/team/${team.id}`)
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${unauthorizedToken}`)
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                models.Team.findAll().then(results => {
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
    it('returns 401 if provided an expired token', done => {
      const expiredToken = jwt.sign({ ..._access, iat: Math.floor(Date.now() / 1000) - (60 * 60) }, prv, { algorithm: 'RS256', expiresIn: '1h', header: { kid: keystore.all()[0].kid } });
      request(app)
        .get('/team')
        .send({ token: expiredToken })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect('Content-Type', /json/)
        .expect(401)
        .end(function(err, res) {
          if (err) done.fail(err);
          scope.done();
          expect(res.body.message).toEqual('jwt expired');
          done();
        });
    });

    it('returns 401 if provided no token', done => {
      request(app)
        .get('/team')
        .send({})
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401)
        .end(function(err, res) {
          if (err) done.fail(err);
          scope.done();
          expect(res.body.message).toEqual('No authorization token was found');
          done();
        });
    });
  });
});
