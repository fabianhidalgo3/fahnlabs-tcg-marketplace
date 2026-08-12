import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { baseSchemaOptions } from '../common/schema.util';

export enum UserRole {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
}

@Schema(baseSchemaOptions('users'))
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
