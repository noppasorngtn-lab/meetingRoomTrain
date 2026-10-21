import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { MeController } from './me.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController, MeController],
  providers: [UsersService],
})
export class UsersModule {}
