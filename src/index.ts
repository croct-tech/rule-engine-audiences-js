import engine from '@croct/plug-rule-engine/plugin';
import {PluginArguments} from '@croct/plug/plugin';
import AudiencesExtension, {AudienceMap, audienceMapScheme} from './extension';

declare module '@croct/plug-rule-engine/plugin' {
    export interface ExtensionConfigurations {
        audiences?: AudienceMap;
    }
}

declare module '@croct/plug-rule-engine/rule' {
    export interface RuleProperties {
        audience?: string;
    }
}

engine.extend('experiments', ({options, sdk}: PluginArguments<AudienceMap>) => {
    audienceMapScheme.validate(options);

    return new AudiencesExtension(options, sdk.evaluator, sdk.tracker, sdk.getLogger());
});
