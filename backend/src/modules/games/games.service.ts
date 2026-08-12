import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Game, GameDocument } from '../../entities/game.entity';
import { CreateGameDto, UpdateGameDto } from './dto/game.dto';

@Injectable()
export class GamesService {
  constructor(
    @InjectModel(Game.name) private readonly games: Model<GameDocument>,
  ) {}

  findAll() {
    return this.games.find().sort({ name: 1 }).exec();
  }

  async findOne(id: string) {
    const game = await this.games.findById(id).exec();
    if (!game) throw new NotFoundException('Juego no encontrado');
    return game;
  }

  create(dto: CreateGameDto) {
    return this.games.create(dto);
  }

  async update(id: string, dto: UpdateGameDto) {
    const game = await this.games.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!game) throw new NotFoundException('Juego no encontrado');
    return game;
  }

  async remove(id: string) {
    await this.games.findByIdAndDelete(id).exec();
    return { deleted: true };
  }
}
