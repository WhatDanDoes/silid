// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************


/**
 * 2020-1-28
 *
 * Cypress doesn't work with `fetch`.
 *
 * From: https://dev.to/matsilva/fetch-api-gotcha-in-cypress-io-and-how-to-fix-it-7ah
 *
 */
//Cypress.Commands.add('visitWithDelWinFetch', (path, opts = {}) => {
//  cy.visit(
//    path,
//    Object.assign(opts, {
//      onBeforeLoad(win) {
//        console.log('HELLO');
//        delete win.fetch;
//      },
//    })
//  );
//});

//Cypress.on('window:before:load', win => {
//  delete win.fetch;
//});

/**
 * 2020-1-28
 *
 * https://github.com/cypress-io/cypress/issues/95#issuecomment-526839501
 */
//function fetchToXhr() {
//  let polyfill
//
//  before(() => {
//    cy.readFile('./node_modules/whatwg-fetch/dist/fetch.umd.js')
//      .then((contents) => polyfill = contents)
//    Cypress.on('window:before:load', (win) => {
//      delete win.fetch
//      win.eval(polyfill)
//    })
//  })
//}
//
//fetchToXhr()

/**
 * 2019-12-19
 * https://github.com/cypress-io/cypress/issues/3199#issuecomment-492728331
 *
 * So you can see console.logs in headless mode
 */
Cypress.on('window:before:load', (win) => {
  Cypress.log({
    name: 'console.log',
    message: 'wrap on console.log',
  });

  // pass through cypress log so we can see log inside command execution order
  win.console.log = (...args) => {
    Cypress.log({
      name: 'console.log',
      message: args,
    });
  };
});

Cypress.on('log:added', (options) => {
    if (options.instrument === 'command') {
        // eslint-disable-next-line no-console
        console.log(
            `${(options.displayName || options.name || '').toUpperCase()} ${
                options.message
            }`,
        );
    }
});

import './login'
import './log'
import './clear-service-workers'
