// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Organization show', function() {

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
          cy.visit('/#/');
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
        cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then((org) => {
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

      let organization;
      beforeEach(function() {
        cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then((org) => {
          organization = org.body;
          cy.request({ url: '/organization',  method: 'PATCH', body: { id: organization.id, memberId: anotherAgent.id } }).then((res) => {

            cy.login(anotherAgent.email, _profile);
            cy.visit('/#/').then(() => {
              cy.get('#app-menu-button').click();
              cy.get('#organization-button').click();
              cy.contains('One Book Canada').click();
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
        cy.request({ url: '/organization',  method: 'POST', body: { name: 'One Book Canada' } }).then((org) => {
          organization = org.body;
          cy.login('somenonmemberagent@example.com', _profile);
        });
      });

      it('displays a friendly message', () => {
        cy.visit(`/#/organization/${organization.id}`);
        cy.wait(500);
        cy.get('h3').contains('You are not a member of that organization');
      });
    });
  });
});

export {}
