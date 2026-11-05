import { cryptoExchanges } from '../../../server/handlers';

export const onRequestGet: PagesFunction = (ctx) => cryptoExchanges(ctx);
