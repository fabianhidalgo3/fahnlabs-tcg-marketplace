import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { FxModule } from './common/fx.module';
import { AuthModule } from './modules/auth/auth.module';
import { GamesModule } from './modules/games/games.module';
import { SetsModule } from './modules/sets/sets.module';
import { CardsModule } from './modules/cards/cards.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CollectionModule } from './modules/collection/collection.module';
import { StorageModule } from './modules/storage/storage.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri:
          config.get<string>('MONGO_URI') ??
          'mongodb://root:rootpass@localhost:27017/tcgdb?authSource=admin',
      }),
    }),
    FxModule,
    AuthModule,
    GamesModule,
    SetsModule,
    CardsModule,
    InventoryModule,
    OrdersModule,
    CollectionModule,
    StorageModule,
    FavoritesModule,
    ChatModule,
  ],
})
export class AppModule {}
