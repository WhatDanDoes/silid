context('viewer/Agent locale', function() {

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

    describe('email verified', () => {

      let agent;
      beforeEach(() => {
        cy.login(_profile.email, _profile);
        cy.get('#flash-message #close-flash').click();
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
        });
      });

      describe('no SIL language preference set', () => {

        it('displays agent\'s info', () => {
          cy.get('h3').contains('Profile');
          cy.get('#profile-table table tbody tr th').contains('Name:');
          cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.name);
          cy.get('#profile-table table tbody tr th').contains('Email:');
          cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.email);
          cy.get('#profile-table table tbody tr th').contains('Provider Locale:');
          cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.locale);
          cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
          cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('not.be.disabled');
          cy.get('#profile-table table tbody tr td label[for="sil-local-dropdown"]').contains('Set SIL language preference');
          cy.get('#profile-table table tbody tr:last-of-type th').contains('Roles:');
          cy.get('#profile-table table tbody tr:last-of-type div').its('length').should('eq', 1);
          cy.get('#profile-table table tbody tr:last-of-type div').contains('viewer');
          cy.get('#profile-table table tbody tr:last-of-type div#assign-role').should('not.exist');
        });

        describe('#sil-local-dropdown', () => {

          it('populates the dropdown with 7027 living languages and 22 constructed', () => {
            cy.get('div[role="presentation"] ul li').should('not.exist');
            cy.get('#profile-table table tbody tr td #sil-local-dropdown + div button:last-of-type').click();
            cy.wait(300);
            cy.get('div[role="presentation"] ul li').its('length').should('eq', 7027 + 22);
          });

          context('existing language selected', () => {
            beforeEach(() => {
              cy.get('#profile-table table tbody tr td #sil-local-dropdown + div button:last-of-type').click();
              cy.wait(300);
              cy.get('#profile-table table tbody tr td #sil-local-dropdown').type('klingon{enter}');
            });

            it('updates the interface', () => {
              cy.get('#profile-table table tbody tr td label[for="sil-local-dropdown"]').contains('Klingon');
            });

            it('displays a friendly message', () => {
              cy.get('#flash-message').contains('Preferred SIL language updated');
            });
          });

          context('non-existent language selected', () => {
            beforeEach(() => {
              cy.get('#profile-table table tbody tr td #sil-local-dropdown + div button:last-of-type').click();
              cy.wait(300);
              cy.get('#profile-table table tbody tr td #sil-local-dropdown').type('danielese{enter}');
            });

            it('updates the interface', () => {
              cy.get('#profile-table table tbody tr td label[for="sil-local-dropdown"]').contains('Set SIL language preference');
            });

            it('displays a friendly message', () => {
              cy.get('#flash-message').contains('That language does not exist');
            });
          });
        });
      });
    });
  });
});

export {}
