import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CardModel, CardModelSchema } from '../../entities/card-model.entity';
import {
  InventoryItem,
  InventoryItemSchema,
} from '../../entities/inventory-item.entity';
import { CardsService } from './cards.service';
import { CardsController } from './cards.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CardModel.name, schema: CardModelSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
    ]),
  ],
  controllers: [CardsController],
  providers: [CardsService],
})
export class CardsModule {}
