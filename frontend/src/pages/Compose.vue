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

                    <button v-if="!isEditMode && !isAdd" class="btn btn-normal" :disabled="processing || checkingImages" @click="checkImages">
                        <font-awesome-icon icon="arrows-rotate" class="me-1" />
                        {{ checkingImages ? "Checking…" : "Check images" }}
                    </button>

                    <button v-if="!isEditMode && active" class="btn btn-normal" :disabled="processing" @click="stopStack">
                        <font-awesome-icon icon="stop" class="me-1" />
                        {{ $t("stopStack") }}
                    </button>

                    <button v-if="!isEditMode && !isAdd" class="btn btn-normal" :disabled="processing" @click="toggleHistory">
                        <font-awesome-icon icon="clock-rotate-left" class="me-1" />
                        History
                    </button>

                    <BDropdown right text="More" variant="normal" class="edit-more">
                        <BDropdownItem @click="downStack">
                            <font-awesome-icon icon="stop" class="me-1" />
                            {{ $t("downStack") }}
                        </BDropdownItem>
                    </BDropdown>
                </div>

                <button v-if="isEditMode && !isNewComposeRoute" class="btn btn-normal edit-cancel" :disabled="processing" @click="discardStack">{{ $t("discardStack") }}</button>
                <button v-if="isEditMode && isNewComposeRoute" class="btn btn-normal edit-cancel" :disabled="processing" @click="cancelStack">{{ $t("cancel") }}</button>
                <button v-if="!isEditMode" class="btn btn-danger stack-delete-action" :disabled="processing" @click="showDeleteDialog = !showDeleteDialog">
                    <font-awesome-icon icon="trash" class="me-1" />
                    {{ $t("deleteStack") }}
                </button>
            </div>

            <section v-if="showHistory && !isAdd" class="stack-section history-panel" aria-labelledby="history-heading">
                <div class="stack-section-heading editor-heading">
                    <h2 id="history-heading">Configuration History</h2>
                    <button type="button" class="btn btn-sm btn-normal" @click="showHistory = false">Close</button>
                </div>
                <div class="shadow-box big-padding mb-3">
                    <div v-if="historyLoading">Loading revisions…</div>
                    <div v-else-if="historyRevisions.length === 0" class="text-muted">No saved revisions yet. A revision is created before an existing stack is changed.</div>
                    <div v-else class="history-list">
                        <div v-for="revision in historyRevisions" :key="revision.id" class="history-row">
                            <div class="history-meta">
                                <strong>{{ formatRevisionDate(revision.createdAt) }}</strong>
                                <div v-if="revision.changes" class="history-changes" aria-label="Changes after this snapshot">
                                    <span v-for="item in historyChangeItems(revision.changes)" :key="item.label" class="history-change">
                                        <span class="history-change-label">{{ item.label }}</span>
                                        <span class="history-addition">+{{ item.counts.additions }}</span>
                                        <span class="history-deletion">-{{ item.counts.deletions }}</span>
                                    </span>
                                    <span v-if="!hasHistoryChanges(revision.changes)" class="text-muted">No textual changes</span>
                                </div>
                            </div>
                            <div class="history-actions">
                                <button class="btn btn-sm btn-normal" :disabled="processing" @click="previewRevision(revision.id)">Preview</button>
                                <button class="btn btn-sm btn-danger" :disabled="processing" @click="restoreRevision(revision.id)">Restore</button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- URLs -->
            <div v-if="urls.length > 0" class="mb-3">
                <a v-for="(urlItem, index) in urls" :key="index" target="_blank" :href="urlItem.url">
                    <span class="badge bg-secondary me-2">{{ urlItem.display }}</span>
                </a>
            </div>

            <section v-if="stack.isManagedByDockge && !isAdd" class="service-summary" aria-labelledby="service-summary-heading">
                <div class="service-summary-title">
                    <h2 id="service-summary-heading">{{ $tc("container", serviceRows.length) }}</h2>
                    <span>{{ serviceRows.length }}</span>
                </div>
                <div class="service-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Service</th>
                                <th>Image</th>
                                <th>State</th>
                                <th>Uptime</th>
                                <th>IP / Ports</th>
                                <th>CPU</th>
                                <th>Memory</th>
                                <th>Network I/O</th>
                                <th class="actions-heading">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="row in serviceRows" :key="row.name">
                                <td><span class="service-dot" :class="row.stateClass"></span><strong>{{ row.name }}</strong></td>
                                <td class="mono muted">{{ row.image }}</td>
                                <td><span class="service-state" :class="row.stateClass">{{ row.state }}</span></td>
                                <td class="mono">{{ row.uptime }}</td>
                                <td class="mono ports">
                                    <span v-if="row.internalIP" class="internal-ip">{{ row.internalIP }}</span>
                                    <template v-for="port in row.ports" :key="port.display">
                                        <a v-if="port.url" :href="port.url" target="_blank" rel="noopener noreferrer">{{ port.display }}</a>
                                        <span v-else>{{ port.display }}</span>
                                    </template>
                                    <span v-if="row.ports.length === 0">—</span>
                                </td>
                                <td class="mono">{{ row.cpu }}</td>
                                <td class="mono">{{ row.memory }}</td>
                                <td class="mono">{{ row.network }}</td>
                                <td class="service-actions">
                                    <BDropdown right text="Actions" size="sm" variant="normal">
                                        <template v-if="isEditMode">
                                            <BDropdownItem @click="editService(row.name)">
                                                <font-awesome-icon icon="pen" class="me-1" /> Configure
                                            </BDropdownItem>
                                            <BDropdownItem @click="removeService(row.name)">
                                                <font-awesome-icon icon="trash" class="me-1" /> {{ $t("deleteContainer") }}
                                            </BDropdownItem>
                                        </template>
                                        <template v-else>
                                            <BDropdownItem :to="serviceTerminalRoute(row.name)">
                                                <font-awesome-icon icon="terminal" class="me-1" /> Bash
                                            </BDropdownItem>
                                            <BDropdownItem v-if="serviceRows.length > 1" :disabled="processing" @click="restartService(row.name)">
                                                <font-awesome-icon icon="rotate" class="me-1" /> {{ $t("restartStack") }}
                                            </BDropdownItem>
                                            <BDropdownItem v-if="serviceRows.length > 1" :disabled="processing" @click="stopService(row.name)">
                                                <font-awesome-icon icon="stop" class="me-1" /> {{ $t("stopStack") }}
                                            </BDropdownItem>
                                        </template>
                                    </BDropdown>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <div v-if="stack.isManagedByDockge" class="stack-workspace">
                <section v-if="isEditMode || isAdd" class="stack-section container-configuration" aria-labelledby="configuration-heading">
                    <h2 id="configuration-heading" class="stack-section-heading">Container configuration</h2>

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
                    <h4 v-if="isEditMode || isAdd" class="mb-3">{{ $tc("container", 2) }}</h4>

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

                    <div v-if="isEditMode || isAdd" ref="containerList">
                        <div v-for="(service, name) in jsonConfig.services" :id="`service-config-${serviceAnchor(name)}`" :key="name" class="service-config-card">
                            <Container
                                :name="name"
                                :is-edit-mode="isEditMode"
                                :first="name === Object.keys(jsonConfig.services)[0]"
                                :serviceStatus="serviceStatusList[name]"
                                :image-update-status="imageUpdateStatus[name]"
                                :dockerStats="dockerStats"
                                @start-service="startService"
                                @stop-service="stopService"
                                @restart-service="restartService"
                            />
                        </div>
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

                <section class="stack-section logs-section" aria-labelledby="logs-heading">
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

                <section ref="composeSection" class="stack-section" :class="{ 'editor-fullscreen-section': fullscreenEditor === 'compose' }" aria-labelledby="compose-heading">
                    <div class="stack-section-heading editor-heading">
                        <h2 id="compose-heading">Compose</h2>
                        <div class="editor-heading-actions">
                            <button type="button" class="btn btn-sm btn-normal wrap-toggle" :aria-pressed="composeWrapEnabled" @click="composeWrapEnabled = !composeWrapEnabled">
                                Wrap {{ composeWrapEnabled ? "On" : "Off" }}
                            </button>
                            <button type="button" class="btn btn-sm btn-normal fullscreen-toggle" :aria-pressed="fullscreenEditor === 'compose'" @click="toggleFullscreenEditor('compose')">
                                <font-awesome-icon :icon="fullscreenEditor === 'compose' ? 'compress' : 'expand'" class="me-1" />
                                {{ fullscreenEditor === 'compose' ? "Exit" : "Full screen" }}
                            </button>
                        </div>
                    </div>
                    <div v-if="isEditMode && activeEditorSection === 'compose'" class="mobile-editor-actions-slot">
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
                    </div>
                    <h4 class="mb-3 stack-section-filename">{{ stack.composeFileName }}</h4>

                    <!-- YAML editor -->
                    <div class="shadow-box mb-3 editor-box" :class="{ 'edit-mode': isEditMode, 'keyboard-active-editor-box': mobileKeyboardOpen && activeEditorSection === 'compose', 'fullscreen-editor-box': fullscreenEditor === 'compose' }">
                        <code-mirror
                            ref="editor"
                            v-model="stack.composeYAML"
                            :extensions="composeExtensions"
                            minimal
                            :dark="$root.isDark"
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

                <section v-if="!isAdd && stack.composeOverrideExists" ref="overrideSection" class="stack-section" :class="{ 'editor-fullscreen-section': fullscreenEditor === 'override' }" aria-labelledby="override-heading">
                    <div class="stack-section-heading editor-heading">
                        <h2 id="override-heading">Compose Override</h2>
                        <div class="editor-heading-actions">
                            <button type="button" class="btn btn-sm btn-normal wrap-toggle" :aria-pressed="overrideWrapEnabled" @click="overrideWrapEnabled = !overrideWrapEnabled">
                                Wrap {{ overrideWrapEnabled ? "On" : "Off" }}
                            </button>
                            <button type="button" class="btn btn-sm btn-normal fullscreen-toggle" :aria-pressed="fullscreenEditor === 'override'" @click="toggleFullscreenEditor('override')">
                                <font-awesome-icon :icon="fullscreenEditor === 'override' ? 'compress' : 'expand'" class="me-1" />
                                {{ fullscreenEditor === 'override' ? "Exit" : "Full screen" }}
                            </button>
                        </div>
                    </div>
                    <div v-if="isEditMode && activeEditorSection === 'override'" class="mobile-editor-actions-slot">
                        <div class="mobile-editor-actions" aria-label="Editor actions">
                            <button class="btn btn-normal" :disabled="processing" @click="discardStack">{{ $t("discardStack") }}</button>
                            <button class="btn btn-normal" :disabled="processing" @click="saveStack">
                                <font-awesome-icon icon="save" class="me-1" />
                                {{ $t("saveStackDraft") }}
                            </button>
                            <button class="btn btn-primary" :disabled="processing" @click="deployStack">
                                <font-awesome-icon icon="rocket" class="me-1" />
                                {{ $t("deployStack") }}
                            </button>
                        </div>
                    </div>
                    <h4 class="mb-3 stack-section-filename">{{ stack.composeOverrideFileName || "compose.override.yaml" }}</h4>
                    <div class="shadow-box mb-3 editor-box" :class="{ 'edit-mode': isEditMode, 'keyboard-active-editor-box': mobileKeyboardOpen && activeEditorSection === 'override', 'fullscreen-editor-box': fullscreenEditor === 'override' }">
                        <code-mirror
                            ref="overrideEditor"
                            v-model="stack.composeOverrideYAML"
                            :extensions="overrideExtensions"
                            minimal
                            :dark="$root.isDark"
                            tab="true"
                            :disabled="!isEditMode"
                            :hasFocus="editorFocus"
                            @focus="setActiveEditorSection('override', $event)"
                            @change="yamlCodeChange"
                        />
                    </div>
                </section>

                <section v-if="isEditMode" ref="environmentSection" class="stack-section" :class="{ 'editor-fullscreen-section': fullscreenEditor === 'environment' }" aria-labelledby="environment-heading">
                    <div class="stack-section-heading editor-heading">
                        <h2 id="environment-heading">Environment</h2>
                        <div class="editor-heading-actions">
                            <button type="button" class="btn btn-sm btn-normal wrap-toggle" :aria-pressed="environmentWrapEnabled" @click="environmentWrapEnabled = !environmentWrapEnabled">
                                Wrap {{ environmentWrapEnabled ? "On" : "Off" }}
                            </button>
                            <button type="button" class="btn btn-sm btn-normal fullscreen-toggle" :aria-pressed="fullscreenEditor === 'environment'" @click="toggleFullscreenEditor('environment')">
                                <font-awesome-icon :icon="fullscreenEditor === 'environment' ? 'compress' : 'expand'" class="me-1" />
                                {{ fullscreenEditor === 'environment' ? "Exit" : "Full screen" }}
                            </button>
                        </div>
                    </div>
                    <div v-if="isEditMode && activeEditorSection === 'environment'" class="mobile-editor-actions-slot">
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
                    </div>
                    <h4 class="mb-3 stack-section-filename">.env</h4>
                    <div class="shadow-box mb-3 editor-box" :class="{ 'edit-mode': isEditMode, 'keyboard-active-editor-box': mobileKeyboardOpen && activeEditorSection === 'environment', 'fullscreen-editor-box': fullscreenEditor === 'environment' }">
                        <code-mirror
                            ref="envEditor"
                            v-model="stack.composeENV"
                            :extensions="environmentExtensions"
                            minimal
                            :dark="$root.isDark"
                            tab="true"
                            :disabled="!isEditMode"
                            :hasFocus="editorFocus"
                            @focus="setActiveEditorSection('environment', $event)"
                            @change="yamlCodeChange"
                        />
                    </div>
                    <div v-if="environmentVariableStatuses.length > 0" class="shadow-box environment-intelligence" aria-labelledby="environment-variables-heading">
                        <div class="environment-intelligence-heading">
                            <h4 id="environment-variables-heading">Environment Variables</h4>
                            <span class="text-muted">Names and stack .env status only</span>
                        </div>
                        <h5 v-if="referencedEnvironmentVariables.length > 0" class="environment-variable-section-heading">Referenced variables</h5>
                        <div v-if="referencedEnvironmentVariables.length > 0" class="environment-variable-list">
                            <div v-for="variable in referencedEnvironmentVariables" :key="variable.name" class="environment-variable-row">
                                <span class="environment-variable-name">
                                    <span class="environment-variable-symbol" :class="`is-${variable.status}`" aria-hidden="true">{{ environmentVariableSymbol(variable.status) }}</span>
                                    <code>{{ variable.name }}</code>
                                </span>
                                <span
                                    class="environment-variable-status"
                                    :class="`is-${variable.status}`"
                                    :title="variable.status === 'not-in-stack' ? 'This value may be supplied by global.env or another Compose environment source.' : undefined"
                                >{{ environmentVariableStatusLabel(variable.status) }}</span>
                            </div>
                        </div>
                        <p v-if="usesEnvFile" class="environment-intelligence-note text-muted">
                            This stack uses env_file. Variables not referenced with ${…} may still be passed to a service and used by the application.
                        </p>
                        <p v-if="hasVariablesNotInStackEnvironment" class="environment-intelligence-note text-muted">
                            Variables not in stack .env may be supplied by global.env or another Compose environment source.
                        </p>
                        <div v-if="notReferencedEnvironmentVariables.length > 0" class="environment-not-referenced">
                            <div class="environment-not-referenced-summary">
                                <span class="environment-not-referenced-summary-text">{{ notReferencedEnvironmentVariables.length }} {{ notReferencedEnvironmentVariables.length === 1 ? "variable" : "variables" }} not referenced in Compose</span>
                                <button type="button" class="btn btn-sm btn-normal" :aria-expanded="showNotReferencedVariables" aria-controls="not-referenced-environment-variables" @click="showNotReferencedVariables = !showNotReferencedVariables">
                                    {{ showNotReferencedVariables ? "Hide" : "Show" }}
                                </button>
                            </div>
                            <div v-if="showNotReferencedVariables" id="not-referenced-environment-variables" class="environment-variable-list">
                                <div v-for="variable in notReferencedEnvironmentVariables" :key="variable.name" class="environment-variable-row">
                                    <span class="environment-variable-name">
                                        <span class="environment-variable-symbol is-not-referenced" aria-hidden="true">{{ environmentVariableSymbol(variable.status) }}</span>
                                        <code>{{ variable.name }}</code>
                                    </span>
                                    <span class="environment-variable-status is-not-referenced">{{ environmentVariableStatusLabel(variable.status) }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section v-if="isEditMode" class="stack-section" aria-labelledby="networks-heading">
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
import { lightCodeMirrorTheme } from "../util/codemirror-theme";
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
import { buildEnvironmentVariableStatuses, composeUsesEnvFile } from "../util/environment-intelligence";

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
            yaml(),
            lineNumbers(),
            EditorView.focusChangeEffect.of(focusEffectHandler)
        ];

        const extensionsEnv = [
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
                composeOverrideYAML: "",
                composeOverrideFileName: "compose.override.yaml",
            },
            serviceStatusList: {},
            imageUpdateStatus: {},
            checkingImages: false,
            dockerStats: {},
            isEditMode: false,
            submitted: false,
            showDeleteDialog: false,
            newContainerName: "",
            stopServiceStatusTimeout: false,
            stopDockerStatsTimeout: false,
            composeWrapEnabled: window.matchMedia("(max-width: 767.98px)").matches,
            overrideWrapEnabled: window.matchMedia("(max-width: 767.98px)").matches,
            environmentWrapEnabled: window.matchMedia("(max-width: 767.98px)").matches,
            mobileKeyboardOffset: 0,
            mobileVisualTop: 0,
            mobileEditorHeight: 0,
            mobileEditorNeedsAlignment: true,
            activeEditorSection: "compose",
            fullscreenEditor: null,
            showHistory: false,
            historyLoading: false,
            historyRevisions: [],
            showNotReferencedVariables: false,
        };
    },
    computed: {
        composeExtensions() {
            const extensions = [
                ...(this.$root.isDark ? [ editorTheme ] : lightCodeMirrorTheme),
                ...this.extensions,
            ];
            return this.composeWrapEnabled ? [ ...extensions, EditorView.lineWrapping ] : extensions;
        },

        overrideExtensions() {
            const extensions = [
                ...(this.$root.isDark ? [ editorTheme ] : lightCodeMirrorTheme),
                ...this.extensions,
            ];
            return this.overrideWrapEnabled ? [ ...extensions, EditorView.lineWrapping ] : extensions;
        },

        environmentExtensions() {
            const extensions = [
                ...(this.$root.isDark ? [ editorTheme ] : lightCodeMirrorTheme),
                ...this.extensionsEnv,
            ];
            return this.environmentWrapEnabled ? [ ...extensions, EditorView.lineWrapping ] : extensions;
        },

        environmentVariableStatuses() {
            const stackEnvironment = dotenv.parse(this.stack.composeENV || "");
            return buildEnvironmentVariableStatuses(this.stack.composeYAML || "", stackEnvironment);
        },

        hasVariablesNotInStackEnvironment() {
            return this.environmentVariableStatuses.some((variable) => variable.status === "not-in-stack");
        },

        referencedEnvironmentVariables() {
            return this.environmentVariableStatuses.filter((variable) => variable.status !== "not-referenced");
        },

        notReferencedEnvironmentVariables() {
            return this.environmentVariableStatuses.filter((variable) => variable.status === "not-referenced");
        },

        usesEnvFile() {
            return composeUsesEnvFile(this.stack.composeYAML || "");
        },

        serviceRows() {
            return Object.keys(this.jsonConfig.services || {}).map((name) => {
                const instances = this.serviceStatusList[name] || [];
                const instance = instances[0] || {};
                const stat = instances.map((item) => this.dockerStats[item.name]).find(Boolean) || {};
                const configuredImage = this.envsubstJSONConfig.services?.[name]?.image;
                const state = instance.status || "inactive";
                const stateClass = [ "running", "healthy" ].includes(state) ? "active" : state === "unhealthy" ? "danger" : "inactive";
                const seenPorts = new Set();
                const ports = (instance.publishers || []).map((publisher) => {
                    const target = publisher.TargetPort || "";
                    const published = publisher.PublishedPort;
                    const protocol = publisher.Protocol ? `/${publisher.Protocol}` : "";
                    const display = published ? `${published}→${target}${protocol}` : `${target}${protocol}`;
                    const key = `${published || ""}:${target}:${protocol}`;
                    if (seenPorts.has(key)) {
                        return null;
                    }
                    seenPorts.add(key);
                    const hostname = this.stack.primaryHostname || window.location.hostname;
                    return {
                        display,
                        url: published ? `http://${hostname}:${published}` : "",
                    };
                }).filter((port) => port?.display);

                return {
                    name,
                    image: instance.image || configuredImage || "—",
                    state,
                    stateClass,
                    isRunning: [ "running", "healthy", "unhealthy" ].includes(state),
                    internalIP: instance.internalIP || "",
                    uptime: instance.runningFor || "—",
                    ports,
                    cpu: stat.CPUPerc || "—",
                    memory: stat.MemUsage || "—",
                    network: stat.NetIO || "—",
                };
            });
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

        "stack.composeOverrideYAML": {
            handler() {
                if (this.editorFocus) {
                    console.debug("override yaml code changed");
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
            if (to.params.stackName !== from.params.stackName || to.params.endpoint !== from.params.endpoint) {
                this.showNotReferencedVariables = false;
            }
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
                composeOverrideYAML: "",
                composeOverrideFileName: "compose.override.yaml",
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
        window.addEventListener("keydown", this.handleFullscreenEscape);
    },
    unmounted() {
        window.visualViewport?.removeEventListener("resize", this.updateMobileViewport);
        window.visualViewport?.removeEventListener("scroll", this.updateMobileViewport);
        window.removeEventListener("orientationchange", this.updateMobileViewport);
        window.removeEventListener("keydown", this.handleFullscreenEscape);
        document.body.classList.remove("dockge-editor-fullscreen");
    },
    methods: {
        serviceTerminalRoute(serviceName) {
            if (this.endpoint) {
                return {
                    name: "containerTerminalEndpoint",
                    params: {
                        endpoint: this.endpoint,
                        stackName: this.stack.name,
                        serviceName,
                        type: "bash",
                    },
                };
            }
            return {
                name: "containerTerminal",
                params: {
                    stackName: this.stack.name,
                    serviceName,
                    type: "bash",
                },
            };
        },

        serviceAnchor(name) {
            return String(name).replace(/[^a-zA-Z0-9_-]/g, "-");
        },

        editService(name) {
            this.$nextTick(() => {
                const card = document.getElementById(`service-config-${this.serviceAnchor(name)}`);
                card?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
                if (!card?.querySelector(".config")) {
                    card?.querySelector(".container-config-trigger")?.click();
                }
            });
        },

        removeService(name) {
            if (confirm(`Delete the ${name} service from this stack configuration?`)) {
                delete this.jsonConfig.services[name];
            }
        },

        environmentVariableSymbol(status) {
            return {
                defined: "✓",
                "not-in-stack": "⚠",
                "not-referenced": "○",
            }[status];
        },

        environmentVariableStatusLabel(status) {
            return {
                defined: "Defined in .env",
                "not-in-stack": "Not in stack .env",
                "not-referenced": "Not referenced in Compose",
            }[status];
        },

        toggleHistory() {
            this.showHistory = !this.showHistory;
            if (this.showHistory) {
                this.loadHistory();
            }
        },

        loadHistory() {
            this.historyLoading = true;
            this.$root.emitAgent(this.endpoint, "getConfigHistory", this.stack.name, (res) => {
                this.historyLoading = false;
                if (res.ok) {
                    this.historyRevisions = res.revisions || [];
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        historyChangeItems(changes) {
            return [
                {
                    label: "Compose",
                    counts: changes.compose,
                },
                {
                    label: ".env",
                    counts: changes.env,
                },
                {
                    label: "Override",
                    counts: changes.override,
                },
            ];
        },

        hasHistoryChanges(changes) {
            return this.historyChangeItems(changes).some(({ counts }) => counts.additions > 0 || counts.deletions > 0);
        },

        previewRevision(revisionId) {
            this.processing = true;
            this.$root.emitAgent(this.endpoint, "getConfigRevision", this.stack.name, revisionId, (res) => {
                this.processing = false;
                if (!res.ok) {
                    this.$root.toastRes(res);
                    return;
                }
                const revision = res.revision;
                this.stack.composeYAML = revision.composeYAML;
                this.stack.composeENV = revision.composeENV;
                this.stack.composeOverrideYAML = revision.composeOverrideYAML || "";
                this.yamlCodeChange();
                this.isEditMode = true;
                this.showHistory = false;
                this.$root.toastSuccess("Revision loaded into the editor. Save or deploy to apply it.");
            });
        },

        restoreRevision(revisionId) {
            if (!confirm("Restore this saved stack configuration? The current configuration will be saved to history first.")) {
                return;
            }
            this.processing = true;
            this.$root.emitAgent(this.endpoint, "restoreConfigRevision", this.stack.name, revisionId, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    this.showHistory = false;
                    this.loadStack();
                }
            });
        },

        formatRevisionDate(value) {
            if (!value) {
                return "Saved revision";
            }
            return new Date(value).toLocaleString();
        },

        editorRef(section) {
            if (section === "compose") {
                return this.$refs.editor;
            }
            if (section === "override") {
                return this.$refs.overrideEditor;
            }
            return this.$refs.envEditor;
        },

        toggleFullscreenEditor(section) {
            this.fullscreenEditor = this.fullscreenEditor === section ? null : section;
            document.body.classList.toggle("dockge-editor-fullscreen", Boolean(this.fullscreenEditor));
            this.activeEditorSection = section;
            this.mobileEditorNeedsAlignment = true;
            this.$nextTick(() => {
                const editorRef = this.editorRef(section);
                editorRef?.view?.requestMeasure();
                editorRef?.view?.focus();
            });
        },

        handleFullscreenEscape(event) {
            if (event.key === "Escape" && this.fullscreenEditor) {
                this.fullscreenEditor = null;
                document.body.classList.remove("dockge-editor-fullscreen");
            }
        },

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
                    const editorRef = this.editorRef(this.activeEditorSection);
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
            this.fullscreenEditor = null;
            document.body.classList.remove("dockge-editor-fullscreen");

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
                    this.requestImageUpdateStatus();
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

            this.$root.emitAgent(this.stack.endpoint, "deployStack", this.stack.name, this.stack.composeYAML, this.stack.composeENV, this.stack.composeOverrideYAML || "", this.isAdd, (res) => {
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

            this.$root.emitAgent(this.stack.endpoint, "saveStack", this.stack.name, this.stack.composeYAML, this.stack.composeENV, this.stack.composeOverrideYAML || "", this.isAdd, (res) => {
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
                if (res.ok) {
                    this.requestImageUpdateStatus();
                }
            });
        },

        requestImageUpdateStatus() {
            this.$root.emitAgent(this.endpoint, "imageUpdateStatus", this.stack.name, (res) => {
                if (res.ok) {
                    this.imageUpdateStatus = res.imageUpdateStatus || {};
                }
            });
        },

        checkImages() {
            this.checkingImages = true;
            this.$root.emitAgent(this.endpoint, "checkImages", this.stack.name, (res) => {
                this.checkingImages = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    this.imageUpdateStatus = res.imageUpdateStatus || {};
                }
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

                if (this.stack.composeOverrideYAML?.trim()) {
                    let overrideDoc = parseDocument(this.stack.composeOverrideYAML);
                    if (overrideDoc.errors.length > 0) {
                        throw overrideDoc.errors[0];
                    }
                }

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
    .stack-title {
        margin-bottom: 0.65rem !important;
        font-size: 1.65rem;
    }

    .stack-actions {
        margin-bottom: 0.75rem !important;

        .btn {
            padding: 0.35rem 0.6rem;
            font-size: 0.8125rem;
        }
    }

    .combined-terminal {
        height: clamp(240px, 30vh, 300px);
    }
}

.service-summary {
    width: 100%;
    min-width: 0;
    margin-bottom: 0.85rem;
    overflow: hidden;
    border: 1px solid #adb5bd;
    border-radius: 7px;
}

.service-summary-title {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    padding: 0.38rem 0.65rem;
    border-bottom: 1px solid #adb5bd;

    h2 {
        margin: 0;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.045em;
        text-transform: uppercase;
    }

    span {
        color: #6c757d;
        font-size: 0.75rem;
    }
}

.service-table-wrap {
    overflow-x: auto;
}

.service-summary table {
    width: 100%;
    min-width: 940px;
    border-collapse: collapse;
}

.service-summary th {
    padding: 0.32rem 0.45rem;
    border-bottom: 1px solid #adb5bd;
    color: #6c757d;
    font-size: 0.7rem;
    letter-spacing: 0.035em;
    text-align: left;
    text-transform: uppercase;
    white-space: nowrap;
}

.service-summary td {
    padding: 0.38rem 0.45rem;
    border-bottom: 1px solid rgba(127, 127, 127, 0.22);
    font-size: 0.78rem;
    line-height: 1.2;
    vertical-align: middle;
}

.service-summary tbody tr:last-child td {
    border-bottom: 0;
}

.service-summary .mono {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
}

.service-summary .muted {
    max-width: 240px;
    overflow: hidden;
    color: #6c757d;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.service-dot {
    display: inline-block;
    width: 0.48rem;
    height: 0.48rem;
    margin-right: 0.45rem;
    border-radius: 50%;
    background: #6c757d;

    &.active { background: #198754; }
    &.danger { background: #dc3545; }
}

.service-state {
    display: inline-block;
    padding: 0.16rem 0.38rem;
    border-radius: 0.25rem;
    background: rgba(108, 117, 125, 0.13);
    font-size: 0.7rem;
    font-weight: 700;

    &.active {
        background: rgba(25, 135, 84, 0.14);
        color: #198754;
    }

    &.danger {
        background: rgba(220, 53, 69, 0.14);
        color: #dc3545;
    }
}

.ports span,
.ports a {
    display: block;
    white-space: nowrap;
}

.ports a {
    color: $primary;
    text-decoration: none;

    &:hover {
        text-decoration: underline;
    }
}

.actions-heading,
.service-actions {
    width: 1%;
    text-align: right !important;
    white-space: nowrap;
}

.service-actions :deep(.btn) {
    padding: 0.22rem 0.45rem;
    font-size: 0.72rem;
}

.container-configuration,
.logs-section,
.progress-terminal,
.combined-terminal {
    width: 100%;
    max-width: none;
}

.service-config-card {
    scroll-margin-top: 0.75rem;
}

.stack-workspace {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
}

.logs-section {
    order: -2;
}

.container-configuration {
    order: -1;
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
    margin-bottom: 1.35rem;
}

.stack-section-heading {
    padding-bottom: 0.4rem;
    margin-bottom: 0.75rem;
    border-bottom: 1px solid #ced4da;
    font-size: 1.05rem;

    .dark & {
        border-bottom-color: rgba(127, 127, 127, 0.25);
    }
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

.editor-heading-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
}

.environment-intelligence {
    padding: 1rem;
}

.environment-intelligence-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.5rem;

    h4 {
        margin: 0;
        font-size: 1rem;
    }

    .text-muted {
        font-size: 0.8rem;
    }
}

.environment-variable-list {
    display: grid;
}

.environment-variable-section-heading {
    margin: 0.75rem 0 0.25rem;
    font-size: 0.85rem;
}

.environment-not-referenced {
    margin-top: 0.75rem;
}

.environment-not-referenced-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    font-size: 0.85rem;

    .environment-not-referenced-summary-text {
        min-width: 0;
        overflow-wrap: anywhere;
    }

    .btn {
        flex: 0 0 auto;
    }
}

.environment-variable-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-width: 0;
    padding: 0.45rem 0;
    border-top: 1px solid rgba(127, 127, 127, 0.2);
}

.environment-variable-name {
    display: flex;
    align-items: center;
    min-width: 0;

    code {
        overflow-wrap: anywhere;
    }
}

.environment-variable-symbol {
    width: 1.5rem;
    flex: 0 0 auto;
    font-weight: 700;

    &.is-defined {
        color: #198754;
    }

    &.is-not-in-stack {
        color: #b58105;
    }

    &.is-not-referenced {
        color: #6c757d;
    }
}

.environment-variable-status {
    flex: 0 0 auto;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    background: rgba(108, 117, 125, 0.12);
    color: #5f676e;
    font-size: 0.75rem;
    font-weight: 600;

    &.is-defined {
        background: rgba(25, 135, 84, 0.12);
        color: #157347;
    }

    &.is-not-in-stack {
        background: rgba(255, 193, 7, 0.18);
        color: #765a05;
    }

    .dark & {
        color: $dark-font-color3;
    }
}

.environment-intelligence-note {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
}

.history-list {
    display: grid;
    gap: 0.75rem;
}

.history-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid rgba(127, 127, 127, 0.2);
}

.history-row:last-child {
    border-bottom: 0;
}

.history-meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.history-changes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.75rem;
    margin-top: 0.35rem;
    font-size: 0.82rem;
}

.history-change {
    display: inline-flex;
    gap: 0.3rem;
    white-space: nowrap;
}

.history-change-label {
    color: #6c757d;
}

.history-addition {
    color: #198754;
}

.history-deletion {
    color: #b02a37;
}

.dark {
    .history-change-label {
        color: $dark-font-color3;
    }

    .history-addition {
        color: #75b798;
    }

    .history-deletion {
        color: #ea868f;
    }
}

.history-actions {
    display: flex;
    gap: 0.5rem;
    flex: 0 0 auto;
}

.wrap-toggle,
.fullscreen-toggle {
    flex: 0 0 auto;
}

.wrap-toggle {
    min-width: 78px;
}

.fullscreen-toggle {
    min-width: 108px;
}

.back-to-stacks {
    display: none;
}

.stack-section-filename {
    font-size: 1rem;
    color: #495057;

    .dark & {
        color: $dark-font-color3;
    }
}

.network-fieldset {
    min-width: 0;
    padding: 0;
    margin: 0;
    border: 0;

    .read-only {
        pointer-events: none;
    }
}

.editor-box {
    width: 100%;
    min-width: 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
}

.editor-fullscreen-section {
    position: fixed;
    inset: 0;
    z-index: 2050;
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100dvh;
    margin: 0;
    padding: 1rem;
    overflow: hidden;
    background: #f8f9fa;

    .dark & {
        background: $dark-bg;
    }

    .editor-heading {
        flex: 0 0 auto;
        margin-bottom: 0.75rem;
    }

    .stack-section-filename {
        flex: 0 0 auto;
        margin-bottom: 0.75rem !important;
    }

    .mobile-editor-actions-slot {
        flex: 0 0 auto;
    }

    .editor-box {
        flex: 1 1 auto;
        min-height: 0;
        margin-bottom: 0 !important;
        overflow: hidden;
    }

    :deep(.vue-codemirror),
    :deep(.cm-editor),
    :deep(.cm-scroller) {
        height: 100%;
        min-height: 0;
    }
}

.mobile-editor-actions-slot {
    display: none;
}

.agent-name {
    font-size: 13px;
    color: #495057;

    .dark & {
        color: $dark-font-color3;
    }
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

    .editor-heading-actions {
        width: 100%;
        justify-content: stretch;
    }

    .history-row {
        align-items: stretch;
        flex-direction: column;
    }

    .history-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .history-actions .btn {
        min-height: 40px;
    }

    .wrap-toggle,
    .fullscreen-toggle {
        min-height: 40px;
    }

    .editor-heading-actions > .btn {
        flex: 1 1 0;
        min-width: 0;
    }

    .stack-title {
        max-width: 100%;
        overflow-wrap: anywhere;
        font-size: clamp(1.55rem, 8vw, 2rem);
    }

    .stack-actions.mobile-edit-actions {
        display: none;
    }

    .stack-actions:not(.mobile-edit-actions) {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 0.5rem;
        width: 100%;

        .stack-primary-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.5rem;
            width: 100%;
            margin-right: 0 !important;

            > * {
                width: 100%;
                min-width: 0;
                min-height: 44px;
                margin-left: 0 !important;
                border-radius: 0.5rem !important;
            }

            > :last-child:nth-child(odd) {
                grid-column: 1 / -1;
            }

            :deep(.edit-more > .btn) {
                width: 100%;
                min-height: 44px;
                border-radius: 0.5rem !important;
            }
        }

        .stack-delete-action {
            width: 100%;
            min-height: 44px;
            border-radius: 0.5rem;
        }
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

    .editor-fullscreen-section {
        padding: max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
    }

    .editor-fullscreen-section .editor-heading {
        align-items: stretch;
        flex-direction: column;
    }

    .editor-fullscreen-section .mobile-editor-actions {
        position: static;
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

    .keyboard-active-editor-box:not(.fullscreen-editor-box),
    .keyboard-active-editor-box:not(.fullscreen-editor-box) :deep(.vue-codemirror),
    .keyboard-active-editor-box:not(.fullscreen-editor-box) :deep(.cm-editor),
    .keyboard-active-editor-box:not(.fullscreen-editor-box) :deep(.cm-scroller) {
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
