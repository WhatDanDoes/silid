'use strict';
const fixtures = require('sequelize-fixtures');

describe('TeamMember', () => {
  const db = require('../../models');
  const Member = db.TeamMember;

  let member, creator, agent, org, team;
  const _valid = {};

  beforeEach(done => {
    db.sequelize.sync({force: true}).then(() => {
      fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, db).then(() => {
        // Load agents
        db.Agent.findAll().then(results => {
          creator = results[0];
          fixtures.loadFile(`${__dirname}/../fixtures/organizations.json`, db).then(() => {
            // Load organizations
            db.Organization.findAll().then(results => {
              org = results[0];
              // Load teams
              fixtures.loadFile(`${__dirname}/../fixtures/teams.json`, db).then(() => {
                db.Team.findAll().then(results => {
                  team = results[0];
      
                  // Create a new agent to test membership
                  db.Agent.create({ email: 'member@example.com' }).then(results => {
                    agent = results;
    
                    _valid.AgentId = agent.id;
                    _valid.TeamId = team.id;
         
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

  describe('default values', () => {
    describe('verificationCode', () => {
      it('does not set verificationCode for creator agent', done => {
        expect(team.creatorId).toEqual(creator.id);

        Member.findAll().then(m => {
          expect(m.length).toEqual(1);
          expect(m[0].AgentId).toEqual(creator.id);
          expect(m[0].TeamId).toEqual(team.id);
          expect(m[0].verificationCode).toBe(null);
          done();
        }).catch(err => {
          done.fail(err);
        });
      });

      it('sets the membership verification code', () => {
        member = new Member({ AgentId: agent.id, TeamId: team.id });
        expect(typeof member.verificationCode).toEqual('string');
      });
    });
  });

  describe('basic validation', () => {
    it('sets the createdAt and updatedAt fields', done => {
      member = new Member(_valid);
      expect(member.createdAt).toBe(undefined);
      expect(member.updatedAt).toBe(undefined);
      member.save().then(obj => {
        expect(agent.createdAt instanceof Date).toBe(true);
        expect(agent.updatedAt instanceof Date).toBe(true);
        done();
      }).catch(err => {
        done.fail(err);
      });
    });

    it('requires an AgentId', done => {
      _valid.AgentId = undefined;
      member = new Member(_valid);
      member.save().then(obj => {
        done.fail('This shouldn\'t save');
      }).catch(err => {
        expect(err.name).toEqual('SequelizeDatabaseError');
        expect(err.message).toEqual('null value in column "AgentId" violates not-null constraint');
        done();
      });
    });

    it('requires an TeamId', done => {
      _valid.TeamId = undefined;
      member = new Member(_valid);
      member.save().then(obj => {
        done.fail('This shouldn\'t save');
      }).catch(err => {
        expect(err.name).toEqual('SequelizeDatabaseError');
        expect(err.message).toEqual('null value in column "TeamId" violates not-null constraint');
        done();
      });
    });
  });

  describe('#verify', () => {
    beforeEach(done => {
      member = new Member(_valid);
      member.save().then(obj => {
        done();
      }).catch(err => {
        done.fail(err);
      });   
    });

    it('sets the verificationCode to null', done => {
      expect(member.verificationCode).toBeDefined();
      member.verify().then(m => {
        expect(m.verificationCode).toBe(null);
        Member.findOne({ where: { AgentId: member.AgentId } }).then(m => {
          expect(m.AgentId).toEqual(member.AgentId);
          expect(m.TeamId).toEqual(member.TeamId);
          expect(m.verificationCode).toBe(null);
          done();
        }).catch(err => {
          done.fail(err);
        });
      }).catch(err => {
        done.fail(err);
      });     
    });
  });
});
