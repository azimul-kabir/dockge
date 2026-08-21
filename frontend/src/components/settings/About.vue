<template>
    <div class="d-flex justify-content-center align-items-center">
        <div class="logo d-flex flex-column justify-content-center align-items-center">
            <object class="my-4" width="200" height="200" data="/icon.svg" />
            <div class="fs-4 fw-bold">Dockge Next</div>
            <div class="project-subtitle">Community-powered Docker Compose management</div>
            <div>{{ $t("Version") }}: {{ $root.info.version }}</div>
            <div class="frontend-version">{{ $t("Frontend Version") }}: {{ $root.frontendVersion }}</div>

            <div v-if="!$root.isFrontendBackendVersionMatched" class="alert alert-warning mt-4" role="alert">
                ⚠️ {{ $t("Frontend Version do not match backend version!") }}
            </div>

            <div class="maintainer-card my-3">
                <div>Modified and maintained by</div>
                <a href="https://github.com/azimul-kabir" target="_blank" rel="noopener noreferrer">Azimul Kabir</a>
                <div class="project-links mt-2">
                    <a href="https://github.com/azimul-kabir/dockge" target="_blank" rel="noopener noreferrer">GitHub repository</a>
                    <span aria-hidden="true">·</span>
                    <a href="https://github.com/azimul-kabir/dockge/releases" target="_blank" rel="noopener noreferrer">Releases</a>
                </div>
                <div class="upstream-credit mt-2">
                    Dockge Next is a fork of the original <a href="https://github.com/louislam/dockge" target="_blank" rel="noopener noreferrer">Dockge repository</a> by Louis Lam.
                </div>
            </div>

            <div class="mt-1">
                <div class="form-check">
                    <label><input v-model="settings.checkUpdate" type="checkbox" @change="saveSettings()" /> {{ $t("Show update if available") }}</label>
                </div>

                <div class="form-check">
                    <label><input v-model="settings.checkBeta" type="checkbox" :disabled="!settings.checkUpdate" @change="saveSettings()" /> {{ $t("Also check beta release") }}</label>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
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
    },

    watch: {

    }
};
</script>

<style lang="scss" scoped>
.logo {
    margin: 4em 1em;
}

.update-link {
    font-size: 0.8em;
}

.project-subtitle,
.upstream-credit {
    color: #777;
    font-size: 0.9em;
}

.maintainer-card {
    width: min(100%, 420px);
    padding: 1rem 1.25rem;
    text-align: center;
    border: 1px solid rgba(128, 128, 128, 0.25);
    border-radius: 0.75rem;
    background: rgba(128, 128, 128, 0.06);
}

.project-links {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
}

.frontend-version {
    font-size: 0.9em;
    color: #cccccc;

    .dark & {
        color: #333333;
    }
}

</style>
