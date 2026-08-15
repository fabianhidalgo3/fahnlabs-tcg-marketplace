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
import { StorageService } from './storage.service';
import { CreateStorageDto, UpdateStorageDto } from './dto/storage.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/current-user.decorator';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.storage.findAll(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.storage.findOne(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStorageDto) {
    return this.storage.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStorageDto,
  ) {
    return this.storage.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.storage.remove(user.id, id);
  }

  /** Llena el álbum con todas las cartas que el usuario posee de su set vinculado. */
  @Post(':id/fill')
  fill(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.storage.fillFromSet(user.id, id);
  }

  /** Asigna varias cartas a un álbum (o las quita si storageId es null). */
  @Post('assign-bulk')
  assignBulk(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      storageId: string | null;
      items: { cardModelId: string; variant: string; language: string }[];
    },
  ) {
    return this.storage.assignBulk(user.id, body.storageId, body.items ?? []);
  }
}
