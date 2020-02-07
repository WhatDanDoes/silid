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
 
  
  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit('/#/agent');
    });

    it('shows the home page', () => {
      cy.get('h6').contains('Identity');
    });

    it('displays the login button', () => {
      cy.get('#login-link').contains('Login');
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
        cy.login(_profile.email, _profile);
        cy.get('#app-menu-button').click();
        cy.contains('Personal Info').click();
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', '/#/agent');
      });

      it('displays agent social profile info in form', function() {
        cy.get('h3').contains('Profile');
        cy.get('input[name="name"][type="text"]').should('have.value', this.profile.name);
        cy.get('input[name="email"][type="email"]').should('have.value', this.profile.email);
        cy.get('button[type="submit"]').should('exist');
      });

      it('disables the Save button', () => {
        cy.get('button[type="submit"]').should('be.disabled');
      });

      // This is not superfluous
      it('allows user input', () => {
        cy.get('input[name="name"][type="text"]').clear().type('Some Radical Dude');
        cy.get('input[name="name"][type="text"]').should('have.value', 'Some Radical Dude');
      });

      it('enables Save button when Name field changes', () => {
        cy.get('button[type="submit"]').should('be.disabled');
        cy.get('input[name="name"][type="text"]').clear().type('Some Radical Dude');
        cy.get('button[type="submit"]').should('not.be.disabled');
      });

      it('permanently disables the Email field', () => {
        cy.get('input[name="email"][type="email"]').should('be.disabled');
      });

      describe('Cancel button', () => {
        it('displays on form change', function() {
          cy.get('input[name="name"][type="text"]').should('have.value', this.profile.name);
          cy.get('button#cancel-changes').should('not.exist');
          cy.get('input[name="name"][type="text"]').clear().type('Some Radical Dude');
          cy.get('button#cancel-changes').should('exist');
        });

        it('resets changes to the form', function() {
          cy.get('input[name="name"][type="text"]').should('have.value', this.profile.name);
          cy.get('input[name="name"][type="text"]').clear().type('Some Radical Dude');
          cy.get('button#cancel-changes').click();
          cy.get('input[name="name"][type="text"]').should('have.value', this.profile.name);
        });

        it('hides on click', () => {
          cy.get('input[name="name"][type="text"]').clear().type('Some Radical Dude');
          cy.get('button#cancel-changes').should('exist');
          cy.get('button#cancel-changes').click();
          cy.get('button#cancel-changes').should('not.exist');
        });

        it('disables Save button on click', () => {
          cy.get('input[name="name"][type="text"]').clear().type('Some Radical Dude');
          cy.get('button[type="submit"]').should('not.be.disabled');
          cy.get('button#cancel-changes').click();
          cy.get('button[type="submit"]').should('be.disabled');
        });
      });
    });
  });
});

export {}
