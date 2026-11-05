import { cryptoMarkets } from '../../../server/handlers';

export const onRequestGet: PagesFunction = (ctx) => cryptoMarkets(ctx);
