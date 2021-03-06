'use strict';

/**
 * 2021-7-12
 *
 * Much of the functionality subject to testing here has been deprecated. I
 * preserved what I could so that the code and tests can be repurposed once
 * updates (or perhaps inter-app message) functionality is decided.
 */

/**
 * 2020-7-10
 *
 * Most of this modules functionality is tested in
 * `spec/lib/checkPermissionsSpec`. The `checkForUpdates` module was
 * isolated when the time came to test team's organizational membership
 * (now deprecated 2021-7-12).
 */


require('dotenv').config();

const httpMocks = require('node-mocks-http');
const uuid = require('uuid');
const models = require('../../models');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubUserAppMetadataUpdate = require('../support/auth0Endpoints/stubUserAppMetadataUpdate');

const checkForUpdates = require('../../lib/checkForUpdates');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */

const _profile = require('../fixtures/sample-auth0-profile-response');

describe('checkForUpdates', function() {

  let request;

  beforeEach(done => {
    models.sequelize.sync({force: true}).then(() => {
      stubAuth0ManagementApi((err, apiScopes) => {
        if (err) return done.fail(err);

        done();
      });
    }).catch(err => {
      done.fail(err);
    });
  });

  describe('organization membership', () => {

    const player = { ..._profile, name: 'Tracey Kelusky', email: 'player@example.com' };

    let organizationId, teamId,
        userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope;

    beforeEach(done => {
      organizationId = uuid.v4();
      teamId = uuid.v4();

      // Update team leader record
      stubUserAppMetadataUpdate(player, (err, apiScopes) => {
        if (err) return done.fail(err);
        ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
        done();
      });
    });

    describe('enrolling', () => {

      beforeEach(done => {
        player.user_metadata = { teams: [ {name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId} ] };

        models.Update.create({ recipient: player.email, uuid: organizationId, type: 'organization',
                               data: {name: 'The National Lacrosse League', leader: _profile.email, id: organizationId, teamId: teamId} }).then(results => {
 
          done();
        }).catch(err => {
          done.fail(err);
        });
      });

      /**
       * No more organizations. Preserved as a _how-to_ for the future
       */
      //it('adds organizationId to the team record', done => {
      //  request = httpMocks.createRequest({
      //    method: 'GET',
      //    url: '/agent',
      //    user: player,
      //  });

      //  expect(player.user_metadata.teams[0].organizationId).toBeUndefined();

      //  checkForUpdates(request, err => {
      //    if (err) return done.fail(err);

      //    expect(player.user_metadata.teams[0].organizationId).toEqual(organizationId);
      //    done();
      //  });
      //});

      it('deletes the update from the database', done => {
        request = httpMocks.createRequest({
          method: 'GET',
          url: '/agent',
          user: player,
        });

        models.Update.findAll().then(updates => {
          expect(updates.length).toEqual(1);

          checkForUpdates(request, err => {
            if (err) return done.fail(err);

            models.Update.findAll().then(updates => {
              expect(updates.length).toEqual(0);

              done();
            }).catch(err => {
              done.fail(err);
            });
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      describe('Auth0', () => {
        it('is called to update agent\'s user_metadata', done => {
          request = httpMocks.createRequest({
            method: 'GET',
            url: '/agent',
            user: player,
          });

          checkForUpdates(request, err => {
            if (err) return done.fail(err);
            expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
            expect(userAppMetadataUpdateScope.isDone()).toBe(true);

            done();
          });
        });
      });
    });

    describe('rescinding', () => {

      beforeEach(done => {
        player.user_metadata = { teams: [ { name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId, organizationId: organizationId } ] };

        models.Update.create({ recipient: player.email, type: 'team', uuid: teamId, data: { id: teamId, name: 'The Calgary Roughnecks', leader: 'coach@example.com' } }).then(results => {
          done();
        }).catch(err => {
          done.fail(err);
        });
      });

      /**
       * No more organizations. Preserved as a _how-to_ for the future
       */
      //it('deletes organizationId from the team record', done => {
      //  request = httpMocks.createRequest({
      //    method: 'GET',
      //    url: '/agent',
      //    user: player,
      //  });

      //  expect(player.user_metadata.teams[0].organizationId).toEqual(organizationId);

      //  checkForUpdates(request, err => {
      //    if (err) return done.fail(err);

      //    expect(player.user_metadata.teams[0].organizationId).toBeUndefined();

      //    done();
      //  });
      //});

      describe('Auth0', () => {
        it('is called to update agent\'s user_metadata', done => {
          request = httpMocks.createRequest({
            method: 'GET',
            url: '/agent',
            user: player,
          });

          checkForUpdates(request, err => {
            if (err) return done.fail(err);
            expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
            expect(userAppMetadataUpdateScope.isDone()).toBe(true);

            done();
          });
        });
      });
    });
  });
});
