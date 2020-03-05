// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Team delete', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "TeamMembers" CASCADE;');
  });

  let _profile;
  beforeEach(function() {
    // Why?
    _profile = {...this.profile};
  });

  let agent, anotherAgent;
  beforeEach(function() {
    // Login/create another agent
    cy.login('someotherguy@example.com', _profile);
    cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
      anotherAgent = results[0];

      // Login/create main test agent
      cy.login(_profile.email, _profile);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
        agent = results[0];
      });
    });
  });

  describe('Deleting', () => {

    let organization, team;
    beforeEach(function() {
      cy.request({ url: '/organization', method: 'POST', body: { name: 'One Book Canada' } }).then((org) => {
        organization = org.body;

        cy.request({ url: '/team', method: 'POST', body: { organizationId: organization.id, name: 'The A Team' } }).then(res => {
          team = res.body;
          cy.visit('/#/').then(() => {
            cy.get('#app-menu-button').click();
            cy.get('#organization-button').click();
            cy.contains('One Book Canada').click();
          });
        });
      });
    });

    describe('Delete button', () => {
      describe('on organization team list', () => {
        context('when team has team members', () => {
          beforeEach(function() {
            cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: anotherAgent.email } }).then((res) => {
              cy.visit('/#/').then(() => {
                cy.get('#app-menu-button').click();
                cy.get('#organization-button').click();
                cy.contains('One Book Canada').click();
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
            cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
              expect(results.length).to.eq(1);
              expect(results[0].AgentId).to.eq(agent.id);
              cy.visit('/#/').then(() => {
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
            cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: anotherAgent.email } }).then((res) => {
              cy.visit('/#/').then(() => {
                cy.get('#app-menu-button').click();
                cy.get('#organization-button').click();
                cy.contains('One Book Canada').click();
                cy.contains(team.name).click();
                cy.get('button#edit-team').click();
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
            cy.task('query', `SELECT * FROM "TeamMembers";`).then(([results, metadata]) => {
              expect(results.length).to.eq(1);
              expect(results[0].AgentId).to.eq(agent.id);
              cy.visit('/#/').then(() => {
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
