import fs, { promises as fsAsync } from "fs";
import path from "path";
import crypto from "crypto";

const HISTORY_DIR = ".dockge-history";
const MAX_REVISIONS = 20;

export interface ConfigRevisionSummary {
    id: string;
    createdAt: string;
    changes?: ConfigChangeSummary;
}

export interface LineChangeCount {
    additions: number;
    deletions: number;
}

export interface ConfigChangeSummary {
    compose: LineChangeCount;
    env: LineChangeCount;
    override: LineChangeCount;
}

export interface ConfigRevision extends ConfigRevisionSummary {
    composeYAML: string;
    composeENV: string;
    composeOverrideYAML: string;
}

function getHistoryDir(stackDir: string) {
    return path.join(stackDir, HISTORY_DIR);
}

function revisionHash(composeYAML: string, composeENV: string, composeOverrideYAML: string) {
    return crypto.createHash("sha256")
        .update(composeYAML)
        .update("\0")
        .update(composeENV)
        .update("\0")
        .update(composeOverrideYAML)
        .digest("hex");
}

function lines(content: string): string[] {
    if (content === "") {
        return [];
    }
    const result = content.split("\n");
    if (result[result.length - 1] === "") {
        result.pop();
    }
    return result;
}

export function countLineChanges(before: string, after: string): LineChangeCount {
    const beforeLines = lines(before);
    const afterLines = lines(after);
    const previous = new Array(afterLines.length + 1).fill(0);

    for (const beforeLine of beforeLines) {
        let diagonal = 0;
        for (let j = 1; j <= afterLines.length; j++) {
            const above = previous[j];
            if (beforeLine === afterLines[j - 1]) {
                previous[j] = diagonal + 1;
            } else {
                previous[j] = Math.max(previous[j], previous[j - 1]);
            }
            diagonal = above;
        }
    }

    const unchanged = previous[afterLines.length];
    return {
        additions: afterLines.length - unchanged,
        deletions: beforeLines.length - unchanged,
    };
}

function compareConfigs(before: ConfigRevision, after: ConfigRevision): ConfigChangeSummary {
    return {
        compose: countLineChanges(before.composeYAML, after.composeYAML),
        env: countLineChanges(before.composeENV, after.composeENV),
        override: countLineChanges(before.composeOverrideYAML, after.composeOverrideYAML),
    };
}

export async function listConfigRevisionsWithChanges(stackDir: string, current: Omit<ConfigRevision, "id" | "createdAt">): Promise<ConfigRevisionSummary[]> {
    const summaries = await listConfigRevisions(stackDir);
    const revisions = (await Promise.all(summaries.map(revision => getConfigRevision(stackDir, revision.id))))
        .filter((revision): revision is ConfigRevision => revision !== null);

    return buildConfigRevisionSummaries(revisions, current);
}

export function buildConfigRevisionSummaries(revisions: ConfigRevision[], current: Omit<ConfigRevision, "id" | "createdAt">): ConfigRevisionSummary[] {
    return revisions.map((revision, index) => {
        const newer = index === 0 ? { ...current, id: "current", createdAt: "" } : revisions[index - 1];
        return {
            id: revision.id,
            createdAt: revision.createdAt,
            changes: compareConfigs(revision, newer),
        };
    });
}

export async function createConfigRevision(stackDir: string, composeYAML: string, composeENV: string, composeOverrideYAML: string) {
    const historyDir = getHistoryDir(stackDir);
    await fsAsync.mkdir(historyDir, { recursive: true });

    const existing = (await listConfigRevisions(stackDir))[0];
    if (existing) {
        const previous = await getConfigRevision(stackDir, existing.id);
        if (previous && revisionHash(previous.composeYAML, previous.composeENV, previous.composeOverrideYAML) === revisionHash(composeYAML, composeENV, composeOverrideYAML)) {
            return;
        }
    }

    const now = new Date();
    const id = now.toISOString().replace(/[:.]/g, "-");
    const revisionDir = path.join(historyDir, id);
    await fsAsync.mkdir(revisionDir, { recursive: true });
    await fsAsync.writeFile(path.join(revisionDir, "compose.yml"), composeYAML);
    await fsAsync.writeFile(path.join(revisionDir, ".env"), composeENV);
    await fsAsync.writeFile(path.join(revisionDir, "compose.override.yml"), composeOverrideYAML);
    await fsAsync.writeFile(path.join(revisionDir, "meta.json"), JSON.stringify({ id, createdAt: now.toISOString() }));

    const revisions = await listConfigRevisions(stackDir);
    for (const revision of revisions.slice(MAX_REVISIONS)) {
        await fsAsync.rm(path.join(historyDir, revision.id), { recursive: true, force: true });
    }
}

export async function listConfigRevisions(stackDir: string): Promise<ConfigRevisionSummary[]> {
    const historyDir = getHistoryDir(stackDir);
    if (!fs.existsSync(historyDir)) {
        return [];
    }

    const names = await fsAsync.readdir(historyDir);
    const revisions: ConfigRevisionSummary[] = [];
    for (const name of names) {
        try {
            const meta = JSON.parse(await fsAsync.readFile(path.join(historyDir, name, "meta.json"), "utf-8"));
            if (typeof meta.id === "string" && typeof meta.createdAt === "string") {
                revisions.push(meta);
            }
        } catch (e) {
            // Ignore incomplete/corrupt history entries.
        }
    }
    return revisions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getConfigRevision(stackDir: string, id: string): Promise<ConfigRevision | null> {
    if (!/^[0-9TZ-]+$/.test(id)) {
        return null;
    }
    const revisionDir = path.join(getHistoryDir(stackDir), id);
    try {
        const meta = JSON.parse(await fsAsync.readFile(path.join(revisionDir, "meta.json"), "utf-8"));
        return {
            id: meta.id,
            createdAt: meta.createdAt,
            composeYAML: await fsAsync.readFile(path.join(revisionDir, "compose.yml"), "utf-8"),
            composeENV: await fsAsync.readFile(path.join(revisionDir, ".env"), "utf-8"),
            composeOverrideYAML: await fsAsync.readFile(path.join(revisionDir, "compose.override.yml"), "utf-8"),
        };
    } catch (e) {
        return null;
    }
}
