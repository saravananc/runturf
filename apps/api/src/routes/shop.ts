import { Router } from 'express';
import { z } from 'zod';
import { h, requireAuth } from '../middleware.js';
import { buyItem, getShop } from '../services/shop.js';

const Code = z.string().min(1).max(40);

export const shopRouter = Router();
shopRouter.use(requireAuth);

shopRouter.get(
  '/',
  h(async (req, res) => {
    res.json(await getShop(req.userId));
  }),
);

shopRouter.post(
  '/:code/buy',
  h(async (req, res) => {
    // Item codes are short slugs, not UUIDs.
    res.json(await buyItem(req.userId, Code.parse(req.params.code)));
  }),
);
