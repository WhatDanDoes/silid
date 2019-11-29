// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Agent', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
    cy.fixture('someguy-auth0-access-token.json').as('agent');
  });
  
  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit('/#/agent');
    });

    it('shows the home page', () => {
      cy.get('h6').contains('Identity');
    });

    it('displays the login button', () => {
      cy.get('#login-button').contains('Login');
    });

    it('does not display the logout button', () => {
      cy.get('#logout-button').should('not.exist');
    });

    it('redirects home', () => {
      cy.location('pathname').should('equal', '/');
    });
  });

  describe('authenticated', () => {

    context('first visit', () => {
      beforeEach(function() {
        cy.login(this.agent);
        cy.get('#app-menu-button').click();
        cy.contains('Personal Info').click();
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', '/#/agent');
      });

      it('displays agent social profile info in form', function() {
        cy.get('h3').contains('Profile Page');
        cy.get('input[name="name"][type="string"]').should('have.value', this.profile.name);
        cy.get('input[name="email"][type="email"]').should('have.value', this.profile.email);
        cy.get('button[type="submit"]').should('exist');
      });

      it('disables the Save button', () => {
        cy.get('button[type="submit"]').should('be.disabled');
      });

      it('enables Save button when Name field changes', () => {
        cy.get('button[type="submit"]').should('be.disabled');
        cy.get('input[name="name"][type="text"]').type('Some Guy');
        cy.get('button[type="submit"]').should('not.be.disabled');
      });

      it('enables Save button when Email field changes', () => {
        cy.get('button[type="submit"]').should('be.disabled');
        cy.get('input[name="email"][type="email"]').type('someguy@example.com');
        cy.get('button[type="submit"]').should('not.be.disabled');
      });
    });
  });
});

export {}
