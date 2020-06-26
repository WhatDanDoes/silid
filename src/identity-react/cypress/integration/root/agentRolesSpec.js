context('root/Agent roles', function() {

  let memberAgent;
  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions.js').as('scope');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com'};
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Invitations" CASCADE;');
  });

  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit(`/#/agent/333`);
    });

    it('shows the home page', () => {
      cy.get('header h1').contains('Identity');
    });

    it('displays the login button', () => {
      cy.get('#login-link').contains('Login');
    });

    it('does not display the logout button', () => {
      cy.get('#logout-button').should('not.exist');
    });

    it('redirects home', () => {
      cy.location('pathname').should('equal', '/');
    });
  });

  describe('authenticated', () => {

    let memberAgent;
    beforeEach(function() {
      // Just a convenient way to create a new agent
      cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy' }, [this.scope.read.agents]);
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        memberAgent = results[0];
      });
    });

    describe('admin mode', () => {
      context('switched on', () => {
        beforeEach(() => {
          cy.login(_profile.email, _profile);
          cy.get('#app-menu-button').click();
          cy.get('#admin-switch').check();
          cy.contains('Agent Directory').click();
          cy.wait(200);
          cy.get('.agent-button a').last().click();
          cy.wait(200);
        });

        describe('interface', () => {
          it('displays the assign-role button', () => {
            cy.get('#profile-table table tbody tr ul li:last-of-type #assign-role').should('exist');
          });

          it('does not display delete X on viewer role', () => {
            cy.get('#profile-table #assigned-roles li').its('length').should('eq', 2);
            cy.get('#profile-table #assigned-roles li:first-of-type svg').should('not.exist');
            cy.get('#profile-table #assigned-roles li:first-of-type').contains('viewer');
          });

          describe('#assign-role button', () => {
            it('reveals a list of roles to assign', () => {
              cy.get('#profile-table #unassigned-roles').should('not.exist');

              // Reveal
              cy.get('#assign-role').click();
              cy.wait(300);

              cy.get('#assign-role').should('not.exist');
              cy.get('#close-unassigned-roles').should('exist');;
              cy.get('#profile-table #unassigned-roles').should('exist');
              cy.get('#profile-table #unassigned-roles li').its('length').should('eq', 3);
              cy.get('#profile-table #unassigned-roles li').contains('organizer');
              cy.get('#profile-table #unassigned-roles li').contains('sudo');
              cy.get('#profile-table #unassigned-roles li').contains('close');
            });

            describe('#close-unassigned-roles button', () => {
              beforeEach(() => {
                cy.get('#assign-role').click();
                cy.wait(300);
              });

              it('hides the list of unassigned roles', () => {
                cy.get('#profile-table #unassigned-roles').should('exist');
                cy.get('#profile-table #assign-role').should('not.exist');

                // Close
                cy.get('#close-unassigned-roles').click();

                cy.get('#profile-table #assign-role').should('exist');
                cy.get('#close-unassigned-roles').should('not.exist');;
                cy.get('#profile-table #unassigned-roles').should('not.exist');
              });
            });
          });
        });

        describe('assigning organizer role', () => {
          beforeEach(() => {
            cy.get('#assign-role').click();
            cy.wait(300);
          });

          it('updates the interface', () => {
            cy.get('#profile-table #assigned-roles li').its('length').should('eq', 1);
            cy.get('#profile-table #assigned-roles li').contains('viewer');

            // Assign organizer role
            cy.get('#profile-table #unassigned-roles li').its('length').should('eq', 3);
            cy.get('#profile-table #unassigned-roles li').contains('organizer').click();
            cy.wait(300);

            cy.get('#profile-table #unassigned-roles li').its('length').should('eq', 2);
            cy.get('#profile-table #assigned-roles li').its('length').should('eq', 2);
            cy.get('#profile-table #assigned-roles li:first-of-type').contains('organizer');
            cy.get('#profile-table #assigned-roles li:first-of-type svg').should('exist');
            cy.get('#profile-table #assigned-roles li:last-of-type').contains('viewer');
            // Can't delete default viewer role (no X)
            cy.get('#profile-table #assigned-roles li:last-of-type svg').should('not.exist');
          });

          it('updates the newly assigned agent\'s interface', () => {
            // Assign organizer role
            cy.get('#profile-table #unassigned-roles li').contains('organizer').click();
            cy.wait(300);

            // Login newly assigned agent
            cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy' });

            cy.get('#profile-table #assigned-roles li').its('length').should('eq', 2);

            // No delete X on organizer
            cy.get('#profile-table #assigned-roles li:first-of-type svg').should('not.exist');
            cy.get('#profile-table #assigned-roles li:first-of-type').contains('organizer');

            // No delete X on viewer
            cy.get('#profile-table #assigned-roles li:last-of-type svg').should('not.exist');
            cy.get('#profile-table #assigned-roles li:last-of-type').contains('viewer');
          });

          describe('divesting organizer role', () => {
            beforeEach(() => {
              cy.get('#profile-table #unassigned-roles li').contains('organizer').click();
              cy.wait(300);
            });

            it('updates the interface', () => {
              cy.get('#profile-table #assigned-roles li').its('length').should('eq', 2);
              cy.get('#profile-table #assigned-roles li').contains('viewer');
              cy.get('#profile-table #assigned-roles li').contains('organizer');
              cy.get('#profile-table #unassigned-roles li').its('length').should('eq', 2);
              cy.get('#profile-table #unassigned-roles li').contains('sudo');

              // Divest organizer role (must click right on the little X)
              cy.get('#profile-table #assigned-roles li:first-child svg').click();
              cy.wait(300);

              cy.get('#profile-table #unassigned-roles').should('not.exist');
              cy.get('#profile-table #assigned-roles li').its('length').should('eq', 2);
              cy.get('#profile-table #assigned-roles li').contains('viewer');
              cy.get('#profile-table #assigned-roles li:last-of-type #assign-role').should('exist');

              cy.get('#assign-role').click();
              cy.wait(300);

              cy.get('#profile-table #unassigned-roles li').its('length').should('eq', 3);
              cy.get('#profile-table #unassigned-roles li').contains('organizer');
              cy.get('#profile-table #unassigned-roles li').contains('sudo');
            });

            it('updates the former organizer agent\'s interface', () => {
              // Divest organizer role
              cy.get('#profile-table #assigned-roles li:first-child svg').click();
              cy.wait(300);

              // Login former organizer agent
              cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy' });

              cy.get('#profile-table #assigned-roles li').its('length').should('eq', 1);

              // No delete X on viewer
              cy.get('#profile-table #assigned-roles li:last-of-type svg').should('not.exist');
              cy.get('#profile-table #assigned-roles li:last-of-type').contains('viewer');
            });
          });
        });

        describe('assigning sudo role', () => {
          beforeEach(() => {
            cy.get('#assign-role').click();
            cy.wait(300);
          });

          it('updates the interface', () => {
            cy.get('#profile-table #assigned-roles li').its('length').should('eq', 1);
            cy.get('#profile-table #assigned-roles li').contains('viewer');

            // Assign sudo role
            cy.get('#profile-table #unassigned-roles li').its('length').should('eq', 3);
            cy.get('#profile-table #unassigned-roles li').contains('sudo').click();
            cy.wait(300);

            cy.get('#profile-table #unassigned-roles li').its('length').should('eq', 2);
            cy.get('#profile-table #assigned-roles li').its('length').should('eq', 2);
            cy.get('#profile-table #assigned-roles li:first-of-type').contains('sudo');
            cy.get('#profile-table #assigned-roles li:first-of-type svg').should('exist');
            cy.get('#profile-table #assigned-roles li:last-of-type').contains('viewer');
            // Can't delete default viewer role (no X)
            cy.get('#profile-table #assigned-roles li:last-of-type svg').should('not.exist');
          });

          describe('new sudo agent experience', () => {
            let agents;
            beforeEach(() => {
              // Assign sudo role
              cy.get('#profile-table #unassigned-roles li').contains('sudo').click();
              cy.wait(300);

              // Login newly assigned agent
              cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy' });

              cy.task('query', `SELECT * FROM "Agents" ORDER BY "name" ASC;`).then(([results, metadata]) => {
                agents = results;
              });
            });

            it('updates the newly assigned agent\'s interface', () => {
              cy.get('#profile-table #assigned-roles li').its('length').should('eq', 2);

              // No delete X on sudo
              cy.get('#profile-table #assigned-roles li:first-of-type svg').should('not.exist');
              cy.get('#profile-table #assigned-roles li:first-of-type').contains('sudo');

              // No delete X on viewer
              cy.get('#profile-table #assigned-roles li:last-of-type svg').should('not.exist');
              cy.get('#profile-table #assigned-roles li:last-of-type').contains('viewer');
            });

            it('enables sudo abilities', () => {
              cy.get('#profile-table #assigned-roles li').its('length').should('eq', 2);

              // New sudo agent now has #admin-switch
              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check();
              cy.wait(200);
              cy.contains('Agent Directory').click();
              cy.wait(200);
              cy.url().should('contain', '/#/agent/admin');

              // Displays all the known agents
              expect(agents.length).to.eq(2);
              cy.get('#agent-directory-table').should('exist');
              cy.get('#agent-directory-table').find('.agent-button').its('length').should('eq', 2);
              cy.get('.agent-button').first().contains(agents[0].name);
              cy.get('.agent-button').first().contains(agents[0].email);
              cy.get('.agent-button a').first().should('have.attr', 'href').and('include', `#agent/${agents[0].socialProfile.user_id}`);
              cy.get('.agent-button').last().contains(agents[1].name);
              cy.get('.agent-button').last().contains(agents[1].email);
              cy.get('.agent-button a').last().should('have.attr', 'href').and('include', `#agent/${agents[1].socialProfile.user_id}`);

            });
          });

          describe('divesting sudo role', () => {
            beforeEach(() => {
              cy.get('#profile-table #unassigned-roles li').contains('sudo').click();
              cy.wait(300);
            });

            it('updates the interface', () => {
              cy.get('#profile-table #assigned-roles li').its('length').should('eq', 2);
              cy.get('#profile-table #assigned-roles li').contains('viewer');
              cy.get('#profile-table #assigned-roles li').contains('sudo');
              cy.get('#profile-table #unassigned-roles li').its('length').should('eq', 2);
              cy.get('#profile-table #unassigned-roles li').contains('organizer');

              // Divest sudo role (must click right on the little X)
              cy.get('#profile-table #assigned-roles li:first-child svg').click();
              cy.wait(300);

              cy.get('#profile-table #unassigned-roles').should('not.exist');
              cy.get('#profile-table #assigned-roles li').its('length').should('eq', 2);
              cy.get('#profile-table #assigned-roles li').contains('viewer');
              cy.get('#profile-table #assigned-roles li:last-of-type #assign-role').should('exist');

              cy.get('#assign-role').click();
              cy.wait(300);

              cy.get('#profile-table #unassigned-roles li').its('length').should('eq', 3);
              cy.get('#profile-table #unassigned-roles li').contains('organizer');
              cy.get('#profile-table #unassigned-roles li').contains('sudo');
            });

            it('updates the former sudo agent\'s interface', () => {
              // Divest sudo role
              cy.get('#profile-table #assigned-roles li:first-child svg').click();
              cy.wait(300);

              // Login former sudo agent
              cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy' });

              cy.get('#profile-table #assigned-roles li').its('length').should('eq', 1);

              // No delete X on viewer
              cy.get('#profile-table #assigned-roles li:last-of-type svg').should('not.exist');
              cy.get('#profile-table #assigned-roles li:last-of-type').contains('viewer');
            });
          });
        });
      });

      context('switched off', () => {
        describe('viewing member agent\'s profile', () => {
          beforeEach(() => {
            cy.login(_profile.email, _profile);
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').should('not.be.checked');
            // To close the menu
            cy.get('body').click();
            cy.visit(`/#/agent/${memberAgent.socialProfile.user_id}`);
            cy.wait(200);
          });

          it('does not display the assign-role chip', () => {
            cy.get('#profile-table table tbody tr ul li:last-of-type #assign-role').should('not.exist');
          });
        });
      });
    });
  });
});

export {}
