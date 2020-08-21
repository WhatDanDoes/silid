context('root/Agent edit', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Updates" CASCADE;');
  });

  let _profile;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com', name: 'Professor Fresh'};
  });



  describe('authenticated', () => {
    let agent;

    describe('viewing another agent\'s profile', () => {

      describe('admin mode', () => {

        context('switched off', () => {
          beforeEach(() => {
            // A convenient way to create a new agent
            cy.login('someotherguy@example.com', _profile);
            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
              agent = results[0];

              cy.login(_profile.email, _profile);

              cy.get('#app-menu-button').click();
              cy.wait(200);
              cy.get('#admin-switch').uncheck();

              cy.visit(`/#/agent/${agent.socialProfile.user_id}`);
              cy.wait(300);
            });
          });

          it('does not allow editing agent\'s info', () => {
            cy.get('h3').contains('Profile');
            cy.get('#profile-table table tbody tr th').contains('Name:');
            cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', agent.socialProfile.name);
            cy.get('#profile-table table tbody tr td input#agent-name-field').should('be.disabled');

            // Not really relevant for root-level agent profile edits, but included here anyway
            cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
            cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('be.disabled');
          });

        });

        context('switched on', () => {

          describe('agent\'s email verified', () => {

            beforeEach(() => {
              // A convenient way to create a new agent
              cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy' });
              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
                agent = results[0];

                cy.login(_profile.email, _profile);

                cy.get('#app-menu-button').click();
                cy.get('#admin-switch').check();
                cy.contains('Agent Directory').click();
                cy.wait(200);
                cy.contains(agent.name).click();
                cy.wait(300);
              });
            });

            it('displays agents\'s info', () => {
              cy.get('h3').contains('Profile');
              cy.get('#profile-table table tbody tr th').contains('Name:');
              cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', agent.socialProfile.name);
              cy.get('#profile-table table tbody tr td input#agent-name-field').should('not.be.disabled');

              // Not really relevant for root-level root-agent profile edits, but included here anyway
              cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
              cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('be.disabled');
            });

            describe('#agent-name-field', () => {
              it('reveals Save and Cancel buttons on change', () => {
                cy.get('button#save-agent').should('not.exist');
                cy.get('button#cancel-agent-changes').should('not.exist');

                cy.get('#agent-name-field').type('!!!');
                cy.get('#agent-name-field').should('have.value', 'Some Other Guy!!!');

                cy.get('button#save-agent').should('exist');
                cy.get('button#cancel-agent-changes').should('exist');
              });

              describe('#cancel-agent-changes button', () => {
                beforeEach(() => {
                  cy.get('#agent-name-field').clear();
                  cy.get('#agent-name-field').type('Some Groovy Cat');
                });

                it('resets the changes to the editable fields', () => {
                  cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
                  cy.get('button#cancel-agent-changes').click();
                  cy.get('#agent-name-field').should('have.value', 'Some Other Guy');
                });

                it('hides the Cancel and Save buttons', () => {
                  cy.get('button#save-agent').should('exist');
                  cy.get('button#cancel-agent-changes').should('exist');

                  cy.get('button#cancel-agent-changes').click();

                  cy.get('button#save-agent').should('not.exist');
                  cy.get('button#cancel-agent-changes').should('not.exist');
                });

                it('does not change the agent\'s record', () => {
                  cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
                    expect(results.length).to.eq(1);
                    expect(results[0].socialProfile.name).to.eq('Some Other Guy');
                    cy.get('button#cancel-agent-changes').click();
                    cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
                      expect(results[0].socialProfile.name).to.eq('Some Other Guy');
                    });
                  });
                });
              });

              describe('#save-agent button', () => {

                describe('is unsuccessful in making changes', () => {

                  describe('with invalid field', () => {
                    it('rejects empty name field', () => {
                      cy.get('#agent-name-field').clear();
                      cy.get('#agent-name-field').should('have.value', '');
                      cy.get('button#save-agent').click();
                      cy.wait(300);
                      cy.get('#flash-message').contains('Missing profile data');
                    });

                    it('rejects blank name field', () => {
                      cy.get('#agent-name-field').clear();
                      cy.get('#agent-name-field').type('     ');
                      cy.get('#agent-name-field').should('have.value', '     ');
                      cy.get('button#save-agent').click();
                      cy.wait(300);
                      cy.get('#flash-message').contains('Missing profile data');
                    });

                    it('does not change the agent\'s record', () => {
                      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
                        expect(results.length).to.eq(1);
                        expect(results[0].socialProfile.name).to.eq('Some Other Guy');

                        cy.get('#agent-name-field').clear();
                        cy.get('button#save-agent').click();

                        cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                          expect(results[0].socialProfile.name).to.eq('Some Other Guy');
                        });
                      });
                    });
                  });
                });

                describe('successfully makes changes', () => {
                  beforeEach(() => {
                    cy.get('#agent-name-field').clear();
                    cy.get('#agent-name-field').type('Some Groovy Cat');
                  });

                  it('lands in the proper place', () => {
                    cy.get('button#save-agent').click();
                    cy.wait(300);
                    cy.url().should('contain', `/#/agent/${agent.socialProfile.user_id}`);
                  });

                  it('persists the changes to the editable fields', () => {
                    cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
                    cy.get('button#save-agent').click();
                    cy.wait(300);
                    cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
                  });

                  it('hides the Cancel and Save buttons', () => {
                    cy.get('button#save-agent').should('exist');
                    cy.get('button#cancel-agent-changes').should('exist');

                    cy.get('button#save-agent').click();

                    cy.get('button#save-agent').should('not.exist');
                    cy.get('button#cancel-agent-changes').should('not.exist');
                  });

                  it('changes the agent\'s record', () => {
                    cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
                      expect(results.length).to.eq(1);
                      expect(results[0].socialProfile.name).to.eq('Some Other Guy');
                      cy.get('button#save-agent').click();
                      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
                        expect(results[0].socialProfile.name).to.eq('Some Groovy Cat');
                      });
                    });
                  });

                  it('displays a friendly message', () => {
                    cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
                    cy.get('button#save-agent').click();
                    cy.wait(300);
                    cy.get('#flash-message').contains('Agent updated');
                  });

                  it('persists updated root data between browser refreshes', () => {
                    cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
                    cy.get('button#save-agent').click();
                    cy.wait(300);
                    cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
                    cy.reload();
                    cy.wait(300);
                    cy.visit(`/#/agent/${agent.socialProfile.user_id}`);
                    cy.wait(300);
                    cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
                  });
                });
              });
            });
          });

          describe('agent\'s email not verified', () => {

            beforeEach(() => {
              // A convenient way to create a new agent
              cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy', email_verified: false });
              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
                agent = results[0];

                cy.login(_profile.email, _profile);

                cy.get('#app-menu-button').click();
                cy.get('#admin-switch').check();
                cy.contains('Agent Directory').click();
                cy.wait(200);
                cy.contains(agent.name).click();
                cy.wait(300);
              });
            });

            it('displays agents\'s info', () => {
              cy.get('h3').contains('Profile');
              cy.get('#profile-table table tbody tr th').contains('Name:');
              cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', agent.socialProfile.name);
              cy.get('#profile-table table tbody tr td input#agent-name-field').should('be.disabled');
            });
          });
        });
      });
    });

    describe('viewing root\'s own profile', () => {

      let root;

      context('admin mode', () => {
        context('switched on', () => {
          describe('email verified', () => {

            beforeEach(() => {
              cy.login(_profile.email, _profile);
              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                root = results[0];
                cy.get('#flash-message #close-flash').click();

                cy.get('#app-menu-button').click();
                cy.get('#admin-switch').check();
                cy.get('#app-menu').contains('Profile').click();
                cy.wait(200);
              });
            });

            it('displays root\'s info', () => {
              cy.get('h3').contains('Profile');
              cy.get('#profile-table table tbody tr th').contains('Name:');
              cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', root.socialProfile.name);
              cy.get('#profile-table table tbody tr td input#agent-name-field').should('not.be.disabled');

              // Not really relevant for root-level root-agent profile edits, but included here anyway
              cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
              cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('not.be.disabled');
            });

            describe('#agent-name-field', () => {
              it('reveals Save and Cancel buttons on change', () => {
                cy.get('button#save-agent').should('not.exist');
                cy.get('button#cancel-agent-changes').should('not.exist');

                cy.get('#agent-name-field').type('!!!');
                cy.get('#agent-name-field').should('have.value', 'Professor Fresh!!!');

                cy.get('button#save-agent').should('exist');
                cy.get('button#cancel-agent-changes').should('exist');
              });

              describe('#cancel-agent-changes button', () => {
                beforeEach(() => {
                  cy.get('#agent-name-field').clear();
                  cy.get('#agent-name-field').type('Tucks McChucks');
                });

                it('resets the changes to the editable fields', () => {
                  cy.get('#agent-name-field').should('have.value', 'Tucks McChucks');
                  cy.get('button#cancel-agent-changes').click();
                  cy.get('#agent-name-field').should('have.value', 'Professor Fresh');
                });

                it('hides the Cancel and Save buttons', () => {
                  cy.get('button#save-agent').should('exist');
                  cy.get('button#cancel-agent-changes').should('exist');

                  cy.get('button#cancel-agent-changes').click();

                  cy.get('button#save-agent').should('not.exist');
                  cy.get('button#cancel-agent-changes').should('not.exist');
                });

                it('does not change the agent\'s record', () => {
                  cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                    expect(results.length).to.eq(1);
                    expect(results[0].socialProfile.name).to.eq('Professor Fresh');
                    cy.get('button#cancel-agent-changes').click();
                    cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                      expect(results[0].socialProfile.name).to.eq('Professor Fresh');
                    });
                  });
                });
              });

              describe('#save-agent button', () => {

                describe('is unsuccessful in making changes', () => {

                  describe('with invalid field', () => {
                    it('rejects empty name field', () => {
                      cy.get('#agent-name-field').clear();
                      cy.get('#agent-name-field').should('have.value', '');
                      cy.get('button#save-agent').click();
                      cy.wait(300);
                      cy.get('#flash-message').contains('Missing profile data');
                    });

                    it('rejects blank name field', () => {
                      cy.get('#agent-name-field').clear();
                      cy.get('#agent-name-field').type('     ');
                      cy.get('#agent-name-field').should('have.value', '     ');
                      cy.get('button#save-agent').click();
                      cy.wait(300);
                      cy.get('#flash-message').contains('Missing profile data');
                    });

                    it('does not change the agent\'s record', () => {
                      cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                        expect(results.length).to.eq(1);
                        expect(results[0].socialProfile.name).to.eq('Professor Fresh');

                        cy.get('#agent-name-field').clear();
                        cy.get('button#save-agent').click();

                        cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                          expect(results[0].socialProfile.name).to.eq('Professor Fresh');
                        });
                      });
                    });
                  });
                });

                describe('successfully makes changes', () => {
                  beforeEach(() => {
                    cy.get('#agent-name-field').clear();
                    cy.get('#agent-name-field').type('Tucks McChucks');
                  });

                  it('lands in the proper place', () => {
                    cy.get('button#save-agent').click();
                    cy.wait(300);
                    cy.url().should('contain', '/#/agent');
                  });

                  it('persists the changes to the editable fields', () => {
                    cy.get('#agent-name-field').should('have.value', 'Tucks McChucks');
                    cy.get('button#save-agent').click();
                    cy.wait(300);
                    cy.get('#agent-name-field').should('have.value', 'Tucks McChucks');
                  });

                  it('hides the Cancel and Save buttons', () => {
                    cy.get('button#save-agent').should('exist');
                    cy.get('button#cancel-agent-changes').should('exist');

                    cy.get('button#save-agent').click();

                    cy.get('button#save-agent').should('not.exist');
                    cy.get('button#cancel-agent-changes').should('not.exist');
                  });

                  it('changes the agent\'s record', () => {
                    cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                      expect(results.length).to.eq(1);
                      expect(results[0].socialProfile.name).to.eq('Professor Fresh');
                      cy.get('button#save-agent').click();
                      cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                        expect(results[0].socialProfile.name).to.eq('Tucks McChucks');
                      });
                    });
                  });

                  it('displays a friendly message', () => {
                    cy.get('#agent-name-field').should('have.value', 'Tucks McChucks');
                    cy.get('button#save-agent').click();
                    cy.wait(300);
                    cy.get('#flash-message').contains('Agent updated');
                  });

                  it('persists updated root data between browser refreshes', () => {
                    cy.get('#agent-name-field').should('have.value', 'Tucks McChucks');
                    cy.get('button#save-agent').click();
                    cy.wait(300);
                    cy.get('#agent-name-field').should('have.value', 'Tucks McChucks');
                    cy.reload();
                    cy.wait(300);
                    cy.get('#agent-name-field').should('have.value', 'Tucks McChucks');
                  });
                });
              });
            });
          });
        });
      });

      describe('email not verified', () => {
        beforeEach(() => {
          cy.login(_profile.email, {..._profile, email_verified: false });
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];
            cy.visit(`/#/agent/${root.socialProfile.user_id}`);
            cy.wait(500);
          });
        });

        it('displays root\'s info', () => {
          cy.get('h3').contains('Profile');
          cy.get('#profile-table table tbody tr th').contains('Name:');
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', root.socialProfile.name);
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('be.disabled');

          // Not really relevant for root-level agent profile edits, but included here anyway
          cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
          cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('not.be.disabled');
        });
      });
    });
  });
});

export {}
