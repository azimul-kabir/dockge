import assert from "node:assert/strict";
import test from "node:test";
import { buildConfigRevisionSummaries, countLineChanges } from "./config-history";
import type { ConfigRevision } from "./config-history";

const cases = [
    ["identical contents", "one\ntwo\n", "one\ntwo\n", 0, 0],
    ["one added line", "one\n", "one\ntwo\n", 1, 0],
    ["one removed line", "one\ntwo\n", "one\n", 0, 1],
    ["replacement line", "one\n", "two\n", 1, 1],
    ["multiple additions and deletions", "one\ntwo\nthree\n", "zero\ntwo\nfour\nfive\n", 3, 2],
    ["empty to non-empty", "", "one\ntwo\n", 2, 0],
    ["non-empty to empty", "one\ntwo\n", "", 0, 2],
] as const;

for (const [name, before, after, additions, deletions] of cases) {
    test(name, () => {
        assert.deepEqual(countLineChanges(before, after), { additions, deletions });
    });
}

test("summaries compare each revision with what followed it without exposing contents", () => {
    const revision = (id: string, value: string): ConfigRevision => ({
        id,
        createdAt: id,
        composeYAML: value,
        composeENV: `SECRET=${value}`,
        composeOverrideYAML: value,
    });
    const revisions = [revision("B", "one\ntwo"), revision("A", "one")];
    const summaries = buildConfigRevisionSummaries(revisions, {
        composeYAML: "one\ntwo\nthree",
        composeENV: "SECRET=c",
        composeOverrideYAML: "one\ntwo\nthree",
    });

    assert.deepEqual(summaries.map(summary => [summary.id, summary.changes?.compose]), [
        ["B", { additions: 1, deletions: 0 }],
        ["A", { additions: 1, deletions: 0 }],
    ]);
    assert.equal(JSON.stringify(summaries).includes("SECRET"), false);
    assert.equal(JSON.stringify(summaries).includes("SECRET=c"), false);
});
