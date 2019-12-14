// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Organization edit', function() {

  before(function() {
    cy.fixture('someguy-auth0-access-token.json').as('agent');
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Organizations" CASCADE;');
  });
  
  describe('Editing', () => {

    let token, agent, organization;
    beforeEach(function() {
      cy.login(this.agent);
      cy.visit('/#/').then(() => {
        token = localStorage.getItem('accessToken');
        cy.task('query', `SELECT * FROM "Agents" WHERE "accessToken"='Bearer ${token}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
  
          cy.request({ url: '/organization',  method: 'POST', auth: { bearer: token }, body: { name: 'One Book Canada' } }).then((org) => {
            organization = org.body;
            cy.get('#app-menu-button').click();
            cy.get('#organization-button').click();
            cy.contains('One Book Canada').click();
          });
        });
      });
    });

    describe('Edit button', () => {
      it('displays the edit form', () => {
        cy.get('form#edit-organization-form').should('not.exist');
        cy.get('button#edit-organization').click();
        cy.get('form#edit-organization-form').should('exist');
      });
  
      it('displays the organization info in form', () => {
        cy.get('button#edit-organization').click();
        cy.get('input[name="name"][type="text"]').should('have.value', organization.name);
        cy.get('button[type="submit"]').should('exist');
        cy.get('button[type="submit"]').should('be.disabled');
      });

      it('hides itself', function() {
        cy.get('button#edit-organization').click();
        cy.get('button#edit-organization').should('not.exist');
      });

      it('hides add-agent and add-team buttons', function() {
        cy.get('button#add-agent').should('exist');
        cy.get('button#add-team').should('exist');
        cy.get('button#edit-organization').click();
        cy.get('button#add-agent').should('not.exist');
        cy.get('button#add-team').should('not.exist');
      });

      it('allows changes to the name field in the organization edit form', function() {
        cy.get('button#edit-organization').click();
        cy.get('input[name="name"][type="text"]').should('have.value', organization.name);
        cy.get('input[name="name"][type="text"]').clear().type('Two Testaments Canada');
        cy.get('input[name="name"][type="text"]').should('have.value', 'Two Testaments Canada');
      });
    });

    describe('Cancel button', () => {
      beforeEach(() => {
        cy.get('button#edit-organization').click();
      });

      it('resets changes to the form', () => {
        cy.get('input[name="name"][type="text"]').should('have.value', organization.name);
        cy.get('input[name="name"][type="text"]').clear().type('Two Testaments Canada');
        cy.get('button#cancel-changes').click();
        cy.get('button#edit-organization').click();
        cy.get('input[name="name"][type="text"]').should('have.value', organization.name);
      });

      it('hides on click', () => {
        cy.get('input[name="name"][type="text"]').clear().type('Two Testaments Canada');
        cy.get('button#cancel-changes').should('exist');
        cy.get('button#cancel-changes').click();
        cy.get('button#cancel-changes').should('not.exist');
      });

      it('hides form on click', () => {
        cy.get('input[name="name"][type="text"]').clear().type('Two Testaments Canada');
        cy.get('button#cancel-changes').click();
        cy.get('form#edit-organization-form').should('not.exist');
      });

      it('reveals the edit button', function() {
        cy.get('button#edit-organization').should('not.exist');
        cy.get('button#cancel-changes').click();
        cy.get('button#edit-organization').should('exist');
      });
    });

    describe('Save button', () => {
      beforeEach(() => {
        cy.get('button#edit-organization').click();
      });

      it('is enabled on form change', function() {
        cy.get('button[type="submit"]').should('be.disabled');
        cy.get('input[name="name"][type="text"]').clear().type('Two Testaments Canada');
        cy.get('button[type="submit"]').should('be.enabled');
      });
    });

    describe('unsuccessful changes', () => {
      beforeEach(() => {
        cy.get('button#edit-organization').click();
      });

      it('does not allow an empty name field', () => {
        cy.get('input[name="name"][type="text"]:invalid').should('have.length', 0)
        cy.get('input[name="name"][type="text"]').should('have.value', organization.name);
        cy.get('input[name="name"][type="text"]').clear();
        cy.get('input[name="name"][type="text"]').should('have.value', '');
        cy.get('button[type="submit"]').click();
        cy.get('input[name="name"][type="text"]:invalid').should('have.length', 1)
        cy.get('input[name="name"][type="text"]:invalid').then($input => {
          expect($input[0].validationMessage).to.eq('name required')
        });
      });

      it('does not allow a blank name field', () => {
        cy.get('input[name="name"][type="text"]:invalid').should('have.length', 0)
        cy.get('input[name="name"][type="text"]').should('have.value', organization.name);
        cy.get('input[name="name"][type="text"]').clear().type('  ');
        cy.get('button[type="submit"]').click();
        cy.get('input[name="name"][type="text"]:invalid').should('have.length', 1)
        cy.get('input[name="name"][type="text"]:invalid').then($input => {
          expect($input[0].validationMessage).to.eq('name required')
        });
      });
    });

    describe('successful changes', () => {
      beforeEach(() => {
        cy.get('button#edit-organization').click();
      });

      it('updates the record in the database', function() {
        cy.task('query', `SELECT * FROM "Organizations" WHERE "id"='${organization.id}' LIMIT 1;`).then(([results, metadata]) => {
          cy.get('input[name="name"][type="text"]').should('have.value', organization.name);
          cy.get('input[name="name"][type="text"]').clear().type('Two Testaments Canada');
          cy.get('button[type="submit"]').click();
          cy.wait(500);
          cy.task('query', `SELECT * FROM "Organizations" WHERE "id"='${organization.id}' LIMIT 1;`).then(([results, metadata]) => {
            expect(results[0].name).to.eq('Two Testaments Canada');
          });
        });
      });

      it('updates the record on the interface', function() {
        cy.get('h3').contains(organization.name);
        cy.get('input[name="name"][type="text"]').should('have.value', organization.name);
        cy.get('input[name="name"][type="text"]').clear().type('Two Testaments Canada');
        cy.get('button[type="submit"]').click();
        cy.get('h3').contains('Two Testaments Canada');
        cy.get('button#edit-organization').click();
        cy.get('input[name="name"][type="text"]').should('have.value', 'Two Testaments Canada');
      });
    });
  });
});

export {}
