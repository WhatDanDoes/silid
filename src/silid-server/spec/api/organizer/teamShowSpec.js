const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../../models');
const request = require('supertest');
const uuid = require('uuid');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubUserRead = require('../../support/auth0Endpoints/stubUserRead');
const stubUserRolesRead = require('../../support/auth0Endpoints/stubUserRolesRead');
const stubUserAppMetadataRead = require('../../support/auth0Endpoints/stubUserAppMetadataRead');
const stubUserAppMetadataUpdate = require('../../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubTeamRead = require('../../support/auth0Endpoints/stubTeamRead');
const stubOrganizationRead = require('../../support/auth0Endpoints/stubOrganizationRead');
const mailer = require('../../../mailer');
const scope = require('../../../config/permissions');
const apiScope = require('../../../config/apiPermissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../../fixtures/sample-auth0-identity-token');
const _profile = require('../../fixtures/sample-auth0-profile-response');
const _auth0Roles = require('../../fixtures/roles');
const _roles = require('../../../config/roles');

describe('organizer/teamShowSpec', () => {
  let originalProfile;

  let login, pub, prv, keystore;
  beforeEach(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
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

  let agent;
  beforeEach(done => {
    originalProfile = {..._profile};

    models.sequelize.sync({force: true}).then(() => {
      fixtures.loadFile(`${__dirname}/../../fixtures/agents.json`, models).then(() => {
        models.Agent.findAll().then(results => {
          agent = results[0];
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

  let userReadScope, updateTeamScope, oauthTokenScope, authenticatedSession;
  describe('authenticated', () => {

    describe('authorized', () => {

      describe('read', () => {

        describe('GET /team/:id', () => {

          let teamId, userReadScope, organizationReadScope, organizationReadOauthTokenScope, teamReadScope, teamReadOauthTokenScope;

          describe('organizer is unaffilliated', () => {

            describe('team has no organizational affiliation', () => {
              let organizationId, teamId;
              beforeEach(done => {
                teamId = uuid.v4();
                organizationId = uuid.v4();

                _profile.user_metadata = { organizations: [{ name: 'The National Lacrosse League', organizer: _profile.email, id: organizationId }] };
                stubAuth0ManagementApi({ userRoles: [_auth0Roles[0], _auth0Roles[2]] }, (err, apiScopes) => {
                  if (err) return done.fail();

                  login(_identity, _roles.organizer, (err, session) => {

                    if (err) return done.fail(err);
                    authenticatedSession = session;

                    // Cached profile doesn't match "live" data, so agent needs to be updated
                    // with a call to Auth0
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail();

                      //stubTeamRead([_profile,
                      stubTeamRead([{..._profile,
                                      name: 'Curt Malawsky',
                                      email: 'coach@example.com',
                                      user_id: _profile.user_id + 1,
                                      user_metadata: {
                                        teams: [{ name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId }]
                                      }
                                    }], (err, apiScopes) => {
                        if (err) return done.fail();
                        ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                        stubOrganizationRead((err, apiScopes) => {
                          if (err) return done.fail();
                          ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                          done();
                        });
                      });
                    });
                  });
                });
              });

              it('collates agent data into team data', done => {
                authenticatedSession
                  .get(`/team/${teamId}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.name).toEqual('The Calgary Roughnecks');
                    expect(res.body.leader).toEqual('coach@example.com');
                    expect(res.body.id).toEqual(teamId);
                    // Alphabetical according to name
                    expect(res.body.members.length).toEqual(1);
                    expect(res.body.members[0]).toEqual({ name: 'Curt Malawsky', email: 'coach@example.com', user_id: _profile.user_id + 1 });

                    done();
                  });
              });

              describe('Auth0', () => {
                it('is called to retrieve the team data', done => {
                  authenticatedSession
                    .get(`/team/${teamId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(teamReadOauthTokenScope.isDone()).toBe(true);
                      expect(teamReadScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is not called to retrieve parent organization data (because it doesn\'t exist)', done => {
                  authenticatedSession
                    .get(`/team/${teamId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(organizationReadOauthTokenScope.isDone()).toBe(false);
                      expect(organizationReadScope.isDone()).toBe(false);
                      done();
                    });
                });
              });
            });

            describe('team is member of the organizer\'s organization', () => {
              let organizationId, teamId;
              beforeEach(done => {
                teamId = uuid.v4();
                organizationId = uuid.v4();

                _profile.user_metadata = { organizations: [{ name: 'The National Lacrosse League', organizer: _profile.email, id: organizationId }] };
                stubAuth0ManagementApi({ userRoles: [_auth0Roles[0], _auth0Roles[2]] }, (err, apiScopes) => {
                  if (err) return done.fail();

                  login(_identity, _roles.organizer, (err, session) => {

                    if (err) return done.fail(err);
                    authenticatedSession = session;

                    // Cached profile doesn't match "live" data, so agent needs to be updated
                    // with a call to Auth0
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail();

                      stubTeamRead([{..._profile,
                                      name: 'Curt Malawsky',
                                      email: 'coach@example.com',
                                      user_id: _profile.user_id + 1,
                                      user_metadata: {
                                        teams: [{ name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId, organizationId: organizationId }]
                                      }
                                    }], (err, apiScopes) => {
                        if (err) return done.fail();
                        ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                        stubOrganizationRead((err, apiScopes) => {
                          if (err) return done.fail();
                          ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                          done();
                        });
                      });
                    });
                  });
                });
              });

              it('collates agent data into team data', done => {
                authenticatedSession
                  .get(`/team/${teamId}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.name).toEqual('The Calgary Roughnecks');
                    expect(res.body.leader).toEqual('coach@example.com');
                    expect(res.body.id).toEqual(teamId);
                    // Alphabetical according to name
                    expect(res.body.members.length).toEqual(1);
                    expect(res.body.members[0]).toEqual({ name: 'Curt Malawsky', email: 'coach@example.com', user_id: _profile.user_id + 1 });
                    expect(res.body.organization).toBeDefined();
                    expect(res.body.organization.name).toEqual('The National Lacrosse League');
                    expect(res.body.organization.organizer).toEqual(_profile.email);
                    expect(res.body.organization.id).toEqual(organizationId);

                    done();
                  });
              });

              describe('Auth0', () => {
                it('is called to retrieve the team data', done => {
                  authenticatedSession
                    .get(`/team/${teamId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(teamReadOauthTokenScope.isDone()).toBe(true);
                      expect(teamReadScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is not called to retrieve parent organization data because organizer already has it in his user_metadata', done => {
                  authenticatedSession
                    .get(`/team/${teamId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(organizationReadOauthTokenScope.isDone()).toBe(false);
                      expect(organizationReadScope.isDone()).toBe(false);
                      done();
                    });
                });
              });
            });

            describe('team is member of a different organization', () => {
              let organizationId, anotherOrganizationId, teamId;
              beforeEach(done => {
                teamId = uuid.v4();
                organizationId = uuid.v4();
                anotherOrganizationId = uuid.v4();

                _profile.user_metadata = { organizations: [{ name: 'The National Lacrosse League', organizer: _profile.email, id: organizationId }] };
                stubAuth0ManagementApi({ userRoles: [_auth0Roles[0], _auth0Roles[2]] }, (err, apiScopes) => {
                  if (err) return done.fail();

                  login(_identity, _roles.organizer.concat(_roles.viewer), (err, session) => {

                    if (err) return done.fail(err);
                    authenticatedSession = session;

                    // Cached profile doesn't match "live" data, so agent needs to be updated
                    // with a call to Auth0
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail();

                      stubTeamRead([{..._profile,
                                      name: 'Curt Malawsky',
                                      email: 'coach@example.com',
                                      user_id: _profile.user_id + 1,
                                      user_metadata: {
                                        teams: [{ name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId, organizationId: anotherOrganizationId }]
                                      }
                                    }], (err, apiScopes) => {
                        if (err) return done.fail();
                        ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                        stubOrganizationRead([{..._profile,
                                               name: 'Larry Lacrosse',
                                               email: 'generalmanager@example.com',
                                               user_id: _profile.user_id + 2,
                                               user_metadata: {
                                                 organizations: [{ name: 'The Canadian Lacrosse Association', organizer: 'generalmanager@example.com', id: anotherOrganizationId }]
                                               }
                                              }], (err, apiScopes) => {
                          if (err) return done.fail();
                          ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                          done();
                        });
                      });
                    });
                  });
                });
              });

              it('collates agent data into team data', done => {
                authenticatedSession
                  .get(`/team/${teamId}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.name).toEqual('The Calgary Roughnecks');
                    expect(res.body.leader).toEqual('coach@example.com');
                    expect(res.body.id).toEqual(teamId);
                    // Alphabetical according to name
                    expect(res.body.members.length).toEqual(1);
                    expect(res.body.members[0]).toEqual({ name: 'Curt Malawsky', email: 'coach@example.com', user_id: _profile.user_id + 1 });
                    expect(res.body.organization).toBeDefined();
                    expect(res.body.organization.name).toEqual('The Canadian Lacrosse Association');
                    expect(res.body.organization.organizer).toEqual('generalmanager@example.com');
                    expect(res.body.organization.id).toEqual(anotherOrganizationId);

                    done();
                  });
              });

              describe('Auth0', () => {
                it('is called to retrieve the team data', done => {
                  authenticatedSession
                    .get(`/team/${teamId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(teamReadOauthTokenScope.isDone()).toBe(true);
                      expect(teamReadScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is called to retrieve parent organization data', done => {
                  authenticatedSession
                    .get(`/team/${teamId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(organizationReadOauthTokenScope.isDone()).toBe(false);
                      expect(organizationReadScope.isDone()).toBe(true);
                      done();
                    });
                });
              });
            });
          });

          describe('organizer is team member', () => {
            describe('team has no organizational affiliation', () => {
              let organizationId;
              beforeEach(done => {
                teamId = uuid.v4();
                organizationId = uuid.v4();

                _profile.user_metadata = {
                  organizations: [{ name: 'The National Lacrosse League', organizer: _profile.email, id: organizationId }],
                  teams: [{ name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId }]
                };

                stubAuth0ManagementApi({ userRoles: [_auth0Roles[0], _auth0Roles[2]] }, (err, apiScopes) => {
                  if (err) return done.fail();

                  login(_identity, _roles.organizer, (err, session) => {

                    if (err) return done.fail(err);
                    authenticatedSession = session;

                    // Cached profile doesn't match "live" data, so agent needs to be updated
                    // with a call to Auth0
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail();

                      stubTeamRead([_profile,
                                    {..._profile,
                                      name: 'Curt Malawsky',
                                      email: 'coach@example.com',
                                      user_id: _profile.user_id + 1,
                                      user_metadata: {
                                        teams: [{ name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId }]
                                      }
                                    }], (err, apiScopes) => {
                        if (err) return done.fail();
                        ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                        stubOrganizationRead((err, apiScopes) => {
                          if (err) return done.fail();
                          ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                          done();
                        });
                      });
                    });
                  });
                });
              });

              it('attaches organization to collated team data', done => {
                authenticatedSession
                  .get(`/team/${teamId}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.name).toEqual('The Calgary Roughnecks');
                    expect(res.body.leader).toEqual('coach@example.com');
                    expect(res.body.id).toEqual(teamId);
                    expect(res.body.organization).toBeUndefined();

                    done();
                  });
              });

              describe('Auth0', () => {
                it('is called to retrieve the team data', done => {
                  authenticatedSession
                    .get(`/team/${teamId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(teamReadOauthTokenScope.isDone()).toBe(true);
                      expect(teamReadScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is not called to retrieve parent organization data (because there is no parent organization)', done => {
                  authenticatedSession
                    .get(`/team/${teamId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(organizationReadOauthTokenScope.isDone()).toBe(false);
                      expect(organizationReadScope.isDone()).toBe(false);
                      done();
                    });
                });
              });
            });

            describe('team is member of the organizer\'s organization', () => {
              let organizationId, teamId;
              beforeEach(done => {
                teamId = uuid.v4();
                organizationId = uuid.v4();

                _profile.user_metadata = {
                  organizations: [{ name: 'The National Lacrosse League', organizer: _profile.email, id: organizationId }],
                  teams: [{ name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId, organizationId: organizationId }]
                };

                stubAuth0ManagementApi({ userRoles: [_auth0Roles[0], _auth0Roles[2]] }, (err, apiScopes) => {
                  if (err) return done.fail();

                  login(_identity, _roles.organizer, (err, session) => {

                    if (err) return done.fail(err);
                    authenticatedSession = session;

                    // Cached profile doesn't match "live" data, so agent needs to be updated
                    // with a call to Auth0
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail();

                      stubTeamRead([_profile,
                                    {..._profile,
                                      name: 'Curt Malawsky',
                                      email: 'coach@example.com',
                                      user_id: _profile.user_id + 1,
                                      user_metadata: {
                                        teams: [{ name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId, organizationId: organizationId }]
                                      }
                                    }], (err, apiScopes) => {
                        if (err) return done.fail();
                        ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                        stubOrganizationRead((err, apiScopes) => {
                          if (err) return done.fail();
                          ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                          done();
                        });
                      });
                    });
                  });
                });
              });

              it('collates agent data into team data', done => {
                authenticatedSession
                  .get(`/team/${teamId}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.name).toEqual('The Calgary Roughnecks');
                    expect(res.body.leader).toEqual('coach@example.com');
                    expect(res.body.id).toEqual(teamId);
                    // Alphabetical according to name
                    expect(res.body.members.length).toEqual(2);
                    expect(res.body.members[0]).toEqual({ name: 'Curt Malawsky', email: 'coach@example.com', user_id: _profile.user_id + 1 });
                    expect(res.body.members[1]).toEqual({ name: _profile.name, email: _profile.email, user_id: _profile.user_id });
                    expect(res.body.organization).toBeDefined();
                    expect(res.body.organization.name).toEqual('The National Lacrosse League');
                    expect(res.body.organization.organizer).toEqual(_profile.email);
                    expect(res.body.organization.id).toEqual(organizationId);

                    done();
                  });
              });

              describe('Auth0', () => {
                it('is called to retrieve the team data', done => {
                  authenticatedSession
                    .get(`/team/${teamId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(teamReadOauthTokenScope.isDone()).toBe(true);
                      expect(teamReadScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is not called to retrieve parent organization data because it is already contained in the organizer\'s user_metadata', done => {
                  authenticatedSession
                    .get(`/team/${teamId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(organizationReadOauthTokenScope.isDone()).toBe(false);
                      expect(organizationReadScope.isDone()).toBe(false);
                      done();
                    });
                });
              });
            });

            describe('team is member of a different organization', () => {
              let organizationId, anotherOrganizationId, teamId;
              beforeEach(done => {
                teamId = uuid.v4();
                organizationId = uuid.v4();
                anotherOrganizationId = uuid.v4();

                _profile.user_metadata = {
                  organizations: [{ name: 'The National Lacrosse League', organizer: _profile.email, id: organizationId }],
                  teams: [{ name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId, organizationId: anotherOrganizationId }]
                };
                stubAuth0ManagementApi({ userRoles: [_auth0Roles[0], _auth0Roles[2]] }, (err, apiScopes) => {
                  if (err) return done.fail();

                  login(_identity, _roles.organizer.concat(_roles.viewer), (err, session) => {

                    if (err) return done.fail(err);
                    authenticatedSession = session;

                    // Cached profile doesn't match "live" data, so agent needs to be updated
                    // with a call to Auth0
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail();

                      stubTeamRead([_profile,
                                    {..._profile,
                                      name: 'Curt Malawsky',
                                      email: 'coach@example.com',
                                      user_id: _profile.user_id + 1,
                                      user_metadata: {
                                        teams: [{ name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId, organizationId: anotherOrganizationId }]
                                      }
                                    }], (err, apiScopes) => {
                        if (err) return done.fail();
                        ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                        stubOrganizationRead([{..._profile,
                                               name: 'Larry Lacrosse',
                                               email: 'generalmanager@example.com',
                                               user_id: _profile.user_id + 2,
                                               user_metadata: {
                                                 organizations: [{ name: 'The Canadian Lacrosse Association', organizer: 'generalmanager@example.com', id: anotherOrganizationId }]
                                               }
                                              }], (err, apiScopes) => {
                          if (err) return done.fail();
                          ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                          done();
                        });
                      });
                    });
                  });
                });
              });

              it('collates agent data into team data', done => {
                authenticatedSession
                  .get(`/team/${teamId}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.name).toEqual('The Calgary Roughnecks');
                    expect(res.body.leader).toEqual('coach@example.com');
                    expect(res.body.id).toEqual(teamId);
                    // Alphabetical according to name
                    expect(res.body.members.length).toEqual(2);
                    expect(res.body.members[0]).toEqual({ name: 'Curt Malawsky', email: 'coach@example.com', user_id: _profile.user_id + 1 });
                    expect(res.body.members[1]).toEqual({ name: _profile.name, email: _profile.email, user_id: _profile.user_id });
                    expect(res.body.organization).toBeDefined();
                    expect(res.body.organization.name).toEqual('The Canadian Lacrosse Association');
                    expect(res.body.organization.organizer).toEqual('generalmanager@example.com');
                    expect(res.body.organization.id).toEqual(anotherOrganizationId);

                    done();
                  });
              });

              describe('Auth0', () => {
                it('is called to retrieve the team data', done => {
                  authenticatedSession
                    .get(`/team/${teamId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(teamReadOauthTokenScope.isDone()).toBe(true);
                      expect(teamReadScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is called to retrieve parent organization data', done => {
                  authenticatedSession
                    .get(`/team/${teamId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(organizationReadOauthTokenScope.isDone()).toBe(false);
                      expect(organizationReadScope.isDone()).toBe(true);
                      done();
                    });
                });
              });
            });
          });
        });
      });
    });
  });
});
