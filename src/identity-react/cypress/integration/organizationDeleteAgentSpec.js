// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Organization delete agent', function() {

  before(function() {
    cy.fixture('someguy-auth0-access-token.json').as('agent');
    cy.fixture('someotherguy-auth0-access-token.json').as('anotherAgent');
  });

  context('authenticated', () => {

    let token, agent;
    let memberAgent;
    beforeEach(function() {
      cy.login(this.anotherAgent);
      cy.visit('/#/').then(() => {
        let memberToken = localStorage.getItem('accessToken');
        cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${memberToken}' LIMIT 1;`).then(([results, metadata]) => {
          memberAgent = results[0];

          cy.login(this.agent);
          cy.visit('/#/').then(() => {
            token = localStorage.getItem('accessToken');
            cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${token}' LIMIT 1;`).then(([results, metadata]) => {
              agent = results[0];
            });
          });
        });
      });
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
      cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    });

    context('creator agent visit', () => {

      let organization;
      beforeEach(function() {
        cy.request({ url: '/organization', method: 'POST', auth: { bearer: token }, body: { name: 'One Book Canada' } }).then((org) => {
          organization = org.body;
          cy.request({ url: `/organization/${organization.id}/agent`, method: 'PUT', auth: { bearer: token }, body: { email: memberAgent.email } }).then((org) => {
            cy.get('#app-menu-button').click();
            cy.get('#organization-button').click();
            cy.contains('One Book Canada').click();
          });
        });
      });

      describe('delete-member button', () => {
        it('does not display a delete button next to the creator agent', () => {
          cy.contains(agent.email).siblings('.delete-member').should('not.exist');
          cy.contains(memberAgent.email).siblings('.delete-member').should('exist');
        });

        it('displays a popup warning', function(done) {
          cy.on('window:confirm', (str) => {
            expect(str).to.eq('Remove member?');
            done();
          });
          cy.get('#organization-member-list .organization-member-list-item').first().contains(memberAgent.email);
          cy.get('.delete-member').last().click();
        });

        it('updates the interface', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.get('#organization-member-list').find('.organization-member-list-item').its('length').should('eq', 2);
          cy.get('.delete-member').first().click();
          cy.wait(500);
          cy.get('#organization-member-list').find('.organization-member-list-item').its('length').should('eq', 1);
        });

        it('updates the database', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.task('query', `SELECT * FROM "agent_organization";`).then(([results, metadata]) => {
            expect(results.length).to.eq(2);
            cy.get('.delete-member').first().click();
            cy.wait(500);
            cy.task('query', `SELECT * FROM "agent_organization";`).then(([results, metadata]) => {
              expect(results.length).to.eq(1);
            });
          });
        });

        it('lands in the proper place', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.url().should('contain', `/#/organization/${organization.id}`);
          cy.get('.delete-member').last().click();
          cy.wait(500);
          cy.url().should('contain', `/#/organization/${organization.id}`);
        });

        it('displays a success message', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.get('.delete-member').last().click();
          cy.wait(500);
          cy.contains(`Member removed`);
        });
      });
    });

    context('member agent visit', () => {

      let organization;
      beforeEach(function() {
        cy.login(this.anotherAgent);
        cy.visit('/#/').then(() => {
          let memberToken = localStorage.getItem('accessToken');
          cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${memberToken}' LIMIT 1;`).then(([results, metadata]) => {
            memberAgent = results[0];
            cy.request({ url: '/organization', method: 'POST', auth: { bearer: token }, body: { name: 'One Book Canada' } }).then((org) => {
              organization = org.body;
              cy.request({ url: `/organization/${organization.id}/agent`, method: 'PUT', auth: { bearer: token }, body: { email: memberAgent.email } }).then((org) => {
                cy.get('#app-menu-button').click();
                cy.get('#organization-button').click();
                cy.contains('One Book Canada').click();
              });
            });
          });
        });
      });

      it('displays common Organization interface elements', function() {
        cy.get('.delete-member').should('not.exist');
      });
    });
  });
});

export {}
