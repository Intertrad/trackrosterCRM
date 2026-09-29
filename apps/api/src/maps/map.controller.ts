import { Controller, Get, Module, Query, UseGuards } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { DatabaseModule } from '../database/database.module.js';
import { MapService } from './map.service.js';
import {
  HeatmapDto,
  MapAggregateDto,
  MapCollisionDto,
  MapViewportDto,
  NearbyProspectsDto,
} from './map.dto.js';
@Controller('prospects')
@UseGuards(AuthGuard)
export class ProspectMapController {
  constructor(private readonly maps: MapService) {}
  @Get('map') markers(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: MapViewportDto) {
    return this.maps.markers(a, q);
  }
  @Get('nearby') nearby(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: NearbyProspectsDto) {
    return this.maps.nearby(a, q);
  }
}
@Controller('map')
@UseGuards(AuthGuard)
export class MapAggregateController {
  constructor(private readonly maps: MapService) {}
  @Get('heatmap') heatmap(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: HeatmapDto) {
    return this.maps.heatmap(a, q);
  }
  @Get('coverage') coverage(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: MapAggregateDto) {
    return this.maps.coverage(a, q);
  }
  @Get('collisions') collisions(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: MapCollisionDto,
  ) {
    return this.maps.collisions(a, q);
  }
}
@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [ProspectMapController, MapAggregateController],
  providers: [MapService],
})
export class MapModule {}
