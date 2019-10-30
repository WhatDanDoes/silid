'use strict';
const fixtures = require('sequelize-fixtures');

describe('Project', () => {
  const db = require('../../models');
  const Project = db.Project;

  let project;

  const _valid = {};
  beforeEach(done => {
    db.sequelize.sync({force: true}).then(() => {
      _valid.name = 'Codename: Mario';

      project = new Project(_valid);

      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  describe('basic validation', () => {
    it('sets the createdAt and updatedAt fields', done => {
      expect(project.createdAt).toBe(undefined);
      expect(project.updatedAt).toBe(undefined);
      project.save().then(obj => {
        expect(project.createdAt instanceof Date).toBe(true);
        expect(project.updatedAt instanceof Date).toBe(true);
        done();
      }).catch(err => {
        done.fail(err);
      });
    });

    describe('name', () => {
      it('requires a name', done => {
        delete _valid.name;
        project = new Project(_valid);
        project.save().then(obj => {
          done.fail('This shouldn\'t haved saved');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Project requires a name');
          done();
        });
      });

      it('blank not allowed', done => {
        _valid.name = '   ';
        project = new Project(_valid);
        project.save().then(obj => {
          done.fail('This shouldn\'t haved saved');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Project requires a name');
          done();
        });
      });

      it('does not allow duplicate names', done => {
        project.save().then(obj => {
          expect(obj.name).toEqual(_valid.name);
          let newProject = new Project(_valid);
          newProject.save().then(obj => {
            done.fail('This shouldn\'t have saved');
          }).catch(err => {
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].message).toEqual('That project is already registered');
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
        project.save().then(result => {
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
        project.addAgent(agent.id).then(result => {
          project.getAgents().then(result => {
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
        project.addAgent(agent.id).then(result => {
          project.getAgents().then(result => {
            expect(result.length).toEqual(1);
            expect(result[0].name).toEqual(agent.name);
            agent.destroy().then(result => {
              project.getAgents().then(result => {
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
        project.save().then(obj => {
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
        project.addOrganization(org.id).then(result => {
          project.getOrganizations().then(result => {
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
        project.addOrganization(org.id).then(result => {
          project.getOrganizations().then(result => {
            expect(result.length).toEqual(1);
            expect(result[0].name).toEqual(org.name);
            org.destroy().then(result => {
              project.getOrganizations().then(result => {
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
