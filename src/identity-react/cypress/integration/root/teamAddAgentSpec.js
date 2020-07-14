context('root/Team add agent', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com', name: 'Professor Fresh'};
  });

  context('authenticated', () => {

    let root, anotherAgent;
    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
      cy.task('query', 'TRUNCATE TABLE "Updates" CASCADE;');
    });

    context('root is team leader', () => {
      beforeEach(function() {
        // Login/create another agent
        cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy'});
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
          anotherAgent = results[0];

          // Login/create main test agent
          cy.login(_profile.email, _profile);

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];

            cy.get('button span span').contains('add_box').click();
            cy.get('input[placeholder="Name"]').type('The A-Team');
            cy.get('button[title="Save"]').click();
            cy.wait(300);
            cy.contains('The A-Team').click();
            cy.wait(300);
          });
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.wait(200);
            cy.contains('Profile').click();
            cy.wait(300);
            cy.contains('The A-Team').click();
            cy.wait(300);
          });

          describe('add-agent button', () => {
            it('reveals the input form', () => {

              cy.get('#members-table table tbody tr td div button[title="Save"]').should('not.exist');
              cy.get('#members-table table tbody tr td div button[title="Cancel"]').should('not.exist');
              cy.get('#members-table table tbody tr td div div input[placeholder="Name"]').should('not.exist');
              cy.get('#members-table table tbody tr td div div input[placeholder="Email"]').should('not.exist');

              cy.get('#members-table div:first-of-type div div:last-of-type span').contains('add_box').should('exist');
              cy.get('#members-table div:first-of-type div div:last-of-type span').contains('add_box').click();

              cy.get('#members-table table tbody tr td div button[title="Save"]').should('exist');
              cy.get('#members-table table tbody tr td div button[title="Cancel"]').should('exist');
              cy.get('#members-table table tbody tr td div div input[placeholder="Name"]').should('not.exist');
              cy.get('#members-table table tbody tr td div div input[placeholder="Email"]').should('exist');
            });
          });
        });
      });
    });

    context('root is unaffiliated', () => {
      beforeEach(function() {
        // Login/create another agent
        cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy'});
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
          anotherAgent = results[0];

          cy.get('button span span').contains('add_box').click();
          cy.get('input[placeholder="Name"]').type('The A-Team');
          cy.get('button[title="Save"]').click();
          cy.wait(300);
          cy.contains('The A-Team').click();
          cy.wait(300);

          // Login/create main test agent
          cy.login(_profile.email, _profile);

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];

          });
        });
      });

      describe('admin mode', () => {
        context('switched on', () => {
          beforeEach(() => {
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.get('#app-menu').contains('Agent Directory').click();
            cy.wait(200);
            cy.contains('Some Other Guy').click();
            cy.wait(300);
            cy.contains('The A-Team').click();
            cy.wait(300);
          });

          describe('add-agent button', () => {
            it('is not displayed', () => {
              cy.get('#members-table div:first-of-type div div:last-of-type span').not('button');;
            });
          });
        });
      });
    });
  });
});

export {}
