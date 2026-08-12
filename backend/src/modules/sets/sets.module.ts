import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CardSet, CardSetSchema } from '../../entities/card-set.entity';
import { CardModel, CardModelSchema } from '../../entities/card-model.entity';
import {
  InventoryItem,
  InventoryItemSchema,
} from '../../entities/inventory-item.entity';
import { SetsService } from './sets.service';
import { SetsController } from './sets.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CardSet.name, schema: CardSetSchema },
      { name: CardModel.name, schema: CardModelSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
    ]),
  ],
  controllers: [SetsController],
  providers: [SetsService],
})
export class SetsModule {}
