// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Organization delete', function() {

  before(function() {
    cy.fixture('someguy-auth0-access-token.json').as('agent');
    cy.fixture('someotherguy-auth0-access-token.json').as('anotherAgent');
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
  });
  
  describe('Deleting', () => {

    let token, agent, organization;
    beforeEach(function() {
      cy.login(this.agent);
      cy.visit('/').then(() => {
        token = localStorage.getItem('accessToken');
        cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${token}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];

          cy.request({ url: '/organization', method: 'POST', auth: { bearer: token }, body: { name: 'One Book Canada' } }).then((org) => {
            organization = org.body;

            cy.get('#app-menu-button').click();
            cy.get('#organization-button').click();
            cy.contains('One Book Canada').click();
          });
        });
      });
    });

    describe('Delete button', () => {
      context('member agents exist', () => {
        beforeEach(function() {
          cy.login(this.anotherAgent);
          cy.visit('/#/').then(() => {
            const memberToken = localStorage.getItem('accessToken');
            cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${memberToken}' LIMIT 1;`).then(([results, metadata]) => {
              const memberAgent = results[0];

              cy.request({ url: '/organization',  method: 'PATCH', auth: { bearer: token }, body: { id: organization.id, memberId: memberAgent.id } }).then((res) => {
                cy.login(this.agent);
                cy.visit('/').then(() => {
                  cy.get('#app-menu-button').click();
                  cy.get('#organization-button').click();
                  cy.contains('One Book Canada').click();
                  cy.wait(500);
                  cy.get('button#edit-organization').click();
                });
              });
            });
          });
        });

        it('does not allow deletion', function(done) {
          cy.on('window:alert', (str) => {
            expect(str).to.eq('Remove all members and teams before deleting organization');
            done();
          });
          cy.get('button#delete-organization').click();
        });
      });

      context('member teams exist', () => {
        beforeEach(() => {
          cy.request({ url: '/team',  method: 'POST', auth: { bearer: token }, body: { organizationId: organization.id, name: 'Omega Squadron' } }).then(res => {
            cy.visit('/').then(() => {
              cy.get('#app-menu-button').click();
              cy.get('#organization-button').click();
              cy.contains('One Book Canada').click();
              cy.wait(500);
              cy.get('button#edit-organization').click();
            });
          });
        });

        it('does not allow deletion', function(done) {
          cy.on('window:alert', (str) => {
            expect(str).to.eq('Remove all members and teams before deleting organization');
            done();
          });
          cy.get('button#delete-organization').click();
        });
      });

      context('no members or teams exist', () => {
        beforeEach(() => {
          cy.task('query', `SELECT * FROM "organization_team";`).then(([results, metadata]) => {
            expect(results.length).to.eq(0);
            cy.task('query', `SELECT * FROM "agent_organization";`).then(([results, metadata]) => {
              expect(results.length).to.eq(1);
              expect(results[0].AgentId).to.eq(agent.id);
              cy.visit('/').then(() => {
                cy.get('#app-menu-button').click();
                cy.get('#organization-button').click();
                cy.contains('One Book Canada').click();
                cy.wait(500);
                cy.get('button#edit-organization').click();
              });
            });
          });
        });

        it('displays a popup warning', function(done) {
          cy.on('window:confirm', (str) => {
            expect(str).to.eq('Are you sure you want to delete this organization?');
            done();
          });
          cy.get('button#delete-organization').click();
        });

        it('lands in the proper place', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.get('button#delete-organization').click();
          cy.url().should('match', /\/#\/organization$/);
        });

        it('removes record from the database', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.task('query', `SELECT * FROM "Organizations";`).then(([results, metadata]) => {
            expect(results.length).to.eq(1);
            cy.get('button#delete-organization').click();
            cy.task('query', `SELECT * FROM "Organizations";`).then(([results, metadata]) => {
              expect(results.length).to.eq(0);
            });
          });
        });

        it('renders the interface correctly on completion with success message', () => {
          cy.on('window:confirm', (str) => {
            return true;
          });
          cy.get('button#delete-organization').click();
          cy.get('#organization-list').should('not.exist');
          cy.contains('Organization deleted');
        });
      });
    });
  });
});

export {}
