import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CardSet, CardSetSchema } from '../../entities/card-set.entity';
import { CardModel, CardModelSchema } from '../../entities/card-model.entity';
import {
  CollectionEntry,
  CollectionEntrySchema,
} from '../../entities/collection-entry.entity';
import {
  StorageLocation,
  StorageLocationSchema,
} from '../../entities/storage-location.entity';
import {
  InventoryItem,
  InventoryItemSchema,
} from '../../entities/inventory-item.entity';
import { CollectionService } from './collection.service';
import { CollectionController } from './collection.controller';
import { MissingPdfService } from './missing-pdf.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CardSet.name, schema: CardSetSchema },
      { name: CardModel.name, schema: CardModelSchema },
      { name: CollectionEntry.name, schema: CollectionEntrySchema },
      { name: StorageLocation.name, schema: StorageLocationSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
    ]),
  ],
  controllers: [CollectionController],
  providers: [CollectionService, MissingPdfService],
  exports: [CollectionService],
})
export class CollectionModule {}
