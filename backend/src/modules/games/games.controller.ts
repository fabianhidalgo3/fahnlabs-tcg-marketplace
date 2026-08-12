import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GamesService } from './games.service';
import { CreateGameDto, UpdateGameDto } from './dto/game.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { UserRole } from '../../entities/user.entity';

@Controller('games')
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get()
  findAll() {
    return this.games.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.games.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateGameDto) {
    return this.games.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateGameDto) {
    return this.games.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.games.remove(id);
  }
}
