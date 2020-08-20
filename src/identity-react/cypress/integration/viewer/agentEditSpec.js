context('viewer/Agent edit', function() {

  let memberAgent;
  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions.js').as('scope');
  });

  let _profile;
  beforeEach(function() {
    _profile = {...this.profile};
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Updates" CASCADE;');
  });

  describe('authenticated', () => {
    let memberAgent;

    describe('viewing member agent\'s profile', () => {
      beforeEach(() => {
        // A convenient way to create a new agent
        cy.login('someotherguy@example.com', _profile);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
          memberAgent = results[0];

          cy.login('someguy@example.com', _profile);
          cy.visit(`/#/agent/${memberAgent.socialProfile.user_id}`);
          cy.wait(300);
        });
      });

      it('does not allow editing agent\'s info', () => {
        cy.get('h3').contains('Profile');
        cy.get('#profile-table table tbody tr th').contains('Name:');
        cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', memberAgent.socialProfile.name);
        cy.get('#profile-table table tbody tr td input#agent-name-field').should('be.disabled');

        // Not really relevant for root-level agent profile edits, but included here anyway
        cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
        cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('be.disabled');
      });
    });

    describe('viewing your own profile', () => {

      let agent;

      describe('email verified', () => {

        beforeEach(() => {
          cy.login('someguy@example.com', _profile);
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
            agent = results[0];
            cy.visit(`/#/agent/${agent.socialProfile.user_id}`);
            cy.wait(500);
          });
        });

        it('displays agent\'s info', () => {
          cy.get('h3').contains('Profile');
          cy.get('#profile-table table tbody tr th').contains('Name:');
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', agent.socialProfile.name);
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('not.be.disabled');

          // Not really relevant for root-level agent profile edits, but included here anyway
          cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
          cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('not.be.disabled');
        });
      });

      describe('email not verified', () => {
        beforeEach(() => {
          cy.login('someguy@example.com', {..._profile, email_verified: false });
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
            agent = results[0];
            cy.visit(`/#/agent/${agent.socialProfile.user_id}`);
            cy.wait(500);
          });
        });

        it('displays agent\'s info', () => {
          cy.get('h3').contains('Profile');
          cy.get('#profile-table table tbody tr th').contains('Name:');
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', agent.socialProfile.name);
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('be.disabled');

          // Not really relevant for root-level agent profile edits, but included here anyway
          cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
          cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('not.be.disabled');
        });
      });
    });
  });
});

export {}
