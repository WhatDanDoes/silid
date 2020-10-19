'use strict';

require('../../app'); // Just so .env vars are loaded

describe('ClientApp', () => {
  const db = require('../../models');
  const ClientApp = db.ClientApp;

  let clientApp;

  const _valid = {};
  beforeEach(done => {
    db.sequelize.sync({force: true}).then(() => {
      _valid.clientId = 'someCli13nt1d';
 
      clientApp = new ClientApp(_valid);
      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  describe('basic validation', () => {
    it('sets the createdAt and updatedAt fields', done => {
      expect(clientApp.createdAt).toBe(undefined);
      expect(clientApp.updatedAt).toBe(undefined);
      clientApp.save().then(obj => {
        expect(clientApp.createdAt instanceof Date).toBe(true);
        expect(clientApp.updatedAt instanceof Date).toBe(true);
        done();
      }).catch(err => {
        done.fail(err);
      });
    });

    it('sets profile to its default value', done => {
      delete _valid.profile;
      clientApp = new ClientApp(_valid);
      expect(clientApp.profile).toEqual({});
      clientApp.profile = undefined;
      expect(clientApp.profile).toBe(undefined);
      clientApp.save().then(obj => {
        expect(clientApp.profile).toEqual({});
        done();
      }).catch(err => {
        done.fail(err);
      });
    });

    describe('clientId', () => {
      it('requires a clientId', done => {
        delete _valid.clientId;
        clientApp = new ClientApp(_valid);
        clientApp.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Client application requires an Auth0 client_id');
          done();
        });
      });

      it('does not allow blanks', done => {
        _valid.clientId = '   ';
        clientApp = new ClientApp(_valid);
        clientApp.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Client application requires an Auth0 client_id');
          done();
        });
      });

      it('does not allow empty', done => {
        _valid.clientId = '';
        clientApp = new ClientApp(_valid);
        clientApp.save().then(obj => {
          done.fail('This shouldn\'t save');
        }).catch(err => {
          expect(err.errors.length).toEqual(1);
          expect(err.errors[0].message).toEqual('Client application requires an Auth0 client_id');
          done();
        });
      });

      it('does not allow duplicate clientIds', done => {
        clientApp.save().then(obj => {
          expect(obj.clientId).toEqual(_valid.clientId);
          let newClientApp = new ClientApp(_valid);
          newClientApp.save().then(obj => {
            done.fail('This shouldn\'t have saved');
          }).catch(err => {
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].message).toEqual('That client application is already registered');
            done();
          });
        }).catch(err => {
          done.fail(err);
        });
      });
    });

    describe('profile', () => {
      beforeEach(() => {
        _valid.profile = {
          "client_id": "AaiyAPdpYdesoKnqjj8HJqRn4T5titww",
          "name": "My application",
          "callbacks": [
            "http://example.com/callback"
          ],
        };
      });

      it('handles all the stringifying and parsing', done => {
        clientApp = new ClientApp(_valid);
        clientApp.save().then(obj => {
          expect(obj.profile).toEqual(_valid.profile);
          done();
        }).catch(err => {
          done.fail(err);
        });
      });
    });
  });
});
