import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  // 🔐 Validate email/password
  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  // 🔐 Login (email/password)
  async login(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  // 🔐 Register
  async register(email: string, password: string, name?: string) {
    const existing = await this.usersService.findByEmail(email);

    if (existing) {
      throw new UnauthorizedException('User already exists');
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await this.usersService.createUser({
      email,
      name,
      passwordHash: hash,
    });

    return this.login(user);
  }

  // 🔐 Google login (we will use it next step)
  async googleLogin(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}