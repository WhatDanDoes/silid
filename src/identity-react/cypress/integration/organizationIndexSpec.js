// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Organization', function() {

  before(function() {
    cy.fixture('someguy-auth0-access-token.json').as('agent');
    cy.fixture('someotherguy-auth0-access-token.json').as('anotherAgent');
  });
  
  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit('/#/organization');
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

    let token, agent;
    beforeEach(function() {
      cy.login(this.agent);
      cy.get('#app-menu-button').click();
      cy.contains('Organizations').click().then(() =>  {
        token = localStorage.getItem('accessToken');
        cy.request({ url: '/agent',  method: 'POST', auth: { bearer: token } });
        cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${token}' LIMIT 1;`).then(([results, metadata]) => {
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

    it('displays common Organization interface elements', function() {
      cy.get('h3').contains('Organizations');
      cy.get('button#add-organization').should('exist');
    });

    describe('organization membership', () => {
      context('no organizations', () => {
        it('displays no organizations', () => {
          cy.task('query', 'SELECT * FROM "Organizations";').then(([results, metadata]) => {
            expect(results.length).to.equal(0);
            cy.get('#organization-list').should('not.exist');
          });
        });
      });

      context('some organizations', () => {
        let organization;
        beforeEach(function() {

          // Create an organization with another agent
          cy.login(this.anotherAgent);
          const anotherToken = localStorage.getItem('accessToken');
          cy.request({ url: '/organization',  method: 'POST', auth: { bearer: anotherToken }, body: { name: 'One Book Canada', agent_organization: [agent.id] } }).then(() => {

            cy.login(this.agent);
            cy.visit('/#/');
            cy.get('#app-menu-button').click();
            cy.get('#organization-button').click();
          });
        });

        it('displays a list of organizations', () => {
          cy.get('#organization-list').should('exist');
        });
      });
    });

    describe('organization creator', () => {

      context('no organizations created by this agent', () => {
        it('displays no organizations', () => {
          cy.task('query', `SELECT * FROM "Organizations" WHERE "creatorId"=${agent.id};`).then(([results, metadata]) => {;
            expect(results.length).to.equal(0);
            cy.get('#organization-list').should('not.exist');
          });
        });
      });

      context('agent has created organizations', () => {

        let organization;
        beforeEach(() => {
          cy.visit('/#/');
          cy.request({ url: '/organization',  method: 'POST', auth: { bearer: token }, body: { name: 'One Book Canada' } }).then(() => {
            cy.get('#app-menu-button').click();
            cy.get('#organization-button').click();
          });
        });

        it('displays a list of organizations', () => {
          cy.get('#organization-list').should('exist');
        });
      });
    });
  });
});

export {}
