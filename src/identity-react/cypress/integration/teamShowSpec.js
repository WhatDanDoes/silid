// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Team show', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
  });

  let _profile;
  beforeEach(function() {
    // Why?
    _profile = {...this.profile};
  });

  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit('/#/team/1');
    });

    it('shows the home page', () => {
      cy.get('header h1').contains('Identity');
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
 
    let agent, anotherAgent, organization;
    beforeEach(function() {
      // Login/create another agent
      cy.login('someotherguy@example.com', _profile);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        anotherAgent = results[0];

        // Login/create main test agent
        cy.login(_profile.email, _profile);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];

          cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then((org) => {
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
        cy.request({ url: '/team',  method: 'POST',
                     body: { organizationId: organization.id, name: 'Insert Funny Team Name Here' } }).then(res => {
          team = res.body;
          cy.login(_profile.email, _profile);
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
      let team;
      beforeEach(function() {
        cy.request({ url: `/organization/${organization.id}/agent`, method: 'PUT', body: { email: anotherAgent.email } }).then((org) => {
          cy.login(anotherAgent.email, _profile);
          cy.request({ url: '/team',  method: 'POST',
                       body: { organizationId: organization.id, name: 'Insert Funny Team Name Here' } }).then(res => {
            team = res.body;

            cy.visit('/#/').then(() => {
              cy.get('#app-menu-button').click();
              cy.get('#organization-button').click();
              cy.contains('One Book Canada').click();
              cy.contains('Insert Funny Team Name Here').click();
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

      let team;
      beforeEach(function() {
        cy.request({ url: '/team',  method: 'POST',
                     body: { organizationId: organization.id, name: 'Insert Funny Team Name Here' } }).then(res => {
          team = res.body;

          cy.request({ url: `/team/${team.id}/agent`, method: 'PUT', body: { email: anotherAgent.email } }).then(res => {

            cy.login(anotherAgent.email, _profile);
            cy.visit(`/#/team/${team.id}`);
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

      let team;
      beforeEach(function() {
        cy.request({ url: '/team',  method: 'POST',
                     body: { organizationId: organization.id, name: 'Insert Funny Team Name Here' } }).then(res => {
          team = res.body;

          cy.request({ url: `/organization/${organization.id}/agent`, method: 'PUT', body: { email: anotherAgent.email } }).then(res => {

            cy.login(anotherAgent.email, _profile);
            cy.visit('/#/').then(() => {
              cy.get('#app-menu-button').click();
              cy.get('#organization-button').click();
              cy.contains('One Book Canada').click();
              cy.contains('Insert Funny Team Name Here').click();
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

      let team;
      beforeEach(function() {
        cy.request({ url: '/team',  method: 'POST',
                     body: { organizationId: organization.id, name: 'Insert Funny Team Name Here' } }).then(res => {
          team = res.body;

          cy.login(anotherAgent.email, _profile);
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
