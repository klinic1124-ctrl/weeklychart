import { diag } from '../../server/diag';

export const onRequestGet: PagesFunction = (ctx) => diag(ctx);
