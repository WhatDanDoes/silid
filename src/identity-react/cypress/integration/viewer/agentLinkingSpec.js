context('viewer/Agent linking', function() {

  let memberAgent;
  before(function() {
    cy.fixture('google-profile-response').as('profile');
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

  let agent;

  describe('#find-linkable-accounts button', () => {

    describe('no linkable accounts exist', () => {

      beforeEach(() => {
        cy.login(_profile.email, _profile);
        cy.get('#flash-message #close-flash').click();
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
        });
      });

      it('displays a progress spinner', () => {
        cy.get('#load-linkable-spinner').should('not.exist');
        cy.get('#find-linkable-accounts').click();
        cy.wait(300);
        // Cypress goes too fast for the spinner. This ensures it disappears when done
        //cy.get('#load-linkable-spinner').should('exist');
        cy.get('#load-linkable-spinner').should('not.exist');
      });

      it('displays a friendly message', () => {
        cy.get('#flash-message').should('not.exist');
        cy.get('#find-linkable-accounts').click();
        cy.wait(300);
        cy.get('#flash-message').contains('No linkable accounts');
      });

      it('does not display linkable-accounts table', () => {
        cy.get('#linkable-accounts').should('not.exist');
        cy.get('#find-linkable-accounts').click();
        cy.wait(300);
        cy.get('#linkable-accounts').should('not.exist');
      });
    });

    describe('linkable accounts exist', () => {

      let linkableAcct;
      beforeEach(() => {
        cy.login('pretendthisisthesameemail@example.com', { ..._profile });
        cy.wait(300);
        cy.login(_profile.email, {..._profile });
//        cy.login(_profile.email, {..._profile, identities: [{
//          connection: 'twitter',
//          user_id: 'abc-123',
//          provider: 'twitter',
//        }] });
        cy.get('#flash-message #close-flash').click();

        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='pretendthisisthesameemail@example.com' LIMIT 1;`).then(([results, metadata]) => {
          linkableAcct = results[0];
        });

        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
        });
      });

      it('displays a progress spinner', () => {
        cy.get('#load-linkable-spinner').should('not.exist');
        cy.get('#find-linkable-accounts').click();
        cy.wait(300);
        // Cypress goes too fast for the spinner. This ensures it disappears when done
        //cy.get('#load-linkable-spinner').should('exist');
        cy.get('#load-linkable-spinner').should('not.exist');
      });

      it.only('displays linkable account info in a linkable-accounts table', () => {

        cy.get('#linkable-accounts').should('not.exist');
        cy.get('#find-linkable-accounts').click();
        cy.wait(300);
        cy.get('#linkable-accounts').should('exist');
        cy.get('#linkable-accounts tbody').find('tr').should('have.length', 1);
        console.log('linkableAcct');
        console.log(linkableAcct);

        cy.get('#linkable-accounts tbody tr td.connection').contains(linkableAcct.socialProfile.identities[0].connection);
        cy.get('#linkable-accounts tbody tr td.is-social').contains(`${linkableAcct.socialProfile.identities[0].isSocial}`);
        cy.get('#linkable-accounts tbody tr td.provider').contains(linkableAcct.socialProfile.identities[0].provider);
        cy.get('#linkable-accounts tbody tr td.user-id').contains(linkableAcct.socialProfile.identities[0].user_id);
        cy.get('#linkable-accounts tbody tr td.action').contains('Link');
      });

      describe('linking', () => {
        it('displays a progress spinner', (done) => {
          done.fail()
        });

        it('displays a friendly message', (done) => {
          done.fail()
        });

        it('displays an "Unlink" button on the linkable-accounts table', (done) => {
          done.fail()
        });


        describe('unlinking', () => {
          it('displays a progress spinner', (done) => {
            done.fail()
          });

          it('displays a friendly message', (done) => {
            done.fail()
          });

          it('displays an "Link" button on the linkable-accounts table', (done) => {
            done.fail()
          });
        });
      });
    });
  });

});

export {}
