import { cryptoCandles } from '../../../server/handlers';

export const onRequestGet: PagesFunction = (ctx) => cryptoCandles(ctx);
