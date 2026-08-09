<template>
    <div class="container-fluid dashboard-page">
        <div class="dashboard-shell">
            <aside v-if="!$root.isMobile" id="stack-list-start" class="dashboard-sidebar">
                <div>
                    <router-link to="/compose" class="btn btn-primary mb-3"><font-awesome-icon icon="plus" /> {{ $t("compose") }}</router-link>
                </div>
                <StackList :scrollbar="true" @stack-selected="prepareStackScroll" />
            </aside>

            <div ref="container" class="dashboard-workspace mb-3">
                <!-- Add :key to disable vue router re-use the same component -->
                <router-view :key="$route.fullPath" :calculatedHeight="height" />
            </div>
        </div>
    </div>
</template>

<script>

import StackList from "../components/StackList.vue";

export default {
    components: {
        StackList,
    },
    data() {
        return {
            height: 0,
            pendingStackPath: null,
        };
    },
    watch: {
        "$route.fullPath"(path) {
            if (path === this.pendingStackPath) {
                this.pendingStackPath = null;
                this.scrollToWorkspace();
            }
        },
    },
    mounted() {
        this.height = this.$refs.container.offsetHeight;
    },
    methods: {
        prepareStackScroll(path) {
            if (window.matchMedia("(max-width: 767.98px)").matches) {
                if (path === this.$route.fullPath) {
                    this.scrollToWorkspace();
                } else {
                    this.pendingStackPath = path;
                }
            }
        },
        scrollToWorkspace() {
            this.$nextTick(() => {
                window.requestAnimationFrame(() => {
                    this.$refs.container?.scrollIntoView({ behavior: "smooth",
                        block: "start" });
                });
            });
        },
    },
};
</script>

<style lang="scss" scoped>
.container-fluid {
    width: 100%;
    max-width: 100%;
    padding-right: max(12px, env(safe-area-inset-right));
    padding-left: max(12px, env(safe-area-inset-left));
}

.dashboard-shell {
    display: grid;
    grid-template-columns: clamp(280px, 22vw, 320px) minmax(0, 1fr);
    gap: 24px;
    width: 100%;
    min-width: 0;
}

.dashboard-sidebar {
    display: flex;
    flex-direction: column;
    min-width: 0;
    max-height: calc(100vh - 24px);
    max-height: calc(100dvh - 24px);
    position: sticky;
    top: 12px;
}

.dashboard-workspace {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    padding-right: calc(var(--bs-gutter-x) * 0.5);
    padding-left: calc(var(--bs-gutter-x) * 0.5);
}

@media (max-width: 767.98px) {
    .container-fluid {
        padding-right: max(10px, env(safe-area-inset-right));
        padding-left: max(10px, env(safe-area-inset-left));
    }

    .dashboard-shell {
        grid-template-columns: minmax(0, 1fr);
        gap: 16px;
    }

    .dashboard-sidebar {
        height: auto;
        max-height: none;
        position: static;
    }
}
</style>
