/**
 * This is needed to get test `console.log` output to `stdout` during headless tests
 */
Cypress.Commands.overwrite('log', (subject, message) => cy.task('log', message));
