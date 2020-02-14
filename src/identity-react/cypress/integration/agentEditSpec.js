// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Agent', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
  });
  
  let _profile;
  beforeEach(function() {
    // Why?
    _profile = {...this.profile};
  });
 
  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
  });

  describe('Editing', () => {
    context('success', () => {
      let agent, token;
      beforeEach(function() {
        cy.login(_profile.email, _profile);
        cy.get('#app-menu-button').click();
        cy.contains('Profile').click().then(() => {
          cy.wait(500); // <--- There has to be a better way!!! Cypress is going too quick for the database
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', '/#/agent');
      });

      it('does not allow an empty field', function() {
        cy.get('input[name="name"][type="text"]:invalid').should('have.length', 0)
        cy.get('input[name="name"][type="text"]').should('have.value', this.profile.name);
        cy.get('input[name="name"][type="text"]').clear();
        cy.get('input[name="name"][type="text"]').should('have.value', '');
        cy.get('button[type="submit"]').click();
        cy.get('input[name="name"][type="text"]:invalid').should('have.length', 1)
        cy.get('input[name="name"][type="text"]:invalid').then($input => {
          expect($input[0].validationMessage).to.eq('name required')
        });
      });

      it('updates the record in the database', function() {
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          cy.get('input[name="name"][type="text"]').should('have.value', results[0].name);
          cy.get('input[name="name"][type="text"]').clear().type('Dick Wolf');
          cy.get('button[type="submit"]').click();
          cy.wait(500);
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            expect(results[0].name).to.eq('Dick Wolf');
          });
        });
      });

      it('updates the record on the interface', function() {
        cy.get('input[name="name"][type="text"]').clear().type('Dick Wolf');
        cy.get('button[type="submit"]').click();
        cy.get('input[name="name"][type="text"]').should('have.value', 'Dick Wolf');
        cy.get('button[type="submit"]').should('be.disabled');
        cy.get('button#cancel-changes').should('not.exist');
      });
    });
  });
});

export {}
