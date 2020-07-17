// 2020-7-16 https://github.com/cypress-io/cypress/issues/1271
// Can't import regular Javascript as a fixture
import rolePermissions from '../../fixtures/roles-with-permissions.js';

context('organizer/Organization add team', function() {

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
  });

  let _profile, organizerAgent, teamLeaderAgent;
  beforeEach(function() {
    _profile = { ...this.profile };

    // A convenient way to create a new team leader agent
    cy.login('coach@example.com', {..._profile, email: 'coach@example.com', name: 'Curt Malawsky'});
    // Create a team
    cy.get('#teams-table button span span').contains('add_box').click();
    cy.get('#teams-table table tbody tr td div div input[placeholder="Name"]').type('The Calgary Roughnecks');
    cy.get('#teams-table table tbody tr td div button[title="Save"]').click();
    cy.wait(300);

    cy.task('query', `SELECT * FROM "Agents" WHERE "email"='coach@example.com' LIMIT 1;`).then(([results, metadata]) => {
      teamLeaderAgent = results[0];

      // A convenient way to create a new organizer agent
      cy.login(_profile.email, _profile, rolePermissions.organizer);
      // Make this agent an organizer via a call to the mock server
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
        organizerAgent = results[0];
        cy.request('POST', `https://localhost:3002/api/v2/users/${organizerAgent.socialProfile.user_id}/roles`, { roles: [organizerRole.id] });

        // Login again to enable organizer status
        cy.login(_profile.email, _profile, rolePermissions.organizer);
        cy.get('#organizations-table button span span').contains('add_box').click();
        cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('The National Lacrosse League');
        cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();
        cy.wait(300);

        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          organizerAgent = results[0];
        });
      });
    });
  });

  context('authenticated', () => {

    context('organizer is unaffiliated', () => {
      beforeEach(() => {
        cy.get('#app-menu-button').click();
        cy.contains('Agent Directory').click();
        cy.wait(300);
        cy.contains(teamLeaderAgent.name).click();
        cy.wait(300);
        cy.contains('The Calgary Roughnecks').click();
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/team/${teamLeaderAgent.socialProfile.user_metadata.teams[0].id}`);
      });

      it('displays the organizer-enabled interface', () => {
        cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 3);
        cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', 'The Calgary Roughnecks');
        cy.get('#team-profile-info tbody tr td input#team-name-field').should('be.disabled');
        cy.get('#team-profile-info tbody tr td').contains('coach@example.com');
        cy.get('#team-profile-info #add-team-to-organization').should('exist');
        cy.get('#team-profile-info button#delete-team').should('not.exist');
        cy.get('#team-profile-info button#save-team').should('not.exist');
        cy.get('#team-profile-info button#cancel-team-changes').should('not.exist');
      });

      describe('#add-team-to-organization', () => {
        it('reveals organizer\'s organization list', () => {
          cy.get('#organizations-table').should('not.exist');
          cy.get('#team-profile-info #add-team-to-organization').click();
          cy.get('#organizations-table').should('exist');
        });

        it('hides itself and reveals button to close organization menu', () => {
          cy.get('#team-profile-info #close-team-organization-menu').should('not.exist');
          cy.get('#team-profile-info #add-team-to-organization').click();
          cy.get('#team-profile-info #add-team-to-organization').should('not.exist');
          cy.get('#team-profile-info #close-team-organization-menu').should('exist');
        });

        describe('#organizations-table', () => {
          beforeEach(() => {
            cy.get('#team-profile-info #add-team-to-organization').click();
          });

          it('displays a list of the organizer agent\'s organizations', () => {
            cy.get('#organizations-table h6').contains('Your Organizations');
            cy.get('#organizations-table table tbody tr td').contains('No records to display').should('not.exist');

            cy.get('#organizations-table table thead tr th').contains('Actions');
            cy.get('#organizations-table table tbody tr td button').contains('add');
            cy.get('#organizations-table table thead tr th').contains('Name');
            cy.get('#organizations-table table tbody tr td').contains(organizerAgent.socialProfile.user_metadata.organizations[0].name);
            cy.get('#organizations-table table tbody tr td a').should('contain', organizerAgent.socialProfile.user_metadata.organizations[0].name).
              and('have.attr', 'href').and('equal', `#organization/${organizerAgent.socialProfile.user_metadata.organizations[0].id}`);
          });

          describe('add to organization button', () => {
            it('updates the interface', () => {
              cy.get('#team-profile-info tbody tr:last-of-type th').contains('Organization:');
              cy.get('#team-profile-info tbody tr:last-of-type td #close-team-organization-menu').should('exist');

              cy.get('#organizations-table table tbody tr td button').contains('add').click();
              cy.wait(300);

              cy.get('#team-profile-info tbody tr:last-of-type td a').should('contain', organizerAgent.socialProfile.user_metadata.organizations[0].name).
                and('have.attr', 'href').and('equal', `#organization/${organizerAgent.socialProfile.user_metadata.organizations[0].id}`);

              cy.get('#team-profile-info tbody tr:last-of-type td:last-of-type #close-team-organization-menu').should('not.exist');
              cy.get('#team-profile-info tbody tr:last-of-type td:last-of-type #remove-team-from-organization').should('exist');
            });

            it('hides the #organizations-table', () => {
              cy.get('#organizations-table').should('exist');
              cy.get('#organizations-table table tbody tr td button').contains('add').click();
              cy.wait(300);
              cy.get('#organizations-table').should('not.exist');
            });

            it('lands in the right spot', () => {
              cy.get('#organizations-table table tbody tr td button').contains('add').click();
              cy.wait(300);
              cy.url().should('contain', `/#/team/${teamLeaderAgent.socialProfile.user_metadata.teams[0].id}`);
            });

            it('displays a friendly message', () => {
              cy.get('#organizations-table table tbody tr td button').contains('add').click();
              cy.wait(300);
              cy.get('#flash-message').contains('The Calgary Roughnecks are now part of The National Lacrosse League');
            });
          });
        });

        describe('#close-team-organization-menu', () => {
          beforeEach(() => {
            cy.get('#team-profile-info #add-team-to-organization').click();
          });

          it('hides the organizer\'s organization list', () => {
            cy.get('#organizations-table').should('exist');
            cy.get('#team-profile-info #close-team-organization-menu').click();
            cy.get('#organizations-table').should('not.exist');
          });

          it('hides itself and reveals button to open organization menu', () => {
            cy.get('#team-profile-info #add-team-to-organization').should('not.exist');
            cy.get('#team-profile-info #close-team-organization-menu').click();
            cy.get('#team-profile-info #add-team-to-organization').should('exist');
            cy.get('#team-profile-info #close-team-organization-menu').should('not.exist');
          });
        });
      });
    });

    context('organizer is team member', () => {
      beforeEach(function() {
        _profile = { ...this.profile };

        // A convenient way to create a new team leader agent
        cy.login('coach@example.com', {..._profile, email: 'coach@example.com', name: 'Curt Malawsky'});

        cy.contains('The Calgary Roughnecks').click();
        cy.wait(300);

        cy.get('button span span').contains('add_box').click();
        cy.get('input[placeholder="Email"]').type(organizerAgent.email);
        cy.get('button[title="Save"]').click();
        cy.wait(300);

        cy.login(_profile.email, _profile, rolePermissions.organizer);
        // Accept team invitaiton
        cy.get('#rsvps-table table tbody').find('tr').its('length').should('eq', 1);
        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
        cy.wait(300);

        cy.contains('The Calgary Roughnecks').click();
        cy.wait(300);

        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          organizerAgent = results[0];
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/team/${teamLeaderAgent.socialProfile.user_metadata.teams[0].id}`);
      });

      it('displays the organizer-enabled interface', () => {
        cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 3);
        cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', 'The Calgary Roughnecks');
        cy.get('#team-profile-info tbody tr td input#team-name-field').should('be.disabled');
        cy.get('#team-profile-info tbody tr td').contains('coach@example.com');
        cy.get('#team-profile-info #add-team-to-organization').should('exist');
        cy.get('#team-profile-info button#delete-team').should('not.exist');
        cy.get('#team-profile-info button#save-team').should('not.exist');
        cy.get('#team-profile-info button#cancel-team-changes').should('not.exist');
      });

      describe('#add-team-to-organization', () => {
        it('reveals organizer\'s organization list', () => {
          cy.get('#organizations-table').should('not.exist');
          cy.get('#team-profile-info #add-team-to-organization').click();
          cy.get('#organizations-table').should('exist');
        });

        it('hides itself and reveals button to close organization menu', () => {
          cy.get('#team-profile-info #close-team-organization-menu').should('not.exist');
          cy.get('#team-profile-info #add-team-to-organization').click();
          cy.get('#team-profile-info #add-team-to-organization').should('not.exist');
          cy.get('#team-profile-info #close-team-organization-menu').should('exist');
        });

        describe('#organizations-table', () => {
          beforeEach(() => {
            cy.get('#team-profile-info #add-team-to-organization').click();
          });

          it('displays a list of the organizer agent\'s organizations', () => {
            cy.get('#organizations-table h6').contains('Your Organizations');
            cy.get('#organizations-table table tbody tr td').contains('No records to display').should('not.exist');

            cy.get('#organizations-table table thead tr th').contains('Actions');
            cy.get('#organizations-table table tbody tr td button').contains('add');
            cy.get('#organizations-table table thead tr th').contains('Name');
            cy.get('#organizations-table table tbody tr td').contains(organizerAgent.socialProfile.user_metadata.organizations[0].name);
            cy.get('#organizations-table table tbody tr td a').should('contain', organizerAgent.socialProfile.user_metadata.organizations[0].name).
              and('have.attr', 'href').and('equal', `#organization/${organizerAgent.socialProfile.user_metadata.organizations[0].id}`);
          });

          describe('add to organization button', () => {
            it('updates the interface', () => {
              cy.get('#team-profile-info tbody tr:last-of-type th').contains('Organization:');
              cy.get('#team-profile-info tbody tr:last-of-type td #close-team-organization-menu').should('exist');

              cy.get('#organizations-table table tbody tr td button').contains('add').click();
              cy.wait(300);

              cy.get('#team-profile-info tbody tr:last-of-type td a').should('contain', organizerAgent.socialProfile.user_metadata.organizations[0].name).
                and('have.attr', 'href').and('equal', `#organization/${organizerAgent.socialProfile.user_metadata.organizations[0].id}`);

              cy.get('#team-profile-info tbody tr:last-of-type td:last-of-type #close-team-organization-menu').should('not.exist');
              cy.get('#team-profile-info tbody tr:last-of-type td:last-of-type #remove-team-from-organization').should('exist');
            });

            it('hides the #organizations-table', () => {
              cy.get('#organizations-table').should('exist');
              cy.get('#organizations-table table tbody tr td button').contains('add').click();
              cy.wait(300);
              cy.get('#organizations-table').should('not.exist');
            });

            it('lands in the right spot', () => {
              cy.get('#organizations-table table tbody tr td button').contains('add').click();
              cy.wait(300);
              cy.url().should('contain', `/#/team/${teamLeaderAgent.socialProfile.user_metadata.teams[0].id}`);
            });

            it('displays a friendly message', () => {
              cy.get('#organizations-table table tbody tr td button').contains('add').click();
              cy.wait(300);
              cy.get('#flash-message').contains('The Calgary Roughnecks are now part of The National Lacrosse League');
            });
          });
        });

        describe('#close-team-organization-menu', () => {
          beforeEach(() => {
            cy.get('#team-profile-info #add-team-to-organization').click();
          });

          it('hides the organizer\'s organization list', () => {
            cy.get('#organizations-table').should('exist');
            cy.get('#team-profile-info #close-team-organization-menu').click();
            cy.get('#organizations-table').should('not.exist');
          });

          it('hides itself and reveals button to open organization menu', () => {
            cy.get('#team-profile-info #add-team-to-organization').should('not.exist');
            cy.get('#team-profile-info #close-team-organization-menu').click();
            cy.get('#team-profile-info #add-team-to-organization').should('exist');
            cy.get('#team-profile-info #close-team-organization-menu').should('not.exist');
          });
        });
      });
    });

    context('team is member of another organization', () => {
      let anotherOrganizerAgent;
      beforeEach(() => {
        cy.get('#app-menu-button').click();
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

        // Login/create another organizer agent
        cy.login('someotherorganizer@example.com', {..._profile, email: 'someotherorganizer@example.com', name: 'Some Other Organizer'}, rolePermissions.organizer);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherorganizer@example.com' LIMIT 1;`).then(([results, metadata]) => {
          anotherOrganizerAgent = results[0];
          cy.request('POST', `https://localhost:3002/api/v2/users/${anotherOrganizerAgent.socialProfile.user_id}/roles`, { roles: [organizerRole.id] });

          cy.wait(300);
          cy.login('someotherorganizer@example.com', {..._profile, email: 'someotherorganizer@example.com', name: 'Some Other Organizer'}, rolePermissions.organizer);
          cy.get('#app-menu-button').click();
          cy.contains('Agent Directory').click();
          cy.wait(300);
          cy.contains(teamLeaderAgent.name).click();
          cy.wait(300);
          cy.contains('The Calgary Roughnecks').click();
          cy.wait(300);
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/team/${teamLeaderAgent.socialProfile.user_metadata.teams[0].id}`);
      });

      it('displays the organizer-disabled interface', () => {
        cy.get('#team-profile-info tbody').find('tr').its('length').should('eq', 3);
        cy.get('#team-profile-info tbody tr td input#team-name-field').should('have.value', 'The Calgary Roughnecks');
        cy.get('#team-profile-info tbody tr td input#team-name-field').should('be.disabled');
        cy.get('#team-profile-info tbody tr td').contains('coach@example.com');
        cy.get('#team-profile-info #add-team-to-organization').should('not.exist');
        cy.get('#team-profile-info button#delete-team').should('not.exist');
        cy.get('#team-profile-info button#save-team').should('not.exist');
        cy.get('#team-profile-info button#cancel-team-changes').should('not.exist');
        cy.get('#team-profile-info tbody tr:last-of-type td a').should('contain', organizerAgent.socialProfile.user_metadata.organizations[0].name).
          and('have.attr', 'href').and('equal', `#organization/${organizerAgent.socialProfile.user_metadata.organizations[0].id}`);

        cy.get('#team-profile-info tbody tr:last-of-type td:last-of-type #close-team-organization-menu').should('not.exist');
        cy.get('#team-profile-info tbody tr:last-of-type td:last-of-type #remove-team-from-organization').should('not.exist');
      });
    });
  });
});

export {}
