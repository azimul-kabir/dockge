import fs, { promises as fsAsync } from "fs";
import path from "path";
import crypto from "crypto";

const HISTORY_DIR = ".dockge-history";
const MAX_REVISIONS = 20;

export interface ConfigRevisionSummary {
    id: string;
    createdAt: string;
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
