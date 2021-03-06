import { onlyOn, skipOn } from '@cypress/skip-test'

context('Service Workers', () => {

  // docker-compose doesn't take boolean values for env vars.
  onlyOn(Cypress.env('TEST_BUILD') === 'true', () => {

//    Cypress.on('window:before:load', win => {
//      // disable service workers
//      delete win.navigator.__proto__.serviceWorker;
//    });

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

//    describe('unauthenticated', done => {
//      beforeEach(() => {
//        cy.visit('/build');
//      });
//
//      it('lands in the right spot', () => {
//        cy.url().should('contain', '/build');
//      });
//
//      it('shows the build version string', () => {
//        cy.get('body').contains('Howdy, from your friendly neighbourhood service worker!');
//      });
//    });

    describe('authenticated', () => {

      beforeEach(() => {
//        cy.intercept({ method: 'GET', url: '/build' }, []);

        cy.login(_profile.email, _profile);
        cy.url().should('contain', '/#/agent');

//        cy.reload();
//        cy.wait(1000);
        cy.visit('/build');
        //cy.request('/build');
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', '/build');
      });

      it.only('shows the build version string', () => {
        cy.get('body').contains('Howdy, from your friendly neighbourhood service worker!');
      });
    });
  });
});

export {}
