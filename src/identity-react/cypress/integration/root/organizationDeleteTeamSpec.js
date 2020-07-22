// 2020-7-16 https://github.com/cypress-io/cypress/issues/1271
// Can't import regular Javascript as a fixture
import rolePermissions from '../../fixtures/roles-with-permissions.js';

context('root/Organization delete team', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
    cy.fixture('permissions.js').as('scope');
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
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Updates" CASCADE;');
  });

  let _profile, root, teamLeaderAgent;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com', name: 'Professor Fresh'};

    // A convenient way to create a new team leader agent
    cy.login('coach@example.com', {..._profile, email: 'coach@example.com', name: 'Curt Malawsky'});
    // Create a team
    cy.get('#teams-table button span span').contains('add_box').click();
    cy.get('#teams-table table tbody tr td div div input[placeholder="Name"]').type('The Calgary Roughnecks');
    cy.get('#teams-table table tbody tr td div button[title="Save"]').click();
    cy.wait(300);

    cy.task('query', `SELECT * FROM "Agents" WHERE "email"='coach@example.com' LIMIT 1;`).then(([results, metadata]) => {
      teamLeaderAgent = results[0];

      // Login root
      cy.login(_profile.email, _profile);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
        root = results[0];
      });
    });
  });

  context('authenticated', () => {

    context('root is organizer', () => {
      beforeEach(() => {

        cy.request('POST', `https://localhost:3002/api/v2/users/${root.socialProfile.user_id}/roles`, { roles: [organizerRole.id] });

        // Login again to enable organizer status
        cy.login(_profile.email, _profile, rolePermissions.organizer);
        cy.get('#organizations-table button span span').contains('add_box').click();
        cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('The National Lacrosse League');
        cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();
        cy.wait(300);

        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          root = results[0];
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {

          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.wait(100);
            cy.contains('Agent Directory').click();
            cy.wait(300);
            cy.contains(teamLeaderAgent.name).click();
            cy.wait(300);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(300);
            cy.get('#team-profile-info #add-team-to-organization').click();
            cy.wait(300);
            cy.get('#organizations-table table tbody tr td button').contains('add').click();
            cy.wait(300);
          });

          context('in Team view', () => {
            it('displays the appropriate organizer interface', () => {
              cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 3);
              cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', 'The Calgary Roughnecks');
              cy.get('#team-profile-info tbody tr td input#team-name-field').should('not.be.disabled');
              cy.get('#team-profile-info tbody tr td').contains('coach@example.com');
              cy.get('#team-profile-info #remove-team-from-organization').should('exist');
              cy.get('#team-profile-info #add-team-to-organization').should('not.exist');
              cy.get('button#delete-team').should('exist');
              cy.get('#team-profile-info button#save-team').should('not.exist');
              cy.get('#team-profile-info button#cancel-team-changes').should('not.exist');
            });

            describe('#remove-team-from-organization', () => {
              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Remove team from organization?');
                  done();
                });
                // Delete member team
                cy.get('#team-profile-info #remove-team-from-organization').click();
              });

              it('updates the interface', () => {
                cy.on('window:confirm', str => true);

                // Delete member team
                cy.get('#team-profile-info #remove-team-from-organization').click();

                cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 3);
                cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', 'The Calgary Roughnecks');
                cy.get('#team-profile-info tbody tr td input#team-name-field').should('not.be.disabled');
                cy.get('#team-profile-info tbody tr td').contains('coach@example.com');
                cy.get('#team-profile-info #remove-team-from-organization').should('not.exist');
                cy.get('#team-profile-info #add-team-to-organization').should('exist');
                cy.get('button#delete-team').should('exist');
                cy.get('#team-profile-info button#save-team').should('not.exist');
                cy.get('#team-profile-info button#cancel-team-changes').should('not.exist');
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', str => true);

                cy.url().should('contain', `/#/team/${teamLeaderAgent.socialProfile.user_metadata.teams[0].id}`);
                // Delete member
                cy.get('#team-profile-info #remove-team-from-organization').click();
                cy.wait(300);
                cy.url().should('contain', `/#/team/${teamLeaderAgent.socialProfile.user_metadata.teams[0].id}`);
              });

              it('displays a success message', () => {
                cy.on('window:confirm', str => true);
                cy.get('#team-profile-info #remove-team-from-organization').click();
                cy.wait(300);
                cy.contains(`${teamLeaderAgent.socialProfile.user_metadata.teams[0].name} have been removed from ${root.socialProfile.user_metadata.organizations[0].name}`);
              });

              it('displays progress spinner', () => {
                cy.on('window:confirm', str => true);
                cy.get('#progress-spinner').should('not.exist');
                cy.get('#team-profile-info #remove-team-from-organization').click();
                // 2020-5-21
                // Cypress goes too fast for this. Cypress also cannot intercept
                // native `fetch` calls to allow stubbing and delaying the route.
                // Shamefully, this is currently manually tested, though I suspect
                // I will use this opportunity to learn Jest
                // Despite its name, this test really ensures the spinner disappears
                // after all is said and done
                //cy.get('#progress-spinner').should('exist');
                cy.wait(100);
                cy.get('#progress-spinner').should('not.exist');
              });
            });
          });

          context('in Organization view', () => {
            beforeEach(() => {
              cy.get('#app-menu-button').click();
              cy.contains('Profile').click();
              cy.wait(300);
              cy.contains('The National Lacrosse League').click();
              cy.wait(300);
            });

            it('displays the appropriate organizer interface', () => {
              cy.get('#member-teams-table tbody').find('tr').its('length').should('eq', 1);

              cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').should('exist');
              cy.get('#member-teams-table table tbody tr:nth-of-type(1) td a')
                .should('contain', teamLeaderAgent.socialProfile.user_metadata.teams[0].name)
                .and('have.attr', 'href')
                .and('equal', `#team/${teamLeaderAgent.socialProfile.user_metadata.teams[0].id}`);
              cy.get('#member-teams-table table tbody tr:nth-of-type(1) td').contains(teamLeaderAgent.email);
            });

            describe('record delete button', () => {
              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Remove team from organization?');
                  done();
                });
                // Delete member team
                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();
              });

              it('updates the interface', () => {
                cy.on('window:confirm', str => true);

                // Delete member team
                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();
                cy.wait(300);

                cy.get('#member-teams-table tbody').find('tr').its('length').should('eq', 1);
                cy.get('#member-teams-table table tbody tr td').contains('No records to display').should('exist');
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', str => true);

                cy.url().should('contain', `/#/organization/${root.socialProfile.user_metadata.organizations[0].id}`);
                // Delete member
                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();

                cy.wait(300);
                cy.url().should('contain', `/#/organization/${root.socialProfile.user_metadata.organizations[0].id}`);
              });

              it('displays a success message', () => {
                cy.on('window:confirm', str => true);
                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();
                cy.wait(300);
                cy.contains(`${teamLeaderAgent.socialProfile.user_metadata.teams[0].name} have been removed from ${root.socialProfile.user_metadata.organizations[0].name}`);
              });

              it('displays progress spinner', () => {
                cy.on('window:confirm', str => true);
                cy.get('#progress-spinner').should('not.exist');

                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();

                // 2020-5-21
                // Cypress goes too fast for this. Cypress also cannot intercept
                // native `fetch` calls to allow stubbing and delaying the route.
                // Shamefully, this is currently manually tested, though I suspect
                // I will use this opportunity to learn Jest
                // Despite its name, this test really ensures the spinner disappears
                // after all is said and done
                //cy.get('#progress-spinner').should('exist');
                cy.wait(100);
                cy.get('#progress-spinner').should('not.exist');
              });
            });
          });
        });
      });
    });

    context('root is team member', () => {
      let anotherOrganizerAgent;
      beforeEach(function() {

        // A convenient way to create a new team leader agent
        cy.login('coach@example.com', {..._profile, email: 'coach@example.com', name: 'Curt Malawsky'});

        cy.contains('The Calgary Roughnecks').click();
        cy.wait(300);

        cy.get('button span span').contains('add_box').click();
        cy.get('input[placeholder="Email"]').type(root.email);
        cy.get('button[title="Save"]').click();
        cy.wait(300);

        // Login/create another organizer agent
        cy.login('someotherorganizer@example.com', {..._profile, email: 'someotherorganizer@example.com', name: 'Some Other Organizer'}, rolePermissions.organizer);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherorganizer@example.com' LIMIT 1;`).then(([results, metadata]) => {
          anotherOrganizerAgent = results[0];
          cy.request('POST', `https://localhost:3002/api/v2/users/${anotherOrganizerAgent.socialProfile.user_id}/roles`, { roles: [organizerRole.id] });

          cy.wait(300);
          cy.login('someotherorganizer@example.com', {..._profile, email: 'someotherorganizer@example.com', name: 'Some Other Organizer'}, rolePermissions.organizer);

          // Create organization
          cy.get('#organizations-table button span span').contains('add_box').click();
          cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('The National Lacrosse League');
          cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();
          cy.wait(300);

          cy.get('#app-menu-button').click();
          cy.contains('Agent Directory').click();
          cy.wait(300);
          cy.contains(teamLeaderAgent.name).click();
          cy.wait(300);
          cy.contains('The Calgary Roughnecks').click();
          cy.wait(300);
          // Add team to organization
          cy.get('#team-profile-info #add-team-to-organization').click();
          cy.wait(300);
          cy.get('#organizations-table table tbody tr td button').contains('add').click();
          cy.wait(300);

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherorganizer@example.com' LIMIT 1;`).then(([results, metadata]) => {
            anotherOrganizerAgent = results[0];

            // Login root
            cy.login(_profile.email, _profile);
            // Accept team invitation
            cy.get('#rsvps-table table tbody').find('tr').its('length').should('eq', 1);
            cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
            cy.wait(300);
          });
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {

          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.wait(100);
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(300);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(300);
          });

          context('in Team view', () => {
            it('displays the appropriate root interface', () => {
              cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 3);
              cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', 'The Calgary Roughnecks');
              cy.get('#team-profile-info tbody tr td input#team-name-field').should('not.be.disabled');
              cy.get('#team-profile-info tbody tr td').contains('coach@example.com');
              cy.get('#team-profile-info #remove-team-from-organization').should('exist');
              cy.get('#team-profile-info #add-team-to-organization').should('not.exist');
              cy.get('button#delete-team').should('exist');
              cy.get('#team-profile-info button#save-team').should('not.exist');
              cy.get('#team-profile-info button#cancel-team-changes').should('not.exist');
            });

            describe('#remove-team-from-organization', () => {
              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Remove team from organization?');
                  done();
                });
                // Delete member team
                cy.get('#team-profile-info #remove-team-from-organization').click();
              });

              it('updates the interface', () => {
                cy.on('window:confirm', str => true);

                // Delete member team
                cy.get('#team-profile-info #remove-team-from-organization').click();

                cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 3);
                cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', 'The Calgary Roughnecks');
                cy.get('#team-profile-info tbody tr td input#team-name-field').should('not.be.disabled');
                cy.get('#team-profile-info tbody tr td').contains('coach@example.com');
                cy.get('#team-profile-info #remove-team-from-organization').should('not.exist');
                cy.get('#team-profile-info #add-team-to-organization').should('not.exist');
                cy.get('button#delete-team').should('exist');
                cy.get('#team-profile-info button#save-team').should('not.exist');
                cy.get('#team-profile-info button#cancel-team-changes').should('not.exist');
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', str => true);

                cy.url().should('contain', `/#/team/${teamLeaderAgent.socialProfile.user_metadata.teams[0].id}`);
                // Delete member
                cy.get('#team-profile-info #remove-team-from-organization').click();
                cy.wait(300);
                cy.url().should('contain', `/#/team/${teamLeaderAgent.socialProfile.user_metadata.teams[0].id}`);
              });

              it('displays a success message', () => {
                cy.on('window:confirm', str => true);
                cy.get('#team-profile-info #remove-team-from-organization').click();
                cy.wait(300);
                cy.contains(`${teamLeaderAgent.socialProfile.user_metadata.teams[0].name} have been removed from ${anotherOrganizerAgent.socialProfile.user_metadata.organizations[0].name}`);
              });

              it('displays progress spinner', () => {
                cy.on('window:confirm', str => true);
                cy.get('#progress-spinner').should('not.exist');
                cy.get('#team-profile-info #remove-team-from-organization').click();
                // 2020-5-21
                // Cypress goes too fast for this. Cypress also cannot intercept
                // native `fetch` calls to allow stubbing and delaying the route.
                // Shamefully, this is currently manually tested, though I suspect
                // I will use this opportunity to learn Jest
                // Despite its name, this test really ensures the spinner disappears
                // after all is said and done
                //cy.get('#progress-spinner').should('exist');
                cy.wait(100);
                cy.get('#progress-spinner').should('not.exist');
              });
            });
          });

          context('in Organization view', () => {
            beforeEach(() => {
              cy.get('#app-menu-button').click();
              cy.contains('Profile').click();
              cy.wait(300);
              cy.contains('The Calgary Roughnecks').click();
              cy.wait(300);
              cy.contains('The National Lacrosse League').click();
              cy.wait(300);
            });

            it('displays the appropriate organizer interface', () => {
              cy.get('#member-teams-table tbody').find('tr').its('length').should('eq', 1);

              cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').should('exist');
              cy.get('#member-teams-table table tbody tr:nth-of-type(1) td a')
                .should('contain', teamLeaderAgent.socialProfile.user_metadata.teams[0].name)
                .and('have.attr', 'href')
                .and('equal', `#team/${teamLeaderAgent.socialProfile.user_metadata.teams[0].id}`);
              cy.get('#member-teams-table table tbody tr:nth-of-type(1) td').contains(teamLeaderAgent.email);
            });

            describe('record delete button', () => {
              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Remove team from organization?');
                  done();
                });
                // Delete member team
                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();
              });

              it('updates the interface', () => {
                cy.on('window:confirm', str => true);

                // Delete member team
                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();
                cy.wait(300);

                cy.get('#member-teams-table tbody').find('tr').its('length').should('eq', 1);
                cy.get('#member-teams-table table tbody tr td').contains('No records to display').should('exist');
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', str => true);

                cy.url().should('contain', `/#/organization/${anotherOrganizerAgent.socialProfile.user_metadata.organizations[0].id}`);
                // Delete member
                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();

                cy.wait(300);
                cy.url().should('contain', `/#/organization/${anotherOrganizerAgent.socialProfile.user_metadata.organizations[0].id}`);
              });

              it('displays a success message', () => {
                cy.on('window:confirm', str => true);
                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();
                cy.wait(300);
                cy.contains(`${teamLeaderAgent.socialProfile.user_metadata.teams[0].name} have been removed from ${anotherOrganizerAgent.socialProfile.user_metadata.organizations[0].name}`);
              });

              it('displays progress spinner', () => {
                cy.on('window:confirm', str => true);
                cy.get('#progress-spinner').should('not.exist');

                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();

                // 2020-5-21
                // Cypress goes too fast for this. Cypress also cannot intercept
                // native `fetch` calls to allow stubbing and delaying the route.
                // Shamefully, this is currently manually tested, though I suspect
                // I will use this opportunity to learn Jest
                // Despite its name, this test really ensures the spinner disappears
                // after all is said and done
                //cy.get('#progress-spinner').should('exist');
                cy.wait(100);
                cy.get('#progress-spinner').should('not.exist');
              });
            });
          });
        });
      });
    });

    context('root is team leader', () => {
      let anotherOrganizerAgent;
      beforeEach(function() {
        // Create a team
        cy.contains('Identity').click();
        cy.get('#teams-table button span span').contains('add_box').click();
        cy.get('#teams-table table tbody tr td div div input[placeholder="Name"]').type('The Saskatchewan Rush');
        cy.get('#teams-table table tbody tr td div button[title="Save"]').click();
        cy.wait(300);
        cy.contains('The Saskatchewan Rush').click();
        cy.wait(300);

        // Add team to organization
        // Login/create another organizer agent
        cy.login('someotherorganizer@example.com', {..._profile, email: 'someotherorganizer@example.com', name: 'Some Other Organizer'}, rolePermissions.organizer);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherorganizer@example.com' LIMIT 1;`).then(([results, metadata]) => {
          anotherOrganizerAgent = results[0];
          cy.request('POST', `https://localhost:3002/api/v2/users/${anotherOrganizerAgent.socialProfile.user_id}/roles`, { roles: [organizerRole.id] });

          cy.wait(300);
          cy.login('someotherorganizer@example.com', {..._profile, email: 'someotherorganizer@example.com', name: 'Some Other Organizer'}, rolePermissions.organizer);

          // Create organization
          cy.get('#organizations-table button span span').contains('add_box').click();
          cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('The National Lacrosse League');
          cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();
          cy.wait(300);

          cy.get('#app-menu-button').click();
          cy.contains('Agent Directory').click();
          cy.wait(300);
          cy.contains(root.name).click();
          cy.wait(300);
          cy.contains('The Saskatchewan Rush').click();
          cy.wait(300);
          // Add team to organization
          cy.get('#team-profile-info #add-team-to-organization').click();
          cy.wait(300);
          cy.get('#organizations-table table tbody tr td button').contains('add').click();
          cy.wait(300);
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherorganizer@example.com' LIMIT 1;`).then(([results, metadata]) => {
            anotherOrganizerAgent = results[0];

            // Login root
            cy.login(_profile.email, _profile);
            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
              root = results[0];
            });
          });
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {

          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.wait(100);
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(300);
            cy.contains('The Saskatchewan Rush').click();
            cy.wait(300);
          });

          context('in Team view', () => {
            it('displays the appropriate root interface', () => {
              cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 3);
              cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', 'The Saskatchewan Rush');
              cy.get('#team-profile-info tbody tr td input#team-name-field').should('not.be.disabled');
              cy.get('#team-profile-info tbody tr td').contains(root.email);
              cy.get('#team-profile-info #remove-team-from-organization').should('exist');
              cy.get('#team-profile-info #add-team-to-organization').should('not.exist');
              cy.get('button#delete-team').should('exist');
              cy.get('#team-profile-info button#save-team').should('not.exist');
              cy.get('#team-profile-info button#cancel-team-changes').should('not.exist');
            });

            describe('#remove-team-from-organization', () => {
              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Remove team from organization?');
                  done();
                });
                // Delete member team
                cy.get('#team-profile-info #remove-team-from-organization').click();
              });

              it('updates the interface', () => {
                cy.on('window:confirm', str => true);

                // Delete member team
                cy.get('#team-profile-info #remove-team-from-organization').click();

                cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 3);
                cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', 'The Saskatchewan Rush');
                cy.get('#team-profile-info tbody tr td input#team-name-field').should('not.be.disabled');
                cy.get('#team-profile-info tbody tr td').contains(root.email);
                cy.get('#team-profile-info #remove-team-from-organization').should('not.exist');
                cy.get('#team-profile-info #add-team-to-organization').should('not.exist');
                cy.get('button#delete-team').should('exist');
                cy.get('#team-profile-info button#save-team').should('not.exist');
                cy.get('#team-profile-info button#cancel-team-changes').should('not.exist');
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', str => true);

                cy.url().should('contain', `/#/team/${root.socialProfile.user_metadata.teams[0].id}`);
                // Delete member
                cy.get('#team-profile-info #remove-team-from-organization').click();
                cy.wait(300);
                cy.url().should('contain', `/#/team/${root.socialProfile.user_metadata.teams[0].id}`);
              });

              it('displays a success message', () => {
                cy.on('window:confirm', str => true);
                cy.get('#team-profile-info #remove-team-from-organization').click();
                cy.wait(300);

                cy.contains(`${root.socialProfile.user_metadata.teams[0].name} have been removed from ${anotherOrganizerAgent.socialProfile.user_metadata.organizations[0].name}`);
              });

              it('displays progress spinner', () => {
                cy.on('window:confirm', str => true);
                cy.get('#progress-spinner').should('not.exist');
                cy.get('#team-profile-info #remove-team-from-organization').click();
                // 2020-5-21
                // Cypress goes too fast for this. Cypress also cannot intercept
                // native `fetch` calls to allow stubbing and delaying the route.
                // Shamefully, this is currently manually tested, though I suspect
                // I will use this opportunity to learn Jest
                // Despite its name, this test really ensures the spinner disappears
                // after all is said and done
                //cy.get('#progress-spinner').should('exist');
                cy.wait(100);
                cy.get('#progress-spinner').should('not.exist');
              });
            });
          });

          context('in Organization view', () => {
            beforeEach(() => {
              cy.get('#app-menu-button').click();
              cy.contains('Profile').click();
              cy.wait(300);
              cy.contains('The Saskatchewan Rush').click();
              cy.wait(300);
              cy.contains('The National Lacrosse League').click();
              cy.wait(300);
            });

            it('displays the appropriate organizer interface', () => {
              cy.get('#member-teams-table tbody').find('tr').its('length').should('eq', 1);

              cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').should('exist');
              cy.get('#member-teams-table table tbody tr:nth-of-type(1) td a')
                .should('contain', root.socialProfile.user_metadata.teams[0].name)
                .and('have.attr', 'href')
                .and('equal', `#team/${root.socialProfile.user_metadata.teams[0].id}`);
              cy.get('#member-teams-table table tbody tr:nth-of-type(1) td').contains(root.email);
            });

            describe('record delete button', () => {
              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Remove team from organization?');
                  done();
                });
                // Delete member team
                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();
              });

              it('updates the interface', () => {
                cy.on('window:confirm', str => true);

                // Delete member team
                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();
                cy.wait(300);

                cy.get('#member-teams-table tbody').find('tr').its('length').should('eq', 1);
                cy.get('#member-teams-table table tbody tr td').contains('No records to display').should('exist');
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', str => true);

                cy.url().should('contain', `/#/organization/${anotherOrganizerAgent.socialProfile.user_metadata.organizations[0].id}`);
                // Delete member
                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();

                cy.wait(300);
                cy.url().should('contain', `/#/organization/${anotherOrganizerAgent.socialProfile.user_metadata.organizations[0].id}`);
              });

              it('displays a success message', () => {
                cy.on('window:confirm', str => true);
                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();
                cy.wait(300);
                cy.contains(`${root.socialProfile.user_metadata.teams[0].name} have been removed from ${anotherOrganizerAgent.socialProfile.user_metadata.organizations[0].name}`);
              });

              it('displays progress spinner', () => {
                cy.on('window:confirm', str => true);
                cy.get('#progress-spinner').should('not.exist');

                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();

                // 2020-5-21
                // Cypress goes too fast for this. Cypress also cannot intercept
                // native `fetch` calls to allow stubbing and delaying the route.
                // Shamefully, this is currently manually tested, though I suspect
                // I will use this opportunity to learn Jest
                // Despite its name, this test really ensures the spinner disappears
                // after all is said and done
                //cy.get('#progress-spinner').should('exist');
                cy.wait(100);
                cy.get('#progress-spinner').should('not.exist');
              });
            });
          });
        });
      });
    });

    context('root is unaffiliated', () => {

      let anotherOrganizerAgent;
      beforeEach(function() {

        // Login/create another organizer agent
        cy.login('someotherorganizer@example.com', {..._profile, email: 'someotherorganizer@example.com', name: 'Some Other Organizer'}, rolePermissions.organizer);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherorganizer@example.com' LIMIT 1;`).then(([results, metadata]) => {
          anotherOrganizerAgent = results[0];
          cy.request('POST', `https://localhost:3002/api/v2/users/${anotherOrganizerAgent.socialProfile.user_id}/roles`, { roles: [organizerRole.id] });

          cy.wait(300);
          cy.login('someotherorganizer@example.com', {..._profile, email: 'someotherorganizer@example.com', name: 'Some Other Organizer'}, rolePermissions.organizer);

          // Create organization
          cy.get('#organizations-table button span span').contains('add_box').click();
          cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('The National Lacrosse League');
          cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();
          cy.wait(300);

          cy.get('#app-menu-button').click();
          cy.contains('Agent Directory').click();
          cy.wait(300);
          cy.contains(teamLeaderAgent.name).click();
          cy.wait(300);
          cy.contains('The Calgary Roughnecks').click();
          cy.wait(300);
          // Add team to organization
          cy.get('#team-profile-info #add-team-to-organization').click();
          cy.wait(300);
          cy.get('#organizations-table table tbody tr td button').contains('add').click();
          cy.wait(300);

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherorganizer@example.com' LIMIT 1;`).then(([results, metadata]) => {
            anotherOrganizerAgent = results[0];

            // Login root
            cy.login(_profile.email, _profile);
          });
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {

          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.wait(100);
            cy.get('#app-menu').get('#admin-switch').check();
            cy.wait(100);
            cy.get('#app-menu').contains('Agent Directory').click();
            cy.wait(300);
            cy.contains(teamLeaderAgent.name).click();
            cy.wait(300);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(300);
          });

          context('in Team view', () => {
            it('displays the appropriate root interface', () => {
              cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 3);
              cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', 'The Calgary Roughnecks');
              cy.get('#team-profile-info tbody tr td input#team-name-field').should('not.be.disabled');
              cy.get('#team-profile-info tbody tr td').contains(teamLeaderAgent.email);
              cy.get('#team-profile-info #remove-team-from-organization').should('exist');
              cy.get('#team-profile-info #add-team-to-organization').should('not.exist');
              cy.get('button#delete-team').should('exist');
              cy.get('#team-profile-info button#save-team').should('not.exist');
              cy.get('#team-profile-info button#cancel-team-changes').should('not.exist');
            });

            describe('#remove-team-from-organization', () => {
              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Remove team from organization?');
                  done();
                });
                // Delete member team
                cy.get('#team-profile-info #remove-team-from-organization').click();
              });

              it('updates the interface', () => {
                cy.on('window:confirm', str => true);

                // Delete member team
                cy.get('#team-profile-info #remove-team-from-organization').click();

                cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 3);
                cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', 'The Calgary Roughnecks');
                cy.get('#team-profile-info tbody tr td input#team-name-field').should('not.be.disabled');
                cy.get('#team-profile-info tbody tr td').contains(teamLeaderAgent.email);
                cy.get('#team-profile-info #remove-team-from-organization').should('not.exist');
                cy.get('#team-profile-info #add-team-to-organization').should('not.exist');
                cy.get('button#delete-team').should('exist');
                cy.get('#team-profile-info button#save-team').should('not.exist');
                cy.get('#team-profile-info button#cancel-team-changes').should('not.exist');
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', str => true);

                cy.url().should('contain', `/#/team/${teamLeaderAgent.socialProfile.user_metadata.teams[0].id}`);
                // Delete member
                cy.get('#team-profile-info #remove-team-from-organization').click();
                cy.wait(300);
                cy.url().should('contain', `/#/team/${teamLeaderAgent.socialProfile.user_metadata.teams[0].id}`);
              });

              it('displays a success message', () => {
                cy.on('window:confirm', str => true);
                cy.get('#team-profile-info #remove-team-from-organization').click();
                cy.wait(300);

                cy.contains(`${teamLeaderAgent.socialProfile.user_metadata.teams[0].name} have been removed from ${anotherOrganizerAgent.socialProfile.user_metadata.organizations[0].name}`);
              });

              it('displays progress spinner', () => {
                cy.on('window:confirm', str => true);
                cy.get('#progress-spinner').should('not.exist');
                cy.get('#team-profile-info #remove-team-from-organization').click();
                // 2020-5-21
                // Cypress goes too fast for this. Cypress also cannot intercept
                // native `fetch` calls to allow stubbing and delaying the route.
                // Shamefully, this is currently manually tested, though I suspect
                // I will use this opportunity to learn Jest
                // Despite its name, this test really ensures the spinner disappears
                // after all is said and done
                //cy.get('#progress-spinner').should('exist');
                cy.wait(100);
                cy.get('#progress-spinner').should('not.exist');
              });
            });
          });

          context('in Organization view', () => {
            beforeEach(() => {
              cy.get('#app-menu-button').click();
              cy.contains('Agent Directory').click();
              cy.wait(300);
              cy.contains(teamLeaderAgent.name).click();
              cy.wait(300);
              cy.contains(teamLeaderAgent.socialProfile.user_metadata.teams[0].name).click();
              cy.wait(300);
              cy.contains(anotherOrganizerAgent.socialProfile.user_metadata.organizations[0].name).click();
              cy.wait(300);
            });

            it('displays the appropriate organizer interface', () => {
              cy.get('#member-teams-table tbody').find('tr').its('length').should('eq', 1);

              cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').should('exist');
              cy.get('#member-teams-table table tbody tr:nth-of-type(1) td a')
                .should('contain', teamLeaderAgent.socialProfile.user_metadata.teams[0].name)
                .and('have.attr', 'href')
                .and('equal', `#team/${teamLeaderAgent.socialProfile.user_metadata.teams[0].id}`);
              cy.get('#member-teams-table table tbody tr:nth-of-type(1) td').contains(teamLeaderAgent.email);
            });

            describe('record delete button', () => {
              it('displays a popup warning', function(done) {
                cy.on('window:confirm', (str) => {
                  expect(str).to.eq('Remove team from organization?');
                  done();
                });
                // Delete member team
                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();
              });

              it('updates the interface', () => {
                cy.on('window:confirm', str => true);

                // Delete member team
                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();
                cy.wait(300);

                cy.get('#member-teams-table tbody').find('tr').its('length').should('eq', 1);
                cy.get('#member-teams-table table tbody tr td').contains('No records to display').should('exist');
              });

              it('lands in the proper place', () => {
                cy.on('window:confirm', str => true);

                cy.url().should('contain', `/#/organization/${anotherOrganizerAgent.socialProfile.user_metadata.organizations[0].id}`);
                // Delete member
                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();

                cy.wait(300);
                cy.url().should('contain', `/#/organization/${anotherOrganizerAgent.socialProfile.user_metadata.organizations[0].id}`);
              });

              it('displays a success message', () => {
                cy.on('window:confirm', str => true);
                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();
                cy.wait(300);
                cy.contains(`${teamLeaderAgent.socialProfile.user_metadata.teams[0].name} have been removed from ${anotherOrganizerAgent.socialProfile.user_metadata.organizations[0].name}`);
              });

              it('displays progress spinner', () => {
                cy.on('window:confirm', str => true);
                cy.get('#progress-spinner').should('not.exist');

                cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').click();

                // 2020-5-21
                // Cypress goes too fast for this. Cypress also cannot intercept
                // native `fetch` calls to allow stubbing and delaying the route.
                // Shamefully, this is currently manually tested, though I suspect
                // I will use this opportunity to learn Jest
                // Despite its name, this test really ensures the spinner disappears
                // after all is said and done
                //cy.get('#progress-spinner').should('exist');
                cy.wait(100);
                cy.get('#progress-spinner').should('not.exist');
              });
            });
          });
        });
      });
    });
  });
});

export {}
