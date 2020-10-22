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
    let agent;
    beforeEach(() => {
      cy.login(_profile.email, _profile);
      cy.get('#flash-message #close-flash').click();
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
        agent = results[0];
      });
    });

    describe('agentShow', () => {
      describe('no SIL language preference set', () => {

        it('displays agent\'s info', () => {
          cy.get('h3').contains('Profile');
          cy.get('#profile-table table tbody tr th').contains('Name:');
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', agent.socialProfile.name);
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('not.be.disabled');

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

          /**
           * 2020-9-15
           *
           * There once was a time when all living/constructed languages would be retreived from the
           * server. This functionality still exists, but has been supplanted in favour of only
           * retrieving languages that are currently supported.
           *
           */
          //it('populates the dropdown with 7027 living languages and 22 constructed', () => {
          //  cy.get('div[role="presentation"] ul li').should('not.exist');
          //  cy.get('#profile-table table tbody tr td #sil-local-dropdown + div button:last-of-type').click();
          //  cy.wait(300);
          //  cy.get('div[role="presentation"] ul li').its('length').should('eq', 7027 + 22);
          //});

          // Cf. above...
          it('populates the dropdown the languages for which copy has been translated (currently 2)', () => {
            cy.get('div[role="presentation"] ul li').should('not.exist');
            cy.get('#profile-table table tbody tr td #sil-local-dropdown + div button:last-of-type').click();
            cy.wait(300);
            cy.get('div[role="presentation"] ul li').its('length').should('eq', 2);
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
              // Profile table
              cy.get('h3').contains('tlhIlHal De\'');

              // Name
              cy.get('#profile-table table tbody tr th').contains('Pong:');
              cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', agent.socialProfile.name);
              cy.get('#profile-table table tbody tr td input#agent-name-field').should('not.be.disabled');

              // Email
              cy.get('#profile-table table tbody tr th').contains('De\'wI\' QIn:');
              cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.email);
              // Provider locale
              cy.get('#profile-table table tbody tr th').contains('Latlh Hol:');
              cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.locale);

              // SIL locale
              cy.get('#profile-table table tbody tr th').contains('SIL Hol:');
              cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('not.be.disabled');
              cy.get('#profile-table table tbody tr td label[for="sil-local-dropdown"]').contains('HIjmeH SIL Hol neH');
              cy.get('#profile-table table tbody tr td input#sil-local-dropdown').should('have.attr', 'value').and('equal', 'Klingon');

              // Roles
              cy.get('#profile-table table tbody tr:last-of-type th').contains('Naw\':');
              cy.get('#profile-table table tbody tr:last-of-type div').its('length').should('eq', 1);
              cy.get('#profile-table table tbody tr:last-of-type div').contains('viewer');
              cy.get('#profile-table table tbody tr:last-of-type div#assign-role').should('not.exist');

              // Social Data
              cy.get('h3:last-of-type').contains('BoS De\'');
            });

            it('persists the change', () => {
              cy.get('#profile-table table tbody tr td input#sil-local-dropdown').should('have.attr', 'value').and('equal', 'Klingon');
              cy.reload();
              cy.wait(300);
              cy.get('#profile-table table tbody tr td input#sil-local-dropdown').should('have.attr', 'value').and('equal', 'Klingon');
            });

            describe('interface language', () => {
              describe('#teams-table', () => {
                beforeEach(() => {
                  // Identity
                  cy.contains('vIchIDmeH, Qatlh Qu\'').click();
                  cy.wait(300);
                });

                it('displays translated copy', () => {
                  // Teams table
                  cy.get('#teams-table h6').contains('Ghom');
                  // No records to display
                  cy.get('#teams-table table tbody tr td').contains('Pagh ta');
                  // Name
                  cy.get('#teams-table table thead tr th').contains('Pong');
                  // Leader
                  cy.get('#teams-table table thead tr th').contains('DevwI\'');
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
              cy.wait(300);
            });

            it('displays agent\'s info', () => {
              cy.get('h3').contains('Profile');
              cy.get('#profile-table table tbody tr th').contains('Name:');
              cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', agent.socialProfile.name);
              cy.get('#profile-table table tbody tr td input#agent-name-field').should('not.be.disabled');

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

          /**
           * 2020-9-15
           *
           * Cf. with dated note above....
           *
           * There once was a time when all living/constructed languages would be retreived from the
           * server. This functionality still exists, but has been supplanted in favour of only
           * retrieving languages that are currently supported.
           *
           * You cannot currently select a language without translated copy.
           */
          //context('language with no translated copy selected', () => {
          //  beforeEach(() => {
          //    cy.get('#profile-table table tbody tr td #sil-local-dropdown + div button:last-of-type').click();
          //    cy.wait(300);
          //    cy.get('#profile-table table tbody tr td #sil-local-dropdown').type('Chinook{downarrow}{enter}');
          //    cy.wait(300);
          //  });

          //  it('displays agent\'s info', () => {
          //    cy.get('h3').contains('Profile');
          //    cy.get('#profile-table table tbody tr th').contains('Name:');
          //    cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', agent.socialProfile.name);
          //    cy.get('#profile-table table tbody tr td input#agent-name-field').should('not.be.disabled');

          //    cy.get('#profile-table table tbody tr th').contains('Email:');
          //    cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.email);

          //    cy.get('#profile-table table tbody tr th').contains('Provider Locale:');
          //    cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.locale);

          //    cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
          //    cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('not.be.disabled');

          //    cy.get('#profile-table table tbody tr td label[for="sil-local-dropdown"]').contains('Set SIL language preference');
          //    cy.get('#profile-table table tbody tr td input#sil-local-dropdown').should('have.attr', 'value').and('equal', 'Chinook jargon');
          //    cy.get('#profile-table table tbody tr:last-of-type th').contains('Roles:');
          //    cy.get('#profile-table table tbody tr:last-of-type div').its('length').should('eq', 1);
          //    cy.get('#profile-table table tbody tr:last-of-type div').contains('viewer');
          //    cy.get('#profile-table table tbody tr:last-of-type div#assign-role').should('not.exist');
          //  });

          //  it('persists in having not changed', () => {
          //    cy.get('#profile-table table tbody tr td label[for="sil-local-dropdown"]').contains('Set SIL language preference');
          //    cy.get('#profile-table table tbody tr td input#sil-local-dropdown').should('have.attr', 'value').and('equal', 'Chinook jargon');
          //    cy.reload();
          //    cy.wait(300);
          //    cy.get('#profile-table table tbody tr td input#sil-local-dropdown').should('have.attr', 'value').and('equal', 'Chinook jargon');
          //    cy.get('#profile-table table tbody tr td label[for="sil-local-dropdown"]').contains('Set SIL language preference');
          //  });
          //});
        });
      });
    });
  });
});

export {}