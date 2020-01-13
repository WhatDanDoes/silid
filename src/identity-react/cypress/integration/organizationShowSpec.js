// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Organization show', function() {

  before(function() {
    cy.fixture('someguy-auth0-access-token.json').as('agent');
    cy.fixture('someotherguy-auth0-access-token.json').as('anotherAgent');
  });

  
  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit('/#/organization/1');
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
      cy.visit('/#/').then(() => {
        token = localStorage.getItem('accessToken');
        cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${token}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
        });
      });
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
    });

    it('doesn\'t barf if organization doesn\'t exist', () => {
      cy.visit('/#/organization/333');
      cy.get('#error-message').contains('No such organization');
    });

    context('creator agent visit', () => {

      let organization;
      beforeEach(function() {
        cy.request({ url: '/organization',  method: 'POST', auth: { bearer: token }, body: { name: 'One Book Canada' } }).then((org) => {
          organization = org.body;
          cy.get('#app-menu-button').click();
          cy.get('#organization-button').click();
          cy.contains('One Book Canada').click();
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/organization/${organization.id}`);
      });

      it('displays common Organization interface elements', function() {
        cy.get('h3').contains('One Book Canada');
        cy.get('button#add-team').should('exist');
        cy.get('button#add-agent').should('exist');
        cy.get('button#edit-organization').should('exist');
      });
    });

    context('member agent visit', () => {

      let memberAgent, memberToken, organization;
      beforeEach(function() {
        cy.login(this.anotherAgent);


        cy.visit('/#/').then(() => {
          memberToken = localStorage.getItem('accessToken');
          cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${memberToken}' LIMIT 1;`).then(([results, metadata]) => {
            memberAgent = results[0];

            // Note: this organization is being created by `agent` (not `memberAgent`) by virtue of `token` (not `memberToken`)
            cy.request({ url: '/organization',  method: 'POST', auth: { bearer: token }, body: { name: 'One Book Canada' } }).then((org) => {
              organization = org.body;
              cy.request({ url: '/organization',  method: 'PATCH', auth: { bearer: token }, body: { id: organization.id, memberId: memberAgent.id } }).then((res) => {
                cy.get('#app-menu-button').click();
                cy.get('#organization-button').click();
                cy.contains('One Book Canada').click();
              });
            });
          });
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/organization/${organization.id}`);
      });

      it('displays common Organization interface elements', function() {
        cy.get('h3').contains('One Book Canada');
        cy.get('#edit-organization-form').should('not.exist');
        cy.get('button#edit-organization').should('not.exist');
        cy.get('button#add-team').should('exist');
        cy.get('button#add-agent').should('not.exist');
      });
    });

    context('non-member agent visit', () => {

      let nonMemberAgent, nonMemberToken, organization;
      beforeEach(function() {
        cy.login(this.anotherAgent);

        cy.visit('/#/').then(() => {
          nonMemberAgent = localStorage.getItem('accessToken');
          cy.task('query', `SELECT * FROM "Agents"`).then(([results, metadata]) => {
            cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${nonMemberAgent}' LIMIT 1;`).then(([results, metadata]) => {
              nonMemberAgent = results[0];
              cy.request({ url: '/organization',  method: 'POST', auth: { bearer: token }, body: { name: 'One Book Canada' } }).then((org) => {
                organization = org.body;
              });
            });
          });
        });
      });

//      it('redirect and land in the right spot', () => {
//        cy.visit(`/#/organization/${organization.id}`);
//        cy.url().should('match', /\/#\/organization$/);
//      });
 
      it('displays a friendly message', () => {
        cy.visit(`/#/organization/${organization.id}`);
        cy.wait(500);
        cy.get('h3').contains('You are not a member of that organization');
      });
    });
  });
});

export {}
