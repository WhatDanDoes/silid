'use strict';
const fixtures = require('sequelize-fixtures');

describe('Organization', () => {
  const models = require('../../models');
  const Organization = models.Organization;

  let organization;

  const _valid = {};
  beforeEach(done => {
    models.sequelize.sync({force: true}).then(() => {
      fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, models).then(() => {
        models.Agent.findAll().then(result => {
          _valid.name = 'Chill Bill International';
          _valid.creatorId = result[0].id;

          organization = new Organization(_valid);

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

  describe('basic validation', () => {
    it('sets the createdAt and updatedAt fields', done => {
      expect(organization.createdAt).toBe(undefined);
      expect(organization.updatedAt).toBe(undefined);
      organization.save().then(obj => {
        expect(organization.createdAt instanceof Date).toBe(true);
        expect(organization.updatedAt instanceof Date).toBe(true);
        done();
      }).catch(err => {
        done.fail(err);
      });
    });

    describe('creator', () => {
      it('includes creator agent as a member', done => {
        organization = new Organization(_valid);
        organization.save().then(obj => {
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
        organization = new Organization(_valid);
        organization.save().then(obj => {
          done.fail('This shouldn\'t have saved');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Organization.creatorId cannot be null');
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
        organization = new Organization(_valid);
        organization.save().then(obj => {
          done.fail('This shouldn\'t have saved');
        }).catch(err => {
          expect(err instanceof models.Sequelize.DatabaseError).toBe(true);
          done();
        });
      });

      it('unknown agent not allowed', done => {
        _valid.creatorId = 111;
        organization = new Organization(_valid);
        organization.save().then(obj => {
          done.fail('This shouldn\'t have saved');
        }).catch(err => {
          expect(err instanceof models.Sequelize.ForeignKeyConstraintError).toBe(true);
          done();
        });
      });
    });

    describe('name', () => {
      it('requires a name', done => {
        delete _valid.name;
        organization = new Organization(_valid);
        organization.save().then(obj => {
          done.fail('This shouldn\'t have saved');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Organization requires a name');
          done();
        });
      });

      it('blank not allowed', done => {
        _valid.name = '   ';
        organization = new Organization(_valid);
        organization.save().then(obj => {
          done.fail('This shouldn\'t have saved');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Organization requires a name');
          done();
        });
      });

      it('empty not allowed', done => {
        _valid.name = '';
        organization = new Organization(_valid);
        organization.save().then(obj => {
          done.fail('This shouldn\'t have saved');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Organization requires a name');
          done();
        });
      });

      it('does not allow duplicate names', done => {
        organization.save().then(obj => {
          expect(obj.name).toEqual(_valid.name);
          let newOrganization = new Organization(_valid);
          newOrganization.save().then(obj => {
            done.fail('This shouldn\'t have saved');
          }).catch(err => {
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].message).toEqual('That organization is already registered');
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
      let agent, org;
      beforeEach(done => {
        organization.save().then(obj => {
          org = obj;
          fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, models).then(() => {
            models.Agent.findAll().then(results => {
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
        models.Agent.create({ name: 'Some Other Guy', email: 'someotherguy@example.com' }).then(newAgent => {
          org.addMember(newAgent).then(result => {
            org.getMembers().then(result => {
              expect(result.length).toEqual(2);
              expect(result[0].id).toEqual(agent.id);
              expect(result[1].id).toEqual(newAgent.id);
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

      it('does not allow duplicate membership', done => {
        models.Agent.create({ name: 'Some Other Guy', email: 'someotherguy@example.com' }).then(newAgent => {
          org.addMember(newAgent).then(result => {
            org.getMembers().then(result => {
              expect(result.length).toEqual(2);
              expect(result[0].id).toEqual(agent.id);
              expect(result[1].id).toEqual(newAgent.id);
              org.addMember(newAgent).then(result => {
                org.getMembers().then(result => {
                  expect(result.length).toEqual(2);
                  expect(result[0].id).toEqual(agent.id);
                  expect(result[1].id).toEqual(newAgent.id);
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


      it('removes agent if deleted', done => {
        org.addMember(agent.id).then(result => {
          org.getMembers().then(result => {
            expect(result.length).toEqual(1);
            expect(result[0].name).toEqual(agent.name);
            agent.destroy().then(result => {
              org.getMembers().then(result => {
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
      let team, org;
      beforeEach(done => {
        organization.save().then(result => {
          org = result;
          fixtures.loadFile(`${__dirname}/../fixtures/teams.json`, models).then(() => {
            models.Team.findAll().then(results => {
              team = results[0];
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
        org.addTeam(team.id).then(result => {
          org.getTeams().then(result => {
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

      it('does not allow duplicated team membership', done => {
        org.addTeam(team.id).then(result => {
          org.getTeams().then(result => {
            expect(result.length).toEqual(1);
            expect(result[0].name).toEqual(team.name);
            org.addTeam(team.id).then(result => {
              org.getTeams().then(result => {
                expect(result.length).toEqual(1);
                expect(result[0].name).toEqual(team.name);
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


      it('removes team if deleted', done => {
        org.addTeam(team.id).then(result => {
          org.getTeams().then(result => {
            expect(result.length).toEqual(1);
            expect(result[0].name).toEqual(team.name);
            team.destroy().then(result => {
              org.getTeams().then(result => {
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
