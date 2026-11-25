import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
import { CardModel, CardModelDocument } from '../../entities/card-model.entity';
import { CreateStorageDto, UpdateStorageDto } from './dto/storage.dto';

@Injectable()
export class StorageService {
  constructor(
    @InjectModel(StorageLocation.name)
    private readonly storage: Model<StorageLocationDocument>,
    @InjectModel(CollectionEntry.name)
    private readonly entries: Model<CollectionEntryDocument>,
    @InjectModel(CardModel.name)
    private readonly cards: Model<CardModelDocument>,
  ) {}

  /** Lista de álbumes/cajas del usuario, con su set (si lo tiene) y nº de cartas. */
  async findAll(userId: string): Promise<any[]> {
    const locations = await this.storage
      .find({ user: new Types.ObjectId(userId) })
      .populate('set', 'name code totalCards symbolUrl')
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
    const { setId, ...rest } = dto;
    return this.storage.create({
      ...rest,
      user: new Types.ObjectId(userId),
      set: setId ? new Types.ObjectId(setId) : null,
    });
  }

  async update(userId: string, id: string, dto: UpdateStorageDto) {
    const { setId, ...rest } = dto;
    const patch: Record<string, any> = { ...rest };
    if (setId !== undefined) patch.set = setId ? new Types.ObjectId(setId) : null;
    const loc = await this.storage
      .findOneAndUpdate({ _id: id, user: new Types.ObjectId(userId) }, patch, { new: true })
      .exec();
    if (!loc) throw new NotFoundException('Almacenamiento no encontrado');
    return loc;
  }

  async remove(userId: string, id: string) {
    await this.storage
      .deleteOne({ _id: id, user: new Types.ObjectId(userId) })
      .exec();
    await this.entries
      .updateMany(
        { user: new Types.ObjectId(userId), storage: new Types.ObjectId(id) },
        { $set: { storage: null } },
      )
      .exec();
    return { deleted: true };
  }

  /**
   * Asigna en bloque a este álbum todas las cartas que el usuario posee del set
   * vinculado (útil para "llenar" un binder dedicado a un set de una sola vez).
   */
  async fillFromSet(userId: string, id: string): Promise<{ assigned: number }> {
    const uid = new Types.ObjectId(userId);
    const loc = await this.storage.findOne({ _id: id, user: uid }).exec();
    if (!loc) throw new NotFoundException('Almacenamiento no encontrado');
    if (!loc.set) throw new BadRequestException('El álbum no está vinculado a un set');
    const cardIds = await this.cards.distinct('_id', { set: loc.set });
    const res = await this.entries
      .updateMany(
        { user: uid, cardModel: { $in: cardIds }, quantity: { $gt: 0 } },
        { $set: { storage: loc._id } },
      )
      .exec();
    return { assigned: res.modifiedCount };
  }

  /** Asigna varias cartas (carta+variante+idioma) a un álbum de una sola vez. */
  async assignBulk(
    userId: string,
    storageId: string | null,
    items: { cardModelId: string; variant: string; language: string }[],
  ): Promise<{ assigned: number }> {
    const uid = new Types.ObjectId(userId);
    const target = storageId ? new Types.ObjectId(storageId) : null;
    let assigned = 0;
    for (const it of items) {
      const res = await this.entries
        .updateOne(
          {
            user: uid,
            cardModel: new Types.ObjectId(it.cardModelId),
            variant: it.variant,
            language: it.language,
          },
          { $set: { storage: target } },
        )
        .exec();
      assigned += res.modifiedCount;
    }
    return { assigned };
  }

  /**
   * Detalle de un álbum: las cartas guardadas en él (con idioma/variante/cantidad),
   * separadas entre las del set vinculado y las "extra" (promos, etc.), y —si tiene
   * set— el progreso de ese set dentro de este álbum.
   */
  async findOne(userId: string, id: string): Promise<any> {
    const uid = new Types.ObjectId(userId);
    const loc = await this.storage
      .findOne({ _id: id, user: uid })
      .populate('set', 'name code totalCards series releaseDate symbolUrl')
      .exec();
    if (!loc) throw new NotFoundException('Almacenamiento no encontrado');

    const owned = await this.entries
      .find({ user: uid, storage: new Types.ObjectId(id), quantity: { $gt: 0 } })
      .populate<{ cardModel: any }>(
        'cardModel',
        'name number set imageUrl variantValues rarity cardType',
      )
      .exec();

    const linkedSetId = loc.set ? (loc.set as any)._id?.toString() : null;

    const cardsView = owned
      .filter((e) => e.cardModel)
      .map((e) => {
        const c = e.cardModel as any;
        const value = c.variantValues?.[e.variant] ?? 0;
        return {
          cardId: c._id?.toString(),
          name: c.name,
          number: c.number,
          imageUrl: c.imageUrl,
          rarity: c.rarity,
          setId: c.set?.toString(),
          variant: e.variant,
          language: e.language,
          quantity: e.quantity,
          value,
          lineValue: Math.round(value * e.quantity * 100) / 100,
          inLinkedSet: linkedSetId ? c.set?.toString() === linkedSetId : false,
        };
      })
      .sort((a, b) => (a.number || '').localeCompare(b.number || ''));

    let setProgress: any = null;
    if (linkedSetId) {
      // Slots totales del set (Σ variantes por carta).
      const totalAgg = await this.cards.aggregate<{ totalSlots: number }>([
        { $match: { set: new Types.ObjectId(linkedSetId) } },
        { $group: { _id: null, totalSlots: { $sum: { $size: { $ifNull: ['$variants', []] } } } } },
      ]);
      const totalSlots = totalAgg[0]?.totalSlots ?? 0;
      // Slots del set guardados en ESTE álbum (distintos carta|variante).
      const inAlbumSlots = new Set(
        cardsView.filter((c) => c.inLinkedSet).map((c) => `${c.cardId}|${c.variant}`),
      ).size;
      setProgress = {
        totalSlots,
        inAlbumSlots,
        missing: Math.max(totalSlots - inAlbumSlots, 0),
        percent: totalSlots ? Math.round((inAlbumSlots / totalSlots) * 1000) / 10 : 0,
      };
    }

    const totalValue = Math.round(cardsView.reduce((s, c) => s + c.lineValue, 0) * 100) / 100;

    return {
      ...loc.toJSON(),
      cards: cardsView,
      fromSet: cardsView.filter((c) => c.inLinkedSet),
      extras: cardsView.filter((c) => !c.inLinkedSet),
      setProgress,
      totalValue,
    };
  }
}
