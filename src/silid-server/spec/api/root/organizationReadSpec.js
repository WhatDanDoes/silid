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
const stubUserList = require('../../support/auth0Endpoints/stubUserList');
const scope = require('../../../config/permissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = { ...require('../../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_CUSTOM_DOMAIN}/`};
const _profile = require('../../fixtures/sample-auth0-profile-response');

describe('root/organizationReadSpec', () => {

  let login, pub, prv, keystore,
      root, originalProfile;

  beforeEach(done => {
    originalProfile = {..._profile};
    _profile.email = process.env.ROOT_AGENT;

    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);

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
  });

  afterEach(() => {
    _profile.email = originalProfile.email;
    delete _profile.user_metadata;
  });

  describe('authorized', () => {
    let rootSession,
        userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope,
        userAppMetadataReadScope, userAppMetadataReadOauthTokenScope,
        organizationReadScope, organizationReadOauthTokenScope,
        userListScope, userListOauthTokenScope;

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

    describe('read', () => {

      let organizationId, anotherOrganizationId, nonRootOrgId;

      describe('/organization', () => {

        beforeEach(done => {
          // Manufacture some orgs
          organizationId = uuid.v4();
          anotherOrganizationId = uuid.v4();
          nonRootOrgId = uuid.v4();

          // Root leads two teams
          _profile.user_metadata = {
            organizations: [
              {name: 'The National Lacrosse League', organizer: _profile.email, id: anotherOrganizationId },
              {name: 'One Book Canada', organizer: _profile.email, id: organizationId }
            ]
          };

          stubUserAppMetadataRead((err, apiScopes) => {
            if (err) return done.fail(err);
            ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

            done();
          });
        });

        it('retrieves only the root agent\'s organization', done => {
          expect(_profile.user_metadata.organizations.length).toEqual(2);
          rootSession
            .get(`/organization`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) return done.fail(err);
              expect(res.body.length).toEqual(2);
              expect(res.body[0]).toEqual({name: 'One Book Canada', organizer: _profile.email, id: organizationId });
              expect(res.body[1]).toEqual({name: 'The National Lacrosse League', organizer: _profile.email, id: anotherOrganizationId });

              done();
            });
        });

        describe('Auth0', () => {
          it('is called to retrieve root agent\'s organization data', done => {
            rootSession
              .get(`/organization`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                expect(userAppMetadataReadScope.isDone()).toBe(true);
                done();
              });
          });
        });

        describe('/organization/admin', () => {
          /**
           * 2020-6-18
           *
           * Maximum 1000 users returned if page is set. Max 50 if no page set
           * https://auth0.com/docs/users/search/v3/get-users-endpoint
           *
           * Users can be exported to a file
           * https://auth0.com/docs/api/management/v2#!/Jobs/post_users_exports
           *
           * Which is better? Periodic updates or paging where you cannot
           * ensure alphabetical order?
           *
           */
        });
      });

      describe('GET /organization/:id', () => {

        describe('where root is the organizer', () => {

          let organizationId, team1Id, team2Id;
          beforeEach(done => {
            organizationId = uuid.v4();
            team1Id = uuid.v4();
            team2Id = uuid.v4();

            _profile.user_metadata = { organizations: [{ name: 'One Book Canada', organizer: _profile.email, id: organizationId }] };

            stubOrganizationRead((err, apiScopes) => {
              if (err) return done.fail();
              ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

              stubTeamRead([{..._profile,
                              user_metadata: {
                                ..._profile.user_metadata,
                                teams: [
                                  { name: 'Guinea-Bissau', leader: 'squadleader@example.com', id: team2Id, organizationId: organizationId },
                                  { name: 'Mystery Incorporated', leader: 'thelma@example.com', id: uuid.v4(), organizationId: uuid.v4() }
                                ]
                              }
                            },
                            {..._profile,
                              name: 'A Aaronson',
                              email: 'aaaronson@example.com',
                              user_id: _profile.user_id + 1,
                              user_metadata: {
                                teams: [
                                  { name: 'Asia Sensitive', leader: 'teamleader@example.com', id: team1Id, organizationId: organizationId },
                                  { name: 'The A-Team', leader: 'babaracus@example.com', id: uuid.v4(), organizationId: uuid.v4() }
                                ]
                              }
                            }], (err, apiScopes) => {
                ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                stubUserAppMetadataUpdate((err, apiScopes) => {
                  if (err) return done.fail();
                  ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                  done();
                });
              });
            });
          });

          it('collates agent data into organization data', done => {
            rootSession
              .get(`/organization/${organizationId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.name).toEqual('One Book Canada');
                expect(res.body.organizer).toEqual(_profile.email);
                expect(res.body.id).toEqual(organizationId);
                // Alphabetical according to name
                expect(res.body.teams.length).toEqual(2);
                expect(res.body.teams[0]).toEqual({ name: 'Asia Sensitive', leader: 'teamleader@example.com', id: team1Id, organizationId: organizationId });
                expect(res.body.teams[1]).toEqual({ name: 'Guinea-Bissau', leader: 'squadleader@example.com', id: team2Id, organizationId: organizationId });

                done();
              });
          });

          it('doesn\'t barf if record doesn\'t exist', done => {
            rootSession
              .get('/organization/333')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(404)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('No such organization');
                done();
              });
          });

          describe('Auth0', () => {
            it('is called to retrieve organization data', done => {
              rootSession
                .get(`/organization/${organizationId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(organizationReadOauthTokenScope.isDone()).toBe(true);
                  expect(organizationReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to retrieve organization data', done => {
              rootSession
                .get(`/organization/${organizationId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  // Token re-used from first request
                  expect(teamReadOauthTokenScope.isDone()).toBe(false);
                  expect(teamReadScope.isDone()).toBe(true);
                  done();
                });
            });
          });
        });

        describe('where root has no affiliation', () => {
          let organizationId, team1Id, team2Id;
          beforeEach(done => {
            organizationId = uuid.v4();
            team1Id = uuid.v4();
            team2Id = uuid.v4();

            _profile.user_metadata = {  };

            stubOrganizationRead([{..._profile,
                name: 'A Aaronson',
                email: 'aaaronson@example.com',
                user_id: _profile.user_id + 1,
                user_metadata: {
                  organizations: [{ name: 'One Book Canada', organizer: 'aaaronson@example.com', id: organizationId }],
                }
            }],(err, apiScopes) => {
              if (err) return done.fail();
              ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

              stubTeamRead([{..._profile,
                              name: 'BA Baracus',
                              email: 'babaracus@example.com',
                              user_metadata: {
                                ..._profile.user_metadata,
                                teams: [
                                  { name: 'Guinea-Bissau', leader: 'squadleader@example.com', id: team2Id, organizationId: organizationId },
                                  { name: 'The A-Team', leader: 'babaracus@example.com', id: uuid.v4(), organizationId: uuid.v4() }
                                ]
                              }
                            },
                            {..._profile,
                              name: 'Zelda Zerk',
                              email: 'zzerk@example.com',
                              user_id: _profile.user_id + 2,
                              user_metadata: {
                                teams: [
                                  { name: 'Asia Sensitive', leader: 'teamleader@example.com', id: team1Id, organizationId: organizationId },
                                  { name: 'The A-Team', leader: 'babaracus@example.com', id: uuid.v4(), organizationId: uuid.v4() }
                                ]
                              }
                            }], (err, apiScopes) => {
                if (err) return done.fail();
                ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                stubUserAppMetadataUpdate((err, apiScopes) => {
                  if (err) return done.fail();
                  ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                  done();
                });
              });
            });
          });

          it('collates agent data into organization data', done => {
            rootSession
              .get(`/organization/${organizationId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.name).toEqual('One Book Canada');
                expect(res.body.organizer).toEqual('aaaronson@example.com');
                expect(res.body.id).toEqual(organizationId);
                // Alphabetical according to name
                expect(res.body.teams.length).toEqual(2);
                expect(res.body.teams[0]).toEqual({ name: 'Asia Sensitive', leader: 'teamleader@example.com', id: team1Id, organizationId: organizationId });
                expect(res.body.teams[1]).toEqual({ name: 'Guinea-Bissau', leader: 'squadleader@example.com', id: team2Id, organizationId: organizationId });

                done();
              });
          });

          it('doesn\'t barf if record doesn\'t exist', done => {
            rootSession
              .get('/organization/333')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(404)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('No such organization');
                done();
              });
          });

          describe('Auth0', () => {
            it('is called to retrieve organization data', done => {
              rootSession
                .get(`/organization/${organizationId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(organizationReadOauthTokenScope.isDone()).toBe(true);
                  expect(organizationReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to retrieve organization data', done => {
              rootSession
                .get(`/organization/${organizationId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  // Token re-used from first request
                  expect(teamReadOauthTokenScope.isDone()).toBe(false);
                  expect(teamReadScope.isDone()).toBe(true);
                  done();
                });
            });
          });
        });
      });
    });
  });
});
