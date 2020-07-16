context('root/Organization edit', function() {

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

  describe('Editing', () => {

    describe('authenticated', () => {
  
      let root;
      beforeEach(() => {
        // Get root agent
        cy.login(_profile.email, _profile);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          root = results[0];
        });
      });

      context('root is organizer', () => {
        beforeEach(function() {
          /**
           * 2020-7-8
           *
           * This harkens back to the question of whether a root agent can
           * create teams/orgs on behalf of another agent. Likewise, should
           * a root agent be able to create an org when admin mode is
           * enabled?
           */
          // The '123' role ID matches that defined in the RBAC mock server
          cy.request('POST', `https://localhost:3002/api/v2/users/${root.socialProfile.user_id}/roles`, { roles: ['123'] });
  
          cy.login(_profile.email, _profile, [this.scope.create.organizations, this.scope.update.organizations]);

          cy.get('#organizations-table button span span').contains('add_box').click();
          cy.get('input[placeholder="Name"]').type('The National Lacrosse League');
          cy.get('#organizations-table button[title="Save"]').click();
          cy.wait(300);
          cy.contains('The National Lacrosse League').click();

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${root.email}' LIMIT 1;`).then(([results, metadata]) => {
            root = results[0];
          });
        });

        describe('admin mode', () => {
          context('switched on', () => {
            beforeEach(() => {
              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check();
              cy.get('#app-menu').contains('Profile').click();
              cy.wait(200);
              cy.contains('The National Lacrosse League').click();
              cy.wait(300);
            });

            describe('Editable', () => {
              describe('#org-name-field', () => {
                it('reveals Save and Cancel buttons on change', () => {
                  cy.get('button#delete-org').should('exist');
                  cy.get('button#save-org').should('not.exist');
                  cy.get('button#cancel-org-changes').should('not.exist');
        
                  cy.get('#org-name-field').type('!!!');
                  cy.get('#org-name-field').should('have.value', 'The National Lacrosse League!!!');
        
                  cy.get('button#delete-org').should('not.exist');
                  cy.get('button#save-org').should('exist');
                  cy.get('button#cancel-org-changes').should('exist');
                });
        
                describe('#cancel-team-update button', () => {
                  beforeEach(() => {
                    cy.get('#org-name-field').clear();
                    cy.get('#org-name-field').type('The Regional Lacrosse Association');
                  });
        
                  it('resets the changes to the editable fields', () => {
                    cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                    cy.get('button#cancel-org-changes').click();
                    cy.get('#org-name-field').should('have.value', 'The National Lacrosse League');
                  });
        
                  it('hides the Cancel and Save buttons', () => {
                    cy.get('button#delete-org').should('not.exist');
                    cy.get('button#save-org').should('exist');
                    cy.get('button#cancel-org-changes').should('exist');
        
                    cy.get('button#cancel-org-changes').click();
        
                    cy.get('button#delete-org').should('exist');
                    cy.get('button#save-org').should('not.exist');
                    cy.get('button#cancel-org-changes').should('not.exist');
                  });
        
                  it('does not change the record in the organizer\'s user_metadata', () => {
                    cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                      expect(results.length).to.eq(1);
                      expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                      expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
                      cy.get('button#cancel-org-changes').click();
                      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                        expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                        expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
                      });
                    });
                  });
                });
        
                describe('#save-org button', () => {
        
                  describe('is unsuccessful in making changes', () => {
        
                    describe('with invalid field', () => {
                      it('empty name field', () => {
                        cy.get('#org-name-field').clear();
                        cy.get('#org-name-field').should('have.value', '');
                        cy.get('button#save-org').click();
                        cy.wait(300);
                        cy.get('#flash-message').contains('Organization name can\'t be blank');
                      });
        
                      it('blank name field', () => {
                        cy.get('#org-name-field').clear();
                        cy.get('#org-name-field').type('     ');
                        cy.get('#org-name-field').should('have.value', '     ');
                        cy.get('button#save-org').click();
                        cy.wait(300);
                        cy.get('#flash-message').contains('Organization name can\'t be blank');
                      });
        
                      it('does not change the record in the organizer\'s user_metadata', () => {
                        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                          expect(results.length).to.eq(1);
                          expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                          expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
        
                          cy.get('#org-name-field').clear();
                          cy.get('button#save-org').click();
        
                          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                            expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                            expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
                          });
                        });
                      });
        
                      describe('duplicate organization name', () => {
        
                        it('displays friendly error message', () => {
                          cy.get('#org-name-field').clear();
                          cy.get('#org-name-field').type('The National Lacrosse League');
                          cy.get('button#save-org').click();
                          cy.wait(300);
                          cy.get('#flash-message').contains('That organization is already registered');
                          cy.get('#flash-message #close-flash').click();
        
                          // Make sure flash state resets
                          cy.get('button#save-org').click();
                          cy.wait(300);
                          cy.get('#flash-message').contains('That organization is already registered');
                        });
        
                        it('does not change the record in the team leader\'s user_metadata', () => {
                          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                            expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                            expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
        
                            cy.get('#org-name-field').clear();
                            cy.get('#org-name-field').type('The National Lacrosse League');
                            cy.get('button#save-org').click();
        
                            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                              expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                              expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
                            });
                          });
                        });
                      });
                    });
                  });
        
                  describe('successfully makes changes', () => {
                    beforeEach(() => {
                      cy.get('#org-name-field').clear();
                      cy.get('#org-name-field').type('The Regional Lacrosse Association');
                    });
        
                    it('lands in the proper place', () => {
                      cy.get('button#save-org').click();
                      cy.wait(300);
                      cy.url().should('contain', `/#/organization/${root.socialProfile.user_metadata.organizations[0].id}`);
                    });
        
                    it('persists the changes to the editable fields', () => {
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                      cy.get('button#save-org').click();
                      cy.wait(300);
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                    });
        
                    it('hides the Cancel and Save buttons', () => {
                      cy.get('button#delete-org').should('not.exist');
                      cy.get('button#save-org').should('exist');
                      cy.get('button#cancel-org-changes').should('exist');
        
                      cy.get('button#save-org').click();
        
                      cy.get('button#delete-org').should('exist');
                      cy.get('button#save-org').should('not.exist');
                      cy.get('button#cancel-org-changes').should('not.exist');
                    });
        
                    it('changes the record in the organizer\'s user_metadata', () => {
                      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                        expect(results.length).to.eq(1);
                        expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                        expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
                        cy.get('button#save-org').click();
                        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                          expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                          expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The Regional Lacrosse Association');
                        });
                      });
                    });
        
                    it('displays a friendly message', () => {
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                      cy.get('button#save-org').click();
                      cy.wait(300);
                      cy.get('#flash-message').contains('Organization updated');
                    });
        
                    it('persists updated team data between browser refreshes', function() {
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                      cy.get('button#save-org').click();
                      cy.wait(300);
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                      cy.reload();
                      cy.wait(300);
                      cy.contains('The Regional Lacrosse Association').click();
                      cy.wait(300);
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                    });
                  });
                });
              });
            });
          });

          context('switched off', () => {
            beforeEach(() => {
              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check().uncheck();
              cy.get('#app-menu').contains('Profile').click();
              cy.wait(200);
              cy.contains('The National Lacrosse League').click();
              cy.wait(300);
            });

            describe('Editable', () => {
              describe('#org-name-field', () => {
                it('reveals Save and Cancel buttons on change', () => {
                  cy.get('button#delete-org').should('exist');
                  cy.get('button#save-org').should('not.exist');
                  cy.get('button#cancel-org-changes').should('not.exist');
        
                  cy.get('#org-name-field').type('!!!');
                  cy.get('#org-name-field').should('have.value', 'The National Lacrosse League!!!');
        
                  cy.get('button#delete-org').should('not.exist');
                  cy.get('button#save-org').should('exist');
                  cy.get('button#cancel-org-changes').should('exist');
                });
        
                describe('#cancel-team-update button', () => {
                  beforeEach(() => {
                    cy.get('#org-name-field').clear();
                    cy.get('#org-name-field').type('The Regional Lacrosse Association');
                  });
        
                  it('resets the changes to the editable fields', () => {
                    cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                    cy.get('button#cancel-org-changes').click();
                    cy.get('#org-name-field').should('have.value', 'The National Lacrosse League');
                  });
        
                  it('hides the Cancel and Save buttons', () => {
                    cy.get('button#delete-org').should('not.exist');
                    cy.get('button#save-org').should('exist');
                    cy.get('button#cancel-org-changes').should('exist');
        
                    cy.get('button#cancel-org-changes').click();
        
                    cy.get('button#delete-org').should('exist');
                    cy.get('button#save-org').should('not.exist');
                    cy.get('button#cancel-org-changes').should('not.exist');
                  });
        
                  it('does not change the record in the organizer\'s user_metadata', () => {
                    cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                      expect(results.length).to.eq(1);
                      expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                      expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
                      cy.get('button#cancel-org-changes').click();
                      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                        expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                        expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
                      });
                    });
                  });
                });
        
                describe('#save-org button', () => {
        
                  describe('is unsuccessful in making changes', () => {
        
                    describe('with invalid field', () => {
                      it('empty name field', () => {
                        cy.get('#org-name-field').clear();
                        cy.get('#org-name-field').should('have.value', '');
                        cy.get('button#save-org').click();
                        cy.wait(300);
                        cy.get('#flash-message').contains('Organization name can\'t be blank');
                      });
        
                      it('blank name field', () => {
                        cy.get('#org-name-field').clear();
                        cy.get('#org-name-field').type('     ');
                        cy.get('#org-name-field').should('have.value', '     ');
                        cy.get('button#save-org').click();
                        cy.wait(300);
                        cy.get('#flash-message').contains('Organization name can\'t be blank');
                      });
        
                      it('does not change the record in the organizer\'s user_metadata', () => {
                        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                          expect(results.length).to.eq(1);
                          expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                          expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
        
                          cy.get('#org-name-field').clear();
                          cy.get('button#save-org').click();
        
                          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                            expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                            expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
                          });
                        });
                      });
        
                      describe('duplicate organization name', () => {
        
                        it('displays friendly error message', () => {
                          cy.get('#org-name-field').clear();
                          cy.get('#org-name-field').type('The National Lacrosse League');
                          cy.get('button#save-org').click();
                          cy.wait(300);
                          cy.get('#flash-message').contains('That organization is already registered');
                          cy.get('#flash-message #close-flash').click();
        
                          // Make sure flash state resets
                          cy.get('button#save-org').click();
                          cy.wait(300);
                          cy.get('#flash-message').contains('That organization is already registered');
                        });
        
                        it('does not change the record in the team leader\'s user_metadata', () => {
                          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                            expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                            expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
        
                            cy.get('#org-name-field').clear();
                            cy.get('#org-name-field').type('The National Lacrosse League');
                            cy.get('button#save-org').click();
        
                            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                              expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                              expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
                            });
                          });
                        });
                      });
                    });
                  });
        
                  describe('successfully makes changes', () => {
                    beforeEach(() => {
                      cy.get('#org-name-field').clear();
                      cy.get('#org-name-field').type('The Regional Lacrosse Association');
                    });
        
                    it('lands in the proper place', () => {
                      cy.get('button#save-org').click();
                      cy.wait(300);
                      cy.url().should('contain', `/#/organization/${root.socialProfile.user_metadata.organizations[0].id}`);
                    });
        
                    it('persists the changes to the editable fields', () => {
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                      cy.get('button#save-org').click();
                      cy.wait(300);
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                    });
        
                    it('hides the Cancel and Save buttons', () => {
                      cy.get('button#delete-org').should('not.exist');
                      cy.get('button#save-org').should('exist');
                      cy.get('button#cancel-org-changes').should('exist');
        
                      cy.get('button#save-org').click();
        
                      cy.get('button#delete-org').should('exist');
                      cy.get('button#save-org').should('not.exist');
                      cy.get('button#cancel-org-changes').should('not.exist');
                    });
        
                    it('changes the record in the organizer\'s user_metadata', () => {
                      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                        expect(results.length).to.eq(1);
                        expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                        expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
                        cy.get('button#save-org').click();
                        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                          expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                          expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The Regional Lacrosse Association');
                        });
                      });
                    });
        
                    it('displays a friendly message', () => {
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                      cy.get('button#save-org').click();
                      cy.wait(300);
                      cy.get('#flash-message').contains('Organization updated');
                    });
        
                    it('persists updated team data between browser refreshes', function() {
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                      cy.get('button#save-org').click();
                      cy.wait(300);
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                      cy.reload();
                      cy.wait(300);
                      cy.contains('The Regional Lacrosse Association').click();
                      cy.wait(300);
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                    });
                  });
                });
              });
            });
          });
        });
      });

      context('root is unaffiliated', () => {

        let organizer;
        beforeEach(function() {

          cy.login('commissioner@example.com', {..._profile, name: 'Nick Sakiewicz' }, [this.scope.create.organizations]);

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='commissioner@example.com' LIMIT 1;`).then(([results, metadata]) => {
            organizer = results[0];

            // The '123' role ID matches that defined in the RBAC mock server
            cy.request('POST', `https://localhost:3002/api/v2/users/${organizer.socialProfile.user_id}/roles`, { roles: ['123'] });

            // Make role assignment take effect
            cy.login('commissioner@example.com', {..._profile, name: 'Nick Sakiewicz' }, [this.scope.create.organizations]);
            cy.get('#organizations-table button span span').contains('add_box').click();
            cy.get('input[placeholder="Name"]').type('The National Lacrosse League');
            cy.get('#organizations-table button[title="Save"]').click();

            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='commissioner@example.com' LIMIT 1;`).then(([results, metadata]) => {
              organizer = results[0];
   
              cy.login(root.email, _profile);
            });
          });
        });

        describe('admin mode', () => {
          context('switched on', () => {
            beforeEach(() => {
              cy.get('#app-menu-button').click();
              cy.get('#admin-switch').check();
              cy.get('#app-menu').contains('Agent Directory').click();
              cy.wait(200);
              cy.contains(organizer.name).click();
              cy.wait(300);
              cy.contains('The National Lacrosse League').click();
              cy.wait(300);
            });

            describe('Editable', () => {
              describe('#org-name-field', () => {
                it('reveals Save and Cancel buttons on change', () => {
                  cy.get('button#delete-org').should('exist');
                  cy.get('button#save-org').should('not.exist');
                  cy.get('button#cancel-org-changes').should('not.exist');
        
                  cy.get('#org-name-field').type('!!!');
                  cy.get('#org-name-field').should('have.value', 'The National Lacrosse League!!!');
        
                  cy.get('button#delete-org').should('not.exist');
                  cy.get('button#save-org').should('exist');
                  cy.get('button#cancel-org-changes').should('exist');
                });
        
                describe('#cancel-team-update button', () => {
                  beforeEach(() => {
                    cy.get('#org-name-field').clear();
                    cy.get('#org-name-field').type('The Regional Lacrosse Association');
                  });
        
                  it('resets the changes to the editable fields', () => {
                    cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                    cy.get('button#cancel-org-changes').click();
                    cy.get('#org-name-field').should('have.value', 'The National Lacrosse League');
                  });
        
                  it('hides the Cancel and Save buttons', () => {
                    cy.get('button#delete-org').should('not.exist');
                    cy.get('button#save-org').should('exist');
                    cy.get('button#cancel-org-changes').should('exist');
        
                    cy.get('button#cancel-org-changes').click();
        
                    cy.get('button#delete-org').should('exist');
                    cy.get('button#save-org').should('not.exist');
                    cy.get('button#cancel-org-changes').should('not.exist');
                  });
        
                  it('does not change the record in the organizer\'s user_metadata', () => {
                    cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${organizer.email}' LIMIT 1;`).then(([results, metadata]) => {
                      expect(results.length).to.eq(1);
                      expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                      expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
                      cy.get('button#cancel-org-changes').click();
                      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${organizer.email}' LIMIT 1;`).then(([results, metadata]) => {
                        expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                        expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
                      });
                    });
                  });
                });
        
                describe('#save-org button', () => {
        
                  describe('is unsuccessful in making changes', () => {
        
                    describe('with invalid field', () => {
                      it('empty name field', () => {
                        cy.get('#org-name-field').clear();
                        cy.get('#org-name-field').should('have.value', '');
                        cy.get('button#save-org').click();
                        cy.wait(300);
                        cy.get('#flash-message').contains('Organization name can\'t be blank');
                      });
        
                      it('blank name field', () => {
                        cy.get('#org-name-field').clear();
                        cy.get('#org-name-field').type('     ');
                        cy.get('#org-name-field').should('have.value', '     ');
                        cy.get('button#save-org').click();
                        cy.wait(300);
                        cy.get('#flash-message').contains('Organization name can\'t be blank');
                      });
        
                      it('does not change the record in the organizer\'s user_metadata', () => {
                        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${organizer.email}' LIMIT 1;`).then(([results, metadata]) => {
                          expect(results.length).to.eq(1);
                          expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                          expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
        
                          cy.get('#org-name-field').clear();
                          cy.get('button#save-org').click();
        
                          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${organizer.email}' LIMIT 1;`).then(([results, metadata]) => {
                            expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                            expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
                          });
                        });
                      });
        
                      describe('duplicate organization name', () => {
        
                        it('displays friendly error message', () => {
                          cy.get('#org-name-field').clear();
                          cy.get('#org-name-field').type('The National Lacrosse League');
                          cy.get('button#save-org').click();
                          cy.wait(300);
                          cy.get('#flash-message').contains('That organization is already registered');
                          cy.get('#flash-message #close-flash').click();
        
                          // Make sure flash state resets
                          cy.get('button#save-org').click();
                          cy.wait(300);
                          cy.get('#flash-message').contains('That organization is already registered');
                        });
        
                        it('does not change the record in the team leader\'s user_metadata', () => {
                          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${organizer.email}' LIMIT 1;`).then(([results, metadata]) => {
                            expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                            expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
        
                            cy.get('#org-name-field').clear();
                            cy.get('#org-name-field').type('The National Lacrosse League');
                            cy.get('button#save-org').click();
        
                            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${organizer.email}' LIMIT 1;`).then(([results, metadata]) => {
                              expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                              expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
                            });
                          });
                        });
                      });
                    });
                  });
        
                  describe('successfully makes changes', () => {
                    beforeEach(() => {
                      cy.get('#org-name-field').clear();
                      cy.get('#org-name-field').type('The Regional Lacrosse Association');
                    });
        
                    it('lands in the proper place', () => {
                      cy.get('button#save-org').click();
                      cy.wait(300);
                      cy.url().should('contain', `/#/organization/${organizer.socialProfile.user_metadata.organizations[0].id}`);
                    });
        
                    it('persists the changes to the editable fields', () => {
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                      cy.get('button#save-org').click();
                      cy.wait(300);
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                    });
        
                    it('hides the Cancel and Save buttons', () => {
                      cy.get('button#delete-org').should('not.exist');
                      cy.get('button#save-org').should('exist');
                      cy.get('button#cancel-org-changes').should('exist');
        
                      cy.get('button#save-org').click();
        
                      cy.get('button#delete-org').should('exist');
                      cy.get('button#save-org').should('not.exist');
                      cy.get('button#cancel-org-changes').should('not.exist');
                    });
        
                    it('changes the record in the organizer\'s user_metadata', () => {
                      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${organizer.email}' LIMIT 1;`).then(([results, metadata]) => {
                        expect(results.length).to.eq(1);
                        expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                        expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The National Lacrosse League');
                        cy.get('button#save-org').click();
                        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${organizer.email}' LIMIT 1;`).then(([results, metadata]) => {
                          expect(results[0].socialProfile.user_metadata.organizations.length).to.eq(1);
                          expect(results[0].socialProfile.user_metadata.organizations[0].name).to.eq('The Regional Lacrosse Association');
                        });
                      });
                    });
        
                    it('displays a friendly message', () => {
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                      cy.get('button#save-org').click();
                      cy.wait(300);
                      cy.get('#flash-message').contains('Organization updated');
                    });
        
                    it('persists updated team data between browser refreshes', function() {
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                      cy.get('button#save-org').click();
                      cy.wait(300);
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                      cy.reload();
                      cy.wait(300);
                      cy.get('#app-menu-button').click();
                      cy.get('#admin-switch').check();
                      cy.get('#app-menu').contains('Agent Directory').click();
                      cy.wait(200);
                      cy.contains(organizer.name).click();
                      cy.wait(300);
                      cy.contains('The Regional Lacrosse Association').click();
                      cy.wait(300);
                      cy.get('#org-name-field').should('have.value', 'The Regional Lacrosse Association');
                    });
                  });
                });
              });
            });
          });

          context('switched off', () => {
            beforeEach(() => {
              cy.get('#app-menu-button').click();
              cy.wait(200);
              cy.get('#admin-switch').uncheck();
              cy.get('#app-menu').contains('Profile').click();
              cy.wait(200);
              cy.visit(`/#/organization/${organizer.socialProfile.user_metadata.organizations[0].id}`);
            });

            it('displays the correct UI components', () => {
              cy.get('button#delete-org').should('not.exist');
              cy.get('button#save-org').should('not.exist');
              cy.get('button#cancel-org-changes').should('not.exist');
              cy.get('#org-name-field').should('be.disabled');
            });
          });
        });
      });

//      describe('member agents', () => {
//
//        let memberAgent;
//        describe('has accepted invitation', () => {
//          beforeEach(function() {
//            // Team leader logged in, adds user
//            cy.get('#members-table button span span').contains('add_box').click();
//            cy.get('#members-table [placeholder="Email"]').type('someotherguy@example.com');
//            cy.get('#members-table button[title="Save"]').click();
//
//            // Invited member logs in...
//            cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy'});
//
//            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
//              memberAgent = results[0];
//
//              // ... accepts the invitation
//              cy.get('#rsvps-table table tbody tr td button span').contains('check').click();
//
//              // Refresh agent model to get `socialProfile`
//              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
//                agent = results[0];
//
//                // Team leader logs in again...
//                cy.login(agent.email, _profile);
//
//                // ... and views the team
//                cy.contains('The A-Team').click();
//                cy.wait(300);
//
//                // Change team name
//                cy.get('#team-name-field').clear();
//                cy.get('#team-name-field').type('The K-Team');
//                cy.get('button#save-team').click();
//                cy.wait(300);
//              });
//            });
//          });
//
//          it('updates team name', function() {
//            // Invited member logs in...
//            cy.login(memberAgent.email, {..._profile, name: memberAgent.name});
//
//            cy.get('#rsvps-table').should('not.exist');
//            cy.get('#teams-table table tbody').find('tr').its('length').should('eq', 1);
//            cy.get('#teams-table table tbody tr td').contains('The K-Team');
//          });
//        });
//
//        describe('invited agent is unknown', () => {
//          describe('has not accepted the invitation', () => {
//            beforeEach(function() {
//              // Team leader adds user
//              cy.get('#members-table button span span').contains('add_box').click();
//              cy.get('#members-table [placeholder="Email"]').type('someotherguy@example.com');
//              cy.get('#members-table button[title="Save"]').click();
//
//              // ... changes team name
//              cy.get('#team-name-field').clear();
//              cy.get('#team-name-field').type('The K-Team');
//              cy.get('button#save-team').click();
//              cy.wait(300);
//
//              // Invited member logs in...
//              cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy'});
//            });
//
//            it('updates pending rsvp', function() {
//              cy.get('#teams-table').contains('No records to display');
//              cy.get('#rsvps-table table tbody').find('tr').its('length').should('eq', 1);
//              cy.get('#rsvps-table table tbody tr td').contains('The K-Team');
//            });
//          });
//        });
//
//        describe('invited agent is known', () => {
//
//          beforeEach(function() {
//            // Invited member logs in, and in does so, creates an account...
//            cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy'});
//
//            // Team leader logs in and...
//            cy.login(_profile.email, _profile);
//
//            // ... views the team
//            cy.contains('The A-Team').click();
//            cy.wait(300);
//
//            // ... adds user
//            cy.get('#members-table button span span').contains('add_box').click();
//            cy.get('#members-table [placeholder="Email"]').type('someotherguy@example.com');
//            cy.get('#members-table button[title="Save"]').click();
//
//            // Change team name
//            cy.get('#team-name-field').clear();
//            cy.get('#team-name-field').type('The K-Team');
//            cy.get('button#save-team').click();
//            cy.wait(300);
//
//            // Invited member logs back in
//            cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy'});
//          });
//
//          describe('has not accepted the invitation', () => {
//            it('updates pending rsvp', function() {
//              cy.get('#teams-table').contains('No records to display');
//              cy.get('#rsvps-table table tbody').find('tr').its('length').should('eq', 1);
//              cy.get('#rsvps-table table tbody tr td').contains('The K-Team');
//            });
//          });
//        });
//      });
    });
  });
});

export {}
