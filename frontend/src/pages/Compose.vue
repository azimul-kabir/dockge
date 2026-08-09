<template>
    <transition name="slide-fade" appear>
        <div :style="mobileViewportStyle">
            <button v-if="!isAdd" type="button" class="btn btn-link back-to-stacks" @click="scrollToStacks">
                <font-awesome-icon icon="chevron-up" class="me-1" />
                Back to stacks
            </button>
            <h1 v-if="isAdd" class="mb-3 stack-title">{{ $t("compose") }}</h1>
            <h1 v-else class="mb-3 stack-title">
                <Uptime :stack="globalStack" :pill="true" /> {{ stack.name }}
                <span v-if="$root.agentCount > 1 && endpoint !== ''" class="agent-name">
                    ({{ endpointDisplay }})
                </span>
            </h1>

            <div v-if="stack.isManagedByDockge" class="stack-actions mb-3" :class="{ 'mobile-edit-actions': isEditMode }">
                <div class="btn-group stack-primary-actions me-2" role="group">
                    <button v-if="isEditMode" class="btn btn-primary edit-deploy" :disabled="processing" @click="deployStack">
                        <font-awesome-icon icon="rocket" class="me-1" />
                        {{ $t("deployStack") }}
                    </button>

                    <button v-if="isEditMode" class="btn btn-normal edit-save" :disabled="processing" @click="saveStack">
                        <font-awesome-icon icon="save" class="me-1" />
                        {{ $t("saveStackDraft") }}
                    </button>

                    <button v-if="!isEditMode" class="btn btn-secondary" :disabled="processing" @click="enableEditMode">
                        <font-awesome-icon icon="pen" class="me-1" />
                        {{ $t("editStack") }}
                    </button>

                    <button v-if="!isEditMode && !active" class="btn btn-primary" :disabled="processing" @click="startStack">
                        <font-awesome-icon icon="play" class="me-1" />
                        {{ $t("startStack") }}
                    </button>

                    <button v-if="!isEditMode && active" class="btn btn-normal " :disabled="processing" @click="restartStack">
                        <font-awesome-icon icon="rotate" class="me-1" />
                        {{ $t("restartStack") }}
                    </button>

                    <button v-if="!isEditMode" class="btn btn-normal" :disabled="processing" @click="updateStack">
                        <font-awesome-icon icon="cloud-arrow-down" class="me-1" />
                        {{ $t("updateStack") }}
                    </button>

                    <button v-if="!isEditMode && active" class="btn btn-normal" :disabled="processing" @click="stopStack">
                        <font-awesome-icon icon="stop" class="me-1" />
                        {{ $t("stopStack") }}
                    </button>

                    <BDropdown right text="" variant="normal" class="edit-more">
                        <BDropdownItem @click="downStack">
                            <font-awesome-icon icon="stop" class="me-1" />
                            {{ $t("downStack") }}
                        </BDropdownItem>
                    </BDropdown>
                </div>

                <button v-if="isEditMode && !isNewComposeRoute" class="btn btn-normal edit-cancel" :disabled="processing" @click="discardStack">{{ $t("discardStack") }}</button>
                <button v-if="isEditMode && isNewComposeRoute" class="btn btn-normal edit-cancel" :disabled="processing" @click="cancelStack">{{ $t("cancel") }}</button>
                <button v-if="!isEditMode" class="btn btn-danger" :disabled="processing" @click="showDeleteDialog = !showDeleteDialog">
                    <font-awesome-icon icon="trash" class="me-1" />
                    {{ $t("deleteStack") }}
                </button>
            </div>

            <!-- URLs -->
            <div v-if="urls.length > 0" class="mb-3">
                <a v-for="(urlItem, index) in urls" :key="index" target="_blank" :href="urlItem.url">
                    <span class="badge bg-secondary me-2">{{ urlItem.display }}</span>
                </a>
            </div>

            <div v-if="stack.isManagedByDockge" class="stack-workspace">
                <div class="runtime-row">
                    <section class="stack-section" aria-labelledby="overview-heading">
                        <h2 id="overview-heading" class="stack-section-heading">Overview</h2>

                        <!-- General -->
                        <div v-if="isAdd">
                            <h4 class="mb-3">{{ $t("general") }}</h4>
                            <div class="shadow-box big-padding mb-3">
                                <!-- Stack Name -->
                                <div>
                                    <label for="name" class="form-label">{{ $t("stackName") }}</label>
                                    <input id="name" v-model="stack.name" type="text" class="form-control" required @blur="stackNameToLowercase">
                                    <div class="form-text">{{ $t("Lowercase only") }}</div>
                                </div>

                                <!-- Endpoint -->
                                <div class="mt-3">
                                    <label for="name" class="form-label">{{ $t("dockgeAgent") }}</label>
                                    <select v-model="stack.endpoint" class="form-select">
                                        <option v-for="(agent, agentEndpoint) in $root.agentList" :key="agentEndpoint" :value="agentEndpoint" :disabled="$root.agentStatusList[agentEndpoint] != 'online'">
                                            ({{ $root.agentStatusList[agentEndpoint] }}) {{ (agent.name !== '') ? agent.name : agent.url || $t("Current") }}
                                        </option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- Containers -->
                        <h4 class="mb-3">{{ $tc("container", 2) }}</h4>

                        <div v-if="isEditMode" class="input-group mb-3">
                            <input
                                v-model="newContainerName"
                                :placeholder="$t(`New Container Name...`)"
                                class="form-control"
                                @keyup.enter="addContainer"
                            />
                            <button class="btn btn-primary" @click="addContainer">
                                {{ $t("addContainer") }}
                            </button>
                        </div>

                        <div ref="containerList">
                            <Container
                                v-for="(service, name) in jsonConfig.services"
                                :key="name"
                                :name="name"
                                :is-edit-mode="isEditMode"
                                :first="name === Object.keys(jsonConfig.services)[0]"
                                :serviceStatus="serviceStatusList[name]"
                                :dockerStats="dockerStats"
                                @start-service="startService"
                                @stop-service="stopService"
                                @restart-service="restartService"
                            />
                        </div>

                        <button v-if="false && isEditMode && jsonConfig.services && Object.keys(jsonConfig.services).length > 0" class="btn btn-normal mb-3" @click="addContainer">{{ $t("addContainer") }}</button>

                        <!-- General -->
                        <div v-if="isEditMode">
                            <h4 class="mb-3">{{ $t("extra") }}</h4>
                            <div class="shadow-box big-padding mb-3">
                                <!-- URLs -->
                                <div class="mb-4">
                                    <label class="form-label">
                                        {{ $tc("url", 2) }}
                                    </label>
                                    <ArrayInput name="urls" :display-name="$t('url')" placeholder="https://" object-type="x-dockge" />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section class="stack-section" aria-labelledby="logs-heading">
                        <h2 id="logs-heading" class="stack-section-heading">Logs</h2>

                        <!-- Progress Terminal -->
                        <transition name="slide-fade" appear>
                            <Terminal
                                v-show="showProgressTerminal"
                                ref="progressTerminal"
                                class="mb-3 terminal progress-terminal"
                                :name="terminalName"
                                :endpoint="endpoint"
                                :rows="progressTerminalRows"
                                @has-data="showProgressTerminal = true; submitted = true;"
                            ></Terminal>
                        </transition>

                        <!-- Combined Terminal Output -->
                        <Terminal
                            v-show="!isAdd"
                            ref="combinedTerminal"
                            class="mb-3 terminal combined-terminal"
                            :name="combinedTerminalName"
                            :endpoint="endpoint"
                            :rows="combinedTerminalRows"
                            :cols="combinedTerminalCols"
                        ></Terminal>
                    </section>
                </div>

                <section ref="composeSection" class="stack-section" aria-labelledby="compose-heading">
                    <div class="stack-section-heading editor-heading">
                        <h2 id="compose-heading">Compose</h2>
                        <button type="button" class="btn btn-sm btn-normal wrap-toggle" :aria-pressed="composeWrapEnabled" @click="composeWrapEnabled = !composeWrapEnabled">
                            Wrap {{ composeWrapEnabled ? "On" : "Off" }}
                        </button>
                    </div>
                    <div id="compose-mobile-actions" class="mobile-editor-actions-slot"></div>
                    <h4 class="mb-3 stack-section-filename">{{ stack.composeFileName }}</h4>

                    <!-- YAML editor -->
                    <div class="shadow-box mb-3 editor-box" :class="{ 'edit-mode': isEditMode, 'keyboard-active-editor-box': mobileKeyboardOpen && activeEditorSection === 'compose' }">
                        <code-mirror
                            ref="editor"
                            v-model="stack.composeYAML"
                            :extensions="composeExtensions"
                            minimal
                            dark="true"
                            tab="true"
                            :disabled="!isEditMode"
                            :hasFocus="editorFocus"
                            @focus="setActiveEditorSection('compose', $event)"
                            @change="yamlCodeChange"
                        />
                    </div>
                    <div v-if="isEditMode" class="mb-3">
                        {{ yamlError }}
                    </div>
                </section>

                <section ref="environmentSection" class="stack-section" aria-labelledby="environment-heading">
                    <div class="stack-section-heading editor-heading">
                        <h2 id="environment-heading">Environment</h2>
                        <button type="button" class="btn btn-sm btn-normal wrap-toggle" :aria-pressed="environmentWrapEnabled" @click="environmentWrapEnabled = !environmentWrapEnabled">
                            Wrap {{ environmentWrapEnabled ? "On" : "Off" }}
                        </button>
                    </div>
                    <div id="environment-mobile-actions" class="mobile-editor-actions-slot"></div>
                    <h4 class="mb-3 stack-section-filename">.env</h4>
                    <div class="shadow-box mb-3 editor-box" :class="{ 'edit-mode': isEditMode, 'keyboard-active-editor-box': mobileKeyboardOpen && activeEditorSection === 'environment' }">
                        <code-mirror
                            ref="envEditor"
                            v-model="stack.composeENV"
                            :extensions="environmentExtensions"
                            minimal
                            dark="true"
                            tab="true"
                            :disabled="!isEditMode"
                            :hasFocus="editorFocus"
                            @focus="setActiveEditorSection('environment', $event)"
                            @change="yamlCodeChange"
                        />
                    </div>
                </section>

                <Teleport v-if="isEditMode" :to="mobileEditorActionsTarget">
                    <div class="mobile-editor-actions" aria-label="Editor actions">
                        <button v-if="!isNewComposeRoute" class="btn btn-normal" :disabled="processing" @click="discardStack">{{ $t("discardStack") }}</button>
                        <button v-else class="btn btn-normal" :disabled="processing" @click="cancelStack">{{ $t("cancel") }}</button>
                        <button class="btn btn-normal" :disabled="processing" @click="saveStack">
                            <font-awesome-icon icon="save" class="me-1" />
                            {{ $t("saveStackDraft") }}
                        </button>
                        <button class="btn btn-primary" :disabled="processing" @click="deployStack">
                            <font-awesome-icon icon="rocket" class="me-1" />
                            {{ $t("deployStack") }}
                        </button>
                    </div>
                </Teleport>

                <section class="stack-section" aria-labelledby="networks-heading">
                    <h2 id="networks-heading" class="stack-section-heading">Networks</h2>

                    <!-- Volumes -->
                    <div v-if="false">
                        <h4 class="mb-3">{{ $tc("volume", 2) }}</h4>
                        <div class="shadow-box big-padding mb-3">
                        </div>
                    </div>

                    <fieldset :disabled="!isEditMode" class="network-fieldset">
                        <div class="shadow-box big-padding mb-3" :class="{ 'read-only': !isEditMode }">
                            <NetworkInput />
                        </div>
                    </fieldset>
                </section>
            </div>

            <div v-if="!stack.isManagedByDockge && !processing">
                {{ $t("stackNotManagedByDockgeMsg") }}
            </div>

            <!-- Delete Dialog -->
            <BModal v-model="showDeleteDialog" :cancelTitle="$t('cancel')" :okTitle="$t('deleteStack')" okVariant="danger" @ok="deleteDialog">
                {{ $t("deleteStackMsg") }}
            </BModal>
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
            composeWrapEnabled: window.matchMedia("(max-width: 767.98px)").matches,
            environmentWrapEnabled: window.matchMedia("(max-width: 767.98px)").matches,
            mobileKeyboardOffset: 0,
            mobileVisualTop: 0,
            mobileEditorHeight: 0,
            mobileEditorNeedsAlignment: true,
            activeEditorSection: "compose",
        };
    },
    computed: {
        composeExtensions() {
            return this.composeWrapEnabled ? [ ...this.extensions, EditorView.lineWrapping ] : this.extensions;
        },

        environmentExtensions() {
            return this.environmentWrapEnabled ? [ ...this.extensionsEnv, EditorView.lineWrapping ] : this.extensionsEnv;
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

        isNewComposeRoute() {
            return this.$route.path === "/compose";
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

        mobileViewportStyle() {
            return {
                "--mobile-keyboard-offset": `${this.mobileKeyboardOffset}px`,
                "--mobile-visual-top": `${this.mobileVisualTop}px`,
                "--mobile-editor-height": `${this.mobileEditorHeight}px`,
            };
        },

        mobileKeyboardOpen() {
            return this.mobileKeyboardOffset > 0;
        },

        mobileEditorActionsTarget() {
            return `#${this.activeEditorSection}-mobile-actions`;
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

        } else {
            this.stack.name = this.$route.params.stackName;
            this.loadStack();
        }

        this.requestServiceStatus();
        this.requestDockerStats();
        window.visualViewport?.addEventListener("resize", this.updateMobileViewport);
        window.visualViewport?.addEventListener("scroll", this.updateMobileViewport);
        window.addEventListener("orientationchange", this.updateMobileViewport);
    },
    unmounted() {
        window.visualViewport?.removeEventListener("resize", this.updateMobileViewport);
        window.visualViewport?.removeEventListener("scroll", this.updateMobileViewport);
        window.removeEventListener("orientationchange", this.updateMobileViewport);
    },
    methods: {
        updateMobileViewport() {
            if (!window.matchMedia("(max-width: 767.98px)").matches || !window.visualViewport) {
                this.mobileKeyboardOffset = 0;
                this.mobileVisualTop = 0;
                this.mobileEditorHeight = 0;
                this.mobileEditorNeedsAlignment = true;
                return;
            }

            const viewport = window.visualViewport;
            const activeEditor = document.activeElement?.closest?.(".cm-editor");
            const keyboardOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
            this.mobileKeyboardOffset = keyboardOffset > 80 && activeEditor ? keyboardOffset : 0;
            this.mobileVisualTop = this.mobileKeyboardOffset ? viewport.offsetTop : 0;

            if (this.mobileKeyboardOffset) {
                const actionBar = this.$el.querySelector(".mobile-editor-actions");
                const activeSection = this.$refs[`${this.activeEditorSection}Section`];
                const heading = activeSection?.querySelector(".editor-heading");
                const filename = activeSection?.querySelector(".stack-section-filename");
                const reservedHeight = (heading?.offsetHeight || 52) + (actionBar?.offsetHeight || 60) + (filename?.offsetHeight || 24) + 40;
                const availableEditorHeight = viewport.height - reservedHeight;
                this.mobileEditorHeight = Math.min(280, Math.max(200, availableEditorHeight));

                this.$nextTick(() => requestAnimationFrame(() => {
                    const editorRef = activeEditor === this.$refs.editor?.view?.dom
                        ? this.$refs.editor
                        : this.$refs.envEditor;
                    const cursorPosition = editorRef?.view?.state.selection.main.head;
                    editorRef?.view?.requestMeasure();
                    if (cursorPosition !== undefined) {
                        editorRef.view.dispatch({
                            effects: EditorView.scrollIntoView(cursorPosition, {
                                y: "nearest",
                                yMargin: 12
                            })
                        });
                    }

                    const sectionRect = activeSection?.getBoundingClientRect();
                    const visibleTop = viewport.offsetTop + 8;
                    if (this.mobileEditorNeedsAlignment && sectionRect && Math.abs(sectionRect.top - visibleTop) > 8) {
                        window.scrollBy({
                            top: sectionRect.top - visibleTop,
                            behavior: "auto"
                        });
                    }
                    this.mobileEditorNeedsAlignment = false;

                    const cursorRect = cursorPosition === undefined
                        ? activeEditor.getBoundingClientRect()
                        : editorRef.view.coordsAtPos(cursorPosition);
                    const visibleBottom = viewport.offsetTop + viewport.height - 8;
                    if (cursorRect?.bottom > visibleBottom) {
                        window.scrollBy({
                            top: cursorRect.bottom - visibleBottom,
                            behavior: "auto"
                        });
                    }
                }));
            } else {
                this.mobileEditorHeight = 0;
                this.mobileEditorNeedsAlignment = true;
            }
        },

        setActiveEditorSection(section, focused) {
            if (focused && this.activeEditorSection !== section) {
                this.activeEditorSection = section;
                this.mobileEditorNeedsAlignment = true;
            }
        },

        scrollToStacks() {
            document.getElementById("stack-list-start")?.scrollIntoView({ behavior: "smooth",
                block: "start" });
        },

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

        cancelStack() {
            this.$router.push("/");
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

.terminal {
    height: 200px;
}

@media (min-width: 768px) {
    .combined-terminal {
        height: clamp(280px, 35vh, 340px);
    }
}

.stack-workspace {
    width: 100%;
    min-width: 0;
}

.runtime-row {
    min-width: 0;
}

@media (min-width: 1200px) {
    .runtime-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
        gap: 1.5rem;
        align-items: start;
    }
}

.stack-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    min-width: 0;
}

.stack-primary-actions {
    flex-wrap: wrap;
    max-width: 100%;
}

.stack-section {
    width: 100%;
    min-width: 0;
    padding-top: 0.25rem;
    margin-bottom: 2.5rem;
}

.stack-section-heading {
    padding-bottom: 0.65rem;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid rgba(127, 127, 127, 0.25);
    font-size: 1.35rem;
}

.editor-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;

    h2 {
        margin: 0;
        font-size: inherit;
    }
}

.wrap-toggle {
    flex: 0 0 auto;
    min-width: 78px;
}

.back-to-stacks {
    display: none;
}

.stack-section-filename {
    font-size: 1rem;
    color: $dark-font-color3;
}

.network-fieldset {
    min-width: 0;
    padding: 0;
    margin: 0;
    border: 0;

    .read-only {
        opacity: 0.8;
        pointer-events: none;
    }
}

.editor-box {
    width: 100%;
    min-width: 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
}

.mobile-editor-actions-slot {
    display: none;
}

.agent-name {
    font-size: 13px;
    color: $dark-font-color3;
}

@media (max-width: 767.98px) {
    .back-to-stacks {
        display: inline-flex;
        align-items: center;
        min-height: 40px;
        margin: 0 0 0.25rem;
        padding: 0.25rem 0;
        font-size: 0.9rem;
        text-decoration: none;
    }

    .editor-heading {
        gap: 0.5rem;
    }

    .wrap-toggle {
        min-height: 40px;
    }

    .stack-title {
        max-width: 100%;
        overflow-wrap: anywhere;
        font-size: clamp(1.55rem, 8vw, 2rem);
    }

    .stack-actions.mobile-edit-actions {
        display: none;
    }

    .mobile-editor-actions-slot {
        display: block;
        min-width: 0;
    }

    .mobile-editor-actions {
        display: flex;
        position: sticky;
        top: calc(var(--mobile-visual-top, 0px) + 8px);
        z-index: 10;
        gap: 0.5rem;
        width: 100%;
        min-width: 0;
        margin: 0 0 0.75rem;
        padding: 0.4rem;
        border: 1px solid rgba(127, 127, 127, 0.2);
        border-radius: 0.5rem;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

        .dark & {
            background: rgba($dark-bg2, 0.96);
        }

        > .btn {
            flex: 1 1 0;
            min-width: 0;
            min-height: 44px;
            padding-right: 0.5rem;
            padding-left: 0.5rem;
        }
    }

    .stack-section {
        margin-bottom: 2rem;
    }

    .terminal {
        width: 100%;
        max-width: 100%;
        height: clamp(240px, 38vh, 280px);
        overflow: hidden;
        touch-action: pan-y;
    }

    .editor-box {
        max-width: 100%;
        overflow: hidden;
        font-size: 16px;
    }

    .editor-box :deep(.cm-editor),
    .editor-box :deep(.cm-content) {
        min-width: 0;
        font-size: 16px;
    }

    .editor-box :deep(.cm-scroller) {
        min-width: 0;
        max-width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }

    .keyboard-active-editor-box,
    .keyboard-active-editor-box :deep(.vue-codemirror),
    .keyboard-active-editor-box :deep(.cm-editor),
    .keyboard-active-editor-box :deep(.cm-scroller) {
        height: var(--mobile-editor-height);
        min-height: var(--mobile-editor-height);
    }

    .shadow-box.big-padding {
        padding: 1rem;
    }

    .input-group {
        min-width: 0;
        flex-wrap: wrap;
    }

    .form-control,
    .form-select {
        min-width: 0;
        font-size: 16px;
    }
}
</style>
