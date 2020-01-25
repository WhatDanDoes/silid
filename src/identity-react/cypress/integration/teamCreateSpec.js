// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Team creation', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
  });

  let _profile;
  beforeEach(function() {
    // Why?
    _profile = {...this.profile};
  });

  context('authenticated', () => {
    let organization, agent;
    beforeEach(function() {
      cy.login(_profile.email, _profile);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
        agent = results[0];
        cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then(org => {
          cy.visit('/#/').then(() => {
            organization = org.body;
            cy.get('#app-menu-button').click();
            cy.get('#organization-button').click();
            cy.contains('One Book Canada').click();
          });
        });
      });
    });
  
    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
    });
  
    it('lands in the right spot', () => {
      cy.url().should('contain', `/#/organization/${organization.id}`);
    });
  
    describe('interface', () => {
      it('displays Team interface elements', () => {
        cy.get('button#add-team').should('exist');
        cy.get('input[name="name"][type="text"]').should('not.exist');
        cy.get('button[type="submit"]').should('not.exist');
        cy.get('button#cancel-changes').should('not.exist');
      });

      describe('add-team button', () => {
        it('reveals the input form', () => {
          cy.get('form#add-team-form').should('not.exist');
          cy.get('button#add-team').click();
          cy.get('form#add-team-form').should('exist');
        });

        it('yields focus to the first form field', () => {
          cy.get('form#add-team-form').should('not.exist');
          cy.get('button#add-team').click();
          cy.focused().should('have.attr', 'name').and('eq', 'name');
        });

        describe('add-team-form', () => {
          beforeEach(() => {
            cy.get('button#add-team').click();
          });

          it('renders the input form correctly', () => {
            cy.get('button#add-team').should('not.exist');
            cy.get('input[name="name"][type="text"]').should('exist');
            cy.get('button[type="submit"]').should('exist');
            cy.get('button#cancel-changes').should('exist');
          });

          describe('cancel-changes button', () => {
            it('hides the add-team-form', function() {
              cy.get('form#add-team-form').should('exist');
              cy.get('button#cancel-changes').click();
              cy.get('form#add-team-form').should('not.exist');
            });
  
            it('clears the name input field', function() {
              cy.get('input[name="name"][type="text"]').type('The Justice League');
              cy.get('button#cancel-changes').click();
              cy.get('button#add-team').click();
              cy.get('input[name="name"][type="text"]').should('be.empty');
            });
          });

          describe('add-team-button', () => {
            context('invalid form', () => {
              describe('name field', () => {
                it('does not allow a blank field', function() {
                  cy.get('input[name="name"][type="text"]').clear();
                  cy.get('input[name="name"][type="text"]').type('     ');
                  cy.get('input[name="name"][type="text"]').should('have.value', '     ');
                  cy.get('.error').contains('name can\'t be blank');
                  cy.get('button[type="submit"]').should('be.disabled');
                });
              });
            });

            context('valid form', () => {
              it('updates the record in the database', function() {
                cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(0);
                  cy.get('input[name="name"][type="text"]').type('The Justice League');
                  cy.get('button[type="submit"]').click();
                  cy.wait(500);
                  cy.task('query', `SELECT * FROM "Teams"`).then(([results, metadata]) => {;
                    expect(results[0].name).to.eq('The Justice League');
                  });
                });
              });
      
              it('hides the add-team-form', function() {
                cy.get('input[name="name"][type="text"]').type('The Justice League');
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.get('form#add-team-form').should('not.exist');
              });

              it('updates the record on the interface', function() {
                cy.get('#organization-team-list').should('not.exist');
                cy.get('input[name="name"][type="text"]').type('The Justice League');
                cy.get('button[type="submit"]').click();
                cy.wait(500);
                cy.get('#organization-team-list').find('.list-item').its('length').should('eq', 1);
                cy.get('#organization-team-list .list-item').first().contains('The Justice League');
              });
            });
          });
        });
      });
    });
  });
});

export {}
