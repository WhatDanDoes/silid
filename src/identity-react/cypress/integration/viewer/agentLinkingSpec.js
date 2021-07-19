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

  describe('#find-linkable-accounts button', () => {

    describe('no linkable accounts exist', () => {

      it('displays a progress spinner', (done) => {
        done.fail()
      });

      it('displays a friendly message', (done) => {
        done.fail()
      });

      it('does not display linkable-accounts table', (done) => {
        done.fail()
      });
    });

    describe('linkable accounts exist', () => {

      it('displays a progress spinner', (done) => {
        done.fail()
      });

      it('displays linkable account info in a linkable-accounts table', (done) => {
        done.fail()
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
