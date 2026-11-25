import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CardModel, CardModelSchema } from '../../entities/card-model.entity';
import { CardSet, CardSetSchema } from '../../entities/card-set.entity';
import {
  InventoryItem,
  InventoryItemSchema,
} from '../../entities/inventory-item.entity';
import { PriceSnapshot, PriceSnapshotSchema } from '../../entities/price-snapshot.entity';
import { Order, OrderSchema } from '../../entities/order.entity';
import { CardsService } from './cards.service';
import { CardsController } from './cards.controller';
import { ScanService } from './scan.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CardModel.name, schema: CardModelSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: CardSet.name, schema: CardSetSchema },
      { name: PriceSnapshot.name, schema: PriceSnapshotSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [CardsController],
  providers: [CardsService, ScanService],
  exports: [CardsService],
})
export class CardsModule {}
