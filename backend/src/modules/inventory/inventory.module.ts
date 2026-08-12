import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  InventoryItem,
  InventoryItemSchema,
} from '../../entities/inventory-item.entity';
import { CardModel, CardModelSchema } from '../../entities/card-model.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: CardModel.name, schema: CardModelSchema },
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
