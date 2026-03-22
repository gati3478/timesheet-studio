import type { PageServerLoad } from './$types';
import { isDocExportAvailable } from '$lib/server/capabilities';

export const load: PageServerLoad = async () => {
  return {
    docExportAvailable: await isDocExportAvailable()
  };
};
