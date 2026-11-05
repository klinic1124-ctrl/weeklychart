import { stockSearch } from '../../../server/handlers';

export const onRequestGet: PagesFunction = (ctx) => stockSearch(ctx);
