import { SchemaOptions } from 'mongoose';

/**
 * Opciones comunes para todos los esquemas:
 *  - timestamps: createdAt / updatedAt automáticos.
 *  - toJSON: expone `id` (string) en vez de `_id`/`__v`, más cómodo para el frontend.
 */
export const baseSchemaOptions = (collection: string): SchemaOptions => ({
  collection,
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, any>) => {
      if (ret._id) ret.id = ret._id.toString();
      delete ret._id;
      return ret;
    },
  },
});
