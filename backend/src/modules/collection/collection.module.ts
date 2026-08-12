import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CardSet, CardSetSchema } from '../../entities/card-set.entity';
import { CardModel, CardModelSchema } from '../../entities/card-model.entity';
import {
  CollectionEntry,
  CollectionEntrySchema,
} from '../../entities/collection-entry.entity';
import { CollectionService } from './collection.service';
import { CollectionController } from './collection.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CardSet.name, schema: CardSetSchema },
      { name: CardModel.name, schema: CardModelSchema },
      { name: CollectionEntry.name, schema: CollectionEntrySchema },
    ]),
  ],
  controllers: [CollectionController],
  providers: [CollectionService],
})
export class CollectionModule {}
