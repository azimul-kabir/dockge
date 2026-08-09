<template>
    <div class="stack-page" :class="[`focus-${focusPane}`, { 'is-mobile': $root.isMobile }]">
        <header class="stack-header">
            <router-link v-if="$root.isMobile && !isAdd" to="/" class="icon-link" :aria-label="$t('home')">‹</router-link>
            <div class="stack-title">
                <h1>{{ isAdd ? $t("compose") : stack.name }}</h1>
                <div v-if="!isAdd" class="stack-state"><Uptime :stack="globalStack" :pill="true" /> <span v-if="$root.agentCount > 1 && endpoint">{{ endpointDisplay }}</span></div>
            </div>
            <button v-if="$root.isMobile && !isAdd" class="icon-button" :class="{ active: mobileView === 'more' }" aria-label="More" @click="mobileView = 'more'">•••</button>
        </header>

        <div v-if="stack.isManagedByDockge" class="desktop-actions">
            <button v-if="isEditMode" class="btn btn-primary" :disabled="processing || !!yamlError" @click="deployStack"><font-awesome-icon icon="rocket" /> {{ $t("deployStack") }}</button>
            <button v-if="isEditMode" class="btn btn-normal" :disabled="processing || !!yamlError" @click="saveStack"><font-awesome-icon icon="save" /> {{ $t("saveStackDraft") }}</button>
            <button v-if="!isEditMode" class="btn btn-secondary" :disabled="processing" @click="enableEditMode"><font-awesome-icon icon="pen" /> {{ $t("editStack") }}</button>
            <button v-if="!isEditMode && !active" class="btn btn-primary" :disabled="processing" @click="startStack"><font-awesome-icon icon="play" /> {{ $t("startStack") }}</button>
            <button v-if="!isEditMode && active" class="btn btn-normal" :disabled="processing" @click="restartStack"><font-awesome-icon icon="rotate" /> {{ $t("restartStack") }}</button>
            <button v-if="!isEditMode" class="btn btn-normal" :disabled="processing" @click="updateStack"><font-awesome-icon icon="cloud-arrow-down" /> {{ $t("updateStack") }}</button>
            <button v-if="!isEditMode && active" class="btn btn-normal" :disabled="processing" @click="stopStack"><font-awesome-icon icon="stop" /> {{ $t("stopStack") }}</button>
            <button v-if="isEditMode && !isAdd" class="btn btn-normal" :disabled="processing" @click="discardStack">{{ $t("discardStack") }}</button>
        </div>

        <div v-if="urls.length" class="stack-urls"><a v-for="(urlItem, index) in urls" :key="index" target="_blank" :href="urlItem.url" class="badge bg-secondary">{{ urlItem.display }}</a></div>

        <Terminal v-show="showProgressTerminal" ref="progressTerminal" class="progress-terminal" :name="terminalName" :endpoint="endpoint" :rows="progressTerminalRows" @has-data="showProgressTerminal = true; submitted = true;" />

        <div v-if="stack.isManagedByDockge" class="workspace" :style="workspaceStyle">
            <section v-show="showRuntimePane" class="runtime-pane">
                <div class="pane-toolbar">
                    <strong>{{ $root.isMobile && mobileView === 'logs' ? $t("terminal") : $tc("container", 2) }}</strong>
                    <button v-if="!$root.isMobile" class="pane-control" :aria-label="focusPane === 'runtime' ? 'Restore workspace' : 'Maximize runtime'" @click="toggleFocus('runtime')">{{ focusPane === "runtime" ? "↙" : "↗" }}</button>
                </div>

                <div v-show="!$root.isMobile || mobileView === 'status'" class="runtime-content">
                    <div v-if="$root.isMobile && !isAdd" class="mobile-primary-actions">
                        <button v-if="!active" class="btn btn-primary" :disabled="processing" @click="startStack"><font-awesome-icon icon="play" /> {{ $t("startStack") }}</button>
                        <button v-if="active" class="btn btn-normal" :disabled="processing" @click="stopStack"><font-awesome-icon icon="stop" /> {{ $t("stopStack") }}</button>
                        <button class="btn btn-normal" :disabled="processing" @click="updateStack"><font-awesome-icon icon="cloud-arrow-down" /> {{ $t("updateStack") }}</button>
                    </div>
                    <div v-if="isAdd" class="general-fields">
                        <label for="name" class="form-label">{{ $t("stackName") }}</label>
                        <input id="name" v-model="stack.name" type="text" class="form-control" required @blur="stackNameToLowercase">
                        <label class="form-label mt-3">{{ $t("dockgeAgent") }}</label>
                        <select v-model="stack.endpoint" class="form-select"><option v-for="(agent, agentEndpoint) in $root.agentList" :key="agentEndpoint" :value="agentEndpoint" :disabled="$root.agentStatusList[agentEndpoint] != 'online'">({{ $root.agentStatusList[agentEndpoint] }}) {{ agent.name || agent.url || $t("Current") }}</option></select>
                    </div>
                    <div v-if="isEditMode" class="input-group add-container">
                        <input v-model="newContainerName" :placeholder="$t('New Container Name...')" class="form-control" @keyup.enter="addContainer">
                        <button class="btn btn-primary" @click="addContainer">{{ $t("addContainer") }}</button>
                    </div>
                    <div ref="containerList" class="container-list">
                        <Container v-for="(service, name) in jsonConfig.services" :key="name" :name="name" :is-edit-mode="isEditMode" :first="name === Object.keys(jsonConfig.services)[0]" :serviceStatus="serviceStatusList[name]" :dockerStats="dockerStats" @start-service="startService" @stop-service="stopService" @restart-service="restartService" />
                    </div>
                    <div v-if="isEditMode" class="extra-settings shadow-box"><label class="form-label">{{ $tc("url", 2) }}</label><ArrayInput name="urls" :display-name="$t('url')" placeholder="https://" object-type="x-dockge" /></div>
                </div>

                <div v-show="!$root.isMobile || mobileView === 'logs'" class="logs-content">
                    <Terminal v-if="!isAdd" ref="combinedTerminal" class="terminal" :name="combinedTerminalName" :endpoint="endpoint" :rows="combinedTerminalRows" :cols="combinedTerminalCols" />
                </div>
            </section>

            <div v-if="!$root.isMobile && focusPane === 'none'" class="splitter" role="separator" aria-orientation="horizontal" :aria-valuenow="splitPercent" tabindex="0" @pointerdown="startResize" @keydown.up.prevent="adjustSplit(-5)" @keydown.down.prevent="adjustSplit(5)"><span></span></div>

            <section v-show="showEditorPane" class="editor-pane">
                <div class="editor-tabs" role="tablist" aria-label="Stack configuration">
                    <button v-for="tab in editorTabs" :key="tab.id" role="tab" :aria-selected="editorTab === tab.id" :class="{ active: editorTab === tab.id }" @click="editorTab = tab.id">{{ tab.label }}</button>
                    <span v-if="isDirty" class="dirty-indicator" title="Unsaved changes">●</span>
                    <button v-if="!$root.isMobile" class="pane-control ms-auto" :aria-label="focusPane === 'editor' ? 'Restore workspace' : 'Maximize editor'" @click="toggleFocus('editor')">{{ focusPane === "editor" ? "↙" : "↗" }}</button>
                </div>

                <div class="editor-content">
                    <div v-show="editorTab === 'compose'" class="editor-view">
                        <code-mirror ref="editor" v-model="stack.composeYAML" :extensions="extensions" minimal :wrap="false" dark tab :disabled="!isEditMode" :hasFocus="editorFocus" @change="yamlCodeChange" />
                        <div v-if="yamlError" class="validation-error" role="alert">{{ yamlError }}</div>
                    </div>
                    <div v-show="editorTab === 'environment'" class="editor-view">
                        <code-mirror v-model="stack.composeENV" :extensions="extensionsEnv" minimal :wrap="false" dark tab :disabled="!isEditMode" :hasFocus="editorFocus" @change="yamlCodeChange" />
                    </div>
                    <div v-show="editorTab === 'network'" class="network-view"><div class="shadow-box"><NetworkInput /></div></div>
                </div>
            </section>
        </div>

        <section v-if="$root.isMobile && mobileView === 'more'" class="mobile-more">
            <button v-if="!isEditMode" class="btn btn-normal" :disabled="processing" @click="restartStack"><font-awesome-icon icon="rotate" /> {{ $t("restartStack") }}</button>
            <button class="btn btn-normal" :disabled="processing" @click="downStack"><font-awesome-icon icon="stop" /> {{ $t("downStack") }}</button>
            <button v-if="!isEditMode" class="btn btn-danger" :disabled="processing" @click="showDeleteDialog = true"><font-awesome-icon icon="trash" /> {{ $t("deleteStack") }}</button>
        </section>

        <div v-if="$root.isMobile && (isAdd || mobileView === 'edit') && isEditMode" class="mobile-action-bar">
            <span class="save-state">{{ isDirty ? "Unsaved" : "Saved" }}</span>
            <button class="btn btn-normal" :disabled="processing || !!yamlError || !isDirty" @click="saveStack"><font-awesome-icon icon="save" /> {{ $t("saveStackDraft") }}</button>
            <button class="btn btn-primary" :disabled="processing || !!yamlError" @click="deployStack"><font-awesome-icon icon="rocket" /> {{ $t("deployStack") }}</button>
        </div>

        <nav v-if="$root.isMobile && !isAdd" class="mobile-bottom-nav" aria-label="Stack sections">
            <button v-for="item in mobileNav" :key="item.id" :class="{ active: mobileView === item.id }" @click="selectMobileView(item.id)"><font-awesome-icon :icon="item.icon" /><span>{{ item.label }}</span></button>
        </nav>

        <div v-if="!stack.isManagedByDockge && !processing" class="not-managed">{{ $t("stackNotManagedByDockgeMsg") }}</div>
        <BModal v-model="showDeleteDialog" :cancelTitle="$t('cancel')" :okTitle="$t('deleteStack')" okVariant="danger" @ok="deleteDialog">{{ $t("deleteStackMsg") }}</BModal>
    </div>
</template>

<script>
import CodeMirror from "vue-codemirror6";
import { yaml } from "@codemirror/lang-yaml";
import { python } from "@codemirror/lang-python";
import { dracula as editorTheme } from "thememirror";
import { lineNumbers, EditorView } from "@codemirror/view";
import { parseDocument, Document } from "yaml";

import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import {
    COMBINED_TERMINAL_COLS,
    COMBINED_TERMINAL_ROWS,
    copyYAMLComments, envsubstYAML,
    getCombinedTerminalName,
    getComposeTerminalName,
    PROGRESS_TERMINAL_ROWS,
    RUNNING
} from "../../../common/util-common";
import { BModal } from "bootstrap-vue-next";
import NetworkInput from "../components/NetworkInput.vue";
import dotenv from "dotenv";
import { ref } from "vue";

const template = `
services:
  nginx:
    image: nginx:latest
    restart: unless-stopped
    ports:
      - "8080:80"
`;
const envDefault = "# VARIABLE=value #comment";

let yamlErrorTimeout = null;

let serviceStatusTimeout = null;
let dockerStatsTimeout = null;

export default {
    components: {
        NetworkInput,
        FontAwesomeIcon,
        CodeMirror,
        BModal,
    },
    beforeRouteUpdate(to, from, next) {
        this.exitConfirm(next);
    },
    beforeRouteLeave(to, from, next) {
        this.exitConfirm(next);
    },
    setup() {
        const editorFocus = ref(false);

        const focusEffectHandler = (state, focusing) => {
            editorFocus.value = focusing;
            return null;
        };

        const extensions = [
            editorTheme,
            yaml(),
            lineNumbers(),
            EditorView.focusChangeEffect.of(focusEffectHandler)
        ];

        const extensionsEnv = [
            editorTheme,
            python(),
            lineNumbers(),
            EditorView.focusChangeEffect.of(focusEffectHandler)
        ];

        return { extensions,
            extensionsEnv,
            editorFocus };
    },
    yamlDoc: null,  // For keeping the yaml comments
    data() {
        return {
            jsonConfig: {},
            envsubstJSONConfig: {},
            yamlError: "",
            processing: true,
            showProgressTerminal: false,
            progressTerminalRows: PROGRESS_TERMINAL_ROWS,
            combinedTerminalRows: COMBINED_TERMINAL_ROWS,
            combinedTerminalCols: COMBINED_TERMINAL_COLS,
            stack: {

            },
            serviceStatusList: {},
            dockerStats: {},
            isEditMode: false,
            submitted: false,
            showDeleteDialog: false,
            newContainerName: "",
            stopServiceStatusTimeout: false,
            stopDockerStatsTimeout: false,
            editorTab: "compose",
            mobileView: "status",
            focusPane: "none",
            splitPercent: Number(localStorage.getItem("dockgeWorkspaceSplit")) || 40,
            savedComposeYAML: "",
            savedComposeENV: "",
        };
    },
    computed: {
        editorTabs() {
            return [
                { id: "compose",
                    label: "Compose" },
                { id: "environment",
                    label: "Environment" },
                { id: "network",
                    label: this.$tc("network", 2) },
            ];
        },

        mobileNav() {
            return [
                { id: "status",
                    label: "Status",
                    icon: "heartbeat" },
                { id: "logs",
                    label: "Logs",
                    icon: "terminal" },
                { id: "edit",
                    label: "Edit",
                    icon: "pen" },
                { id: "more",
                    label: "More",
                    icon: "list" },
            ];
        },

        isDirty() {
            return this.stack.composeYAML !== this.savedComposeYAML || this.stack.composeENV !== this.savedComposeENV;
        },

        workspaceStyle() {
            return { "--runtime-size": `${this.splitPercent}%` };
        },

        showRuntimePane() {
            return !this.$root.isMobile || (!this.isAdd && (this.mobileView === "status" || this.mobileView === "logs"));
        },

        showEditorPane() {
            return !this.$root.isMobile || this.isAdd || this.mobileView === "edit";
        },

        endpointDisplay() {
            return this.$root.endpointDisplayFunction(this.endpoint);
        },

        urls() {
            if (!this.envsubstJSONConfig["x-dockge"] || !this.envsubstJSONConfig["x-dockge"].urls || !Array.isArray(this.envsubstJSONConfig["x-dockge"].urls)) {
                return [];
            }

            let urls = [];
            for (const url of this.envsubstJSONConfig["x-dockge"].urls) {
                let display;
                try {
                    let obj = new URL(url);
                    let pathname = obj.pathname;
                    if (pathname === "/") {
                        pathname = "";
                    }
                    display = obj.host + pathname + obj.search;
                } catch (e) {
                    display = url;
                }

                urls.push({
                    display,
                    url,
                });
            }
            return urls;
        },

        isAdd() {
            return this.$route.path === "/compose" && !this.submitted;
        },

        /**
         * Get the stack from the global stack list, because it may contain more real-time data like status
         * @return {*}
         */
        globalStack() {
            return this.$root.completeStackList[this.stack.name + "_" + this.endpoint];
        },

        status() {
            return this.globalStack?.status;
        },

        active() {
            return this.status === RUNNING;
        },

        terminalName() {
            if (!this.stack.name) {
                return "";
            }
            return getComposeTerminalName(this.endpoint, this.stack.name);
        },

        combinedTerminalName() {
            if (!this.stack.name) {
                return "";
            }
            return getCombinedTerminalName(this.endpoint, this.stack.name);
        },

        networks() {
            return this.jsonConfig.networks;
        },

        endpoint() {
            return this.stack.endpoint || this.$route.params.endpoint || "";
        },

        url() {
            if (this.stack.endpoint) {
                return `/compose/${this.stack.name}/${this.stack.endpoint}`;
            } else {
                return `/compose/${this.stack.name}`;
            }
        },
    },
    watch: {
        "stack.composeYAML": {
            handler() {
                if (this.editorFocus) {
                    console.debug("yaml code changed");
                    this.yamlCodeChange();
                }
            },
            deep: true,
        },

        "stack.composeENV": {
            handler() {
                if (this.editorFocus) {
                    console.debug("env code changed");
                    this.yamlCodeChange();
                }
            },
            deep: true,
        },

        jsonConfig: {
            handler() {
                if (!this.editorFocus) {
                    console.debug("jsonConfig changed");

                    let doc = new Document(this.jsonConfig);

                    // Stick back the yaml comments
                    if (this.yamlDoc) {
                        copyYAMLComments(doc, this.yamlDoc);
                    }

                    this.stack.composeYAML = doc.toString();
                    this.yamlDoc = doc;
                }
            },
            deep: true,
        },

        $route(to, from) {

        }
    },
    mounted() {
        if (this.isAdd) {
            this.processing = false;
            this.isEditMode = true;

            let composeYAML;
            let composeENV;

            if (this.$root.composeTemplate) {
                composeYAML = this.$root.composeTemplate;
                this.$root.composeTemplate = "";
            } else {
                composeYAML = template;
            }
            if (this.$root.envTemplate) {
                composeENV = this.$root.envTemplate;
                this.$root.envTemplate = "";
            } else {
                composeENV = envDefault;
            }

            // Default Values
            this.stack = {
                name: "",
                composeYAML,
                composeENV,
                isManagedByDockge: true,
                endpoint: "",
            };

            this.yamlCodeChange();
            this.savedComposeYAML = "";
            this.savedComposeENV = "";

        } else {
            this.stack.name = this.$route.params.stackName;
            this.loadStack();
        }

        this.requestServiceStatus();
        this.requestDockerStats();
    },
    unmounted() {
        this.stopResize();
    },
    methods: {
        startServiceStatusTimeout() {
            clearTimeout(serviceStatusTimeout);
            serviceStatusTimeout = setTimeout(async () => {
                this.requestServiceStatus();
            }, 5000);
        },

        startDockerStatsTimeout() {
            clearTimeout(dockerStatsTimeout);
            dockerStatsTimeout = setTimeout(async () => {
                this.requestDockerStats();
            }, 5000);
        },

        requestServiceStatus() {
            // Do not request if it is add mode
            if (this.isAdd) {
                return;
            }

            this.$root.emitAgent(this.endpoint, "serviceStatusList", this.stack.name, (res) => {
                if (res.ok) {
                    this.serviceStatusList = res.serviceStatusList;
                }
                if (!this.stopServiceStatusTimeout) {
                    this.startServiceStatusTimeout();
                }
            });
        },

        requestDockerStats() {
            this.$root.emitAgent(this.endpoint, "dockerStats", (res) => {
                if (res.ok) {
                    this.dockerStats = res.dockerStats;
                }
                if (!this.stopDockerStatsTimeout) {
                    this.startDockerStatsTimeout();
                }
            });
        },

        exitConfirm(next) {
            if (this.isEditMode) {
                if (confirm(this.$t("confirmLeaveStack"))) {
                    this.exitAction();
                    next();
                } else {
                    next(false);
                }
            } else {
                this.exitAction();
                next();
            }
        },

        exitAction() {
            console.log("exitAction");
            this.stopServiceStatusTimeout = true;
            this.stopDockerStatsTimeout = true;
            clearTimeout(serviceStatusTimeout);
            clearTimeout(dockerStatsTimeout);

            // Leave Combined Terminal
            console.debug("leaveCombinedTerminal", this.endpoint, this.stack.name);
            this.$root.emitAgent(this.endpoint, "leaveCombinedTerminal", this.stack.name, () => {});
        },

        bindTerminal() {
            this.$refs.progressTerminal?.bind(this.endpoint, this.terminalName);
        },

        loadStack() {
            this.processing = true;
            this.$root.emitAgent(this.endpoint, "getStack", this.stack.name, (res) => {
                if (res.ok) {
                    this.stack = res.stack;
                    this.savedComposeYAML = res.stack.composeYAML;
                    this.savedComposeENV = res.stack.composeENV;
                    this.yamlCodeChange();
                    this.processing = false;
                    this.bindTerminal();
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        deployStack() {
            this.processing = true;

            if (!this.jsonConfig.services) {
                this.$root.toastError("No services found in compose.yaml");
                this.processing = false;
                return;
            }

            // Check if services is object
            if (typeof this.jsonConfig.services !== "object") {
                this.$root.toastError("Services must be an object");
                this.processing = false;
                return;
            }

            let serviceNameList = Object.keys(this.jsonConfig.services);

            // Set the stack name if empty, use the first container name
            if (!this.stack.name && serviceNameList.length > 0) {
                let serviceName = serviceNameList[0];
                let service = this.jsonConfig.services[serviceName];

                if (service && service.container_name) {
                    this.stack.name = service.container_name;
                } else {
                    this.stack.name = serviceName;
                }
            }

            this.bindTerminal();

            this.$root.emitAgent(this.stack.endpoint, "deployStack", this.stack.name, this.stack.composeYAML, this.stack.composeENV, this.isAdd, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.savedComposeYAML = this.stack.composeYAML;
                    this.savedComposeENV = this.stack.composeENV;
                    this.isEditMode = false;
                    this.$router.push(this.url);
                }
            });
        },

        saveStack() {
            this.processing = true;

            this.$root.emitAgent(this.stack.endpoint, "saveStack", this.stack.name, this.stack.composeYAML, this.stack.composeENV, this.isAdd, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.savedComposeYAML = this.stack.composeYAML;
                    this.savedComposeENV = this.stack.composeENV;
                    this.isEditMode = false;
                    this.$router.push(this.url);
                }
            });
        },

        startStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "startStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        stopStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "stopStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        downStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "downStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        restartStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "restartStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        updateStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "updateStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        deleteDialog() {
            this.$root.emitAgent(this.endpoint, "deleteStack", this.stack.name, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.$router.push("/");
                }
            });
        },

        discardStack() {
            this.loadStack();
            this.isEditMode = false;
        },

        yamlToJSON(yaml) {
            let doc = parseDocument(yaml);
            if (doc.errors.length > 0) {
                throw doc.errors[0];
            }

            const config = doc.toJS() ?? {};

            // Check data types
            // "services" must be an object
            if (!config.services) {
                config.services = {};
            }

            if (Array.isArray(config.services) || typeof config.services !== "object") {
                throw new Error("Services must be an object");
            }

            return {
                config,
                doc,
            };
        },

        yamlCodeChange() {
            try {
                let { config, doc } = this.yamlToJSON(this.stack.composeYAML);

                this.yamlDoc = doc;
                this.jsonConfig = config;

                let env = dotenv.parse(this.stack.composeENV);
                let envYAML = envsubstYAML(this.stack.composeYAML, env);
                this.envsubstJSONConfig = this.yamlToJSON(envYAML).config;

                clearTimeout(yamlErrorTimeout);
                this.yamlError = "";
            } catch (e) {
                clearTimeout(yamlErrorTimeout);

                if (this.yamlError) {
                    this.yamlError = e.message;

                } else {
                    yamlErrorTimeout = setTimeout(() => {
                        this.yamlError = e.message;
                    }, 3000);
                }
            }
        },

        enableEditMode() {
            this.isEditMode = true;
        },

        selectMobileView(view) {
            this.mobileView = view;
            if (view === "edit" && !this.isEditMode) {
                this.enableEditMode();
            }
            this.$nextTick(() => this.$refs.combinedTerminal?.updateTerminalSize?.());
        },

        toggleFocus(pane) {
            this.focusPane = this.focusPane === pane ? "none" : pane;
            this.$nextTick(() => this.$refs.combinedTerminal?.updateTerminalSize?.());
        },

        adjustSplit(amount) {
            this.splitPercent = Math.min(70, Math.max(25, this.splitPercent + amount));
            localStorage.setItem("dockgeWorkspaceSplit", String(this.splitPercent));
        },

        startResize(event) {
            event.preventDefault();
            this.resizeWorkspace = event.currentTarget.parentElement;
            window.addEventListener("pointermove", this.resizeWorkspacePanes);
            window.addEventListener("pointerup", this.stopResize, { once: true });
        },

        resizeWorkspacePanes(event) {
            const bounds = this.resizeWorkspace.getBoundingClientRect();
            const percent = ((event.clientY - bounds.top) / bounds.height) * 100;
            this.splitPercent = Math.min(70, Math.max(25, Math.round(percent)));
        },

        stopResize() {
            window.removeEventListener("pointermove", this.resizeWorkspacePanes);
            window.removeEventListener("pointerup", this.stopResize);
            if (this.splitPercent) {
                localStorage.setItem("dockgeWorkspaceSplit", String(this.splitPercent));
            }
            this.resizeWorkspace = null;
        },

        checkYAML() {

        },

        addContainer() {
            this.checkYAML();

            if (this.jsonConfig.services[this.newContainerName]) {
                this.$root.toastError("Container name already exists");
                return;
            }

            if (!this.newContainerName) {
                this.$root.toastError("Container name cannot be empty");
                return;
            }

            this.jsonConfig.services[this.newContainerName] = {
                restart: "unless-stopped",
            };
            this.newContainerName = "";
            let element = this.$refs.containerList.lastElementChild;
            element.scrollIntoView({
                block: "start",
                behavior: "smooth"
            });
        },

        stackNameToLowercase() {
            this.stack.name = this.stack?.name?.toLowerCase();
        },

        startService(serviceName) {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "startService", this.stack.name, serviceName, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.requestServiceStatus(); // Refresh service status
                }
            });
        },

        stopService(serviceName) {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "stopService", this.stack.name, serviceName, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.requestServiceStatus(); // Refresh service status
                }
            });
        },

        restartService(serviceName) {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "restartService", this.stack.name, serviceName, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.requestServiceStatus(); // Refresh service status
                }
            });
        },
    }
};
</script>

<style scoped lang="scss">
@import "../styles/vars.scss";

.stack-page { height: calc(100dvh - 112px); min-height: 600px; display: flex; flex-direction: column; min-width: 0; }
.stack-header { display: flex; align-items: center; gap: 12px; flex: 0 0 auto; margin-bottom: 8px; }
.stack-title { min-width: 0; display: flex; align-items: center; gap: 12px; }
.stack-title h1 { margin: 0; overflow: hidden; font-size: 25px; text-overflow: ellipsis; white-space: nowrap; }
.stack-state { white-space: nowrap; }
.desktop-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.desktop-actions .btn { padding: 7px 12px; }
.stack-urls { display: flex; gap: 6px; margin-bottom: 6px; overflow-x: auto; }
.progress-terminal { flex: 0 0 150px; margin-bottom: 8px; overflow: hidden; }
.workspace { display: grid; grid-template-rows: minmax(150px, var(--runtime-size)) 8px minmax(220px, 1fr); flex: 1 1 auto; min-height: 0; border: 1px solid #dee2e6; border-radius: 10px; overflow: hidden; }
.runtime-pane, .editor-pane { min-height: 0; min-width: 0; overflow: hidden; background: rgba(255,255,255,.35); }
.runtime-pane { display: grid; grid-template-columns: minmax(300px, 1fr) minmax(360px, 1fr); grid-template-rows: 42px minmax(0, 1fr); }
.pane-toolbar { grid-column: 1 / -1; display: flex; align-items: center; padding: 0 12px; border-bottom: 1px solid #dee2e6; }
.pane-control { min-width: 44px; min-height: 38px; margin-left: auto; border: 0; color: inherit; background: transparent; font-size: 20px; }
.runtime-content, .logs-content { min-width: 0; min-height: 0; padding: 10px; overflow: auto; }
.logs-content { border-left: 1px solid #dee2e6; }
.terminal { height: 100%; min-height: 180px; overflow: hidden; }
.add-container { margin-bottom: 10px; }
.extra-settings { margin-top: 10px; }
.splitter { display: grid; cursor: row-resize; background: #e9ecef; place-items: center; touch-action: none; }
.splitter span { width: 48px; height: 3px; border-radius: 2px; background: #9aa1a8; }
.editor-pane { display: flex; flex-direction: column; }
.editor-tabs { display: flex; flex: 0 0 44px; align-items: stretch; gap: 2px; padding: 3px 6px 0; border-bottom: 1px solid #dee2e6; overflow-x: auto; }
.editor-tabs > button:not(.pane-control) { min-width: 100px; padding: 0 14px; border: 0; border-bottom: 3px solid transparent; color: inherit; background: transparent; font-weight: 600; }
.editor-tabs > button.active { border-bottom-color: $primary; color: $primary; }
.dirty-indicator { align-self: center; color: $warning; font-size: 12px; }
.editor-content, .editor-view { flex: 1; min-width: 0; min-height: 0; height: 100%; overflow: hidden; }
.editor-view { position: relative; font-family: 'JetBrains Mono', monospace; font-size: 14px; }
.editor-view :deep(.vue-codemirror), .editor-view :deep(.cm-editor) { height: 100%; }
.editor-view :deep(.cm-scroller) { overflow: auto; font-family: 'JetBrains Mono', monospace; }
.validation-error { position: absolute; right: 12px; bottom: 10px; max-width: calc(100% - 24px); padding: 6px 10px; border-radius: 5px; color: white; background: $danger; font: 12px BlinkMacSystemFont, sans-serif; }
.network-view { height: 100%; padding: 14px; overflow: auto; }
.focus-editor .workspace { grid-template-rows: 1fr; }
.focus-editor .runtime-pane, .focus-editor .splitter, .focus-runtime .editor-pane, .focus-runtime .splitter { display: none; }
.focus-runtime .workspace { grid-template-rows: 1fr; }
:global(.dark) .workspace, :global(.dark) .pane-toolbar, :global(.dark) .logs-content, :global(.dark) .editor-tabs { border-color: $dark-border-color; }
:global(.dark) .runtime-pane, :global(.dark) .editor-pane { background: $dark-bg; }
:global(.dark) .splitter { background: $dark-bg2; }
.icon-link, .icon-button { display: grid; width: 44px; height: 44px; padding: 0; border: 0; color: inherit; background: transparent; font-size: 28px; text-decoration: none; place-items: center; }

@media (max-width: 767.98px) {
    .stack-page { min-height: 0; height: 100dvh; padding: max(8px, env(safe-area-inset-top)) 8px calc(68px + env(safe-area-inset-bottom)); overflow: hidden; }
    .stack-header { min-height: 48px; margin: 0; }
    .stack-title { flex: 1; }
    .stack-title h1 { font-size: 20px; }
    .stack-state { font-size: 12px; }
    .desktop-actions, .stack-urls { display: none; }
    .progress-terminal { position: absolute; inset: 56px 8px 70px; z-index: 10; margin: 0; }
    .workspace { display: block; flex: 1; border: 0; border-radius: 0; overflow: hidden; }
    .runtime-pane, .editor-pane { height: 100%; }
    .runtime-pane { display: flex; flex-direction: column; }
    .pane-toolbar { flex: 0 0 42px; }
    .runtime-content, .logs-content { flex: 1; padding: 8px 0; border: 0; -webkit-overflow-scrolling: touch; }
    .mobile-primary-actions { display: flex; gap: 8px; margin-bottom: 12px; overflow-x: auto; }
    .mobile-primary-actions .btn { min-height: 44px; flex: 0 0 auto; }
    .terminal { min-height: 0; height: 100%; border-radius: 0; }
    .editor-tabs { flex-basis: 48px; padding: 0; }
    .editor-tabs > button:not(.pane-control) { min-width: 105px; min-height: 44px; }
    .editor-view { font-size: 16px; }
    .editor-view :deep(.cm-content) { padding-bottom: 90px; caret-color: white; }
    .editor-view :deep(.cm-line) { padding-left: 4px; }
    .network-view { padding: 8px 0 88px; font-size: 16px; }
    .network-view :deep(input), .network-view :deep(select) { min-height: 44px; font-size: 16px; }
    .mobile-more { display: grid; align-content: start; gap: 12px; flex: 1; padding: 16px 4px; }
    .mobile-more .btn { min-height: 48px; text-align: left; }
    .mobile-action-bar { position: fixed; right: 0; bottom: calc(60px + env(safe-area-inset-bottom)); left: 0; z-index: 50; display: flex; align-items: center; gap: 6px; min-height: 58px; padding: 6px 8px; border-top: 1px solid #dee2e6; background: white; }
    .mobile-action-bar .save-state { margin-right: auto; font-size: 12px; }
    .mobile-action-bar .btn { min-height: 44px; padding: 6px 10px; }
    .mobile-bottom-nav { position: fixed; right: 0; bottom: 0; left: 0; z-index: 60; display: grid; grid-template-columns: repeat(4, 1fr); height: calc(60px + env(safe-area-inset-bottom)); padding-bottom: env(safe-area-inset-bottom); border-top: 1px solid #dee2e6; background: white; }
    .mobile-bottom-nav button { display: flex; min-width: 0; min-height: 60px; align-items: center; justify-content: center; flex-direction: column; gap: 2px; border: 0; color: #737980; background: transparent; font-size: 11px; }
    .mobile-bottom-nav button svg { font-size: 18px; }
    .mobile-bottom-nav button.active { color: $primary; font-weight: bold; }
    :global(.dark) .mobile-action-bar, :global(.dark) .mobile-bottom-nav { border-color: $dark-border-color; color: $dark-font-color; background: $dark-bg; }
    .modal-dialog { max-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom)); margin: max(8px, env(safe-area-inset-top)) 8px; }
}

@media (max-width: 430px) { .mobile-action-bar .save-state { display: none; } }
@media (max-width: 350px) { .mobile-action-bar .btn { font-size: 12px; } .stack-state { display: none; } }
@media (max-width: 900px) and (orientation: landscape) { .stack-page { padding-top: 4px; } .stack-header { min-height: 40px; } }
</style>
