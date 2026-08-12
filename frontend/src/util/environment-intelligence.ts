export interface EnvironmentVariableStatus {
    name: string;
    source: "stack" | "undefined";
    used: boolean;
}

const COMPOSE_VARIABLE_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?:(?::?[-+?])[^}]*)?\}/g;

export function collectComposeVariableNames(composeYAML: string): string[] {
    const names = new Set<string>();
    let match: RegExpExecArray | null;

    COMPOSE_VARIABLE_PATTERN.lastIndex = 0;
    while ((match = COMPOSE_VARIABLE_PATTERN.exec(composeYAML)) !== null) {
        names.add(match[1]);
    }

    return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export function buildEnvironmentVariableStatuses(
    composeYAML: string,
    stackEnvironment: Record<string, string>
): EnvironmentVariableStatus[] {
    const referencedNames = new Set(collectComposeVariableNames(composeYAML));
    const allNames = new Set([...referencedNames, ...Object.keys(stackEnvironment)]);

    return Array.from(allNames)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({
            name,
            source: Object.prototype.hasOwnProperty.call(stackEnvironment, name) ? "stack" : "undefined",
            used: referencedNames.has(name),
        }));
}
