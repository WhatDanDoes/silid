// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Organization creation', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
  });

  let _profile;
  beforeEach(function() {
    // Why?
    _profile = {...this.profile};
  });

  let agent;

  context('authenticated', () => {
    beforeEach(function() {
      cy.login(_profile.email, _profile);
      cy.get('#app-menu-button').click();
      cy.contains('Organizations').click().then(() =>  {
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
        });
      });
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
    });

    it('lands in the right spot', () => {
      cy.url().should('contain', '/#/organization');
    });

    describe('interface', () => {
      it('displays common Organization interface elements', () => {
        cy.get('h3').contains('Organizations');
        cy.get('button#add-organization').should('exist');
        cy.get('input[name="name"][type="text"]').should('not.exist');
        cy.get('button[type="submit"]').should('not.exist');
        cy.get('button#cancel-changes').should('not.exist');
      });

      describe('add-organization button', () => {
        it('reveals the input form', () => {
          cy.get('form#add-organization-form').should('not.exist');
          cy.get('button#add-organization').click();
          cy.get('form#add-organization-form').should('exist');
        });

        it('yields focus to the first form field', () => {
          cy.get('form#add-organization-form').should('not.exist');
          cy.get('button#add-organization').click();
          cy.focused().should('have.attr', 'name').and('eq', 'name');
        });

        describe('add-organization-form', () => {
          beforeEach(() => {
            cy.get('button#add-organization').click();
          });

          it('renders the input form correctly', () => {
            cy.get('button#add-organization').should('not.exist');
            cy.get('input[name="name"][type="text"]').should('exist');
            cy.get('button[type="submit"]').should('exist');
            cy.get('button#cancel-changes').should('exist');
          });

          describe('cancel-changes button', () => {
            it('hides the add-organization-form', function() {
              cy.get('form#add-organization-form').should('exist');
              cy.get('button#cancel-changes').click();
              cy.get('form#add-organization-form').should('not.exist');
            });

            it('clears the name input field', function() {
              cy.get('input[name="name"][type="text"]').type('The Justice League');
              cy.get('button#cancel-changes').click();
              cy.get('button#add-organization').click();
              cy.get('input[name="name"][type="text"]').should('be.empty');
            });
          });

          describe('add-organization-button', () => {
            context('valid form', () => {
              it('updates the record in the database', function() {
                cy.task('query', `SELECT * FROM "Organizations";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(0);
                  cy.get('input[name="name"][type="text"]').type('The Justice League');
                  cy.get('button[type="submit"]').click();
                  cy.wait(500);
                  cy.task('query', `SELECT * FROM "Organizations"`).then(([results, metadata]) => {;
                    expect(results[0].name).to.eq('The Justice League');
                  });
                });
              });

              it('hides the add-organization-form', function() {
                cy.get('input[name="name"][type="text"]').type('The Justice League');
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.get('form#add-organization-form').should('not.exist');
              });

              it('updates the record on the interface', function() {
                cy.get('#organization-list').should('not.exist');
                cy.get('input[name="name"][type="text"]').type('The Justice League');
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.get('#organization-list').find('.list-item').its('length').should('eq', 1);
                cy.get('#organization-list .list-item').first().contains('The Justice League');
              });
            });

            context('invalid form', () => {
              describe('name field', () => {
                it('does not allow an empty field', function() {
                  cy.get('input[name="name"][type="text"]').type('International Association of Super Criminals');
                  cy.get('input[name="name"][type="text"]').clear();
                  cy.get('input[name="name"][type="text"]').should('have.value', '');
                  cy.get('.error').contains('This is a required field');
                  cy.get('button[type="submit"]').should('be.disabled');
                });

                it('does not allow a blank field', function() {
                  cy.get('input[name="name"][type="text"]').type('     ');
                  cy.get('input[name="name"][type="text"]').should('have.value', '     ');
                  cy.get('.error').contains('name can\'t be blank');
                  cy.get('button[type="submit"]').should('be.disabled');
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
