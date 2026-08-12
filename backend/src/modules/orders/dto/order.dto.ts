import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderStatus } from '../../../entities/order.entity';

export class OrderLineDto {
  @IsString() @IsNotEmpty() inventoryItemId: string;
  @IsInt() @Min(1) quantity: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items: OrderLineDto[];

  @IsOptional() @IsString() shippingName?: string;
  @IsOptional() @IsString() shippingAddress?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus) status: OrderStatus;
}
