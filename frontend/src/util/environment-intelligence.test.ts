import assert from "node:assert/strict";
import {
    buildEnvironmentVariableStatuses,
    composeUsesEnvFile,
} from "./environment-intelligence";

const statuses = buildEnvironmentVariableStatuses(
    "services:\n  app:\n    environment:\n      PUID: ${PUID}\n      API_KEY: ${API_KEY}\n",
    {
        PUID: "1000",
        OLD_VALUE: "secret-value",
    }
);

assert.deepEqual(statuses, [
    {
        name: "API_KEY",
        status: "not-in-stack",
    },
    {
        name: "OLD_VALUE",
        status: "not-referenced",
    },
    {
        name: "PUID",
        status: "defined",
    },
]);
assert.equal(JSON.stringify(statuses).includes("secret-value"), false);

assert.equal(composeUsesEnvFile("services:\n  app:\n    env_file: .env\n"), true);
assert.equal(composeUsesEnvFile("services:\n  app:\n    env_file:\n      - .env\n"), true);
assert.equal(composeUsesEnvFile("services:\n  app:\n    image: example/app\n"), false);
