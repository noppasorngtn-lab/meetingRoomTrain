import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { FacilitiesController, RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [DatabaseModule],
  controllers: [RoomsController, FacilitiesController],
  providers: [RoomsService],
})
export class RoomsModule {}
