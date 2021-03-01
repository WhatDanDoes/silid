/**
 * 2021-3-1
 *
 * Swiped from:
 *
 * https://gist.github.com/jamesfulford/26181c332c25d6464c3524510d18e75e
 */

// From https://github.com/cypress-io/cypress/issues/702#issuecomment-435873135
beforeEach(() => {
  if (window.navigator && navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    });
  }
});
