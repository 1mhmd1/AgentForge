import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { RefreshTokenService } from './refresh-token.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<{ secret: string }>('jwt')?.secret,
        signOptions: {
          expiresIn:
            (config.get<{ expiresIn: string }>('jwt')?.expiresIn ?? '15m') as any,
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, GoogleStrategy, RefreshTokenService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, RefreshTokenService],
})
export class AuthModule {}
