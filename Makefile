app_src = src/silid-server
client_src = src/identity-react


# General setup
install:
	cd $(app_src); npm install \
		&& install -bm 0644 .env.example .env
	cd $(client_src); npm install

clean:
	rm -rf $(app_src)/node_modules/*
	rm -rf $(client_src)/node_modules/*
	rm -f $(app_src)/.env


# Manage only silid-server unit test containers
silid-unit-test:
	cd $(app_src); docker-compose up -d --build test-app-db \
		&& docker-compose up --build test-app
	cd $(app_src); docker-compose down


# Manage all silid platform containers
silid-compose-build-up:
	cd src/; docker-compose up --build

silid-compose-up:
	cd src/; docker-compose up

silid-compose-down:
	cd src/; docker-compose down

# the following commands can be used after containers are running
silid-compose-rebuild:
	cd src/; docker-compose up --build app
	cd src/; docker-compose up --build client

silid-compose-rebuild-app:
	cd src/; docker-compose up --build app

silid-compose-rebuild-client:
	cd src/; docker-compose up --build client

silid-compose-restart:
	cd src/; docker-compose restart app
	cd src/; docker-compose restart client

silid-compose-restart-app:
	cd src/; docker-compose restart app

silid-compose-restart-client:
	cd src/; docker-compose restart client


#
# Execute silid platform end-to-end tests
#
silid-e2e-open:
	cd $(client_src); npx cypress	open

#
# Execute all tests
#
# 2020-7-31 Don't use `cypress open` for this (i.e., `silid-e2e-open`)
#
# https://github.com/cypress-io/cypress/issues/2028#issuecomment-400356563
#
silid-e2e-run:
	cd $(client_src); npx cypress	run --headed

#
# This executes a containerized headless run
#
# 2020-8-5
#   The original _headless_ command looked like this:
#       cd $(client_src); npm run test:headless
#   That found below is the recommend way to run headless tests (I think)
#
silid-e2e-headless:
	cd $(client_src); npx cypress	run
