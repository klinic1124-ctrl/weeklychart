import { stockCandles } from '../../../server/handlers';

export const onRequestGet: PagesFunction = (ctx) => stockCandles(ctx);
