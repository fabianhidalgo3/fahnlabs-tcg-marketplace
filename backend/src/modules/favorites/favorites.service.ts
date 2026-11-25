import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Favorite,
  FavoriteDocument,
  FavoriteKind,
} from '../../entities/favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name)
    private readonly favorites: Model<FavoriteDocument>,
  ) {}

  /** Marca/desmarca un favorito. Devuelve el estado final. */
  async toggle(
    userId: string,
    kind: FavoriteKind,
    id: string,
  ): Promise<{ favorite: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Id inválido');
    }
    const uid = new Types.ObjectId(userId);
    const ref = new Types.ObjectId(id);
    const filter =
      kind === FavoriteKind.CARD
        ? { user: uid, kind, card: ref }
        : { user: uid, kind, set: ref };

    const existing = await this.favorites.findOne(filter).exec();
    if (existing) {
      await this.favorites.deleteOne({ _id: existing._id }).exec();
      return { favorite: false };
    }
    await this.favorites.create(
      kind === FavoriteKind.CARD
        ? { user: uid, kind, card: ref }
        : { user: uid, kind, set: ref },
    );
    return { favorite: true };
  }

  /** Ids de favoritos del usuario (para pintar los corazones sin poblar). */
  async ids(userId: string): Promise<{ cards: string[]; sets: string[] }> {
    const uid = new Types.ObjectId(userId);
    const all = await this.favorites.find({ user: uid }).exec();
    return {
      cards: all
        .filter((f) => f.kind === FavoriteKind.CARD && f.card)
        .map((f) => f.card!.toString()),
      sets: all
        .filter((f) => f.kind === FavoriteKind.SET && f.set)
        .map((f) => f.set!.toString()),
    };
  }

  /** Favoritos poblados para la vista "Mis favoritos". */
  async list(userId: string): Promise<any> {
    const uid = new Types.ObjectId(userId);
    const [cards, sets] = await Promise.all([
      this.favorites
        .find({ user: uid, kind: FavoriteKind.CARD })
        .sort({ createdAt: -1 })
        .populate('card', 'name number rarity cardType imageUrl set variantValues')
        .exec(),
      this.favorites
        .find({ user: uid, kind: FavoriteKind.SET })
        .sort({ createdAt: -1 })
        .populate('set', 'name code series totalCards symbolUrl releaseDate')
        .exec(),
    ]);
    return {
      cards: cards.filter((f) => f.card).map((f) => f.card),
      sets: sets.filter((f) => f.set).map((f) => f.set),
    };
  }
}
