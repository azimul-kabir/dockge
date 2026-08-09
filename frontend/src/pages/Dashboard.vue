<template>
    <div class="dashboard-shell" :class="{ 'mobile-stack-root': $root.isMobile && $route.path === '/' }">
        <aside v-if="!$root.isMobile" class="stack-sidebar">
            <router-link to="/compose" class="btn btn-primary new-stack"><font-awesome-icon icon="plus" /> {{ $t("compose") }}</router-link>
            <StackList :scrollbar="true" />
        </aside>

        <section v-if="$root.isMobile && $route.path === '/'" class="mobile-stack-list">
            <header class="mobile-list-header">
                <div class="brand"><img src="/icon.svg" alt="" /> <strong>Dockge</strong></div>
                <router-link to="/compose" class="btn btn-primary icon-button" :aria-label="$t('compose')"><font-awesome-icon icon="plus" /></router-link>
            </header>
            <StackList :scrollbar="false" />
        </section>

        <section v-else ref="container" class="dashboard-workspace">
            <!-- Add :key to disable vue router re-use the same component -->
            <router-view :key="$route.fullPath" :calculatedHeight="height" />
        </section>
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
            height: 0
        };
    },
    mounted() {
        this.height = this.$refs.container?.offsetHeight || 0;
    },
};
</script>

<style lang="scss" scoped>
@import "../styles/vars.scss";

.dashboard-shell {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    gap: 16px;
    width: calc(100% - 32px);
    max-width: 1920px;
    margin: 0 auto;
}

.stack-sidebar {
    position: sticky;
    top: 8px;
    height: calc(100dvh - 112px);
    min-width: 0;
    overflow: hidden;
}

.new-stack {
    margin-bottom: 12px;
}

.dashboard-workspace {
    min-width: 0;
}

.mobile-stack-list {
    width: 100%;
    min-height: 100dvh;
    padding: max(12px, env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom));
}

.mobile-list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    .brand {
        display: flex;
        gap: 10px;
        align-items: center;
        font-size: 22px;
    }

    img {
        width: 34px;
        height: 34px;
    }
}

.icon-button {
    display: grid;
    width: 44px;
    height: 44px;
    padding: 0;
    place-items: center;
}

@media (max-width: 767.98px) {
    .dashboard-shell {
        display: block;
        width: 100%;
    }

    .dashboard-workspace {
        width: 100%;
    }
}
</style>
