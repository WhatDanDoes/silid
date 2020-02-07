'use strict';
const fixtures = require('sequelize-fixtures');

describe('Team', () => {
  const db = require('../../models');
  const Team = db.Team;

  let team;

  const _valid = {};
  beforeEach(done => {
    db.sequelize.sync({force: true}).then(() => {
      fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, db).then(() => {
        fixtures.loadFile(`${__dirname}/../fixtures/organizations.json`, db).then(() => {
          db.Agent.findAll().then(results => {
            let agent = results[0];
            db.Organization.findAll().then(results => {
              let org = results[0];

              _valid.name = 'Codename: Mario';
              _valid.organizationId = org.id;
              _valid.creatorId = agent.id;

              team = new Team(_valid);

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

  describe('basic validation', () => {
    it('sets the createdAt and updatedAt fields', done => {
      expect(team.createdAt).toBe(undefined);
      expect(team.updatedAt).toBe(undefined);
      team.save().then(obj => {
        expect(team.createdAt instanceof Date).toBe(true);
        expect(team.updatedAt instanceof Date).toBe(true);
        done();
      }).catch(err => {
        done.fail(err);
      });
    });

    describe('creator', () => {
      it('includes creator agent as a member', done => {
        team = new Team(_valid);
        team.save().then(obj => {
          obj.getMembers().then(members => {
            expect(members.length).toEqual(1);
            obj.getCreator().then(creator => {
              expect(members[0].id).toEqual(creator.id);
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

      it('requires a creator agent', done => {
        delete _valid.creatorId;
        team = new Team(_valid);
        team.save().then(obj => {
          done.fail('This shouldn\'t have saved');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Team.creatorId cannot be null');
          done();
        });
      });

      /**
       * 2019-10-20 https://github.com/sequelize/sequelize/issues/7826
       *
       * Foreign key constraints have wonky errors (cf., Validation Errors)
       */
      it('blank agent not allowed', done => {
        _valid.creatorId = '   ';
        team = new Team(_valid);
        team.save().then(obj => {
          done.fail('This shouldn\'t have saved');
        }).catch(err => {
          expect(err instanceof db.Sequelize.DatabaseError).toBe(true);
          done();
        });
      });

      it('unknown agent not allowed', done => {
        _valid.creatorId = 111;
        team = new Team(_valid);
        team.save().then(obj => {
          done.fail('This shouldn\'t have saved');
        }).catch(err => {
          expect(err instanceof db.Sequelize.ForeignKeyConstraintError).toBe(true);
          done();
        });
      });
    });

    describe('organization', () => {
      it('requires an organization', done => {
        delete _valid.organizationId;
        team = new Team(_valid);
        team.save().then(obj => {
          done.fail('This shouldn\'t haved saved');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Team.organizationId cannot be null');
          done();
        });
      });

      /**
       * 2019-10-20 https://github.com/sequelize/sequelize/issues/7826
       *
       * Foreign key constraints have wonky errors (cf., Validation Errors)
       */
      it('blank organization not allowed', done => {
        _valid.organizationId = '   ';
        team = new Team(_valid);
        team.save().then(obj => {
          done.fail('This shouldn\'t haved saved');
        }).catch(err => {
          expect(err instanceof db.Sequelize.DatabaseError).toBe(true);
          done();
        });
      });

      it('unknown organization not allowed', done => {
        _valid.organizationId = 111;
        team = new Team(_valid);
        team.save().then(obj => {
          done.fail('This shouldn\'t haved saved');
        }).catch(err => {
          expect(err instanceof db.Sequelize.ForeignKeyConstraintError).toBe(true);
          done();
        });
      });

      it('includes creator organization in membership', done => {
        team = new Team(_valid);
        team.save().then(obj => {
          obj.getOrganizations().then(orgs => {
            expect(orgs.length).toEqual(1);
            obj.getOrganization().then(creator => {
              expect(orgs[0].id).toEqual(creator.id);
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
    });

    describe('name', () => {
      it('requires a name', done => {
        delete _valid.name;
        team = new Team(_valid);
        team.save().then(obj => {
          done.fail('This shouldn\'t haved saved');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Team requires a name');
          done();
        });
      });

      it('blank not allowed', done => {
        _valid.name = '   ';
        team = new Team(_valid);
        team.save().then(obj => {
          done.fail('This shouldn\'t haved saved');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Team requires a name');
          done();
        });
      });

      it('empty not allowed', done => {
        _valid.name = '';
        team = new Team(_valid);
        team.save().then(obj => {
          done.fail('This shouldn\'t haved saved');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Team requires a name');
          done();
        });
      });

      it('does not allow duplicate names', done => {
        team.save().then(obj => {
          expect(obj.name).toEqual(_valid.name);
          let newTeam = new Team(_valid);
          newTeam.save().then(obj => {
            done.fail('This shouldn\'t have saved');
          }).catch(err => {
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].message).toEqual('That team is already registered');
            done();
          });
        }).catch(err => {
          done.fail(err);
        });
      });
    });
  });

  describe('relationships', () => {

    describe('agents', () => {
      let agent;
      beforeEach(done => {
        team.save().then(result => {
          fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, db).then(() => {
            db.Agent.findAll().then(results => {
              agent = results[0];
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
        team.addMember(agent.id).then(result => {
          team.getMembers().then(result => {
            expect(result.length).toEqual(1);
            expect(result[0].name).toEqual(agent.name);
            done();
          }).catch(err => {
            done.fail(err);
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('removes agent if deleted', done => {
        team.addMember(agent.id).then(result => {
          team.getMembers().then(result => {
            expect(result.length).toEqual(1);
            expect(result[0].name).toEqual(agent.name);
            agent.destroy().then(result => {
              team.getMembers().then(result => {
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

    describe('organizations', () => {
      let org;
      beforeEach(done => {
        team.save().then(obj => {
          fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, db).then(() => {
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
        }).catch(err => {
          done.fail(err);
        });
      });

      it('has many', done => {
        team.addOrganization(org.id).then(result => {
          team.getOrganizations().then(result => {
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
        team.addOrganization(org.id).then(result => {
          team.getOrganizations().then(result => {
            expect(result.length).toEqual(1);
            expect(result[0].name).toEqual(org.name);
            org.destroy().then(result => {
              team.getOrganizations().then(result => {
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
