app_src = src/silid-server
client_src = src/identity-react


# General setup
install:
	cd $(app_src); npm install \
		&& install -bm 0644 .env.example .env
	cd $(client_src); npm install \
		&& install -bm 0644 .env.example .env

clean:
	rm -rf $(app_src)/node_modules/*
	rm -rf $(client_src)/node_modules/*
	rm -f $(app_src)/.env
	rm -f $(client_src)/.env


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


# Execute silid platform end-to-end tests
silid-e2e-open:
	cd $(client_src); npx cypress	open

silid-e2e-headless:
	cd $(client_src); npm run test:headless
