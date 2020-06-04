context('root/Agent Index Paging', function() {

  before(function() {
    cy.fixture('google-profile-response.json').as('profile');
    cy.fixture('permissions.js').as('scope');

    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
  });

  before(function() {
    cy.login('root@example.com', {...this.profile, email: 'root@example.com'});

    for (let i = 0; i < 90; i++) {
      cy.request({ url: '/agent',  method: 'POST', body: { email: `agent${i}@example.com`, name: `Agent #${i}`} });
    }

    cy.task('query', 'SELECT * FROM "Agents" ORDER BY "name";').then(([results, metadata]) => {
      expect(results.length).to.equal(91);
    });
  });

  after(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
  });

  describe('authenticated', () => {
    context('admin mode', () => {

      context('switched on', () => {

        describe('pages tonnes of agents', () => {
          beforeEach(function() {
            cy.login('root@example.com', {...this.profile, email: 'root@example.com'});
            cy.get('#app-menu-button').click();
            cy.wait(200);
            cy.get('#admin-switch').check();
            cy.contains('Agent Directory').click();
            cy.wait(750);
          });

          it('displays the paging component', () => {
            cy.get('table:last-of-type tfoot tr td span:nth-of-type(1)').contains('first_page');
            cy.get('table:last-of-type tfoot tr td span:nth-of-type(2)').contains('chevron_left');
            cy.get('table:last-of-type tfoot tr td span:nth-of-type(3)').contains('1-30 of 91');
            cy.get('table:last-of-type tfoot tr td span:nth-of-type(4)').contains('chevron_right');
            cy.get('table:last-of-type tfoot tr td span:nth-of-type(5)').contains('last_page');
          });

          it('displays 30 agent entries', () => {
            cy.get('#agent-directory-table').find('.agent-button').its('length').should('eq', 30);
          });

          describe('paging forward', () => {
            it('allows navigation to the end of the directory', () => {
              // Page 1
              cy.get('#agent-directory-table').find('.agent-button').its('length').should('eq', 30);
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(3)').contains('1-30 of 91');

              // Page 2
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(4)').contains('chevron_right').click();
              cy.wait(300);

              // Listing count
              cy.get('#agent-directory-table').find('.agent-button').its('length').should('eq', 30);
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(3)').contains('31-60 of 91');

              // Page 3
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(4)').contains('chevron_right').click();
              cy.wait(300);

              // Listing count
              cy.get('#agent-directory-table').find('.agent-button').its('length').should('eq', 30);
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(3)').contains('61-90 of 91');

              // Page 4
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(4)').contains('chevron_right').click();
              cy.wait(300);

              // Listing count
              cy.get('#agent-directory-table').find('.agent-button').its('length').should('eq', 1);
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(3)').contains('91-91 of 91');
            });
          });

          describe('first and last pages', () => {
            it('allows going to the last page and then back to the first', () => {
              // On page 1
              cy.get('#agent-directory-table').find('.agent-button').its('length').should('eq', 30);
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(3)').contains('1-30 of 91');

              // Go to last page
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(5)').contains('last_page').click();
              cy.wait(300);

              // On page 4
              cy.get('#agent-directory-table').find('.agent-button').its('length').should('eq', 1);
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(3)').contains('91-91 of 91');

              // Back to first page
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(1)').contains('first_page').click();
              cy.wait(300);

              // On page 1 again
              cy.get('#agent-directory-table').find('.agent-button').its('length').should('eq', 30);
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(3)').contains('1-30 of 91');
            });
          });

          describe('paging backwards', () => {
            beforeEach(function() {
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(5)').contains('last_page').click();
              cy.wait(200);
            });

            it('allows navigation to the beginning of the directory', () => {
              // Page 4
              // Listing count
              cy.get('#agent-directory-table').find('.agent-button').its('length').should('eq', 1);
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(3)').contains('91-91 of 91');

              // Page 3
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(2)').contains('chevron_left').click();
              cy.wait(300);

              // Listing count
              cy.get('#agent-directory-table').find('.agent-button').its('length').should('eq', 30);
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(3)').contains('61-90 of 91');

              // Page 2
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(2)').contains('chevron_left').click();
              cy.wait(300);

              // Listing count
              cy.get('#agent-directory-table').find('.agent-button').its('length').should('eq', 30);
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(3)').contains('31-60 of 91');

              // Page 1
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(2)').contains('chevron_left').click();
              cy.wait(300);

              // Listing count
              cy.get('#agent-directory-table').find('.agent-button').its('length').should('eq', 30);
              cy.get('table:last-of-type tfoot tr td span:nth-of-type(3)').contains('1-30 of 91');
            });
          });
        });
      });
    });
  });
});

export {}
