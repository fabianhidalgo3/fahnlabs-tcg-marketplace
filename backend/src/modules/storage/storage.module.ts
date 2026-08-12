import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  StorageLocation,
  StorageLocationSchema,
} from '../../entities/storage-location.entity';
import {
  CollectionEntry,
  CollectionEntrySchema,
} from '../../entities/collection-entry.entity';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StorageLocation.name, schema: StorageLocationSchema },
      { name: CollectionEntry.name, schema: CollectionEntrySchema },
    ]),
  ],
  controllers: [StorageController],
  providers: [StorageService],
})
export class StorageModule {}
