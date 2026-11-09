import { Metadata, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { ApplicationSettingEngine } from '@memberjunction/core-entities';

/**
 * The Sales application's own settings, read by name.
 *
 * Each row ships in `metadata/application-settings/` with a documented name and a default value; an
 * administrator changes the value per instance through MJ's Application Settings. Reading them through a
 * named accessor rather than a bare string at each call site keeps a typo from silently reading as the
 * default.
 */
const SALES_APPLICATION_NAME = 'Sales';
const APPLICATION_SETTINGS_ENTITY = 'MJ: Application Settings';

export const SALES_SETTING = {
    /**
     * "true" runs every deal on its company's default pipeline: the pipeline controls, labels and
     * filters are hidden, and choosing a company chooses the pipeline.
     */
    HidePipelines: 'HidePipelines',
} as const;

export class SalesSettings {
    /** Idempotent; the engine caches, so callers may call this on every component init. */
    public static async Load(provider?: IMetadataProvider, user?: UserInfo): Promise<void> {
        const metadata = new Metadata();
        await ApplicationSettingEngine.Instance.Config(false, user ?? metadata.CurrentUser, provider ?? Metadata.Provider);
    }

    /** Whether pipelines are hidden. Anything but "true" (any case) leaves them shown. */
    public static get HidePipelines(): boolean {
        return this.read(SALES_SETTING.HidePipelines)?.toLowerCase() === 'true';
    }

    /**
     * {@link HidePipelines} without waiting, or false when the engine has not loaded yet. For a value a
     * component needs on its first render, such as a section name the form's rail reads once.
     */
    public static get HidePipelinesIfLoaded(): boolean {
        try {
            return ApplicationSettingEngine.Instance.Loaded && this.HidePipelines;
        } catch {
            return false;
        }
    }

    /** Loads the settings, then reads {@link HidePipelines}; a failed load leaves pipelines shown. */
    public static async LoadHidePipelines(): Promise<boolean> {
        try {
            await this.Load();
            return this.HidePipelines;
        } catch (error) {
            console.error('Sales settings could not be loaded; pipelines stay shown.', error);
            return false;
        }
    }

    /**
     * Whether the signed-in user may change the Sales settings: they can both create and update
     * `MJ: Application Settings` records. That entity permission is the real gate, since the server
     * refuses a save without it, so the Settings page is shown only to those who hold it.
     */
    public static get CanChange(): boolean {
        try {
            const metadata = new Metadata();
            const entity = metadata.EntityByName(APPLICATION_SETTINGS_ENTITY);
            const user = metadata.CurrentUser;
            if (!entity || !user) {
                return false;
            }
            const permissions = entity.GetUserPermisions(user);
            return permissions.CanCreate && permissions.CanUpdate;
        } catch {
            // Metadata not loaded: no Settings page rather than a broken rail.
            return false;
        }
    }

    /**
     * Turns {@link HidePipelines} on or off for every user of this instance. Saved through the engine,
     * so MJAPI's cache sees the change at once; other users pick it up the next time Sales loads.
     */
    public static async SetHidePipelines(hide: boolean): Promise<boolean> {
        await this.Load();
        return ApplicationSettingEngine.Instance.SetSetting(SALES_SETTING.HidePipelines, hide ? 'true' : 'false', this.applicationID());
    }

    private static read(name: string): string | null {
        const raw = ApplicationSettingEngine.Instance.GetSetting(name, this.applicationID());
        const value = (raw ?? '').trim();
        return value.length > 0 ? value : null;
    }

    private static applicationID(): string | undefined {
        return new Metadata().Applications?.find((application) => application.Name === SALES_APPLICATION_NAME)?.ID;
    }
}
