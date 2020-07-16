context('root/Team delete', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com'};
  });

  afterEach(() => {
    // Cypress thinks it can handle asynchronicity better than it can.
    // This makes sure sensitive tests complete before the DB is cleaned
    cy.wait(300);
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Updates" CASCADE;');
  });

  describe('Deleting', () => {

    let root, regularAgent, teamId;
    beforeEach(() => {
      teamId = 'some-uuid-v4';
    });

    describe('root\'s own team', () => {

      describe('admin mode', () => {
        context('switched on', () => {
          context('member agents exist', () => {
            beforeEach(() => {
              // Create another team member
              cy.login('regularguy@example.com', {..._profile, user_metadata: {
                                                      teams: [
                                                        {
                                                          id: teamId,
                                                          name: 'The Calgary Roughnecks',
                                                          leader: _profile.email,
                                                        }
                                                      ]
                                                    }, name: 'Regular Guy' });
              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='regularguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
                regularAgent = results[0];

                // Login root
                cy.login(_profile.email, {..._profile, user_metadata: {
                                               teams: [
                                                 {
                                                   id: teamId,
                                                   name: 'The Calgary Roughnecks',
                                                   leader: _profile.email,
                                                 }
                                               ]
                                             }, name: 'Professor Fresh' });

                cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                  root = results[0];

                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').check();
                  cy.get('#app-menu').contains('Profile').click();
                  cy.contains('The Calgary Roughnecks').click();
                  cy.wait(200);
                });
              });
            });

            it('does not allow deletion', done => {
              cy.on('window:alert', (str) => {
                expect(str).to.eq('Remove all team members before deleting the team');
                done();
              });
              cy.get('#members-table table tbody').find('tr').its('length').should('eq', 2);
              cy.get('button#delete-team').click();
            });
          });

          context('no team members exist', () => {
            beforeEach(() => {
              // Login root (also serves as the other team member)
              cy.login(_profile.email, {..._profile, user_metadata: {
                                             teams: [
                                               {
                                                 id: teamId,
                                                 name: 'The Calgary Roughnecks',
                                                 leader: _profile.email,
                                               }
                                             ]
                                           }, name: 'Professor Fresh' });

              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                root = results[0];

                cy.get('#app-menu-button').click();
                cy.get('#admin-switch').check();
                cy.get('#app-menu').contains('Profile').click();
                cy.wait(200);
                cy.contains('The Calgary Roughnecks').click();
                cy.wait(200);
              });
            });

            it('displays a popup warning', function(done) {
              cy.on('window:confirm', (str) => {
                expect(str).to.eq('Delete team?');
                done();
              });
              cy.get('button#delete-team').click();
            });

            it('lands in the proper place', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('button#delete-team').click();
              cy.url().should('contain', '/#/agent');
            });

            it('renders the interface correctly on completion with success message', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('button#delete-team').click();
              cy.wait(200);
              cy.get('#teams-table').contains('No records to display');
              cy.contains('Team deleted');
            });
          });
        });

        context('switched off', () => {
          context('member agents exist', () => {

            beforeEach(() => {
              // Create another team member
              cy.login('regularguy@example.com', {..._profile, user_metadata: {
                                                      teams: [
                                                        {
                                                          id: teamId,
                                                          name: 'The Calgary Roughnecks',
                                                          leader: _profile.email,
                                                        }
                                                      ]
                                                    }, name: 'Regular Guy' });
              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='regularguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
                regularAgent = results[0];

                // Login root
                cy.login(_profile.email, {..._profile, user_metadata: {
                                               teams: [
                                                 {
                                                   id: teamId,
                                                   name: 'The Calgary Roughnecks',
                                                   leader: _profile.email,
                                                 }
                                               ]
                                             }, name: 'Professor Fresh' });

                cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                  root = results[0];

                  cy.get('#app-menu-button').click();
                  cy.wait(200); // This seems to only be required on `uncheck`
                  cy.get('#admin-switch').uncheck();
                  cy.get('#app-menu').contains('Profile').click();
                  cy.contains('The Calgary Roughnecks').click();
                  cy.wait(200);
                });
              });
            });

            it('does not allow deletion', function(done) {
              cy.on('window:alert', (str) => {
                expect(str).to.eq('Remove all team members before deleting the team');
                done();
              });
              cy.get('button#delete-team').click();
            });
          });

          context('no team members exist', () => {
            beforeEach(() => {
              // Login root (also serves as the other team member)
              cy.login(_profile.email, {..._profile, user_metadata: {
                                             teams: [
                                               {
                                                 id: teamId,
                                                 name: 'The Calgary Roughnecks',
                                                 leader: _profile.email,
                                               }
                                             ]
                                           }, name: 'Professor Fresh' });

              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                root = results[0];

                cy.get('#app-menu-button').click();
                cy.wait(200); // This seems to only be required on `uncheck`
                cy.get('#admin-switch').uncheck();
                cy.get('#app-menu').contains('Profile').click();
                cy.wait(200);
                cy.contains('The Calgary Roughnecks').click();
                cy.wait(200);
              });
            });

            it('displays a popup warning', function(done) {
              cy.on('window:confirm', (str) => {
                expect(str).to.eq('Delete team?');
                done();
              });
              cy.get('button#delete-team').click();
            });

            it('lands in the proper place', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('button#delete-team').click();
              cy.url().should('contain', '/#/agent');
            });

            it('renders the interface correctly on completion with success message', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('button#delete-team').click();
              cy.wait(200);
              cy.get('#teams-table').contains('No records to display');
              cy.contains('Team deleted');
            });
          });
        });
      });
    });

    describe('team created by a regular agent', () => {
      describe('admin mode', () => {
        context('switched on', () => {
          context('member agents exist', () => {
            beforeEach(() => {
              // Create another team member
              cy.login('regularguy@example.com', {..._profile, user_metadata: {
                                                      teams: [
                                                        {
                                                          id: teamId,
                                                          name: 'The Calgary Roughnecks',
                                                          leader: 'regularguy@example.com',
                                                        }
                                                      ]
                                                    }, name: 'Regular Guy' });
              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='regularguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
                regularAgent = results[0];

                // Login root (also serving as member agent)
                cy.login(_profile.email, {..._profile, user_metadata: {
                                               teams: [
                                                 {
                                                   id: teamId,
                                                   name: 'The Calgary Roughnecks',
                                                   leader: 'regularguy@example.com',
                                                 }
                                               ]
                                             }, name: 'Professor Fresh' });

                cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                  root = results[0];

                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').check();

                  cy.get('#app-menu').contains('Agent Directory').click();
                  cy.wait(200);
                  cy.contains(regularAgent.name).click();
                  cy.wait(200);
                  cy.contains('The Calgary Roughnecks').click();
                });
              });
            });

            it('does not allow deletion', function(done) {
              cy.on('window:alert', (str) => {
                expect(str).to.eq('Remove all team members before deleting the team');
                done();
              });
              cy.get('button#delete-team').click();
            });
          });

          context('no member agents exist', () => {
            beforeEach(() => {
              // Create another team member
              cy.login('regularguy@example.com', {..._profile, user_metadata: {
                                                      teams: [
                                                        {
                                                          id: teamId,
                                                          name: 'The Calgary Roughnecks',
                                                          leader: 'regularguy@example.com',
                                                        }
                                                      ]
                                                    }, name: 'Regular Guy' });
              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='regularguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
                regularAgent = results[0];

                // Login root
                cy.login(_profile.email, {..._profile, name: 'Professor Fresh' });

                cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                  root = results[0];

                  cy.get('#app-menu-button').click();
                  cy.get('#admin-switch').check();
                  cy.get('#app-menu').contains('Agent Directory').click();
                  cy.wait(200);
                  cy.contains(regularAgent.name).click();
                  cy.wait(200);
                  cy.contains('The Calgary Roughnecks').click();
                });
              });
            });

            it('displays a popup warning', function(done) {
              cy.on('window:confirm', (str) => {
                expect(str).to.eq('Delete team?');
                done();
              });
              cy.get('button#delete-team').click();
            });

            it('lands in the proper place', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('button#delete-team').click();
              cy.url().should('contain', `/#/agent/${regularAgent.socialProfile.user_id}`);
            });

            it('renders the interface correctly on completion with success message', () => {
              cy.on('window:confirm', (str) => {
                return true;
              });
              cy.get('button#delete-team').click();
              cy.wait(200);
              cy.get('#teams-table').contains('No records to display');
              cy.contains('Team deleted');
            });
          });
        });

        context('switched off', () => {
          beforeEach(() => {
            // Create another team member
            cy.login('regularguy@example.com', {..._profile, user_metadata: {
                                                    teams: [
                                                      {
                                                        id: teamId,
                                                        name: 'The Calgary Roughnecks',
                                                        leader: 'regularguy@example.com',
                                                      }
                                                    ]
                                                  }, name: 'Regular Guy' });
            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='regularguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
              regularAgent = results[0];

              // Login root (also serving as member agent)
              cy.login(_profile.email, {..._profile, name: 'Professor Fresh' });

              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                root = results[0];

                cy.get('#app-menu-button').click();
                cy.wait(200); // This seems to only be required on `uncheck`
                cy.get('#admin-switch').uncheck();
                cy.get('#app-menu').contains('Profile').click();
                cy.wait(200);
                cy.visit(`/#/team/${teamId}`);
              });
            });
          });

          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/team/${teamId}`);
          });

          it('tells you what\'s up', () => {
            cy.contains('You are not a member of that team');
          });
        });
      });
    });
  });
});

export {}
