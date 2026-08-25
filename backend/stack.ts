import { DockgeServer } from "./dockge-server";
import fs, { promises as fsAsync } from "fs";
import { log } from "./log";
import yaml from "yaml";
import { DockgeSocket, fileExists, ValidationError } from "./util-server";
import path from "path";
import {
    acceptedComposeFileNames,
    COMBINED_TERMINAL_COLS,
    COMBINED_TERMINAL_ROWS,
    CREATED_FILE,
    CREATED_STACK,
    EXITED, getCombinedTerminalName,
    getComposeTerminalName, getContainerExecTerminalName,
    PROGRESS_TERMINAL_ROWS,
    RUNNING, TERMINAL_ROWS,
    UNKNOWN
} from "../common/util-common";
import { InteractiveTerminal, Terminal } from "./terminal";
import childProcessAsync from "promisify-child-process";
import { Settings } from "./settings";
import { findComposeOverrideFile } from "./compose-overrides";
import { createConfigRevision } from "./config-history";

export interface ImageUpdateStatus {
    image: string;
    updateAvailable: boolean;
}

export class Stack {

    name: string;
    protected _status: number = UNKNOWN;
    protected _composeYAML?: string;
    protected _composeENV?: string;
    protected _composeOverrideYAML?: string;
    protected _configFilePath?: string;
    protected _composeFileName: string = "compose.yaml";
    protected _composeOverrideFileName: string = "compose.override.yaml";
    protected server: DockgeServer;

    protected combinedTerminal? : Terminal;

    protected static managedStackList: Map<string, Stack> = new Map();

    constructor(server : DockgeServer, name : string, composeYAML? : string, composeENV? : string, composeOverrideYAML? : string, skipFSOperations = false) {
        this.name = name;
        this.server = server;
        this._composeYAML = composeYAML;
        this._composeENV = composeENV;
        this._composeOverrideYAML = composeOverrideYAML;

        if (!skipFSOperations) {
            // Check if compose file name is different from compose.yaml
            for (const filename of acceptedComposeFileNames) {
                if (fs.existsSync(path.join(this.path, filename))) {
                    this._composeFileName = filename;
                    break;
                }
            }

            const overrideFilename = findComposeOverrideFile(this.path);
            if (overrideFilename) {
                this._composeOverrideFileName = overrideFilename;
            }
        }
    }

    async toJSON(endpoint : string) : Promise<object> {

        // Since we have multiple agents now, embed primary hostname in the stack object too.
        let primaryHostname = await Settings.get("primaryHostname");
        if (!primaryHostname) {
            if (!endpoint) {
                primaryHostname = "localhost";
            } else {
                // Use the endpoint as the primary hostname
                try {
                    primaryHostname = (new URL("https://" + endpoint).hostname);
                } catch (e) {
                    // Just in case if the endpoint is in a incorrect format
                    primaryHostname = "localhost";
                }
            }
        }

        let obj = this.toSimpleJSON(endpoint);
        return {
            ...obj,
            composeYAML: this.composeYAML,
            composeENV: this.composeENV,
            composeOverrideYAML: this.composeOverrideYAML,
            composeOverrideExists: findComposeOverrideFile(this.path) !== null,
            composeOverrideFileName: this._composeOverrideFileName,
            primaryHostname,
        };
    }

    toSimpleJSON(endpoint : string) : object {
        return {
            name: this.name,
            status: this._status,
            tags: [],
            isManagedByDockge: this.isManagedByDockge,
            composeFileName: this._composeFileName,
            endpoint,
        };
    }

    /**
     * Get the status of the stack from `docker compose ps --format json`
     */
    async ps() : Promise<object> {
        let res = await childProcessAsync.spawn("docker", this.getComposeOptions("ps", "--format", "json"), {
            cwd: this.path,
            encoding: "utf-8",
        });
        if (!res.stdout) {
            return {};
        }
        return JSON.parse(res.stdout.toString());
    }

    /**
     * Compare images used by running services with the images currently tagged
     * in the local Docker daemon. This method never contacts a registry.
     */
    async getImageUpdateStatus() : Promise<Record<string, ImageUpdateStatus>> {
        const status : Record<string, ImageUpdateStatus> = {};
        let config : { services?: Record<string, { image?: string }> };

        try {
            const result = await childProcessAsync.spawn("docker", this.getComposeOptions("config", "--format", "json"), {
                cwd: this.path,
                encoding: "utf-8",
            });
            config = JSON.parse(result.stdout?.toString() || "{}");
        } catch (e) {
            log.warn("imageUpdateStatus", `Unable to resolve Compose config for ${this.name}: ${e}`);
            return status;
        }

        for (const [ serviceName, service ] of Object.entries(config.services || {})) {
            if (!service.image) {
                continue;
            }

            status[serviceName] = {
                image: service.image,
                updateAvailable: false,
            };

            try {
                const containerResult = await childProcessAsync.spawn("docker", this.getComposeOptions("ps", "-q", serviceName), {
                    cwd: this.path,
                    encoding: "utf-8",
                });
                const containerIDs = (containerResult.stdout?.toString() || "").trim().split(/\s+/).filter(Boolean);
                if (containerIDs.length === 0) {
                    continue;
                }

                const imageResult = await childProcessAsync.spawn("docker", [ "image", "inspect", "--format", "{{.Id}}", service.image ], {
                    encoding: "utf-8",
                });
                const localImageID = imageResult.stdout?.toString().trim();
                if (!localImageID) {
                    continue;
                }

                for (const containerID of containerIDs) {
                    const runningResult = await childProcessAsync.spawn("docker", [ "inspect", "--format", "{{.State.Running}} {{.Image}}", containerID ], {
                        encoding: "utf-8",
                    });
                    const [ running, runningImageID ] = (runningResult.stdout?.toString() || "").trim().split(/\s+/, 2);
                    if (running === "true" && runningImageID && runningImageID !== localImageID) {
                        status[serviceName].updateAvailable = true;
                        break;
                    }
                }
            } catch (e) {
                log.debug("imageUpdateStatus", `Unable to inspect ${this.name}/${serviceName}: ${e}`);
            }
        }

        return status;
    }

    get isManagedByDockge() : boolean {
        return fs.existsSync(this.path) && fs.statSync(this.path).isDirectory();
    }

    get status() : number {
        return this._status;
    }

    validate() {
        // Check name, allows [a-z][0-9] _ - only
        if (!this.name.match(/^[a-z0-9_-]+$/)) {
            throw new ValidationError("Stack name can only contain [a-z][0-9] _ - only");
        }

        // Check YAML format
        yaml.parse(this.composeYAML);

        if (this.composeOverrideYAML.trim() !== "") {
            yaml.parse(this.composeOverrideYAML);
        }

        let lines = this.composeENV.split("\n");

        // Check if the .env is able to pass docker-compose
        // Prevent "setenv: The parameter is incorrect"
        // It only happens when there is one line and it doesn't contain "="
        if (lines.length === 1 && !lines[0].includes("=") && lines[0].length > 0) {
            throw new ValidationError("Invalid .env format");
        }
    }

    get composeYAML() : string {
        if (this._composeYAML === undefined) {
            try {
                this._composeYAML = fs.readFileSync(path.join(this.path, this._composeFileName), "utf-8");
            } catch (e) {
                this._composeYAML = "";
            }
        }
        return this._composeYAML;
    }

    get composeENV() : string {
        if (this._composeENV === undefined) {
            try {
                this._composeENV = fs.readFileSync(path.join(this.path, ".env"), "utf-8");
            } catch (e) {
                this._composeENV = "";
            }
        }
        return this._composeENV;
    }

    get composeOverrideYAML() : string {
        if (this._composeOverrideYAML === undefined) {
            try {
                this._composeOverrideYAML = fs.readFileSync(path.join(this.path, this._composeOverrideFileName), "utf-8");
            } catch (e) {
                this._composeOverrideYAML = "";
            }
        }
        return this._composeOverrideYAML;
    }

    get path() : string {
        return path.join(this.server.stacksDir, this.name);
    }

    get fullPath() : string {
        let dir = this.path;

        // Compose up via node-pty
        let fullPathDir;

        // if dir is relative, make it absolute
        if (!path.isAbsolute(dir)) {
            fullPathDir = path.join(process.cwd(), dir);
        } else {
            fullPathDir = dir;
        }
        return fullPathDir;
    }

    /**
     * Save the stack to the disk
     * @param isAdd
     */
    async save(isAdd : boolean) {
        this.validate();

        let dir = this.path;

        // Check if the name is used if isAdd
        if (isAdd) {
            if (await fileExists(dir)) {
                throw new ValidationError("Stack name already exists");
            }

            // Create the stack folder
            await fsAsync.mkdir(dir);
        } else {
            if (!await fileExists(dir)) {
                throw new ValidationError("Stack not found");
            }

            // Preserve the current on-disk configuration before replacing it.
            const currentStack = new Stack(this.server, this.name);
            await createConfigRevision(dir, currentStack.composeYAML, currentStack.composeENV, currentStack.composeOverrideYAML);
        }

        // Write or overwrite the compose.yaml
        fs.writeFileSync(path.join(dir, this._composeFileName), this.composeYAML);

        const envPath = path.join(dir, ".env");
        const shouldWriteEnv = await fileExists(envPath) || this.composeENV.trim() !== "";

        // Write or overwrite the .env
        // If .env does not exist and composeENV is empty, we do not need to create it
        if (shouldWriteEnv) {
            fs.writeFileSync(envPath, this.composeENV);
        }

        const overridePath = path.join(dir, this._composeOverrideFileName);
        const shouldWriteOverride = await fileExists(overridePath) || this.composeOverrideYAML.trim() !== "";

        // Existing override files remain editable even when emptied. A new override
        // file is only created when the user actually provides override YAML.
        if (shouldWriteOverride) {
            fs.writeFileSync(overridePath, this.composeOverrideYAML);
        }

        if (process.env.PUID && process.env.PGID) {
            const uid = Number(process.env.PUID);
            const gid = Number(process.env.PGID);
            fs.lchownSync(dir, uid, gid);
            fs.chownSync(path.join(dir, this._composeFileName), uid, gid);
            if (shouldWriteEnv) {
                fs.chownSync(envPath, uid, gid);
            }
            if (shouldWriteOverride) {
                fs.chownSync(overridePath, uid, gid);
            }
        }
    }

    async deploy(socket? : DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket?.endpoint || "", this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("up", "-d", "--remove-orphans"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to deploy, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async delete(socket: DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("down", "--remove-orphans"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to delete, please check the terminal output for more information.");
        }

        // Remove the stack folder
        await fsAsync.rm(this.path, {
            recursive: true,
            force: true
        });

        return exitCode;
    }

    async updateStatus() {
        let statusList = await Stack.getStatusList();
        let status = statusList.get(this.name);

        if (status) {
            this._status = status;
        } else {
            this._status = UNKNOWN;
        }
    }

    /**
     * Checks if a compose file exists in the specified directory.
     * @async
     * @static
     * @param {string} stacksDir - The directory of the stack.
     * @param {string} filename - The name of the directory to check for the compose file.
     * @returns {Promise<boolean>} A promise that resolves to a boolean indicating whether any compose file exists.
     */
    static async composeFileExists(stacksDir : string, filename : string) : Promise<boolean> {
        let filenamePath = path.join(stacksDir, filename);
        // Check if any compose file exists
        for (const filename of acceptedComposeFileNames) {
            let composeFile = path.join(filenamePath, filename);
            if (await fileExists(composeFile)) {
                return true;
            }
        }
        return false;
    }

    static async getStackList(server : DockgeServer, useCacheForManaged = false) : Promise<Map<string, Stack>> {
        let stacksDir = server.stacksDir;
        let stackList : Map<string, Stack>;

        // Use cached stack list?
        if (useCacheForManaged && this.managedStackList.size > 0) {
            stackList = this.managedStackList;
        } else {
            stackList = new Map<string, Stack>();

            // Scan the stacks directory, and get the stack list
            let filenameList = await fsAsync.readdir(stacksDir);

            for (let filename of filenameList) {
                try {
                    // Check if it is a directory
                    let stat = await fsAsync.stat(path.join(stacksDir, filename));
                    if (!stat.isDirectory()) {
                        continue;
                    }
                    // If no compose file exists, skip it
                    if (!await Stack.composeFileExists(stacksDir, filename)) {
                        continue;
                    }
                    let stack = await this.getStack(server, filename);
                    stack._status = CREATED_FILE;
                    stackList.set(filename, stack);
                } catch (e) {
                    if (e instanceof Error) {
                        log.warn("getStackList", `Failed to get stack ${filename}, error: ${e.message}`);
                    }
                }
            }

            // Cache by copying
            this.managedStackList = new Map(stackList);
        }

        // Get status from docker compose ls
        let res = await childProcessAsync.spawn("docker", [ "compose", "ls", "--all", "--format", "json" ], {
            encoding: "utf-8",
        });

        if (!res.stdout) {
            return stackList;
        }

        let composeList = JSON.parse(res.stdout.toString());

        for (let composeStack of composeList) {
            let stack = stackList.get(composeStack.Name);

            // This stack probably is not managed by Dockge, but we still want to show it
            if (!stack) {
                // Skip the dockge stack if it is not managed by Dockge
                if (composeStack.Name === "dockge") {
                    continue;
                }
                stack = new Stack(server, composeStack.Name);
                stackList.set(composeStack.Name, stack);
            }

            stack._status = this.statusConvert(composeStack.Status);
            stack._configFilePath = composeStack.ConfigFiles;
        }

        return stackList;
    }

    /**
     * Get the status list, it will be used to update the status of the stacks
     * Not all status will be returned, only the stack that is deployed or created to `docker compose` will be returned
     */
    static async getStatusList() : Promise<Map<string, number>> {
        let statusList = new Map<string, number>();

        let res = await childProcessAsync.spawn("docker", [ "compose", "ls", "--all", "--format", "json" ], {
            encoding: "utf-8",
        });

        if (!res.stdout) {
            return statusList;
        }

        let composeList = JSON.parse(res.stdout.toString());

        for (let composeStack of composeList) {
            statusList.set(composeStack.Name, this.statusConvert(composeStack.Status));
        }

        return statusList;
    }

    /**
     * Convert the status string from `docker compose ls` to the status number
     * Input Example: "exited(1), running(1)"
     * @param status
     */
    static statusConvert(status : string) : number {
        if (status.startsWith("created")) {
            return CREATED_STACK;
        } else if (status.includes("exited")) {
            // If one of the service is exited, we consider the stack is exited
            return EXITED;
        } else if (status.startsWith("running")) {
            // If there is no exited services, there should be only running services
            return RUNNING;
        } else {
            return UNKNOWN;
        }
    }

    static async getStack(server: DockgeServer, stackName: string, skipFSOperations = false) : Promise<Stack> {
        let dir = path.join(server.stacksDir, stackName);

        if (!skipFSOperations) {
            if (!await fileExists(dir) || !(await fsAsync.stat(dir)).isDirectory()) {
                // Maybe it is a stack managed by docker compose directly
                let stackList = await this.getStackList(server, true);
                let stack = stackList.get(stackName);

                if (stack) {
                    return stack;
                } else {
                    // Really not found
                    throw new ValidationError("Stack not found");
                }
            }
        } else {
            //log.debug("getStack", "Skip FS operations");
        }

        let stack : Stack;

        if (!skipFSOperations) {
            stack = new Stack(server, stackName);
        } else {
            stack = new Stack(server, stackName, undefined, undefined, undefined, true);
        }

        stack._status = UNKNOWN;
        stack._configFilePath = path.resolve(dir);
        return stack;
    }

    getComposeOptions(command : string, ...extraOptions : string[]) {
        //--env-file ./../global.env --env-file .env
        let options = [ "compose", command, ...extraOptions ];
        if (fs.existsSync(path.join(this.server.stacksDir, "global.env"))) {
            if (fs.existsSync(path.join(this.path, ".env"))) {
                options.splice(1, 0, "--env-file", "./.env");
            }
            options.splice(1, 0, "--env-file", "../global.env");
        }
        console.log(options);
        return options;
    }

    async start(socket: DockgeSocket) {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("up", "-d", "--remove-orphans"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to start, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async stop(socket: DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("stop"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to stop, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async restart(socket: DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("restart"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to restart, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async down(socket: DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("down"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to down, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async update(socket?: DockgeSocket, deleteReplacedImages = false, onlyIfImageChanged = false) {
        const terminalName = getComposeTerminalName(socket?.endpoint || "", this.name);
        const previousImageIDs = deleteReplacedImages ? await this.getConfiguredImageIDs() : new Set<string>();
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("pull"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to pull, please check the terminal output for more information.");
        }

        if (onlyIfImageChanged) {
            const imageStatus = await this.getImageUpdateStatus();
            if (!Object.values(imageStatus).some(item => item.updateAvailable)) {
                return exitCode;
            }
        }

        // If the stack is not running, we don't need to restart it
        await this.updateStatus();
        log.debug("update", "Status: " + this.status);
        if (this.status !== RUNNING) {
            return exitCode;
        }

        exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("up", "-d", "--remove-orphans"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to restart, please check the terminal output for more information.");
        }

        if (deleteReplacedImages) {
            await this.deleteReplacedImages(previousImageIDs);
        }
        return exitCode;
    }

    private async getConfiguredImageIDs() : Promise<Set<string>> {
        const imageIDs = new Set<string>();
        try {
            const configResult = await childProcessAsync.spawn("docker", this.getComposeOptions("config", "--format", "json"), {
                cwd: this.path,
                encoding: "utf-8",
            });
            const config = JSON.parse(configResult.stdout?.toString() || "{}") as { services?: Record<string, { image?: string }> };

            for (const service of Object.values(config.services || {})) {
                if (!service.image) {
                    continue;
                }
                try {
                    const inspectResult = await childProcessAsync.spawn("docker", [ "image", "inspect", "--format", "{{.Id}}", service.image ], {
                        encoding: "utf-8",
                    });
                    const imageID = inspectResult.stdout?.toString().trim();
                    if (imageID) {
                        imageIDs.add(imageID);
                    }
                } catch (e) {
                    log.debug("imageCleanup", `Unable to inspect image ${service.image}: ${e}`);
                }
            }
        } catch (e) {
            log.warn("imageCleanup", `Unable to record images for stack ${this.name}: ${e}`);
        }
        return imageIDs;
    }

    private async deleteReplacedImages(previousImageIDs: Set<string>) {
        const currentImageIDs = await this.getConfiguredImageIDs();
        for (const imageID of previousImageIDs) {
            if (currentImageIDs.has(imageID)) {
                continue;
            }

            try {
                await childProcessAsync.spawn("docker", [ "image", "rm", imageID ], {
                    encoding: "utf-8",
                });
                log.info("imageCleanup", `Deleted replaced image ${imageID} after updating stack ${this.name}.`);
            } catch (e) {
                log.info("imageCleanup", `Kept replaced image ${imageID} because it could not be safely removed: ${e}`);
            }
        }
    }

    async pullImages(socket?: DockgeSocket) : Promise<Record<string, ImageUpdateStatus>> {
        const terminalName = getComposeTerminalName(socket?.endpoint || "", this.name);
        const exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", this.getComposeOptions("pull"), this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to pull, please check the terminal output for more information.");
        }
        return this.getImageUpdateStatus();
    }

    async joinCombinedTerminal(socket: DockgeSocket) {
        const terminalName = getCombinedTerminalName(socket.endpoint, this.name);
        const terminal = Terminal.getOrCreateTerminal(this.server, terminalName, "docker", this.getComposeOptions("logs", "-f", "--tail", "100"), this.path);
        terminal.enableKeepAlive = true;
        terminal.rows = COMBINED_TERMINAL_ROWS;
        terminal.cols = COMBINED_TERMINAL_COLS;
        terminal.join(socket);
        terminal.start();
    }

    async leaveCombinedTerminal(socket: DockgeSocket) {
        const terminalName = getCombinedTerminalName(socket.endpoint, this.name);
        const terminal = Terminal.getTerminal(terminalName);
        if (terminal) {
            terminal.leave(socket);
        }
    }

    async joinContainerTerminal(socket: DockgeSocket, serviceName: string, shell : string = "sh", index: number = 0) {
        const terminalName = getContainerExecTerminalName(socket.endpoint, this.name, serviceName, index);
        let terminal = Terminal.getTerminal(terminalName);

        if (!terminal) {
            terminal = new InteractiveTerminal(this.server, terminalName, "docker", this.getComposeOptions("exec", serviceName, shell), this.path);
            terminal.rows = TERMINAL_ROWS;
            log.debug("joinContainerTerminal", "Terminal created");
        }

        terminal.join(socket);
        terminal.start();
    }

    async getServiceStatusList() {
        let statusList = new Map<string, Array<object>>();

        try {
            let res = await childProcessAsync.spawn("docker", this.getComposeOptions("ps", "--format", "json"), {
                cwd: this.path,
                encoding: "utf-8",
            });

            if (!res.stdout) {
                return statusList;
            }

            let lines = res.stdout?.toString().split("\n");
            const composeRows: Array<{
                Service: string;
                State: string;
                Name: string;
                Health: string;
                Image?: string;
                RunningFor?: string;
                Publishers?: Array<{ PublishedPort?: number; TargetPort?: number; Protocol?: string; URL?: string }>;
                internalIP?: string;
            }> = [];

            const addLine = (obj: {
                Service: string;
                State: string;
                Name: string;
                Health: string;
                Image?: string;
                RunningFor?: string;
                Publishers?: Array<{ PublishedPort?: number; TargetPort?: number; Protocol?: string; URL?: string }>;
                internalIP?: string;
            }) => {
                if (!statusList.has(obj.Service)) {
                    statusList.set(obj.Service, []);
                }
                statusList.get(obj.Service)?.push({
                    status: obj.Health || obj.State,
                    name: obj.Name,
                    image: obj.Image || "",
                    runningFor: obj.RunningFor || "",
                    publishers: obj.Publishers || [],
                    internalIP: obj.internalIP || "",
                });
            };

            for (let line of lines) {
                try {
                    let obj = JSON.parse(line);
                    if (obj instanceof Array) {
                        composeRows.push(...obj);
                    } else {
                        composeRows.push(obj);
                    }
                } catch (e) {
                }
            }

            const containerNames = composeRows.map((row) => row.Name).filter(Boolean);
            if (containerNames.length > 0) {
                try {
                    const inspectResult = await childProcessAsync.spawn("docker", [ "inspect", ...containerNames ], {
                        cwd: this.path,
                        encoding: "utf-8",
                    });
                    const inspectedContainers = JSON.parse(inspectResult.stdout?.toString() || "[]");
                    const internalIPs = new Map<string, string>();
                    for (const container of inspectedContainers) {
                        const networks = Object.values(container.NetworkSettings?.Networks || {}) as Array<{ IPAddress?: string }>;
                        const internalIP = networks.map((network) => network.IPAddress).find(Boolean) || "";
                        internalIPs.set(String(container.Name || "").replace(/^\//, ""), internalIP);
                    }
                    composeRows.forEach((row) => {
                        row.internalIP = internalIPs.get(row.Name) || "";
                    });
                } catch (e) {
                    log.debug("getServiceStatusList", `Unable to inspect container network addresses for ${this.name}: ${e}`);
                }
            }

            composeRows.forEach(addLine);

            return statusList;
        } catch (e) {
            log.error("getServiceStatusList", e);
            return statusList;
        }
    }

    async startService(socket: DockgeSocket, serviceName: string) {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        const exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "up", "-d", serviceName ], this.path);
        if (exitCode !== 0) {
            throw new Error(`Failed to start service ${serviceName}, please check logs for more information.`);
        }

        return exitCode;
    }

    async stopService(socket: DockgeSocket, serviceName: string): Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        const exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "stop", serviceName ], this.path);
        if (exitCode !== 0) {
            throw new Error(`Failed to stop service ${serviceName}, please check logs for more information.`);
        }

        return exitCode;
    }

    async restartService(socket: DockgeSocket, serviceName: string): Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        const exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "restart", serviceName ], this.path);
        if (exitCode !== 0) {
            throw new Error(`Failed to restart service ${serviceName}, please check logs for more information.`);
        }

        return exitCode;
    }
}
