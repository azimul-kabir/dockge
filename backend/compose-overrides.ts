import fs from "fs";
import path from "path";

export const COMPOSE_OVERRIDE_FILENAMES = [
    "compose.override.yaml",
    "compose.override.yml",
    "docker-compose.override.yaml",
    "docker-compose.override.yml",
];

export function findComposeOverrideFile(dir: string): string | null {
    for (const filename of COMPOSE_OVERRIDE_FILENAMES) {
        if (fs.existsSync(path.join(dir, filename))) {
            return filename;
        }
    }
    return null;
}
