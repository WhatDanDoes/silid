import { onlyOn, skipOn } from '@cypress/skip-test'

context('Service Workers', () => {

  // docker-compose doesn't take boolean values for env vars.
  onlyOn(Cypress.env('TEST_BUILD') === 'true', () => {

    before(function() {
      cy.fixture('google-profile-response.json').as('profile');
      cy.fixture('permissions.js').as('scope');
    });

    let _profile;
    beforeEach(function() {
      _profile = {...this.profile};
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    });

    describe('unauthenticated', done => {
      beforeEach(() => {
        cy.visit('/build');
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', '/build');
      });

      it('shows the build version string', () => {
        cy.get('body').contains('Howdy, from your friendly neighbourhood service worker!');
      });
    });

    describe('authenticated', () => {

      beforeEach(() => {
        cy.login(_profile.email, _profile);
        cy.url().should('contain', '/#/agent');

        cy.visit('/build');
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', '/build');
      });

      it('shows the build version string', () => {
        cy.get('body').contains('Howdy, from your friendly neighbourhood service worker!');
      });
    });
  });
});

export {}
