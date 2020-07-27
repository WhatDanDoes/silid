context('root/Agent Index', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
    cy.fixture('permissions.js').as('scope');
  });

//  let _profile;
//  beforeEach(function() {
//    _profile = {...this.profile};
//  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com', name: 'Professor Fresh'};
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Updates" CASCADE;');
  });

  describe('authenticated', () => {

    context('email verified', () => {
      beforeEach(() => {
        // Create agent
        cy.login('verifiedagent@example.com', { ..._profile, name: 'Victor Verified' });

        // Login root
        cy.login(_profile.email, _profile);

        cy.get('#app-menu-button').click();
        cy.get('#admin-switch').check();
        cy.get('#app-menu').contains('Agent Directory').click();
        cy.wait(200);
        cy.contains('Victor Verified').click();
        cy.wait(200);
      });

      it('does not display the resend-verification-email button', () => {
        cy.get('#resend-verification-email-button').should('not.exist');
      });

      it('does not display the verification status message', () => {
        cy.get('#verification-status').should('not.exist');
      });
    });

    context('email not verified', () => {
      beforeEach(function() {
        // Create agent
        cy.login('verifiedagent@example.com', { ..._profile, name: 'Victor Verified', email_verified: false });

        // Login root
        cy.login(_profile.email, _profile);

        cy.get('#app-menu-button').click();
        cy.get('#admin-switch').check();
        cy.get('#app-menu').contains('Agent Directory').click();
        cy.wait(200);
        cy.contains('Victor Verified').click();
        cy.wait(200);
      });

      it('displays the resend-verification-email button', () => {
        cy.get('#resend-verification-email-button').should('not.exist');
      });

      it('does not display the verification status message', () => {
        cy.get('#verification-status').contains('This is an unverified account');
      });
    });
  });
});

export {}
