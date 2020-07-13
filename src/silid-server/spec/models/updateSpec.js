'use strict';

require('../../app'); // Just so .env vars are loaded
const fixtures = require('sequelize-fixtures');
const uuid = require('uuid');

describe('Update', () => {
  const db = require('../../models');
  const Update = db.Update;

  let update;

  const _valid = {};
  beforeEach(done => {
    db.sequelize.sync({force: true}).then(() => {
      _valid.type = 'team';
      _valid.uuid = uuid.v4();
      _valid.recipient = 'someguy@example.com';
      _valid.data = { name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: _valid.uuid }

      update = new Update(_valid);

      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  describe('basic validation', () => {
    it('sets the createdAt and updatedAt fields', done => {
      expect(update.createdAt).toBe(undefined);
      expect(update.updatedAt).toBe(undefined);
      update.save().then(obj => {
        expect(update.createdAt instanceof Date).toBe(true);
        expect(update.updatedAt instanceof Date).toBe(true);
        done();
      }).catch(err => {
        done.fail(err);
      });
    });

    describe('recipient', () => {
      it('requires a recipient email', done => {
        delete _valid.recipient;
        update = new Update(_valid);
        update.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Update requires a recipient');
          done();
        });
      });

      it('does not allow blanks', done => {
        _valid.recipient = '   ';
        update = new Update(_valid);
        update.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Update requires a valid email for the recipient');
          done();
        });
      });

      it('does not allow empty', done => {
        _valid.recipient = '';
        update = new Update(_valid);
        update.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Update requires a valid email for the recipient');
          done();
        });
      });

      it('does not allow invalid emails', done => {
        _valid.recipient = 'This is obviously not an email';
        update = new Update(_valid);
        update.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Update requires a valid email for the recipient');
          done();
        });
      });

      it('converts email to lowercase', done => {
        _valid.recipient = 'SomeGuy@Example.Com';
        update = new Update(_valid);
        update.save().then(obj => {
          expect(obj.recipient).toEqual('someguy@example.com');
          done();
        }).catch(err => {
          done.fail(err);
        });
      });
    });

//    describe('name', () => {
//      it('requires a name', done => {
//        delete _valid.name;
//        update = new Update(_valid);
//        update.save().then(obj => {
//          done.fail('This shouldn\'t save');
//        }).catch(err => {
//          expect(err.errors.length).toEqual(1);
//          expect(err.errors[0].message).toEqual('Update requires a name');
//          done();
//        });
//      });
//
//      it('does not allow blanks', done => {
//        _valid.name = '   ';
//        update = new Update(_valid);
//        update.save().then(obj => {
//          done.fail('This shouldn\'t save');
//        }).catch(err => {
//          expect(err.errors.length).toEqual(1);
//          expect(err.errors[0].message).toEqual('Update requires a name');
//          done();
//        });
//      });
//
//      it('does not allow empty', done => {
//        _valid.name = '';
//        update = new Update(_valid);
//        update.save().then(obj => {
//          done.fail('This shouldn\'t save');
//        }).catch(err => {
//          expect(err.errors.length).toEqual(1);
//          expect(err.errors[0].message).toEqual('Update requires a name');
//          done();
//        });
//      });
//    });

    describe('uuid', () => {
      it('requires a uuid', done => {
        delete _valid.uuid;
        update = new Update(_valid);
        update.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Update requires a uuid');
          done();
        });
      });

      it('does not allow blanks', done => {
        _valid.uuid = '   ';
        update = new Update(_valid);
        update.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Update requires a valid version 4 uuid');
          done();
        });
      });

      it('does not allow empty', done => {
        _valid.uuid = '';
        update = new Update(_valid);
        update.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Update requires a valid version 4 uuid');
          done();
        });
      });

      it('does not allow invalid uuids', done => {
        _valid.uuid = 'This is obviously not a uuid';
        update = new Update(_valid);
        update.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Update requires a valid version 4 uuid');
          done();
        });
      });

      it('only allows uuidv4', done => {
        _valid.uuid = uuid.v1();
        update = new Update(_valid);
        update.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Update requires a valid version 4 uuid');
          done();
        });
      });
    });

//    describe('teamId', () => {
//      beforeEach(() => {
//        _valid.type = 'organization';
//        _valid.teamId = uuid.v4();
//      });
//
//      it('does not allow blanks', done => {
//        _valid.teamId = '   ';
//        update = new Update(_valid);
//        update.save().then(obj => {
//          done.fail('This shouldn\'t save');
//        }).catch(err => {
//          expect(err.errors.length).toEqual(1);
//          expect(err.errors[0].message).toEqual('Organization update requires a valid version 4 team uuid');
//          done();
//        });
//      });
//
//      it('does not allow empty', done => {
//        _valid.teamId = '';
//        update = new Update(_valid);
//        update.save().then(obj => {
//          done.fail('This shouldn\'t save');
//        }).catch(err => {
//          expect(err.errors.length).toEqual(2);
//          expect(err.errors[0].message).toEqual('Organization update requires a team uuid');
//          expect(err.errors[1].message).toEqual('Organization update requires a valid version 4 team uuid');
//          done();
//        });
//      });
//
//      it('does not allow invalid team uuids', done => {
//        _valid.teamId = 'This is obviously not a uuid';
//        update = new Update(_valid);
//        update.save().then(obj => {
//          done.fail('This shouldn\'t save');
//        }).catch(err => {
//          expect(err.errors.length).toEqual(1);
//          expect(err.errors[0].message).toEqual('Organization update requires a valid version 4 team uuid');
//          done();
//        });
//      });
//
//      it('only allows uuidv4', done => {
//        _valid.teamId = uuid.v1();
//        update = new Update(_valid);
//        update.save().then(obj => {
//          done.fail('This shouldn\'t save');
//        }).catch(err => {
//          expect(err.errors.length).toEqual(1);
//          expect(err.errors[0].message).toEqual('Organization update requires a valid version 4 team uuid');
//          done();
//        });
//      });
//
//      it('cannot be set on a \'team\' update', done => {
//        _valid.type = 'team';
//        update = new Update(_valid);
//        update.save().then(obj => {
//          done.fail('This shouldn\'t save');
//        }).catch(err => {
//          expect(err.errors.length).toEqual(1);
//          expect(err.errors[0].message).toEqual('Team uuid only applies to organization updates');
//          done();
//        });
//      });
//
//      it('must be set on an \'organization\' inivitation', done => {
//        delete _valid.teamId;
//        update = new Update(_valid);
//        update.save().then(obj => {
//          done.fail('This shouldn\'t save');
//        }).catch(err => {
//          expect(err.errors.length).toEqual(1);
//          expect(err.errors[0].message).toEqual('Organization update requires a team uuid');
//          done();
//        });
//      });
//    });

    describe('type', () => {
      it('requires a type', done => {
        delete _valid.type;
        update = new Update(_valid);
        update.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Update requires a type');
          done();
        });
      });

      it('does not allow blanks', done => {
        _valid.type = '   ';
        update = new Update(_valid);
        update.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Update type can be one of either \'team\' or \'organization\'');
          done();
        });
      });

      it('does not allow empty', done => {
        _valid.type = '';
        update = new Update(_valid);
        update.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Update type can be one of either \'team\' or \'organization\'');
          done();
        });
      });

      describe('enumerated', () => {
        it('allows the \'team\' type', done => {
          _valid.type = 'team';
          update = new Update(_valid);
          update.save().then(obj => {
            expect(obj.id).toBeDefined();
            done();
          }).catch(err => {
            done.fail(err);
          });
        });

        it('allows the \'organization\' type', done => {
          _valid.type = 'organization';
          // Required for organization updates
          _valid.teamId = uuid.v4();
          update = new Update(_valid);
          update.save().then(obj => {
            expect(obj.id).toBeDefined();
            done();
          }).catch(err => {
            done.fail(err);
          });
        });

        it('only allows the types enumerated', done => {
          _valid.type = 'partaaaaay!';
          update = new Update(_valid);
          update.save().then(obj => {
            done.fail('This shouldn\'t save');
          }).catch(err => {
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].message).toEqual('Update type can be one of either \'team\' or \'organization\'');
            done();
          });
        });
      });
    });

    describe('uniqueness', () => {
      it('does not allow duplicate recipient/uuid combinations', done => {
        update = new Update(_valid);
        update.save().then(obj => {
          expect(obj.id).toBeDefined();

          let duplicateInvite = new Update(_valid);
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
        update = new Update(_valid);
        update.save().then(obj => {
          expect(obj.id).toBeDefined();

          _valid.recipient = 'newteammember@example.com';
          let newInvite = new Update(_valid);
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
        update = new Update(_valid);
        update.save().then(obj => {
          expect(obj.id).toBeDefined();

          _valid.uuid = uuid.v4();
          let newInvite = new Update(_valid);
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

    describe('data', () => {
      it('requires data', done => {
        delete _valid.data;
        update = new Update(_valid);
        update.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Update requires data');
          done();
        });
      });

      it('does not allow non-JSON data', done => {
        _valid.data = 'this is not json';
        update = new Update(_valid);
        update.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Update data supplied is not valid JSON');
          done();
        });
      });

      it('does not allow empty', done => {
        _valid.data = {};
        update = new Update(_valid);
        update.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Update contains no data');
          done();
        });
      });

      it('returns pre-parsed JSON', done => {
        update = new Update(_valid);
        update.save().then(obj => {
          expect(obj.data).toEqual({ name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: _valid.uuid });
          done();
        }).catch(err => {
          done.fail(err);
        });
      });
    });
  });
});
