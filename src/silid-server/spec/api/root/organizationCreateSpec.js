const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const models = require('../../../models');
const uuid = require('uuid');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubUserRead = require('../../support/auth0Endpoints/stubUserRead');
const stubUserAppMetadataRead = require('../../support/auth0Endpoints/stubUserAppMetadataRead');
const stubUserAppMetadataUpdate = require('../../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubOrganizationRead = require('../../support/auth0Endpoints/stubOrganizationRead');
const stubTeamRead = require('../../support/auth0Endpoints/stubTeamRead');
const scope = require('../../../config/permissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../../fixtures/sample-auth0-identity-token');
const _profile = require('../../fixtures/sample-auth0-profile-response');

describe('root/organizationCreateSpec', () => {

  let login, pub, prv, keystore;
  beforeEach(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  let originalProfile;
  afterEach(() => {
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    _profile.email = originalProfile.email;
    delete _profile.user_metadata;
  });

  let root;
  beforeEach(done => {
    originalProfile = {..._profile};
    _profile.email = process.env.ROOT_AGENT;

    models.sequelize.sync({force: true}).then(() => {
      models.Agent.create({ email: process.env.ROOT_AGENT }).then(results => {
        root = results;
        expect(root.isSuper).toBe(true);
        done();
      }).catch(err => {
        done.fail(err);
      });
    }).catch(err => {
      done.fail(err);
    });
  });

  describe('authorized', () => {
    let oauthTokenScope, rootSession,
        userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope,
        userAppMetadataReadScope, userAppMetadataReadOauthTokenScope,
        organizationReadScope, organizationReadOauthTokenScope;

    beforeEach(done => {
      stubAuth0ManagementApi((err, apiScopes) => {
        if (err) return done.fail();

        login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, (err, session) => {
          if (err) return done.fail(err);
          rootSession = session;

          done();
        });
      });
    });

    describe('create', () => {
      describe('successfully', () => {
        beforeEach(done => {
          // Cached profile doesn't match "live" data, so agent needs to be updated
          // with a call to Auth0
          stubUserRead((err, apiScopes) => {
            if (err) return done.fail();

            // Search for existing organization name
            stubOrganizationRead([], (err, apiScopes) => {
              if (err) return done.fail();
              ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);


              // Retrieve agent profile
              stubUserAppMetadataRead((err, apiScopes) => {
                if (err) return done.fail();
                ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

                stubUserAppMetadataUpdate((err, apiScopes) => {
                  if (err) return done.fail();
                  ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                  done();
                });
              });
            });
          });
        });

        it('returns the agent profile', done => {
          rootSession
            .post('/organization')
            .send({
              name: 'One Book Canada'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.email).toEqual(_profile.email);
              expect(res.body.user_metadata.organizations.length).toEqual(1);
              done();
            });
        });

        describe('Auth0', () => {
          it('is called to see if organization name is already registered', done => {
            rootSession
              .post('/organization')
              .send({
                name: 'One Book Canada'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(organizationReadOauthTokenScope.isDone()).toBe(true);
                expect(organizationReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('calls Auth0 to retrieve the agent user_metadata', done => {
            rootSession
              .post('/organization')
              .send({
                name: 'One Book Canada'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // 2020-6-17 Reuse token from above? This needs to be confirmed in production
                expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(false);
                expect(userAppMetadataReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('calls Auth0 to update the agent', done => {
            rootSession
              .post('/organization')
              .send({
                name: 'One Book Canada'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // 2020-6-17 Reuse token from above? This needs to be confirmed in production
                expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });

      describe('unsuccessfully', () =>{
        beforeEach(done => {
          // Witness node module caching magic
          _profile.user_metadata = { organizations: [ {name: 'One Book Canada', organizer: _profile.email } ] };

          // Cached profile doesn't match "live" data, so agent needs to be updated
          // with a call to Auth0
          stubUserRead((err, apiScopes) => {
            if (err) return done.fail();

            // This stubs calls subsequent to the inital login/permission checking step
            stubUserAppMetadataRead((err, apiScopes) => {
              if (err) return done.fail();
              ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

              stubOrganizationRead((err, apiScopes) => {
                if (err) return done.fail();
                ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                stubUserAppMetadataUpdate((err, apiScopes) => {
                  if (err) return done.fail();
                  ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                  done();
                });
              });
            });
          });
        });

        describe('add a duplicate organization name', () => {
          it('returns an error if record already exists', done => {
            rootSession
              .post('/organization')
              .send({
                name: 'One Book Canada'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.errors.length).toEqual(1);
                expect(res.body.errors[0].message).toEqual('That organization is already registered');
                done();
              });
          });

          describe('Auth0', () => {
            it('is called to see if organization name is already registered', done => {
              rootSession
                .post('/organization')
                .send({
                  name: 'One Book Canada'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(organizationReadOauthTokenScope.isDone()).toBe(true);
                  expect(organizationReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('does not call Auth0 to retrieve the agent user_metadata', done => {
              rootSession
                .post('/organization')
                .send({
                  name: 'One Book Canada'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(false);
                  expect(userAppMetadataReadScope.isDone()).toBe(false);
                  done();
                });
            });

            it('does not call Auth0 to update the agent user_metadata', done => {
              rootSession
                .post('/organization')
                .send({
                  name: 'One Book Canada'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                  expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                  done();
                });
            });
          });
        });

        it('returns an error if empty organization name provided', done => {
          rootSession
            .post('/organization')
            .send({
              name: '   '
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('Organization requires a name');
              done();
            });
        });

        it('returns an error if no organization name provided', done => {
          rootSession
            .post('/organization')
            .send({})
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('Organization requires a name');
              done();
            });
        });

        it('returns an error if organization name is over 128 characters long', done => {
          rootSession
            .post('/organization')
            .send({
              name: '!'.repeat(129)
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('Organization name is too long');
              done();
            });
        });
      });
    });
  });
});
