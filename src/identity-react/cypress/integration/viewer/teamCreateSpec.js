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

                it.only('does not allow a duplicate team', function() {
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

//                  cy.get('input[name="name"][type="text"]').type('Team Copycat');
//                  cy.get('button[type="submit"]').click();
//                  cy.wait(500);
//                  cy.get('button#add-team').click();
//                  cy.get('#organization-team-list .list-item').first().contains('Team Copycat');
//                  cy.get('input[name="name"][type="text"]').type('Team Copycat');
//                  cy.get('button[type="submit"]').click();
//                  cy.wait(500);
//                  cy.get('#organization-team-list').find('.list-item').its('length').should('eq', 1);
//                  cy.get('#flash-message').contains('That team is already registered');
                });
              });
            });

            context('valid form', () => {
//              it('updates the record in the database', function() {
//                cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
//                  expect(results.length).to.eq(0);
//                  cy.get('input[name="name"][type="text"]').type('The Justice League');
//                  cy.get('button[type="submit"]').click();
//                  cy.wait(500);
//                  cy.task('query', `SELECT * FROM "Teams"`).then(([results, metadata]) => {;
//                    expect(results[0].name).to.eq('The Justice League');
//                  });
//                });
//              });
//
//              it('hides the add-team-form', function() {
//                cy.get('input[name="name"][type="text"]').type('The Justice League');
//                cy.get('button[type="submit"]').click();
//                cy.wait(500);
//                cy.get('form#add-team-form').should('not.exist');
//              });
//
              it('updates the record on the interface', function() {
//                cy.get('#organization-team-list').should('not.exist');
//                cy.get('input[name="name"][type="text"]').type('The Justice League');
//                cy.get('button[type="submit"]').click();
//                cy.wait(500);
//                cy.get('#organization-team-list').find('.list-item').its('length').should('eq', 1);
//                cy.get('#organization-team-list .list-item').first().contains('The Justice League');

                cy.get('div div div div div div table tbody tr td div div input[placeholder="Name"]').type('The Mike Tyson Mystery Team');
                cy.get('div div div div div div table tbody tr td div button[title="Save"]').click();
                cy.wait(300);
                cy.get('table tbody tr td').contains('The Mike Tyson Mystery Team');
                cy.get('table tbody tr td').contains(_profile.email);
              });
            });
          });
        });
      });
    });
  });
});

export {}
