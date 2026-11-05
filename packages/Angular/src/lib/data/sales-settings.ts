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

    private static read(name: string): string | null {
        const raw = ApplicationSettingEngine.Instance.GetSetting(name, this.applicationID());
        const value = (raw ?? '').trim();
        return value.length > 0 ? value : null;
    }

    private static applicationID(): string | undefined {
        return new Metadata().Applications?.find((application) => application.Name === SALES_APPLICATION_NAME)?.ID;
    }
}
