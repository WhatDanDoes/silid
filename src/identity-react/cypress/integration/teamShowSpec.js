// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Team show', function() {

  before(function() {
    cy.fixture('someguy-auth0-access-token.json').as('agent');
    cy.fixture('someotherguy-auth0-access-token.json').as('anotherAgent');
  });

  
  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit('/#/team/1');
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

    let token, agent, organization;
    beforeEach(function() {
      cy.login(this.agent);
      cy.visit('/#/').then(() => {
        token = localStorage.getItem('accessToken');
        cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${token}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
          cy.request({ url: '/organization',  method: 'POST', auth: { bearer: token }, body: { name: 'One Book Canada' } }).then((org) => {
            organization = org.body;
          });
        });
      });
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
    });

    it('doesn\'t barf if team doesn\'t exist', () => {
      cy.visit('/#/team/333');
      cy.get('#error-message').contains('No such team');
    });

    context('visit by organization creator', () => {
      let team;
      beforeEach(function() {
        cy.request({ url: '/team',  method: 'POST', auth: { bearer: token },
                     body: { organizationId: organization.id, name: 'Insert Funny Team Name Here' } }).then(res => {
          team = res.body;
          cy.get('#app-menu-button').click();
          cy.get('#organization-button').click();
          cy.contains('One Book Canada').click();
          cy.contains('Insert Funny Team Name Here').click();
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/team/${team.id}`);
      });

      it('displays appropriate Team interface elements', function() {
        cy.get('h3').contains('Insert Funny Team Name Here');
        cy.get('button#add-agent').should('exist');
        cy.get('button#edit-team').should('exist');
      });
    });

    context('visit by team creator', () => {
      let creatorAgent, creatorToken, team;
      beforeEach(function() {
        cy.login(this.anotherAgent);
        cy.visit('/#/').then(() => {
          creatorToken = localStorage.getItem('accessToken');
          cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${creatorToken}' LIMIT 1;`).then(([results, metadata]) => {
            creatorAgent = results[0];
            cy.request({ url: `/organization/${organization.id}/agent`, method: 'PUT', auth: { bearer: token }, body: { email: creatorAgent.email } }).then((org) => {
              cy.request({ url: '/team',  method: 'POST', auth: { bearer: creatorToken },
                           body: { organizationId: organization.id, name: 'Insert Funny Team Name Here' } }).then(res => {
                team = res.body;

                cy.get('#app-menu-button').click();
                cy.get('#organization-button').click();
                cy.contains('One Book Canada').click();
                cy.contains('Insert Funny Team Name Here').click();
              });
            });
          });
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/team/${team.id}`);
      });

      it('displays appropriate Team interface elements', function() {
        cy.get('h3').contains('Insert Funny Team Name Here');
        cy.get('button#add-agent').should('exist');
        cy.get('button#edit-team').should('exist');
      });
    });

    context('team member agent visit', () => {

      let memberAgent, memberToken, team;
      beforeEach(function() {
        cy.login(this.anotherAgent);

        cy.visit('/#/').then(() => {
          memberToken = localStorage.getItem('accessToken');
          cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${memberToken}' LIMIT 1;`).then(([results, metadata]) => {
            memberAgent = results[0];

            cy.request({ url: '/team',  method: 'POST', auth: { bearer: token },
                         body: { organizationId: organization.id, name: 'Insert Funny Team Name Here' } }).then(res => {
              team = res.body;

              cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', auth: { bearer: token }, body: { email: memberAgent.email } }).then(res => {

                cy.visit(`/#/team/${team.id}`);
              });
            });
          });
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/team/${team.id}`);
      });

      it('displays appropriate Team interface elements', function() {
        cy.get('h3').contains('Insert Funny Team Name Here');
        cy.get('button#add-agent').should('not.exist');
        cy.get('button#edit-team').should('not.exist');
      });
    });

    context('organization member agent visit', () => {

      let memberAgent, memberToken, team;
      beforeEach(function() {
        cy.login(this.anotherAgent);

        cy.visit('/#/').then(() => {
          memberToken = localStorage.getItem('accessToken');
          cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${memberToken}' LIMIT 1;`).then(([results, metadata]) => {
            memberAgent = results[0];

            cy.request({ url: '/team',  method: 'POST', auth: { bearer: token },
                         body: { organizationId: organization.id, name: 'Insert Funny Team Name Here' } }).then(res => {
              team = res.body;

              cy.request({ url: `/organization/${organization.id}/agent`, method: 'PUT', auth: { bearer: token }, body: { email: memberAgent.email } }).then(res => {

                cy.get('#app-menu-button').click();
                cy.get('#organization-button').click();
                cy.contains('One Book Canada').click();
                cy.contains('Insert Funny Team Name Here').click();
              });
            });
          });
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/team/${team.id}`);
      });

      it('displays appropriate Team interface elements', function() {
        cy.get('h3').contains('Insert Funny Team Name Here');
        cy.get('button#add-agent').should('not.exist');
        cy.get('button#edit-team').should('not.exist');
      });
    });

    context('non-member agent visit', () => {

      let nonMemberAgent, nonMemberToken, team;
      beforeEach(function() {
        cy.login(this.anotherAgent);

        cy.visit('/#/').then(() => {
          nonMemberToken = localStorage.getItem('accessToken');
          cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${nonMemberAgent}' LIMIT 1;`).then(([results, metadata]) => {
            nonMemberAgent = results[0];
            cy.request({ url: '/team',  method: 'POST', auth: { bearer: token },
                         body: { organizationId: organization.id, name: 'Insert Funny Team Name Here' } }).then(res => {
              team = res.body;
            });
          });
        });
      });

      it('displays a friendly message', () => {
        cy.visit(`/#/team/${team.id}`);
        cy.wait(500);
        cy.get('h3').contains('You are not a member of that team');
      });
    });
  });
});

export {}
