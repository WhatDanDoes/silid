'use strict';
const fixtures = require('sequelize-fixtures');

describe('Agent', () => {
  const db = require('../../models');
  const Agent = db.Agent;

  let agent;

  const _valid = {};
  beforeEach(done => {
    db.sequelize.sync({force: true}).then(() => {
      _valid.name = 'Some Guy';
      _valid.email = 'someguy@example.com';
  
      agent = new Agent(_valid);

      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  describe('basic validation', () => {
    it('sets the createdAt and updatedAt fields', done => {
      expect(agent.createdAt).toBe(undefined);
      expect(agent.updatedAt).toBe(undefined);
      agent.save().then(obj => {
        expect(agent.createdAt instanceof Date).toBe(true);
        expect(agent.updatedAt instanceof Date).toBe(true);
        done();
      }).catch(err => {
        done.fail(err);
      });
    });

    describe('email', () => {
      it('requires an email', done => {
        delete _valid.email;
        agent = new Agent(_valid);
        agent.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Agent requires an email');
          done();
        });
      });

      it('does not allow blanks', done => {
        _valid.email = '   ';
        agent = new Agent(_valid);
        agent.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Agent requires a valid email');
          done();
        });
      });

      it('does not allow empty', done => {
        _valid.email = '';
        agent = new Agent(_valid);
        agent.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Agent requires a valid email');
          done();
        });
      });

      it('does not allow invalid emails', done => {
        _valid.email = 'This is obviously not an email';
        agent = new Agent(_valid);
        agent.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Agent requires a valid email');
          done();
        });
      });

      it('does not allow duplicate emails', done => {
        agent.save().then(obj => {
          expect(obj.email).toEqual(_valid.email);
          let newAgent = new Agent(_valid);
          newAgent.save().then(obj => {
            done.fail('This shouldn\'t have saved');
          }).catch(err => {
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].message).toEqual('That agent is already registered');
            done();
          });
        }).catch(err => {
          done.fail(err);
        });
      });
    });

    describe('socialProfile', () => {
      beforeEach(() => {
        _valid.socialProfile = { provider: 'Google' };
      });

      it('handles all the stringifying and parsing', function(done) {
        agent = new Agent(_valid);
        agent.save().then(obj => {
          expect(obj.socialProfile).toEqual(_valid.socialProfile);
          done();
        }).catch(err => {
          done.fail(err);
        });
      });
    });
  });

  describe('relationships', () => {
    describe('organizations', () => {
      let org;
      beforeEach(done => {
        agent.save().then(obj => {
          agent = obj;
          fixtures.loadFile(`${__dirname}/../fixtures/organizations.json`, db).then(() => {
            db.Organization.findAll().then(results => {
              org = results[0];
              done();
            });
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('has many', done => {
        agent.addOrganization(org.id).then(result => {
          agent.getOrganizations().then(result => {
            expect(result.length).toEqual(1);
            expect(result[0].name).toEqual(org.name);
            done();
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('removes organization if deleted', done => {
        agent.addOrganization(org.id).then(result => {
          agent.getOrganizations().then(result => {
            expect(result.length).toEqual(1);
            expect(result[0].name).toEqual(org.name);
            org.destroy().then(result => {
              agent.getOrganizations().then(result => {
                expect(result.length).toEqual(0);
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
      });
    });

    describe('teams', () => {
      let newAgent, team;
      beforeEach(done => {
        newAgent = new Agent({ name: 'Some Radical Dude', email: 'thedude@example.com' });
        newAgent.save().then(result => {
          fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, db).then(() => {
            fixtures.loadFile(`${__dirname}/../fixtures/organizations.json`, db).then(() => {
              fixtures.loadFile(`${__dirname}/../fixtures/teams.json`, db).then(() => {
                db.Team.findAll().then(results => {
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
      });

      it('has many', done => {
        newAgent.addTeam(team.id).then(result => {
          newAgent.getTeams().then(result => {
            expect(result.length).toEqual(1);
            expect(result[0].name).toEqual(team.name);
            done();
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('removes team if deleted', done => {
        newAgent.addTeam(team.id).then(result => {
          newAgent.getTeams().then(result => {
            expect(result.length).toEqual(1);
            expect(result[0].name).toEqual(team.name);
            team.destroy().then(result => {
              newAgent.getTeams().then(result => {
                expect(result.length).toEqual(0);
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
      });
    });
  });
});
