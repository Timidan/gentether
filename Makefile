.PHONY: install test build run demo hydra

install:
	npm install --no-audit --no-fund

test:
	npm test

build:
	npm run build

run:
	npm run build && npm start

demo:
	npm run demo

hydra:
	./scripts/start-hydra.sh
