// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Agent', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
  });
  
  let _profile;
  beforeEach(function() {
    // Why?
    _profile = {...this.profile};
  });
 
  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
  });

  describe('Editing', () => {
    
//    describe('request headers', () => {
////      let polyfill;
////      beforeEach(() => {
////
////      });
////
//      it.only('sets the required request headers', function() {
//////  //      cy.get('#app-menu-button').click();
//        cy.server(); 
//        cy.route({ url: '/agent', method: 'GET', response: {} }).as('getProfile');
////        cy.route('GET', '/#/agent').as('getProfile');
//
//        cy.login(_profile.email, _profile);
//        cy.get('#app-menu-button').click();
//
//
//////        cy.readFile('./node_modules/whatwg-fetch/dist/fetch.umd.js').then((contents) => polyfill = contents);
//////        Cypress.on('window:before:load', (win) => {
//////          delete win.fetch;
//////          win.eval(polyfill);
//////        });
//
//        cy.visit('/agent');
////        cy.contains('Personal Info').click();
//        cy.wait('@getProfile').then(function(xhr) {
//          cy.log("XHR ON RETURN");
//          cy.log(xhr.responseBody);
//        });
//      });
//    });

    context('success', () => {
      let agent, token;
      beforeEach(function() {
        cy.login(_profile.email, _profile);
        cy.get('#app-menu-button').click();
        cy.contains('Personal Info').click().then(() => {
          cy.wait(500); // <--- There has to be a better way!!! Cypress is going too quick for the database
        });
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', '/#/agent');
      });

      it('does not allow an empty field', function() {
        cy.get('input[name="name"][type="text"]:invalid').should('have.length', 0)
        cy.get('input[name="name"][type="text"]').should('have.value', this.profile.name);
        cy.get('input[name="name"][type="text"]').clear();
        cy.get('input[name="name"][type="text"]').should('have.value', '');
        cy.get('button[type="submit"]').click();
        cy.get('input[name="name"][type="text"]:invalid').should('have.length', 1)
        cy.get('input[name="name"][type="text"]:invalid').then($input => {
          expect($input[0].validationMessage).to.eq('name required')
        });
      });

      it('updates the record in the database', function() {
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          cy.get('input[name="name"][type="text"]').should('have.value', results[0].name);
          cy.get('input[name="name"][type="text"]').clear().type('Dick Wolf');
          cy.get('button[type="submit"]').click();
          cy.wait(500);
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            expect(results[0].name).to.eq('Dick Wolf');
          });
        });
      });

      it('updates the record on the interface', function() {
        cy.get('input[name="name"][type="text"]').clear().type('Dick Wolf');
        cy.get('button[type="submit"]').click();
        cy.get('input[name="name"][type="text"]').should('have.value', 'Dick Wolf');
        cy.get('button[type="submit"]').should('be.disabled');
        cy.get('button#cancel-changes').should('not.exist');
      });
    });
  });
});

export {}
