import { cryptoPremium } from '../../../server/handlers';

export const onRequestGet: PagesFunction = (ctx) => cryptoPremium(ctx);
