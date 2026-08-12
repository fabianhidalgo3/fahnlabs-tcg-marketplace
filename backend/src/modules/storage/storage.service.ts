import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  StorageLocation,
  StorageLocationDocument,
} from '../../entities/storage-location.entity';
import {
  CollectionEntry,
  CollectionEntryDocument,
} from '../../entities/collection-entry.entity';
import { CreateStorageDto, UpdateStorageDto } from './dto/storage.dto';

@Injectable()
export class StorageService {
  constructor(
    @InjectModel(StorageLocation.name)
    private readonly storage: Model<StorageLocationDocument>,
    @InjectModel(CollectionEntry.name)
    private readonly entries: Model<CollectionEntryDocument>,
  ) {}

  /** Lista de álbumes/cajas del usuario, con cuántas cartas guarda cada uno. */
  async findAll(userId: string): Promise<any[]> {
    const locations = await this.storage
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: 1 })
      .exec();

    const counts = await this.entries.aggregate<{ _id: Types.ObjectId; cards: number }>([
      {
        $match: {
          user: new Types.ObjectId(userId),
          storage: { $ne: null },
          quantity: { $gt: 0 },
        },
      },
      { $group: { _id: '$storage', cards: { $sum: '$quantity' } } },
    ]);
    const byId = new Map(counts.map((c) => [c._id.toString(), c.cards]));

    return locations.map((l) => ({ ...l.toJSON(), cardCount: byId.get(l.id) ?? 0 }));
  }

  create(userId: string, dto: CreateStorageDto) {
    return this.storage.create({ ...dto, user: new Types.ObjectId(userId) });
  }

  async update(userId: string, id: string, dto: UpdateStorageDto) {
    const loc = await this.storage
      .findOneAndUpdate(
        { _id: id, user: new Types.ObjectId(userId) },
        dto,
        { new: true },
      )
      .exec();
    if (!loc) throw new NotFoundException('Almacenamiento no encontrado');
    return loc;
  }

  async remove(userId: string, id: string) {
    await this.storage
      .deleteOne({ _id: id, user: new Types.ObjectId(userId) })
      .exec();
    // Desasigna las cartas que estaban en este storage.
    await this.entries
      .updateMany(
        { user: new Types.ObjectId(userId), storage: new Types.ObjectId(id) },
        { $set: { storage: null } },
      )
      .exec();
    return { deleted: true };
  }
}
