import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Game, GameSchema } from '../../entities/game.entity';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Game.name, schema: GameSchema }]),
  ],
  controllers: [GamesController],
  providers: [GamesService],
})
export class GamesModule {}
