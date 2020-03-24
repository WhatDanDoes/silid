const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const mailer = require('../../mailer');
const scope = require('../../config/permissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../fixtures/sample-auth0-identity-token');

describe('teamSpec', () => {

  let login, pub, prv, keystore;
  beforeAll(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  let team, organization, agent;
  beforeEach(done => {
    models.sequelize.sync({force: true}).then(() => {
      fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, models).then(() => {
        fixtures.loadFile(`${__dirname}/../fixtures/organizations.json`, models).then(() => {
          fixtures.loadFile(`${__dirname}/../fixtures/teams.json`, models).then(() => {
            models.Agent.findAll().then(results => {
              agent = results[0];
              models.Organization.findAll().then(results => {
                organization = results[0];
                models.Team.findAll().then(results => {
                  team = results[0];
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
  });

  describe('authenticated', () => {

    describe('authorized', () => {

      describe('create', () => {

        let authenticatedSession;
        beforeEach(done => {
          login(_identity, [scope.create.teams], (err, session) => {
            if (err) return done.fail(err);
            authenticatedSession = session;
            done();
          });
        });

        it('returns an error if record already exists', done => {
          authenticatedSession
            .post('/team')
            .send({
              organizationId: organization.id,
              name: team.name
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('That team is already registered');
              done();
            });
        });

        it('returns an error if empty team name provided', done => {
          authenticatedSession
            .post('/team')
            .send({
              organizationId: organization.id,
              name: '   '
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(500)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('Team requires a name');
              done();
            });
        });

        it('returns an error if no team name provided', done => {
          authenticatedSession
            .post('/team')
            .send({
              organizationId: organization.id,
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(500)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('Team requires a name');
              done();
            });
        });

        it('returns an error if organization doesn\'t exist', done => {
          authenticatedSession
            .post('/team')
            .send({
              organizationId: 333,
              name: team.name
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('That organization doesn\'t exist');
              done();
            });
        });

        it('returns an error if no organization provided', done => {
          authenticatedSession
            .post('/team')
            .send({
              name: team.name
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('No organization provided');
              done();
            });
        });

        describe('organization creator', () => {

          let orgCreatorSession;
          beforeEach(done => {
            organization.getCreator().then(creator => {
              expect(creator.email).toEqual(agent.email);
              login(_identity, [scope.create.teams], (err, session) => {
                if (err) return done.fail(err);
                orgCreatorSession = session;
                done();
              });
            }).catch(err => {
              done.fail(err);
            });
          });

          it('allows organization creator to add a new record to the database', done => {
            models.Team.findAll().then(results => {
              expect(results.length).toEqual(1);
              orgCreatorSession
                .post('/team')
                .send({
                  organizationId: organization.id,
                  name: 'Tsuutina Translation'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);
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

          it('credits organization creator as team creator', done => {
            orgCreatorSession
              .post('/team')
              .send({
                organizationId: organization.id,
                name: 'Tsuutina Translation'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.creatorId).toEqual(agent.id);
                done();
              });
          });
        });

        describe('organization member', () => {
          let memberAgent, memberSession;
          beforeEach(done => {
            memberAgent = new models.Agent({ email: 'member-agent@example.com' });
            memberAgent.save().then(results => {
              memberAgent.addOrganization(organization).then(results => {
                login({ ..._identity, email: memberAgent.email, name: 'Some Member Agent' }, [scope.create.teams], (err, session) => {
                  if (err) return done.fail(err);
                  memberSession = session;
                  done();
                });
              }).catch(err => {
                done.fail(err);
              });
            }).catch(err => {
              done.fail(err);
            });
          });

          it('allows organization member to add a new team to the database', done => {
            models.Team.findAll().then(results => {
              expect(results.length).toEqual(1);
              memberSession
                .post('/team')
                .send({
                  organizationId: organization.id,
                  name: 'Tsuutina Translation'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

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
            memberSession
              .post('/team')
              .send({
                organizationId: organization.id,
                name: 'Tsuutina Translation'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.creatorId).toEqual(memberAgent.id);
                done();
              });
          });
        });
      });

      describe('read', () => {

        let authenticatedSession;
        beforeEach(done => {
          login(_identity, [scope.read.teams], (err, session) => {
            if (err) return done.fail(err);
            authenticatedSession = session;
            done();
          });
        });

        it('retrieves an existing record from the database', done => {
          authenticatedSession
            .get(`/team/${team.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.name).toEqual(team.name);
              done();
            });
        });

        it('doesn\'t barf if record doesn\'t exist', done => {
          authenticatedSession
            .get('/team/33')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('No such team');
              done();
            });
        });

        it('retrieves all team memberships for the agent', done => {
          agent.getTeams().then(results => {
            expect(results.length).toEqual(1);
            authenticatedSession
              .get(`/team`)
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

        it('retrieves all teams created by the agent in addition to memberships', done => {
          agent.getTeams().then(results => {
            expect(results.length).toEqual(1);

            models.Team.create({ name: 'Alpha Squadron',
                                 creatorId: agent.id,
                                 organizationId: organization.id }).then(res => {

              authenticatedSession
                .get(`/team`)
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

        it('populates the team creator field', done => {
          authenticatedSession
            .get(`/team/${team.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.creator).toBeDefined();
              expect(res.body.creator.email).toEqual(agent.email);
              done();
            });
        });

        it('populates the owner organization', done => {
          authenticatedSession
            .get(`/team/${team.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.organization).toBeDefined();
              expect(res.body.organization.id).toEqual(organization.id);
              expect(res.body.organization.name).toEqual(organization.name);
              done();
            });
        });

        it('populates the membership', done => {
          authenticatedSession
            .get(`/team/${team.id}`)
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

        let authenticatedSession;
        beforeEach(done => {
          login(_identity, [scope.update.teams], (err, session) => {
            if (err) return done.fail(err);
            authenticatedSession = session;
            done();
          });
        });

        describe('PUT', () => {
          it('allows an organization creator to update an existing team in the database', done => {
            organization.getCreator().then(creator => {
              expect(creator.email).toEqual(agent.email);
              expect(team.organizationId).toEqual(organization.id);

              login({ ..._identity, email: creator.email, name: 'Some Org Creator' }, [scope.update.teams], (err, session) => {
                if (err) return done.fail(err);

                session
                  .put('/team')
                  .send({
                    id: team.id,
                    name: 'Tsuutina Mark Translation'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.name).toEqual('Tsuutina Mark Translation');

                    models.Team.findOne({ where: { id: team.id }}).then(results => {
                      expect(results.name).toEqual('Tsuutina Mark Translation');
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

          it('allows a team creator to update an existing record in the database', done => {
            let teamMember = new models.Agent({ email: 'member-agent@example.com' });
            teamMember.save().then(results => {
              teamMember.createTeam({ name: 'Omega Team',
                                      organizationId: organization.id,
                                      creatorId: teamMember.id }).then(team => {
                login({ ..._identity, email: teamMember.email, name: 'Some Team Creator' }, [scope.update.teams], (err, session) => {
                  if (err) return done.fail(err);

                  session
                    .put('/team')
                    .send({
                      id: team.id,
                      name: 'Tsuutina Mark Translation'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(res.body.name).toEqual('Tsuutina Mark Translation');

                      models.Team.findOne({ where: { id: team.id }}).then(results => {
                        expect(results.name).toEqual('Tsuutina Mark Translation');
                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
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
            authenticatedSession
              .put('/team')
              .send({
                id: 111,
                name: 'Tsuutina Mark Translation'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
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
                authenticatedSession
                  .patch('/team')
                  .send({
                    id: team.id,
                    memberId: anotherAgent.id
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('Update successful');

                    models.Team.findOne({ where: { id: team.id }, include: ['members'] }).then(results => {
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
                  .patch('/team')
                  .send({
                    id: team.id,
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
                    expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
                    done();
                  });
              });

              it('removes a member agent when agent provided is currently a member', done => {
                team.addMember(anotherAgent).then(result => {
                  authenticatedSession
                    .patch('/team')
                    .send({
                      id: team.id,
                      memberId: anotherAgent.id
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
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
                  authenticatedSession
                    .patch('/team')
                    .send({
                      id: team.id,
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
                      expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${team.name}`);
                      done();
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });

              it('doesn\'t barf if member agent doesn\'t exist', done => {
                authenticatedSession
                  .patch('/team')
                  .send({
                    id: team.id,
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
                  .patch('/team')
                  .send({
                    id: team.id,
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

              it('doesn\'t barf if team doesn\'t exist', done => {
                authenticatedSession
                  .patch('/team')
                  .send({
                    id: 111,
                    memberId: anotherAgent.id
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

              it('doesn\'t send an email if team doesn\'t exist', done => {
                expect(mailer.transport.sentMail.length).toEqual(0);
                authenticatedSession
                  .patch('/team')
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
                login({ ..._identity, email: anotherAgent.email, name: 'Another Guy' }, [scope.update.teams], (err, session) => {
                  session
                    .patch('/team')
                    .send({
                      id: team.id,
                      memberId: anotherAgent.id
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(403)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(res.body.message).toEqual('You are not a member of this team');
                      done();
                    });
                });
              });
            });

            describe('updated via email', () => {
              it('adds a member agent when agent provided isn\'t currently a member', done => {
                authenticatedSession
                  .patch('/team')
                  .send({
                    id: team.id,
                    email: anotherAgent.email
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('Update successful');

                    models.Team.findOne({ where: { id: team.id }, include: ['members'] }).then(results => {
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
                  .patch('/team')
                  .send({
                    id: team.id,
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
                    expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
                    done();
                  });
              });

              it('removes a member agent when agent provided is currently a member', done => {
                team.addMember(anotherAgent).then(result => {
                  authenticatedSession
                    .patch('/team')
                    .send({
                      id: team.id,
                      email: anotherAgent.email
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
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
                  authenticatedSession
                    .patch('/team')
                    .send({
                      id: team.id,
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
                      expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${team.name}`);
                      done();
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });

              it('adds record if member agent doesn\'t exist', done => {
                authenticatedSession
                  .patch('/team')
                  .send({
                    id: team.id,
                    email: 'someunknownagent@example.com'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
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
                authenticatedSession
                  .patch('/team')
                  .send({
                    id: team.id,
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
                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                    expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
                    done();
                  });
              });

              it('doesn\'t barf if team doesn\'t exist', done => {
                authenticatedSession
                  .patch('/team')
                  .send({
                    id: 111,
                    email: anotherAgent.email
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

              it('doesn\'t allow a non-member agent to add a member', done => {
                login({ ..._identity, email: anotherAgent.email, name: 'Some Other Guy' }, [scope.update.teams], (err, session) => {
                  if (err) return done.fail(err);

                  session
                    .patch('/team')
                    .send({
                      id: team.id,
                      email: anotherAgent.email
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(403)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(res.body.message).toEqual('You are not a member of this team');
                      done();
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
          login(_identity, [scope.delete.teams], (err, session) => {
            if (err) return done.fail(err);
            authenticatedSession = session;
            done();
          });
        });

        it('allows organization creator to remove an existing record from the database', done => {
          organization.getCreator().then(creator => {
            expect(creator.email).toEqual(agent.email);
            expect(team.organizationId).toEqual(organization.id);

            login({ ..._identity, email: creator.email, name: 'Some Other Guy' }, [scope.delete.teams], (err, session) => {
              if (err) return done.fail(err);

              session
                .delete(`/team/${team.id}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('Team deleted');
                  models.Team.findAll().then(results => {
                    expect(results.length).toEqual(0);
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

        it('allows team creator to remove team from the database', done => {
          let teamMember = new models.Agent({ email: 'member-agent@example.com' });
          teamMember.save().then(results => {
            teamMember.createTeam({ name: 'Omega Team',
                                    organizationId: organization.id,
                                    creatorId: teamMember.id }).then(team => {

              team.getCreator().then(creator => {
                expect(creator.email).toEqual(teamMember.email);
                expect(team.organizationId).toEqual(organization.id);

                login({ ..._identity, email: creator.email, name: 'Some Other Guy' }, [scope.delete.teams], (err, session) => {
                  if (err) return done.fail(err);
                  session
                    .delete(`/team/${team.id}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(res.body.message).toEqual('Team deleted');
                      models.Team.findOne({where: {id: team.id}}).then(results => {
                        expect(results).toBe(null);
                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
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
          let memberAgent = new models.Agent({ email: 'member-agent@example.com' });
          memberAgent.save().then(results => {
            memberAgent.addOrganization(organization).then(results => {

              login({ ..._identity, email: memberAgent.email, name: 'Some Member Guy' }, [scope.delete.teams], (err, session) => {
                if (err) return done.fail(err);

                session
                  .delete(`/team/${team.id}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(403)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('Unauthorized');
                    models.Team.findAll().then(results => {
                      expect(results.length).toEqual(1);
                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
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
          let memberAgent = new models.Agent({ email: 'member-agent@example.com' });
          memberAgent.save().then(results => {
            memberAgent.addTeam(team).then(results => {
              login({ ..._identity, email: memberAgent.email, name: 'Some Member Guy' }, [scope.delete.teams], (err, session) => {
                if (err) return done.fail(err);

                session
                  .delete(`/team/${team.id}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(403)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('Unauthorized');
                    models.Team.findAll().then(results => {
                      expect(results.length).toEqual(1);
                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
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
          authenticatedSession
            .delete(`/team/333`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('No such team');
              done();
            });
        });
      });
    });


    describe('not verified', () => {

      let unverifiedSession, unverifiedAgent;
      beforeEach(done => {
        models.Agent.create({ email: 'invitedagent@example.com' }).then(a => {
          unverifiedAgent = a;
          models.TeamMember.create({ AgentId: unverifiedAgent.id, TeamId: team.id }).then(t => {
            login({..._identity, email: a.email}, [scope.read.teams], (err, session) => {
              if (err) return done.fail(err);
              unverifiedSession = session;
              done();
            });
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      describe('read', () => {
        it('returns 403 on team show', done => {
          unverifiedSession
            .get(`/team/${team.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('You have not verified your invitation to this team. Check your email.');
              done();
            });
        });

        describe('agent is also unverified organization member', () => {
          beforeEach(done => {
            models.OrganizationMember.create({ AgentId: unverifiedAgent.id, OrganizationId: organization.id }).then(t => {
              done();
            }).catch(err => {
              done.fail(err);
            });
          });

          it('returns 403 on team show', done => {
            unverifiedSession
              .get(`/team/${team.id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('You have not verified your invitation to this team or its organization. Check your email.');
                done();
              });
          });
        });
      });
    });

    describe('unauthorized', () => {
      let unauthorizedSession, unauthorizedAgent;
      beforeEach(done => {
        models.Agent.create({ email: 'unauthorizedagent@example.com' }).then(a => {
          unauthorizedAgent = a;
          login({ ..._identity, email: unauthorizedAgent.email, name: 'Suspicious GUy' },
              [scope.create.teams, scope.read.teams, scope.update.teams, scope.delete.teams], (err, session) => {
            if (err) return done.fail(err);
            unauthorizedSession = session;
            done();
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      describe('create', () => {
        it('returns 401', done => {
          unauthorizedSession
            .post('/team')
            .send({
              organizationId: organization.id,
              name: 'Cree Translation Team'
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

        it('does not add a new record to the database', done => {
          models.Team.findAll().then(results => {
            expect(results.length).toEqual(1);

            unauthorizedSession
              .post('/team')
              .send({
                organizationId: organization.id,
                name: 'Cree Translation Team'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(401)
              .end(function(err, res) {
                if (err) return done.fail(err);
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
            unauthorizedSession
              .put('/team')
              .send({
                id: team.id,
                name: 'Mark Cree Translation'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('Unauthorized');
                done();
              });
          });

          it('does not change the record in the database', done => {
            unauthorizedSession
              .put('/team')
              .send({
                id: team.id,
                name: 'Mark Cree Translation'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) return done.fail(err);
                models.Team.findOne({ where: { id: team.id }}).then(results => {
                  expect(results.name).toEqual(team.name);
                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
          });

          it('does not allow a team member to update an existing record in the database', done => {
            let memberAgent = new models.Agent({ email: 'member-agent@example.com' });
            memberAgent.save().then(results => {
              memberAgent.addTeam(team).then(results => {
                login({ ..._identity, email: memberAgent.email, name: 'Some Member Guy' }, (err, session) => {
                  if (err) return done.fail(err);

                  session 
                    .put('/team')
                    .send({
                      id: team.id,
                      name: 'Tsuutina Mark Translation'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(403)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(res.body.message).toEqual('Insufficient scope');

                      models.Team.findOne({ where: { id: team.id }}).then(results => {
                        expect(results.name).toEqual(team.name);
                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
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
            unauthorizedSession
              .patch('/team')
              .send({
                id: team.id,
                memberId: 333
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('You are not a member of this team');
                done();
              });
          });

          it('does not change the record in the database', done => {
            unauthorizedSession
              .patch('/team')
              .send({
                id: team.id,
                memberId: 333
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) return done.fail(err);
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
          unauthorizedSession
            .get(`/team/${team.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('You are not a member of that team');
              done();
            });
        });
      });

      describe('delete', () => {
        it('returns 403', done => {
          unauthorizedSession
            .delete(`/team/${team.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('Unauthorized');
              done();
            });
        });

        it('does not remove the record from the database', done => {
          models.Team.findAll().then(results => {
            expect(results.length).toEqual(1);

            unauthorizedSession
              .delete(`/team/${team.id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) return done.fail(err);
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
