context('root/Agent show', function() {

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
        describe('viewing member agent\'s profile', () => {
          beforeEach(function() {
            cy.login(_profile.email, _profile);
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            cy.contains('Agent Directory').click();
            cy.wait(200);
            cy.get('.agent-button a').last().click();
            cy.wait(200);
          });

          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/agent/${memberAgent.socialProfile.user_id}`);
          });

          it('displays agent\'s info', () => {
            cy.get('h3').contains('Profile');
            cy.get('#profile-table table tbody tr th').contains('Name:');
            cy.get('#profile-table table tbody tr td').contains(memberAgent.socialProfile.name);
            cy.get('#profile-table table tbody tr th').contains('Email:');
            cy.get('#profile-table table tbody tr td').contains(memberAgent.socialProfile.email);
            cy.get('#profile-table table tbody tr th').contains('Locale:');
            cy.get('#profile-table table tbody tr td').contains(memberAgent.socialProfile.locale);
            cy.get('#profile-table table tbody tr th').contains('Roles:');
            cy.get('#profile-table table tbody tr ul li').its('length').should('eq', 2);
            cy.get('#profile-table table tbody tr ul li').contains('viewer');
            cy.get('#profile-table table tbody tr ul li:last-of-type #assign-role').should('exist');
          });

          describe('teams', () => {
            describe('none created', () => {
              it('displays teams table', function() {
                cy.get('h6').contains('Teams');
                cy.get('#teams-table table tbody tr td').contains('No records to display');
              });
            });

            describe('some created', () => {
              let agent;
              beforeEach(function() {
                cy.login(memberAgent.socialProfile.email, {..._profile, user_metadata: {
                                                         teams: [
                                                           {
                                                             id: 'some-uuid-v4',
                                                             name: 'The Calgary Roughnecks',
                                                             leader: 'someguy@example.com',
                                                             members: [memberAgent.socialProfile.email]
                                                           }
                                                         ]
                                                       } });

                cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${memberAgent.socialProfile.email}' LIMIT 1;`).then(([results, metadata]) => {
                  memberAgent = results[0];
                  cy.login(_profile.email, _profile);
                  cy.visit(`/#/agent/${memberAgent.socialProfile.user_id}`);
                });
              });

              it('displays teams in a table', function() {
                cy.get('h6').contains('Teams');
                cy.get('#teams-table table tbody tr td').contains('No records to display').should('not.exist');
                cy.get('#teams-table button span span').should('not.exist');
                cy.get('#teams-table table thead tr th').contains('Name');
                cy.get('#teams-table table tbody tr td').contains(memberAgent.socialProfile.user_metadata.teams[0].name);
                cy.get('#teams-table table tbody tr td a').should('contain', memberAgent.socialProfile.user_metadata.teams[0].name).
                  and('have.attr', 'href').and('equal', `#team/${memberAgent.socialProfile.user_metadata.teams[0].id}`);
                cy.get('#teams-table table thead tr th').contains('Leader');
                cy.get('#teams-table table tbody tr td').contains(memberAgent.socialProfile.user_metadata.teams[0].leader);
              });
            });
          });

          describe('social profile data', () => {
            it('toggles JSON display', () => {
              cy.get('.react-json-view').its('length').should('eq', 1);

              // Toggle closed
              cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
              cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
              cy.get('.react-json-view').contains('name').should('not.exist');

              // Toggle open
              cy.get('.react-json-view .icon-container .collapsed-icon').click();
              cy.get('.react-json-view .icon-container .expanded-icon').should('exist');

              cy.get('.react-json-view').contains('locale');
              cy.get('.react-json-view').contains('picture');
              cy.get('.react-json-view').contains('user_id');
              cy.get('.react-json-view').contains('name');

              // Toggle closed again
              cy.get('.react-json-view .icon-container .expanded-icon').click();
              cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
              cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
              cy.get('.react-json-view').contains('name').should('not.exist');
            });
          });
        });

        describe('viewing your own profile', () => {

          let root;
          beforeEach(function() {
            cy.login(_profile.email, _profile);
            cy.get('#app-menu-button').click();
            cy.get('#admin-switch').check();
            // Just to close the menu
            cy.get('body').click();
            cy.wait(200);
            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
              root = results[0];
              cy.visit(`/#/agent/${root.socialProfile.user_id}`);
              cy.wait(200);
            });
          });

          it('lands in the right spot', () => {
            cy.url().should('contain', `/#/agent/${root.socialProfile.user_id}`);
          });

          it('displays agent\'s info', () => {
            cy.get('h3').contains('Profile');
            cy.get('#profile-table table tbody tr th').contains('Name:');
            cy.get('#profile-table table tbody tr td').contains(root.socialProfile.name);
            cy.get('#profile-table table tbody tr th').contains('Email:');
            cy.get('#profile-table table tbody tr td').contains(root.socialProfile.email);
            cy.get('#profile-table table tbody tr th').contains('Locale:');
            cy.get('#profile-table table tbody tr td').contains(root.socialProfile.locale);
            cy.get('#profile-table table tbody tr th').contains('Roles:');
            cy.get('#profile-table table tbody tr ul li').its('length').should('eq', 2);
            // 2020-6-24 This should be `sudo`, but will remain like this for now
            cy.get('#profile-table table tbody tr ul li').contains('viewer');
            cy.get('#profile-table table tbody tr ul li:last-of-type #assign-role').should('exist');
          });

          describe('teams', () => {
            describe('none created', () => {
              it('displays teams table', function() {
                cy.get('h6').contains('Teams');
                cy.get('table tbody tr td').contains('No records to display');
              });
            });

            describe('some created', () => {
              let agent;
              beforeEach(function() {
                cy.login(_profile.email, {..._profile, user_metadata: {
                                                         teams: [
                                                           {
                                                             id: 'some-uuid-v4',
                                                             name: 'The Calgary Roughnecks',
                                                             leader: 'root@example.com',
                                                             members: ['root@example.com']
                                                           }
                                                         ]
                                                       } }, [this.scope.read.agents]);

                cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                  root = results[0];
                  cy.reload(true);
                  cy.wait(300);
                });
              });

              it('displays teams in a table', function() {
                cy.get('h6').contains('Teams');
                cy.get('#teams-table table tbody tr td').contains('No records to display').should('not.exist');
                cy.get('#teams-table button span span').contains('add_box');
                cy.get('#teams-table table thead tr th').contains('Name');
                cy.get('#teams-table table tbody tr td').contains(root.socialProfile.user_metadata.teams[0].name);
                cy.get('#teams-table table tbody tr td a').should('contain', root.socialProfile.user_metadata.teams[0].name).
                  and('have.attr', 'href').and('equal', `#team/${root.socialProfile.user_metadata.teams[0].id}`);
                cy.get('#teams-table table thead tr th').contains('Leader');
                cy.get('#teams-table table tbody tr td').contains(root.socialProfile.user_metadata.teams[0].leader);
              });
            });
          });

          describe('social profile data', () => {
            it('toggles JSON display', () => {
              cy.get('.react-json-view').its('length').should('eq', 1);

              // Toggle closed
              cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
              cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
              cy.get('.react-json-view').contains('name').should('not.exist');

              // Toggle open
              cy.get('.react-json-view .icon-container .collapsed-icon').click();
              cy.get('.react-json-view .icon-container .expanded-icon').should('exist');

              cy.get('.react-json-view').contains('locale');
              cy.get('.react-json-view').contains('picture');
              cy.get('.react-json-view').contains('user_id');
              cy.get('.react-json-view').contains('name');

              // Toggle closed again
              cy.get('.react-json-view .icon-container .expanded-icon').click();
              cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
              cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
              cy.get('.react-json-view').contains('name').should('not.exist');
            });
          });
        });
      });
    });

    context('switched off', () => {
      describe('viewing member agent\'s profile', () => {
        beforeEach(function() {
          cy.login(_profile.email, _profile);
          cy.get('#app-menu-button').click();
          cy.get('#admin-switch').should('not.be.checked');
          // To close the menu
          cy.get('body').click();
          cy.visit(`/#/agent/${memberAgent.socialProfile.user_id}`);
          cy.wait(200);
        });

        it('lands in the right spot', () => {
          cy.url().should('contain', `/#/agent/${memberAgent.socialProfile.user_id}`);
        });

        it('displays agent\'s info', function() {
          cy.get('h3').contains('Profile');
          cy.get('table tbody tr th').contains('Name:');
          cy.get('table tbody tr td').contains(memberAgent.socialProfile.name);
          cy.get('table tbody tr th').contains('Email:');
          cy.get('table tbody tr td').contains(memberAgent.socialProfile.email);
          cy.get('table tbody tr th').contains('Locale:');
          cy.get('table tbody tr td').contains(memberAgent.socialProfile.locale);
          cy.get('table tbody tr th').contains('Roles:');
          cy.get('table tbody tr ul li').its('length').should('eq', 1);
          cy.get('table tbody tr ul li').contains('viewer');
        });

        describe('teams', () => {
          describe('none created', () => {
            it('displays teams table', function() {
              cy.get('h6').contains('Teams');
              cy.get('table tbody tr td').contains('No records to display');
            });
          });

          describe('some created', () => {
            let agent;
            beforeEach(function() {
              cy.login(memberAgent.socialProfile.email, {..._profile, user_metadata: {
                                                       teams: [
                                                         {
                                                           id: 'some-uuid-v4',
                                                           name: 'The Calgary Roughnecks',
                                                           leader: 'someguy@example.com',
                                                           members: [memberAgent.socialProfile.email]
                                                         }
                                                       ]
                                                     } }, [this.scope.read.agents]);

              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${memberAgent.socialProfile.email}' LIMIT 1;`).then(([results, metadata]) => {
                memberAgent = results[0];
                cy.login(_profile.email, _profile);
                cy.visit(`/#/agent/${memberAgent.socialProfile.user_id}`);
              });
            });

            it('displays teams in a table', function() {
              cy.get('h6').contains('Teams');
              cy.get('#teams-table table tbody tr td').contains('No records to display').should('not.exist');
              cy.get('#teams-table button span span').should('not.exist');
              cy.get('#teams-table table thead tr th').contains('Name');
              cy.get('#teams-table table tbody tr td').contains(memberAgent.socialProfile.user_metadata.teams[0].name);
              cy.get('#teams-table table tbody tr td a').should('contain', memberAgent.socialProfile.user_metadata.teams[0].name).
                and('have.attr', 'href').and('equal', `#team/${memberAgent.socialProfile.user_metadata.teams[0].id}`);
              cy.get('#teams-table table thead tr th').contains('Leader');
              cy.get('table tbody tr td').contains(memberAgent.socialProfile.user_metadata.teams[0].leader);
            });
          });
        });

        describe('social profile data', () => {
          it('toggles JSON display', () => {
            cy.get('.react-json-view').its('length').should('eq', 1);

            // Toggle closed
            cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
            cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
            cy.get('.react-json-view').contains('name').should('not.exist');

            // Toggle open
            cy.get('.react-json-view .icon-container .collapsed-icon').click();
            cy.get('.react-json-view .icon-container .expanded-icon').should('exist');

            cy.get('.react-json-view').contains('locale');
            cy.get('.react-json-view').contains('picture');
            cy.get('.react-json-view').contains('user_id');
            cy.get('.react-json-view').contains('name');

            // Toggle closed again
            cy.get('.react-json-view .icon-container .expanded-icon').click();
            cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
            cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
            cy.get('.react-json-view').contains('name').should('not.exist');
          });
        });
      });

      describe('viewing your own profile', () => {

        let root;
        beforeEach(function() {
          cy.login(_profile.email, _profile);
          cy.get('#app-menu-button').click();
          cy.wait(200);
          cy.get('#admin-switch').uncheck();
          cy.get('#agent-button').contains('Profile').click();
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];
            cy.visit(`/#/agent/${root.socialProfile.user_id}`);
            cy.wait(500);
          });
        });

        it('lands in the right spot', () => {
          cy.url().should('contain', `/#/agent/${root.socialProfile.user_id}`);
        });

        it('displays agent\'s editable info in form', () => {
          cy.get('h3').contains('Profile');
          cy.get('table tbody tr th').contains('Name:');
          cy.get('table tbody tr td').contains(root.socialProfile.name);
          cy.get('table tbody tr th').contains('Email:');
          cy.get('table tbody tr td').contains(root.socialProfile.email);
          cy.get('table tbody tr th').contains('Locale:');
          cy.get('table tbody tr td').contains(root.socialProfile.locale);
          cy.get('table tbody tr th').contains('Roles:');
          cy.get('table tbody tr ul li').its('length').should('eq', 1);
          cy.get('table tbody tr ul li').contains('viewer');
        });

        describe('teams', () => {
          describe('none created', () => {
            it('displays teams table', function() {
              cy.get('h6').contains('Teams');
              cy.get('table tbody tr td').contains('No records to display');
            });
          });

          describe('some created', () => {
            let agent;
            beforeEach(function() {
              cy.login(_profile.email, {..._profile, user_metadata: {
                                                       teams: [
                                                         {
                                                           id: 'some-uuid-v4',
                                                           name: 'The Calgary Roughnecks',
                                                           leader: 'root@example.com',
                                                           members: ['root@example.com']
                                                         }
                                                       ]
                                                     } }, [this.scope.read.agents]);

              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                root = results[0];
                cy.reload(true);
                cy.wait(300);
              });
            });

            it('displays teams in a table', function() {
              cy.get('h6').contains('Teams');
              cy.get('#teams-table table tbody tr td').contains('No records to display').should('not.exist');
              cy.get('#teams-table button span span').contains('add_box');
              cy.get('#teams-table table thead tr th').contains('Name');
              cy.get('#teams-table table tbody tr td').contains(root.socialProfile.user_metadata.teams[0].name);
              cy.get('#teams-table table tbody tr td a').should('contain', root.socialProfile.user_metadata.teams[0].name).
                and('have.attr', 'href').and('equal', `#team/${root.socialProfile.user_metadata.teams[0].id}`);
              cy.get('#teams-table table thead tr th').contains('Leader');
              cy.get('#teams-table table tbody tr td').contains(root.socialProfile.user_metadata.teams[0].leader);
            });
          });
        });

        describe('social profile data', () => {
          it('toggles JSON display', () => {
            cy.get('.react-json-view').its('length').should('eq', 1);

            // Toggle closed
            cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
            cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
            cy.get('.react-json-view').contains('name').should('not.exist');

            // Toggle open
            cy.get('.react-json-view .icon-container .collapsed-icon').click();
            cy.get('.react-json-view .icon-container .expanded-icon').should('exist');

            cy.get('.react-json-view').contains('locale');
            cy.get('.react-json-view').contains('picture');
            cy.get('.react-json-view').contains('user_id');
            cy.get('.react-json-view').contains('name');

            // Toggle closed again
            cy.get('.react-json-view .icon-container .expanded-icon').click();
            cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
            cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
            cy.get('.react-json-view').contains('name').should('not.exist');
          });
        });
      });
    });
  });
});

export {}
