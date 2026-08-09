<template>
    <transition name="slide-fade" appear>
        <div class="stack-page" :class="{ 'keyboard-open': keyboardOpen }" :style="viewportStyle">
            <header class="stack-header">
                <router-link v-if="$root.isMobile && !isAdd" to="/" class="icon-link" :aria-label="$t('home')">‹</router-link>
                <div class="stack-title"><h1>{{ isAdd ? $t("compose") : stack.name }}</h1><div v-if="!isAdd" class="stack-state"><Uptime :stack="globalStack" :pill="true" /> <span v-if="$root.agentCount > 1 && endpoint">{{ endpointDisplay }}</span></div></div>
            </header>

            <div v-if="urls.length" class="stack-urls"><a v-for="(urlItem, index) in urls" :key="index" target="_blank" :href="urlItem.url" class="badge bg-secondary">{{ urlItem.display }}</a></div>
            <Terminal v-show="showProgressTerminal" ref="progressTerminal" class="progress-terminal" :name="terminalName" :endpoint="endpoint" :rows="progressTerminalRows" @has-data="showProgressTerminal = true; submitted = true;" />

            <template v-if="stack.isManagedByDockge">
                <nav v-if="!$root.isMobile" class="workspace-tabs" aria-label="Stack workspace"><button v-for="tab in desktopTabs" :key="tab.id" :class="{ active: activeWorkspace === tab.id }" @click="selectWorkspace(tab.id)">{{ tab.label }}</button><span v-if="isDirty" class="dirty-indicator">●</span></nav>
                <div v-if="$root.isMobile && mobileView === 'config'" class="mobile-config-selector"><label for="config-workspace">Config</label><select id="config-workspace" v-model="configWorkspace" class="form-select" @change="selectConfigWorkspace"><option value="compose">Compose</option><option value="environment">Environment</option><option value="network">Networks</option></select><button v-if="isEditorWorkspace" class="wrap-button" :aria-pressed="wrapLines" @click="wrapLines = !wrapLines">Wrap {{ wrapLines ? "On" : "Off" }}</button></div>

                <main v-show="!$root.isMobile || mobileView !== 'more'" class="workspace">
                    <section v-if="activeWorkspace === 'overview'" class="overview-workspace workspace-scroll">
                        <div class="stack-actions"><button v-if="!isEditMode" class="btn btn-secondary" :disabled="processing" @click="enableEditMode"><font-awesome-icon icon="pen" /> {{ $t("editStack") }}</button><button v-if="!active && !isEditMode" class="btn btn-primary" :disabled="processing" @click="startStack"><font-awesome-icon icon="play" /> {{ $t("startStack") }}</button><button v-if="active && !isEditMode" class="btn btn-normal" :disabled="processing" @click="stopStack"><font-awesome-icon icon="stop" /> {{ $t("stopStack") }}</button><button v-if="!isEditMode" class="btn btn-normal" :disabled="processing" @click="restartStack"><font-awesome-icon icon="rotate" /> {{ $t("restartStack") }}</button><button v-if="!isEditMode" class="btn btn-normal" :disabled="processing" @click="updateStack"><font-awesome-icon icon="cloud-arrow-down" /> {{ $t("updateStack") }}</button><button v-if="isEditMode && !isAdd" class="btn btn-normal" :disabled="processing" @click="discardStack">{{ $t("discardStack") }}</button></div>
                        <div v-if="isAdd" class="general-fields"><label for="name" class="form-label">{{ $t("stackName") }}</label><input id="name" v-model="stack.name" type="text" class="form-control" required @blur="stackNameToLowercase"><label class="form-label mt-3">{{ $t("dockgeAgent") }}</label><select v-model="stack.endpoint" class="form-select"><option v-for="(agent, agentEndpoint) in $root.agentList" :key="agentEndpoint" :value="agentEndpoint" :disabled="$root.agentStatusList[agentEndpoint] != 'online'">({{ $root.agentStatusList[agentEndpoint] }}) {{ agent.name || agent.url || $t("Current") }}</option></select></div>
                        <div v-if="isEditMode" class="input-group add-container"><input v-model="newContainerName" :placeholder="$t('New Container Name...')" class="form-control" @keyup.enter="addContainer"><button class="btn btn-primary" @click="addContainer">{{ $t("addContainer") }}</button></div>
                        <div ref="containerList" class="container-list"><Container v-for="(service, name) in jsonConfig.services" :key="name" :name="name" :is-edit-mode="isEditMode" :first="name === Object.keys(jsonConfig.services)[0]" :serviceStatus="serviceStatusList[name]" :dockerStats="dockerStats" @start-service="startService" @stop-service="stopService" @restart-service="restartService" /></div>
                        <div v-if="isEditMode" class="extra-settings shadow-box"><label class="form-label">{{ $tc("url", 2) }}</label><ArrayInput name="urls" :display-name="$t('url')" placeholder="https://" object-type="x-dockge" /></div>
                    </section>
                    <section v-show="activeWorkspace === 'logs'" class="logs-workspace"><Terminal v-if="!isAdd" ref="combinedTerminal" class="terminal" :name="combinedTerminalName" :endpoint="endpoint" :rows="combinedTerminalRows" :cols="combinedTerminalCols" /></section>
                    <section v-show="activeWorkspace === 'compose'" class="editor-workspace"><div v-if="!$root.isMobile" class="editor-toolbar"><button class="wrap-button" :aria-pressed="wrapLines" @click="wrapLines = !wrapLines">Wrap Lines: {{ wrapLines ? "On" : "Off" }}</button></div><div class="editor-view"><code-mirror ref="editor" v-model="stack.composeYAML" :extensions="extensions" minimal :wrap="wrapLines" dark tab :disabled="!isEditMode" :hasFocus="editorFocus" @change="yamlCodeChange" /><div v-if="yamlError" class="validation-error" role="alert">{{ yamlError }}</div></div></section>
                    <section v-show="activeWorkspace === 'environment'" class="editor-workspace"><div v-if="!$root.isMobile" class="editor-toolbar"><button class="wrap-button" :aria-pressed="wrapLines" @click="wrapLines = !wrapLines">Wrap Lines: {{ wrapLines ? "On" : "Off" }}</button></div><div class="editor-view"><code-mirror ref="envEditor" v-model="stack.composeENV" :extensions="extensionsEnv" minimal :wrap="wrapLines" dark tab :disabled="!isEditMode" :hasFocus="editorFocus" @change="yamlCodeChange" /></div></section>
                    <section v-show="activeWorkspace === 'network'" class="network-workspace workspace-scroll"><div class="network-panel shadow-box"><NetworkInput /></div></section>
                </main>
            </template>

            <section v-if="$root.isMobile && mobileView === 'more'" class="mobile-more"><button v-if="isEditMode" class="btn btn-normal" :disabled="processing" @click="discardStack">{{ $t("discardStack") }}</button><button class="btn btn-normal" :disabled="processing" @click="downStack"><font-awesome-icon icon="stop" /> {{ $t("downStack") }}</button><button v-if="!isEditMode" class="btn btn-danger" :disabled="processing" @click="showDeleteDialog = true"><font-awesome-icon icon="trash" /> {{ $t("deleteStack") }}</button></section>
            <div v-if="showEditorActions" class="editor-actions"><span class="save-state">{{ isDirty ? "● Unsaved" : "Saved" }}</span><button v-if="!$root.isMobile && isEditMode && !isAdd" class="btn btn-normal" :disabled="processing" @click="discardStack">{{ $t("discardStack") }}</button><button v-if="!isEditMode" class="btn btn-normal" :disabled="processing" @click="enableEditMode"><font-awesome-icon icon="pen" /> {{ $t("editStack") }}</button><button class="btn btn-normal" :disabled="processing || !!yamlError || !isDirty" @click="saveStack"><font-awesome-icon icon="save" /> {{ $t("saveStackDraft") }}</button><button class="btn btn-primary" :disabled="processing || !!yamlError || !isEditMode" @click="deployStack"><font-awesome-icon icon="rocket" /> {{ $t("deployStack") }}</button></div>
            <nav v-if="$root.isMobile && !isAdd && !keyboardOpen" class="mobile-bottom-nav" aria-label="Stack sections"><button v-for="item in mobileNav" :key="item.id" :class="{ active: mobileView === item.id }" @click="selectMobileView(item.id)"><font-awesome-icon :icon="item.icon" /><span>{{ item.label }}</span></button></nav>
            <div v-if="!stack.isManagedByDockge && !processing" class="not-managed">{{ $t("stackNotManagedByDockgeMsg") }}</div><BModal v-model="showDeleteDialog" :cancelTitle="$t('cancel')" :okTitle="$t('deleteStack')" okVariant="danger" @ok="deleteDialog">{{ $t("deleteStackMsg") }}</BModal>
        </div>
    </transition>
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
            activeWorkspace: "overview",
            configWorkspace: "compose",
            mobileView: "overview",
            wrapLines: window.innerWidth < 768,
            keyboardOpen: false,
            visualViewportHeight: window.innerHeight,
            savedComposeYAML: "",
            savedComposeENV: "",
        };
    },
    computed: {
        desktopTabs() {
            return [
                { id: "overview",
                    label: "Overview" },
                { id: "logs",
                    label: "Logs" },
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
                { id: "overview",
                    label: "Overview",
                    icon: "heartbeat" },
                { id: "logs",
                    label: "Logs",
                    icon: "terminal" },
                { id: "config",
                    label: "Config",
                    icon: "pen" },
                { id: "more",
                    label: "More",
                    icon: "list" },
            ];
        },

        isDirty() {
            return this.stack.composeYAML !== this.savedComposeYAML || this.stack.composeENV !== this.savedComposeENV;
        },

        isEditorWorkspace() {
            return this.activeWorkspace === "compose" || this.activeWorkspace === "environment";
        },

        showEditorActions() {
            return this.stack.isManagedByDockge && (this.isAdd || this.isEditorWorkspace);
        },

        viewportStyle() {
            return { "--visual-viewport-height": `${this.visualViewportHeight}px` };
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

        editorFocus() {
            this.updateVisualViewport();
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
            this.activeWorkspace = "compose";
            this.configWorkspace = "compose";
            this.mobileView = "config";

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
        window.visualViewport?.addEventListener("resize", this.updateVisualViewport, { passive: true });
        window.visualViewport?.addEventListener("scroll", this.updateVisualViewport, { passive: true });
        this.updateVisualViewport();
    },
    unmounted() {
        window.visualViewport?.removeEventListener("resize", this.updateVisualViewport);
        window.visualViewport?.removeEventListener("scroll", this.updateVisualViewport);
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
            if (view === "config") {
                this.activeWorkspace = this.configWorkspace;
            } else if (view !== "more") {
                this.activeWorkspace = view;
            }
            this.$nextTick(() => this.$refs.combinedTerminal?.updateTerminalSize?.());
        },

        selectWorkspace(workspace) {
            this.activeWorkspace = workspace;
            if ([ "compose", "environment", "network" ].includes(workspace)) {
                this.configWorkspace = workspace;
            }
            this.$nextTick(() => this.$refs.combinedTerminal?.updateTerminalSize?.());
        },

        selectConfigWorkspace() {
            this.selectWorkspace(this.configWorkspace);
        },

        updateVisualViewport() {
            const viewport = window.visualViewport;
            this.visualViewportHeight = viewport?.height || window.innerHeight;
            this.keyboardOpen = this.$root.isMobile && this.editorFocus && window.innerHeight - this.visualViewportHeight > 120;
            this.$nextTick(() => {
                this.$refs.editor?.view?.requestMeasure?.();
                this.$refs.envEditor?.view?.requestMeasure?.();
            });
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
.stack-page { display: flex; height: calc(100dvh - 112px); min-height: 560px; min-width: 0; flex-direction: column; overflow: hidden; }
.stack-header { display: flex; min-height: 44px; align-items: center; gap: 12px; flex: 0 0 auto; }
.stack-title { display: flex; min-width: 0; align-items: center; gap: 12px; }
.stack-title h1 { margin: 0; overflow: hidden; font-size: 25px; text-overflow: ellipsis; white-space: nowrap; }
.stack-state { white-space: nowrap; }
.stack-urls { display: flex; gap: 6px; margin: 4px 0; overflow-x: auto; }
.progress-terminal { flex: 0 0 150px; margin-bottom: 8px; overflow: hidden; }
.workspace-tabs { display: flex; min-height: 44px; align-items: stretch; gap: 2px; flex: 0 0 auto; border-bottom: 1px solid #dee2e6; }
.workspace-tabs button { padding: 0 16px; border: 0; border-bottom: 3px solid transparent; color: inherit; background: transparent; font-weight: 600; }
.workspace-tabs button.active { border-bottom-color: $primary; color: $primary; }
.dirty-indicator { align-self: center; margin-left: auto; padding-right: 12px; color: $warning; }
.workspace { flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden; border: 1px solid #dee2e6; border-top: 0; border-radius: 0 0 10px 10px; }
.workspace-scroll { height: 100%; overflow: auto; overscroll-behavior: contain; }
.overview-workspace { padding: 12px; }
.stack-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.stack-actions .btn { min-height: 40px; }
.container-list { width: 100%; }
.add-container { max-width: 700px; margin-bottom: 10px; }
.extra-settings { max-width: 1050px; margin-top: 10px; }
.logs-workspace, .editor-workspace { display: flex; width: 100%; height: 100%; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; }
.terminal { flex: 1; min-width: 0; min-height: 0; overflow: hidden; border-radius: 0; }
.editor-toolbar { display: flex; min-height: 42px; justify-content: flex-end; align-items: center; flex: 0 0 auto; padding: 4px 8px; border-bottom: 1px solid #dee2e6; }
.wrap-button { min-height: 34px; padding: 4px 9px; border: 1px solid #adb5bd; border-radius: 6px; color: inherit; background: transparent; font-size: 13px; }
.editor-view { position: relative; flex: 1; width: 100%; min-width: 0; min-height: 0; overflow: hidden; font-family: 'JetBrains Mono', monospace; font-size: 14px; }
.editor-view :deep(.vue-codemirror), .editor-view :deep(.cm-editor) { width: 100%; height: 100%; min-width: 0; }
.editor-view :deep(.cm-scroller) { overflow: auto; font-family: 'JetBrains Mono', monospace; }
.validation-error { position: absolute; right: 12px; bottom: 10px; max-width: calc(100% - 24px); padding: 6px 10px; border-radius: 5px; color: white; background: $danger; font: 12px BlinkMacSystemFont, sans-serif; }
.network-workspace { padding: 18px; }
.network-panel { width: min(100%, 720px); padding: 20px; }
.editor-actions { display: flex; min-height: 52px; align-items: center; gap: 8px; flex: 0 0 auto; padding: 5px 8px; border: 1px solid #dee2e6; border-top: 0; background: white; }
.save-state { margin-right: auto; color: #6c757d; font-size: 12px; }
.mobile-config-selector, .mobile-more, .mobile-bottom-nav { display: none; }
.icon-link { display: grid; width: 44px; height: 44px; padding: 0; color: inherit; font-size: 28px; text-decoration: none; place-items: center; }
:global(.dark) .workspace, :global(.dark) .workspace-tabs, :global(.dark) .editor-toolbar, :global(.dark) .editor-actions { border-color: $dark-border-color; }
:global(.dark) .editor-actions { color: $dark-font-color; background: $dark-bg; }
@media (max-width: 767.98px) {
    .stack-page { height: var(--visual-viewport-height, 100dvh); min-height: 0; padding: max(6px, env(safe-area-inset-top)) 8px calc(60px + env(safe-area-inset-bottom)); overflow: hidden; }
    .stack-header { min-height: 44px; }
    .stack-title { flex: 1; }
    .stack-title h1 { font-size: 19px; }
    .stack-state { font-size: 11px; }
    .stack-urls { display: none; }
    .progress-terminal { position: absolute; inset: 52px 8px calc(64px + env(safe-area-inset-bottom)); z-index: 20; margin: 0; }
    .mobile-config-selector { display: grid; min-height: 44px; align-items: center; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; flex: 0 0 auto; padding: 3px 0; }
    .mobile-config-selector label { font-size: 12px; font-weight: 700; }
    .mobile-config-selector .form-select { min-height: 38px; padding-top: 4px; padding-bottom: 4px; font-size: 16px; }
    .workspace { flex: 1; border: 0; border-radius: 0; }
    .overview-workspace { padding: 8px 0; }
    .stack-actions { flex-wrap: nowrap; gap: 6px; margin-bottom: 8px; overflow-x: auto; }
    .stack-actions .btn { min-height: 44px; flex: 0 0 auto; padding: 7px 10px; }
    .container-list { max-width: 100%; }
    .terminal { border-radius: 0; }
    .editor-toolbar { display: none; }
    .editor-view { max-width: 100%; font-size: 16px; }
    .editor-view :deep(.cm-content) { min-width: 0; padding-bottom: 68px; }
    .editor-view :deep(.cm-line) { padding-left: 4px; }
    .editor-view :deep(.cm-scroller) { max-width: 100%; overscroll-behavior: contain; }
    .network-workspace { padding: 8px 0 68px; }
    .network-panel { width: 100%; padding: 12px; }
    .network-panel :deep(input), .network-panel :deep(select) { min-height: 44px; font-size: 16px; }
    .mobile-more { display: grid; align-content: start; gap: 12px; flex: 1; padding: 18px 4px; }
    .mobile-more .btn { min-height: 48px; text-align: left; }
    .editor-actions { position: fixed; right: 0; bottom: calc(60px + env(safe-area-inset-bottom)); left: 0; z-index: 50; min-height: 50px; padding: 4px 8px; border-right: 0; border-left: 0; }
    .editor-actions .btn { min-height: 42px; padding: 5px 9px; font-size: 13px; }
    .mobile-bottom-nav { position: fixed; right: 0; bottom: 0; left: 0; z-index: 60; display: grid; grid-template-columns: repeat(4, 1fr); height: calc(60px + env(safe-area-inset-bottom)); padding-bottom: env(safe-area-inset-bottom); border-top: 1px solid #dee2e6; background: white; }
    .mobile-bottom-nav button { display: flex; min-width: 0; min-height: 60px; align-items: center; justify-content: center; flex-direction: column; gap: 2px; border: 0; color: #737980; background: transparent; font-size: 11px; }
    .mobile-bottom-nav button svg { font-size: 18px; }
    .mobile-bottom-nav button.active { color: $primary; font-weight: bold; }
    .keyboard-open { padding-top: max(2px, env(safe-area-inset-top)); padding-bottom: 50px; }
    .keyboard-open .stack-header { display: none; }
    .keyboard-open .mobile-config-selector { min-height: 40px; }
    .keyboard-open .editor-actions { bottom: 0; padding-bottom: max(4px, env(safe-area-inset-bottom)); }
    .keyboard-open .editor-view :deep(.cm-content) { padding-bottom: 56px; }
    :global(.dark) .mobile-bottom-nav { border-color: $dark-border-color; color: $dark-font-color; background: $dark-bg; }
}
@media (max-width: 350px) { .stack-state, .save-state { display: none; } .editor-actions { justify-content: flex-end; } .editor-actions .btn { font-size: 12px; } .editor-view :deep(.cm-gutters) { display: none; } }
@media (max-width: 900px) and (orientation: landscape) { .stack-page { padding-top: 2px; } }
</style>
