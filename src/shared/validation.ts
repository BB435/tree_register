import { z } from 'zod';

const sourceIdInput = z.string().trim().min(1).max(200).refine(s => !Object.hasOwn(Object.prototype, s), 'この管理元IDは使用できません。');
export const settingsInput = z.object({ maxDepth: z.number().int().min(1).max(32767), sourceId: sourceIdInput, excludedExtensions: z.array(z.string().regex(/^\.[a-z0-9][a-z0-9_-]{0,19}$/i)).max(100), depthPolicy: z.enum(['error', 'truncate']) }).strict();
export const nodePatchInput = z.object({
  mode: z.enum(['top', 'sub', 'dataset', 'standalone', 'exclude']).optional(),
  title: z.string().max(2000).optional(), description: z.string().max(100000).optional(),
  tagIds: z.array(z.string()).max(10000).optional(), catalogCategoryId: z.string().optional(), inherit: z.boolean().optional(),
}).strict();
const relativePath = z.string().min(1).max(32767).refine(p =>
  !p.includes('\\') && !p.includes(':') && !p.split('/').some(s => !s || s === '.' || s === '..'), 'パスは相対パスを / 区切りで指定してください。');
export const registryInput = z.object({ entries: z.array(z.object({
  sourceId: sourceIdInput, path: relativePath,
  catalogId: z.string().trim().min(1), title: z.string().trim().min(1),
  registeredAt: z.string().trim().min(1).refine(s => !Number.isNaN(Date.parse(s)), '登録日が不正です。'),
})).max(50000) });
