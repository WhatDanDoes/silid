// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Team delete', function() {

  before(function() {
    cy.fixture('someguy-auth0-access-token.json').as('agent');
    cy.fixture('someotherguy-auth0-access-token.json').as('anotherAgent');
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
  });

  describe('Deleting', () => {

    let token, agent, organization, team;
    beforeEach(function() {
      cy.login(this.agent);
      cy.visit('/').then(() => {
        token = localStorage.getItem('accessToken');
        cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${token}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];

          cy.request({ url: '/organization', method: 'POST', auth: { bearer: token }, body: { name: 'One Book Canada' } }).then((org) => {
            organization = org.body;

            cy.request({ url: '/team', method: 'POST', auth: { bearer: token }, body: { organizationId: organization.id, name: 'The A Team' } }).then(res => {
              team = res.body;
              cy.get('#app-menu-button').click();
              cy.get('#organization-button').click();
              cy.contains('One Book Canada').click();
            });
          });
        });
      });
    });

    describe('Delete button', () => {
      describe('on organization team list', () => {
        context('when team has team members', () => {
          beforeEach(function() {
            cy.login(this.anotherAgent);
            cy.visit('/#/').then(() => {
              const memberToken = localStorage.getItem('accessToken');
              cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${memberToken}' LIMIT 1;`).then(([results, metadata]) => {
                const memberAgent = results[0];
                cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', auth: { bearer: token }, body: { email: memberAgent.email } }).then((res) => {
                  cy.login(this.agent);
                  cy.visit('/').then(() => {
                    cy.get('#app-menu-button').click();
                    cy.get('#organization-button').click();
                    cy.contains('One Book Canada').click();
                  });
                });
              });
            });
          });

          it('does not allow deletion', function(done) {
            cy.on('window:alert', (str) => {
              expect(str).to.eq('Remove all team members before deleting the team');
              done();
            });
            cy.get('#organization-team-list').find('.list-item').its('length').should('eq', 1);
            cy.get('.delete-team').first().click();
          });
        });

        context('when team has no team members', () => {
          beforeEach(() => {
            cy.task('query', `SELECT * FROM "agent_team";`).then(([results, metadata]) => {
              expect(results.length).to.eq(1);
              expect(results[0].AgentId).to.eq(agent.id);
              cy.visit('/').then(() => {
                cy.get('#app-menu-button').click();
                cy.get('#organization-button').click();
                cy.contains('One Book Canada').click();
              });
            });
          });

          it('displays a popup warning', function(done) {
            cy.on('window:confirm', (str) => {
              expect(str).to.eq('Remove team?');
              done();
            });
            cy.get('.delete-team').first().click();
          });

          it('lands in the proper place', () => {
            cy.on('window:confirm', (str) => {
              return true;
            });
            cy.get('.delete-team').first().click();
            cy.url().should('contain', `/#/organization/${organization.id}`);
          });

          it('removes record from the database', () => {
            cy.on('window:confirm', (str) => {
              return true;
            });
            cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
              expect(results.length).to.eq(1);
              cy.get('.delete-team').first().click().then(() => {
                cy.wait(500);
                cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(0);
                });
              });
            });
          });

          it('renders the interface correctly on completion with success message', () => {
            cy.on('window:confirm', (str) => {
              return true;
            });
            cy.get('.delete-team').first().click();
            cy.wait(500);
            cy.get('#organization-team-list').should('not.exist');
            cy.contains('Team deleted');
          });
        });
      });

      describe('on team edit page', () => {
        context('when team has team members', () => {
          beforeEach(function() {
            cy.login(this.anotherAgent);
            cy.visit('/#/').then(() => {
              const memberToken = localStorage.getItem('accessToken');
              cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${memberToken}' LIMIT 1;`).then(([results, metadata]) => {
                const memberAgent = results[0];
                cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', auth: { bearer: token }, body: { email: memberAgent.email } }).then((res) => {
                  cy.login(this.agent);
                  cy.visit('/').then(() => {
                    cy.get('#app-menu-button').click();
                    cy.get('#organization-button').click();
                    cy.contains('One Book Canada').click();
                    cy.contains(team.name).click();
                    cy.get('button#edit-team').click();
                  });
                });
              });
            });
          });

          it('does not allow deletion', function(done) {
            cy.on('window:alert', (str) => {
              expect(str).to.eq('Remove all team members before deleting the team');
              done();
            });
            cy.get('button#delete-team').click();
          });
        });

        context('when team has no team members', () => {
          beforeEach(() => {
            cy.task('query', `SELECT * FROM "agent_team";`).then(([results, metadata]) => {
              expect(results.length).to.eq(1);
              expect(results[0].AgentId).to.eq(agent.id);
              cy.visit('/').then(() => {
                cy.get('#app-menu-button').click();
                cy.get('#organization-button').click();
                cy.contains('One Book Canada').click();
                cy.contains(team.name).click();
                cy.get('button#edit-team').click();
              });
            });
          });

          it('displays a popup warning', function(done) {
            cy.on('window:confirm', (str) => {
              expect(str).to.eq('Delete team?');
              done();
            });
            cy.get('button#delete-team').click();
          });

          it('lands in the proper place', () => {
            cy.on('window:confirm', (str) => {
              return true;
            });
            cy.get('button#delete-team').click();
            cy.url().should('contain', `/#/organization/${organization.id}`);
          });

          it('removes record from the database', () => {
            cy.on('window:confirm', (str) => {
              return true;
            });
            cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
              expect(results.length).to.eq(1);
              cy.get('button#delete-team').click();
              cy.wait(500);
              cy.task('query', `SELECT * FROM "Teams";`).then(([results, metadata]) => {
                expect(results.length).to.eq(0);
              });
            });
          });

          it('renders the interface correctly on completion with success message', () => {
            cy.on('window:confirm', (str) => {
              return true;
            });
            cy.get('button#delete-team').click();
            cy.wait(500);
            cy.get('#organization-team-list').should('not.exist');
            cy.contains('Team deleted');
          });
        });
      });
    });
  });
});

export {}
