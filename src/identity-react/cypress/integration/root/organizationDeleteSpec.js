context('root/Organization delete', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
    cy.fixture('roles-defined-at-auth0.json').as('roleDescriptions');
  });

  let organizerRole;
  before(function() {
    /**
     * 2020-7-16
     * Why can't this happen in the `before` block above?
     */
    organizerRole = this.roleDescriptions.find(r => r.name === 'organizer');
  });

  afterEach(() => {
    // Cypress thinks it can handle asynchronicity better than it can.
    // This makes sure sensitive tests complete before the DB is cleaned
    cy.wait(300);
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Updates" CASCADE;');
  });

  let _profile, root;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com', name: 'Professor Fresh'};
  });

  describe('Deleting', () => {
    beforeEach(function() {
      // Create root agent
      cy.login(_profile.email, _profile, [this.scope.create.organizations, this.scope.update.organizations]);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
        root = results[0];
      });
    });

    context('root is organizer', () => {
      beforeEach(function() {
        // The '123' role ID matches that defined in the RBAC mock server
        cy.request('POST', `https://localhost:3002/api/v2/users/${root.socialProfile.user_id}/roles`, { roles: [organizerRole.id] });

        // Login to make role assignment take effect
        cy.login(root.email, _profile, [this.scope.create.organizations, this.scope.update.organizations]);
        cy.get('#organizations-table button span span').contains('add_box').click();
        cy.get('input[placeholder="Name"]').type('The National Lacrosse League');
        cy.get('#organizations-table button[title="Save"]').click().then(() => {
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${root.email}' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];
          });
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {
//          beforeEach(() => {
//            cy.get('#app-menu-button').click();
//            cy.get('#admin-switch').check();
//            cy.get('#app-menu').contains('Profile').click();
//            cy.wait(200);
//          });

          describe('unsuccessfully', () => {

            context('when organization has member teams', () => {
              beforeEach(function() {
                // Create a member team
                cy.login('player@example.com', {..._profile, user_metadata: {
                                                           teams: [
                                                             {
                                                               id: 'some-team-uuid-v4',
                                                               name: 'The Calgary Roughnecks',
                                                               leader: 'coach@example.com',
                                                               organizationId: root.socialProfile.user_metadata.organizations[0].id,
                                                             }
                                                           ]
                                                         }, name: 'Tracey Kelusky' });
                // Login root agent
                cy.login(root.email, _profile, [this.scope.create.organizations, this.scope.delete.organizations]);

                cy.get('#app-menu-button').click();
                cy.get('#admin-switch').check();
                cy.get('#app-menu').contains('Profile').click();
                cy.wait(200);
                cy.contains('The National Lacrosse League').click();
                cy.wait(300);
              });

              it('does not allow deletion', done => {
                cy.on('window:alert', (str) => {
                  expect(str).to.eq('Remove all member teams before deleting the organization');
                  done();
                });
                cy.get('#delete-org').click();
              });
            });

      //      context('when team has pending invitations', () => {
      //        beforeEach(function() {
      //          // Login/create main test agent
      //          cy.login(_profile.email, _profile);
      //
      //          cy.contains('The A-Team').click();
      //          cy.wait(300);
      //
      //          // Invite agent to team
      //          cy.get('button span span').contains('add_box').click();
      //          cy.get('input[placeholder="Email"]').type('somenewguy@example.com');
      //          cy.get('button[title="Save"]').click();
      //          cy.wait(300);
      //        });
      //
      //        it('does not allow deletion', function(done) {
      //          cy.on('window:alert', (str) => {
      //            expect(str).to.eq('Remove all pending invitations before deleting the team');
      //            done();
      //          });
      //          cy.get('#delete-team').click();
      //        });
      //      });
          });

          describe('successfully', () => {
            context('when organization has no member teams', () => {
              beforeEach(function() {
                // Login root agent
                cy.login(root.email, _profile, [this.scope.create.organizations, this.scope.delete.organizations]);

                cy.get('#app-menu-button').click();
                cy.get('#admin-switch').check();
                cy.get('#app-menu').contains('Profile').click();
                cy.wait(200);
                cy.contains('The National Lacrosse League').click();
                cy.wait(300);
              });

              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Are you sure you want to delete this organization?');
                  done();
                });
                cy.get('#delete-org').click();
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('#delete-org').click();
                cy.url().should('contain', `/#/agent`);
              });

              it('removes record from the organizer\'s user_metadata', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                  cy.get('#delete-org').click();
                  cy.wait(300);
                  cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                    expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(0);
                  });
                });
              });

              it('renders the interface correctly on completion with success message', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('#delete-org').click();
                cy.wait(300);
                cy.get('#organizations-table table tbody tr td').contains('No records to display');
                cy.get('#flash-message').contains('Organization deleted');
              });

              it('doesn\'t mess up organization order', () => {
                cy.visit('/#/agent');
                cy.wait(300);

                cy.get('#organizations-table button span span').contains('add_box').click();
                cy.get('#organizations-table input[placeholder="Name"]').type('The National Hockey League');
                cy.get('#organizations-table button[title="Save"]').click();
                cy.wait(300);

                cy.get('#organizations-table button span span').contains('add_box').click();
                cy.get('#organizations-table input[placeholder="Name"]').type('The National Basketball Association');
                cy.get('#organizations-table button[title="Save"]').click();
                cy.wait(300);

                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 3);

                cy.contains('The National Hockey League').click();
                cy.wait(300);

                cy.get('#delete-org').click();
                cy.wait(300);

                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 2);
                cy.get('#organizations-table table tbody:nth-child(2)').find('tr:first-child').contains('The National Lacrosse League');
                cy.get('#organizations-table table tbody:nth-child(2)').find('tr:last-child').contains('The National Basketball Association');

                cy.contains('The National Lacrosse League').click();
                cy.wait(300);
                cy.get('#delete-org').click();
                cy.wait(300);

                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 1);
                cy.get('#organizations-table table tbody:nth-child(2)').find('tr:first-child').contains('The National Basketball Association');

                cy.contains('The National Basketball Association').click();
                cy.wait(300);
                cy.get('#delete-org').click();
                cy.wait(300);

                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 1);
                cy.get('#organizations-table table tbody:nth-child(2)').find('tr:first-child').contains('No records to display');
              });
            });

      //      describe('on team edit page', () => {
      //        context('when team has team members', () => {
      //          beforeEach(function() {
      //            cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: anotherAgent.email } }).then((res) => {
      //              cy.visit('/#/').then(() => {
      //                cy.get('#app-menu-button').click();
      //                cy.get('#organization-button').click();
      //                cy.contains('One Book Canada').click();
      //                cy.contains(team.name).click();
      //                cy.get('button#edit-team').click();
      //              });
      //            });
      //          });
      //
      //          it('does not allow deletion', function(done) {
      //            cy.on('window:alert', (str) => {
      //              expect(str).to.eq('Remove all team members before deleting the team');
      //              done();
      //            });
      //            cy.get('button#delete-team').click();
      //          });
      //        });
      //
      //        context('when team has no team members', () => {
      //          beforeEach(() => {
      //            cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
      //              expect(results.length).to.eq(1);
      //              expect(results[0].AgentId).to.eq(agent.id);
      //              cy.visit('/#/').then(() => {
      //                cy.get('#app-menu-button').click();
      //                cy.get('#organization-button').click();
      //                cy.contains('One Book Canada').click();
      //                cy.contains(team.name).click();
      //                cy.get('button#edit-team').click();
      //              });
      //            });
      //          });
      //
      //          it('displays a popup warning', function(done) {
      //            cy.on('window:confirm', (str) => {
      //              expect(str).to.eq('Delete team?');
      //              done();
      //            });
      //            cy.get('button#delete-team').click();
      //          });
      //
      //          it('lands in the proper place', () => {
      //            cy.on('window:confirm', (str) => {
      //              return true;
      //            });
      //            cy.get('button#delete-team').click();
      //            cy.url().should('contain', `/#/organization/${organization.id}`);
      //          });
      //
      //          it('removes record from the database', () => {
      //            cy.on('window:confirm', (str) => {
      //              return true;
      //            });
      //            cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
      //              expect(results.length).to.eq(1);
      //              cy.get('button#delete-team').click();
      //              cy.wait(500);
      //              cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
      //                expect(results.length).to.eq(0);
      //              });
      //            });
      //          });
      //
      //          it('renders the interface correctly on completion with success message', () => {
      //            cy.on('window:confirm', (str) => {
      //              return true;
      //            });
      //            cy.get('button#delete-team').click();
      //            cy.wait(500);
      //            cy.get('#organization-team-list').should('not.exist');
      //            cy.contains('Team deleted');
      //          });
      //        });
      //      });
          });
        });

        context('switched off', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.wait(200);
            cy.get('#admin-switch').uncheck();
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(200);
          });

          describe('unsuccessfully', () => {

            context('when organization has member teams', () => {
              beforeEach(function() {
                // Create a member team
                cy.login('player@example.com', {..._profile, user_metadata: {
                                                           teams: [
                                                             {
                                                               id: 'some-team-uuid-v4',
                                                               name: 'The Calgary Roughnecks',
                                                               leader: 'coach@example.com',
                                                               organizationId: root.socialProfile.user_metadata.organizations[0].id,
                                                             }
                                                           ]
                                                         }, name: 'Tracey Kelusky' });
                // Login root agent
                cy.login(root.email, _profile, [this.scope.create.organizations, this.scope.delete.organizations]);

                cy.contains('The National Lacrosse League').click();
                cy.wait(300);
              });

              it('does not allow deletion', done => {
                cy.on('window:alert', (str) => {
                  expect(str).to.eq('Remove all member teams before deleting the organization');
                  done();
                });
                cy.get('#delete-org').click();
              });
            });

      //      context('when team has pending invitations', () => {
      //        beforeEach(function() {
      //          // Login/create main test agent
      //          cy.login(_profile.email, _profile);
      //
      //          cy.contains('The A-Team').click();
      //          cy.wait(300);
      //
      //          // Invite agent to team
      //          cy.get('button span span').contains('add_box').click();
      //          cy.get('input[placeholder="Email"]').type('somenewguy@example.com');
      //          cy.get('button[title="Save"]').click();
      //          cy.wait(300);
      //        });
      //
      //        it('does not allow deletion', function(done) {
      //          cy.on('window:alert', (str) => {
      //            expect(str).to.eq('Remove all pending invitations before deleting the team');
      //            done();
      //          });
      //          cy.get('#delete-team').click();
      //        });
      //      });
          });

          describe('successfully', () => {
            context('when organization has no member teams', () => {
              beforeEach(() => {
                cy.contains('The National Lacrosse League').click();
                cy.wait(300);
              });

              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Are you sure you want to delete this organization?');
                  done();
                });
                cy.get('#delete-org').click();
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('#delete-org').click();
                cy.url().should('contain', `/#/agent`);
              });

              it('removes record from the organizer\'s user_metadata', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                  cy.get('#delete-org').click();
                  cy.wait(300);
                  cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                    expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(0);
                  });
                });
              });

              it('renders the interface correctly on completion with success message', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('#delete-org').click();
                cy.wait(300);
                cy.get('#organizations-table table tbody tr td').contains('No records to display');
                cy.get('#flash-message').contains('Organization deleted');
              });

              it('doesn\'t mess up organization order', () => {
                cy.visit('/#/agent');
                cy.wait(300);

                cy.get('#organizations-table button span span').contains('add_box').click();
                cy.get('#organizations-table input[placeholder="Name"]').type('The National Hockey League');
                cy.get('#organizations-table button[title="Save"]').click();
                cy.wait(300);

                cy.get('#organizations-table button span span').contains('add_box').click();
                cy.get('#organizations-table input[placeholder="Name"]').type('The National Basketball Association');
                cy.get('#organizations-table button[title="Save"]').click();
                cy.wait(300);

                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 3);

                cy.contains('The National Hockey League').click();
                cy.wait(300);

                cy.get('#delete-org').click();
                cy.wait(300);

                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 2);
                cy.get('#organizations-table table tbody:nth-child(2)').find('tr:first-child').contains('The National Lacrosse League');
                cy.get('#organizations-table table tbody:nth-child(2)').find('tr:last-child').contains('The National Basketball Association');

                cy.contains('The National Lacrosse League').click();
                cy.wait(300);
                cy.get('#delete-org').click();
                cy.wait(300);

                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 1);
                cy.get('#organizations-table table tbody:nth-child(2)').find('tr:first-child').contains('The National Basketball Association');

                cy.contains('The National Basketball Association').click();
                cy.wait(300);
                cy.get('#delete-org').click();
                cy.wait(300);

                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 1);
                cy.get('#organizations-table table tbody:nth-child(2)').find('tr:first-child').contains('No records to display');
              });
            });

      //      describe('on team edit page', () => {
      //        context('when team has team members', () => {
      //          beforeEach(function() {
      //            cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: anotherAgent.email } }).then((res) => {
      //              cy.visit('/#/').then(() => {
      //                cy.get('#app-menu-button').click();
      //                cy.get('#organization-button').click();
      //                cy.contains('One Book Canada').click();
      //                cy.contains(team.name).click();
      //                cy.get('button#edit-team').click();
      //              });
      //            });
      //          });
      //
      //          it('does not allow deletion', function(done) {
      //            cy.on('window:alert', (str) => {
      //              expect(str).to.eq('Remove all team members before deleting the team');
      //              done();
      //            });
      //            cy.get('button#delete-team').click();
      //          });
      //        });
      //
      //        context('when team has no team members', () => {
      //          beforeEach(() => {
      //            cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
      //              expect(results.length).to.eq(1);
      //              expect(results[0].AgentId).to.eq(agent.id);
      //              cy.visit('/#/').then(() => {
      //                cy.get('#app-menu-button').click();
      //                cy.get('#organization-button').click();
      //                cy.contains('One Book Canada').click();
      //                cy.contains(team.name).click();
      //                cy.get('button#edit-team').click();
      //              });
      //            });
      //          });
      //
      //          it('displays a popup warning', function(done) {
      //            cy.on('window:confirm', (str) => {
      //              expect(str).to.eq('Delete team?');
      //              done();
      //            });
      //            cy.get('button#delete-team').click();
      //          });
      //
      //          it('lands in the proper place', () => {
      //            cy.on('window:confirm', (str) => {
      //              return true;
      //            });
      //            cy.get('button#delete-team').click();
      //            cy.url().should('contain', `/#/organization/${organization.id}`);
      //          });
      //
      //          it('removes record from the database', () => {
      //            cy.on('window:confirm', (str) => {
      //              return true;
      //            });
      //            cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
      //              expect(results.length).to.eq(1);
      //              cy.get('button#delete-team').click();
      //              cy.wait(500);
      //              cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
      //                expect(results.length).to.eq(0);
      //              });
      //            });
      //          });
      //
      //          it('renders the interface correctly on completion with success message', () => {
      //            cy.on('window:confirm', (str) => {
      //              return true;
      //            });
      //            cy.get('button#delete-team').click();
      //            cy.wait(500);
      //            cy.get('#organization-team-list').should('not.exist');
      //            cy.contains('Team deleted');
      //          });
      //        });
      //      });
          });
        });
      });
    });

    context('root is unaffiliated', () => {

      let organizer;
      beforeEach(function() {
        cy.login('organizer@example.com', {..._profile, name: 'Nick Sakiewicz' }, [this.scope.create.organizations, this.scope.update.organizations]);

        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='organizer@example.com' LIMIT 1;`).then(([results, metadata]) => {
          organizer = results[0];

          // The '123' role ID matches that defined in the RBAC mock server
          cy.request('POST', `https://localhost:3002/api/v2/users/${organizer.socialProfile.user_id}/roles`, { roles: ['123'] });
          cy.login('organizer@example.com', {..._profile, name: 'Nick Sakiewicz' }, [this.scope.create.organizations, this.scope.update.organizations]);

          cy.get('#organizations-table button span span').contains('add_box').click();
          cy.get('input[placeholder="Name"]').type('The National Lacrosse League');
          cy.get('#organizations-table button[title="Save"]').click();

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='organizer@example.com' LIMIT 1;`).then(([results, metadata]) => {
            organizer = results[0];
          });
        });
      });

      describe('admin mode', () => {
        beforeEach(() => {
          cy.login(root.email, _profile);

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${root.email}' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];
          });
        });


        context('switched on', () => {
//          beforeEach(() => {
//            cy.get('#app-menu-button').click();
//            cy.get('#admin-switch').check();
//            cy.get('#app-menu').contains('Agent Directory').click();
//            cy.wait(200);
//            cy.contains(organizer.name).click();
//            cy.wait(300);
//            cy.contains('The National Lacrosse League').click();
//            cy.wait(300);
//          });

          describe('unsuccessfully', () => {

            context('when organization has member teams', () => {
              beforeEach(function() {
                // Create a member team
                cy.login('player@example.com', {..._profile, user_metadata: {
                                                           teams: [
                                                             {
                                                               id: 'some-team-uuid-v4',
                                                               name: 'The Calgary Roughnecks',
                                                               leader: 'coach@example.com',
                                                               organizationId: organizer.socialProfile.user_metadata.organizations[0].id,
                                                             }
                                                           ]
                                                         }, name: 'Tracey Kelusky' });
                // Login root agent
                cy.login(root.email, _profile, [this.scope.create.organizations, this.scope.delete.organizations]);

                cy.get('#app-menu-button').click();
                cy.get('#admin-switch').check();
                cy.get('#app-menu').contains('Agent Directory').click();
                cy.wait(200);
                cy.contains(organizer.name).click();
                cy.wait(300);
                cy.contains('The National Lacrosse League').click();
                cy.wait(300);
              });

              it('does not allow deletion', done => {
                cy.on('window:alert', (str) => {
                  expect(str).to.eq('Remove all member teams before deleting the organization');
                  done();
                });
                cy.get('#delete-org').click();
              });
            });

      //      context('when team has pending invitations', () => {
      //        beforeEach(function() {
      //          // Login/create main test agent
      //          cy.login(_profile.email, _profile);
      //
      //          cy.contains('The A-Team').click();
      //          cy.wait(300);
      //
      //          // Invite agent to team
      //          cy.get('button span span').contains('add_box').click();
      //          cy.get('input[placeholder="Email"]').type('somenewguy@example.com');
      //          cy.get('button[title="Save"]').click();
      //          cy.wait(300);
      //        });
      //
      //        it('does not allow deletion', function(done) {
      //          cy.on('window:alert', (str) => {
      //            expect(str).to.eq('Remove all pending invitations before deleting the team');
      //            done();
      //          });
      //          cy.get('#delete-team').click();
      //        });
      //      });
          });

          describe('successfully', () => {
            context('when organization has no member teams', () => {
              beforeEach(() => {
                cy.get('#app-menu-button').click();
                cy.get('#admin-switch').check();
                cy.get('#app-menu').contains('Agent Directory').click();
                cy.wait(200);
                cy.contains(organizer.name).click();
                cy.wait(300);
                cy.contains('The National Lacrosse League').click();
                cy.wait(300);
              });

              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Are you sure you want to delete this organization?');
                  done();
                });
                cy.get('#delete-org').click();
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('#delete-org').click();
                cy.url().should('contain', `/#/agent/${organizer.socialProfile.user_id}`);
              });

              it('removes record from the organizer\'s user_metadata', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${organizer.email}' LIMIT 1;`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                  cy.get('#delete-org').click();
                  cy.wait(300);
                  cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${organizer.email}' LIMIT 1;`).then(([results, metadata]) => {
                    expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(0);
                  });
                });
              });

              it('renders the interface correctly on completion with success message', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('#delete-org').click();
                cy.wait(300);
                cy.get('#organizations-table table tbody tr td').contains('No records to display');
                cy.get('#flash-message').contains('Organization deleted');
              });

              it('doesn\'t mess up organization order', function() {
                // Create some new organizations
                cy.login('organizer@example.com', {..._profile, name: 'Nick Sakiewicz' }, [this.scope.create.organizations, this.scope.update.organizations]);

                cy.get('#organizations-table button span span').contains('add_box').click();
                cy.get('#organizations-table input[placeholder="Name"]').type('The National Hockey League');
                cy.get('#organizations-table button[title="Save"]').click();
                cy.wait(300);

                cy.get('#organizations-table button span span').contains('add_box').click();
                cy.get('#organizations-table input[placeholder="Name"]').type('The National Basketball Association');
                cy.get('#organizations-table button[title="Save"]').click();
                cy.wait(300);

                // Log root back in
                cy.login(_profile.email, _profile);
                cy.get('#app-menu-button').click();
                cy.get('#admin-switch').check();
                cy.get('#app-menu').contains('Agent Directory').click();
                cy.wait(200);
                cy.contains(organizer.name).click();
                cy.wait(300);

                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 3);

                cy.contains('The National Hockey League').click();
                cy.wait(300);

                cy.get('#delete-org').click();
                cy.wait(300);

                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 2);
                cy.get('#organizations-table table tbody:nth-child(2)').find('tr:first-child').contains('The National Lacrosse League');
                cy.get('#organizations-table table tbody:nth-child(2)').find('tr:last-child').contains('The National Basketball Association');

                cy.contains('The National Lacrosse League').click();
                cy.wait(300);
                cy.get('#delete-org').click();
                cy.wait(300);

                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 1);
                cy.get('#organizations-table table tbody:nth-child(2)').find('tr:first-child').contains('The National Basketball Association');

                cy.contains('The National Basketball Association').click();
                cy.wait(300);
                cy.get('#delete-org').click();
                cy.wait(300);

                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 1);
                cy.get('#organizations-table table tbody:nth-child(2)').find('tr:first-child').contains('No records to display');
              });
            });


      //      describe('on team edit page', () => {
      //        context('when team has team members', () => {
      //          beforeEach(function() {
      //            cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: anotherAgent.email } }).then((res) => {
      //              cy.visit('/#/').then(() => {
      //                cy.get('#app-menu-button').click();
      //                cy.get('#organization-button').click();
      //                cy.contains('One Book Canada').click();
      //                cy.contains(team.name).click();
      //                cy.get('button#edit-team').click();
      //              });
      //            });
      //          });
      //
      //          it('does not allow deletion', function(done) {
      //            cy.on('window:alert', (str) => {
      //              expect(str).to.eq('Remove all team members before deleting the team');
      //              done();
      //            });
      //            cy.get('button#delete-team').click();
      //          });
      //        });
      //
      //        context('when team has no team members', () => {
      //          beforeEach(() => {
      //            cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
      //              expect(results.length).to.eq(1);
      //              expect(results[0].AgentId).to.eq(agent.id);
      //              cy.visit('/#/').then(() => {
      //                cy.get('#app-menu-button').click();
      //                cy.get('#organization-button').click();
      //                cy.contains('One Book Canada').click();
      //                cy.contains(team.name).click();
      //                cy.get('button#edit-team').click();
      //              });
      //            });
      //          });
      //
      //          it('displays a popup warning', function(done) {
      //            cy.on('window:confirm', (str) => {
      //              expect(str).to.eq('Delete team?');
      //              done();
      //            });
      //            cy.get('button#delete-team').click();
      //          });
      //
      //          it('lands in the proper place', () => {
      //            cy.on('window:confirm', (str) => {
      //              return true;
      //            });
      //            cy.get('button#delete-team').click();
      //            cy.url().should('contain', `/#/organization/${organization.id}`);
      //          });
      //
      //          it('removes record from the database', () => {
      //            cy.on('window:confirm', (str) => {
      //              return true;
      //            });
      //            cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
      //              expect(results.length).to.eq(1);
      //              cy.get('button#delete-team').click();
      //              cy.wait(500);
      //              cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
      //                expect(results.length).to.eq(0);
      //              });
      //            });
      //          });
      //
      //          it('renders the interface correctly on completion with success message', () => {
      //            cy.on('window:confirm', (str) => {
      //              return true;
      //            });
      //            cy.get('button#delete-team').click();
      //            cy.wait(500);
      //            cy.get('#organization-team-list').should('not.exist');
      //            cy.contains('Team deleted');
      //          });
      //        });
      //      });
          });
        });

        context('switched off', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.wait(200);
            cy.get('#admin-switch').uncheck();
            cy.get('#app-menu').contains('Profile').click();
            cy.visit(`/#/organization/${organizer.socialProfile.user_metadata.organizations[0].id}`);
          });

          it('displays the correct UI components', () => {
            cy.get('button#delete-org').should('not.exist');
            cy.get('button#save-org').should('not.exist');
            cy.get('button#cancel-org-changes').should('not.exist');
            cy.get('#org-name-field').should('be.disabled');
          });
        });
      });
    });
  });
});

export {}
