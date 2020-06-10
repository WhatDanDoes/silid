context('root/Team delete agent', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Invitations" CASCADE;');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com', name: 'Professor Fresh'};
  });

  describe('Deleting agent from team', () => {

    let root, regularAgent;

    describe('root\'s own team', () => {
      beforeEach(() => {
        cy.login(_profile.email, _profile);
        // Logged in as root
        cy.get('#teams-table button span span').contains('add_box').click();
        cy.get('#teams-table table tbody tr td div div input[placeholder="Name"]').type('The Calgary Roughnecks');
        cy.get('#teams-table table tbody tr td div button[title="Save"]').click();
        cy.wait(200);

        // Invite agent to join as member
        cy.contains('The Calgary Roughnecks').click();
        cy.wait(200);
        cy.get('#members-table button span span').contains('add_box').click();
        cy.get('#members-table table tbody tr:nth-of-type(2) input[placeholder="Email"]').type('someguy@example.com{enter}');

        // Login as team member and accept the invitation
        cy.login('someguy@example.com', {..._profile, name: 'Some Guy' });
        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
        cy.wait(300);

        // Refresh agent model to get `socialProfile`
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
          regularAgent = results[0];

          // Log back in as root
          cy.login(_profile.email, _profile);

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='root@example.com' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];
          });
        });
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
            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 2);

            // root
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('not.exist');
            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', root.name).and('have.attr', 'href').and('equal', `#agent/${root.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(1) td').contains(root.socialProfile.user_metadata.teams[0].leader);

            // Member agent
            cy.get('tr:nth-of-type(2) button[title=Delete]').should('exist');
            cy.get('tr:nth-of-type(2) td a').should('contain', regularAgent.name).and('have.attr', 'href').and('equal', `#agent/${regularAgent.socialProfile.user_id}`);
            cy.get('tr:nth-of-type(2) td').contains(regularAgent.socialProfile.email);

            // Delete member
            cy.get('#members-table tr:nth-of-type(2) button[title=Delete]').click();
            cy.wait(300);
            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 1);

            // Only the root agent
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('not.exist');
            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', root.name).and('have.attr', 'href').and('equal', `#agent/${root.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(1) td').contains(root.socialProfile.user_metadata.teams[0].leader);
          });

          it('team is removed from the former member\'s main profile page', () => {
            // Delete member
            cy.get('#members-table tr:nth-of-type(2) button[title=Delete]').click();
            cy.wait(300);

            cy.login('someguy@example.com', {..._profile, name: 'Some Guy' });
            cy.get('#rsvps-table').should('not.exist');
            cy.get('#teams-table').contains('No records to display').should('exist');
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
            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 2);

            // root
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('not.exist');
            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', root.name).and('have.attr', 'href').and('equal', `#agent/${root.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(1) td').contains(root.socialProfile.user_metadata.teams[0].leader);

            // Member agent
            cy.get('tr:nth-of-type(2) button[title=Delete]').should('exist');
            cy.get('tr:nth-of-type(2) td a').should('contain', regularAgent.name).and('have.attr', 'href').and('equal', `#agent/${regularAgent.socialProfile.user_id}`);
            cy.get('tr:nth-of-type(2) td').contains(regularAgent.socialProfile.email);

            // Delete member
            cy.get('#members-table tr:nth-of-type(2) button[title=Delete]').click();
            cy.wait(300);
            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 1);

            // Only the root agent
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('not.exist');
            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', root.name).and('have.attr', 'href').and('equal', `#agent/${root.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(1) td').contains(root.socialProfile.user_metadata.teams[0].leader);
          });

          it('team is removed from the former member\'s main profile page', () => {
            // Delete member
            cy.get('#members-table tr:nth-of-type(2) button[title=Delete]').click();
            cy.wait(300);

            cy.login('someguy@example.com', {..._profile, name: 'Some Guy' });
            cy.get('#rsvps-table').should('not.exist');
            cy.get('#teams-table').contains('No records to display').should('exist');
          });
        });
      });
    });

    describe('a team of which root is a member', () => {
      beforeEach(() => {
        cy.login('someguy@example.com', {..._profile, name: 'Some Guy' });
        // Logged in as regular agent
        cy.get('#teams-table button span span').contains('add_box').click();
        cy.get('#teams-table table tbody tr td div div input[placeholder="Name"]').type('The Calgary Roughnecks');
        cy.get('#teams-table table tbody tr td div button[title="Save"]').click();
        cy.wait(200);

        // Invite root to join as member
        cy.contains('The Calgary Roughnecks').click();
        cy.wait(200);
        cy.get('#members-table button span span').contains('add_box').click();
        cy.get('#members-table table tbody tr:nth-of-type(2) input[placeholder="Email"]').type('root@example.com{enter}');

        // Login as root and accept the invitation
        cy.login('root@example.com', _profile);
        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
        cy.wait(300);

        // Refresh agent model to get `socialProfile`
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
          regularAgent = results[0];

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='root@example.com' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];
          });
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.wait(200);
            cy.get('#admin-switch').check();
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(200);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(200);
          });

          it('updates the record on the interface', () => {
            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 2);

            // root
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('exist');
            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', root.name).and('have.attr', 'href').and('equal', `#agent/${root.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(1) td').contains(root.socialProfile.email);

            // Team leader
            cy.get('#members-table tr:nth-of-type(2) button[title=Delete]').should('not.exist');
            cy.get('#members-table tr:nth-of-type(2) td a').should('contain', regularAgent.name).and('have.attr', 'href').and('equal', `#agent/${regularAgent.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(2) td').contains(regularAgent.socialProfile.email);

            // Delete root (because leader can't be deleted)
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').click();
            cy.wait(300);
            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 1);

            // Only the team leader
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('not.exist');
            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', regularAgent.name).and('have.attr', 'href').and('equal', `#agent/${regularAgent.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(1) td').contains(regularAgent.socialProfile.user_metadata.teams[0].leader);
          });

          it('displays the correct success message', () => {
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').click();
            cy.wait(300);
            cy.contains(`Member removed`);
          });

          it('team is removed from root\'s main profile page', () => {
            // Delete root (because leader can't be deleted)
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').click();
            cy.wait(300);
            cy.contains('Identity').click();
            cy.wait(300);

            // No team
            cy.get('#teams-table').contains('No records to display').should('exist');
          });
        });

        context('switched off', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.wait(200);
            cy.get('#admin-switch').uncheck();
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(200);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(200);
          });

          it('provides no component for member deletion', () => {
            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 2);

            // root/member agent
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('not.exist');
            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', root.name).and('have.attr', 'href').and('equal', `#agent/${root.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(1) td').contains(root.socialProfile.email);

            // Team leader
            cy.get('#members-table tr:nth-of-type(2) button[title=Delete]').should('not.exist');
            cy.get('#members-table tr:nth-of-type(2) td a').should('contain', regularAgent.name).and('have.attr', 'href').and('equal', `#agent/${regularAgent.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(2) td').contains(regularAgent.socialProfile.email);
          });
        });
      });
    });

    describe('a team with which root has no affiliation', () => {

      let memberAgent;
      beforeEach(() => {
        cy.login('someguy@example.com', {..._profile, name: 'Some Guy' });
        // Logged in as regular agent
        cy.get('#teams-table button span span').contains('add_box').click();
        cy.get('#teams-table table tbody tr td div div input[placeholder="Name"]').type('The Calgary Roughnecks');
        cy.get('#teams-table table tbody tr td div button[title="Save"]').click();
        cy.wait(200);

        // Invite another agent to join as member
        cy.contains('The Calgary Roughnecks').click();
        cy.wait(200);
        cy.get('#members-table button span span').contains('add_box').click();
        cy.get('#members-table table tbody tr:nth-of-type(2) input[placeholder="Email"]').type('newteammember@example.com{enter}');

        // Login as new member agnt and accept the invitation
        cy.login('newteammember@example.com', _profile);
        cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
        cy.wait(300);

        // Get member agent
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='newteammember@example.com' LIMIT 1;`).then(([results, metadata]) => {
          memberAgent = results[0];

          // Team leader
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
            regularAgent = results[0];

            // Log back in as root
            cy.login(_profile.email, _profile);

            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='root@example.com' LIMIT 1;`).then(([results, metadata]) => {
              root = results[0];
            });
          });
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.wait(200);
            cy.get('#admin-switch').check();
            cy.get('#app-menu').contains('Agent Directory').click();
            cy.wait(200);
            cy.contains('Some Guy').click();
            cy.wait(200);
            cy.contains('The Calgary Roughnecks').click();
            cy.wait(200);
          });

          it('updates the record on the interface', () => {
            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 2);

            // root
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('exist');
            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', memberAgent.name).and('have.attr', 'href').and('equal', `#agent/${memberAgent.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(1) td').contains(memberAgent.socialProfile.email);

            // Team leader
            cy.get('#members-table tr:nth-of-type(2) button[title=Delete]').should('not.exist');
            cy.get('#members-table tr:nth-of-type(2) td a').should('contain', regularAgent.name).and('have.attr', 'href').and('equal', `#agent/${regularAgent.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(2) td').contains(regularAgent.socialProfile.email);

            // Delete member agent (because leader can't be deleted)
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').click();
            cy.wait(300);
            cy.get('#members-table table tbody').find('tr').its('length').should('eq', 1);

            // Only the team leader
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').should('not.exist');
            cy.get('#members-table tr:nth-of-type(1) td a').should('contain', regularAgent.name).and('have.attr', 'href').and('equal', `#agent/${regularAgent.socialProfile.user_id}`);
            cy.get('#members-table tr:nth-of-type(1) td').contains(regularAgent.socialProfile.user_metadata.teams[0].leader);
          });

          it('displays the correct success message', () => {
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').click();
            cy.wait(300);
            cy.contains(`Member removed`);
          });

          it('team is removed from the former member\'s main profile page', () => {
            // Delete member
            cy.get('#members-table tr:nth-of-type(1) button[title=Delete]').click();
            cy.wait(300);

            cy.login('newteammember@example.com', _profile);
            cy.get('#rsvps-table').should('not.exist');
            cy.get('#teams-table').contains('No records to display').should('exist');
          });
        });

        context('switched off', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.wait(200);
            cy.get('#admin-switch').uncheck();
            cy.get('#app-menu').contains('Profile').click();
            cy.wait(200);
            cy.visit(`/#/team/${regularAgent.socialProfile.user_metadata.teams[0].id}`);
            cy.wait(200);
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
