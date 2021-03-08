/**
 * 2021-3-8
 *
 * This spec is completely useless, but I'm going to leave ti here for the
 * moment...
 *
 * Cypress has an interesting problem when it comes to testing Service Workers.
 *
 * https://github.com/cypress-io/cypress/issues/702
 *
 * Cypress talks to the browser. If the browser is running Service Workers,
 * all the wrong things get cached. It seems the present solution involves
 * disabling Service Workers entirely.
 *
 * For the moment, I'm going to opt out of registering a version-control
 * Service Worker, but I'll leave everything in place while I'll figure out how
 * to properly test with Service Workers running.
 */
import { onlyOn, skipOn } from '@cypress/skip-test'

context('Service Workers', () => {

  // docker-compose tells me it doesn't take boolean values for env vars.
  onlyOn(Cypress.env('TEST_BUILD') === 'true', () => {

    before(function() {
      cy.fixture('google-profile-response.json').as('profile');
      cy.fixture('permissions.js').as('scope');
    });

    beforeEach(() => {
      if (window.navigator && navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
          });
        });
      }
    });

    let _profile;
    beforeEach(function() {
      _profile = {...this.profile};
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
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
