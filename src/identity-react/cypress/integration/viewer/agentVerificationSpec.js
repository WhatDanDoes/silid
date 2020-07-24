context('viewer/Agent Index', function() {

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
    cy.task('query', 'TRUNCATE TABLE "Updates" CASCADE;');
  });

  describe('authenticated', () => {

    context('email verified', () => {
      beforeEach(function() {
        cy.login(_profile.email, _profile);
      });

      it('does not display the resend-verification-email button', () => {
        cy.get('#resend-verification-email-button').should('not.exist');
      });
    });

    context('email not verified', () => {
      beforeEach(function() {
        cy.login(_profile.email, {..._profile, email_verified: false});
        cy.get('#flash-message #close-flash').click();
      });

      it('displays the resend-verification-email button', () => {
        cy.get('#resend-verification-email-button').should('exist');
      });

      describe('#resend-verification-email-button', () => {
        it('displays the progress spinner', () => {
          cy.get('#resend-verification-email-button').click();
          // 2020-5-26
          // Cypress goes too fast for this. Cypress also cannot intercept
          // native `fetch` calls to allow stubbing and delaying the route.
          // Shamefully, this is currently manually tested, though I suspect
          // I will use this opportunity to learn Jest
          // Despite its name, this test really ensures the spinner disappears
          // after all is said and done
          //cy.get('div[role="progressbar"] svg circle').should('exist');
          cy.wait(100);
          cy.get('div[role="progressbar"] svg circle').should('not.exist');
        });

        it('displays a friendly messgae', () => {
          cy.get('#resend-verification-email-button').click();
          cy.wait(300);
          cy.get('#flash-message').contains('Verification sent. Check your email');
        });
      });
    });
  });
});

export {}
