<template>
    <div>
        <form class="my-4" autocomplete="off" @submit.prevent="saveGeneral">
            <!-- Client side Timezone -->
            <div v-if="false" class="mb-4">
                <label for="timezone" class="form-label">
                    {{ $t("Display Timezone") }}
                </label>
                <select id="timezone" v-model="$root.userTimezone" class="form-select">
                    <option value="auto">
                        {{ $t("Auto") }}: {{ guessTimezone }}
                    </option>
                    <option
                        v-for="(timezone, index) in timezoneList"
                        :key="index"
                        :value="timezone.value"
                    >
                        {{ timezone.name }}
                    </option>
                </select>
            </div>

            <!-- Server Timezone -->
            <div v-if="false" class="mb-4">
                <label for="timezone" class="form-label">
                    {{ $t("Server Timezone") }}
                </label>
                <select id="timezone" v-model="settings.serverTimezone" class="form-select">
                    <option value="UTC">UTC</option>
                    <option
                        v-for="(timezone, index) in timezoneList"
                        :key="index"
                        :value="timezone.value"
                    >
                        {{ timezone.name }}
                    </option>
                </select>
            </div>

            <!-- Primary Hostname -->
            <div class="mb-4">
                <label class="form-label" for="primaryBaseURL">
                    {{ $t("primaryHostname") }}
                </label>

                <div class="input-group mb-3">
                    <input
                        v-model="settings.primaryHostname"
                        class="form-control"
                        :placeholder="$t(`CurrentHostname`)"
                    />
                    <button class="btn btn-outline-primary" type="button" @click="autoGetPrimaryHostname">
                        {{ $t("autoGet") }}
                    </button>
                </div>

                <div class="form-text"></div>
            </div>

            <div class="mb-4">
                <h5 class="settings-subheading">Automatic image updates</h5>
                <div class="form-check mb-3">
                    <input
                        id="imageUpdateCheckEnabled"
                        v-model="settings.imageUpdateCheckEnabled"
                        class="form-check-input"
                        type="checkbox"
                    />
                    <label class="form-check-label" for="imageUpdateCheckEnabled">
                        Check for newer container images periodically
                    </label>
                </div>

                <label class="form-label" for="imageUpdateCheckIntervalHours">Check every</label>
                <div class="input-group mb-3 image-update-interval">
                    <input
                        id="imageUpdateCheckIntervalHours"
                        v-model.number="settings.imageUpdateCheckIntervalHours"
                        class="form-control"
                        type="number"
                        min="1"
                        step="1"
                        :disabled="!settings.imageUpdateCheckEnabled"
                    />
                    <span class="input-group-text">hours</span>
                </div>

                <div class="form-check">
                    <input
                        id="imageUpdateAutoDeploy"
                        v-model="settings.imageUpdateAutoDeploy"
                        class="form-check-input"
                        type="checkbox"
                        :disabled="!settings.imageUpdateCheckEnabled"
                    />
                    <label class="form-check-label" for="imageUpdateAutoDeploy">
                        Automatically deploy newer images for running stacks
                    </label>
                </div>
                <div class="form-check mt-3">
                    <input
                        id="imageUpdateDeleteOldImages"
                        v-model="settings.imageUpdateDeleteOldImages"
                        class="form-check-input"
                        type="checkbox"
                    />
                    <label class="form-check-label" for="imageUpdateDeleteOldImages">
                        Delete replaced images after successful updates
                    </label>
                </div>
                <div class="form-text">
                    Image checks pull the configured tags. Automatic deployment only recreates managed stacks that are already running. Image cleanup applies to both automatic updates and the manual Update button; images still used elsewhere are kept.
                </div>
            </div>

            <!-- Save Button -->
            <div>
                <button class="btn btn-primary" type="submit">
                    {{ $t("Save") }}
                </button>
            </div>
        </form>
    </div>
</template>

<script>

import dayjs from "dayjs";
import { timezoneList } from "../../util-frontend";

export default {
    components: {

    },

    data() {
        return {
            timezoneList: timezoneList(),
        };
    },

    computed: {
        settings() {
            return this.$parent.$parent.$parent.settings;
        },
        saveSettings() {
            return this.$parent.$parent.$parent.saveSettings;
        },
        settingsLoaded() {
            return this.$parent.$parent.$parent.settingsLoaded;
        },
        guessTimezone() {
            return dayjs.tz.guess();
        }
    },

    methods: {
        /** Save the settings */
        saveGeneral() {
            localStorage.timezone = this.$root.userTimezone;
            this.saveSettings();
        },
        /** Get the base URL of the application */
        autoGetPrimaryHostname() {
            this.settings.primaryHostname = location.hostname;
        },
    },
};
</script>

<style scoped>
.image-update-interval {
    max-width: 16rem;
}
</style>
