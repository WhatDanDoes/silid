// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
/// <reference types="Cypress" />

context('Landing page', () => {
  beforeEach(() => {
    // usually we recommend setting baseUrl in cypress.json
    // but for simplicity of this example we just use it here
    // https://on.cypress.io/visit
    //cy.visit('http://todomvc.com/examples/vue/')
  })

  describe('unauthenticated', () => {
    it('shows login link', function () {
      cy.visit('/')
      cy.get('#login-button').should('be.visible')
        .and('have.text', 'Login')
    })
  })

  // more examples
  //
  // https://github.com/cypress-io/cypress-example-todomvc
  // https://github.com/cypress-io/cypress-example-kitchensink
  // https://on.cypress.io/writing-your-first-test
})

export {}
