SHELL := /bin/sh
.SHELLFLAGS := -eu -c
.ONESHELL:

IDLE_DIR    ?= vendors/Open-RSC/IdleRSC
BRIDGE_SRC  ?= bridge
# Java source roots are compiled recursively by Gradle. Keep the generated
# link outside the upstream package directories; bridge sources retain their
# normal package-relative layout beneath it.
BRIDGE_LINK ?= $(IDLE_DIR)/app/src/main/java/idlersc_bridge
JAR         ?= $(IDLE_DIR)/IdleRSC.jar
BRIDGE_HOST ?= 127.0.0.1
BRIDGE_PORT ?= 8765
JAVA_PACKAGE ?= openjdk-8-jdk
GRADLE_USER_HOME ?= $(CURDIR)/.gradle
ENV_FILE ?= .env
IDLE_SCRIPT ?=

SUBMODULE_HEAD := $(IDLE_DIR)/.git
SUBMODULE_GIT_DIR := $(shell git -C "$(IDLE_DIR)" rev-parse --git-dir 2>/dev/null)
JAVA_SOURCE   := $(IDLE_DIR)/app/src/main/java
GRADLEW       := $(IDLE_DIR)/gradlew
EXCLUDE_FILE  := $(SUBMODULE_GIT_DIR)/info/exclude

.DEFAULT_GOAL := help

.PHONY: help check install-jdk setup build run test-bridge test-js clean-link

help: ## Show available root-project commands
	@awk 'BEGIN {FS = ":.*##"; print "Usage: make <target>"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

check: ## Validate the Java, submodule, Gradle, and bridge paths
	@test -f "$(SUBMODULE_HEAD)" || { echo "ERROR: IdleRSC submodule is missing or uninitialized: $(IDLE_DIR)" >&2; echo "Run: git submodule update --init --recursive" >&2; exit 1; }
	@test -x "$(GRADLEW)" || { echo "ERROR: Gradle wrapper is missing or not executable: $(GRADLEW)" >&2; exit 1; }
	test -d "$(JAVA_SOURCE)" || { echo "ERROR: IdleRSC Java source root not found: $(JAVA_SOURCE)" >&2; exit 1; }
	command -v java >/dev/null 2>&1 || { echo "ERROR: java is not on PATH" >&2; exit 1; }
	command -v javac >/dev/null 2>&1 || { echo "ERROR: javac is not on PATH; install/select a Java 8 JDK" >&2; exit 1; }
	java_version=$$(java -version 2>&1 | awk -F '"' '/version/ {print $$2; exit}')
	case "$$java_version" in 1.8.*) ;; *) echo "ERROR: IdleRSC requires Java 8; found $$java_version" >&2; exit 1;; esac
	javac_version=$$(javac -version 2>&1 | awk '{print $$2}')
	echo "Java runtime: $$java_version"
	echo "Java compiler: $$javac_version"
	echo "IdleRSC: $(IDLE_DIR)"
	echo "Bridge source: $(BRIDGE_SRC)"
	echo "Bridge link: $(BRIDGE_LINK)"
	if test -L "$(BRIDGE_LINK)"; then echo "Bridge link state: present"; else echo "Bridge link state: absent"; fi

install-jdk: ## Install the required Java 8 JDK when javac is missing
	@if command -v javac >/dev/null 2>&1; then \
		echo "Java compiler already installed: $$(javac -version 2>&1)"; \
	elif command -v apt-get >/dev/null 2>&1; then \
		echo "Installing $(JAVA_PACKAGE) because javac is missing..."; \
		if test "$$(id -u)" -eq 0; then \
			apt-get update && apt-get install --yes "$(JAVA_PACKAGE)"; \
		elif command -v sudo >/dev/null 2>&1; then \
			sudo apt-get update && sudo apt-get install --yes "$(JAVA_PACKAGE)"; \
		else \
			echo "ERROR: sudo is required to install $(JAVA_PACKAGE)" >&2; exit 1; \
		fi; \
	else \
		echo "ERROR: javac is missing and no supported package manager was found." >&2; \
		echo "Install a Java 8 JDK manually, then rerun make setup." >&2; exit 1; \
	fi

setup: install-jdk ## Validate the checkout and create the local bridge symlink
	@mkdir -p "$(BRIDGE_SRC)"
	@$(MAKE) --no-print-directory check BRIDGE_SRC="$(BRIDGE_SRC)"
	@if test -e "$(BRIDGE_LINK)" && ! test -L "$(BRIDGE_LINK)"; then \
		echo "ERROR: refusing to replace non-symlink at $(BRIDGE_LINK)" >&2; exit 1; \
	fi
	@mkdir -p "$$(dirname "$(BRIDGE_LINK)")"
	@if test -L "$(BRIDGE_LINK)"; then \
		test "$$(readlink "$(BRIDGE_LINK)")" = "$$(realpath --relative-to="$$(dirname "$(BRIDGE_LINK)")" "$(BRIDGE_SRC)")" || { \
			echo "ERROR: existing bridge symlink points somewhere else: $(BRIDGE_LINK)" >&2; exit 1; \
		}; \
	else \
		ln -s "$$(realpath --relative-to="$$(dirname "$(BRIDGE_LINK)")" "$(BRIDGE_SRC)")" "$(BRIDGE_LINK)"; \
	fi
	@mkdir -p "$$(dirname "$(EXCLUDE_FILE)")"
	@if ! grep -Fqx 'app/src/main/java/idlersc_bridge' "$(EXCLUDE_FILE)" 2>/dev/null; then \
		echo 'app/src/main/java/idlersc_bridge' >> "$(EXCLUDE_FILE)" || \
		echo "WARNING: could not update local submodule exclude: $(EXCLUDE_FILE)" >&2; \
	fi
	@echo "Bridge setup complete: $(BRIDGE_LINK)"

build: ## Set up the bridge and build IdleRSC through its root Makefile
	@$(MAKE) --no-print-directory setup
	@GRADLE_USER_HOME="$(GRADLE_USER_HOME)" $(MAKE) --no-print-directory -C "$(IDLE_DIR)" build
	@test -f "$(JAR)" || { echo "ERROR: expected runnable JAR was not created: $(JAR)" >&2; exit 1; }

run: ## Build and run IdleRSC.jar
	@$(MAKE) --no-print-directory build
	@test -f "$(ENV_FILE)" || { echo "ERROR: credentials file not found: $(ENV_FILE)" >&2; exit 1; }
	@set -a
	@. "$(ENV_FILE)"
	@set +a
	@test -n "$${IDLE_USERNAME:-}" || { echo "ERROR: IDLE_USERNAME is missing from $(ENV_FILE)" >&2; exit 1; }
	@test -n "$${IDLE_PASSWORD:-}" || { echo "ERROR: IDLE_PASSWORD is missing from $(ENV_FILE)" >&2; exit 1; }
	@idle_server="$${IDLE_SERVER:-uranium}"
	@case "$$idle_server" in uranium|coleslaw) ;; *) echo "ERROR: IDLE_SERVER must be uranium or coleslaw" >&2; exit 1;; esac
	@idle_script="$(IDLE_SCRIPT)"
	@if test -z "$$idle_script"; then idle_script="$${IDLE_SCRIPT:-}"; fi
	@idle_debug="$${IDLE_DEBUG:-false}"
	@idle_log_window="$${IDLE_LOG_WINDOW:-false}"
	@mkdir -p accounts
	@account_file="$$(mktemp "$(CURDIR)/accounts/.idlersc-bridge.XXXXXX.properties")"
	@account_name="$$(basename "$$account_file" .properties)"
	@trap 'rm -f "$$account_file"' EXIT INT TERM
	@printf '%s\n' \
		"account-name=$$IDLE_USERNAME" \
		"account-password=$$IDLE_PASSWORD" \
		"account-server-option-address=game.openrsc.com" \
		"account-server-option-port=$$idle_server" \
		"auto-login=true" \
		"debug=$$idle_debug" \
		"log-window=$$idle_log_window" \
		"script-name=$$idle_script" \
		"theme-selected=RuneDark" \
		> "$$account_file"
	@java -jar "$(JAR)" --auto-start --account "$$account_name"

test-bridge: ## Send a one-frame echo request to the running bridge server
	@command -v nc >/dev/null 2>&1 || { echo "ERROR: nc is required for test-bridge" >&2; exit 1; }
	@printf '%s\n' '{"op":"ping"}' | nc -w 3 "$(BRIDGE_HOST)" "$(BRIDGE_PORT)" | \
		rg -Fx '{"op":"ping"}' || { echo "ERROR: no matching echo response from $(BRIDGE_HOST):$(BRIDGE_PORT)" >&2; exit 1; }
	@echo "Bridge echo test passed on $(BRIDGE_HOST):$(BRIDGE_PORT)"

test-js: ## Run a small Nashorn JavaScript smoke test through the running bridge
	@command -v nc >/dev/null 2>&1 || { echo "ERROR: nc is required for test-js" >&2; exit 1; }
	@source_b64="$$(printf '%s' 'console.log("js-smoke-test"); 1 + 1;' | base64 -w 0)"; \
		printf '{"op":"run","source_b64":"%s"}\n' "$$source_b64" | nc -w 5 "$(BRIDGE_HOST)" "$(BRIDGE_PORT)" | \
		rg -F '"ok":true' || { echo "ERROR: JavaScript smoke test failed on $(BRIDGE_HOST):$(BRIDGE_PORT)" >&2; exit 1; }
	@echo "JavaScript smoke test passed on $(BRIDGE_HOST):$(BRIDGE_PORT)"

clean-link: ## Remove only the generated bridge symlink
	@if test -L "$(BRIDGE_LINK)"; then rm "$(BRIDGE_LINK)"; echo "Removed $(BRIDGE_LINK)"; else echo "No generated bridge symlink at $(BRIDGE_LINK)"; fi
