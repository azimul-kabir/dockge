import type { DockgeServer } from "./dockge-server";
import { log } from "./log";
import { Settings } from "./settings";
import { Stack } from "./stack";

const DEFAULT_INTERVAL_HOURS = 24;
const MIN_INTERVAL_HOURS = 1;

export class ImageUpdateScheduler {
    private timer?: NodeJS.Timeout;
    private running = false;

    constructor(private readonly server: DockgeServer) {}

    async restart() {
        this.stop();

        if (await Settings.get("imageUpdateCheckEnabled") !== true) {
            log.info("imageUpdateScheduler", "Periodic image update checks are disabled.");
            return;
        }

        const intervalHours = this.getIntervalHours(await Settings.get("imageUpdateCheckIntervalHours"));
        log.info("imageUpdateScheduler", `Periodic image update checks scheduled every ${intervalHours} hour(s).`);
        this.timer = setTimeout(() => {
            this.runAndReschedule().catch(e => {
                log.error("imageUpdateScheduler", `Unable to reschedule image update checks: ${e}`);
            });
        }, intervalHours * 60 * 60 * 1000);
    }

    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }

    private async runAndReschedule() {
        try {
            await this.run();
        } finally {
            await this.restart();
        }
    }

    private async run() {
        if (this.running) {
            log.warn("imageUpdateScheduler", "Skipping image update check because the previous check is still running.");
            return;
        }

        this.running = true;
        const autoDeploy = await Settings.get("imageUpdateAutoDeploy") === true;
        const deleteReplacedImages = await Settings.get("imageUpdateDeleteOldImages") === true;

        try {
            const stackList = await Stack.getStackList(this.server);
            for (const stack of stackList.values()) {
                if (!stack.isManagedByDockge) {
                    continue;
                }

                try {
                    if (autoDeploy) {
                        await stack.update(undefined, deleteReplacedImages, true);
                        continue;
                    }

                    const status = await stack.pullImages();
                    const updateAvailable = Object.values(status).some(item => item.updateAvailable);

                    if (!updateAvailable) {
                        continue;
                    }

                    log.info("imageUpdateScheduler", `New image available for stack ${stack.name}.`);
                } catch (e) {
                    log.error("imageUpdateScheduler", `Failed to update stack ${stack.name}: ${e}`);
                }
            }
        } catch (e) {
            log.error("imageUpdateScheduler", `Periodic image update check failed: ${e}`);
        } finally {
            this.running = false;
        }
    }

    private getIntervalHours(value: unknown) {
        const interval = Number(value ?? DEFAULT_INTERVAL_HOURS);
        if (!Number.isFinite(interval) || interval < MIN_INTERVAL_HOURS) {
            return DEFAULT_INTERVAL_HOURS;
        }
        return interval;
    }
}
