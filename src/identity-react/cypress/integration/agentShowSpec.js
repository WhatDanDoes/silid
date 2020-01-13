// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Agent show', function() {

  let memberAgent;
  before(function() {
    cy.fixture('someguy-auth0-access-token.json').as('agent');
    cy.fixture('someotherguy-auth0-access-token.json').as('anotherAgent');
  });
  
  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit(`/#/agent/333`);
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
    let memberAgent;
    before(function() {
      // Convenient way to create a new agent
      cy.login(this.anotherAgent);
      cy.visit('/#/').then(() => {
        let memberToken = localStorage.getItem('accessToken');
        cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${memberToken}' LIMIT 1;`).then(([results, metadata]) => {
          memberAgent = results[0];
        });
      });
    });
 
    describe('viewing member agent\'s profile', () => {
      beforeEach(function() {
        cy.login(this.agent);
        cy.visit(`/#/agent/${memberAgent.id}`);
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/agent/${memberAgent.id}`);
      });

      it('displays agent social profile info in form', function() {
        cy.get('h3').contains('Profile');
        cy.get('input[name="name"][type="text"]').should('have.value', memberAgent.name);
        cy.get('input[name="email"][type="email"]').should('have.value', memberAgent.email);
        cy.get('button[type="submit"]').should('not.exist');
      });

      it('hides the Save button', () => {
        cy.get('button[type="submit"]').should('not.exist');
      });

      it('permanently disables the input fields', () => {
        cy.get('input[name="email"][type="email"]').should('be.disabled');
        cy.get('input[name="name"][type="text"]').should('be.disabled');
      });
    });

    describe('viewing your own profile', () => {

      let agent;
      beforeEach(function() {
        cy.login(this.agent);
        cy.visit('/#/').then(() => {
          let token = localStorage.getItem('accessToken');
          cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${token}' LIMIT 1;`).then(([results, metadata]) => {
            agent = results[0];
            cy.visit(`/#/agent/${agent.id}`);
          });
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/agent/${agent.id}`);
      });

      it('displays agent social profile info in form', () => {
        cy.get('h3').contains('Profile');
        cy.get('input[name="name"][type="text"]').should('have.value', agent.name);
        cy.get('input[name="name"][type="text"]').should('not.be.disabled');
        cy.get('input[name="email"][type="email"]').should('have.value', agent.email);
        cy.get('input[name="email"][type="email"]').should('be.disabled');
        cy.get('button[type="submit"]').should('exist');
      });

      it('hides the Save button', () => {
        cy.get('button[type="submit"]').should('not.exist');
      });
    });
  });
});

export {}
