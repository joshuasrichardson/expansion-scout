/**
 * Web resolution of ScoutMap. react-native-maps has no web support, so Metro
 * resolves this file for the web bundle (keeping the native module out of it
 * entirely — same pattern as llamaTransport.web.ts) and the schematic map,
 * which projects real coordinates offline, is the web experience.
 */

import { SchematicMap, CATEGORY_ICON, CATEGORY_LABEL } from '@/components/schematic-map';

export { CATEGORY_ICON, CATEGORY_LABEL };
export const ScoutMap = SchematicMap;
