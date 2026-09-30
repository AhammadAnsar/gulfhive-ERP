/**
 * GulfHive ERP - Authoritative API Router Registry
 * Mounts all 11 bounded-context routers under the /api namespace.
 */

import { Router } from 'express';
import { organizationRouter } from './organization.router.ts';
import { identityRouter } from './identity.router.ts';
import { peopleRouter } from './people.router.ts';
import { timeRouter } from './time.router.ts';
import { leaveRouter } from './leave.router.ts';
import { payrollRouter } from './payroll.router.ts';
import { partyRouter } from './party.router.ts';
import { salesRouter } from './sales.router.ts';
import { purchaseRouter } from './purchase.router.ts';
import { projectsRouter } from './projects.router.ts';
import { reportsRouter } from './reports.router.ts';

export const apiRouter = Router();

apiRouter.use('/', organizationRouter);
apiRouter.use('/', identityRouter);
apiRouter.use('/', peopleRouter);
apiRouter.use('/', timeRouter);
apiRouter.use('/', leaveRouter);
apiRouter.use('/', payrollRouter);
apiRouter.use('/', partyRouter);
apiRouter.use('/', salesRouter);
apiRouter.use('/', purchaseRouter);
apiRouter.use('/', projectsRouter);
apiRouter.use('/', reportsRouter);
