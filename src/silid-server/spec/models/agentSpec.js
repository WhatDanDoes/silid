'use strict';

require('../../app'); // Just so .env vars are loaded
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

      it('converts emails to lowercase', done => {
        _valid.email = 'SomeGuy@Example.Com';
        agent = new Agent(_valid);
        agent.save().then(obj => {
          expect(obj.email).toEqual('someguy@example.com');
          done();
        }).catch(err => {
          done.fail(err);
        });
      });

      it('does not allow an email to be changed to uppercase', done => {
        _valid.email = 'SomeGuy@Example.Com';
        agent = new Agent(_valid);
        agent.save().then(obj => {
          expect(obj.email).toEqual('someguy@example.com');
          expect(agent.email).toEqual('someguy@example.com');
          obj.email = 'SOMEGUY@EXAMPLE.COM';
          obj.save().then(obj => {
            expect(obj.email).toEqual('someguy@example.com');
            obj.email = 'SOMEGUY@EXAMPLE.COM';
            obj.update().then(obj => {
              expect(obj.email).toEqual('someguy@example.com');
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

  describe('virtuals', () => {
    describe('isSuper', () => {
      it('returns true if ROOT_AGENT is set in .env', done => {
        Agent.create({ email: process.env.ROOT_AGENT }).then(agent => {
          expect(agent.isSuper).toBe(true);
          done();
        }).catch(err => {
          done.fail(err);
        });
      });

      it('returns false if agent email doesn\'t match ROOT_AGENT', done => {
        agent.save().then(agent => {
          expect(agent.isSuper).toBe(false);
          done();
        }).catch(err => {
          done.fail(err);
        });
      });
    });
  });
});
