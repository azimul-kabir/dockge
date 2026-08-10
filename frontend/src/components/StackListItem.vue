<template>
    <router-link :to="url" :class="{ 'dim' : !stack.isManagedByDockge }" class="item" @click="$emit('stack-selected', url)">
        <Uptime :stack="stack" :fixed-width="true" class="me-2" />
        <div class="title">
            <span>{{ stackName }}</span>
        </div>
    </router-link>
</template>

<script>
import Uptime from "./Uptime.vue";

export default {
    components: {
        Uptime
    },
    props: {
        /** Stack this represents */
        stack: {
            type: Object,
            default: null,
        },
        /** If the user is in select mode */
        isSelectMode: {
            type: Boolean,
            default: false,
        },
        /** How many ancestors are above this stack */
        depth: {
            type: Number,
            default: 0,
        },
        /** Callback to determine if stack is selected */
        isSelected: {
            type: Function,
            default: () => {}
        },
        /** Callback fired when stack is selected */
        select: {
            type: Function,
            default: () => {}
        },
        /** Callback fired when stack is deselected */
        deselect: {
            type: Function,
            default: () => {}
        },
    },
    emits: [ "stack-selected" ],
    data() {
        return {
            isCollapsed: true,
        };
    },
    computed: {
        endpointDisplay() {
            return this.$root.endpointDisplayFunction(this.stack.endpoint);
        },
        url() {
            if (this.stack.endpoint) {
                return `/compose/${this.stack.name}/${this.stack.endpoint}`;
            } else {
                return `/compose/${this.stack.name}`;
            }
        },
        depthMargin() {
            return {
                marginLeft: `${31 * this.depth}px`,
            };
        },
        stackName() {
            return this.stack.name;
        }
    },
    watch: {
        isSelectMode() {
            // TODO: Resize the heartbeat bar, but too slow
            // this.$refs.heartbeatBar.resize();
        }
    },
    beforeMount() {

    },
    methods: {
        /**
         * Changes the collapsed value of the current stack and saves
         * it to local storage
         * @returns {void}
         */
        changeCollapsed() {
            this.isCollapsed = !this.isCollapsed;

            // Save collapsed value into local storage
            let storage = window.localStorage.getItem("stackCollapsed");
            let storageObject = {};
            if (storage !== null) {
                storageObject = JSON.parse(storage);
            }
            storageObject[`stack_${this.stack.id}`] = this.isCollapsed;

            window.localStorage.setItem("stackCollapsed", JSON.stringify(storageObject));
        },

        /**
         * Toggle selection of stack
         * @returns {void}
         */
        toggleSelection() {
            if (this.isSelected(this.stack.id)) {
                this.deselect(this.stack.id);
            } else {
                this.select(this.stack.id);
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../styles/vars.scss";

.small-padding {
    padding-left: 5px !important;
    padding-right: 5px !important;
}

.collapse-padding {
    padding-left: 8px !important;
    padding-right: 2px !important;
}

.item {
    text-decoration: none;
    display: flex;
    align-items: center;
    min-height: 52px;
    border-radius: 10px;
    transition: all ease-in-out 0.15s;
    width: 100%;
    padding: 5px 8px;
    &.disabled {
        opacity: 0.3;
    }
    &:hover {
        background-color: $highlight-white;
    }
    &.active {
        background-color: #cdf8f4;
    }
    .title {
        margin-top: -4px;
    }
    .endpoint {
        font-size: 12px;
        color: #495057;

        .dark & {
            color: $dark-font-color3;
        }
    }
}

.collapsed {
    transform: rotate(-90deg);
}

.animated {
    transition: all 0.2s $easing-in;
}

.select-input-wrapper {
    float: left;
    margin-top: 15px;
    margin-left: 3px;
    margin-right: 10px;
    padding-left: 4px;
    position: relative;
    z-index: 15;
}

.dim {
    color: #6c757d;

    .dark & {
        color: inherit;
        opacity: 0.5;
    }
}

@media (min-width: 768px) {
    .item {
        .title {
            flex: 1 1 auto;
            min-width: 0;
            font-size: 17px;
            font-weight: 400;

            span {
                display: block;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        }

        :deep(.badge) {
            width: 70px;
            min-width: 70px;
            padding: 4.2px 7.8px;
            font-size: 13px;
            font-weight: 700;
            line-height: 1;
        }
    }
}

@media (max-width: 767.98px) {
    .item {
        box-sizing: border-box;
        min-width: 0;
        min-height: 50px;
        padding: 6px 10px;
        border: 1px solid transparent;
        border-radius: 9px;
        gap: 2px;

        &.active {
            border-color: rgba($primary, 0.3);
            background-color: rgba($primary, 0.12);
            box-shadow: inset 3px 0 0 $primary;
        }

        .dark &.active {
            border-color: rgba($primary, 0.38);
            background-color: rgba($primary, 0.14);
        }

        .title {
            display: block;
            flex: 1 1 auto;
            min-width: 0;
            margin-top: 0;
            font-size: 17px;
            font-weight: 500;
            line-height: 1.25;

            span {
                display: block;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        }

        :deep(.badge) {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 70px;
            width: 70px;
            min-width: 70px;
            min-height: 26px;
            padding: 4px 8px;
            font-size: 13px;
            line-height: 1;
        }
    }
}

</style>
