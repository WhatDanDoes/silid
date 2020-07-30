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
          cy.get('#profile-table table tbody tr td input#sil-local-dropdown').should('have.attr', 'value').and('equal', 'English');
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

          it('displays a spinner when new language is set', () => {
            cy.get('#profile-table table tbody tr td #sil-local-dropdown + div button:last-of-type').click();
            cy.wait(300);
            cy.get('#set-locale-spinner').should('not.exist');
            cy.get('#profile-table table tbody tr td #sil-local-dropdown').type('kling{downarrow}{enter}');
            // Cypress goes too fast for the spinner. This ensures it disappears when done
            //cy.get('#set-locale-spinner').should('exist');
            cy.wait(300);
            cy.get('#set-locale-spinner').should('not.exist');
          });

          context('existing language selected', () => {
            beforeEach(() => {
              cy.get('#profile-table table tbody tr td #sil-local-dropdown + div button:last-of-type').click();
              cy.wait(300);
              cy.get('#profile-table table tbody tr td #sil-local-dropdown').type('kling{downarrow}{enter}');
              cy.wait(300);
            });

            it('displays a friendly message', () => {
              cy.get('#flash-message').contains('Preferred SIL language updated');
            });

            it('updates the interface', () => {
              cy.get('h3').contains('Profile');
              cy.get('#profile-table table tbody tr th').contains('Name:');
              cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.name);
              cy.get('#profile-table table tbody tr th').contains('Email:');
              cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.email);
              cy.get('#profile-table table tbody tr th').contains('Provider Locale:');
              cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.locale);
              cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
              cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('not.be.disabled');
              cy.get('#profile-table table tbody tr td input#sil-local-dropdown').should('have.attr', 'value').and('equal', 'Klingon');
              cy.get('#profile-table table tbody tr:last-of-type th').contains('Roles:');
              cy.get('#profile-table table tbody tr:last-of-type div').its('length').should('eq', 1);
              cy.get('#profile-table table tbody tr:last-of-type div').contains('viewer');
              cy.get('#profile-table table tbody tr:last-of-type div#assign-role').should('not.exist');
            });

            it('persists the change', () => {
              cy.get('#profile-table table tbody tr td input#sil-local-dropdown').should('have.attr', 'value').and('equal', 'Klingon');
              cy.reload();
              cy.wait(300);
              cy.get('#profile-table table tbody tr td input#sil-local-dropdown').should('have.attr', 'value').and('equal', 'Klingon');
            });

            describe('interface language', () => {
              describe('agent show view', () => {
                beforeEach(() => {
                  cy.contains('Identity').click();
                  cy.wait(300);
                });

                it('changes interface language', () => {
                  // Profile table
                  cy.get('h3').contains('tlhIlHal De\'');
                  // Name
                  cy.get('#profile-table table tbody tr th').contains('Pong:');
                  // Email
                  cy.get('#profile-table table tbody tr th').contains('De\'wI\' QIn:');
                  // Provider locale
                  cy.get('#profile-table table tbody tr th').contains('Latlh Hol:');
                  // SIL locale
                  cy.get('#profile-table table tbody tr th').contains('SIL Hol:');
                  // Roles
                  cy.get('#profile-table table tbody tr:last-of-type th').contains('Naw\':');

                  // Organizations table
//                  cy.get('#organizations-table h6').contains('Teams');
//                  cy.get('#organizations-table table tbody tr td').contains('No records to display');
//                  cy.get('#organizations-table table thead tr th').contains('Name');
//                  cy.get('#organizations-table table thead tr th').contains('Leader');


                  // Teams table
//                  cy.get('#teams-table h6').contains('Ghom');
                  // No records to display
//                  cy.get('#teams-table table tbody tr td').contains('Pagh ta');
                  // Name
//                  cy.get('#teams-table table thead tr th').contains('Pong');
//                  // Leader
//                  cy.get('#teams-table table thead tr th').contains('DevwI\'');
//
                  // Social Data
                  cy.get('h3:last-of-type').contains('BoS De\'');

                });

                it('changes interface language', () => {
                });
              });
            });
          });

          context('non-existent language selected', () => {
            beforeEach(() => {
              cy.get('#profile-table table tbody tr td #sil-local-dropdown + div button:last-of-type').click();
              cy.wait(300);
              // This needs to _blur_ because `Enter` does nothing when there's no valid selection
              cy.get('#profile-table table tbody tr td #sil-local-dropdown').type('danielese{enter}').blur();
            });

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
              cy.get('#profile-table table tbody tr td input#sil-local-dropdown').should('have.attr', 'value').and('equal', 'English');
              cy.get('#profile-table table tbody tr:last-of-type th').contains('Roles:');
              cy.get('#profile-table table tbody tr:last-of-type div').its('length').should('eq', 1);
              cy.get('#profile-table table tbody tr:last-of-type div').contains('viewer');
              cy.get('#profile-table table tbody tr:last-of-type div#assign-role').should('not.exist');
            });

            it('persists in having not changed', () => {
              cy.get('#profile-table table tbody tr td label[for="sil-local-dropdown"]').contains('Set SIL language preference');
              cy.get('#profile-table table tbody tr td input#sil-local-dropdown').should('have.attr', 'value').and('equal', 'English');
              cy.reload();
              cy.wait(300);
              cy.get('#profile-table table tbody tr td input#sil-local-dropdown').should('have.attr', 'value').and('equal', 'English');
              cy.get('#profile-table table tbody tr td label[for="sil-local-dropdown"]').contains('Set SIL language preference');
            });
          });
        });
      });
    });
  });
});

export {}
