const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const models = require('../../models');
const request = require('supertest');
const uuid = require('uuid');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubUserRead = require('../support/auth0Endpoints/stubUserRead');
const stubUserAppMetadataRead = require('../support/auth0Endpoints/stubUserAppMetadataRead');
const stubUserAppMetadataUpdate = require('../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubOrganizationRead = require('../support/auth0Endpoints/stubOrganizationRead');
const stubTeamRead = require('../support/auth0Endpoints/stubTeamRead');
const mailer = require('../../mailer');
const scope = require('../../config/permissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = { ...require('../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_CUSTOM_DOMAIN}/`};
const _profile = require('../fixtures/sample-auth0-profile-response');

describe('organizationSpec', () => {

  let login, pub, prv, keystore,
      originalProfile, organization, agent;

  beforeEach(done => {
    originalProfile = {..._profile};

    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);

      models.sequelize.sync({force: true}).then(() => {
        done();
      }).catch(err => {
        done.fail(err);
      });
    });
  });

  afterEach(() => {
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    _profile.email_verified = true;
    delete _profile.user_metadata;
    _profile.email = originalProfile.email;
    _profile.name = originalProfile.name;
  });


  describe('authenticated', () => {

    let authenticatedSession;

    describe('authorized', () => {

      describe('read', () => {

        describe('GET /organization/:id', () => {

          describe('as organizer', () => {
            let organizationId, team1Id, team2Id;
            beforeEach(done => {
              organizationId = uuid.v4();
              team1Id = uuid.v4();
              team2Id = uuid.v4();

              _profile.user_metadata = { organizations: [{ name: 'One Book Canada', organizer: _profile.email, id: organizationId }] };
              stubAuth0ManagementApi((err, apiScopes) => {
                if (err) return done.fail();

                login(_identity, [scope.read.organizations], (err, session) => {

                  if (err) return done.fail(err);
                  authenticatedSession = session;

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
              });
            });

            it('collates agent data into organization data', done => {
              authenticatedSession
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
              authenticatedSession
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
                authenticatedSession
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

              it('is called to retrieve team data', done => {
                authenticatedSession
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

          describe('as affiliated team member', () => {
            let organizationId, team1Id, team2Id;
            beforeEach(done => {
              organizationId = uuid.v4();
              team1Id = uuid.v4();
              team2Id = uuid.v4();

              _profile.user_metadata = {  };
              stubAuth0ManagementApi((err, apiScopes) => {
                if (err) return done.fail();

                login(_identity, [scope.read.organizations], (err, session) => {

                  if (err) return done.fail(err);
                  authenticatedSession = session;

                  stubOrganizationRead([{
                    ..._profile,
                    name: 'A Aaronson',
                    email: 'aaaronson@example.com',
                    user_id: _profile.user_id + 1,
                    user_metadata: {
                      organizations: [{ name: 'One Book Canada', organizer: 'aaaronson@example.com', id: organizationId }],
                      teams: [
                        { name: 'Asia Sensitive', leader: 'teamleader@example.com', id: team1Id, organizationId: organizationId },
                        { name: 'The A-Team', leader: 'babaracus@example.com', id: uuid.v4(), organizationId: uuid.v4() }
                      ]
                    }
                  }], (err, apiScopes) => {
                    if (err) return done.fail();
                    ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                    stubTeamRead([
                      {
                        ..._profile,
                        user_metadata: {
                          ..._profile.user_metadata,
                          teams: [
                            { name: 'Guinea-Bissau', leader: 'squadleader@example.com', id: team2Id, organizationId: organizationId },
                            { name: 'Mystery Incorporated', leader: 'thelma@example.com', id: uuid.v4(), organizationId: uuid.v4() }
                          ]
                        }
                      },
                      {
                        ..._profile,
                        name: 'A Aaronson',
                        email: 'aaaronson@example.com',
                        user_id: _profile.user_id + 1,
                        user_metadata: {
                          teams: [
                            { name: 'Asia Sensitive', leader: 'teamleader@example.com', id: team1Id, organizationId: organizationId },
                            { name: 'The A-Team', leader: 'babaracus@example.com', id: uuid.v4(), organizationId: uuid.v4() }
                          ]
                        }
                      }
                    ], (err, apiScopes) => {
                      ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                      stubUserAppMetadataUpdate((err, apiScopes) => {
                        if (err) return done.fail();
                        ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                        done();
                      });
                    });
                  });
                });
              });
            });

            it('collates agent data into organization data', done => {
              authenticatedSession
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
              authenticatedSession
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
                authenticatedSession
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

              it('is called to retrieve team data', done => {
                authenticatedSession
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

        describe('GET /organization', () => {

          let organizationId, anotherOrganizationId;
          beforeEach(done => {

            // Manufacture some orgs
            organizationId = uuid.v4();
            anotherOrganizationId = uuid.v4();

            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();
              done();
            });
          });

          it('retrieves all organizations for which this agent is organizer in alphabetical order', done => {
            _profile.user_metadata = {
              organizations: [
                {name: 'The National Lacrosse League', organizer: _profile.email, id: anotherOrganizationId },
                {name: 'One Book Canada', organizer: _profile.email, id: organizationId }
              ]
            };

            login(_identity, [scope.create.teams], (err, session) => {

              if (err) return done.fail(err);
              authenticatedSession = session;

              stubUserAppMetadataRead((err, apiScopes) => {
                if (err) return done.fail();
                let {userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes;

                expect(_profile.user_metadata.organizations.length).toEqual(2);
                authenticatedSession
                  .get(`/organization`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(res.body.length).toEqual(2);

                    expect(res.body[0]).toEqual({name: 'One Book Canada', organizer: _profile.email, id: organizationId });
                    expect(res.body[1]).toEqual({name: 'The National Lacrosse League', organizer: _profile.email, id: anotherOrganizationId });

                    // Auth0 is the souce
                    expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                    expect(userAppMetadataReadScope.isDone()).toBe(true);

                    done();
                  });
              });
            });
          });

          it('returns 404 and empty array if agent is not an organizer', done => {
            login(_identity, [scope.create.teams], (err, session) => {

              if (err) return done.fail(err);
              authenticatedSession = session;

              // For the Auth0 call on the route
              stubUserAppMetadataRead((err, apiScopes) => {
                if (err) return done.fail();
                let {userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes;

                expect(_profile.user_metadata).toBeUndefined();
                authenticatedSession
                  .get(`/organization`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(res.body.length).toEqual(0);

                    // Auth0 is the souce
                    expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                    expect(userAppMetadataReadScope.isDone()).toBe(true);

                    done();
                  });
              });
            });
          });
        });
      });
    });

    describe('forbidden', () => {

      let unauthorizedSession;
      beforeEach(done => {
        models.Agent.create({ email: 'suspiciousagent@example.com', name: 'Suspicious Guy' }).then(a => {

          _profile.email = a.email;
          _profile.name = a.name;

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login({..._identity, email: a.email}, [scope.read.organizations], (err, session) => {
              if (err) return done.fail(err);
              unauthorizedSession = session;

              done();
            });
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      describe('read', () => {

        describe('with no organizational affliation', () => {

          describe('GET /organization/:id', () => {
            let organizationId, team1Id, team2Id;
            beforeEach(done => {
              organizationId = uuid.v4();
              team1Id = uuid.v4();
              team2Id = uuid.v4();

              _profile.user_metadata = {};

              stubOrganizationRead([{
                ..._profile,
                name: 'BA Baracus',
                name: 'babaracus@example.com',
                user_metadata: {
                  ..._profile.user_metadata,
                  organizations: [{ name: 'One Book Canada', organizer: 'babaracus@example.com', id: organizationId }],
                }
              }], (err, apiScopes) => {
                if (err) return done.fail();
                ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                stubTeamRead([
                  {..._profile,
                    name: 'Zelda Zerk',
                    email: 'zzerk@example.com',
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
                  }
                ], (err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                  stubUserAppMetadataUpdate((err, apiScopes) => {
                    if (err) return done.fail(err);
                    ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                    done();
                  });
                });
              });
            });

            it('returns 403', done => {
              unauthorizedSession
                .get(`/organization/${organizationId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('You are not a member of that organization');

                  done();
                });
            });

            it('doesn\'t barf if record doesn\'t exist', done => {
              unauthorizedSession
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
                unauthorizedSession
                  .get(`/organization/${organizationId}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(403)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(organizationReadOauthTokenScope.isDone()).toBe(true);
                    expect(organizationReadScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('is called to retrieve team data', done => {
                unauthorizedSession
                  .get(`/organization/${organizationId}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(403)
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

  describe('not authenticated', () => {
    it('redirects to login', done => {
      request(app)
        .get('/organization')
        .send({ name: 'Some org' })
        .set('Accept', 'application/json')
        .expect(302)
        .end((err, res) => {
          if (err) return done.fail(err);
          expect(res.headers.location).toEqual('/login');
          done();
        });
    });
  });
});
