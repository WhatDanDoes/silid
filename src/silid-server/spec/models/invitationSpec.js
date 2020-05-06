'use strict';

require('../../app'); // Just so .env vars are loaded
const fixtures = require('sequelize-fixtures');
const uuid = require('uuid');

describe('Invitation', () => {
  const db = require('../../models');
  const Invitation = db.Invitation;

  let invitation;

  const _valid = {};
  beforeEach(done => {
    db.sequelize.sync({force: true}).then(() => {
      _valid.name = 'The Calgary Roughnecks';
      _valid.type = 'team';
      _valid.uuid = uuid.v4();
      _valid.recipient = 'someguy@example.com';

      invitation = new Invitation(_valid);

      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  describe('basic validation', () => {
    it('sets the createdAt and updatedAt fields', done => {
      expect(invitation.createdAt).toBe(undefined);
      expect(invitation.updatedAt).toBe(undefined);
      invitation.save().then(obj => {
        expect(invitation.createdAt instanceof Date).toBe(true);
        expect(invitation.updatedAt instanceof Date).toBe(true);
        done();
      }).catch(err => {
        done.fail(err);
      });
    });

    describe('recipient', () => {
      it('requires a recipient email', done => {
        delete _valid.recipient;
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Invitation requires a recipient');
          done();
        });
      });

      it('does not allow blanks', done => {
        _valid.recipient = '   ';
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Invitation requires a valid email for the recipient');
          done();
        });
      });

      it('does not allow empty', done => {
        _valid.recipient = '';
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Invitation requires a valid email for the recipient');
          done();
        });
      });

      it('does not allow invalid emails', done => {
        _valid.recipient = 'This is obviously not an email';
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Invitation requires a valid email for the recipient');
          done();
        });
      });
    });

    describe('name', () => {
      it('requires a name', done => {
        delete _valid.name;
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Invitation requires a name');
          done();
        });
      });

      it('does not allow blanks', done => {
        _valid.name = '   ';
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Invitation requires a name');
          done();
        });
      });

      it('does not allow empty', done => {
        _valid.name = '';
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Invitation requires a name');
          done();
        });
      });
    });

    describe('uuid', () => {
      it('requires a uuid', done => {
        delete _valid.uuid;
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Invitation requires a uuid');
          done();
        });
      });

      it('does not allow blanks', done => {
        _valid.uuid = '   ';
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Invitation requires a valid version 4 uuid');
          done();
        });
      });

      it('does not allow empty', done => {
        _valid.uuid = '';
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Invitation requires a valid version 4 uuid');
          done();
        });
      });

      it('does not allow invalid uuids', done => {
        _valid.uuid = 'This is obviously not a uuid';
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Invitation requires a valid version 4 uuid');
          done();
        });
      });

      it('only allows uuidv4', done => {
        _valid.uuid = uuid.v1();
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Invitation requires a valid version 4 uuid');
          done();
        });
      });
    });

    describe('type', () => {
      it('requires a type', done => {
        delete _valid.type;
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Invitation requires a type');
          done();
        });
      });

      it('does not allow blanks', done => {
        _valid.type = '   ';
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Invitation type can be one of either \'team\' or \'organization\'');
          done();
        });
      });

      it('does not allow empty', done => {
        _valid.type = '';
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Invitation type can be one of either \'team\' or \'organization\'');
          done();
        });
      });

      describe('enumerated', () => {
        it('allows the \'team\' type', done => {
          _valid.type = 'team';
          invitation = new Invitation(_valid);
          invitation.save().then(obj => {
            expect(obj.id).toBeDefined();
            done();
          }).catch(err => {
            done.fail(err);
          });
        });

        it('allows the \'organization\' type', done => {
          _valid.type = 'organization';
          invitation = new Invitation(_valid);
          invitation.save().then(obj => {
            expect(obj.id).toBeDefined();
            done();
          }).catch(err => {
            done.fail(err);
          });
        });

        it('only allows the types enumerated', done => {
          _valid.type = 'partaaaaay!';
          invitation = new Invitation(_valid);
          invitation.save().then(obj => {
            done.fail('This shouldn\'t save');
          }).catch(err => {
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].message).toEqual('Invitation type can be one of either \'team\' or \'organization\'');
            done();
          });
        });
      });
    });

    describe('uniqueness', () => {
      it('does not allow duplicate recipient/uuid combinations', done => {
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          expect(obj.id).toBeDefined();

          let duplicateInvite = new Invitation(_valid);
          duplicateInvite.save().then(obj => {
            done.fail('This shouldn\'t save');
          }).catch(err => {
            expect(err.errors.length).toEqual(2);
            expect(err.errors[0].message).toEqual('recipient must be unique');
            expect(err.errors[1].message).toEqual('uuid must be unique');
            done();
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('allows reusing a uuid', done => {
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          expect(obj.id).toBeDefined();

          _valid.recipient = 'newteammember@example.com';
          let newInvite = new Invitation(_valid);
          newInvite.save().then(obj => {
            expect(obj.id).toBeDefined();
            done();
          }).catch(err => {
            done.fail(err);
            done();
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('allows reusing an email', done => {
        invitation = new Invitation(_valid);
        invitation.save().then(obj => {
          expect(obj.id).toBeDefined();

          _valid.uuid = uuid.v4();
          let newInvite = new Invitation(_valid);
          newInvite.save().then(obj => {
            expect(obj.id).toBeDefined();
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
});
