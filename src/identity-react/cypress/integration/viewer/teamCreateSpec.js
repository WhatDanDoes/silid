context('viewer/Team creation', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  let _profile;
  beforeEach(function() {
    _profile = {...this.profile};
  });

  context('authenticated', () => {
    let organization, agent;
    beforeEach(function() {
      cy.login(_profile.email, _profile);

      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
        agent = results[0];

        cy.get('#flash-message #close-flash').click();
      });
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    });

    it('lands in the right spot', () => {
      cy.url().should('contain', `/#/agent`);
    });

    describe('interface', () => {
      it('displays Team interface elements', () => {
        cy.get('button span span').contains('add_box');
      });

      describe('add-team button', () => {
        it('reveals the input form', () => {
          cy.get('div div div div div div table tbody tr td div button[title="Save"]').should('not.exist');
          cy.get('div div div div div div table tbody tr td div button[title="Cancel"]').should('not.exist');
          cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').should('not.exist');
          cy.get('div div div div div div table tbody tr td div div input[placeholder="Leader"]').should('not.exist');
          cy.get('button span span').contains('add_box').click();
          cy.get('div div div div div div table tbody tr td div button[title="Save"]').should('exist');
          cy.get('div div div div div div table tbody tr td div button[title="Cancel"]').should('exist');
          cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').should('exist');
          cy.get('div div div div div div table tbody tr td div div input[placeholder="Leader"]').should('not.exist');
        });

        it('gives focus to the team name input field', () => {
          cy.get('button span span').contains('add_box').click();
          cy.focused().should('have.attr', 'placeholder').and('eq', 'Name');
        });

        describe('add-team-form', () => {
          beforeEach(() => {
            cy.get('button span span').contains('add_box').click();
          });

          it('renders the input form correctly', () => {
            cy.get('div div div div div div table tbody tr td div button[title="Save"]').should('exist');
            cy.get('div div div div div div table tbody tr td div button[title="Cancel"]').should('exist');
            cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').should('exist');
            cy.get('div div div div div div table tbody tr td div div input[placeholder="Leader"]').should('not.exist');
          });

          describe('cancel-changes button', () => {
            it('hides the add-team-form', function() {
              cy.get('div div div div div div table tbody tr td div button[title="Save"]').should('exist');
              cy.get('div div div div div div table tbody tr td div button[title="Cancel"]').should('exist');
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').should('exist');
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Leader"]').should('not.exist');

              cy.get('div div div div div div table tbody tr td div button[title="Cancel"]').click();

              cy.get('div div div div div div table tbody tr td div button[title="Save"]').should('not.exist');
              cy.get('div div div div div div table tbody tr td div button[title="Cancel"]').should('not.exist');
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').should('not.exist');
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Leader"]').should('not.exist');

            });

            it('clears the name input field', function() {
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('The Justice League');
              cy.get('div div div div div div table tbody tr td div button[title="Cancel"]').click();
              cy.get('button span span').contains('add_box').click();
              cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').should('be.empty');
            });
          });

          describe('add-team-button', () => {
            context('invalid form', () => {
              describe('name field', () => {
                it('does not allow a blank field', function() {
                  cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').clear();
                  cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('            ');
                  cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').should('have.value', '            ');
                  cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
                  cy.contains('Team name can\'t be blank');
                });

                it('does not allow an empty field', function() {
                  cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('Some new team');
                  cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').clear();
                  cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').should('have.value', '');
                  cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
                  cy.contains('Team name can\'t be blank');
                });

                it('does not allow a duplicate team no matter how many times you try', function() {
                  cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('Team Copycat');
                  cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
                  cy.wait(300);
                  cy.get('table tbody tr td').contains('Team Copycat');

                  cy.get('button span span').contains('add_box').click();
                  cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('Team Copycat');
                  cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
                  cy.wait(300);
                  cy.get('#flash-message').contains('That team is already registered');

                  // Try a second time to ensure the flash message resets
                  cy.get('#flash-message #close-flash').click();
                  cy.get('button span span').contains('add_box').click();
                  cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('Team Copycat');
                  cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
                  cy.wait(300);
                  cy.contains('That team is already registered');
                });
              });
            });

            context('valid form', () => {
              it('updates the record on the interface', function() {
                cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('The Mike Tyson Mystery Team');
                cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
                cy.wait(300);
                cy.get('table tbody tr td').contains('The Mike Tyson Mystery Team');
                cy.get('table tbody tr td').contains(_profile.email);
              });

              it('persists new team data between browser refreshes', function() {
                cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('The Mike Tyson Mystery Team');
                cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
                cy.wait(300);
                cy.get('table tbody tr td').contains('The Mike Tyson Mystery Team');
                cy.get('table tbody tr td').contains(_profile.email);

                cy.reload();
                cy.wait(300);

                cy.get('table tbody tr td').contains('The Mike Tyson Mystery Team');
                cy.get('table tbody tr td').contains(_profile.email);
              });

              it('allows adding multiple teams', function() {
                // 2, because the `add_box` has been clicked and it is a table row.
                // Also, the 'No records to display' message is in a table row
                cy.get('table tbody:nth-child(2)').find('tr').its('length').should('eq', 2);

                cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('The Mike Tyson Mystery Team');
                cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
                cy.wait(300);
                cy.get('table tbody tr td').contains('The Mike Tyson Mystery Team');
                cy.get('table tbody tr td').contains(_profile.email);

                // 1, because the message is replaced by a team and the add-team-form is hidden
                cy.get('table tbody:nth-child(2)').find('tr').its('length').should('eq', 1);

                cy.get('button span span').contains('add_box').click();
                cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('Mystery Incorporated');
                cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
                cy.wait(300);
                cy.get('table tbody tr td').contains('Mystery Incorporated');
                cy.get('table tbody tr td').contains(_profile.email);

                cy.get('table tbody:nth-child(2)').find('tr').its('length').should('eq', 2);
              });

              it('allows adding multiple teams whilst navigating', function() {
                // 2, because the `add_box` has been clicked and it is a table row.
                // Also, the 'No records to display' message is in a table row
                cy.get('table tbody:nth-child(2)').find('tr').its('length').should('eq', 2);

                cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('The Mike Tyson Mystery Team');
                cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
                cy.wait(300);
                cy.get('table tbody tr td').contains('The Mike Tyson Mystery Team');
                cy.get('table tbody tr td').contains(_profile.email);

                // 1, because the message is replaced by a team and the add-team-form is hidden
                cy.get('table tbody:nth-child(2)').find('tr').its('length').should('eq', 1);

                // Navigate to the newly created team
                cy.contains('The Mike Tyson Mystery Team').click();
                cy.wait(300);
                cy.go('back');
                cy.wait(300);

                cy.get('button span span').contains('add_box').click();
                cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('Mystery Incorporated');
                cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
                cy.wait(300);
                cy.get('table tbody tr td').contains('Mystery Incorporated');
                cy.get('table tbody tr td').contains(_profile.email);

                cy.get('table tbody:nth-child(2)').find('tr').its('length').should('eq', 2);
              });

              it('displays progress spinner', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('div[role="progressbar"] svg circle').should('not.exist');

                cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('The Mike Tyson Mystery Team');
                cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();

                // 2020-5-26
                // Cypress goes too fast for this. Cypress also cannot intercept
                // native `fetch` calls to allow stubbing and delaying the route.
                // Shamefully, this is currently manually tested, though I suspect
                // I will use this opportunity to learn Jest
                // Despite its name, this test really ensures the spinner disappears
                // after all is said and done
                //cy.get('div[role="progressbar"] svg circle').should('exist');
                cy.wait(100);
                cy.get('div[role="progressbar"] svg circle').should('not.exist');
              });

              describe('executes team creation with Enter key', () => {
                it('updates the record on the interface', function() {
                  cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('The Mike Tyson Mystery Team{enter}');
                  cy.wait(300);
                  cy.get('table tbody tr td').contains('The Mike Tyson Mystery Team');
                  cy.get('table tbody tr td').contains(_profile.email);
                });

                it('closes the input field', () => {
                  cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('Mystery Incorporated{enter}');
                  cy.wait(300);
                  cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').should('not.exist');
                });
              });
            });
          });
        });
      });
    });
  });
});

export {}
