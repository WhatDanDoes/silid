context('root/Team edit', () => {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  afterEach(function() {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Updates" CASCADE;');
    // Stop on fail
    //if (this.currentTest.state === 'failed') {
    //  Cypress.runner.stop()
    //}
  });

  let _profile, teamId;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com', name: 'Professor Fresh'};
    teamId = 'some-uuid-v4';
  });

  describe('Editing', () => {

    let root, regularAgent, team;

    describe('root\'s own team', () => {

      beforeEach(() => {
        cy.login(_profile.email, _profile);
        cy.get('#teams-table button span span').contains('add_box').click();
        cy.get('#teams-table table tbody tr td div div input[placeholder="Name"]').type('The Calgary Roughnecks');
        cy.get('#teams-table table tbody tr td div button[title="Save"]').click();
        cy.wait(300);
      });

      describe('admin mode', () => {
        context('switched on', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(200);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(200);
          });

          it('updates the record on the interface', () => {
            cy.get('#team-profile-info input#team-name-field').should('have.value', 'The Calgary Roughnecks');
            cy.get('#team-profile-info input#team-name-field').clear().type('The Calgary Rubberneckers');
            cy.get('button#save-team').click();
            cy.get('#team-profile-info input#team-name-field').should('have.value', 'The Calgary Rubberneckers');
          });
        });

        context('switched off', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.wait(200);
            cy.get('#admin-switch').uncheck();
            cy.wait(200);
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(200);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(200);
          });

          it('updates the record on the interface', () => {
            cy.get('#team-profile-info input#team-name-field').should('have.value', 'The Calgary Roughnecks');
            cy.get('#team-profile-info input#team-name-field').clear().type('The Calgary Rubberneckers');
            cy.get('button#save-team').click();
            cy.get('#team-profile-info input#team-name-field').should('have.value', 'The Calgary Rubberneckers');
          });
        });
      });
    });

    describe('a team of which root is a member', () => {
      beforeEach(() => {
        // Create team with regular agent
        cy.login('someguy@example.com', {..._profile, name: 'Some Guy' });

        // Create team
        cy.get('#teams-table button span span').contains('add_box').click();
        cy.get('#teams-table table tbody tr td div div input[placeholder="Name"]').type('The Calgary Roughnecks');
        cy.get('#teams-table table tbody tr td div button[title="Save"]').click();
        cy.wait(300);

        // Invite root agent to join as member
        cy.contains('The Calgary Roughnecks').click();
        cy.wait(300);
        cy.get('#members-table button span span').contains('add_box').click();
        cy.get('#members-table table tbody tr:nth-of-type(2) input[placeholder="Email"]').type('root@example.com{enter}');

        // Login as root and accept the invitation
        cy.login(_profile.email, _profile);
        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
        cy.wait(300);
      });

      describe('admin mode', () => {
        context('switched on', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(200);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(200);
          });

          it('updates the record on the interface', () => {
            cy.get('#team-profile-info input#team-name-field').should('have.value', 'The Calgary Roughnecks');
            cy.get('#team-profile-info input#team-name-field').clear().type('The Calgary Rubberneckers');
            cy.get('button#save-team').click();
            cy.get('#team-profile-info input#team-name-field').should('have.value', 'The Calgary Rubberneckers');
          });

          // This covers a situation discovered when the previous test was made to pass
          it('doesn\'t mess up the membership', () => {
            cy.get('#members-table table tbody tr:nth-of-type(1)').contains('root@example.com');
            cy.get('#members-table table tbody tr:nth-of-type(2)').contains('someguy@example.com');

            cy.get('#team-profile-info input#team-name-field').clear().type('The Calgary Rubberneckers');
            cy.get('button#save-team').click();
            cy.wait(200);

            cy.get('#members-table table tbody tr:nth-of-type(1)').contains('root@example.com');
            cy.get('#members-table table tbody tr:nth-of-type(2)').contains('someguy@example.com');
          });
        });

        context('switched off', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.wait(200);
            cy.get('#admin-switch').uncheck();
            cy.wait(200);
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(200);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(200);
          });

          it('disables edit components on the interface', () => {
            cy.get('table tbody tr td input#team-name-field').should('have.value', 'The Calgary Roughnecks');
            cy.get('table tbody tr td input#team-name-field').should('be.disabled');
            cy.get('#members-table button span span').should('not.exist');
            cy.get('table tbody tr td').contains(_profile.email);
            cy.get('button#delete-team').should('not.exist');
            cy.get('button#save-team').should('not.exist');
            cy.get('button#cancel-team-changes').should('not.exist');
          });
        });
      });
    });

    describe('a team with which root is not affiliated', () => {
      beforeEach(() => {
        // Create team with regular agent
        cy.login('someguy@example.com', {..._profile, name: 'Some Guy' });

        // Create team
        cy.get('#teams-table button span span').contains('add_box').click();
        cy.get('#teams-table table tbody tr td div div input[placeholder="Name"]').type('The Calgary Roughnecks');
        cy.get('#teams-table table tbody tr td div button[title="Save"]').click();
        cy.wait(200);

        // Login as root
        cy.login(_profile.email, _profile);
      });

      describe('admin mode', () => {
        context('switched on', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.get('#app-menu').contains('Agent Directory').click();
            cy.wait(200);
            cy.contains('Some Guy').click();
            cy.wait(200);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(200);
          });

          it('updates the record on the interface', () => {
            cy.get('#team-profile-info input#team-name-field').should('have.value', 'The Calgary Roughnecks');
            cy.get('#team-profile-info input#team-name-field').clear().type('The Calgary Rubberneckers');
            cy.get('button#save-team').click();
            cy.get('#team-profile-info input#team-name-field').should('have.value', 'The Calgary Rubberneckers');
          });
        });

        context('switched off', () => {
          beforeEach(() => {
            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
              regularAgent = results[0];

              cy.get('#app-menu-button').click();
              cy.wait(200);
              cy.get('#app-menu #admin-switch').uncheck();
              cy.wait(200);
              cy.get('#app-menu').contains('Profile').click();
              cy.wait(200);
            });
          });

          it('displays a friendly message', () => {
            cy.visit(`/#/team/${regularAgent.socialProfile.user_metadata.teams[0].id}`);
            cy.wait(200);
            cy.contains('You are not a member of that team');
          });
        });
      });
    });
  });
});

export {}
