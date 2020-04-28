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
      cy.login(_profile.email, _profile, [this.scope.read.agents,
                                          this.scope.create.organizations,
                                          this.scope.read.organizations,
                                          this.scope.create.teams,
                                          this.scope.read.teams]);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
        agent = results[0];
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

//        it('yields focus to the first form field', () => {
//          cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').should('not.exist');
//          cy.get('button span span').contains('add_box').click();
//          cy.focused().should('have.attr', 'placeholder').and('eq', 'Name');
//        });

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

                it('does not allow a duplicate team', function() {
                  // TODO count and test team rows
                  cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('Team Copycat');
                  cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
                  cy.wait(300);
                  cy.get('table tbody tr td').contains('Team Copycat');

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
            });
          });
        });
      });
    });
  });
});

export {}
